// The card the guest forms share, as auth/register.blade.php and
// auth/passwords/*.blade.php did inside the guest layout.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthCard({
  title,
  description,
  backHref,
  backLabel = 'Back to login',
  children,
}: {
  title: string;
  description?: string;
  /** Omitted on the login screen itself, which has nowhere to go back to. */
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {backHref ? (
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}

      <Card className="admin-auth-card">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
