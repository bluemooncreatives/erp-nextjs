'use client';

// A member's own colour, icon and favourite flag for a project -
// `ProjectController@updateElement`.
//
// The Vue sidebar let each member mark a project a favourite and give it a
// colour so it stood out in their own list. The port carried the column, the
// repository call and the `updateProjectPreference` action, and then offered no
// way to reach any of it.
//
// Each control posts on change rather than behind a Save, which is what the
// original did - these are per-user preferences, not project data.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { updateProjectPreference } from '../../actions';

/** The palette the Vue colour picker offered. */
const COLOURS = [
  '7F32FE',
  '2F80ED',
  '27AE60',
  'F2994A',
  'EB5757',
  '9B51E0',
  '56CCF2',
  '828282',
];

export function ProjectPreferences({
  projectId,
  colour,
  favourite,
}: {
  projectId: number;
  colour: string | null;
  favourite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const set = (element: 'color' | 'favourite', value: string) => {
    const data = new FormData();
    data.set('project_id', String(projectId));
    data.set('element', element);
    data.set('value', value);
    startTransition(async () => {
      await updateProjectPreference(data);
      router.refresh();
    });
  };

  const active = (colour ?? '').replace('#', '').toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
        aria-pressed={favourite}
        onClick={() => set('favourite', favourite ? '0' : '1')}
      >
        <Star className={cn('size-4', favourite && 'fill-current text-amber-500')} />
      </Button>

      <div className="flex items-center gap-1" role="group" aria-label="Project colour">
        {COLOURS.map((hex) => (
          <button
            key={hex}
            type="button"
            disabled={pending}
            aria-label={`Colour #${hex}`}
            aria-pressed={active === hex}
            onClick={() => set('color', hex)}
            className={cn(
              'size-4 rounded-full ring-offset-2 transition',
              active === hex ? 'ring-foreground ring-2' : 'hover:ring-border hover:ring-2',
            )}
            style={{ background: `#${hex}` }}
          />
        ))}
      </div>
    </div>
  );
}
