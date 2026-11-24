import { useMemo, useState } from "react";
import { directionsTo, splitAddress } from "@/lib/shopAddress";
import { storeThemeStyle } from "@/lib/store-themes";
import { Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { normalizeTable, parseFence, encodeFence } from "@/lib/tableOrders";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { useCart, QtyControl, PickupCheckout } from "@/components/tenant/PickupCart";
import { ResponseBadge } from "@/components/tenant/ResponseBadge";
import type { ResponseStats } from "@/lib/discovery";
import { SavedPickupOrders } from '@/components/tenant/SavedPickupOrders';
import { CustomerRating } from '@/components/pickup/CustomerRating';
import { HisaabooLogo, HisaabooOwl } from "@/components/brand/HisaabooLogo";

type PublicShop = {
  slug: string; public_name: string; category: string | null; city: string | null;
  locality: string | null; address: string | null; phone: string | null; hours: string | null; tagline: string | null; accent_color: string | null;
  response: ResponseStats | null;
  products: { product_id: string; name: string; category: string | null; unit: string | null; price: number; description: string | null; in_stock: boolean; image_url: string | null }[];
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
      .select("id, slug, public_name, category, city, locality, address, phone, hours, tagline, accent_color")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const { data: products } = await supabase.from("shop_products")
      .select("product_id, name, category, unit, price, description, in_stock, image_path")
      .eq("business_id", data.id).order("category").order("name");
    const { data: stats } = await supabase.rpc("shop_response_stats").then((r) => r, () => ({ data: null }));
    const st = (stats ?? []).find((r) => r.business_id === data.id);
    const response = st ? { responded: st.responded, avg_minutes: Number(st.avg_minutes), quick_share: Number(st.quick_share) } : null;
    const paths = (products ?? []).map((p) => p.image_path).filter((p): p is string => !!p);
    const urls = new Map<string, string>();
    if (paths.length) {
      // Photos are optional: never let a photo problem break the shop page.
      try {
        const { data: signed } = await supabase.storage.from("product-photos").createSignedUrls(paths, 60 * 60 * 24);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      } catch (e) {
        console.error("Product photos unavailable", e);
      }
    }
    const list = (products ?? []).map(({ image_path, ...p }) => ({ ...p, image_url: image_path ? urls.get(image_path) ?? null : null }));
    const { id: _id, ...shop } = data;
    return { ...shop, response, products: list } as PublicShop;
  });

