import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSuspenseQuery } from '@tanstack/react-query';
import { Store, ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchAutocomplete } from '@/components/discovery/SearchAutocomplete';
import { ShopResultCard } from '@/components/discovery/ShopResultCard';
import { Button } from '@/components/ui/button';
import { normalizeDiscovery, type DiscoveryFilters } from '@/lib/discovery';
import { directoryQuery } from '@/lib/discovery.queries';
import { LandingPage } from '@/legacy/components/LandingPage';
import { legacyBillingView } from '@/lib/billing-navigation';

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => normalizeDiscovery(search),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(directoryQuery(deps)),
  pendingComponent: () => <div className="p-8 text-muted-foreground">Finding shops…</div>,
  errorComponent: DirectoryError,
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

function Index() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(directoryQuery(filters));
  useEffect(() => {
    // Preserve bookmarks into the original browser-only billing views.
    const view = legacyBillingView(window.location.hash);
    if (view) void navigate({ to: '/billing', hash: view, replace: true });
  }, [navigate]);
  function update(next: Partial<DiscoveryFilters>) {
    void navigate({ search: { ...filters, ...next, page: 1 } });
  }
  const search = <SearchAutocomplete initial={filters.q} city={filters.city} onSearch={q => { update({ q }); document.getElementById('shops')?.scrollIntoView({ behavior: 'smooth' }); }} />;
  const directory = (
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-2 text-sm font-semibold text-stock-action">YOUR LOCAL MARKET</p>
        <h2 className="mb-6 text-3xl font-bold">Find local shops. Order for pickup.</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {([{ key: 'city', label: 'City', values: data.cities }, { key: 'locality', label: 'Locality', values: data.localities }, { key: 'category', label: 'Category', values: data.categories }] as const).map(({ key, label, values }) => <label key={key} className="text-sm font-medium">{label}<select aria-label={label} value={filters[key]} onChange={e => update(key === 'city' ? { city: e.target.value, locality: '' } : { [key]: e.target.value })} className="mt-1 block h-10 w-full rounded-md border bg-background px-3 text-sm"> <option value="">All {label.toLowerCase() === 'city' ? 'cities' : label.toLowerCase() === 'locality' ? 'localities' : 'categories'}</option>{filters[key] && !values.includes(filters[key]) && <option value={filters[key]}>{filters[key]}</option>}{values.map(v => <option key={v} value={v}>{v}</option>)}</select></label>)}
        </div>
        <div className="my-6 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-semibold">{filters.q ? `Search: ${filters.q}` : 'Explore shops'}</h3><p className="mt-1 text-sm text-muted-foreground">{[filters.city, filters.q && data.productShops ? `${data.productShops} ${data.productShops === 1 ? 'shop' : 'shops'} listing this product` : `${data.total} ${data.total === 1 ? 'shop' : 'shops'}`].filter(Boolean).join(' · ')}</p></div>{(filters.q || filters.city || filters.locality || filters.category) && <Button variant="ghost" onClick={() => update(normalizeDiscovery({}))}>Clear filters</Button>}</div>
        {data.shops.length === 0 ? <div className="py-12 text-center"><Store className="mx-auto mb-3 size-10 text-muted-foreground" /><h3 className="text-lg font-semibold">No matching shops</h3><p className="mt-2 text-sm text-muted-foreground">Try another product, shop or service.</p></div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.shops.map((shop, i) => <ShopResultCard key={shop.id} shop={shop} q={filters.q} highlight={Boolean(filters.q) && i === 0 && data.page === 1} />)}</div>}
        {data.pages > 1 && <nav aria-label="Results pages" className="mt-8 flex items-center justify-center gap-4"><Button variant="outline" size="icon" aria-label="Previous page" disabled={data.page === 1} onClick={() => navigate({ search: { ...filters, page: data.page - 1 } })}><ChevronLeft /></Button><span className="text-sm">{data.page} / {data.pages}</span><Button variant="outline" size="icon" aria-label="Next page" disabled={data.page === data.pages} onClick={() => navigate({ search: { ...filters, page: data.page + 1 } })}><ChevronRight /></Button></nav>}
      </div>
  );
  return <LandingPage onEnterApp={(mode = 'signin') => { sessionStorage.setItem('hisaaboo:auth-mode', mode); void navigate({ to: '/billing' }); }} heroSearch={search} directory={directory} />;
}

function DirectoryError() {
  const router = useRouter();
  return <div role="alert" className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Shop search couldn’t load</h1><p className="my-4 text-muted-foreground">Please try again in a moment.</p><div className="flex gap-3"><Button onClick={() => router.invalidate()}>Try again</Button><Button asChild variant="outline"><Link to="/billing">Open billing</Link></Button></div></div>;
}
