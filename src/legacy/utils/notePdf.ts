// @ts-nocheck -- loosely typed like the rest of src/legacy
// Rule 53 compliant Credit / Debit Note PDF and print layouts (jsPDF + autotable, same engine as the GST PDFs).
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { stateLabel } from './creditDebitNotes';
import { numberToWords, storage } from './storage';
const showBrand = () => { try { return (storage as any).getTemplateSettings?.()?.showHisaabooBranding !== false; } catch { return true; } };

const money = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const dmy = (iso) => { const [y, m, d] = String(iso || '').slice(0, 10).split('-'); return d ? `${d}-${m}-${y}` : ''; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const colorOf = (note) => (note.noteType === 'Credit Note' ? [5, 150, 105] : [217, 119, 6]);

export function buildNotePdf(note, company) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const w = doc.internal.pageSize.getWidth();
  const color = colorOf(note);
  doc.setFillColor(...color);
  doc.rect(0, 0, w, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(note.noteType.toUpperCase(), 14, 14);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Issued under Section 34 of the CGST Act, 2017 read with Rule 53', 14, 19);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(company?.companyName || '', w - 14, 11, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  if (company?.gstNumber) doc.text(`GSTIN: ${company.gstNumber}`, w - 14, 16, { align: 'right' });
  doc.setTextColor(30, 41, 59);

  autoTable(doc, {
    startY: 28, theme: 'grid', styles: { fontSize: 9, cellPadding: 2.5 },
    body: [
      [{ content: `Note No.\n${note.noteNumber}`, styles: { fontStyle: 'bold' } }, { content: `Note Date\n${dmy(note.date)}`, styles: { fontStyle: 'bold' } },
       { content: `Against Original Invoice No.\n${note.originalInvoiceNumber}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
       { content: `Original Invoice Date\n${dmy(note.originalInvoiceDate)}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ],
  });
  let y = doc.lastAutoTable.finalY + 3;
  autoTable(doc, {
    startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2.5 },
    body: [[
      `Issued to:\n${note.customerName}\n${note.customerAddress || ''}\nGSTIN: ${note.customerGstin || 'Unregistered'}`,
      `Place of Supply: ${stateLabel(note.placeOfSupply)}\nSupply type: ${note.isInterState ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}\nReason for issue: ${note.reason}\nSupplier: ${company?.companyName || ''}${company?.address ? `\n${company.address}` : ''}`,
    ]],
  });
  y = doc.lastAutoTable.finalY + 4;
  const inter = note.isInterState;
  const head = ['#', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Taxable', 'GST %', ...(inter ? ['IGST'] : ['CGST', 'SGST']), 'Total'];
  const body = note.items.filter(i => i.quantity || i.unitPrice).map((i, k) => [k + 1, i.description, i.hsn, `${i.quantity} ${i.unit || ''}`, money(i.unitPrice), money(i.taxableAmount), `${i.gstPercent}%`, ...(inter ? [money(i.igstAmount)] : [money(i.cgstAmount), money(i.sgstAmount)]), money(i.totalAmount)]);
  autoTable(doc, {
    startY: y, head: [head], body,
    foot: [['', 'Total', '', '', '', money(note.subtotal), '', ...(inter ? [money(note.igstTotal)] : [money(note.cgstTotal), money(note.sgstTotal)]), money(note.grandTotal)]],
    styles: { fontSize: 8 }, headStyles: { fillColor: color }, footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
    columnStyles: { 1: { cellWidth: 45 } },
  });
  y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(`${note.noteType === 'Credit Note' ? 'Amount credited' : 'Amount debited'}: Rs. ${money(note.grandTotal)}`, 14, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  try { doc.text(`In words: ${numberToWords(Math.round(note.grandTotal))} Only`, 14, y + 5); } catch { /* optional */ }
  if (note.remarks) doc.text(doc.splitTextToSize(`Remarks: ${note.remarks}`, w - 28), 14, y + 11);
  doc.text(`For ${company?.companyName || ''}`, w - 14, y + 22, { align: 'right' });
  doc.text('Authorised Signatory', w - 14, y + 34, { align: 'right' });
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5); doc.setTextColor(120);
  doc.text('Computer-generated document. No signature required.', w / 2, ph - 14, { align: 'center' });
  if (showBrand()) { doc.setFont('helvetica', 'italic'); doc.text('Generated with Hisaaboo - Hisaab rakho. Business badhao.', w / 2, ph - 9, { align: 'center' }); doc.setFont('helvetica', 'normal'); }
  doc.setTextColor(0);
  return doc;
}

export function downloadNotePdf(note, company) {
  buildNotePdf(note, company).save(`${note.noteNumber}.pdf`);
}

export function printNote(note, company) {
  const inter = note.isInterState;
  const accent = note.noteType === 'Credit Note' ? '#059669' : '#d97706';
  const rows = note.items.filter(i => i.quantity || i.unitPrice).map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.description)}</td><td>${esc(i.hsn)}</td><td>${i.quantity} ${esc(i.unit)}</td><td class=r>${money(i.unitPrice)}</td><td class=r>${money(i.taxableAmount)}</td><td>${i.gstPercent}%</td>${inter ? `<td class=r>${money(i.igstAmount)}</td>` : `<td class=r>${money(i.cgstAmount)}</td><td class=r>${money(i.sgstAmount)}</td>`}<td class=r>${money(i.totalAmount)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><title>${esc(note.noteNumber)}</title><style>
body{font-family:Arial,sans-serif;color:#1e293b;margin:24px;font-size:12px}.ban{background:${accent};color:#fff;padding:14px 18px;display:flex;justify-content:space-between;border-radius:6px}
.ban h1{margin:0;font-size:26px;letter-spacing:2px}.grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #cbd5e1;margin-top:12px}.grid div{padding:8px;border-right:1px solid #cbd5e1}.grid b{display:block;font-size:14px}
.ref{background:#f1f5f9}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:${accent};color:#fff;text-align:left}td,th{border:1px solid #cbd5e1;padding:5px}.r{text-align:right}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.two div{border:1px solid #cbd5e1;padding:8px}
tfoot td{font-weight:bold;background:#f1f5f9}@media print{body{margin:10mm}}</style></head><body>
<div class=ban><div><h1>${note.noteType.toUpperCase()}</h1><div>Issued under Section 34 of the CGST Act, 2017 read with Rule 53</div></div><div style="text-align:right"><b>${esc(company?.companyName)}</b><br>${company?.gstNumber ? `GSTIN: ${esc(company.gstNumber)}` : ''}</div></div>
<div class=grid><div>Note No.<b>${esc(note.noteNumber)}</b></div><div>Note Date<b>${dmy(note.date)}</b></div><div class=ref>Against Original Invoice No.<b>${esc(note.originalInvoiceNumber)}</b></div><div class=ref>Original Invoice Date<b>${dmy(note.originalInvoiceDate)}</b></div></div>
<div class=two><div><b>Issued to</b><br>${esc(note.customerName)}<br>${esc(note.customerAddress)}<br>GSTIN: ${esc(note.customerGstin || 'Unregistered')}</div><div>Place of Supply: <b>${esc(stateLabel(note.placeOfSupply))}</b><br>Supply type: ${inter ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}<br>Reason for issue: <b>${esc(note.reason)}</b></div></div>
<table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>GST</th>${inter ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>'}<th>Total</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan=5>Total</td><td class=r>${money(note.subtotal)}</td><td></td>${inter ? `<td class=r>${money(note.igstTotal)}</td>` : `<td class=r>${money(note.cgstTotal)}</td><td class=r>${money(note.sgstTotal)}</td>`}<td class=r>${money(note.grandTotal)}</td></tr></tfoot></table>
${note.remarks ? `<p>Remarks: ${esc(note.remarks)}</p>` : ''}<p style="text-align:right;margin-top:40px">For ${esc(company?.companyName)}<br><br><br>Authorised Signatory</p>
<p style="text-align:center;font-size:11px;color:#777;margin-top:30px">Computer-generated document. No signature required.${showBrand() ? '<br><i>Generated with Hisaaboo \u2014 Hisaab rakho. Business badhao.</i>' : ''}</p>
<script>window.onload=()=>{window.print()}</script></body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html); win.document.close();
  return true;
}
