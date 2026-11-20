import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { MapPin, Store, ArrowRight, Clock, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { directoryOptions, filterDirectory, normalizeDiscovery, type DiscoveryFilters, type DirectoryShop } from '@/lib/discovery';
import { directoryIndexQuery } from '@/lib/discovery.queries';
import { LandingPage } from '@/legacy/components/LandingPage';
import { legacyBillingView } from '@/lib/billing-navigation';
import { useCart, QtyControl, PickupCheckout } from '@/components/tenant/PickupCart';
import { ResponseBadge } from '@/components/tenant/ResponseBadge';
import { SavedPickupOrders } from '@/components/tenant/SavedPickupOrders';
import { HeroSearch } from '@/components/discovery/HeroSearch';
import { LocationPicker } from '@/components/discovery/LocationPicker';
import { ItemResultCard, ProximityBadge, ResultsSkeleton } from '@/components/discovery/ResultCards';
import { loadCustomerLocation, saveCustomerLocation, type CustomerLocation, type Proximity } from '@/lib/customerLocation';
import { rankNearby, searchCatalog, type ItemHit, type SearchTab, type StoreHit } from '@/lib/localSearch';

const PAGE_SIZE = 12;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => normalizeDiscovery(search),
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(directoryIndexQuery());
    } catch {
      // A directory outage must not replace the shared homepage with an error page.
      // The query remains available to the results section, which shows its own retry.
      return null;
    }
  },
  notFoundComponent: () => <p className="p-8">No shops found.</p>,
  head: () => ({
    meta: [
      { title: "Hisaaboo — Find Local Shops & Products" },
      {
        name: "description",
        content:
          "Find local shops and products on Hisaaboo. Search by city, locality and category, browse public prices and order for in-store pickup.",
      },
      { property: "og:title", content: "Hisaaboo — Find Local Shops & Products" },
      {
        property: "og:description",
        content:
          "Discover local businesses, browse products and order for pickup without a customer account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

export function Index() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const initialDirectory = Route.useLoaderData();
  const directoryRequest = useQuery({ ...directoryIndexQuery(), initialData: () => initialDirectory ?? undefined, retry: 1 });
  const allShops = directoryRequest.data?.shops;
  const [location, setLocation] = useState<CustomerLocation | null>(null);
  const [tab, setTab] = useState<SearchTab>('all');
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Preserve bookmarks into the original browser-only billing views.
    const view = legacyBillingView(window.location.hash);
    if (view) void navigate({ to: '/billing', hash: view, replace: true });
  }, [navigate]);
  // Saved location is browser-only; read it after hydration.
  useEffect(() => { setLocation(loadCustomerLocation()); }, []);
  useEffect(() => { setTab('all'); }, [filters.q]);

  const options = useMemo(() => {
    const shops = allShops ?? [];
    return {
      cities: directoryOptions(shops.map(s => s.city)),
      localities: directoryOptions(shops.filter(s => !filters.city || s.city?.trim().toLowerCase() === filters.city.toLowerCase()).map(s => s.locality)),
      allLocalities: directoryOptions(shops.map(s => s.locality)),
      categories: directoryOptions(shops.map(s => s.category)),
    };
  }, [allShops, filters.city]);
  const shops = useMemo(() => (allShops ? filterDirectory(allShops, { ...filters, q: '' }) : undefined), [allShops, filters]);
  const results = useMemo(() => (shops && filters.q ? searchCatalog(shops, filters.q, location) : null), [shops, filters.q, location]);
  const nearby = useMemo(() => (shops ? rankNearby(shops, location) : undefined), [shops, location]);

  /** Brings the results into view once, after the mobile keyboard closes, only when they're off screen. */
  function revealResults() {
    window.setTimeout(() => {
      const el = resultsRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      if (top >= 64 && top <= viewport * 0.6) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.max(0, window.scrollY + top - 80), behavior: reduce ? 'auto' : 'smooth' });
    }, 180);
  }
  // resetScroll: false keeps the router from snapping the page back to the top on every search.
  function update(next: Partial<DiscoveryFilters>, reveal = false) {
    void Promise.resolve(navigate({ search: { ...filters, ...next, page: next.page ?? 1 }, resetScroll: false })).then(() => { if (reveal) revealResults(); });
  }
  function changeLocation(next: CustomerLocation | null) {
    setLocation(next);
    saveCustomerLocation(next);
  }
  function changeTab(next: SearchTab) {
    setTab(next);
    if (filters.page !== 1) update({ page: 1 });
  }

  const search = (
    <HeroSearch
      shops={allShops}
      query={filters.q}
      onSearch={q => update({ q }, true)}
      onOpenShop={slug => void navigate({ to: '/shop/$slug', params: { slug } })}
      locationSlot={<LocationPicker location={location} onChange={changeLocation} cities={options.cities} localities={options.allLocalities} />}
    />
  );
  const hasFilters = !!(filters.q || filters.city || filters.locality || filters.category);
  const pageProps = { page: filters.page, onPage: (page: number) => update({ page }, true) };
  const directory = (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <p className="mb-2 text-sm font-semibold text-stock-action">YOUR LOCAL MARKET</p>
      <h2 className="mb-6 text-3xl font-bold">Find local shops. Order for pickup.</h2>
      <SavedPickupOrders />
      <div className="grid gap-3 sm:grid-cols-3">
        {([{ key: 'city', label: 'City', values: options.cities }, { key: 'locality', label: 'Locality', values: options.localities }, { key: 'category', label: 'Category', values: options.categories }] as const).map(({ key, label, values }) => <label key={key} className="text-sm font-medium">{label}<select aria-label={label} value={filters[key]} onChange={e => update(key === 'city' ? { city: e.target.value, locality: '' } : { [key]: e.target.value })} className="mt-1 block h-10 w-full rounded-md border bg-background px-3 text-sm"> <option value="">All {label.toLowerCase() === 'city' ? 'cities' : label.toLowerCase() === 'locality' ? 'localities' : 'categories'}</option>{filters[key] && !values.includes(filters[key]) && <option value={filters[key]}>{filters[key]}</option>}{values.map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}
      </div>
      <div ref={resultsRef} className="min-h-[28rem] scroll-mt-20">
        {directoryRequest.isError && !allShops ? (
          <DirectoryError onRetry={() => void directoryRequest.refetch()} isRetrying={directoryRequest.isRefetching} />
        ) : !shops || !nearby ? (
          <ResultsSkeleton />
        ) : results ? (
          <SearchResults q={filters.q} results={results} nearby={nearby} tab={tab} onTab={changeTab} onClear={() => update({ q: '' })} {...pageProps} />
        ) : (
          <NearbyShops nearby={nearby} location={location} hasFilters={hasFilters} onClear={() => update(normalizeDiscovery({}))} {...pageProps} />
        )}
      </div>
    </div>
  );
  return <LandingPage onEnterApp={() => void navigate({ to: '/billing' })} heroSearch={search} directory={directory} />;
}

function paged<T>(items: T[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages };
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <nav aria-label="Results pages" className="mt-8 flex items-center justify-center gap-4"><Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft /></Button><span className="text-sm">{page} / {pages}</span><Button variant="outline" size="icon" aria-label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)}><ChevronRight /></Button></nav>;
}

