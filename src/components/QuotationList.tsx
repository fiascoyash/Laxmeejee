import { Quotation } from '../types';
import {
  FileText, Trash2, Copy, CreditCard as Edit, Eye, X, Calendar, User,
  Search, XCircle, LayoutList, LayoutGrid, Table2,
  ArrowUpDown, ArrowUp, ArrowDown, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckSquare2, Square,
  FileInput, Printer,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

type ViewMode = 'compact' | 'detailed' | 'table';
type SortField = 'quotationNumber' | 'customer' | 'date' | 'grandTotal';
type SortDir = 'asc' | 'desc';

interface ListPrefs { viewMode: ViewMode; pageSize: number; sortField: SortField; sortDir: SortDir; }

const PREFS_KEY = 'laxmeejee_quotation_list_prefs';
const DEFAULT_PREFS: ListPrefs = { viewMode: 'detailed', pageSize: 20, sortField: 'date', sortDir: 'desc' };
const PAGE_SIZES = [10, 20, 50, 100];

interface Props {
  quotations: Quotation[];
  onEdit: (quotation: Quotation) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onConvertToInvoice: (quotation: Quotation) => void;
  onBulkDelete?: (ids: string[]) => void;
}

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function QuotationList({ quotations, onEdit, onDelete, onDuplicate, onConvertToInvoice, onBulkDelete }: Props) {
  const [prefs, setPrefs] = useState<ListPrefs>(() => {
    try { const s = localStorage.getItem(PREFS_KEY); return s ? { ...DEFAULT_PREFS, ...JSON.parse(s) } : DEFAULT_PREFS; }
    catch { return DEFAULT_PREFS; }
  });
  const [search, setSearch] = useState('');
  const [dateF, setDateF] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [amountF, setAmountF] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Quotation | null>(null);

  const savePrefs = (patch: Partial<ListPrefs>) => {
    setPrefs(prev => { const next = { ...prev, ...patch }; localStorage.setItem(PREFS_KEY, JSON.stringify(next)); return next; });
  };

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, dateF, customFrom, customTo, amountF, prefs.sortField, prefs.sortDir]);

  const median = useMemo(() => {
    if (!quotations.length) return 0;
    const a = [...quotations].sort((x, y) => x.grandTotal - y.grandTotal).map(q => q.grandTotal);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }, [quotations]);

  const filtered = useMemo(() => {
    const now = new Date();
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const thisM = ym(now), lastM = ym(new Date(now.getFullYear(), now.getMonth() - 1));
    const q = search.toLowerCase().trim();
    return quotations.filter(qt => {
      if (q && ![qt.quotationNumber, qt.date, String(qt.grandTotal), qt.customer.name, qt.customer.mobile, qt.customer.gstNumber || '', qt.customer.village, qt.customer.district, ...qt.products.map(p => p.name)].some(f => f.toLowerCase().includes(q))) return false;
      const qtM = qt.date.slice(0, 7);
      if (dateF === 'thisMonth' && qtM !== thisM) return false;
      if (dateF === 'lastMonth' && qtM !== lastM) return false;
      if (dateF === 'custom') { if (customFrom && qt.date < customFrom) return false; if (customTo && qt.date > customTo) return false; }
      if (amountF === 'high' && qt.grandTotal < median) return false;
      if (amountF === 'low' && qt.grandTotal >= median) return false;
      return true;
    });
  }, [quotations, search, dateF, customFrom, customTo, amountF, median]);

  const sorted = useMemo(() => {
    const d = prefs.sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (prefs.sortField) {
        case 'quotationNumber': return d * a.quotationNumber.localeCompare(b.quotationNumber);
        case 'customer': return d * a.customer.name.localeCompare(b.customer.name);
        case 'date': return d * a.date.localeCompare(b.date);
        case 'grandTotal': return d * (a.grandTotal - b.grandTotal);
        default: return 0;
      }
    });
  }, [filtered, prefs.sortField, prefs.sortDir]);

  const stats = useMemo(() => ({
    total: filtered.length,
    thisMonth: filtered.filter(q => { const now = new Date(); return q.date.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); }).length,
    totalAmount: filtered.reduce((s, q) => s + q.grandTotal, 0),
    avgAmount: filtered.length ? filtered.reduce((s, q) => s + q.grandTotal, 0) / filtered.length : 0,
  }), [filtered]);

  const ps = prefs.pageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / ps));
  const pg = Math.min(page, totalPages);
  const paginated = sorted.slice((pg - 1) * ps, pg * ps);

  const toggleSel = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isAllSel = paginated.length > 0 && paginated.every(q => selected.has(q.id));
  const toggleAllSel = () => {
    if (isAllSel) setSelected(prev => { const n = new Set(prev); paginated.forEach(q => n.delete(q.id)); return n; });
    else setSelected(prev => { const n = new Set(prev); paginated.forEach(q => n.add(q.id)); return n; });
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => savePrefs({ sortField: field, sortDir: prefs.sortField === field && prefs.sortDir === 'desc' ? 'asc' : 'desc' })}
      className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600 transition-colors group whitespace-nowrap">
      {label}
      {prefs.sortField === field ? (prefs.sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
    </button>
  );

  const SelBox = ({ id }: { id: string }) => (
    <button onClick={() => toggleSel(id)} className="flex-shrink-0">
      {selected.has(id) ? <CheckSquare2 className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />}
    </button>
  );

  if (quotations.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">No Quotations Yet</h3>
        <p className="text-slate-500">Create your first quotation to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total', val: stats.total, color: 'text-slate-700' },
          { label: 'This Month', val: stats.thisMonth, color: 'text-blue-600' },
          { label: 'Total Value', val: `₹${fmtShort(stats.totalAmount)}`, color: 'text-emerald-700' },
          { label: 'Avg Value', val: `₹${fmtShort(stats.avgAmount)}`, color: 'text-slate-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center shadow-sm">
            <div className={`text-base font-bold ${color}`}>{val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search quotations…" className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><XCircle className="w-4 h-4" /></button>}
        </div>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white shadow-sm">
          {([['compact', LayoutList, 'Compact'], ['detailed', LayoutGrid, 'Detailed'], ['table', Table2, 'Table']] as const).map(([mode, Icon, title]) => (
            <button key={mode} onClick={() => { savePrefs({ viewMode: mode }); setPage(1); }}
              className={`p-2 transition-colors ${prefs.viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} title={`${title} View`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <select value={prefs.sortField} onChange={e => savePrefs({ sortField: e.target.value as SortField })}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm">
          <option value="date">Date</option>
          <option value="quotationNumber">Quotation #</option>
          <option value="customer">Customer</option>
          <option value="grandTotal">Amount</option>
        </select>
        <button onClick={() => savePrefs({ sortDir: prefs.sortDir === 'asc' ? 'desc' : 'asc' })}
          className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          {prefs.sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
        </button>
        <select value={prefs.pageSize} onChange={e => { savePrefs({ pageSize: Number(e.target.value) }); setPage(1); }}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm">
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        {([['all', 'All Dates'], ['thisMonth', 'This Month'], ['lastMonth', 'Last Month'], ['custom', 'Custom Range']] as const).map(([d, label]) => (
          <button key={d} onClick={() => setDateF(d)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${dateF === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
            {label}
          </button>
        ))}
        <span className="text-slate-200 select-none">|</span>
        {([['all', 'All Amounts'], ['high', 'High Value'], ['low', 'Low Value']] as const).map(([a, label]) => (
          <button key={a} onClick={() => setAmountF(a)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${amountF === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {dateF === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
          <span className="text-xs text-blue-700 font-medium">From</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs border border-blue-300 rounded px-2 py-1 bg-white" />
          <span className="text-xs text-blue-700 font-medium">To</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-xs border border-blue-300 rounded px-2 py-1 bg-white" />
          <button onClick={() => { setCustomFrom(''); setCustomTo(''); }} className="text-xs text-blue-500 hover:text-blue-700 ml-1">Clear</button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-semibold text-blue-700">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-blue-500 hover:text-blue-700">Clear</button>
          <div className="flex-1" />
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white rounded-md text-xs font-medium hover:bg-slate-700 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          {onBulkDelete && (
            <button onClick={() => { onBulkDelete(Array.from(selected)); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      )}

      {/* No Results */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">No quotations match your filters</p>
          <button onClick={() => { setSearch(''); setDateF('all'); setAmountF('all'); }}
            className="mt-2 text-sm text-blue-600 hover:underline">Clear all filters</button>
        </div>
      ) : (
        <>
          {/* Compact View */}
          {prefs.viewMode === 'compact' && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-8 px-3 py-2.5 text-center">
                      <button onClick={toggleAllSel}>{isAllSel ? <CheckSquare2 className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}</button>
                    </th>
                    <th className="px-3 py-2.5 text-left"><SortBtn field="quotationNumber" label="Quotation #" /></th>
                    <th className="px-3 py-2.5 text-left"><SortBtn field="customer" label="Customer" /></th>
                    <th className="px-3 py-2.5 text-left hidden md:table-cell"><SortBtn field="date" label="Date" /></th>
                    <th className="px-3 py-2.5 text-center hidden sm:table-cell text-slate-600 font-semibold">Products</th>
                    <th className="px-3 py-2.5 text-right"><SortBtn field="grandTotal" label="Amount" /></th>
                    <th className="px-3 py-2.5 text-center text-slate-600 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(qt => (
                    <tr key={qt.id} className={`hover:bg-slate-50 transition-colors ${selected.has(qt.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2 text-center"><SelBox id={qt.id} /></td>
                      <td className="px-3 py-2 font-mono font-semibold text-blue-600 whitespace-nowrap">{qt.quotationNumber}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[140px] truncate">{qt.customer.name}</td>
                      <td className="px-3 py-2 text-slate-500 hidden md:table-cell whitespace-nowrap">{qt.date}</td>
                      <td className="px-3 py-2 text-center hidden sm:table-cell text-slate-500">{qt.products.length}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">₹{fmt(qt.grandTotal)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-0.5">
                          <button onClick={() => setPreview(qt)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onEdit(qt)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onConvertToInvoice(qt)} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded" title="Convert to Invoice"><FileInput className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDuplicate(qt.id)} className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDelete(qt.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailed View */}
          {prefs.viewMode === 'detailed' && (
            <div className="grid gap-3">
              {paginated.map(qt => (
                <div key={qt.id} className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow ${selected.has(qt.id) ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'}`}>
                  <div className="hidden sm:flex justify-between items-start gap-2">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <SelBox id={qt.id} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-bold text-blue-600">{qt.quotationNumber}</h3>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{qt.date}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="truncate">{qt.customer.name || 'Unnamed Customer'}</span></div>
                          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />{qt.products.length} products</div>
                          <div className="font-bold text-slate-800">₹{fmt(qt.grandTotal)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setPreview(qt)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Preview"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => onEdit(qt)} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => onConvertToInvoice(qt)} className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Convert to Invoice"><FileInput className="w-4 h-4" /></button>
                      <button onClick={() => onDuplicate(qt.id)} className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Duplicate"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(qt.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {/* Mobile layout */}
                  <div className="sm:hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <SelBox id={qt.id} />
                        <div>
                          <h3 className="font-bold text-blue-600 text-base">{qt.quotationNumber}</h3>
                          <span className="text-xs text-slate-500">{qt.date}</span>
                        </div>
                      </div>
                      <div className="font-bold text-lg text-slate-800">₹{fmtShort(qt.grandTotal)}</div>
                    </div>
                    <div className="text-sm text-slate-600 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />{qt.customer.name}</div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setPreview(qt)} className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-center gap-2"><Eye className="w-4 h-4" /> Preview</button>
                      <button onClick={() => onEdit(qt)} className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors flex items-center justify-center gap-2"><Edit className="w-4 h-4" /> Edit</button>
                      <button onClick={() => onConvertToInvoice(qt)} className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors flex items-center justify-center gap-2"><FileInput className="w-4 h-4" /> Invoice</button>
                      <button onClick={() => onDuplicate(qt.id)} className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors flex items-center justify-center gap-2"><Copy className="w-4 h-4" /> Copy</button>
                      <button onClick={() => onDelete(qt.id)} className="w-full px-3 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {prefs.viewMode === 'table' && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-8 px-3 py-3 text-center">
                        <button onClick={toggleAllSel}>{isAllSel ? <CheckSquare2 className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}</button>
                      </th>
                      <th className="px-3 py-3 text-left"><SortBtn field="quotationNumber" label="Quotation #" /></th>
                      <th className="px-3 py-3 text-left"><SortBtn field="customer" label="Customer" /></th>
                      <th className="px-3 py-3 text-left text-slate-600 font-semibold whitespace-nowrap">Mobile</th>
                      <th className="px-3 py-3 text-left"><SortBtn field="date" label="Date" /></th>
                      <th className="px-3 py-3 text-center text-slate-600 font-semibold whitespace-nowrap">Products</th>
                      <th className="px-3 py-3 text-right"><SortBtn field="grandTotal" label="Amount" /></th>
                      <th className="px-3 py-3 text-center text-slate-600 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map(qt => (
                      <tr key={qt.id} className={`hover:bg-slate-50 transition-colors ${selected.has(qt.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2.5 text-center"><SelBox id={qt.id} /></td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-blue-600 whitespace-nowrap">{qt.quotationNumber}</td>
                        <td className="px-3 py-2.5 text-slate-800 max-w-[160px] truncate">{qt.customer.name}</td>
                        <td className="px-3 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">{qt.customer.mobile || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{qt.date}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{qt.products.length}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">₹{fmt(qt.grandTotal)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center gap-0.5">
                            <button onClick={() => setPreview(qt)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onEdit(qt)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onConvertToInvoice(qt)} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded" title="Convert to Invoice"><FileInput className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDuplicate(qt.id)} className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(qt.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm">
            <div className="text-sm text-slate-600">
              {sorted.length === 0 ? 'No quotations' : `Showing ${((pg - 1) * ps) + 1}–${Math.min(pg * ps, sorted.length)} of ${sorted.length} Quotations`}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={pg === 1} className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pg === 1} className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (pg <= 4) p = i + 1;
                  else if (pg >= totalPages - 3) p = totalPages - 6 + i;
                  else p = pg - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded text-sm transition-colors ${p === pg ? 'bg-blue-600 text-white font-bold' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pg === totalPages} className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
                <button onClick={() => setPage(totalPages)} disabled={pg === totalPages} className="p-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronsRight className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        </>
      )}

      {preview && <QuotationPreview quotation={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function QuotationPreview({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Preview: {quotation.quotationNumber}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Customer Details</h4>
                <p className="text-slate-800 font-medium">{quotation.customer.name}</p>
                <p className="text-sm text-slate-600">{quotation.customer.mobile}</p>
                <p className="text-sm text-slate-600">{quotation.customer.village}, {quotation.customer.district}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Date: {quotation.date}</p>
                <p className="text-sm text-slate-600">Products: {quotation.products.length}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-300 min-w-[500px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 px-2 py-1 text-left">Product</th>
                    <th className="border border-slate-300 px-2 py-1 text-center">HSN/SAC</th>
                    <th className="border border-slate-300 px-2 py-1 text-center">GST%</th>
                    <th className="border border-slate-300 px-2 py-1 text-center">Qty</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.products.map((p, i) => (
                    <tr key={i}>
                      <td className="border border-slate-300 px-2 py-1">{p.name}</td>
                      <td className="border border-slate-300 px-2 py-1 text-center font-mono text-xs">{p.hsnSacCode}</td>
                      <td className="border border-slate-300 px-2 py-1 text-center">{p.gstPercent}%</td>
                      <td className="border border-slate-300 px-2 py-1 text-center">{p.quantity}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right">{(p.quantity * p.unitPrice).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="w-64 text-sm">
                <div className="flex justify-between py-1"><span>Taxable Amount:</span><span>₹{quotation.totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>CGST:</span><span>₹{quotation.totalCgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>SGST:</span><span>₹{quotation.totalSgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>Round Off:</span><span>₹{(quotation.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between py-2 border-t font-bold"><span>Grand Total:</span><span>₹{quotation.grandTotal.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
