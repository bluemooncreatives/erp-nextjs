import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface HowItWorksStep {
  title: string;
  description: ReactNode;
}

export interface HowItWorksProps {
  /** Names the screen being explained, e.g. "the competency map". */
  subject: string;
  /** One or two sentences on what this screen is for, before the numbered steps. */
  intro: ReactNode;
  steps: HowItWorksStep[];
  /** Optional closing note — a caveat, a shortcut, or what happens next. */
  footnote?: ReactNode;
}

/**
 * The "How it works" affordance every screen carries in its header actions.
 *
 * Content is passed in rather than looked up by route: each screen owns the explanation of itself,
 * so the copy lives next to the thing it describes and cannot drift when a screen changes.
 */
export function HowItWorks({ subject, intro, steps, footnote }: HowItWorksProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
          <HelpCircle className="size-4" />
          How it works
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How {subject} works</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        {footnote ? (
          <p className="text-muted-foreground border-t border-border pt-4 text-xs">{footnote}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
