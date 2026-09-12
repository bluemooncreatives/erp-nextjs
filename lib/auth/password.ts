// ---------------------------------------------------------------------------
// Password hashing - bit-compatible with Laravel's Hash facade.
//
// Laravel's bcrypt driver produces `$2y$10$...` hashes. bcryptjs verifies the
// `$2y$` prefix, so every password already in the `users` table keeps working
// with no reset required. New hashes are written back in the `$2y$` dialect so
// the PHP app could still read them during a phased cut-over.
// ---------------------------------------------------------------------------

import bcrypt from 'bcryptjs';

/** Laravel's default bcrypt cost (config/hashing.php `rounds`). */
const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  const hash = await bcrypt.hash(plain, ROUNDS);
  // Normalise to PHP's `$2y$` identifier for round-trip compatibility.
  return hash.replace(/^\$2[ab]\$/, '$2y$');
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Mirrors Laravel's `Hash::needsRehash()`. */
export function needsRehash(hash: string): boolean {
  const m = /^\$2[aby]\$(\d{2})\$/.exec(hash);
  if (!m) return true;
  return Number.parseInt(m[1], 10) !== ROUNDS;
}

/** Equivalent of the PHP helper `randomString($length, $type)`. */
export function randomString(length: number, type: 'token' | 'password' | 'username' = 'token') {
  const chars =
    type === 'password'
      ? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-=+;:,.?'
      : type === 'username'
        ? 'abcdefghijklmnopqrstuvwxyz0123456789'
        : 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}
