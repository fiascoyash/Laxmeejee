/** Keep legacy keys as the active shop's synchronous working copy. */
export const billingCollections = [
  { key: 'solar_company_profile', collection: 'company_profile', list: false },
  { key: 'solar_invoices', collection: 'invoices', list: true },
  { key: 'solar_quotations', collection: 'quotations', list: true },
  { key: 'solar_customers', collection: 'customers', list: true },
  { key: 'laxmeejee_suppliers', collection: 'suppliers', list: true },
  { key: 'solar_product_catalog', collection: 'products', list: true },
  { key: 'solar_quotation_templates', collection: 'templates', list: true },
  { key: 'solar_numbering_settings', collection: 'numbering', list: false },
  { key: 'laxmeejee_supplier_transactions', collection: 'supplier_transactions', list: true },
  { key: 'laxmeejee_invoice_payments', collection: 'invoice_payments', list: true },
  { key: 'laxmeejee_document_labels_notes', collection: 'document_settings', list: false },
  { key: 'laxmeejee_last_used_quotation_columns', collection: 'quotation_columns', list: false },
  { key: 'laxmeejee_last_used_invoice_columns', collection: 'invoice_columns', list: false },
] as const;

// These remain local; stock history retains its existing RPC and notes their local-only workflow.
export const localBillingKeys = [
  'laxmeejee_product_purchases', 'laxmeejee_product_stock_movements',
  'laxmeejee_product_usage', 'hisaaboo_credit_debit_notes',
];
export const billingKeys = [...billingCollections.map(c => c.key), ...localBillingKeys];
let onWrite: ((key: string, value: string | null) => void) | undefined;
let onRead: ((key: string) => string | null) | undefined;
export function observeBillingWrites(listener?: (key: string, value: string | null) => void, reader?: (key: string) => string | null) {
  onWrite = listener;
  onRead = reader;
}
export const billingStorage = {
  getItem: (key: string) => onRead && billingKeys.includes(key) ? onRead(key) : localStorage.getItem(key),
  setItem(key: string, value: string) {
    // The persistent shop snapshot/queue must succeed before reporting a local save.
    onWrite?.(key, value);
    localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    onWrite?.(key, null);
    localStorage.removeItem(key);
  },
};