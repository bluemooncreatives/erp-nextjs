"use client";

import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/utils";

/** One confirm dialog for every destructive action — the confirm button says
 *  what will happen ("Delete agent"), never "OK". `confirmPhrase` gates the irreversible cases with type-to-confirm. */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Label for the confirming button. Say the action, not "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** Requires the user to type this exact string before confirming. */
  confirmPhrase?: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  confirmPhrase,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const gated = Boolean(confirmPhrase) && typed.trim() !== confirmPhrase;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {confirmPhrase ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-phrase">
              Type <span className="font-mono font-medium text-foreground">{confirmPhrase}</span> to
              confirm
            </Label>
            <Input
              id="confirm-phrase"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || gated}
            className={cn(
              tone === "danger" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            onClick={(event) => {
              // The dialog must stay open while the request is in flight,
              // otherwise a failure has nowhere to report itself.
              event.preventDefault();
              void onConfirm();
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
