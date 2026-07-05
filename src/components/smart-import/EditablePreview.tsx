// ─── Editable Preview Component ────────────────────────────────────────────────
// Displays extracted product rows in an editable grid.
// User can modify any cell before proceeding to matching.

import { useCallback, useMemo } from 'react';
import { Edit3, Plus, X, AlertTriangle } from 'lucide-react';
import { ExtractedProduct } from './types';

export interface EditablePreviewProps {
  products: ExtractedProduct[];
  onProductsChange: (products: ExtractedProduct[]) => void;
  onProceed: () => void;
  onBack: () => void;
}

export function EditablePreview({
  products,
  onProductsChange,
  onProceed,
  onBack,
}: EditablePreviewProps) {
  // Validate products
  const validation = useMemo(() => {
    const issues: { rowIdx: number; field: string; message: string }[] = [];

    products.forEach((p, idx) => {
      if (!p.productName.trim()) {
        issues.push({ rowIdx: idx, field: 'productName', message: 'Missing product name' });
      }
      if (!p.quantity.trim() || isNaN(parseFloat(p.quantity))) {
        issues.push({ rowIdx: idx, field: 'quantity', message: 'Invalid quantity' });
      }
      if (!p.purchaseRate.trim() || isNaN(parseFloat(p.purchaseRate))) {
        issues.push({ rowIdx: idx, field: 'purchaseRate', message: 'Invalid rate' });
      }
    });

    return { issues, isValid: issues.length === 0 };
  }, [products]);

  // Update a field in a product
  const updateProduct = useCallback(
    (id: string, field: keyof ExtractedProduct, value: string) => {
      onProductsChange(
        products.map((p) => (p.id === id ? { ...p, [field]: value } : p))
      );
    },
    [products, onProductsChange]
  );

  // Delete a product
  const deleteProduct = useCallback(
    (id: string) => {
      onProductsChange(products.filter((p) => p.id !== id));
    },
    [products, onProductsChange]
  );

  // Add a new empty product
  const addProduct = useCallback(() => {
    const newProduct: ExtractedProduct = {
      id: `manual-${Date.now()}`,
      productName: '',
      quantity: '',
      hsnSac: '',
      unit: '',
      purchaseRate: '',
      gstPercent: '',
      amount: '',
      yPosition: 0,
    };
    onProductsChange([...products, newProduct]);
  }, [products, onProductsChange]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;

    products.forEach((p) => {
      const qty = parseFloat(p.quantity) || 0;
      const rate = parseFloat(p.purchaseRate) || 0;
      const amt = parseFloat(p.amount) || 0;

      totalQty += qty;
      totalAmount += amt > 0 ? amt : qty * rate;
    });

    return { totalQty, totalAmount };
  }, [products]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-emerald-600" />
          Editable Product Preview
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {products.length} products extracted. Edit any cell before importing.
        </p>
      </div>

      {/* Validation warnings */}
      {validation.issues.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">
              <p className="font-medium">Some rows have issues:</p>
              <ul className="mt-1 list-disc list-inside">
                {validation.issues.slice(0, 3).map((issue, idx) => (
                  <li key={idx}>
                    Row {issue.rowIdx + 1}: {issue.message}
                  </li>
                ))}
                {validation.issues.length > 3 && (
                  <li>...and {validation.issues.length - 3} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Product table */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {products.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            No products extracted. Go back and adjust the table selection or column mappings.
          </div>
        ) : (
          <div className="p-2">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-left text-slate-500">
                  <th className="p-1.5 font-medium w-8">#</th>
                  <th className="p-1.5 font-medium">Product</th>
                  <th className="p-1.5 font-medium w-14">Qty</th>
                  <th className="p-1.5 font-medium w-14">Unit</th>
                  <th className="p-1.5 font-medium w-20">HSN</th>
                  <th className="p-1.5 font-medium w-16">Rate</th>
                  <th className="p-1.5 font-medium w-12">GST%</th>
                  <th className="p-1.5 font-medium w-16">Amount</th>
                  <th className="p-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((row, idx) => {
                  const hasIssue = validation.issues.some((i) => i.rowIdx === idx);

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${
                        hasIssue ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <td className="p-1 text-slate-400">{idx + 1}</td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.productName}
                          onChange={(e) => updateProduct(row.id, 'productName', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                          placeholder="Product name"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.quantity}
                          onChange={(e) => updateProduct(row.id, 'quantity', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => updateProduct(row.id, 'unit', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.hsnSac}
                          onChange={(e) => updateProduct(row.id, 'hsnSac', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.purchaseRate}
                          onChange={(e) => updateProduct(row.id, 'purchaseRate', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.gstPercent}
                          onChange={(e) => updateProduct(row.id, 'gstPercent', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={row.amount}
                          onChange={(e) => updateProduct(row.id, 'amount', e.target.value)}
                          className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          onClick={() => deleteProduct(row.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Delete row"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add row button */}
            <button
              onClick={addProduct}
              className="mt-2 w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add row
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {products.length} products · Total Qty: {totals.totalQty.toLocaleString()}
          </span>
          <span className="text-slate-700 font-medium">
            Value: Rs. {totals.totalAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={onProceed}
            disabled={products.length === 0}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Match Products ({products.length})
          </button>
        </div>
      </div>
    </div>
  );
}