function NearbyShops({ nearby, location, hasFilters, onClear, page, onPage }: { nearby: StoreHit[]; location: CustomerLocation | null; hasFilters: boolean; onClear: () => void; page: number; onPage: (page: number) => void }) {
  const view = paged(nearby, page);
  const close = location ? nearby.filter(h => h.proximity.tier !== 'none').length : 0;
  return <>
    <div className="my-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-xl font-semibold">{location ? 'Nearby Shops Around You' : 'Explore shops'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {nearby.length} {nearby.length === 1 ? 'shop' : 'shops'}
          {location ? (close ? ` · closest to ${location.label} first` : ` · none listed in ${location.label} yet, showing all`) : ' · set your location to see the closest first'}
        </p>
      </div>
      {hasFilters && <Button variant="ghost" onClick={onClear}>Clear filters</Button>}
    </div>
    {nearby.length === 0
      ? <div className="py-12 text-center"><Store className="mx-auto mb-3 size-10 text-muted-foreground" /><h3 className="text-lg font-semibold">No matching shops</h3><p className="mt-2 text-sm text-muted-foreground">Try another product, city or category.</p></div>
      : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{view.items.map(h => <ShopResult key={h.shop.id} shop={h.shop} proximity={h.proximity} />)}</div>}
    <Pager page={view.page} pages={view.pages} onPage={onPage} />
  </>;
}

const TABS: { key: SearchTab; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'products', label: 'Products' }, { key: 'stores', label: 'Stores' }, { key: 'services', label: 'Services' }];

