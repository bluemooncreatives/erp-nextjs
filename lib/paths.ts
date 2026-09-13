// ---------------------------------------------------------------------------
// Asset path helpers.
//
// The database stores upload paths exactly as Laravel wrote them, e.g.
// `public/uploads/settings/logo.png`, because the PHP app served the project
// root. Next serves the `public/` directory at `/`, so the prefix is stripped.
// ---------------------------------------------------------------------------

/** Laravel's `asset($path)` for a stored upload path. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('data:')) return path;
  return `/${path.replace(/^public\//, '').replace(/^\/+/, '')}`;
}

/** Avatar with the same `ui-avatars.com` fallback `User::defaultProfilePhotoUrl()` used. */
export function avatarUrl(
  avatar: string | null | undefined,
  name: string,
): string {
  return (
    assetUrl(avatar) ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&color=7F9CF5&background=EBF4FF`
  );
}

/** `get_file_type($file_name)` from Helper.php. */
export function getFileType(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : null;
}
