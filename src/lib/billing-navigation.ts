export const BILLING_VIEWS = ['home', 'selectTemplate', 'new', 'list', 'catalog', 'settings', 'templates', 'newInvoice', 'invoiceList', 'editInvoice', 'customers', 'suppliers', 'smartImport', 'gstReports', 'gstr1', 'notes'] as const;

export type BillingView = (typeof BILLING_VIEWS)[number];

/** Only actual billing bookmarks should leave the shared public homepage. */
export function legacyBillingView(hash: string): BillingView | undefined {
  const value = hash.replace(/^#/, '');
  return BILLING_VIEWS.find(view => view === value);
}

export function getBillingView(hash: string): BillingView {
  return legacyBillingView(hash) ?? 'home';
}

export function isPublicLandingHash(hash: string): boolean {
  return hash === '#landing';
}