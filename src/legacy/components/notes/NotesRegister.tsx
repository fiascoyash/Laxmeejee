// @ts-nocheck -- Hisaaboo legacy style
import { useMemo, useState } from 'react';
import { Plus, Search, Eye, FileDown, Pencil, Trash2, Printer, ArrowDownCircle, ArrowUpCircle, Scale, X } from 'lucide-react';
import { useNotes, deleteNote, stateLabel } from '../../utils/creditDebitNotes';
import { downloadNotePdf, printNote } from '../../utils/notePdf';
import { NoteEditor } from './NoteEditor';
import { notify } from '../../utils/notify';

const money = (n) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function NotesRegister({ invoices, companyProfile }) {
  const notes = useNotes();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null); // {existing?}
  const [preview, setPreview] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const kpi = useMemo(() => {
    const cn = notes.filter(n => n.noteType === 'Credit Note');
    const dn = notes.filter(n => n.noteType === 'Debit Note');
    const s = (a, k) => a.reduce((t, n) => t + (n[k] || 0), 0);
    return { cnCount: cn.length, cnVal: s(cn, 'grandTotal'), cnGst: s(cn, 'totalGst'), dnCount: dn.length, dnVal: s(dn, 'grandTotal'), dnGst: s(dn, 'totalGst'), net: s(dn, 'subtotal') - s(cn, 'subtotal') };
  }, [notes]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter(n => filter === 'all' || (filter === 'credit' ? n.noteType === 'Credit Note' : n.noteType === 'Debit Note'))
      .filter(n => !q || [n.noteNumber, n.originalInvoiceNumber, n.customerName].some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.noteNumber).localeCompare(String(a.noteNumber)));
  }, [notes, filter, search]);

  const doPrint = (n) => { if (!printNote(n, companyProfile)) notify('Allow pop-ups to print this note', 'warning'); };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Credit / Debit Notes</h2>
          <p className="text-sm text-gray-500">Sales returns, discounts and extra charges against your invoices (Rule 53).</p>
        </div>
        <button onClick={() => setEditor({})} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />New Note</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Kpi icon={ArrowDownCircle} tone="emerald" title="Credit Notes Issued" value={money(kpi.cnVal)} sub={`${kpi.cnCount} notes · GST adjusted ${money(kpi.cnGst)}`} />
        <Kpi icon={ArrowUpCircle} tone="amber" title="Debit Notes Issued" value={money(kpi.dnVal)} sub={`${kpi.dnCount} notes · GST added ${money(kpi.dnGst)}`} />
        <Kpi icon={Scale} tone="slate" title="Net Adjustment on Sales" value={(kpi.net < 0 ? '− ' : '+ ') + money(Math.abs(kpi.net))} sub="Taxable value (debit − credit)" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
          {[['all', 'All'], ['credit', 'Credit Notes'], ['debit', 'Debit Notes']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 ${filter === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{l}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search note no., original invoice or customer" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No notes yet. Use “New Note”, or “Issue Credit Note” on any invoice in Invoice History.</p>
        ) : (
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="p-3 text-left">Note</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Against Invoice</th><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Reason</th><th className="p-3 text-right">Amount</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map(n => (
                <tr key={n.id} className="border-t border-slate-100">
                  <td className="p-3"><Badge type={n.noteType} /> <span className="font-mono font-medium ml-1">{n.noteNumber}</span></td>
                  <td className="p-3">{n.date}</td>
                  <td className="p-3">{n.originalInvoiceNumber} <span className="text-xs text-slate-400">({n.originalInvoiceDate})</span></td>
                  <td className="p-3">{n.customerName}</td>
                  <td className="p-3 text-xs">{n.reason}</td>
                  <td className="p-3 text-right font-semibold">{money(n.grandTotal)}</td>
                  <td className="p-3"><div className="flex justify-end gap-1">
                    <Act icon={Eye} label="View" onClick={() => setPreview(n)} />
                    <Act icon={Printer} label="Print" onClick={() => doPrint(n)} />
                    <Act icon={FileDown} label="Download PDF" onClick={() => downloadNotePdf(n, companyProfile)} />
                    <Act icon={Pencil} label="Edit" onClick={() => setEditor({ existing: n })} />
                    <Act icon={Trash2} label="Delete" danger onClick={() => setConfirmDel(n)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editor && <NoteEditor invoices={invoices} companyProfile={companyProfile} existing={editor.existing} onClose={() => setEditor(null)} onSaved={() => setEditor(null)} />}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-semibold text-slate-800">Delete {confirmDel.noteNumber}?</h3>
            <p className="text-sm text-slate-600">This removes the note from your register, GST reports and customer khata. The original invoice is not affected.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button onClick={() => { deleteNote(confirmDel.id); notify(`${confirmDel.noteNumber} deleted`, 'success'); setConfirmDel(null); }} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {preview && <NotePreview note={preview} company={companyProfile} onClose={() => setPreview(null)} onPrint={() => doPrint(preview)} onPdf={() => downloadNotePdf(preview, companyProfile)} />}
    </div>
  );
}

export function NotePreview({ note, company, onClose, onPrint, onPdf }) {
  const credit = note.noteType === 'Credit Note';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Note preview">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className={`px-5 py-4 flex justify-between items-start ${credit ? 'bg-emerald-600' : 'bg-amber-500'} text-white`}>
          <div><h3 className="text-2xl font-bold tracking-widest">{note.noteType.toUpperCase()}</h3><p className="text-xs opacity-90">Section 34 CGST Act · Rule 53</p></div>
          <div className="text-right text-sm"><b>{company?.companyName}</b>{company?.gstNumber && <p className="text-xs">GSTIN: {company.gstNumber}</p>}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-lg divide-x divide-slate-200">
            <Cell l="Note No." v={note.noteNumber} /><Cell l="Note Date" v={note.date} />
            <Cell l="Original Invoice No." v={note.originalInvoiceNumber} hl /><Cell l="Original Invoice Date" v={note.originalInvoiceDate} hl />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Issued to</p><p className="font-semibold">{note.customerName}</p><p className="text-xs">{note.customerAddress}</p><p className="text-xs font-mono">GSTIN: {note.customerGstin || 'Unregistered'}</p></div>
            <div className="border border-slate-200 rounded-lg p-3 text-xs space-y-1"><p>Place of Supply: <b>{stateLabel(note.placeOfSupply)}</b></p><p>{note.isInterState ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}</p><p>Reason: <b>{note.reason}</b></p></div>
          </div>
          <table className="w-full text-xs border border-slate-200">
            <thead className="bg-slate-50"><tr><th className="p-2 text-left">Item</th><th className="p-2">HSN</th><th className="p-2">Qty</th><th className="p-2 text-right">Taxable</th>{note.isInterState ? <th className="p-2 text-right">IGST</th> : <><th className="p-2 text-right">CGST</th><th className="p-2 text-right">SGST</th></>}<th className="p-2 text-right">Total</th></tr></thead>
            <tbody>{note.items.map(i => (<tr key={i.id} className="border-t border-slate-100"><td className="p-2">{i.description}</td><td className="p-2 text-center">{i.hsn}</td><td className="p-2 text-center">{i.quantity} {i.unit}</td><td className="p-2 text-right">{money(i.taxableAmount)}</td>{note.isInterState ? <td className="p-2 text-right">{money(i.igstAmount)}</td> : <><td className="p-2 text-right">{money(i.cgstAmount)}</td><td className="p-2 text-right">{money(i.sgstAmount)}</td></>}<td className="p-2 text-right">{money(i.totalAmount)}</td></tr>))}</tbody>
            <tfoot className="bg-slate-50 font-semibold"><tr><td className="p-2" colSpan={3}>Total</td><td className="p-2 text-right">{money(note.subtotal)}</td>{note.isInterState ? <td className="p-2 text-right">{money(note.igstTotal)}</td> : <><td className="p-2 text-right">{money(note.cgstTotal)}</td><td className="p-2 text-right">{money(note.sgstTotal)}</td></>}<td className="p-2 text-right">{money(note.grandTotal)}</td></tr></tfoot>
          </table>
          {note.remarks && <p className="text-xs text-slate-600">Remarks: {note.remarks}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-2 text-sm border border-slate-300 rounded-lg mr-auto flex items-center gap-1"><X className="w-4 h-4" />Close</button>
          <button onClick={onPrint} className="px-3 py-2 text-sm border border-slate-300 rounded-lg flex items-center gap-1"><Printer className="w-4 h-4" />Print</button>
          <button onClick={onPdf} className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg flex items-center gap-1"><FileDown className="w-4 h-4" />Download PDF</button>
        </div>
      </div>
    </div>
  );
}

const Badge = ({ type }) => (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${type === 'Credit Note' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{type === 'Credit Note' ? 'CN' : 'DN'}</span>);
const Act = ({ icon: Icon, label, onClick, danger = false }) => (<button onClick={onClick} title={label} aria-label={label} className={`p-1.5 rounded text-slate-500 ${danger ? 'hover:text-red-600 hover:bg-red-50' : 'hover:text-blue-600 hover:bg-blue-50'}`}><Icon className="w-4 h-4" /></button>);
const Cell = ({ l, v, hl = false }) => (<div className={`p-2 ${hl ? 'bg-slate-50' : ''}`}><p className="text-[11px] text-slate-500">{l}</p><p className="font-bold">{v}</p></div>);
const TONES = { emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700' };
const Kpi = ({ icon: Icon, tone, title, value, sub }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TONES[tone]}`}><Icon className="w-5 h-5" /></div>
    <div><p className="text-xs text-slate-500">{title}</p><p className="text-lg font-bold text-slate-800">{value}</p><p className="text-[11px] text-slate-500">{sub}</p></div>
  </div>
);
