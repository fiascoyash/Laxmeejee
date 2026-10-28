// @ts-nocheck -- original Hisaaboo code style, type-checked loosely
import React, { useMemo, useState } from 'react';
import { ArrowLeft, FileDown, FileSpreadsheet, AlertTriangle, Info, CheckCircle2, GitCompare } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildGstr3bReport, reconcilePurchases, USER_FIELDS, TAX_HEADS } from '../../utils/gstr3b';
import { storage } from '../../utils/storage';

const HEAD_LABEL = { taxable: 'Taxable', igst: 'IGST', cgst: 'CGST', sgst: 'SGST/UTGST', cess: 'Cess' };
const ALL_HEADS = ['taxable', 'igst', 'cgst', 'sgst', 'cess'];
const ORIGIN = {
  imported: ['From GSTR-2B', 'bg-blue-100 text-blue-800'],
  user: ['Entered by you', 'bg-slate-100 text-slate-700'],
  calculated: ['Calculated', 'bg-emerald-100 text-emerald-800'],
};
const money = (v) => (v === null || v === undefined ? '' : new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v));

export const Gstr3bPrep: React.FC<{ result: any; onBack: () => void }> = ({ result, onBack }) => {
  const [inputs, setInputs] = useState({});
  const [recon, setRecon] = useState(null);
  const report = useMemo(() => buildGstr3bReport(result, inputs), [result, inputs]);
  const m = result.meta;

  const setVal = (key, head, raw) => {
    setInputs((prev) => {
      const cur = { ...(prev[key] || {}) };
      cur[head] = raw === '' ? null : Number(raw);
      return { ...prev, [key]: cur };
    });
  };
  const markNil = (f) => setInputs((prev) => ({ ...prev, [f.key]: Object.fromEntries(f.heads.map((h) => [h, 0])) }));

  const runRecon = () => {
    let purchases = [];
    try { purchases = storage.getProductPurchases() || []; } catch { purchases = []; }
    setRecon(reconcilePurchases(result, purchases));
  };

  const flatRows = () => report.sections.flatMap((s) => s.rows.map((r) => ({ section: s.title, r })));
  const cell = (r, h) => (!r.heads.includes(h) ? '' : r.values[h] === null ? 'Information required' : r.values[h]);
  const base = `GSTR-3B_Working_${m.gstin || ''}_${(m.taxPeriod || '').replace(/\s+/g, '_')}`;

  const exportXlsx = () => {
    const data = flatRows().map(({ section, r }) => ({
      Section: section, Table: r.table, Description: r.description,
      ...Object.fromEntries(ALL_HEADS.map((h) => [HEAD_LABEL[h], cell(r, h)])),
      Origin: ORIGIN[r.origin][0], Source: r.source, Method: r.method, 'Needs review': r.review || r.missing ? 'Yes' : 'No',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['GSTR-3B Working Report (preparation/review only — not filed with the GST Portal)'],
      [`GSTIN: ${m.gstin || 'Not in file'}`, `Tax period: ${m.taxPeriod || 'Not in file'}`, `FY: ${m.financialYear || 'Not in file'}`, `Source: ${result.fileName}`], [],
    ]);
    XLSX.utils.sheet_add_json(ws, data, { origin: 'A4' });
    XLSX.utils.book_append_sheet(wb, ws, 'GSTR-3B Working');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Warnings'], ...report.warnings.map((w) => [w])]), 'Warnings');
    XLSX.writeFile(wb, `${base}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(15); doc.text('GSTR-3B Working Report', w / 2, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`GSTIN: ${m.gstin || 'Not in file'}   FY: ${m.financialYear || 'Not in file'}   Tax Period: ${m.taxPeriod || 'Not in file'}   Source: ${result.fileName}`, w / 2, 20, { align: 'center' });
    doc.text('Preparation / review report only. Not filed with the GST Portal. Verify all figures before filing. (Rs.)', w / 2, 25, { align: 'center' });
    let y = 30;
    for (const s of report.sections) {
      autoTable(doc, {
        startY: y, head: [[s.title, '', ...ALL_HEADS.map((h) => HEAD_LABEL[h]), 'Origin / Source', 'Review']],
        body: s.rows.map((r) => [r.table, r.description, ...ALL_HEADS.map((h) => { const v = cell(r, h); return typeof v === 'number' ? money(v) : v; }), `${ORIGIN[r.origin][0]} — ${r.source}`, r.missing ? 'Info required' : r.review ? 'Verify' : '']),
        styles: { fontSize: 7 }, headStyles: { fillColor: [16, 185, 129] }, columnStyles: { 1: { cellWidth: 60 }, 7: { cellWidth: 55 } },
      });
      y = doc.lastAutoTable.finalY + 5;
    }
    autoTable(doc, { startY: y, head: [['Warnings']], body: report.warnings.map((x) => [x]), styles: { fontSize: 7 }, headStyles: { fillColor: [217, 119, 6] } });
    doc.save(`${base}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-sm text-emerald-700 flex items-center gap-1 hover:underline"><ArrowLeft className="w-4 h-4" />Back to GSTR-2B analysis</button>
          <h3 className="text-lg font-semibold text-slate-800 mt-1">Prepare GSTR-3B</h3>
          <p className="text-sm text-slate-500">{m.gstin || 'GSTIN not in file'} · {m.taxPeriod || 'Period not in file'} · from {result.fileName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"><FileDown className="w-4 h-4" />Working PDF</button>
          <button onClick={exportXlsx} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><FileSpreadsheet className="w-4 h-4" />Excel</button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>This is a preparation and review report only. It is not filed with the GST Portal. Please verify every figure, especially ITC eligibility, before filing your return.</span>
      </div>

      {/* Guided inputs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h4 className="font-semibold text-slate-800">Step 1 — Information not available in GSTR-2B</h4>
          <p className="text-xs text-slate-500 mt-0.5">Leave a box empty if you don't know it yet; it will show as "Information required". Use "Nil" if nothing applies.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {USER_FIELDS.map((f) => {
            const ref = report.sections.flatMap((s) => s.rows).find((r) => r.key === f.key)?.reference;
            return (
              <div key={f.key} className="p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-medium text-slate-800"><span className="text-emerald-700">{f.table}</span> {f.description}</p>{f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}</div>
                  <button onClick={() => markNil(f)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50">Nil</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {f.heads.map((h) => (
                    <label key={h} className="text-xs text-slate-600">{HEAD_LABEL[h]}
                      <input type="number" step="0.01" inputMode="decimal" value={inputs[f.key]?.[h] ?? ''} onChange={(e) => setVal(f.key, h, e.target.value)} aria-label={`${f.table} ${HEAD_LABEL[h]}`}
                        className="mt-0.5 w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right" placeholder="Required" />
                    </label>
                  ))}
                </div>
                {ref && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2"><Info className="w-3.5 h-3.5 inline mr-1" />Reference — {ref.label}: {TAX_HEADS.map((h) => `${HEAD_LABEL[h]} ${money(ref.values[h] || 0)}`).join(' · ')}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional reconciliation */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h4 className="font-semibold text-slate-800">Optional — compare with your saved purchases</h4><p className="text-xs text-slate-500">Read-only. Nothing in your purchase records is created or changed.</p></div>
          <button onClick={runRecon} className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"><GitCompare className="w-4 h-4" />Compare</button>
        </div>
        {recon && (
          recon.checked === 0 ? <p className="text-sm text-slate-500">No saved purchases with an invoice number were found. You can continue without this step.</p> : (
            <div className="text-sm text-slate-700 space-y-1">
              <p>{recon.checked} saved purchases checked · {recon.matched} found in GSTR-2B · {recon.notIn2b.length} not in GSTR-2B · {recon.notInBooks} GSTR-2B documents not in your purchases{recon.withoutInvoiceNo ? ` · ${recon.withoutInvoiceNo} purchases had no invoice number` : ''}</p>
              {recon.notIn2b.length > 0 && <p className="text-xs text-amber-700">Not in GSTR-2B: {recon.notIn2b.slice(0, 20).map((x) => `${x.invoice} (${x.supplier})`).join(', ')}{recon.notIn2b.length > 20 ? '…' : ''}</p>}
            </div>
          )
        )}
      </div>

      {/* Report */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-800">Step 2 — GSTR-3B working report</h4>
          {report.complete
            ? <span className="text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />All information entered — review flagged rows</span>
            : <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Some information is still required</span>}
        </div>
        <div className="px-4 py-2 flex flex-wrap gap-2 text-[11px]">
          {Object.values(ORIGIN).map(([l, c]) => <span key={l} className={`px-2 py-0.5 rounded ${c}`}>{l}</span>)}
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Verify</span>
        </div>
        {report.sections.map((s) => (
          <div key={s.title} className="overflow-x-auto border-t border-slate-200">
            <p className="px-4 pt-3 text-sm font-medium text-slate-700">{s.title}</p>
            <table className="w-full text-sm mt-2">
              <thead className="bg-slate-50 text-slate-600"><tr>
                <th className="text-left px-3 py-2">Table</th><th className="text-left px-3 py-2">Description / source</th>
                {ALL_HEADS.map((h) => <th key={h} className="text-right px-3 py-2">{HEAD_LABEL[h]}</th>)}
              </tr></thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.key} className={`border-t border-slate-100 align-top ${/Total|4\(C\)/.test(r.table) ? 'bg-slate-50 font-medium' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{r.table}</td>
                    <td className="px-3 py-2 min-w-[260px]">
                      <div className="text-slate-800">{r.description}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${ORIGIN[r.origin][1]}`}>{ORIGIN[r.origin][0]}</span>
                        {(r.review && !r.missing) && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Verify</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Source: {r.source}</div>
                      <div className="text-xs text-slate-400">How: {r.method}</div>
                    </td>
                    {ALL_HEADS.map((h) => (
                      <td key={h} className="px-3 py-2 text-right whitespace-nowrap">
                        {!r.heads.includes(h) ? <span className="text-slate-300">—</span> : r.values[h] === null ? <span className="text-amber-700 text-xs italic">Information required</span> : money(r.values[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
        {report.warnings.map((w) => <p key={w} className="flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{w}</p>)}
      </div>
    </div>
  );
};
