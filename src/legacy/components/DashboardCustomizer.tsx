// @ts-nocheck -- Hisaaboo legacy style
import { useState } from 'react';
import { GripVertical, X } from 'lucide-react';

const KEY = 'hisaaboo_dashboard_cards';

export type CardPref = { id: string; visible: boolean };

export function loadCardPrefs(ids: string[]): CardPref[] {
  let saved: CardPref[] = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { saved = []; }
  if (!Array.isArray(saved)) saved = [];
  const known = saved.filter(p => p && ids.includes(p.id));
  const missing = ids.filter(id => !known.some(p => p.id === id)).map(id => ({ id, visible: true }));
  return [...known, ...missing];
}

export function saveCardPrefs(prefs: CardPref[]) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export function DashboardCustomizer({ prefs, labels, onChange, onClose }: {
  prefs: CardPref[]; labels: Record<string, string>;
  onChange: (p: CardPref[]) => void; onClose: () => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= prefs.length) return;
    const next = [...prefs];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Customize Dashboard">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Customize Dashboard</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <p className="px-5 pt-3 text-xs text-slate-500">Drag to reorder. Use the switch to show or hide a card.</p>
        <ul className="p-5 space-y-2 overflow-y-auto">
          {prefs.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={e => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
              onDrop={e => { e.preventDefault(); if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${dragIdx === i ? 'opacity-50 border-emerald-300' : overIdx === i && dragIdx !== null ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}
            >
              <span className="cursor-grab active:cursor-grabbing text-slate-400" title="Drag to reorder"><GripVertical className="w-5 h-5" /></span>
              <span className={`flex-1 text-sm font-medium ${p.visible ? 'text-slate-800' : 'text-slate-400'}`}>{labels[p.id]}</span>
              <div className="flex flex-col sm:hidden">
                <button className="text-xs px-1 text-slate-500" onClick={() => move(i, i - 1)} aria-label="Move up">▲</button>
                <button className="text-xs px-1 text-slate-500" onClick={() => move(i, i + 1)} aria-label="Move down">▼</button>
              </div>
              <button
                role="switch"
                aria-checked={p.visible}
                aria-label={`Show ${labels[p.id]}`}
                onClick={() => { if (dragIdx !== null) return; onChange(prefs.map(q => q.id === p.id ? { ...q, visible: !q.visible } : q)); }}
                className={`relative w-10 h-6 rounded-full transition-colors ${p.visible ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${p.visible ? 'translate-x-4' : ''}`} />
              </button>
            </li>
          ))}
        </ul>
        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">Done</button>
        </div>
      </div>
    </div>
  );
}
