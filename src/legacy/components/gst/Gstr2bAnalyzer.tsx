// @ts-nocheck -- original Hisaaboo code style, type-checked loosely
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileDown, FileText, RotateCcw, AlertTriangle, CheckCircle2, Search, X, Loader2, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseGstr2bWorkbook, FIELD_LABELS, Gstr2bError } from '../../utils/gstr2b';

const inr = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const NA = <span className="text-slate-400 italic">Not in file</span>;
const PAGE_SIZE = 25;
const AMOUNT_FIELDS = ['docValue', 'taxable', 'igst', 'cgst', 'sgst', 'cess'];

function parseDate(s: string) {
  const m = /^(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})$/.exec(s || '');
  if (!m) { const t = Date.parse(s); return Number.isNaN(t) ? 0 : t; }
  const months = 'janfebmaraprmayjunjulaugsepoctnovdec';
  const mo = /\d/.test(m[2]) ? Number(m[2]) - 1 : months.indexOf(m[2].toLowerCase()) / 3;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(y, mo, Number(m[1])).getTime();
}

const KIND_LABEL = { original: 'Original', amendment: 'Amendment', reversal: 'ITC Reversal', rejected: 'Rejected' };

export const Gstr2bAnalyzer: React.FC<{ uploadRequest?: number; onResultChange?: (hasResult: boolean) => void }> = ({ uploadRequest = 0, onResultChange }) => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeSheet, setActiveSheet] = useState('');
  const [search, setSearch] = useState('');
  const [gstinFilter, setGstinFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [itcFilter, setItcFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingPickRef = useRef(false);

  useEffect(() => { onResultChange?.(!!result); }, [result]);
  useEffect(() => {
    if (!uploadRequest) return;
    pendingPickRef.current = true;
    if (result) clearAll();
  }, [uploadRequest]);
  useEffect(() => {
    if (pendingPickRef.current && inputRef.current) {
      pendingPickRef.current = false;
      inputRef.current.click();
    }
  });


  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseGstr2bWorkbook(buf, file.name);
      setResult(parsed);
      setActiveSheet(parsed.sheets[0]?.name || '');
      resetFilters();
    } catch (e) {
      setResult(null);
      setError(e instanceof Gstr2bError ? e.message : 'Something went wrong while reading this workbook.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const resetFilters = () => { setSearch(''); setGstinFilter(''); setTypeFilter(''); setItcFilter(''); setSortBy(''); setPage(0); };
  const clearAll = () => { setResult(null); setError(''); setSelected(null); setActiveSheet(''); resetFilters(); };

  const sheet = result?.sheets.find((s) => s.name === activeSheet);

  const options = useMemo(() => {
    if (!sheet) return { gstins: [], types: [], itc: [] };
    const uniq = (f) => [...new Set(sheet.records.map((r) => r.fields[f]).filter(Boolean))].sort();
    return { gstins: uniq('supplierGstin'), types: [...new Set([...uniq('noteType'), ...uniq('docType')])], itc: uniq('itcAvailability') };
  }, [sheet]);

  const rows = useMemo(() => {
    if (!sheet) return [];
    const q = search.trim().toLowerCase();
    let list = sheet.records.filter((r) => {
      if (gstinFilter && r.fields.supplierGstin !== gstinFilter) return false;
      if (typeFilter && r.fields.docType !== typeFilter && r.fields.noteType !== typeFilter) return false;
      if (itcFilter && r.fields.itcAvailability !== itcFilter) return false;
      if (q && !['supplierGstin', 'supplierName', 'docNumber'].some((f) => (r.fields[f] || '').toLowerCase().includes(q))) return false;
      return true;
    });
    if (sortBy) {
      const val = (r) => sortBy === 'docDate' ? parseDate(r.fields.docDate) : sortBy === 'tax' ? r.values.igst + r.values.cgst + r.values.sgst + r.values.cess : r.values.taxable;
      list = [...list].sort((a, b) => (sortDir === 'asc' ? 1 : -1) * (val(a) - val(b)));
    }
    return list;
  }, [sheet, search, gstinFilter, typeFilter, itcFilter, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportRecords = (format: 'xlsx' | 'csv') => {
    const data = result.sheets.flatMap((s) => s.records.map((r) => {
      const row = { Worksheet: s.name, Category: s.category, 'Source Row': r.sourceRow };
      for (const f of Object.keys(FIELD_LABELS)) {
        if (!s.columns.includes(f)) continue;
        row[FIELD_LABELS[f]] = AMOUNT_FIELDS.includes(f) ? r.values[f] : r.fields[f];
      }
      return row;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'GSTR-2B Records');
    const base = `GSTR-2B_${result.meta.gstin || 'records'}_${(result.meta.taxPeriod || '').replace(/\s+/g, '_')}`;
    XLSX.writeFile(wb, `${base}.${format}`, { bookType: format });
  };

  const exportPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    const money = (v) => (v === null || v === undefined ? '-' : new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v));
    doc.setFontSize(16); doc.text('GSTR-2B Analysis Summary', w / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    const m = result.meta;
    doc.text(`GSTIN: ${m.gstin || 'Not in file'}   FY: ${m.financialYear || 'Not in file'}   Tax Period: ${m.taxPeriod || 'Not in file'}`, w / 2, 22, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}  (Rs.)  -  Analysis only, not a final ITC eligibility decision.`, w / 2, 28, { align: 'center' });
    const h = result.headline;
    autoTable(doc, {
      startY: 34, head: [['Measure', 'Taxable', 'IGST', 'CGST', 'SGST/UTGST', 'Cess']],
      body: [
        ['Tax in original documents (net of credit notes)', money(h.taxable), money(h.igst), money(h.cgst), money(h.sgst), money(h.cess)],
        ['ITC marked available (Yes) in workbook', '-', money(h.itcYes.igst), money(h.itcYes.cgst), money(h.itcYes.sgst), money(h.itcYes.cess)],
        ['Marked not available / to review', '-', money(h.itcNotYes.igst), money(h.itcNotYes.cgst), money(h.itcNotYes.sgst), money(h.itcNotYes.cess)],
      ],
      styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] },
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6, head: [['Worksheet', 'Category', 'Type', 'Records', 'Taxable', 'IGST', 'CGST', 'SGST/UTGST', 'Cess']],
      body: result.sheets.map((s) => [s.name, s.category, KIND_LABEL[s.kind], s.records.length, money(s.totals.taxable), money(s.totals.igst), money(s.totals.cgst), money(s.totals.sgst), money(s.totals.cess)]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] },
    });
    if (result.summaries.length) autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6, head: [['Source sheet', 'Heading', 'GSTR-3B Table', 'IGST', 'CGST', 'SGST/UTGST', 'Cess']],
      body: result.summaries.map((l) => [l.sheet, l.heading, l.table, money(l.igst), money(l.cgst), money(l.sgst), money(l.cess)]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [16, 185, 129] },
    });
    if (result.reconciliations.length) autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6, head: [['Summary line', 'Source sheet', 'Reported IGST/CGST/SGST/Cess', 'Calculated IGST/CGST/SGST/Cess', 'Status']],
      body: result.reconciliations.map((r) => [r.heading, r.sourceSheet, ['igst', 'cgst', 'sgst', 'cess'].map((k) => money(r.reported[k])).join(' / '), ['igst', 'cgst', 'sgst', 'cess'].map((k) => money(r.calculated[k])).join(' / '), r.matches ? 'Matches' : 'Difference']),
      styles: { fontSize: 7 }, headStyles: { fillColor: [16, 185, 129] },
    });
    doc.save(`GSTR-2B_Summary_${result.meta.gstin || ''}.pdf`);
  };

  if (!result) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">GSTR-2B Analyzer</h3>
          <p className="text-sm text-slate-500 mt-1">Upload your GST Portal GSTR-2B Excel file to analyze supplier invoices and available input tax credit.</p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-600"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" />Reading workbook…</div>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto text-emerald-600" />
              <p className="mt-3 text-sm text-slate-700 font-medium">Drag & drop your GSTR-2B .xlsx file here</p>
              <p className="text-xs text-slate-500 mt-1">or</p>
              <button onClick={() => inputRef.current?.click()} className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
                <FileSpreadsheet className="w-4 h-4" /> Choose Excel file
              </button>
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} aria-label="Upload GSTR-2B workbook" />
              <p className="text-xs text-slate-500 mt-3">Supported format: .xlsx (max 15 MB). Upload the original GST Portal workbook without changing its sheet names or structure.</p>
            </>
          )}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700" role="alert">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}
        <p className="text-xs text-slate-500 flex items-center gap-1"><Info className="w-3.5 h-3.5" />Your file is read only in this browser. It is not uploaded or saved.</p>
      </div>
    );
  }

  const h = result.headline;
  const m = result.meta;
  const card = (label, value, sub?) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-800 mt-1 break-words">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
  const anyItc = result.sheets.some((s) => s.kind === 'original' && s.columns.includes('itcAvailability'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">GSTR-2B Analyzer</h3>
          <p className="text-sm text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{result.fileName} analysed</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"><FileDown className="w-4 h-4" />Summary PDF</button>
          <button onClick={() => exportRecords('xlsx')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><FileSpreadsheet className="w-4 h-4" />Excel</button>
          <button onClick={() => exportRecords('csv')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><FileText className="w-4 h-4" />CSV</button>
          <button onClick={clearAll} className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"><RotateCcw className="w-4 h-4" />Upload another</button>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
          {result.warnings.map((w) => <p key={w} className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{w}</p>)}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {card('GSTIN', m.gstin || NA, m.legalName || m.tradeName)}
        {card('Financial Year', m.financialYear || NA)}
        {card('Tax Period', m.taxPeriod || NA)}
        {card('Records (all sheets)', h.records.toLocaleString('en-IN'), `${result.sheets.length} worksheets`)}
        {card('Taxable Value', inr(h.taxable), 'Original documents, net of credit notes')}
        {card('IGST', inr(h.igst), 'Tax shown in workbook')}
        {card('CGST', inr(h.cgst), 'Tax shown in workbook')}
        {card('SGST/UTGST', inr(h.sgst), 'Tax shown in workbook')}
        {card('Cess', inr(h.cess), 'Tax shown in workbook')}
        {card('ITC marked available', anyItc ? inr(h.itcYes.igst + h.itcYes.cgst + h.itcYes.sgst + h.itcYes.cess) : NA, 'As classified "Yes" in the workbook')}
        {card('Not available / to review', anyItc ? inr(h.itcNotYes.igst + h.itcNotYes.cgst + h.itcNotYes.sgst + h.itcNotYes.cess) : NA, `${h.itcNotYes.count} records need eligibility verification`)}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>Headline totals use only original documents (B2B, notes, ECO, ISD, imports). Amendments, ITC reversal and rejected sheets are shown separately and never added on top. "Available" means the workbook marks it so — please verify eligibility before claiming.</span>
      </div>

      {/* ITC analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200"><h4 className="font-semibold text-slate-800">ITC Analysis</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="text-left px-3 py-2">Worksheet</th><th className="text-left px-3 py-2">Type</th><th className="text-right px-3 py-2">Records</th>
              <th className="text-right px-3 py-2">Taxable</th><th className="text-right px-3 py-2">IGST</th><th className="text-right px-3 py-2">CGST</th><th className="text-right px-3 py-2">SGST/UTGST</th><th className="text-right px-3 py-2">Cess</th>
            </tr></thead>
            <tbody>
              {result.sheets.map((s) => (
                <tr key={s.name} className="border-t border-slate-100">
                  <td className="px-3 py-2"><div className="font-medium text-slate-800">{s.category}</div><div className="text-xs text-slate-400">Sheet: {s.name}</div></td>
                  <td className="px-3 py-2 text-xs">{KIND_LABEL[s.kind]}</td>
                  <td className="px-3 py-2 text-right">{s.records.length}</td>
                  {['taxable', 'igst', 'cgst', 'sgst', 'cess'].map((k) => <td key={k} className="px-3 py-2 text-right whitespace-nowrap">{inr(s.totals[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.summaries.length > 0 && (
          <div className="border-t border-slate-200 overflow-x-auto">
            <p className="px-4 pt-3 text-sm font-medium text-slate-700">Summary as reported in the workbook</p>
            <table className="w-full text-sm mt-2">
              <thead className="bg-slate-50 text-slate-600"><tr>
                <th className="text-left px-3 py-2">Source sheet</th><th className="text-left px-3 py-2">Heading</th><th className="text-left px-3 py-2">GSTR-3B</th>
                <th className="text-right px-3 py-2">IGST</th><th className="text-right px-3 py-2">CGST</th><th className="text-right px-3 py-2">SGST/UTGST</th><th className="text-right px-3 py-2">Cess</th>
              </tr></thead>
              <tbody>
                {result.summaries.map((l, i) => (
                  <tr key={i} className={`border-t border-slate-100 ${l.isGroup ? 'bg-slate-50 font-medium' : ''}`}>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{l.sheet}</td>
                    <td className="px-3 py-2">{l.heading}{l.advisory && <div className="text-xs text-slate-400">{l.advisory}</div>}</td>
                    <td className="px-3 py-2 text-xs">{l.table}</td>
                    {['igst', 'cgst', 'sgst', 'cess'].map((k) => <td key={k} className="px-3 py-2 text-right whitespace-nowrap">{l[k] === null ? '' : inr(l[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.reconciliations.length > 0 && (
          <div className="border-t border-slate-200 p-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Cross-check: summary vs invoice-level totals</p>
            {result.reconciliations.map((r, i) => (
              <div key={i} className={`text-xs rounded-lg p-2 flex items-start gap-2 ${r.matches ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                {r.matches ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span><strong>{r.heading}</strong> ({r.summarySheet}) vs sheet {r.sourceSheet}: {r.matches ? 'matches.' : 'difference found — '}
                  {!r.matches && ['igst', 'cgst', 'sgst', 'cess'].map((k) => `${k.toUpperCase()} reported ${inr(r.reported[k])} / calculated ${inr(r.calculated[k])}`).join('; ')}</span>
              </div>
            ))}
          </div>
        )}
        {result.skippedSheets.length > 0 && (
          <p className="px-4 pb-3 text-xs text-slate-400">Not analysed: {result.skippedSheets.map((s) => `${s.name} (${s.reason})`).join(', ')}</p>
        )}
      </div>

      {/* Explorer */}
      {result.sheets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-200">
            {result.sheets.map((s) => (
              <button key={s.name} onClick={() => { setActiveSheet(s.name); resetFilters(); }}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${activeSheet === s.name ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50' : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50'}`}>
                {s.name} <span className="text-xs text-slate-400">({s.records.length})</span>
              </button>
            ))}
          </div>
          {sheet && (
            <>
              <div className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search GSTIN, supplier, document no." className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <select value={gstinFilter} onChange={(e) => { setGstinFilter(e.target.value); setPage(0); }} className="border border-slate-300 rounded-lg text-sm px-2 py-2" aria-label="Filter by supplier GSTIN">
                  <option value="">All supplier GSTINs</option>{options.gstins.map((g) => <option key={g}>{g}</option>)}
                </select>
                <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }} className="border border-slate-300 rounded-lg text-sm px-2 py-2" aria-label="Filter by document type">
                  <option value="">All document types</option>{options.types.map((g) => <option key={g}>{g}</option>)}
                </select>
                <select value={itcFilter} onChange={(e) => { setItcFilter(e.target.value); setPage(0); }} className="border border-slate-300 rounded-lg text-sm px-2 py-2" aria-label="Filter by ITC availability">
                  <option value="">All ITC classifications</option>{options.itc.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="px-3 pb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                Sort by:
                {[['docDate', 'Date'], ['taxable', 'Taxable value'], ['tax', 'Tax amount']].map(([k, l]) => (
                  <button key={k} onClick={() => { if (sortBy === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir('desc'); } }}
                    className={`px-2 py-1 rounded border ${sortBy === k ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-slate-300'}`}>
                    {l}{sortBy === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
                <span className="ml-auto">{rows.length} of {sheet.records.length} records</span>
              </div>
              {rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">{sheet.records.length === 0 ? 'This worksheet has no records.' : 'No records match your filters.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600"><tr>
                      {sheet.columns.map((f) => <th key={f} className={`px-3 py-2 whitespace-nowrap ${AMOUNT_FIELDS.includes(f) ? 'text-right' : 'text-left'}`}>{FIELD_LABELS[f]}</th>)}
                    </tr></thead>
                    <tbody>
                      {pageRows.map((r) => (
                        <tr key={r.id} onClick={() => setSelected(r)} className="border-t border-slate-100 hover:bg-emerald-50 cursor-pointer">
                          {sheet.columns.map((f) => (
                            <td key={f} className={`px-3 py-2 whitespace-nowrap ${AMOUNT_FIELDS.includes(f) ? 'text-right' : ''}`}>
                              {AMOUNT_FIELDS.includes(f) ? inr(r.values[f]) : (r.fields[f] || <span className="text-slate-300">—</span>)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between p-3 border-t border-slate-200 text-sm">
                  <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40">Previous</button>
                  <span className="text-slate-600">Page {page + 1} of {pageCount}</span>
                  <button disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Record details">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div><p className="font-semibold text-slate-800">{selected.fields.docNumber || 'Record details'}</p><p className="text-xs text-slate-500">Sheet {selected.sheet}, row {selected.sourceRow}</p></div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-1.5 text-sm">
              {selected.raw.map((p, i) => (
                <div key={i} className="flex justify-between gap-4 border-b border-slate-50 pb-1"><span className="text-slate-500">{p.label}</span><span className="text-slate-800 text-right break-all">{p.value}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
