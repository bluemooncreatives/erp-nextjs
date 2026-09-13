'use client';
import { useState, useTransition } from 'react';
import { reorderProjectItem } from './order-actions';

export function OrderControls({ projectId, kind, id, target = null, position, count }: { projectId: number; kind: 'task' | 'section' | 'subtask'; id: number; target?: number | null; position: number; count: number }) {
  const [pending, start] = useTransition(); const [error, setError] = useState('');
  const move = (position: number) => start(async () => {
    const data = new FormData();
    Object.entries({ project_id: projectId, kind, id, target: target ?? '', position }).forEach(([k, v]) => data.set(k, String(v)));
    const result = await reorderProjectItem(data); setError(result.error ?? '');
  });
  return <span className="inline-flex flex-wrap gap-1">
    <button type="button" aria-label={`Move ${kind} up`} disabled={pending || position === 0} onClick={() => move(position - 1)} className="rounded border px-2 disabled:opacity-30">↑</button>
    <button type="button" aria-label={`Move ${kind} down`} disabled={pending || position >= count - 1} onClick={() => move(position + 1)} className="rounded border px-2 disabled:opacity-30">↓</button>
    {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
  </span>;
}
