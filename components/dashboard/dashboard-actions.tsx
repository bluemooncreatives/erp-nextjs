"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ButtonProps } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function DashboardActions({ createHref, reviewHref }: { createHref: string; reviewHref: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Link href={createHref} data-slot="button" className={buttonVariants()}>New sale</Link>
      <Link href={reviewHref} data-slot="button" className={buttonVariants({ variant: "soft" })}>
        Review sales<ArrowRight />
      </Link>
    </div>
  );
}

export function DashboardLink({ href, children, variant, size }: {
  href: string;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return <Link href={href} data-slot="button" className={buttonVariants({ variant, size })}>{children}</Link>;
}
