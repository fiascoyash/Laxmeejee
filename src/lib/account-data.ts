export const ACCOUNT_TABLES = [
  'invoice_payments', 'invoices', 'quotations', 'supplier_transactions',
  'suppliers', 'customers', 'products', 'quotation_templates', 'company_settings', 'user_settings',
] as const;

export function confirmAccountDeletion(confirmation: string, email: string | undefined) {
  if (!email || confirmation.trim() !== email) throw new Error('Type your signed-in email exactly to confirm deletion.');
}

/** Paginate rather than silently truncating business histories at 1,000 rows. */
export async function readAllRows<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await read(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}