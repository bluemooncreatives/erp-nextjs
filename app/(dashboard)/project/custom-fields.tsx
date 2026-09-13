import { projectFields } from '@/lib/project/fields';
import { projectMembers } from '@/lib/project/repository';
import { Card } from '@/components/erp/page';
import { FieldControl } from './field-controls';

export async function CustomFields({ projectId, taskId }: { projectId: number; taskId?: number }) {
  const rows = await projectFields(projectId, taskId);
  const members = (await projectMembers(projectId)).map((m) => ({ id: m.id, name: m.name ?? 'Unknown' }));
  return <Card title="Custom fields"><div className="space-y-3">
    {rows.filter((r) => !taskId || r.link.visibility === 1).map(({ field, link, options, value }) =>
      <FieldControl key={`${field.id}:${value?.updatedAt?.getTime() ?? 0}`} projectId={projectId} taskId={taskId} members={members} field={{
        id: field.id, name: field.name ?? 'Field', type: field.type, visibility: link.visibility, isDefault: field.default === 1,
        options: options.map((o) => ({ id: o.id, label: o.option ?? '' })),
        value: String(field.type === 'date' ? value?.date?.toISOString().slice(0, 10) ?? '' : field.type === 'number' ? value?.number ?? '' : field.type === 'dropdown' ? value?.optionId ?? '' : field.type === 'user_id' ? value?.userId ?? '' : value?.text ?? ''),
      }} />)}
    {!taskId ? <FieldControl projectId={projectId} /> : null}
  </div></Card>;
}
