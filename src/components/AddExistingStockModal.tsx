import { useState, useEffect } from 'react';
import { X, Save, Package, AlertTriangle } from 'lucide-react';
import { ProductCatalogItem, SupplierData } from '../types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Smart defaults storage keys
const LAST_SUPPLIER_KEY = 'lastStockSupplier';
const LAST_PURCHASE_DATE_KEY = 'lastPurchaseDate';

// Helper functions for smart defaults
const getLastSupplier = (): string => {
  try {
    return localStorage.getItem(LAST_SUPPLIER_KEY) || '';
  } catch {
    return '';
  }
};

const saveLastSupplier = (supplier: string) => {
  try {
    localStorage.setItem(LAST_SUPPLIER_KEY, supplier);
  } catch {
    // Ignore storage errors
  }
};

const getLastPurchaseDate = (): string => {
  try {
    const saved = localStorage.getItem(LAST_PURCHASE_DATE_KEY);
    if (saved) return saved;
    return new Date().toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const saveLastPurchaseDate = (date: string) => {
  try {
    localStorage.setItem(LAST_PURCHASE_DATE_KEY, date);
  } catch {
    // Ignore storage errors
  }
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProduct: ProductCatalogItem) => void;
  product: ProductCatalogItem;
  suppliers: SupplierData[];
}

export function AddExistingStockModal({ isOpen, onClose, onSave, product, suppliers }: Props) {
  const [addQuantity, setAddQuantity] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number>(product.purchasePrice || 0);
  const [supplier, setSupplier] = useState<string>(getLastSupplier() || product.brand || '');
  const [purchaseDate, setPurchaseDate] = useState<string>(getLastPurchaseDate());
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const quantityInputRef = useState<HTMLInputElement | null>(null)[0];
  const [, setQuantityInputRef] = useState<HTMLInputElement | null>(null);

  // Auto-focus quantity field when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use smart defaults when opening
      setSupplier(getLastSupplier() || product.brand || '');
      setPurchaseDate(getLastPurchaseDate());
      setPurchasePrice(product.purchasePrice || 0);
      setAddQuantity(0);
      setNotes('');
      // Focus quantity input after a short delay
      setTimeout(() => {
        const input = document.querySelector('input[name="addQuantity"]') as HTMLInputElement;
        input?.focus();
        input?.select();
      }, 100);
    }
  }, [isOpen, product.purchasePrice, product.brand]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (addQuantity <= 0) {
      alert('Please enter a quantity greater than 0');
      return;
    }

    setSaving(true);
    try {
      const newStockQuantity = product.stockQuantity + addQuantity;
      const now = new Date().toISOString();

      // Update product
      const updatedProduct: ProductCatalogItem = {
        ...product,
        stockQuantity: newStockQuantity,
        purchasePrice: purchasePrice || product.purchasePrice,
        brand: supplier || product.brand,
        updatedAt: now,
      };

      // Save smart defaults for next entry
      if (supplier) saveLastSupplier(supplier);
      saveLastPurchaseDate(purchaseDate);

      // Save to Supabase history tables
      if (supabase) {
        // Create purchase record
        const { error: purchaseError } = await supabase
          .from('product_purchases')
          .insert({
            product_id: product.id,
            supplier_name: supplier || null,
            quantity: addQuantity,
            purchase_price: purchasePrice,
            purchase_date: purchaseDate,
            notes: notes || null,
          });

        if (purchaseError) {
          console.error('Error saving purchase:', purchaseError);
        }

        // Create stock movement record
        const { error: movementError } = await supabase
          .from('product_stock_movements')
          .insert({
            product_id: product.id,
            movement_type: 'purchase',
            quantity_change: addQuantity,
            balance_after: newStockQuantity,
            reference_type: 'purchase',
            notes: notes || null,
          });

        if (movementError) {
          console.error('Error saving movement:', movementError);
        }
      }

      onSave(updatedProduct);
      onClose();
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Reset form when modal opens
  const handleClose = () => {
    setAddQuantity(0);
    setPurchasePrice(product.purchasePrice || 0);
    setSupplier(product.brand || '');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Add Existing Stock</h3>
            <p className="text-sm text-slate-500 mt-1">{product.name}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current Stock Info */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Current Stock</span>
            </div>
            <div className="text-3xl font-bold text-slate-800">
              {product.stockQuantity}
              <span className="text-base font-normal text-slate-500 ml-2">
                {product.unit}
              </span>
            </div>
            {product.minStockAlert && product.stockQuantity <= product.minStockAlert && (
              <div className="flex items-center gap-1.5 mt-2 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Low stock warning active</span>
              </div>
            )}
          </div>

          {/* Add Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantity Added *
            </label>
            <input
              name="addQuantity"
              type="number"
              min="1"
              value={addQuantity || ''}
              onChange={(e) => setAddQuantity(parseInt(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addQuantity > 0) {
                  e.preventDefault();
                  const priceInput = document.querySelector('input[name="purchasePrice"]') as HTMLElement;
                  priceInput?.focus();
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
              placeholder="Enter quantity to add"
              autoFocus
            />
          </div>

          {/* Purchase Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Purchase Price (Rs.)
            </label>
            <input
              name="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice || ''}
              onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const supplierInput = document.querySelector('input[name="supplier"]') as HTMLElement;
                  supplierInput?.focus();
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Purchase price"
            />
            <p className="text-xs text-slate-400 mt-1">
              Current: Rs. {product.purchasePrice?.toLocaleString() || 'N/A'}
            </p>
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Supplier
            </label>
            <input
              name="supplier"
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const dateInput = document.querySelector('input[type="date"]') as HTMLElement;
                  dateInput?.focus();
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Supplier name"
              list="stock-supplier-list"
            />
            <p className="text-xs text-slate-400 mt-1">
              Last used: {getLastSupplier() || 'N/A'} | Product: {product.brand || 'N/A'}
            </p>
            <datalist id="stock-supplier-list">
              {suppliers.map(s => (
                <option key={s.id} value={s.firmName} />
              ))}
            </datalist>
          </div>

          {/* Purchase Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={2}
              placeholder="Optional notes about this purchase..."
            />
          </div>

          {/* New Stock Preview */}
          {addQuantity > 0 && (
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <div className="text-sm text-emerald-700 mb-1">New Stock After Addition</div>
              <div className="text-2xl font-bold text-emerald-800">
                {product.stockQuantity + addQuantity}
                <span className="text-base font-normal text-emerald-600 ml-2">
                  {product.unit}
                </span>
              </div>
              {purchasePrice > 0 && (
                <div className="text-sm text-emerald-600 mt-1">
                  Purchase total: Rs. {(addQuantity * purchasePrice).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-slate-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={addQuantity <= 0 || saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Update Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
