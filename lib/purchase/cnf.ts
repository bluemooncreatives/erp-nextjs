import 'server-only';
import { cNFs, type CNFsRow } from '@/lib/db/schema';
import { createReferenceRepository } from '@/lib/crud/reference-entity';

export const cnfRepository = createReferenceRepository<CNFsRow>({
  table: cNFs, id: cNFs.id, searchable: [cNFs.name, cNFs.email, cNFs.phone, cNFs.address],
  audit: { createdBy: 'createdBy', updatedBy: 'updatedBy', createdAt: 'createdAt', updatedAt: 'updatedAt' },
});
