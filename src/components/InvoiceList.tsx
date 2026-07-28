import { Invoice, InvoiceStatus } from '../types';
import {
  FileText, Trash2, Copy, CreditCard as Edit, Eye, X, Calendar, User,
  Search, XCircle, IndianRupee, LayoutList, LayoutGrid, Table2, Kanban,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Printer, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckSquare2, Square,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

type ViewMode = 'compact' | 'detailed' | 'table' | 'kanban';
type SortField = 'invoiceNumber' | 'customer' | 'date' | 'dueDate' | 'grandTotal' | 'outstanding' | 'status';
type SortDir = 'asc' | 'desc';

interface ListPrefs { viewMode: ViewMode; pageSize: number; sortField: SortField; sortDir: SortDir; }

const PREFS_KEY = 'laxmeejee_invoice_list_prefs';
const DEFAULT_PREFS: ListPrefs = { viewMode: 'detailed', pageSize: 20, sortField: 'date', sortDir: 'desc' };
const PAGE_SIZES = [10, 20, 50, 100];

const STATUS_ORDER: Record<InvoiceStatus, number> = { Draft: 0, Unpaid: 1, 'Partial Payment': 2, Paid: 3 };
const STATUS_PILL: Record<InvoiceStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Unpaid: 'bg-red-100 text-red-700',
  'Partial Payment': 'bg-amber-100 text-amber-700',
  Paid: 'bg-green-100 text-green-700',
};

