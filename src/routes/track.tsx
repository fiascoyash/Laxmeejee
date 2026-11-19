import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SavedPickupOrders } from "@/components/tenant/SavedPickupOrders";
import { removeSavedPickup, savePickup } from "@/lib/saved-pickups";
import { isValidPickupPhone, normalizePickupPhone } from "@/lib/pickup-phone";

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
      { name: "robots", content: "noindex, nofollow" },
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
  const [mode, setMode] = useState<'nickname' | 'code'>(search.code ? 'code' : 'nickname');
  const [code, setCode] = useState(search.code);
  const [phone, setPhone] = useState(search.phone);
  const [nickname, setNickname] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [matches, setMatches] = useState<{ order_code: string; shop_slug: string; shop_name: string }[]>([]);
  useEffect(() => {
    if (search.code) { setCode(search.code); setMode('code'); }
    if (search.phone) setPhone(search.phone);
  }, [search.code, search.phone]);

  async function recover() {
    setError(''); setMatches([]); setOrder(null);
    const normalizedPhone = normalizePickupPhone(phone);
    if (!isValidPickupPhone(normalizedPhone)) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setPhone(normalizedPhone);
    setRecovering(true);
    void navigate({ search: { code: '', phone: '' }, replace: true });
    try {
      const { data, error } = await supabase.rpc('recover_active_pickups', { _phone: normalizedPhone, _nickname: nickname });
      if (error) { setError("Couldn't find your order. Please try again."); return; }
      if (data && typeof data === 'object' && !Array.isArray(data) && data['limited']) { setError('Too many checks. Please try again in 15 minutes, or use your pickup code.'); return; }
      const found = Array.isArray(data) ? data.filter((r): r is { order_code: string; shop_slug: string; shop_name: string } => !!r && typeof r === 'object' && !Array.isArray(r) && typeof r['order_code'] === 'string' && typeof r['shop_slug'] === 'string' && typeof r['shop_name'] === 'string') : [];
      if (!found.length) { setError('No active order matches those details. Check your nickname and mobile number.'); return; }
      found.forEach(r => savePickup({ code: r.order_code, phone: normalizedPhone, nickname: nickname.trim(), slug: r.shop_slug }));
      setMatches(found);
      if (found.length === 1) void navigate({ search: { code: found[0]?.order_code ?? '', phone: normalizedPhone }, replace: true });
    } catch { setError("Couldn't find your order. Please try again."); }
    finally { setRecovering(false); }
  }

  useEffect(() => {
    if (!search.code || !search.phone) { setLoading(false); return; }
    setOrder(null); setError("");
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
      const { data, error } = await supabase.rpc("track_pickup_order", { _code: search.code, _phone: search.phone });
      if (!alive) return;
      setLoading(false);
      if (error) { setOrder(null); return setError("Couldn't check your order. Please try again."); }
      setError(data ? "" : "No order found for this code and mobile number.");
      const tracked = (data as Tracked | null) ?? null;
      setOrder(tracked);
      if (tracked?.status === 'collected' || tracked?.status === 'cancelled') removeSavedPickup(search.code, search.phone.replace(/\D/g, '').slice(-10));
      } catch { if (alive) { setLoading(false); setOrder(null); setError("Couldn't check your order. Please try again."); } }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [search.code, search.phone]);

  const cancelled = order?.status === "cancelled";
  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Track your order</h1>
        <SavedPickupOrders />
        <div className="mt-4 flex gap-2" role="group" aria-label="Find order with">
          <Button variant={mode === 'nickname' ? 'default' : 'outline'} aria-pressed={mode === 'nickname'} onClick={() => { setMode('nickname'); setError(''); setMatches([]); }}>Mobile + nickname</Button>
          <Button variant={mode === 'code' ? 'default' : 'outline'} aria-pressed={mode === 'code'} onClick={() => { setMode('code'); setError(''); setMatches([]); }}>Pickup code</Button>
        </div>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (mode === 'nickname') { void recover(); } else { setError(''); setMatches([]); const normalizedPhone = normalizePickupPhone(phone); if (!isValidPickupPhone(normalizedPhone)) { setError('Enter a valid 10-digit Indian mobile number.'); return; } void navigate({ search: { code: code.trim().toUpperCase(), phone: normalizedPhone } }); } }}>
          <label className="text-sm font-medium">Mobile number<Input aria-label="Mobile number" placeholder="Mobile number used for the order" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required maxLength={16} className="mt-1" /></label>
          {mode === 'nickname' ? <label className="text-sm font-medium">Order nickname<Input aria-label="Order nickname" placeholder="The nickname you used at checkout" value={nickname} onChange={e => setNickname(e.target.value)} required minLength={2} maxLength={80} className="mt-1" /></label> : <label className="text-sm font-medium">Pickup code<Input aria-label="Pickup code" placeholder="Pickup code" value={code} onChange={e => setCode(e.target.value)} required maxLength={10} className="mt-1" /></label>}
          <Button type="submit" disabled={recovering}>{recovering ? 'Finding orders…' : mode === 'nickname' ? 'Find active orders' : 'Check status'}</Button>
          {mode === 'nickname' && <p className="text-xs text-muted-foreground">Both details must match. Nicknames ignore capital letters. Only active orders appear.</p>}
        </form>
        {matches.length > 1 && <section className="mt-4 space-y-3" aria-label="Matching active orders">{matches.map(match => <div key={`${match.shop_slug}-${match.order_code}`} className="border-b pb-3"><p className="break-words text-sm font-medium">{match.shop_name} · #{match.order_code}</p><Button className="mt-2 w-full" onClick={() => void navigate({ search: { code: match.order_code, phone } })}>Track Order</Button></div>)}</section>}
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
