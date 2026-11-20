import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-types";
import { useCart, QtyControl, PickupCheckout } from "@/components/tenant/PickupCart";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Search } from 'lucide-react';
import { directionsUrl, filterShopProducts } from '@/lib/shop-catalogue';
import { ProductPhoto } from '@/components/tenant/ProductPhoto';

type PublicShop = {
  slug: string; public_name: string; category: string | null; city: string | null;
  locality: string | null; address: string | null; phone: string | null; hours: string | null; tagline: string | null;
  maps_url?: string | null;
  products: { product_id: string; name: string; category: string | null; unit: string | null; price: number; description: string | null; in_stock: boolean; image_path?: string | null }[];
};

const getPublicShop = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug).toLowerCase().slice(0, 60))
  .handler(async ({ data: slug }) => {
    const key = (process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"])!;
    const supabase = createClient<Database>((process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"])!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_")) {
            if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
            headers.set("apikey", key);
          }
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data, error } = await supabase
      .from("businesses")
      .select("id, slug, public_name, category, city, locality, address, phone, hours, tagline")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const { data: products, error: productsError } = await supabase.from("shop_products")
      .select("product_id, name, category, unit, price, description, in_stock")
      .eq("business_id", data.id).order("category").order("name");
    if (productsError) throw new Error(productsError.message);
    // Optional columns can be enabled independently without breaking existing shops.
    const [{ data: location }, { data: photos }] = await Promise.all([
      supabase.from('businesses').select('maps_url').eq('id', data.id).maybeSingle(),
      supabase.from('shop_products').select('product_id,image_path').eq('business_id', data.id),
    ]);
    const images = new Map((photos ?? []).map(p => [p.product_id, p.image_path]));
    const { id: _id, ...shop } = data;
    return { ...shop, maps_url: location?.maps_url ?? null, products: (products ?? []).map(p => ({ ...p, image_path: images.get(p.product_id) ?? null })) } as PublicShop;
  });

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ params }) => {
    const shop = await getPublicShop({ data: params.slug });
    if (!shop) throw notFound();
    return shop as PublicShop;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.public_name} — Hisaaboo` : "Shop not found — Hisaaboo";
    const description = loaderData
      ? `${loaderData.public_name}${loaderData.locality || loaderData.city ? ` in ${[loaderData.locality, loaderData.city].filter(Boolean).join(", ")}` : ""}. Browse and order for in-store pickup.`
      : "This shop page is not available.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shop not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This shop page doesn't exist or isn't published yet.</p>
      </div>
    </div>
  ),
  component: ShopPage,
});

function ShopPage() {
  const shop = Route.useLoaderData();
  const cart = useCart();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(shop.products.map(p => p.category?.trim() || 'Other'))].sort();
  const shown = filterShopProducts(shop.products, query, category);
  const directions = directionsUrl(shop);
  const place = [shop.locality, shop.city].filter(Boolean).join(", ");
  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto max-w-4xl text-foreground">
        {shop.category && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{shop.category}</p>}
        <h1 className="mt-1 text-3xl font-bold text-foreground">{shop.public_name}</h1>
        {shop.tagline && <p className="mt-2 text-foreground">{shop.tagline}</p>}
        {place && <p className="mt-1 text-muted-foreground">{place}</p>}
        <dl className="mt-6 space-y-3 text-sm">
          {shop.address && (<div><dt className="font-medium text-foreground">Address</dt><dd className="text-muted-foreground">{shop.address}</dd></div>)}
          {shop.hours && (<div><dt className="font-medium text-foreground">Timings</dt><dd className="text-muted-foreground">{shop.hours}</dd></div>)}
          {shop.phone && (<div><dt className="font-medium text-foreground">Phone</dt><dd><a className="text-primary hover:underline" href={`tel:${shop.phone}`}>{shop.phone}</a></dd></div>)}
        </dl>
        {directions && <Button asChild variant="outline" className="mt-4"><a href={directions} target="_blank" rel="noopener noreferrer"><MapPin />Directions on Google Maps</a></Button>}
        <h2 className="mt-8 text-lg font-semibold text-foreground">Products</h2>
        {shop.products.length > 0 && <div className="mt-3 space-y-3">
          <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label="Search store products" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products" className="h-10 w-full rounded-md border bg-background pl-10 pr-3 text-sm" /></div>
          <label className="block text-sm font-medium">Category<select aria-label="Product category" value={category} onChange={e => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 sm:w-64"><option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        </div>}
        {shop.products.length === 0 ? (
          <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Products will appear here soon.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <li key={p.product_id} className="flex min-w-0 items-start gap-3 rounded-lg border bg-card p-3">
                <ProductPhoto path={p.image_path} name={p.name} className="h-20 w-20" />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium text-foreground">{p.name}</p>
                  {(p.category || p.description) && <p className="text-xs text-muted-foreground">{[p.category, p.description].filter(Boolean).join(" · ")}</p>}
                  {!p.in_stock && <p className="text-xs text-destructive">Out of stock</p>}
                  <p className="mt-2 break-words font-semibold text-foreground">₹{Number(p.price).toLocaleString("en-IN")}{p.unit ? <span className="text-xs font-normal text-muted-foreground"> /{p.unit}</span> : null}</p>
                  <QtyControl p={p} cart={cart} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {shop.products.length > 0 && shown.length === 0 && <div className="py-8 text-center"><p className="text-muted-foreground">No matching products.</p><Button variant="ghost" onClick={() => { setQuery(''); setCategory(''); }}>Clear filters</Button></div>}
        <PickupCheckout slug={shop.slug} products={shop.products} cart={cart} />
      </div>
    </main>
  );
}
