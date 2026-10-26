import { storage } from './storage';
import type { ProductCatalogItem, ProductPurchase, ProductStockMovement } from '../types';

export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validateStock(quantity: number, price: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Enter a quantity greater than zero.');
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid purchase price of zero or more.');
  if (!Number.isFinite(quantity * price)) throw new Error('The purchase cost is too large.');
}

export function prepareStockPurchase(product: ProductCatalogItem, input: {
  id: string; quantity: number; price: number; supplier: string; date: string;
  notes: string; details: Record<string, string>;
}) {
  validateStock(input.quantity, input.price);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date))) throw new Error('Enter a valid purchase date.');
  if (input.details['manufacturingDate'] && input.details['expiryDate'] && input.details['expiryDate'] < input.details['manufacturingDate']) throw new Error('Expiry date cannot be before manufacturing date.');
  const current = storage.getProductCatalog().find(p => p.id === product.id) || product;
  const previous = storage.getProductPurchases().find(p => p.id === input.id);
  const now = previous?.createdAt || new Date().toISOString();
  const updated = previous ? current : { ...current, stockQuantity: current.stockQuantity + input.quantity, purchasePrice: input.price, updatedAt: now };
  const purchase: ProductPurchase = {
    id: input.id, productId: product.id, quantity: input.quantity, purchasePrice: input.price,
    totalValue: input.quantity * input.price, ...(input.supplier.trim() ? { supplierName: input.supplier.trim() } : {}),
    purchaseDate: input.date, ...(input.notes.trim() ? { notes: input.notes.trim() } : {}), createdAt: now,
    details: { ...input.details, unit: current.unit },
  };
  const movement: ProductStockMovement = {
    id: input.id, productId: product.id, movementType: 'purchase', quantityChange: input.quantity,
    balanceAfter: updated.stockQuantity, referenceType: 'purchase', referenceId: input.id,
    ...(purchase.notes ? { notes: purchase.notes } : {}), createdAt: now,
  };
  return { updated, purchase, movement };
}

// Existing local keys remain authoritative for the catalog and offline history.
// Snapshot/restore keeps local writes together; operation IDs make retries safe.
export function commitStockPurchase(operation: ReturnType<typeof prepareStockPurchase>) {
  const keys = ['solar_product_catalog', 'laxmeejee_product_purchases', 'laxmeejee_product_stock_movements'];
  const snapshots = keys.map(key => localStorage.getItem(key));
  try {
    storage.saveProductPurchase(operation.purchase);
    storage.saveProductStockMovement(operation.movement);
    const catalog = storage.getProductCatalog();
    storage.saveProductCatalog(catalog.map(p => p.id === operation.updated.id ? operation.updated : p));
  } catch (error) {
    keys.forEach((key, index) => {
      const value = snapshots[index];
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
    throw error;
  }
}