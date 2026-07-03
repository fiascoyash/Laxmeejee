import { useState, useMemo } from 'react';
import {
  ImportPreviewRow,
  SupplierData,
} from '../../types';
import { ArrowLeft, ClipboardCheck, AlertTriangle, Check, Ban, Package, Plus, FileText } from 'lucide-react';

interface Props {
  rows: ImportPreviewRow[];
  selectedSupplier: SupplierData | null;
  invoiceNumber: string;
  importDate: string;
  duplicateWarning: boolean;
  forceImport: boolean;
  setForceImport: (v: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function ImportPreviewStep({
  rows,
  selectedSupplier,
  invoiceNumber,
  importDate,
  duplicateWarning,
  forceImport,
  setForceImport,
  onBack,
  onConfirm,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  const committedRows = useMemo(
    () => rows.filter((r) => r.decision !== 'skip' && r.resolvedProduct && r.quantity > 0),
    [rows]
  );
  const skippedRows = rows.length - committedRows.length;
  const totalValue = useMemo(
    () => committedRows.reduce((sum, r) => sum + r.quantity * r.purchasePrice, 0),
    [committedRows]
  );
  const totalQuantity = useMemo(
    () => committedRows.reduce((sum, r) => sum + r.quantity, 0),
    [committedRows]
  );

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">To Import</p>
          <p className="text-xl font-bold text-slate-800">{committedRows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Skipped</p>
          <p className="text-xl font-bold text-slate-400">{skippedRows}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Qty</p>
          <p className="text-xl font-bold text-slate-800">{totalQuantity}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Value</p>
          <p className="text-xl font-bold text-emerald-700">Rs. {totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Import context */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-slate-500">Supplier: </span>
            <span className="font-medium text-slate-800">{selectedSupplier?.firmName || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Invoice: </span>
            <span className="font-medium text-slate-800">{invoiceNumber || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500">Date: </span>
            <span className="font-medium text-slate-800">{importDate}</span>
          </div>
        </div>
      </div>

      {/* Duplicate warning (Step 13) */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800">Possible Duplicate Import</h4>
              <p className="text-sm text-amber-700 mt-1">
                This purchase invoice appears to have already been imported. Importing again will add the stock a second time.
              </p>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceImport}
                  onChange={(e) => setForceImport(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-800">
                  I understand — force import anyway
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Preview table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            Import Preview
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Review every row below. Inventory is only updated when you click <strong>Confirm Import</strong>.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Imported Product</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Matched Product</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Qty</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Price</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">GST</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Supplier</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Invoice</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className={row.decision === 'skip' ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 text-slate-800">{row.importedProductName || '—'}</td>
                  <td className="px-3 py-2">
                    {row.decision === 'match_existing' && row.resolvedProduct ? (
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Package className="w-3.5 h-3.5 text-emerald-600" />
                        {row.resolvedProduct.name}
                      </span>
                    ) : row.decision === 'create_new' ? (
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="italic">New product</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Ban className="w-3.5 h-3.5" />
                        Skipped
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-700">Rs. {row.purchasePrice}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.gstPercent}%</td>
                  <td className="px-3 py-2 text-slate-600">{selectedSupplier?.firmName || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{invoiceNumber || row.supplierInvoiceNumber || '—'}</td>
                  <td className="px-3 py-2">
                    {row.decision === 'match_existing' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Matched</span>
                    ) : row.decision === 'create_new' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">New</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Skip</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* What will be updated */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <h4 className="font-semibold text-emerald-800 flex items-center gap-2 mb-2">
          <Check className="w-4 h-4" />
          On Confirm, the following will be updated:
        </h4>
        <ul className="text-sm text-emerald-700 space-y-1 ml-6 list-disc">
          <li>Product stock quantities (matched products increase; new products are created with their imported stock)</li>
          <li>Purchase history records (per-product, with supplier, invoice, batch, expiry)</li>
          <li>Stock movement audit trail (movement type: purchase, with balance after)</li>
          <li>Supplier ledger entry for the total purchase value</li>
          <li>Average & last purchase price, last purchase date, last supplier on each matched product</li>
          <li>Import audit log entry (this import event)</li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming || (duplicateWarning && !forceImport) || committedRows.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirming ? (
            <>
              <FileText className="w-4 h-4 animate-pulse" />
              Importing…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirm Import
            </>
          )}
        </button>
      </div>
    </div>
  );
}
