"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

/** A navigational button rendered as one link, including during hydration. */
export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return <Link data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
