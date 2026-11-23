import { useState } from "react";
import { suggest } from "@/lib/shopAddress";

export function SuggestInput({ id, value, onChange, options, placeholder, className }: {
  id?: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = suggest(options, value);
  const show = open && items.length > 0;
  return (
    <div className="relative">
      <input id={id} className={className} value={value} placeholder={placeholder} autoComplete="off" role="combobox"
        aria-expanded={show} aria-autocomplete="list"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); onChange(items[active] ?? value); setOpen(false); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {show && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-lg">
          {items.map((it, i) => (
            <li key={it} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(it); setOpen(false); }}
                className={`block w-full px-3 py-1.5 text-left hover:bg-accent ${i === active ? "bg-accent" : ""}`}>{it}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
