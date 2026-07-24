import { useState } from 'react';
import { X, PackagePlus, AlertCircle } from 'lucide-react';
import { Product, ProductCatalogItem, UNIT_OPTIONS } from '../types';
import { generateId } from '../utils/storage';

interface Props {
  product: Product;
  catalog: ProductCatalogItem[];
  onSave: (item: ProductCatalogItem) => void;
  onClose: () => void;
}

const GST_OPTIONS = [0, 5, 12, 18, 28];

export function SaveProductDialog({ product, catalog, onSave, onClose }: Props) {
  const [name, setName] = useState(product.name.trim());
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState(product.unit || 'piece');
  const [hsnSacCode, setHsnSacCode] = useState(product.hsnSacCode || '');
  const [gstPercent, setGstPercent] = useState(product.gstPercent || 0);
  const [sellingPrice, setSellingPrice] = useState(product.unitPrice || 0);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [description, setDescription] = useState(product.description || '');
  const [error, setError] = useState('');

  const isDuplicate = catalog.some(
    c => c.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }
    if (catalog.some(c => c.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      setError(`"${trimmedName}" already exists in the Product Catalog.`);
      return;
    }
    const now = new Date().toISOString();
    const newItem: ProductCatalogItem = {
      id: generateId(),
      name: trimmedName,
      category: category.trim() || 'General',
      unit,
      hsnSacCode: hsnSacCode.trim(),
      gstPercent,
      sellingPrice,
      purchasePrice,
      stockQuantity: 0,
      description: description.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    onSave(newItem);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Save to Product Catalog</h2>
              <p className="text-xs text-slate-400">This product will be available for future invoices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {isDuplicate && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>A product with this name already exists in the catalog.</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="Enter product or service name"
            />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="e.g. Electronics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unit</label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
              >
                {UNIT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* HSN Code + GST% */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">HSN / SAC Code</label>
              <input
                type="text"
                value={hsnSacCode}
                onChange={e => setHsnSacCode(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="HSN/SAC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GST %</label>
              <select
                value={gstPercent}
                onChange={e => setGstPercent(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
              >
                {GST_OPTIONS.map(g => (
                  <option key={g} value={g}>{g}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Selling Price + Purchase Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Selling Rate (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice || ''}
                onChange={e => setSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Purchase Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice || ''}
                onChange={e => setPurchasePrice(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
              rows={2}
              placeholder="Short product description..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isDuplicate}
            className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
          >
            <PackagePlus className="w-4 h-4" />
            Save Product
          </button>
        </div>
      </div>
    </div>
  );
}
