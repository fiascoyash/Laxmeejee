// @ts-nocheck -- Hisaaboo legacy style
import { useState } from 'react';
import { ScrollText, ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle, ShieldCheck } from 'lucide-react';

export function CreditDebitNotesGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="cdn-guide-content"
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-emerald-50 hover:from-amber-100 hover:to-emerald-100 transition-colors">
        <div className="flex items-center gap-3">
          <ScrollText className="w-5 h-5 text-amber-600" aria-hidden="true" />
          <div className="text-left">
            <span className="font-semibold text-slate-800">📜 Credit Note & Debit Note Kya Hota Hai? (GST Rule 53)</span>
            <p className="text-xs text-slate-500 mt-0.5">Bill ghatana ya badhana ho? 1 minute me samjhiye.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-700 font-medium hidden sm:block">{open ? 'Close' : 'Learn More'}</span>
          {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>
      {open && (
        <div id="cdn-guide-content" className="p-4 border-t border-slate-100 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                <h4 className="font-semibold text-slate-800">Credit Note <span className="text-emerald-700">(क्रेडिट नोट)</span></h4>
              </div>
              <p className="text-sm text-slate-700 italic">"Jab aapko customer se paise kam lene hon ya unka bill ghatana ho."</p>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Kab issue karte hain?</p>
              <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
                <li><b>Sales Return:</b> Customer ne damaged ya unsold maal wapas bhej diya.</li>
                <li><b>Post-Sale Discount:</b> Deal final hone ke baad rate difference ya turnover discount diya.</li>
                <li><b>Overbilling:</b> Invoice me galti se zyada rate ya extra quantity lag gayi thi.</li>
                <li><b>Deficiency in Service:</b> Service me kami hone ke karan customer ko rebate diya.</li>
              </ul>
              <p className="text-xs bg-white rounded-lg p-2 text-emerald-800 border border-emerald-100"><b>Asar:</b> Customer ka ledger balance kam hota hai aur Government ko jama karne wali aapki GST liability (Outward Taxable Value) proportionally ghat jaati hai.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-amber-600" />
                <h4 className="font-semibold text-slate-800">Debit Note <span className="text-amber-700">(डेबिट नोट)</span></h4>
              </div>
              <p className="text-sm text-slate-700 italic">"Jab aapko customer se aur paise lene hon ya unka bill amount badhana ho."</p>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Kab issue karte hain?</p>
              <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
                <li><b>Underbilling:</b> Invoice me galti se rate ya taxable value kam laga di gayi thi.</li>
                <li><b>Extra Charges / Freight:</b> Bill banne ke baad transport charges ya extra items add karne bache the.</li>
              </ul>
              <p className="text-xs bg-white rounded-lg p-2 text-amber-800 border border-amber-100"><b>Asar:</b> Customer ka balance badhta hai aur aapki GST liability bhi proportionally badh jaati hai.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-slate-700" /><h4 className="font-semibold text-slate-800">Golden Rules (Yaad Rakhne Yogya Baatein)</h4></div>
            <ol className="text-sm text-slate-700 space-y-1 list-decimal pl-5">
              <li>Credit/Debit Note me <b>Original Invoice No. aur Date</b> mention hona kanoonan zaruri hai (Rule 53).</li>
              <li><b>Negative invoice</b> banana GST me allowed nahi hai — hamesha Credit Note hi banta hai.</li>
              <li>Financial Year khatam hone ke baad agle saal ke <b>30th November</b> ya Annual Return (GSTR-9) file karne ki date tak hi Credit Note issue kiya ja sakta hai.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
