// `sale.configurations` - Modules/Sale `sale::sale.configurations`.
//
// The Blade lists `business_settings` rows whose `category_type` is
// `sale&purchase_type` and posts each switch to `update_activation_status`,
// which is the same endpoint the Settings > Activation tab uses.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { saleApprovalSettings } from '@/lib/setting/repository';
import { PageHeader, Card } from '@/components/erp/page';
import { SettingsRow } from '@/components/common/settings-section';
import { ToggleSwitch } from '@/components/erp/toggle';
import { toggleBusinessSetting } from '../../setting/actions';

export const metadata: Metadata = { title: 'Sale And Purchase Auto Approval' };

/** `strtoupper(str_replace("_", " ", $approval->type))`, as a sentence. */
function approvalTitle(type: string | null): string {
  const words = (type ?? '').replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default async function SaleConfigurationsPage() {
  await authorize('sale.configurations');
  const rows = await saleApprovalSettings();

  return (
    <>
      <PageHeader
        title="Sale And Purchase Auto Approval"
        breadcrumb={[{ label: 'Sale' }, { label: 'Configurations' }]}
      />
      <Card
        title="Sale And Purchase Auto Approval"
        desc="Documents of these kinds are approved as soon as they are saved, with no separate approval step."
      >
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No approval settings.</p>
        ) : (
          <div className="space-y-6">
            {rows.map((row) => (
              <SettingsRow
                key={row.id}
                title={approvalTitle(row.type)}
                description={`Approve every new ${approvalTitle(row.type).toLowerCase()} automatically.`}
                control={
                  <form action={toggleBusinessSetting}>
                    <input type="hidden" name="id" value={row.id} />
                    <ToggleSwitch checked={row.status === 1} />
                  </form>
                }
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
