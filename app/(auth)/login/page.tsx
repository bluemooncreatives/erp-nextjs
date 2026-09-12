// Port of resources/views/auth/login.blade.php

import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { config } from '@/lib/config';
import { generalSetting } from '@/lib/settings';
import SignInForm from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Login' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const setting = await generalSetting();

  // `@if(env('APP_SYNC'))` - the demo build offered one-click role logins.
  const demoAccounts = config.app.sync ? await loadDemoAccounts() : [];

  return (
    <SignInForm
      next={sp.next}
      companyName={setting.companyName || setting.siteTitle || config.app.name}
      demoAccounts={demoAccounts}
    />
  );
}

/** One account per role, as the demo login buttons in the Blade view did. */
async function loadDemoAccounts() {
  const labels: Record<number, string> = {
    1: 'Super Admin',
    2: 'Admin',
    3: 'Staff',
    4: 'Supplier',
    5: 'Customer',
  };

  const accounts: Array<{ label: string; email: string }> = [];
  for (const [roleId, label] of Object.entries(labels)) {
    const [row] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.roleId, Number(roleId)))
      .limit(1);
    if (row?.email) accounts.push({ label, email: row.email });
  }
  return accounts;
}
