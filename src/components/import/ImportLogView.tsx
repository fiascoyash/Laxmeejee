import { useState, useMemo } from 'react';
import { ImportLogEntry } from '../../types';
import { storage } from '../../utils/storage';
import { X, History, Search, Trash2, FileText, FileSpreadsheet, File as FileIcon, Check, AlertTriangle, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function ImportLogView({ onClose }: Props) {
  const [logs, setLogs] = useState<ImportLogEntry[]>(() => storage.getImportLogs());
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.fileName.toLowerCase().includes(q) ||
        (l.supplierName || '').toLowerCase().includes(q) ||
        (l.invoiceNumber || '').toLowerCase().includes(q) ||
        (l.importedBy || '').toLowerCase().includes(q)
    );
  }, [logs, search]);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this import log entry? This removes the audit record but does not reverse the stock update.')) return;
    storage.deleteImportLog(id);
    setLogs(storage.getImportLogs());
  };

  const formatIcon = (format: string) => {
    if (format === 'pdf') return <FileIcon className="w-3.5 h-3.5" />;
    if (format === 'xlsx') return <FileSpreadsheet className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  const statusBadge = (status: string) => {
    if (status === 'success')
      return (
        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
          <Check className="w-3 h-3" /> Success
        </span>
      );
    if (status === 'partial')
      return (
        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
          <AlertTriangle className="w-3 h-3" /> Partial
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
        <AlertCircle className="w-3 h-3" /> Failed
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Import History
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file, supplier, invoice, or importer…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No import history yet.</p>
            </div>
          ) : (
            filtered.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div
                    className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                      {formatIcon(log.format)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 truncate">{log.fileName}</p>
                        {statusBadge(log.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(log.importDate).toLocaleString()} · {log.importedBy} · {log.productsImported} product(s) · Rs. {log.totalValue.toLocaleString()}
                        {log.supplierName ? ` · ${log.supplierName}` : ''}
                        {log.invoiceNumber ? ` · ${log.invoiceNumber}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(log.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                      title="Delete log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-200 p-3 bg-slate-50">
                      {log.errors.length > 0 && (
                        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                          <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                            {log.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Imported Rows ({log.rows.length})
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-white border-b border-slate-200">
                            <tr>
                              <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Imported Name</th>
                              <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Matched Product</th>
                              <th className="text-right px-2 py-1.5 font-semibold text-slate-600">Qty</th>
                              <th className="text-right px-2 py-1.5 font-semibold text-slate-600">Price</th>
                              <th className="text-right px-2 py-1.5 font-semibold text-slate-600">GST</th>
                              <th className="text-left px-2 py-1.5 font-semibold text-slate-600">Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {log.rows.map((r, i) => (
                              <tr key={i}>
                                <td className="px-2 py-1.5 text-slate-700">{r.productName}</td>
                                <td className="px-2 py-1.5 text-slate-600">{r.matchedProductName || '—'}</td>
                                <td className="px-2 py-1.5 text-right text-slate-700">{r.quantity}</td>
                                <td className="px-2 py-1.5 text-right text-slate-700">Rs. {r.purchasePrice}</td>
                                <td className="px-2 py-1.5 text-right text-slate-700">{r.gstPercent}%</td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {r.decision === 'match_existing' ? 'Matched' : r.decision === 'create_new' ? 'New' : 'Skip'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
