// @ts-nocheck -- legacy Hisaaboo UI helpers
import { useRef, useState, useCallback } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Pointer-based drag reordering (mouse + touch). Only the grip handle starts a drag,
 * so typing inside row inputs never moves rows. Rows must carry data-reorder-index.
 */
export function useRowDrag(onMove: (from: number, to: number) => void) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const computeDrop = (clientY: number) => {
    const rows = Array.from(containerRef.current?.querySelectorAll('[data-reorder-index]') || []);
    let idx = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { idx = i; break; }
    }
    return idx; // insertion slot 0..n
  };

  const handleProps = useCallback((index: number) => ({
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragIndex(index);
      setDropIndex(index);
    },
    onPointerMove: (e) => {
      if (dragIndex === null) return;
      setDropIndex(computeDrop(e.clientY));
      const y = e.clientY;
      if (y < 60) window.scrollBy(0, -12);
      else if (y > window.innerHeight - 60) window.scrollBy(0, 12);
    },
    onPointerUp: () => {
      if (dragIndex !== null && dropIndex !== null) {
        const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
        if (to !== dragIndex) onMove(dragIndex, to);
      }
      setDragIndex(null);
      setDropIndex(null);
    },
    onPointerCancel: () => { setDragIndex(null); setDropIndex(null); },
    style: { touchAction: 'none' },
  }), [dragIndex, dropIndex, onMove]);

  /** 'before' | 'after' | null — where to draw the drop line for a row. */
  const indicatorFor = (index: number, total: number) => {
    if (dragIndex === null || dropIndex === null) return null;
    if (dropIndex === dragIndex || dropIndex === dragIndex + 1) return null;
    if (dropIndex === index) return 'before';
    if (index === total - 1 && dropIndex === total) return 'after';
    return null;
  };

  return { containerRef, dragIndex, handleProps, indicatorFor };
}

export function DragHandle(props) {
  return (
    <span
      {...props}
      role="button"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing select-none p-1 rounded"
    >
      <GripVertical className="w-4 h-4" />
    </span>
  );
}

export function MoveButtons({ index, total, onMove, large = false }) {
  const size = large ? 'w-5 h-5' : 'w-3.5 h-3.5';
  const btn = `text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded ${large ? 'p-2 min-h-[44px] min-w-[36px] flex items-center justify-center' : 'p-0.5'}`;
  return (
    <span className={`inline-flex ${large ? 'flex-row' : 'flex-col'} items-center`}>
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Move up" title="Move up">
        <ChevronUp className={size} />
      </button>
      <button type="button" className={btn} disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label="Move down" title="Move down">
        <ChevronDown className={size} />
      </button>
    </span>
  );
}

/** Clickable serial number; click to type a new position (Enter/blur applies, Esc cancels). */
export function SerialJump({ index, total, onMove, prefix = '' }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const apply = () => {
    const n = parseInt(value, 10);
    setEditing(false);
    if (!Number.isNaN(n)) onMove(index, Math.max(1, Math.min(total, n)) - 1);
  };
  if (editing) {
    return (
      <input
        type="number"
        min={1}
        max={total}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); apply(); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(false); }
        }}
        className="w-12 px-1 py-0.5 border border-emerald-500 rounded text-center text-sm"
        aria-label="Move to position"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setValue(String(index + 1)); setEditing(true); }}
      className="px-1 rounded hover:bg-slate-200 hover:text-slate-800 underline decoration-dotted underline-offset-2"
      title="Click to move this row to another position"
    >
      {prefix}{index + 1}
    </button>
  );
}
