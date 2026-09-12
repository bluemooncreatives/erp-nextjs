// `verification.verify` - VerificationController@verify. The link is a
// temporary signed URL carrying the user id and `sha1(email)`.

import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { hasValidSignature } from '@/lib/auth/signed-url';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; hash: string }> },
) {
  const { id, hash } = await context.params;

  if (!hasValidSignature(request.nextUrl.pathname, request.nextUrl.searchParams)) {
    return NextResponse.redirect(new URL('/email/verify?invalid=1', request.url));
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, verifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, Number(id)))
    .limit(1);

  const expected = user?.email
    ? createHash('sha1').update(user.email).digest('hex')
    : null;

  if (!user || expected !== hash) {
    return NextResponse.redirect(new URL('/email/verify?invalid=1', request.url));
  }

  if (!user.verifiedAt) {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return NextResponse.redirect(new URL('/login?verified=1', request.url));
}
