// Product import - port of add_product.csv_upload.

import type { Metadata } from 'next';
import { authorize } from '@/lib/auth/permissions';
import { ROUTES } from '@/lib/routes';
import { PageHeader } from '@/components/erp/page';
import { CsvUploadForm } from '../../import/upload-form';
import { uploadProductCsv } from '../../import/actions';

export const metadata: Metadata = { title: 'Product CSV Upload' };

export default async function Page() {
  await authorize('add_product.csv_upload');

  return (
    <>
      <PageHeader
        title="Product CSV Upload"
        breadcrumb={[{ label: 'Product' }, { label: 'Upload via CSV' }]}
      />
      <CsvUploadForm
        action={uploadProductCsv}
        sampleHref="/uploads/products.xlsx"
        backHref={ROUTES['add_product.create']}
        columns={["product_name", "product_type", "model_id", "unit_type_id", "brand_id", "origin", "description", "price_of_other_currency", "sku", "alert_quantity", "purchase_price", "selling_price", "min_selling_price", "tax", "cost_of_goods", "stock"]}
      />
    </>
  );
}
