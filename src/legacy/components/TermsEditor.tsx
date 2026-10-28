// @ts-nocheck -- Hisaaboo legacy style
import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';

const KEY = 'hisaaboo_default_terms';
const BUILTIN = '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.';

export function getDefaultTerms(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v !== null ? v : BUILTIN;
  } catch {
    return BUILTIN;
  }
}

const strip = (s: string) => s.replace(/^\s*\d+[.)]\s*/, '');
const split = (t: string) => (t ? t.split('\n').map(strip) : []);
const join = (items: string[]) => items.map((x, i) => `${i + 1}. ${x}`).join('\n');

export function TermsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [msg, setMsg] = useState('');
  const items = split(value || '');
  const set = (next: string[]) => onChange(join(next));
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000); };

  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <div key={i} className="flex gap-1 items-start">
          <span className="pt-2 text-sm text-gray-500 w-6">{i + 1}.</span>
          <textarea
            value={t}
            rows={1}
            onChange={(e) => { const n = [...items]; n[i] = e.target.value.replace(/\n/g, ' '); set(n); }}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" title="Move up" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); }} className="p-1.5 text-gray-500 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
          <button type="button" title="Move down" disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); }} className="p-1.5 text-gray-500 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
          <button type="button" title="Delete" onClick={() => set(items.filter((_, j) => j !== i))} className="p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" onClick={() => set([...items, ''])} className="inline-flex items-center gap-1 px-2 py-1 text-sm border border-gray-300 rounded-md"><Plus className="w-4 h-4" />Add term</button>
        <button type="button" onClick={() => { localStorage.setItem(KEY, join(items.filter((x) => x.trim()))); flash('Saved as default'); }} className="px-2 py-1 text-sm border border-gray-300 rounded-md">Save as Default</button>
        <button type="button" onClick={() => { onChange(getDefaultTerms()); flash('Default restored'); }} className="px-2 py-1 text-sm border border-gray-300 rounded-md">Restore Default</button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
      </div>
    </div>
  );
}