interface Props {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRecordPayment: (invoice: Invoice) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkMarkPaid?: (ids: string[]) => void;
}

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtShort = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function InvoiceList({ invoices, onEdit, onDelete, onDuplicate, onRecordPayment, onBulkDelete, onBulkMarkPaid }: Props) {
  const [prefs, setPrefs] = useState<ListPrefs>(() => {
    try { const s = localStorage.getItem(PREFS_KEY); return s ? { ...DEFAULT_PREFS, ...JSON.parse(s) } : DEFAULT_PREFS; }
    catch { return DEFAULT_PREFS; }
  });
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [dateF, setDateF] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [amountF, setAmountF] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Invoice | null>(null);

  const savePrefs = (patch: Partial<ListPrefs>) => {
    setPrefs(prev => { const next = { ...prev, ...patch }; localStorage.setItem(PREFS_KEY, JSON.stringify(next)); return next; });
  };

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, statusF, dateF, customFrom, customTo, amountF, prefs.sortField, prefs.sortDir]);

  const median = useMemo(() => {
    if (!invoices.length) return 0;
    const a = [...invoices].sort((x, y) => x.grandTotal - y.grandTotal).map(i => i.grandTotal);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }, [invoices]);

  const filtered = useMemo(() => {
    const now = new Date();
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const thisM = ym(now), lastM = ym(new Date(now.getFullYear(), now.getMonth() - 1));
    const q = search.toLowerCase().trim();
    return invoices.filter(inv => {
      if (q && ![inv.invoiceNumber, inv.date, inv.dueDate || '', String(inv.grandTotal), inv.customer.name, inv.customer.mobile, inv.customer.gstNumber || '', inv.status].some(f => f.toLowerCase().includes(q))) return false;
      if (statusF !== 'all' && inv.status !== statusF) return false;
      const invM = inv.date.slice(0, 7);
      if (dateF === 'thisMonth' && invM !== thisM) return false;
      if (dateF === 'lastMonth' && invM !== lastM) return false;
      if (dateF === 'custom') { if (customFrom && inv.date < customFrom) return false; if (customTo && inv.date > customTo) return false; }
      if (amountF === 'high' && inv.grandTotal < median) return false;
      if (amountF === 'low' && inv.grandTotal >= median) return false;
      return true;
    });
  }, [invoices, search, statusF, dateF, customFrom, customTo, amountF, median]);

  const sorted = useMemo(() => {
    const d = prefs.sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (prefs.sortField) {
        case 'invoiceNumber': return d * a.invoiceNumber.localeCompare(b.invoiceNumber);
        case 'customer': return d * a.customer.name.localeCompare(b.customer.name);
        case 'date': return d * a.date.localeCompare(b.date);
        case 'dueDate': return d * (a.dueDate || '').localeCompare(b.dueDate || '');
        case 'grandTotal': return d * (a.grandTotal - b.grandTotal);
        case 'outstanding': return d * (Math.max(0, a.grandTotal - (a.amountPaid || 0)) - Math.max(0, b.grandTotal - (b.amountPaid || 0)));
        case 'status': return d * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        default: return 0;
      }
    });
  }, [filtered, prefs.sortField, prefs.sortDir]);

  const stats = useMemo(() => ({
    total: filtered.length,
    paid: filtered.filter(i => i.status === 'Paid').length,
    partial: filtered.filter(i => i.status === 'Partial Payment').length,
    unpaid: filtered.filter(i => i.status === 'Unpaid').length,
    draft: filtered.filter(i => i.status === 'Draft').length,
    revenue: filtered.reduce((s, i) => s + (i.amountPaid || 0), 0),
    outstanding: filtered.reduce((s, i) => s + Math.max(0, i.grandTotal - (i.amountPaid || 0)), 0),
  }), [filtered]);

  const ps = prefs.pageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / ps));
  const pg = Math.min(page, totalPages);
  const paginated = prefs.viewMode === 'kanban' ? sorted : sorted.slice((pg - 1) * ps, pg * ps);

  const toggleSel = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isAllSel = paginated.length > 0 && paginated.every(i => selected.has(i.id));
  const toggleAllSel = () => {
    if (isAllSel) setSelected(prev => { const n = new Set(prev); paginated.forEach(i => n.delete(i.id)); return n; });
    else setSelected(prev => { const n = new Set(prev); paginated.forEach(i => n.add(i.id)); return n; });
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

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">No Invoices Yet</h3>
        <p className="text-slate-500">Convert a quotation to an invoice to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: 'Total', val: stats.total, color: 'text-slate-700' },
          { label: 'Paid', val: stats.paid, color: 'text-emerald-600' },
          { label: 'Partial', val: stats.partial, color: 'text-amber-600' },
          { label: 'Unpaid', val: stats.unpaid, color: 'text-red-600' },
          { label: 'Draft', val: stats.draft, color: 'text-slate-500' },
          { label: 'Revenue', val: `₹${fmtShort(stats.revenue)}`, color: 'text-emerald-700' },
          { label: 'Outstanding', val: `₹${fmtShort(stats.outstanding)}`, color: 'text-red-700' },
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
            placeholder="Search invoices…" className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><XCircle className="w-4 h-4" /></button>}
        </div>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white shadow-sm">
          {([['compact', LayoutList, 'Compact'], ['detailed', LayoutGrid, 'Detailed'], ['table', Table2, 'Table'], ['kanban', Kanban, 'Kanban']] as const).map(([mode, Icon, title]) => (
            <button key={mode} onClick={() => { savePrefs({ viewMode: mode }); setPage(1); }}
              className={`p-2 transition-colors ${prefs.viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} title={`${title} View`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <select value={prefs.sortField} onChange={e => savePrefs({ sortField: e.target.value as SortField })}
          className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 shadow-sm">
          <option value="date">Date</option>
          <option value="invoiceNumber">Invoice #</option>
          <option value="customer">Customer</option>
          <option value="dueDate">Due Date</option>
          <option value="grandTotal">Amount</option>
          <option value="outstanding">Outstanding</option>
          <option value="status">Status</option>
        </select>
        <button onClick={() => savePrefs({ sortDir: prefs.sortDir === 'asc' ? 'desc' : 'asc' })}
          className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm" title="Toggle sort direction">
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
        {(['all', 'Draft', 'Unpaid', 'Partial Payment', 'Paid'] as const).map(s => (
          <button key={s} onClick={() => setStatusF(s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${statusF === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
            {s === 'all' ? 'All Status' : s}
          </button>
        ))}
        <span className="text-slate-200 select-none">|</span>
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
          {onBulkMarkPaid && (
            <button onClick={() => { onBulkMarkPaid(Array.from(selected)); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
            </button>
          )}
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
          <p className="text-slate-600 font-medium">No invoices match your filters</p>
          <button onClick={() => { setSearch(''); setStatusF('all'); setDateF('all'); setAmountF('all'); }}
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
                    <th className="px-3 py-2.5 text-left"><SortBtn field="invoiceNumber" label="Invoice #" /></th>
                    <th className="px-3 py-2.5 text-left"><SortBtn field="customer" label="Customer" /></th>
                    <th className="px-3 py-2.5 text-left hidden md:table-cell"><SortBtn field="date" label="Date" /></th>
                    <th className="px-3 py-2.5 text-right"><SortBtn field="grandTotal" label="Amount" /></th>
                    <th className="px-3 py-2.5 text-center"><SortBtn field="status" label="Status" /></th>
                    <th className="px-3 py-2.5 text-center text-slate-600 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(inv => (
                    <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${selected.has(inv.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2 text-center"><SelBox id={inv.id} /></td>
                      <td className="px-3 py-2 font-mono font-semibold text-blue-600 whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[140px] truncate">{inv.customer.name}</td>
                      <td className="px-3 py-2 text-slate-500 hidden md:table-cell whitespace-nowrap">{inv.date}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800 whitespace-nowrap">₹{fmt(inv.grandTotal)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[inv.status]}`}>{inv.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center gap-0.5">
                          {(inv.status === 'Unpaid' || inv.status === 'Partial Payment') && (
                            <button onClick={() => onRecordPayment(inv)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Record Payment"><IndianRupee className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => setPreview(inv)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onEdit(inv)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDuplicate(inv.id)} className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDelete(inv.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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
              {paginated.map(inv => {
                const paid = inv.amountPaid || 0;
                const outstanding = Math.max(0, inv.grandTotal - paid);
                return (
                  <div key={inv.id} className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow ${selected.has(inv.id) ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-3 flex-1 min-w-0">
                        <SelBox id={inv.id} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-bold text-blue-600">{inv.invoiceNumber}</h3>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{inv.date}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_PILL[inv.status]}`}>{inv.status}</span>
                            {inv.sourceQuotationNumber && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded">from {inv.sourceQuotationNumber}</span>}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="truncate">{inv.customer.name || 'Unnamed'}</span></div>
                            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />Due: {inv.dueDate || '—'}</div>
                            <div className="font-bold text-slate-800">₹{fmt(inv.grandTotal)}</div>
                          </div>
                          {inv.status !== 'Draft' && (paid > 0 || outstanding > 0) && (
                            <div className="mt-2 flex gap-4 text-xs">
                              {paid > 0 && <span className="text-emerald-600 font-medium">Received: ₹{fmt(paid)}</span>}
                              {outstanding > 0 && <span className="text-red-600 font-medium">Outstanding: ₹{fmt(outstanding)}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {(inv.status === 'Unpaid' || inv.status === 'Partial Payment') && (
                          <button onClick={() => onRecordPayment(inv)} className="p-2 text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors" title="Record Payment"><IndianRupee className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => setPreview(inv)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Preview"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => onEdit(inv)} className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => onDuplicate(inv.id)} className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Duplicate"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => onDelete(inv.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {prefs.viewMode === 'table' && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-8 px-3 py-3 text-center">
                        <button onClick={toggleAllSel}>{isAllSel ? <CheckSquare2 className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}</button>
                      </th>
                      <th className="px-3 py-3 text-left"><SortBtn field="invoiceNumber" label="Invoice #" /></th>
                      <th className="px-3 py-3 text-left"><SortBtn field="customer" label="Customer" /></th>
                      <th className="px-3 py-3 text-left text-slate-600 font-semibold whitespace-nowrap">Mobile</th>
                      <th className="px-3 py-3 text-left"><SortBtn field="date" label="Date" /></th>
                      <th className="px-3 py-3 text-left"><SortBtn field="dueDate" label="Due Date" /></th>
                      <th className="px-3 py-3 text-center"><SortBtn field="status" label="Status" /></th>
                      <th className="px-3 py-3 text-right"><SortBtn field="grandTotal" label="Amount" /></th>
                      <th className="px-3 py-3 text-right text-slate-600 font-semibold whitespace-nowrap">Received</th>
                      <th className="px-3 py-3 text-right"><SortBtn field="outstanding" label="Outstanding" /></th>
                      <th className="px-3 py-3 text-center text-slate-600 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.map(inv => {
                      const paid = inv.amountPaid || 0;
                      const outstanding = Math.max(0, inv.grandTotal - paid);
                      return (
                        <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${selected.has(inv.id) ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-2.5 text-center"><SelBox id={inv.id} /></td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-blue-600 whitespace-nowrap">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2.5 text-slate-800 max-w-[150px] truncate">{inv.customer.name}</td>
                          <td className="px-3 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">{inv.customer.mobile || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{inv.date}</td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{inv.dueDate || '—'}</td>
                          <td className="px-3 py-2.5 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[inv.status]}`}>{inv.status}</span></td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">₹{fmt(inv.grandTotal)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600 whitespace-nowrap">{paid > 0 ? `₹${fmt(paid)}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right text-red-600 whitespace-nowrap">{outstanding > 0 ? `₹${fmt(outstanding)}` : '—'}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-center gap-0.5">
                              {(inv.status === 'Unpaid' || inv.status === 'Partial Payment') && (
                                <button onClick={() => onRecordPayment(inv)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Record Payment"><IndianRupee className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => setPreview(inv)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                              <button onClick={() => onEdit(inv)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => onDuplicate(inv.id)} className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => onDelete(inv.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kanban View */}
          {prefs.viewMode === 'kanban' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(['Draft', 'Unpaid', 'Partial Payment', 'Paid'] as InvoiceStatus[]).map(status => {
                const cols = sorted.filter(i => i.status === status);
                const colTotal = cols.reduce((s, i) => s + i.grandTotal, 0);
                const style = {
                  Draft: { hdr: 'bg-slate-100 border-slate-200', badge: 'bg-slate-200 text-slate-700' },
                  Unpaid: { hdr: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700' },
                  'Partial Payment': { hdr: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700' },
                  Paid: { hdr: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
                }[status];
                return (
                  <div key={status} className="flex flex-col gap-2">
                    <div className={`rounded-lg border px-3 py-2 ${style.hdr}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-slate-800">{status}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${style.badge}`}>{cols.length}</span>
                      </div>
                      {cols.length > 0 && <div className="text-xs text-slate-500 mt-0.5">₹{fmtShort(colTotal)}</div>}
                    </div>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
                      {cols.slice(0, 50).map(inv => (
                        <div key={inv.id} className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setPreview(inv)}>
                          <div className="font-mono text-xs font-bold text-blue-600 mb-1">{inv.invoiceNumber}</div>
                          <div className="text-xs text-slate-700 truncate mb-1">{inv.customer.name}</div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">{inv.date}</span>
                            <span className="text-xs font-bold text-slate-800">₹{fmtShort(inv.grandTotal)}</span>
                          </div>
                          <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => onEdit(inv)} className="flex-1 text-xs py-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors text-slate-600">Edit</button>
                            {(inv.status === 'Unpaid' || inv.status === 'Partial Payment') && (
                              <button onClick={() => onRecordPayment(inv)} className="flex-1 text-xs py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded transition-colors">Pay</button>
                            )}
                          </div>
                        </div>
                      ))}
                      {cols.length > 50 && <div className="text-xs text-center text-slate-400 py-2">+{cols.length - 50} more</div>}
                      {cols.length === 0 && <div className="text-xs text-center text-slate-400 py-6 bg-white rounded-lg border border-dashed border-slate-200">No invoices</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {prefs.viewMode !== 'kanban' && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm">
              <div className="text-sm text-slate-600">
                {sorted.length === 0 ? 'No invoices' : `Showing ${((pg - 1) * ps) + 1}–${Math.min(pg * ps, sorted.length)} of ${sorted.length} Invoices`}
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
          )}
        </>
      )}

      {preview && <InvoicePreview invoice={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function InvoicePreview({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Invoice Preview: {invoice.invoiceNumber}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Customer Details</h4>
                <p className="text-slate-800 font-medium">{invoice.customer.name}</p>
                <p className="text-sm text-slate-600">{invoice.customer.mobile}</p>
                <p className="text-sm text-slate-600">{invoice.customer.village}, {invoice.customer.district}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Date: {invoice.date}</p>
                <p className="text-sm text-slate-600">Due: {invoice.dueDate || '—'}</p>
                <p className="text-sm text-slate-600">Status: {invoice.status}</p>
              </div>
            </div>
            <table className="w-full text-sm border-collapse border border-slate-300">
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
                {invoice.products.map((p, i) => (
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
            <div className="flex justify-end">
              <div className="w-64 text-sm">
                <div className="flex justify-between py-1"><span>Taxable Amount:</span><span>₹{invoice.totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>CGST:</span><span>₹{invoice.totalCgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>SGST:</span><span>₹{invoice.totalSgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>Round Off:</span><span>₹{(invoice.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between py-2 border-t font-bold"><span>Grand Total:</span><span>₹{invoice.grandTotal.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
            {invoice.notes && <div className="text-sm text-slate-600 border-t pt-3"><strong>Notes:</strong> {invoice.notes}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
