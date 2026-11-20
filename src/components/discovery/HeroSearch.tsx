import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Store, Tag, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { popularCategories, suggest, type Suggestion } from '@/lib/localSearch';
import type { DirectoryShop } from '@/lib/discovery';

/** Landing-page search box with live suggestions and quick category chips. */
export function HeroSearch({ shops, query, onSearch, onOpenShop, locationSlot }: {
  shops: DirectoryShop[] | undefined;
  query: string;
  onSearch: (q: string) => void;
  onOpenShop: (slug: string) => void;
  locationSlot: React.ReactNode;
}) {
  const [draft, setDraft] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => setDraft(query), [query]);

  const typed = useDeferredValue(draft);
  const suggestions = useMemo(() => (shops && typed.trim() ? suggest(shops, typed) : []), [shops, typed]);
  const options: ({ type: 'query'; label: string; detail: string } | Suggestion)[] = draft.trim()
    ? [{ type: 'query', label: draft.trim(), detail: 'Search everything' }, ...suggestions]
    : [];
  const chips = useMemo(() => (shops ? popularCategories(shops, 8) : null), [shops]);
  const showList = open && options.length > 0;

  function commit(q: string) {
    setOpen(false); setActive(-1); setDraft(q);
    input.current?.blur(); // closes the mobile keyboard before results are revealed
    onSearch(q.trim());
  }
  function choose(option: (typeof options)[number]) {
    if (option.type === 'store') { setOpen(false); onOpenShop(option.slug); return; }
    commit(option.label);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); setOpen(true); setActive(i => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); setActive(i => (i <= 0 ? options.length - 1 : i - 1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
    else if (e.key === 'Enter' && showList && active > 0) { e.preventDefault(); const o = options[active]; if (o) choose(o); }
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-8 items-center">{locationSlot}</div>
      <form role="search" className="flex scroll-mt-24 gap-2" onSubmit={e => { e.preventDefault(); commit(draft); }}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={input}
            name="q"
            role="combobox"
            aria-label="Search shops or products"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            value={draft}
            onChange={e => { setDraft(e.target.value); setOpen(true); setActive(-1); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Search products, shops or services"
            maxLength={100}
            className="h-12 bg-background pl-10 pr-10"
          />
          {draft && <button type="button" aria-label="Clear search" onMouseDown={e => e.preventDefault()} onClick={() => { setDraft(''); setOpen(false); if (query) onSearch(''); input.current?.focus(); }} className="absolute right-2 top-2.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>}
          {showList && (
            <ul id={listId} role="listbox" aria-label="Search suggestions" className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-80 overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl">
              {options.map((o, i) => {
                const Icon = o.type === 'store' ? Store : o.type === 'category' ? Tag : o.type === 'product' ? Package : Search;
                return (
                  <li key={`${o.type}-${o.label}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={e => e.preventDefault()} onClick={() => choose(o)} onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${i === active ? 'bg-muted' : ''}`}>
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{o.type === 'query' ? <>Search for “<strong>{o.label}</strong>”</> : o.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{o.detail}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Button type="submit" aria-label="Search" className="h-12 shrink-0 bg-stock-action px-4 text-stock-action-foreground hover:bg-stock-action/90"><Search aria-hidden="true" /><span className="hidden sm:inline">Search</span></Button>
      </form>
      <div className="flex h-8 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Popular categories">
        {chips === null
          ? [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full" />)
          : chips.map(c => (
            <button key={c} type="button" onClick={() => commit(c)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${query.toLowerCase() === c.toLowerCase() ? 'border-stock-action bg-stock-action text-stock-action-foreground' : 'bg-background text-foreground hover:border-stock-action hover:text-stock-action'}`}>{c}</button>
          ))}
      </div>
    </div>
  );
}
