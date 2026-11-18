import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Search, Package, Store, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { suggestDirectory } from '@/lib/discovery.functions';
import type { Suggestion } from '@/lib/discovery';

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const GROUPS = [
  { kind: 'product', title: 'Products', Icon: Package },
  { kind: 'shop', title: 'Shops', Icon: Store },
  { kind: 'category', title: 'Services & categories', Icon: Tag },
] as const;

export function SearchAutocomplete({ initial, city, onSearch }: { initial: string; city: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggest = useServerFn(suggestDirectory);
  const navigate = useNavigate();
  const listId = useId();
  const reqId = useRef(0);

  useEffect(() => setValue(initial), [initial]);
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setItems([]); return; }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      suggest({ data: { q, city } }).then(res => { if (id === reqId.current) { setItems(res); setActive(-1); } }).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [value, city, suggest]);

  // Flattened in display order for keyboard navigation.
  const ordered = GROUPS.flatMap(g => items.filter(i => i.kind === g.kind));

  function choose(s: Suggestion) {
    setOpen(false);
    if (s.kind === 'shop') { void navigate({ to: '/shop/$slug', params: { slug: s.slug } }); return; }
    setValue(s.label); onSearch(s.label);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !ordered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % ordered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? ordered.length : i) - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(ordered[active]!); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const showList = open && value.trim().length >= 2 && ordered.length > 0;
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); setOpen(false); onSearch(value.trim()); }}>
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-3.5 size-5 text-muted-foreground" aria-hidden="true" />
        <Input name="q" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search shops, products or services" value={value} maxLength={100}
          placeholder="Find local shops, products or services" className="h-12 bg-background pl-10"
          onChange={e => { setValue(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKeyDown} />
        {showList && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border bg-popover p-1 text-left text-popover-foreground shadow-lg">
            {GROUPS.map(({ kind, title, Icon }) => {
              const group = ordered.map((s, i) => [s, i] as const).filter(([s]) => s.kind === kind);
              if (!group.length) return null;
              return <li key={kind} role="presentation">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                <ul role="presentation">{group.map(([s, i]) => (
                  <li key={i} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={e => { e.preventDefault(); choose(s); }} onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${i === active ? 'bg-stock-action/10 text-foreground' : ''}`}>
                    <Icon className="size-4 shrink-0 text-stock-action" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.kind === 'product' ? `${s.shops} ${s.shops === 1 ? 'shop' : 'shops'} · from ${inr(s.minPrice)}`
                        : s.kind === 'shop' ? [s.category, s.locality || s.city].filter(Boolean).join(' · ')
                        : `${s.shops} ${s.shops === 1 ? 'shop' : 'shops'}`}
                    </span>
                  </li>))}</ul>
              </li>;
            })}
          </ul>
        )}
      </div>
      <Button type="submit" className="h-12 bg-stock-action text-stock-action-foreground hover:bg-stock-action/90"><Search aria-hidden="true" />Search</Button>
    </form>
  );
}
