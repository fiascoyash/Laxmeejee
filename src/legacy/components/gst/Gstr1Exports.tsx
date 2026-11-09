// @ts-nocheck -- Hisaaboo legacy style
// "Export GSTR-1 JSON" and "Export Invoice PDFs" actions for the GSTR-1 report. Read-only on invoices.
import React, { useMemo, useState } from 'react';
import { FileJson, FileArchive, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { buildGstr1Json, periodFromFy, MONTHS } from '../../utils/gstr1Json';
import { storage } from '../../utils/storage';
import { exportTemplatePDF } from '../../utils/templatePdfExport';
import { formatCurrency, formatDate } from '../../utils/gstReports';

const NOTICE = 'This file is prepared for GSTR-1 upload/review. Downloading it does not file or submit your GST return. Review the data and upload it through the applicable GST Portal workflow.';

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const safeFileName = (s: string) => (String(s || 'invoice').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice');

/** Invoices in [start, end] (inclusive, by invoice date), split into included / excluded (drafts), de-duplicated by id. */
export function selectInvoicesForPdf(invoices, start: string, end: string) {
  const seen = new Set();
  const inRange = invoices.filter(i => {
    const d = String(i.date || '').slice(0, 10);
    if (d < start || d > end || seen.has(i.id)) return false;
    seen.add(i.id); return true;
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { included: inRange.filter(i => i.status !== 'Draft'), excluded: inRange.filter(i => i.status === 'Draft') };
}

const currentFy = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };
const FY_MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
      </div>
      <div className="p-5 space-y-4 text-sm">{children}</div>
    </div>
  </div>
);

function JsonExport({ invoices, companyProfile, onClose }) {
  const fys = useMemo(() => {
    const set = new Set([currentFy()]);
    invoices.forEach(i => { const d = new Date(i.date); if (!isNaN(d)) { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; set.add(`${y}-${String(y + 1).slice(2)}`); } });
    return [...set].sort().reverse();
  }, [invoices]);
  const [fy, setFy] = useState(fys[0]);
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [done, setDone] = useState(false);
  const { year, month } = periodFromFy(fy, monthIdx);
  const res = useMemo(() => buildGstr1Json(invoices, companyProfile?.gstNumber || '', year, month), [invoices, companyProfile, year, month]);
  const fileName = `Hisaaboo_GSTR1_FY${fy}_${MONTHS[monthIdx]}.json`;
  const canExport = !res.companyBlocked && res.included.length > 0;

  const doExport = () => {
    download(new Blob([JSON.stringify(res.json, null, 2)], { type: 'application/json' }), fileName);
    setDone(true);
  };

  return (
    <Modal title="Export GSTR-1 JSON" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-xs text-slate-600">Financial Year</span>
          <select value={fy} onChange={e => { setFy(e.target.value); setDone(false); }} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2">
            {fys.map(f => <option key={f} value={f}>FY {f}</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-600">Tax Period</span>
          <select value={monthIdx} onChange={e => { setMonthIdx(Number(e.target.value)); setDone(false); }} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2">
            {FY_MONTH_ORDER.map(m => { const p = periodFromFy(fy, m); return <option key={m} value={m}>{MONTHS[m]} {p.year}</option>; })}
          </select></label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        {[['Records found', res.total], ['Valid', res.included.length], ['Need correction', res.excluded.length], ['Blocking errors', res.blocking.length], ['Warnings', res.warnings.length]].map(([l, v]) => (
          <div key={l} className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold text-slate-800">{v}</div><div className="text-[11px] text-slate-500">{l}</div></div>
        ))}
      </div>

      {res.blocking.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-3">
          <p className="font-medium text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Must be corrected {res.companyBlocked ? '' : '(these invoices will NOT be in the file)'}</p>
          <ul className="mt-2 space-y-1 text-red-700 text-xs">{res.blocking.map((i, k) => <li key={k}><b>{i.invoiceNo}</b>{i.date ? ` (${formatDate(i.date)})` : ''}: {i.message}</li>)}</ul>
        </div>
      )}
      {res.warnings.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <p className="font-medium text-amber-800">Please review</p>
          <ul className="mt-2 space-y-1 text-amber-700 text-xs">{res.warnings.map((i, k) => <li key={k}><b>{i.invoiceNo}</b>: {i.message}</li>)}</ul>
        </div>
      )}
      {res.total === 0 && <p className="text-slate-500">No invoices found for {MONTHS[monthIdx]} {year}.</p>}

      {done && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-emerald-800">
          <p className="font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {fileName} downloaded</p>
          <p className="text-xs mt-1">{MONTHS[monthIdx]} {year}: {res.included.length} invoice(s) included{res.excluded.length ? `, ${res.excluded.length} excluded for errors` : ''}{res.drafts.length ? `, ${res.drafts.length} draft(s) skipped` : ''}.</p>
        </div>
      )}
      <p className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-3">{NOTICE}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Close</button>
        <button onClick={doExport} disabled={!canExport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {res.excluded.length && canExport ? 'Download valid invoices only' : 'Download JSON'}
        </button>
      </div>
    </Modal>
  );
}

async function invoiceToPdfBlob(inv, companyProfile) {
  const template = (inv.selectedTemplateId && storage.getTemplateById(inv.selectedTemplateId)) || storage.getDefaultTemplate();
  if (!template) throw new Error('No template available');
  const t = inv.productColumns ? { ...template, productColumns: inv.productColumns } : template;
  const q = {
    id: inv.id, quotationNumber: inv.invoiceNumber, date: inv.date, customer: inv.customer, shipTo: inv.shipTo,
    products: inv.products, totalAmount: inv.totalAmount, totalCgst: inv.totalCgst, totalSgst: inv.totalSgst,
    grandTotal: inv.grandTotal, createdAt: inv.createdAt, selectedTemplateId: inv.selectedTemplateId, gstMode: inv.gstMode,
    notes: inv.notes, signature: inv.signature, paymentQr: inv.paymentQr, terms: inv.terms,
  };
  return exportTemplatePDF(t, companyProfile, inv.customer, q, inv.products, 'invoice', inv, inv.gstMode || 'inclusive', { returnBlob: true });
}

function PdfExport({ invoices, companyProfile, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today.slice(0, 8) + '01');
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end);
  const err = !valid ? 'Please choose both dates.' : start > end ? 'Start Date cannot be later than End Date.' : '';
  const sel = useMemo(() => (err ? { included: [], excluded: [] } : selectInvoicesForPdf(invoices, start, end)), [invoices, start, end, err]);
  const total = sel.included.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);

  const run = async () => {
    if (busy || !sel.included.length) return;
    setBusy(true); setResult(null); setProgress(0);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const used = new Set();
      const failed = [];
      const ok = [];
      for (let k = 0; k < sel.included.length; k++) {
        const inv = sel.included[k];
        try {
          const blob = await invoiceToPdfBlob(inv, companyProfile);
          let name = safeFileName(inv.invoiceNumber); let n = name; let c = 2;
          while (used.has(n.toLowerCase())) n = `${name}_${c++}`;
          used.add(n.toLowerCase());
          zip.file(`${n}.pdf`, blob);
          ok.push(inv);
        } catch (e) { failed.push({ inv, msg: e?.message || 'Unknown error' }); }
        setProgress(k + 1);
        await new Promise(r => setTimeout(r, 0));
      }
      if (ok.length) {
        const index = ['Invoice Number,Date,Customer,Total', ...ok.map(i => `"${i.invoiceNumber}",${i.date?.slice(0, 10)},"${(i.customer?.name || '').replace(/"/g, '""')}",${i.grandTotal}`)].join('\n');
        zip.file('index.csv', index);
        download(await zip.generateAsync({ type: 'blob' }), `Hisaaboo_Invoices_${start}_to_${end}.zip`);
      }
      setResult({ ok: ok.length, failed });
    } catch (e) {
      setResult({ ok: 0, failed: [{ inv: { invoiceNumber: '—' }, msg: e?.message || 'Could not create the ZIP file' }] });
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Export Invoice PDFs" onClose={busy ? () => {} : onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-xs text-slate-600">Start Date</span>
          <input type="date" value={start} onChange={e => { setStart(e.target.value); setResult(null); }} disabled={busy} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2" /></label>
        <label className="block"><span className="text-xs text-slate-600">End Date</span>
          <input type="date" value={end} onChange={e => { setEnd(e.target.value); setResult(null); }} disabled={busy} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2" /></label>
      </div>
      {err ? <p className="text-red-600 text-xs" role="alert">{err}</p> : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold">{sel.included.length}</div><div className="text-[11px] text-slate-500">Invoices to export</div></div>
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold">{sel.excluded.length}</div><div className="text-[11px] text-slate-500">Drafts excluded</div></div>
            <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-semibold">{formatCurrency(total)}</div><div className="text-[11px] text-slate-500">Total value</div></div>
          </div>
          {sel.included.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No saved invoices between {formatDate(start)} and {formatDate(end)}. Try a different date range.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              <table className="w-full text-xs"><tbody>
                {sel.included.map(i => <tr key={i.id} className="border-b border-slate-100"><td className="px-3 py-1.5 font-medium">{i.invoiceNumber}</td><td className="px-3 py-1.5">{formatDate(i.date)}</td><td className="px-3 py-1.5 text-right">{formatCurrency(i.grandTotal)}</td></tr>)}
                {sel.excluded.map(i => <tr key={i.id} className="border-b border-slate-100 text-slate-400"><td className="px-3 py-1.5">{i.invoiceNumber}</td><td className="px-3 py-1.5">{formatDate(i.date)}</td><td className="px-3 py-1.5 text-right">Draft — excluded</td></tr>)}
              </tbody></table>
            </div>
          )}
        </>
      )}
      {busy && <p className="flex items-center gap-2 text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Creating PDFs… {progress} of {sel.included.length}</p>}
      {result && (
        <div className={`rounded-lg p-3 border ${result.failed.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          <p className="font-medium">{result.ok ? `${result.ok} invoice PDF(s) downloaded in a ZIP file.` : 'No file was downloaded.'}</p>
          {result.failed.length > 0 && <ul className="text-xs mt-1">{result.failed.map((f, k) => <li key={k}>Could not create {f.inv.invoiceNumber}: {f.msg}</li>)}</ul>}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50">Close</button>
        <button onClick={run} disabled={busy || !!err || !sel.included.length} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? 'Exporting…' : 'Download ZIP'}
        </button>
      </div>
    </Modal>
  );
}

export function Gstr1Exports({ invoices, companyProfile }) {
  const [open, setOpen] = useState<'' | 'json' | 'pdf'>('');
  return (
    <>
      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={() => setOpen('json')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"><FileJson className="w-4 h-4" /> Export GSTR-1 JSON</button>
        <button onClick={() => setOpen('pdf')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"><FileArchive className="w-4 h-4" /> Export Invoice PDFs</button>
      </div>
      {open === 'json' && <JsonExport invoices={invoices} companyProfile={companyProfile} onClose={() => setOpen('')} />}
      {open === 'pdf' && <PdfExport invoices={invoices} companyProfile={companyProfile} onClose={() => setOpen('')} />}
    </>
  );
}
