import { Fragment } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/utils";

/** Numbered-step progress rail — three screens built their own version; this
 *  covers their real differences (labels, rail style, clickable) through props. */

export interface StepperItem {
  key: string;
  label: string;
  /** Present together with a true `isReachable(index)` → renders as a `Link`. */
  href?: string;
}

export interface StepperProps {
  steps: StepperItem[];
  currentIndex: number;
  /** Only consulted for steps that have an `href`. Defaults to always reachable. */
  isReachable?: (index: number) => boolean;
  /** `below` stacks the label under a centered rail; `inline` sits it beside each circle. */
  labelPosition?: "below" | "inline";
  /** `line` is a filled progress rail between circles; `chevron` is a separator glyph. */
  connector?: "line" | "chevron";
  /** `filled` fully colors the active circle; `ring` tints it and rings it instead. */
  activeStyle?: "filled" | "ring";
  size?: "sm" | "default";
  /** Wraps the rail in the console's card shell (the wizard's treatment). */
  shell?: boolean;
  /** `inline` only: hides the label below `sm` instead of letting it wrap/crowd the rail. */
  hideLabelOnMobile?: boolean;
  className?: string;
}

const CIRCLE_SIZE: Record<NonNullable<StepperProps["size"]>, string> = {
  sm: "size-5 text-2xs",
  default: "size-7 text-xs",
};

function StepCircle({
  index,
  done,
  active,
  size,
  activeStyle,
}: {
  index: number;
  done: boolean;
  active: boolean;
  size: NonNullable<StepperProps["size"]>;
  activeStyle: NonNullable<StepperProps["activeStyle"]>;
}) {
  return (
    <span
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors",
        CIRCLE_SIZE[size],
        done || (active && activeStyle === "filled")
          ? "bg-primary text-primary-foreground"
          : active && activeStyle === "ring"
            ? "bg-primary/15 text-primary ring-2 ring-primary"
            : "bg-muted text-muted-foreground",
        active && activeStyle === "filled" && size === "default" && "ring-4 ring-primary/15",
      )}
    >
      {done ? <Check className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden="true" /> : index + 1}
    </span>
  );
}

export function Stepper({
  steps,
  currentIndex,
  isReachable = () => true,
  labelPosition = "inline",
  connector = "line",
  activeStyle = "filled",
  size = "default",
  shell = false,
  hideLabelOnMobile = false,
  className,
}: StepperProps) {
  if (labelPosition === "below") {
    return (
      <div className={className}>
        <div className="flex items-center">
          {steps.map((step, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <div key={step.key} className="flex flex-1 items-center last:flex-none">
                <StepCircle index={index} done={done} active={active} size={size} activeStyle={activeStyle} />
                {index < steps.length - 1 ? (
                  <span className={cn("mx-2 h-0.5 flex-1 rounded-full transition-colors", done ? "bg-primary" : "bg-muted")} />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex text-2xs font-medium">
          {steps.map((step, index) => {
            const active = index === currentIndex;
            return (
              <span
                key={step.key}
                className={cn(
                  "flex-1",
                  index === 0 ? "text-start" : index === steps.length - 1 ? "text-end" : "text-center",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <ol
      aria-label="Progress"
      className={cn(
        "flex w-full items-center gap-1.5 sm:gap-2.5",
        connector === "chevron" && "overflow-x-auto",
        shell && "rounded-xl bg-card p-2.5 shadow-xs ring-1 ring-foreground/10",
        className,
      )}
    >
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const reachable = Boolean(step.href) && isReachable(index);

        const content = (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <StepCircle index={index} done={done} active={active} size={size} activeStyle={activeStyle} />
            <span
              className={cn(
                "text-sm font-medium",
                hideLabelOnMobile && "hidden sm:inline",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </span>
        );

        return (
          <Fragment key={step.key}>
            <li className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              {connector === "chevron" && index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
              ) : null}
              {reachable && !active ? (
                <Link href={step.href!} className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
            {connector === "line" && index < steps.length - 1 ? (
              <li aria-hidden="true" className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
