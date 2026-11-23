import type { Invoice, ProductStockMovement } from '../types';
import { storage } from './storage';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Bring the catalogue in line with an invoice: stock already taken for this invoice
 * (sum of its movements) is compared with what it should be now, and only the
 * difference is applied. First deduction logs 'sale'; later edits log 'adjustment';
 * deletion logs 'return'. Drafts (and deleted invoices) should hold no stock.
 */
function syncInvoiceStock(invoice: Invoice, deleted: boolean): ProductStockMovement[] {
  const mine = storage.getProductStockMovements()
    .filter(m => m.referenceId === invoice.id && m.referenceType === 'invoice');
  const applied = new Map<string, number>();
  for (const m of mine) applied.set(m.productId, (applied.get(m.productId) ?? 0) + m.quantityChange);

  const catalog = storage.getProductCatalog();
  const target = new Map<string, number>();
  if (!deleted && invoice.status !== 'Draft') {
    for (const p of invoice.products) {
      const qty = Number(p.quantity) || 0;
      if (!p.name || qty <= 0) continue;
      const item = catalog.find(c => sameName(c.name, p.name));
      if (item) target.set(item.id, (target.get(item.id) ?? 0) - qty);
    }
  }

  const ids = new Set([...applied.keys(), ...target.keys()]);
  const created: ProductStockMovement[] = [];
  for (const id of ids) {
    const delta = (target.get(id) ?? 0) - (applied.get(id) ?? 0);
    if (!delta) continue;
    const item = catalog.find(c => c.id === id);
    if (!item) continue;
    item.stockQuantity = (Number(item.stockQuantity) || 0) + delta;
    const first = !applied.has(id);
    const type = deleted ? 'return' : first ? 'sale' : 'adjustment';
    const note = deleted
      ? `Reversal: invoice ${invoice.invoiceNumber} deleted`
      : first
        ? `Invoice: ${invoice.invoiceNumber}, Customer: ${invoice.customer?.name ?? ''}`
        : `Invoice ${invoice.invoiceNumber} edited: ${delta < 0 ? 'more' : 'fewer'} sold (${delta > 0 ? '+' : ''}${delta})`;
    created.push(storage.createStockMovement(id, type, delta, item.stockQuantity, 'invoice', invoice.id, note));
  }
  if (created.length) storage.saveProductCatalog(catalog);
  return created;
}

export const applyInvoiceStockSale = (invoice: Invoice) => syncInvoiceStock(invoice, false);
export const reverseInvoiceStockSale = (invoice: Invoice) => syncInvoiceStock(invoice, true);
