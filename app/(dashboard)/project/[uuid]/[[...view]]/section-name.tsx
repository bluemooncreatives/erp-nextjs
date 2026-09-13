'use client';

// Renaming a section - `SectionController@update`.
//
// The Vue board renamed in place by clicking the heading. The same idea here,
// minus the drag handle: the heading is a button that swaps itself for a field,
// and the field posts the existing `updateSectionName` action - which was
// written and then never given a control.

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateSectionName } from '../../actions';

export function SectionName({
  sectionId,
  projectId,
  name,
  count,
  editable,
}: {
  sectionId: number | null;
  projectId: number;
  name: string;
  count: number;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (!editable || sectionId == null) {
    return (
      <>
        {name} ({count})
      </>
    );
  }

  if (!editing) {
    return (
      <span className="group/name inline-flex items-center gap-1.5">
        {name} ({count})
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Rename ${name}`}
          className="opacity-0 transition group-hover/name:opacity-100 focus-visible:opacity-100"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
      </span>
    );
  }

  return (
    <form
      action={updateSectionName}
      className="flex items-center gap-1.5"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="section_id" value={sectionId} />
      <input type="hidden" name="project_id" value={projectId} />
      <Input
        name="name"
        defaultValue={name}
        autoFocus
        required
        aria-label="Section name"
        className="h-8 w-48"
      />
      <Button type="submit" variant="ghost" size="icon" aria-label="Save section name">
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cancel"
        onClick={() => setEditing(false)}
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}
