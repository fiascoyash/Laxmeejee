import { NumberingSettings } from '../types';
import { Save, Hash, FileText, Receipt } from 'lucide-react';
import { useState } from 'react';

interface Props {
  settings: NumberingSettings;
  onSave: (settings: NumberingSettings) => void;
}

export function NumberingSettingsPanel({ settings, onSave }: Props) {
  const [local, setLocal] = useState<NumberingSettings>(settings);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<NumberingSettings>) => {
    setLocal({ ...local, ...patch });
    setSaved(false);
  };

  const handleSave = () => {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const previewQuotation = () => {
    const parts = [local.quotationPrefix];
    if (local.quotationIncludeYear) parts.push(String(new Date().getFullYear()));
    parts.push(local.quotationNextNumber.toString().padStart(3, '0'));
    return parts.join('-');
  };

  const previewInvoice = () => {
    const parts = [local.invoicePrefix];
    if (local.invoiceIncludeYear) parts.push(String(new Date().getFullYear()));
    parts.push(local.invoiceNextNumber.toString().padStart(3, '0'));
    return parts.join('-');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Document Numbering</h3>
        </div>
        <p className="text-sm text-slate-500 mt-1">Customize how quotation and invoice numbers are generated.</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Quotation Numbering */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-slate-800">Quotation Number</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prefix</label>
              <input
                type="text"
                value={local.quotationPrefix}
                onChange={(e) => update({ quotationPrefix: e.target.value })}
                placeholder="QT"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Starting Number</label>
              <input
                type="number"
                min={1}
                value={local.quotationStartNumber}
                onChange={(e) => update({ quotationStartNumber: parseInt(e.target.value) || 1, quotationNextNumber: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.quotationIncludeYear}
                  onChange={(e) => update({ quotationIncludeYear: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Include year</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.quotationAutoIncrement}
                  onChange={(e) => update({ quotationAutoIncrement: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Auto increment</span>
              </label>
            </div>
          </div>
          <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-md">
            <span className="text-xs text-slate-500">Preview: </span>
            <span className="font-mono text-sm font-medium text-blue-700">{previewQuotation()}</span>
          </div>
        </div>

        {/* Invoice Numbering */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-amber-600" />
            <h4 className="font-medium text-slate-800">Invoice Number</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prefix</label>
              <input
                type="text"
                value={local.invoicePrefix}
                onChange={(e) => update({ invoicePrefix: e.target.value })}
                placeholder="INV"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Starting Number</label>
              <input
                type="number"
                min={1}
                value={local.invoiceStartNumber}
                onChange={(e) => update({ invoiceStartNumber: parseInt(e.target.value) || 1, invoiceNextNumber: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.invoiceIncludeYear}
                  onChange={(e) => update({ invoiceIncludeYear: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Include year</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={local.invoiceAutoIncrement}
                  onChange={(e) => update({ invoiceAutoIncrement: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Auto increment</span>
              </label>
            </div>
          </div>
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-md">
            <span className="text-xs text-slate-500">Preview: </span>
            <span className="font-mono text-sm font-medium text-amber-700">{previewInvoice()}</span>
          </div>
        </div>

        {/* Manual override note */}
        <div className="pt-6 border-t border-gray-100">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-slate-800 mb-1">Manual Override</h5>
            <p className="text-xs text-slate-600">
              You can always type a custom number directly into the quotation or invoice number field
              when creating or editing a document. The auto-generated number is just a suggestion you can replace.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between">
        {saved && <span className="text-sm text-green-600 font-medium">Settings saved!</span>}
        <button
          onClick={handleSave}
          className="ml-auto px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Save className="w-4 h-4" />
          Save Numbering Settings
        </button>
      </div>
    </div>
  );
}
