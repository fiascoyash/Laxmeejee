import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from '../legacy/utils/storage';
import { applyInvoiceStockSale, reverseInvoiceStockSale } from '../legacy/utils/invoiceStock';

const inv = (status: string) => ({ id: 'inv1', invoiceNumber: 'INV-1', status, customer: { name: 'Ram' },
  products: [{ name: 'Solar Panel 335W', quantity: 3 }] }) as any;
const stock = () => storage.getProductCatalog()[0]!.stockQuantity;

describe('invoice stock sync', () => {
  beforeEach(() => {
    localStorage.clear();
    storage.saveProductCatalog([{ id: 'p1', name: 'Solar Panel 335W', stockQuantity: 50 } as any]);
  });
  it('deducts sold quantity and logs a Sale movement', () => {
    applyInvoiceStockSale(inv('Paid'));
    expect(stock()).toBe(47);
    expect(storage.getProductStockMovementsByProductId('p1')[0]).toMatchObject({ movementType: 'sale', quantityChange: -3, balanceAfter: 47 });
  });
  it('does not deduct drafts, and never twice for the same invoice', () => {
    applyInvoiceStockSale(inv('Draft'));
    expect(stock()).toBe(50);
    applyInvoiceStockSale(inv('Unpaid'));
    applyInvoiceStockSale(inv('Paid'));
    expect(stock()).toBe(47);
  });
  it('restores stock once when the invoice is deleted', () => {
    applyInvoiceStockSale(inv('Paid'));
    reverseInvoiceStockSale(inv('Paid'));
    reverseInvoiceStockSale(inv('Paid'));
    expect(stock()).toBe(50);
  });
});

describe('editing a finalized invoice', () => {
  beforeEach(() => {
    localStorage.clear();
    storage.saveProductCatalog([{ id: 'p1', name: 'Solar Panel 335W', stockQuantity: 50 } as any]);
  });
  const withQty = (q: number, status = 'Paid') => ({ ...inv(status), products: [{ name: 'Solar Panel 335W', quantity: q }] });
  it('raising quantity 3 → 5 takes 2 more and logs an adjustment', () => {
    applyInvoiceStockSale(withQty(3));
    const [m] = applyInvoiceStockSale(withQty(5));
    expect(stock()).toBe(45);
    expect(m).toMatchObject({ movementType: 'adjustment', quantityChange: -2, balanceAfter: 45 });
  });
  it('lowering quantity 3 → 1 returns 2', () => {
    applyInvoiceStockSale(withQty(3));
    applyInvoiceStockSale(withQty(1));
    expect(stock()).toBe(49);
  });
  it('removing the product from the invoice returns all of it', () => {
    applyInvoiceStockSale(withQty(3));
    applyInvoiceStockSale({ ...inv('Paid'), products: [] });
    expect(stock()).toBe(50);
  });
  it('deleting after an edit returns the edited amount', () => {
    applyInvoiceStockSale(withQty(3));
    applyInvoiceStockSale(withQty(5));
    reverseInvoiceStockSale(withQty(5));
    expect(stock()).toBe(50);
  });
});
