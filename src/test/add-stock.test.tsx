import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddExistingStockModal } from '@/legacy/components/AddExistingStockModal';
import { storage } from '@/legacy/utils/storage';
import type { ProductCatalogItem } from '@/legacy/types';
import { commitStockPurchase, prepareStockPurchase, todayLocal, validateStock } from '@/legacy/utils/addStock';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const product: ProductCatalogItem = { id: 'stock-test', name: 'Cable', category: 'Cable', gstPercent: 18, hsnSacCode: '8544', unit: 'meter', stockQuantity: 10, purchasePrice: 20, sellingPrice: 30, brand: 'Original Brand', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
const input = { id: 'a52463fb-267f-4550-9ee6-73749d7441e2', quantity: 2.5, price: 12, supplier: 'Supplier A', date: '2026-10-25', notes: 'Purchase', details: { billNumber: 'B-42', batchNumber: 'LOT-1', serialNumbers: 'A, B', manufacturingDate: '2026-01-01', expiryDate: '2027-01-01', warrantyPeriod: '12 months', warrantyExpiryDate: '2027-10-25', storageLocation: 'Shelf 2' } };

beforeEach(() => { localStorage.clear(); storage.saveProductCatalog([product]); rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Add Stock rules', () => {
  it('calculates quantity times per-unit cost for fractional metres without changing the unit or brand', () => {
    const operation = prepareStockPurchase(product, input);
    expect(operation.updated.stockQuantity).toBe(12.5);
    expect(operation.updated.unit).toBe('meter');
    expect(operation.updated.brand).toBe('Original Brand');
    expect(operation.purchase.totalValue).toBe(30);
    expect(operation.updated.purchasePrice).toBe(12); // existing latest-cost stock valuation
    expect(operation.updated.stockQuantity * operation.updated.purchasePrice).toBe(150);
  });
  it('stores optional purchase details and links stock movements to the selected product', () => {
    commitStockPurchase(prepareStockPurchase(product, input));
    expect(storage.getProductPurchasesByProductId(product.id)[0]).toMatchObject({ supplierName: 'Supplier A', purchaseDate: '2026-10-25', quantity: 2.5, purchasePrice: 12, totalValue: 30, details: input.details });
    expect(storage.getProductStockMovementsByProductId(product.id)[0]).toMatchObject({ quantityChange: 2.5, balanceAfter: 12.5, referenceId: input.id });
  });
  it('allows optional details to be omitted and a zero price to be recorded', () => {
    const operation = prepareStockPurchase(product, { ...input, price: 0, supplier: '', notes: '', details: {} });
    expect(operation.purchase.totalValue).toBe(0);
    expect(operation.purchase.supplierName).toBeUndefined();
    expect(operation.updated.purchasePrice).toBe(0);
  });
  it.each([[0, 2], [-1, 2], [NaN, 2], [Infinity, 2], [2, -1], [2, NaN], [2, Infinity]])('rejects invalid quantity %s and price %s', (qty, price) => {
    expect(() => validateStock(qty, price)).toThrow();
  });
  it('defaults purchase date to today, not a previous saved date', () => {
    localStorage.setItem('lastPurchaseDate', '2001-01-01');
    render(<AddExistingStockModal isOpen onClose={vi.fn()} onSave={vi.fn()} product={product} suppliers={[]} />);
    expect(screen.getByLabelText('Purchase Date')).toHaveValue(todayLocal());
  });
  it('does not increase stock twice when the same operation is retried', () => {
    commitStockPurchase(prepareStockPurchase(product, input));
    commitStockPurchase(prepareStockPurchase(product, input));
    expect(storage.getProductCatalog()[0]?.stockQuantity).toBe(12.5);
    expect(storage.getProductPurchases()).toHaveLength(1);
    expect(storage.getProductStockMovements()).toHaveLength(1);
  });
  it('restores the local catalog and histories if a storage write fails', () => {
    const original = Storage.prototype.setItem;
    let failed = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'laxmeejee_product_stock_movements' && !failed) { failed = true; throw new Error('Storage full'); }
      return original.call(this, key, value);
    });
    expect(() => commitStockPurchase(prepareStockPurchase(product, input))).toThrow('Storage full');
    expect(storage.getProductCatalog()[0]?.stockQuantity).toBe(10);
    expect(storage.getProductPurchases()).toHaveLength(0);
    expect(storage.getProductStockMovements()).toHaveLength(0);
  });
  it('keeps stock unchanged and the form open when cloud saving fails; retry records only once', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'Save failed' } });
    const onSave = vi.fn(); const onClose = vi.fn();
    render(<AddExistingStockModal isOpen onSave={onSave} onClose={onClose} product={product} suppliers={[]} />);
    fireEvent.change(screen.getByLabelText('Quantity to Add (meter) *'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('Purchase Price per meter (Rs.) *'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Stock' }));
    await screen.findByRole('alert');
    expect(storage.getProductCatalog()[0]?.stockQuantity).toBe(10);
    expect(onSave).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Save Stock' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(rpc.mock.calls[0]?.[1].payload.id).toBe(rpc.mock.calls[1]?.[1].payload.id);
    expect(storage.getProductCatalog()[0]?.stockQuantity).toBe(12.5);
  });
  it('guards rapid duplicate submissions while saving', async () => {
    let finish: ((value: { error: null }) => void) | undefined;
    rpc.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onSave = vi.fn();
    render(<AddExistingStockModal isOpen onSave={onSave} onClose={vi.fn()} product={product} suppliers={[]} />);
    fireEvent.change(screen.getByLabelText('Quantity to Add (meter) *'), { target: { value: '3' } });
    const form = screen.getByRole('dialog');
    fireEvent.submit(form); fireEvent.submit(form);
    expect(rpc).toHaveBeenCalledTimes(1);
    finish?.({ error: null });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(storage.getProductCatalog()[0]?.stockQuantity).toBe(13);
  });
});