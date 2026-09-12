// `file.download` - HomeController@fileDownload.
//
// The PHP handed the requested path straight to `public_path()`, which let a
// crafted segment walk out of `public/`. `downloadPublicFile` refuses that.

import { requireUser } from '@/lib/auth/permissions';
import { decodeDocumentPath, downloadPublicFile } from '@/lib/downloads';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  // The route sat behind `auth` in the PHP router.
  await requireUser();

  const { fileName } = await params;
  return downloadPublicFile(decodeDocumentPath(fileName));
}
