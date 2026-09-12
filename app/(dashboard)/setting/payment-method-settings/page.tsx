// Payment method settings - port of PaymentGatewayController@index
// (`setting::payment-method`).

import type { Metadata } from 'next';
import { authorize, can } from '@/lib/auth/permissions';
import { allPaymentGateways } from '@/lib/setting/repository';
import { PageHeader, Card } from '@/components/erp/page';
import { Tabs, type TabItem } from '@/components/erp/tabs';
import { FormCheckbox, FormActions } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import { updateActivePaymentMethods } from '../actions';
import { PaymentGatewayForm } from '../forms';

export const metadata: Metadata = { title: 'Payment Method Settings' };

export default async function PaymentMethodSettingsPage() {
  await authorize('payment-method-settings');

  const gateways = await allPaymentGateways();
  const canEdit = await can('update-payment-method-settings');

  const tabs: TabItem[] = gateways.map((gateway) => ({
    id: String(gateway.id),
    label: gateway.gatewayName ?? String(gateway.id),
    content: canEdit ? (
      <Card title={gateway.gatewayName ?? ''}>
        <PaymentGatewayForm
          gateway={{
            id: gateway.id,
            gatewayName: gateway.gatewayName ?? '',
            gatewayUsername: gateway.gatewayUsername ?? '',
            gatewayApiKey: gateway.gatewayApiKey ?? '',
            gatewaySecretKey: gateway.gatewaySecretKey ?? '',
            redirectUrl: gateway.redirectUrl ?? '',
          }}
        />
      </Card>
    ) : (
      <Card title={gateway.gatewayName ?? ''}>
        <p className="text-sm text-muted-foreground">
          You do not have permission to edit these credentials.
        </p>
      </Card>
    ),
  }));

  return (
    <>
      <PageHeader
        title="Payment Method Settings"
        breadcrumb={[{ label: 'Settings'}, { label:'Payment Method Settings' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card title="Select a payment gateway">
          <form action={updateActivePaymentMethods} className="space-y-4">
            {gateways.map((gateway) => (
              <FormCheckbox
                key={gateway.id}
                id={`gateway_${gateway.id}`}
                name="gateways"
                value={gateway.id}
                defaultChecked={gateway.activeStatus === 1}
                label={gateway.gatewayName ?? String(gateway.id)}
              />
            ))}
            <FormActions>
              <SubmitButton size="sm">Update</SubmitButton>
            </FormActions>
          </form>
        </Card>

        <div>
          {tabs.length ? (
            <Tabs tabs={tabs} orientation="horizontal" />
          ) : (
            <Card title="Gateways">
              <p className="text-sm text-muted-foreground">
                No payment gateways configured.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
