// ─── Import Confirm Component ──────────────────────────────────────────────────
// Final preview before import. Shows summary and executes the import.

import { useMemo, useState } from 'react';
import {
  Check,
  AlertTriangle,
  Package,
  Plus,
  SkipForward,
  Save,
  IndianRupee,
} from 'lucide-react';
import { MatchedProduct } from './types';
import { SupplierData } from '../../types';

export interface ImportConfirmProps {
  matchedProducts: MatchedProduct[];
  supplier: SupplierData | null;
  invoiceNumber: string;
  importDate: string;
  importedBy: string;
  onConfirm: () => void;
  onBack: () => void;
  saveTemplate: boolean;
  onSaveTemplateChange: (save: boolean) => void;
}

export function ImportConfirm({
  matchedProducts,
  supplier,
  invoiceNumber,
  importDate,
  importedBy,
  onConfirm,
  onBack,
  saveTemplate,
  onSaveTemplateChange,
}: ImportConfirmProps) {
  const [duplicateWarning] = useState(false);
  const [forceImport, setForceImport] = useState(false);

  // Calculate summary stats
  const stats = useMemo(() => {
    const toImport = matchedProducts.filter((p) => p.decision !== 'skip' && p.resolvedProduct);
    const matched = toImport.filter((p) => p.decision === 'match_existing');
    const newProducts = toImport.filter((p) => p.decision === 'create_new');
    const skipped = matchedProducts.filter((p) => p.decision === 'skip');

    let totalValue = 0;
    toImport.forEach((p) => {
      const qty = parseFloat(String(p.quantity)) || 0;
      const rate = parseFloat(String(p.purchaseRate)) || 0;
      const amt = parseFloat(String(p.amount)) || 0;
      totalValue += amt > 0 ? amt : qty * rate;
    });

    return { toImport, matched, newProducts, skipped, totalValue };
  }, [matchedProducts]);

  // Handle confirm
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />
          Import Summary
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {/* Matched count */}
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Check className="w-4 h-4" />
              <span className="text-xs font-medium">Matched</span>
            </div>
            <p className="text-2xl font-bold text-emerald-800">{stats.matched.length}</p>
          </div>

          {/* New count */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <Plus className="w-4 h-4" />
              <span className="text-xs font-medium">New</span>
            </div>
            <p className="text-2xl font-bold text-blue-800">{stats.newProducts.length}</p>
          </div>

          {/* Skipped count */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-600 mb-1">
              <SkipForward className="w-4 h-4" />
              <span className="text-xs font-medium">Skipped</span>
            </div>
            <p className="text-2xl font-bold text-slate-700">{stats.skipped.length}</p>
          </div>

          {/* Total value */}
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <IndianRupee className="w-4 h-4" />
              <span className="text-xs font-medium">Value</span>
            </div>
            <p className="text-xl font-bold text-amber-800">
              Rs. {stats.totalValue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Import details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Supplier:</span>
            <span className="text-slate-800 font-medium">
              {supplier?.firmName || 'Not specified'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice Number:</span>
            <span className="text-slate-800 font-medium">
              {invoiceNumber || 'Not specified'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Import Date:</span>
            <span className="text-slate-800 font-medium">{importDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Imported By:</span>
            <span className="text-slate-800 font-medium">{importedBy}</span>
          </div>
        </div>
      </div>

      {/* Save template checkbox */}
      {supplier && (
        <label className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
          <input
            type="checkbox"
            checked={saveTemplate}
            onChange={(e) => onSaveTemplateChange(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              Save this supplier layout
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Next time you upload a PDF from this supplier, the column mapping will auto-apply.
            </p>
          </div>
        </label>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Duplicate Invoice Warning
              </p>
              <p className="text-xs text-amber-700 mt-1">
                This invoice may have already been imported. Are you sure you want to proceed?
              </p>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={forceImport}
                  onChange={(e) => setForceImport(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-emerald-600"
                />
                <span className="text-xs text-amber-700">
                  Yes, import anyway
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Product list preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h4 className="text-sm font-medium text-slate-700">Products to Import ({stats.toImport.length})</h4>
        </div>
        <div className="max-h-60 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="p-2 font-medium">Product</th>
                <th className="p-2 font-medium w-14">Qty</th>
                <th className="p-2 font-medium w-16">Rate</th>
                <th className="p-2 font-medium w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {stats.toImport.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <p className="font-medium text-slate-800 truncate max-w-[200px]">
                      {p.productName}
                    </p>
                    {p.decision === 'match_existing' && p.matchedProductName && (
                      <p className="text-emerald-600">= {p.matchedProductName}</p>
                    )}
                  </td>
                  <td className="p-2 text-slate-600">{p.quantity}</td>
                  <td className="p-2 text-slate-600">{p.purchaseRate}</td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        p.decision === 'match_existing'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {p.decision === 'match_existing' ? 'Match' : 'New'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={stats.toImport.length === 0 || (duplicateWarning && !forceImport)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Confirm Import ({stats.toImport.length})
        </button>
      </div>
    </div>
  );
}
