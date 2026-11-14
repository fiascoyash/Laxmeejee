import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { useCart, QtyControl, PickupCheckout } from "@/components/tenant/PickupCart";

type PublicShop = {
  slug: string; public_name: string; category: string | null; city: string | null;
  locality: string | null; address: string | null; phone: string | null; hours: string | null; tagline: string | null;
  products: { product_id: string; name: string; category: string | null; unit: string | null; price: number; description: string | null; in_stock: boolean }[];
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
    const { data: products } = await supabase.from("shop_products")
      .select("product_id, name, category, unit, price, description, in_stock")
      .eq("business_id", data.id).order("category").order("name");
    const { id: _id, ...shop } = data;
    return { ...shop, products: products ?? [] } as PublicShop;
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
  const place = [shop.locality, shop.city].filter(Boolean).join(", ");
  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm">
        {shop.category && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{shop.category}</p>}
        <h1 className="mt-1 text-3xl font-bold text-foreground">{shop.public_name}</h1>
        {shop.tagline && <p className="mt-2 text-foreground">{shop.tagline}</p>}
        {place && <p className="mt-1 text-muted-foreground">{place}</p>}
        <dl className="mt-6 space-y-3 text-sm">
          {shop.address && (<div><dt className="font-medium text-foreground">Address</dt><dd className="text-muted-foreground">{shop.address}</dd></div>)}
          {shop.hours && (<div><dt className="font-medium text-foreground">Timings</dt><dd className="text-muted-foreground">{shop.hours}</dd></div>)}
          {shop.phone && (<div><dt className="font-medium text-foreground">Phone</dt><dd><a className="text-primary hover:underline" href={`tel:${shop.phone}`}>{shop.phone}</a></dd></div>)}
        </dl>
        <h2 className="mt-8 text-lg font-semibold text-foreground">Products</h2>
        {shop.products.length === 0 ? (
          <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Products will appear here soon.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {shop.products.map((p) => (
              <li key={p.product_id} className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  {(p.category || p.description) && <p className="text-xs text-muted-foreground">{[p.category, p.description].filter(Boolean).join(" · ")}</p>}
                  {!p.in_stock && <p className="text-xs text-destructive">Out of stock</p>}
                  <QtyControl p={p} cart={cart} />
                </div>
                <p className="whitespace-nowrap font-semibold text-foreground">₹{Number(p.price).toLocaleString("en-IN")}{p.unit ? <span className="text-xs font-normal text-muted-foreground"> /{p.unit}</span> : null}</p>
              </li>
            ))}
          </ul>
        )}
        <PickupCheckout slug={shop.slug} products={shop.products} cart={cart} />
        <p className="mt-6 text-xs text-muted-foreground">Prices shown by the shop. Tap Add to order for pickup at the store.</p>
      </div>
    </main>
  );
}