function SearchResults({ q, results, nearby, tab, onTab, onClear, page, onPage }: {
  q: string; results: { products: ItemHit[]; services: ItemHit[]; stores: StoreHit[] }; nearby: StoreHit[];
  tab: SearchTab; onTab: (tab: SearchTab) => void; onClear: () => void; page: number; onPage: (page: number) => void;
}) {
  const items = [...results.products, ...results.services].sort((a, b) => b.score - a.score);
  const counts: Record<SearchTab, number> = { all: items.length + results.stores.length, products: results.products.length, stores: results.stores.length, services: results.services.length };
  const header = (
    <div className="my-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-xl font-semibold">Results for “{q}”</h3>
        <p className="mt-1 text-sm text-muted-foreground">{counts.stores} {counts.stores === 1 ? 'shop' : 'shops'} · {items.length} {items.length === 1 ? 'item' : 'items'}</p>
      </div>
      <Button variant="ghost" onClick={onClear}>Clear search</Button>
    </div>
  );
  if (counts.all === 0) return <>
    {header}
    <div className="rounded-lg border bg-card px-6 py-10 text-center">
      <SearchX className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-lg font-semibold">No exact matches found for “{q}”</h3>
      <p className="mt-2 text-sm text-muted-foreground">Check the spelling or try a shorter word, like a product type or shop name.</p>
    </div>
    {nearby.length > 0 && <section aria-labelledby="explore-nearby" className="mt-10 border-t pt-8">
      <h3 id="explore-nearby" className="mb-1 text-lg font-semibold">Nearby shops you can explore</h3>
      <p className="mb-5 text-sm text-muted-foreground">These shops don’t list “{q}”, but you can browse what they have.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{nearby.slice(0, 6).map(h => <ShopResult key={h.shop.id} shop={h.shop} proximity={h.proximity} />)}</div>
    </section>}
  </>;

  const tabs = (
    <div role="tablist" aria-label="Result type" className="mb-6 flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1 [scrollbar-width:none]">
      {TABS.map(t => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{t.label}<span className={`rounded-full px-1.5 text-xs ${tab === t.key ? 'bg-stock-action/10 text-stock-action' : 'bg-background'}`}>{counts[t.key]}</span></button>)}
    </div>
  );
  const empty = (label: string) => <div className="rounded-lg border bg-card px-6 py-10 text-center"><p className="font-medium">No {label} match “{q}”.</p><Button variant="link" onClick={() => onTab('all')}>See all results</Button></div>;

  let body: React.ReactNode;
  if (tab === 'all') {
    const storeSection = results.stores.length > 0 && <section key="stores" aria-label="Matching stores">
      <div className="mb-3 flex items-center justify-between gap-3"><h4 className="font-semibold">Stores</h4>{results.stores.length > 3 && <Button variant="link" className="h-auto p-0" onClick={() => onTab('stores')}>See all {results.stores.length}<ArrowRight aria-hidden="true" /></Button>}</div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{results.stores.slice(0, 3).map(h => <ShopResult key={h.shop.id} shop={h.shop} q={q} proximity={h.proximity} highlight={h.matchedProductIds} />)}</div>
    </section>;
    const itemSection = items.length > 0 && <section key="items" aria-label="Matching products and services">
      <div className="mb-3 flex items-center justify-between gap-3"><h4 className="font-semibold">Products & services</h4>{items.length > 6 && <Button variant="link" className="h-auto p-0" onClick={() => onTab(results.products.length ? 'products' : 'services')}>See all {items.length}<ArrowRight aria-hidden="true" /></Button>}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.slice(0, 6).map(h => <ItemResultCard key={`${h.shop.id}-${h.product.product_id}`} hit={h} />)}</div>
    </section>;
    // Product searches lead with items (Blinkit-style); shop-name searches lead with stores.
    const itemsFirst = (items[0]?.score ?? -Infinity) >= (results.stores[0]?.score ?? -Infinity);
    body = <div className="space-y-10">{itemsFirst ? [itemSection, storeSection] : [storeSection, itemSection]}</div>;
  } else if (tab === 'stores') {
    const view = paged(results.stores, page);
    body = results.stores.length ? <><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{view.items.map(h => <ShopResult key={h.shop.id} shop={h.shop} q={q} proximity={h.proximity} highlight={h.matchedProductIds} />)}</div><Pager {...view} onPage={onPage} /></> : empty('stores');
  } else {
    const list = tab === 'products' ? results.products : results.services;
    const view = paged(list, page);
    body = list.length ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{view.items.map(h => <ItemResultCard key={`${h.shop.id}-${h.product.product_id}`} hit={h} />)}</div><Pager {...view} onPage={onPage} /></> : empty(tab);
  }
  return <>{header}{tabs}{body}</>;
}

