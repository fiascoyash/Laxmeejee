import { useState, useMemo } from 'react';
import {
  ImportPreviewRow,
  MatchDecision,
  MatchConfidenceLevel,
} from '../../types';
import { ArrowRight, ArrowLeft, Search, Check, Plus, Ban, AlertTriangle, Package } from 'lucide-react';

interface Props {
  rows: ImportPreviewRow[];
  onUpdateDecision: (rowId: string, decision: MatchDecision, selectedCandidateId: string | null) => void;
  onUpdateField: (rowId: string, field: keyof ImportPreviewRow, value: string | number | undefined) => void;
  onBack: () => void;
  onNext: () => void;
}

const confidenceBadge = (level: MatchConfidenceLevel, score: number) => {
  const styles: Record<MatchConfidenceLevel, string> = {
    high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-amber-100 text-amber-700 border-amber-200',
    none: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${styles[level]}`}>
      {score}%
    </span>
  );
};

export function ProductMatchingStep({ rows, onUpdateDecision, onUpdateField, onBack, onNext }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const matched = rows.filter((r) => r.decision === 'match_existing').length;
    const newProducts = rows.filter((r) => r.decision === 'create_new').length;
    const skipped = rows.filter((r) => r.decision === 'skip').length;
    const withWarnings = rows.filter((r) => r.warnings.length > 0).length;
    return { matched, newProducts, skipped, withWarnings, total: rows.length };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.importedProductName.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Rows</p>
          <p className="text-xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Matched</p>
          <p className="text-xl font-bold text-emerald-600">{stats.matched}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">New Products</p>
          <p className="text-xl font-bold text-blue-600">{stats.newProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Warnings</p>
          <p className="text-xl font-bold text-amber-600">{stats.withWarnings}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search imported products…"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {filteredRows.map((row) => {
          const isExpanded = expandedRow === row.id;
          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Row header */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-800 truncate">{row.importedProductName || '(no name)'}</p>
                    {row.candidates[0] && confidenceBadge(row.candidates[0].level, row.candidates[0].score)}
                    {row.warnings.length > 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Qty: {row.quantity} · Price: Rs. {row.purchasePrice} · GST: {row.gstPercent}%
                    {row.batch ? ` · Batch: ${row.batch}` : ''}
                    {row.expiry ? ` · Exp: ${row.expiry}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Decision pills */}
                  <DecisionPill
                    active={row.decision === 'match_existing'}
                    onClick={() => {
                      const top = row.candidates[0];
                      onUpdateDecision(row.id, 'match_existing', top && top.level !== 'none' ? top.product.id : null);
                    }}
                    icon={<Check className="w-3.5 h-3.5" />}
                    label="Match Existing"
                    color="emerald"
                  />
                  <DecisionPill
                    active={row.decision === 'create_new'}
                    onClick={() => onUpdateDecision(row.id, 'create_new', null)}
                    icon={<Plus className="w-3.5 h-3.5" />}
                    label="Create New"
                    color="blue"
                  />
                  <DecisionPill
                    active={row.decision === 'skip'}
                    onClick={() => onUpdateDecision(row.id, 'skip', null)}
                    icon={<Ban className="w-3.5 h-3.5" />}
                    label="Skip"
                    color="slate"
                  />
                  <button
                    onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                    className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    {isExpanded ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-3">
                  {/* Match candidates */}
                  {row.candidates.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Possible Matches in Catalog
                      </p>
                      <div className="space-y-1.5">
                        {row.candidates.map((c) => (
                          <button
                            key={c.product.id}
                            onClick={() => onUpdateDecision(row.id, 'match_existing', c.product.id)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors text-left ${
                              row.selectedCandidateId === c.product.id && row.decision === 'match_existing'
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{c.product.name}</p>
                                <p className="text-xs text-slate-500">
                                  Stock: {c.product.stockQuantity} · Purchase: Rs. {c.product.purchasePrice} · GST: {c.product.gstPercent}%
                                </p>
                              </div>
                            </div>
                            {confidenceBadge(c.level, c.score)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editable imported values */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Imported Values (editable)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <EditableField label="Product Name" value={row.importedProductName} onChange={(v) => onUpdateField(row.id, 'importedProductName', v)} />
                      <EditableField label="Quantity" type="number" value={row.quantity} onChange={(v) => onUpdateField(row.id, 'quantity', Number(v) || 0)} />
                      <EditableField label="Purchase Price" type="number" value={row.purchasePrice} onChange={(v) => onUpdateField(row.id, 'purchasePrice', Number(v) || 0)} />
                      <EditableField label="GST %" type="number" value={row.gstPercent} onChange={(v) => onUpdateField(row.id, 'gstPercent', Number(v) || 0)} />
                      <EditableField label="HSN/SAC" value={row.hsnSac || ''} onChange={(v) => onUpdateField(row.id, 'hsnSac', v)} />
                      <EditableField label="Batch" value={row.batch || ''} onChange={(v) => onUpdateField(row.id, 'batch', v)} />
                      <EditableField label="Expiry" type="date" value={row.expiry || ''} onChange={(v) => onUpdateField(row.id, 'expiry', v)} />
                      <EditableField label="MRP" type="number" value={row.mrp || ''} onChange={(v) => onUpdateField(row.id, 'mrp', Number(v) || 0)} />
                    </div>
                  </div>

                  {/* Warnings */}
                  {row.warnings.length > 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                        {row.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
          onClick={onNext}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          Continue to Preview
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DecisionPill({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: 'emerald' | 'blue' | 'slate';
}) {
  const activeColors = {
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    blue: 'bg-blue-600 text-white border-blue-600',
    slate: 'bg-slate-600 text-white border-slate-600',
  };
  const inactiveColors = {
    emerald: 'border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700',
    blue: 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700',
    slate: 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-700',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
        active ? activeColors[color] : inactiveColors[color]
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>
  );
}