export const Route = createFileRoute("/shop/$slug")({
  validateSearch: (s: Record<string, unknown>): { table?: string; geo?: string } => {
    const table = normalizeTable(s["table"]);
    if (!table) return {};
    const fence = parseFence(s["geo"]);
    return fence ? { table, geo: encodeFence(fence) } : { table };
  },
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
  const { table = "", geo } = Route.useSearch();
  const fence = useMemo(() => parseFence(geo), [geo]);
  const leaveTable = () => void navigate({ search: {}, replace: true, resetScroll: false });
  const navigate = Route.useNavigate();
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const place = [shop.locality, shop.city].filter(Boolean).join(", ");
  const initial = shop.public_name.trim().charAt(0).toUpperCase();

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of shop.products) { const c = p.category?.trim() || "Other"; m.set(c, (m.get(c) ?? 0) + 1); }
    return [["All", shop.products.length] as const, ...[...m.entries()].sort((a, b) => b[1] - a[1])];
  }, [shop.products]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = shop.products.filter((p) => {
      const c = p.category?.trim() || "Other";
      if (active !== "All" && c !== active) return false;
      return !q || `${p.name} ${c} ${p.description ?? ""}`.toLowerCase().includes(q);
    });
    const m = new Map<string, typeof list>();
    for (const p of list) { const c = p.category?.trim() || "Other"; m.set(c, [...(m.get(c) ?? []), p]); }
    return [...m.entries()];
  }, [shop.products, query, active]);

  const count = Object.values(cart.qty).reduce((s, n) => s + (n ?? 0), 0);
  const total = shop.products.reduce((s, p) => s + Number(p.price) * (cart.qty[p.product_id] ?? 0), 0);

  return (
    <main className="min-h-screen bg-store-surface pb-28" style={storeThemeStyle(shop.accent_color)}>
      <header className="relative overflow-hidden pb-16 pt-8" style={{ backgroundImage: "var(--gradient-store-hero)" }}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[28px] border-store-foreground/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rotate-12 rounded-[2.5rem] bg-store-foreground/5" />
        <div className="relative mx-auto max-w-5xl px-4">
          <a href="/" className="inline-flex items-center gap-1 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-store-foreground backdrop-blur hover:bg-background">← All shops</a>
          <a href="/" aria-label="Hisaaboo home" className="absolute right-4 top-0 inline-flex items-center gap-1.5 rounded-full bg-background/80 py-1 pl-1 pr-3 text-[11px] font-bold text-store-foreground shadow-store-card backdrop-blur hover:bg-background"><HisaabooOwl size={26} title="Hisaaboo" />on Hisaaboo</a>
          <div className="mt-6 flex items-end gap-4">
            <div className="flex h-20 w-20 shrink-0 -rotate-3 items-center justify-center rounded-3xl bg-store-deep text-4xl font-black text-store-deep-foreground shadow-store-lift sm:h-24 sm:w-24">{initial}</div>
            <div className="min-w-0 text-store-foreground">
              {shop.category && <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">{shop.category}</p>}
              <h1 className="truncate text-3xl font-black tracking-tight sm:text-5xl">{shop.public_name}</h1>
              {shop.tagline && <p className="mt-1 text-sm font-medium opacity-80 sm:text-base">{shop.tagline}</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-store-foreground">
            <span className="rounded-full bg-background px-3 py-1.5 shadow-store-card"><ResponseBadge stats={shop.response} /></span>
            <CustomerRating slug={shop.slug} />
            {place && <span className="rounded-full bg-background/80 px-3 py-1.5">📍 {place}</span>}
            {shop.hours && <span className="rounded-full bg-background/80 px-3 py-1.5">🕒 {shop.hours}</span>}
            {shop.phone && <a href={`tel:${shop.phone}`} className="rounded-full bg-store-deep px-3 py-1.5 text-store-deep-foreground hover:opacity-90">📞 Call shop</a>}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mt-8 px-4">
        <div className="mx-auto max-w-5xl rounded-2xl bg-background p-3 shadow-store-lift">
          <label className="flex items-center gap-2 rounded-xl bg-muted px-3">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search in ${shop.public_name}…`} aria-label="Search products" className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          </label>
          {shop.products.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categories">
              {categories.map(([c, n]) => (
                <button key={c} type="button" role="tab" aria-selected={active === c} onClick={() => setActive(c)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${active === c ? "border-store-deep bg-store-deep text-store-deep-foreground shadow-store-card" : "border-border bg-background text-foreground hover:-translate-y-0.5 hover:border-store-deep"}`}>
                  {c} <span className="ml-1 opacity-70">{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-5xl px-4">
        {table && (
          <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-store-deep px-4 py-3 text-store-deep-foreground shadow-store-card">
            <span className="flex min-w-0 items-center gap-2 text-sm font-bold"><UtensilsCrossed className="size-5 shrink-0" aria-hidden="true" /><span className="truncate">Ordering from {table}</span></span>
            <button type="button" onClick={leaveTable} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/20 px-3 py-1 text-xs font-semibold hover:bg-background/30"><X className="size-3" aria-hidden="true" />Clear</button>
          </div>
        )}
        <SavedPickupOrders />
        {shop.products.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-background p-6 text-center text-sm text-muted-foreground shadow-store-card">Products will appear here soon.</p>
        ) : groups.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-background p-6 text-center text-sm text-muted-foreground shadow-store-card">No items match “{query}”.</p>
        ) : groups.map(([cat, items]) => (
          <section key={cat} className="mt-6">
            <h2 className="mb-3 text-lg font-black text-foreground">{cat} <span className="text-sm font-semibold text-muted-foreground">· {items.length}</span></h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => (
                <li key={p.product_id} className={`group flex flex-col rounded-2xl bg-background p-3 shadow-store-card transition-all duration-200 hover:-translate-y-1 hover:shadow-store-lift ${p.in_stock ? "" : "opacity-60"}`}>
                  <div className="relative flex aspect-square overflow-hidden items-center justify-center rounded-xl bg-store-surface text-4xl font-black text-store-foreground/30 transition-transform duration-300 group-hover:scale-[1.03]">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full rounded-xl object-cover" />
                      : p.name.trim().charAt(0).toUpperCase()}
                    {!p.in_stock && <span className="absolute left-2 top-2 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">Out of stock</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{p.name}</p>
                  {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                  {p.unit && <p className="text-xs text-muted-foreground">per {p.unit}</p>}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className="text-base font-black text-foreground">₹{Number(p.price).toLocaleString("en-IN")}</p>
                    {p.in_stock && <QtyControl p={p} cart={cart} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div id="checkout" className="mt-8 scroll-mt-40 rounded-2xl bg-background p-4 shadow-store-card">
          <PickupCheckout slug={shop.slug} products={shop.products} cart={cart} table={table} fence={fence} onLeaveTable={leaveTable} />
          {count === 0 && <p className="text-sm text-muted-foreground">Tap Add on any item to order for pickup at the store.</p>}
        </div>
        <a href="/" className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground hover:text-foreground">
          <span>Powered by</span>
          <HisaabooLogo size={28} /><span className="sr-only">Hisaaboo</span>
          <span className="mt-1 font-medium">Your City, Your Shops, Your Discovery.</span>
        </a>
        {shop.address && <p className="mt-4 text-center text-xs text-muted-foreground">{splitAddress(shop.address).street} · <a className="underline" href={directionsTo(shop.public_name, shop.address)} target="_blank" rel="noopener noreferrer">Get directions</a></p>}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4">
          <button type="button" onClick={() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" })}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-store-deep px-5 py-3.5 text-store-deep-foreground shadow-store-lift transition-transform hover:-translate-y-0.5">
            <span className="flex items-center gap-2 text-sm font-bold"><ShoppingBag className="h-5 w-5" aria-hidden />{count} item{count > 1 ? "s" : ""} · ₹{total.toLocaleString("en-IN")}</span>
            <span className="text-sm font-black">View pickup order →</span>
          </button>
        </div>
      )}
    </main>
  );
}
