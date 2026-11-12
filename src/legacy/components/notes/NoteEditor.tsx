// @ts-nocheck -- Hisaaboo legacy style
import { useMemo, useState } from 'react';
import { X, Plus, Trash2, Lock, Search, AlertTriangle } from 'lucide-react';
import { NOTE_REASONS, buildNoteFromInvoice, computeNote, validateNote, saveNote, loadNotes, stateLabel, creditNoteDeadline } from '../../utils/creditDebitNotes';
import { generateId, storage } from '../../utils/storage';
import { notify } from '../../utils/notify';

const money = (n) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Create or edit a Credit/Debit Note.
 * props: invoices, companyProfile, noteType, initialInvoice?, existing?, onClose, onSaved
 */
export function NoteEditor({ invoices, companyProfile, noteType: initialType = 'Credit Note', initialInvoice = null, existing = null, onClose, onSaved }) {
  const gstin = companyProfile?.gstNumber || '';
  const finalized = useMemo(() => invoices.filter(i => i.status !== 'Draft'), [invoices]);
  const [note, setNote] = useState(() => existing
    ? computeNote(existing)
    : initialInvoice ? buildNoteFromInvoice(initialInvoice, initialType, gstin, storage.getCustomers?.() || []) : null);
  const [noteType, setNoteType] = useState(existing?.noteType || initialType);
  const [query, setQuery] = useState('');
  const [tried, setTried] = useState(false);

  const invoice = note ? invoices.find(i => i.id === note.originalInvoiceId) : null;
  const check = useMemo(() => (note ? validateNote(note, invoice, gstin, loadNotes()) : { errors: [], itemErrors: {} }), [note, invoice, gstin]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return finalized.filter(i => !q || i.invoiceNumber?.toLowerCase().includes(q) || i.customer?.name?.toLowerCase().includes(q)).slice(0, 30);
  }, [finalized, query]);

  const pick = (inv) => { setNote(buildNoteFromInvoice(inv, noteType, gstin, storage.getCustomers?.() || [])); setTried(false); };
  const update = (patch) => setNote(n => computeNote({ ...n, ...patch }));
  const updateItem = (id, patch) => setNote(n => computeNote({ ...n, items: n.items.map(i => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id) => setNote(n => computeNote({ ...n, items: n.items.filter(i => i.id !== id) }));
  const addExtra = () => setNote(n => computeNote({ ...n, items: [...n.items, { id: generateId(), description: 'Freight / Extra charges', hsn: '9965', unit: 'service', quantity: 1, unitPrice: 0, gstPercent: 18 }] }));

  const switchType = (t) => {
    setNoteType(t);
    if (note && !existing && invoice) setNote(buildNoteFromInvoice(invoice, t, gstin, storage.getCustomers?.() || []));
  };

  const save = () => {
    setTried(true);
    if (check.errors.length) { notify(check.errors[0], 'error'); return; }
    const clean = computeNote({ ...note, items: note.items.filter(i => i.quantity || i.unitPrice) });
    saveNote(clean);
    notify(`${clean.noteType} ${clean.noteNumber} saved successfully`, 'success');
    onSaved?.(clean);
  };

  const deadline = invoice && note?.noteType === 'Credit Note' ? creditNoteDeadline(invoice.date) : '';
  const late = deadline && note?.date > deadline;
  const isCredit = (note?.noteType || noteType) === 'Credit Note';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Note editor">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col">
        <div className={`flex items-center justify-between px-5 py-3 border-b rounded-t-2xl ${isCredit ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <div>
            <h3 className="font-bold text-slate-800">{existing ? 'Edit' : 'Issue'} {isCredit ? 'Credit Note' : 'Debit Note'}</h3>
            <p className="text-xs text-slate-500">Section 34 CGST Act · Rule 53 — original invoice is never changed.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-white"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!existing && (
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
              {['Credit Note', 'Debit Note'].map(t => (
                <button key={t} onClick={() => switchType(t)} className={`px-4 py-1.5 text-sm font-medium ${noteType === t ? (t === 'Credit Note' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white') : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{t}</button>
              ))}
            </div>
          )}

          {!note ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">Original Invoice</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search invoice no. or customer name" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="border border-slate-200 rounded-lg divide-y max-h-80 overflow-y-auto">
                {matches.length === 0 && <p className="p-4 text-sm text-slate-500 text-center">No finalized invoices found.</p>}
                {matches.map(inv => (
                  <button key={inv.id} onClick={() => pick(inv)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between text-sm">
                    <span><b>{inv.invoiceNumber}</b> · {inv.customer?.name} <span className="text-slate-400">· {inv.date}</span></span>
                    <span className="font-medium">{money(inv.grandTotal)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Note No."><input value={note.noteNumber} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono" /></Field>
                <Field label="Note Date"><input type="date" value={note.date} onChange={e => update({ date: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></Field>
                <Field label="Original Invoice No." locked><input value={note.originalInvoiceNumber} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" /></Field>
                <Field label="Original Invoice Date" locked><input value={note.originalInvoiceDate} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" /></Field>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Customer" locked><input value={note.customerName} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" /></Field>
                <Field label="Customer GSTIN" locked><input value={note.customerGstin || 'Unregistered'} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono" /></Field>
                <Field label="Place of Supply" locked><input value={`${stateLabel(note.placeOfSupply)} · ${note.isInterState ? 'IGST' : 'CGST+SGST'}`} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" /></Field>
                <Field label="GST Reason *">
                  <select aria-label="GST Reason" value={note.reason} onChange={e => update({ reason: e.target.value })} className={`w-full border rounded-lg px-2 py-1.5 text-sm ${tried && !note.reason ? 'border-red-500' : 'border-slate-300'}`}>
                    <option value="">Select reason…</option>
                    {NOTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
              {late && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Credit notes for this invoice should be issued by {deadline} (Sec 34(2)). Tax may not be reducible after this date.</p>}

              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr><th className="p-2 text-left">Item</th><th className="p-2">HSN</th><th className="p-2">Qty</th><th className="p-2">Rate (taxable)</th><th className="p-2">GST%</th><th className="p-2 text-right">Taxable</th><th className="p-2 text-right">GST</th><th className="p-2 text-right">Total</th><th /></tr>
                  </thead>
                  <tbody>
                    {note.items.map(i => {
                      const err = tried ? check.itemErrors[i.id] : check.itemErrors[i.id]?.startsWith('Quantity') ? check.itemErrors[i.id] : null;
                      return (
                        <tr key={i.id} className="border-t border-slate-100 align-top">
                          <td className="p-2"><input value={i.description} readOnly={!!i.sourceItemId} onChange={e => updateItem(i.id, { description: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1" />
                            {err && <p role="alert" className="text-xs text-red-600 mt-1">{err}</p>}</td>
                          <td className="p-2 w-24"><input value={i.hsn} readOnly={!!i.sourceItemId} onChange={e => updateItem(i.id, { hsn: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1" /></td>
                          <td className="p-2 w-24"><input aria-label={`Quantity ${i.description}`} type="number" min="0" step="any" value={i.quantity} onChange={e => updateItem(i.id, { quantity: e.target.value })} className={`w-full border rounded px-2 py-1 text-right ${err ? 'border-red-500' : 'border-slate-200'}`} /></td>
                          <td className="p-2 w-28"><input aria-label={`Rate ${i.description}`} type="number" min="0" step="any" value={i.unitPrice} onChange={e => updateItem(i.id, { unitPrice: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1 text-right" /></td>
                          <td className="p-2 w-20"><input type="number" value={i.gstPercent} readOnly={!!i.sourceItemId} onChange={e => updateItem(i.id, { gstPercent: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1 text-right" /></td>
                          <td className="p-2 text-right">{money(i.taxableAmount)}</td>
                          <td className="p-2 text-right">{money(i.cgstAmount + i.sgstAmount + i.igstAmount)}</td>
                          <td className="p-2 text-right font-medium">{money(i.totalAmount)}</td>
                          <td className="p-2"><button onClick={() => removeItem(i.id)} aria-label="Remove line" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!isCredit && <button onClick={addExtra} className="text-sm text-amber-700 flex items-center gap-1 hover:underline"><Plus className="w-4 h-4" />Add extra charge / freight line</button>}

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Remarks"><textarea value={note.remarks || ''} onChange={e => update({ remarks: e.target.value })} rows={3} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></Field>
                <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                  <Row l="Taxable value" v={money(note.subtotal)} />
                  {note.isInterState ? <Row l="IGST" v={money(note.igstTotal)} /> : <><Row l="CGST" v={money(note.cgstTotal)} /><Row l="SGST" v={money(note.sgstTotal)} /></>}
                  <Row l={isCredit ? 'Total credit' : 'Total debit'} v={money(note.grandTotal)} bold />
                </div>
              </div>
              {tried && check.errors.length > 0 && (
                <ul role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 list-disc pl-6 space-y-0.5">{check.errors.map(e => <li key={e}>{e}</li>)}</ul>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          {note && !existing && !initialInvoice && <button onClick={() => setNote(null)} className="mr-auto px-3 py-2 text-sm text-slate-600 hover:underline">Change invoice</button>}
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          {note && <button onClick={save} disabled={tried && check.errors.length > 0} className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${isCredit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}>Save {isCredit ? 'Credit Note' : 'Debit Note'}</button>}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, locked = false, children }) => (
  <label className="block text-xs text-slate-600"><span className="flex items-center gap-1 mb-1">{label}{locked && <Lock className="w-3 h-3 text-slate-400" />}</span>{children}</label>
);
const Row = ({ l, v, bold = false }) => (<div className={`flex justify-between ${bold ? 'font-bold text-slate-900 border-t border-slate-200 pt-1' : 'text-slate-600'}`}><span>{l}</span><span>{v}</span></div>);