function DirectoryError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return <div role="alert" className="my-6 rounded-lg border bg-card p-8 text-center"><Store className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="text-xl font-semibold">Shop search couldn’t load</h3><p className="mx-auto my-3 max-w-md text-sm text-muted-foreground">Please try again in a moment. The rest of Hisaaboo is still available.</p><Button onClick={onRetry} disabled={isRetrying}>{isRetrying ? 'Trying again…' : 'Try again'}</Button></div>;
}

function ShopResult({ shop, q = '', proximity, highlight = [] }: { shop: DirectoryShop; q?: string; proximity?: Proximity; highlight?: string[] }) {
  const cart = useCart();
  const term = q.toLowerCase();
  const matched = new Set(highlight);
  const rank = (p: DirectoryShop['products'][number]) => (matched.has(p.product_id) ? 2 : 0) + Number(!!term && p.name.toLowerCase().includes(term));
  const products = [...shop.products].sort((a, b) => rank(b) - rank(a)).slice(0, term || matched.size ? 5 : 3);
  return <article className="flex min-w-0 flex-col rounded-lg border bg-card p-5">
    <div className="mb-4 flex items-center gap-3"><div className="rounded-md bg-stock-action/10 p-2 text-stock-action"><Store className="size-6" /></div><span className="min-w-0 flex-1 break-words text-xs font-medium text-muted-foreground">{shop.category || 'Local business'}</span><ProximityBadge proximity={proximity} /></div>
    <h3 className="break-words text-xl font-semibold">{shop.public_name}</h3>
    <ResponseBadge stats={shop.response} className="mt-2" />
    {(shop.locality || shop.city) && <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{[shop.locality, shop.city].filter(Boolean).join(', ')}</p>}
    {shop.tagline && <p className="mt-3 break-words text-sm">{shop.tagline}</p>}
    {shop.hours && <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Clock className="size-4 shrink-0" />{shop.hours}</p>}
    <div className="mt-4 border-t pt-3"><p className="text-xs font-medium text-muted-foreground">{shop.products.length} {shop.products.length === 1 ? 'product' : 'products'} · tap Add to order for pickup</p>
      <ul className="mt-2 space-y-3">{products.map(p => <li key={p.product_id} className="flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><span className="block break-words">{p.name}</span>{!p.in_stock && <span className="block text-xs text-muted-foreground">Out of stock</span>}<QtyControl p={p} cart={cart} /></div><span className="shrink-0 font-medium">₹{Number(p.price).toLocaleString('en-IN')}{p.unit ? <span className="text-xs font-normal text-muted-foreground"> /{p.unit}</span> : null}</span></li>)}</ul>
      <PickupCheckout slug={shop.slug} products={shop.products} cart={cart} compact />
    </div>
    <Button asChild variant="outline" className="mt-5 w-full"><Link to="/shop/$slug" params={{ slug: shop.slug }}>See all products<ArrowRight aria-hidden="true" /></Link></Button>
  </article>;
}
