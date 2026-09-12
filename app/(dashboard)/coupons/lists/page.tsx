// Coupons - port of Modules/Product/Http/Controllers/CouponController
// (`product::coupons.index`).
//
// The PHP routed `coupon.edit`, `coupon.update` and `coupon.destroy` at
// controller methods that do not exist, so only listing and creating a coupon
// ever worked; that is what this screen offers.

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { listCoupons } from '@/lib/product/coupons';
import { dateConvert } from '@/lib/settings';
import { PageHeader, Card } from '@/components/erp/page';
import { DataTable, StatusBadge, Td, Tr } from '@/components/erp/table';
import { ReportSummary } from '@/components/erp/report-summary';
import { CircleCheck, CircleSlash, TicketPercent } from 'lucide-react';
import { CouponForm } from './coupon-form';

export const metadata: Metadata = { title: 'Coupon' };

export default async function CouponsPage() {
  await authorize('coupon.index');

  const rows = await listCoupons();
  const canCreate = await can('coupon.store');

  const decorated = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      startLabel: await dateConvert(row.startDate),
      endLabel: await dateConvert(row.endDate),
    })),
  );

  const activeCount = decorated.filter((row) => row.status === 1).length;

  return (
    <>
      <PageHeader title="Coupon" breadcrumb={[{ label: 'Products' }, { label: 'Coupon' }]} />

      <ReportSummary
        figures={[
          { label: 'Coupons', value: decorated.length, detail: 'Defined in total', icon: TicketPercent },
          { label: 'Active', value: activeCount, detail: 'Redeemable now', icon: CircleCheck },
          {
            label: 'Inactive',
            value: decorated.length - activeCount,
            detail: 'Switched off or expired',
            icon: CircleSlash,
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title="All coupons" bodyClassName="">
          <DataTable
            columns={[
              { label: 'Code' },
              { label: 'Discount Type' },
              { label: 'Cause' },
              { label: 'Date From' },
              { label: 'Date Till' },
              { label: 'Status' },
            ]}
            isEmpty={decorated.length === 0}
            empty="No coupons found."
          >
            {decorated.map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium text-foreground">{row.code}</Td>
                <Td>{row.discountType === '1' ? 'Active' : 'Expired'}</Td>
                <Td>{row.cause ?? '-'}</Td>
                <Td>{row.startLabel || '-'}</Td>
                <Td>{row.endLabel || '-'}</Td>
                <Td>
                  <StatusBadge status={row.status === 1} />
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Card>

        {canCreate ? <CouponForm /> : null}
      </div>
    </>
  );
}
