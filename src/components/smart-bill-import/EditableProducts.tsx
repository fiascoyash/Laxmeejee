import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { BillMappedProduct, UNIT_OPTIONS } from '../../types';

interface EditableProductsProps {
  products: BillMappedProduct[];
  onProductsChange: (products: BillMappedProduct[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const EditableProducts: React.FC<EditableProductsProps> = ({
  products,
  onProductsChange,
  onNext,
  onBack,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BillMappedProduct>>({});

  const startEdit = (product: BillMappedProduct) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editForm.productName || !editForm.quantity) {
      alert('Product name and quantity are required.');
      return;
    }

    onProductsChange(
      products.map((p) =>
        p.id === editingId ? { ...p, ...editForm } as BillMappedProduct : p
      )
    );
    setEditingId(null);
    setEditForm({});
  };

  const deleteProduct = (id: string) => {
    if (confirm('Delete this product?')) {
      onProductsChange(products.filter((p) => p.id !== id));
    }
  };

  const addProduct = () => {
    const newProduct: BillMappedProduct = {
      id: `product-${Date.now()}`,
      productName: '',
      quantity: 1,
      purchasePrice: 0,
      gstPercent: 18,
      hsnSac: '',
      unit: 'piece',
      amount: 0,
      decision: 'create_new',
    };
    onProductsChange([...products, newProduct]);
    // Start editing immediately
    setEditingId(newProduct.id);
    setEditForm({ ...newProduct });
  };

  const updateEditField = (key: keyof BillMappedProduct, value: string | number) => {
    setEditForm((prev) => ({
      ...prev,
      [key]: value,
      // Auto-calculate amount when quantity or price changes
      ...(key === 'quantity' && prev.purchasePrice
        ? { amount: Number(value) * Number(prev.purchasePrice) }
        : {}),
      ...(key === 'purchasePrice' && prev.quantity
        ? { amount: Number(prev.quantity) * Number(value) }
        : {}),
    }));
  };

  const totalValue = products.reduce((sum, p) => {
    const amount = p.amount || p.quantity * p.purchasePrice;
    return sum + amount;
  }, 0);

  const isValid = products.length > 0 && products.every((p) => p.productName && p.quantity && p.purchasePrice);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Review Products
          </h2>
          <p className="text-slate-600 text-sm">
            Edit or remove products before matching to your catalog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                Product Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                Qty
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                Unit
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                Rate
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                GST %
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                HSN
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                Amount
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                {editingId === product.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.productName || ''}
                        onChange={(e) => updateEditField('productName', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="Product name"
                        autoFocus
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={editForm.quantity || ''}
                        onChange={(e) => updateEditField('quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editForm.unit || 'piece'}
                        onChange={(e) => updateEditField('unit', e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        {UNIT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={editForm.purchasePrice || ''}
                        onChange={(e) => updateEditField('purchasePrice', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editForm.gstPercent || 18}
                        onChange={(e) => updateEditField('gstPercent', parseFloat(e.target.value))}
                        className="px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editForm.hsnSac || ''}
                        onChange={(e) => updateEditField('hsnSac', e.target.value)}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="HSN"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-medium text-slate-700">
                        Rs. {((editForm.quantity || 0) * (editForm.purchasePrice || 0)).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={saveEdit}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-800">
                        {product.productName}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {product.quantity}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {product.unit || 'piece'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      Rs. {product.purchasePrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {product.gstPercent}%
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {product.hsnSac || '--'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      Rs. {((product.amount || product.quantity * product.purchasePrice)).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEdit(product)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No products added. Click "Add Product" to start.
        </div>
      )}

      {/* Summary */}
      {products.length > 0 && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Total Products:</span>
            <span className="font-medium text-slate-800">{products.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Total Quantity:</span>
            <span className="font-medium text-slate-800">
              {products.reduce((sum, p) => sum + p.quantity, 0)}
            </span>
          </div>
          <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2 mt-2">
            <span className="font-semibold text-slate-800">Total Value:</span>
            <span className="font-bold text-emerald-600">
              Rs. {totalValue.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={addProduct}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>

        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Match Products
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
