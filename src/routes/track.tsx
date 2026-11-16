import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tracked = {
  order_code: string; status: string; total: number; items: { name: string; qty: number; price: number }[];
  created_at: string; responded_at: string | null; accepted_at: string | null; ready_at: string | null; collected_at: string | null;
  shop_name: string; shop_slug: string; shop_phone: string | null; shop_address: string | null;
};
const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, 20) : "");

export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>) => ({ code: text(s["code"]), phone: text(s["phone"]) }),
  head: () => ({
    meta: [
      { title: "Track your pickup order — Hisaaboo" },
      { name: "description", content: "See if the shop has accepted your pickup order and when it is ready to collect." },
      { property: "og:title", content: "Track your pickup order — Hisaaboo" },
      { property: "og:description", content: "Live status for your Hisaaboo pickup order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

const STEPS = [
  { key: "created_at", label: "Order placed" },
  { key: "accepted_at", label: "Accepted by shop" },
  { key: "ready_at", label: "Ready for pickup" },
  { key: "collected_at", label: "Collected" },
] as const;

function TrackPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [order, setOrder] = useState<Tracked | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.code || !search.phone) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("track_pickup_order", { _code: search.code, _phone: search.phone });
      if (!alive) return;
      setLoading(false);
      if (error) return setError("Couldn't check your order. Please try again.");
      setError(data ? "" : "No order found for this code and mobile number.");
      setOrder((data as Tracked) ?? null);
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [search.code, search.phone]);

  const cancelled = order?.status === "cancelled";
  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Track your order</h1>
        <form className="mt-4 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void navigate({ search: { code: String(f.get("code") ?? "").toUpperCase(), phone: String(f.get("phone") ?? "") } }); }}>
          <Input name="code" aria-label="Pickup code" placeholder="Pickup code" defaultValue={search.code} required maxLength={10} />
          <Input name="phone" aria-label="Mobile number" placeholder="Mobile number used for the order" defaultValue={search.phone} inputMode="tel" required maxLength={14} />
          <Button type="submit">Check status</Button>
        </form>
        {loading && !order && <p className="mt-4 text-sm text-muted-foreground">Checking…</p>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        {order && (
          <section className="mt-6">
            <p className="text-sm text-muted-foreground">Order #{order.order_code} at <Link to="/shop/$slug" params={{ slug: order.shop_slug }} className="font-medium text-primary hover:underline">{order.shop_name}</Link></p>
            {cancelled ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><XCircle className="size-5" />The shop couldn't take this order. Please call them or try another shop.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {STEPS.map((s) => { const at = order[s.key]; return (
                  <li key={s.key} className="flex items-center gap-3 text-sm">
                    {at ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground" />}
                    <span className={at ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
                    {at && <span className="ml-auto text-xs text-muted-foreground">{new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
                  </li>); })}
              </ol>
            )}
            {order.status === "new" && <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Waiting for the shop to accept. Shops are asked to reply within 15 minutes.</p>}
            {order.status === "ready" && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary">Your order is ready! Show code {order.order_code} at the counter and pay there.</p>}
            <ul className="mt-4 border-t pt-3 text-sm">{order.items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>₹{(i.price * i.qty).toLocaleString("en-IN")}</span></li>)}
              <li className="mt-1 flex justify-between font-semibold"><span>Total</span><span>₹{Number(order.total).toLocaleString("en-IN")}</span></li></ul>
            {(order.shop_phone || order.shop_address) && <p className="mt-3 text-xs text-muted-foreground">{order.shop_address}{order.shop_phone && <> · <a className="text-primary" href={`tel:${order.shop_phone}`}>{order.shop_phone}</a></>}</p>}
            <p className="mt-3 text-xs text-muted-foreground">This page refreshes by itself.</p>
          </section>
        )}
      </div>
    </main>
  );
}
