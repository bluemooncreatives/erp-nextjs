'use client';

// Editing a project comment - `ProjectController@updateComment`.
//
// The conversation could post and delete but not amend, because
// `updateProjectComment` had no control. The body becomes a textarea in place.

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/erp/submit-button';
import { updateProjectComment } from '../../actions';

export function CommentBody({
  commentId,
  projectId,
  comment,
  editable,
}: {
  commentId: number;
  projectId: number;
  comment: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm whitespace-pre-wrap">{comment}</p>
        {editable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Edit comment"
            className="shrink-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={updateProjectComment}
      className="mt-2 space-y-2"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="comment_id" value={commentId} />
      <input type="hidden" name="project_id" value={projectId} />
      <textarea
        name="comment"
        rows={3}
        required
        autoFocus
        defaultValue={comment}
        aria-label="Comment"
        className="border-border text-foreground placeholder:text-muted-foreground focus:border-ring w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <SubmitButton size="sm">Save</SubmitButton>
      </div>
    </form>
  );
}
