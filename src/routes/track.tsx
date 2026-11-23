import { createFileRoute, Link } from "@tanstack/react-router";
import { directionsTo, splitAddress } from "@/lib/shopAddress";
import { HisaabooLogo } from "@/components/brand/HisaabooLogo";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, MapPin, Navigation, Phone, Store, Sun, XCircle } from "lucide-react";
import { normalizeDiscovery } from "@/lib/discovery";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SavedPickupOrders } from "@/components/tenant/SavedPickupOrders";
import { removeSavedPickup, savePickup } from "@/lib/saved-pickups";
import { ResponseCountdown } from "@/components/pickup/ResponseCountdown";
import { isValidPickupPhone, normalizePickupPhone } from "@/lib/pickup-phone";
import { CustomerFeedback } from '@/components/pickup/CustomerFeedback';

type Tracked = {
  order_code: string; status: string; total: number; items: { name: string; qty: number; price: number }[];
  created_at: string; responded_at: string | null; accepted_at: string | null; ready_at: string | null; collected_at: string | null;
  cancelled_by?: string | null; cancel_reason?: string | null;
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

const homeSearch = normalizeDiscovery({});
const directionsUrl = (name: string, address: string | null) => directionsTo(name, address);

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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refresh, setRefresh] = useState(0);
  async function cancelOrder() {
    if (reason.trim().length < 3) { setError("Please tell the shop why you are cancelling."); return; }
    setCancelling(true); setError("");
    const { error } = await supabase.rpc("cancel_pickup_order", { _code: search.code, _phone: search.phone, _reason: reason });
    setCancelling(false);
    if (error) { setError(error.message.includes("no longer") ? "This order can no longer be cancelled — please call the shop." : "Couldn't cancel. Please try again."); return; }
    setCancelOpen(false); setReason(""); setRefresh(n => n + 1);
  }
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
  }, [search.code, search.phone, refresh]);

  const cancelled = order?.status === "cancelled";
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" search={homeSearch} className="flex items-center gap-2 font-bold text-foreground">
            <HisaabooLogo size={30} /><span className="sr-only">Hisaaboo home</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link to="/" search={homeSearch} hash="shops" className="hover:text-foreground">Find Shops</Link>
            <Link to="/about" className="hover:text-foreground">About</Link>
          </nav>
        </div>
      </header>
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto max-w-md">
        <Link to="/" search={homeSearch} hash="shops" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Back to all shops</Link>
      </div>
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
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><XCircle className="size-5 shrink-0" />{order.cancelled_by === "customer" ? `You cancelled this order${order.cancel_reason ? ` (“${order.cancel_reason}”)` : ""}.` : `The shop couldn't take this order${order.cancel_reason ? ` (“${order.cancel_reason}”)` : ""}. Please call them or try another shop.`}</p>
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
            {order.status === "new" && <div className="mt-4"><ResponseCountdown createdAt={order.created_at} audience="customer" /><p className="mt-1 text-xs text-muted-foreground">Shops that reply on time earn a better reply-speed rating.</p></div>}
            {(order.status === "new" || order.status === "accepted") && (cancelOpen ? (
              <div className="mt-4 space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Why are you cancelling?</p>
                <div className="flex flex-wrap gap-2">{["Shop is taking too long", "Ordered by mistake", "Found it elsewhere", "Plans changed"].map(r => <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>{r}</Button>)}</div>
                <Input aria-label="Cancel reason" placeholder="Or write your own reason" value={reason} maxLength={300} onChange={e => setReason(e.target.value)} />
                <p className="text-xs text-muted-foreground">Your cancellations are part of your order history that shops can see.</p>
                <div className="flex gap-2"><Button type="button" variant="destructive" disabled={cancelling} onClick={() => void cancelOrder()}>{cancelling ? "Cancelling…" : "Cancel order"}</Button><Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>Keep order</Button></div>
              </div>
            ) : <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setCancelOpen(true)}>Cancel order</Button>)}
            {order.status === "ready" && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary">Your order is ready! Show code {order.order_code} at the counter and pay there.{order.shop_address ? " Tap Get directions to reach the shop." : ""}</p>}
            {!cancelled && order.status !== "collected" && (order.shop_address || order.shop_phone) && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {order.shop_address && <Button asChild variant={order.status === "ready" ? "default" : "outline"} className={order.shop_phone ? "" : "col-span-2"}><a href={directionsUrl(order.shop_name, order.shop_address)} target="_blank" rel="noopener noreferrer"><Navigation className="size-4" aria-hidden="true" />Get directions</a></Button>}
                {order.shop_phone && <Button asChild variant="outline" className={order.shop_address ? "" : "col-span-2"}><a href={`tel:${order.shop_phone}`}><Phone className="size-4" aria-hidden="true" />Call shop</a></Button>}
              </div>
            )}
            <ul className="mt-4 border-t pt-3 text-sm">{order.items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.name} × {i.qty}</span><span>₹{(i.price * i.qty).toLocaleString("en-IN")}</span></li>)}
              <li className="mt-1 flex justify-between font-semibold"><span>Total</span><span>₹{Number(order.total).toLocaleString("en-IN")}</span></li></ul>
            {(order.shop_phone || order.shop_address) && <p className="mt-3 text-xs text-muted-foreground">{order.shop_address && <MapPin className="mr-1 inline size-3" aria-hidden="true" />}{splitAddress(order.shop_address).street}{order.shop_phone && <> · <a className="text-primary" href={`tel:${order.shop_phone}`}>{order.shop_phone}</a></>}</p>}
            {(cancelled || order.status === "collected") && order.shop_phone && <Button asChild variant="outline" className="mt-4 w-full"><a href={`tel:${order.shop_phone}`}><Phone className="size-4" aria-hidden="true" />Call shop</a></Button>}
            {!cancelled && order.status !== "collected" && <p className="mt-3 text-xs text-muted-foreground">This page refreshes by itself.</p>}
            {order.status === 'collected' && <CustomerFeedback key={`${search.code}:${search.phone}`} code={search.code} phone={search.phone} />}
            <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-4">
              <Button asChild variant="secondary"><Link to="/shop/$slug" params={{ slug: order.shop_slug }}><Store className="size-4" aria-hidden="true" />Visit shop</Link></Button>
              <Button asChild variant="secondary"><Link to="/" search={homeSearch} hash="shops">Explore more shops</Link></Button>
            </div>
          </section>
        )}
      </div>
    </main>
      <footer className="border-t bg-background py-5 text-center text-xs text-muted-foreground">
        <nav aria-label="Footer" className="flex justify-center gap-4">
          <Link to="/" search={homeSearch} className="hover:text-foreground">Home</Link>
          <Link to="/" search={homeSearch} hash="shops" className="hover:text-foreground">Find Shops</Link>
          <Link to="/about" className="hover:text-foreground">About Us</Link>
        </nav>
        <div className="mt-3 flex justify-center"><HisaabooLogo size={24} /></div>
        <p className="mt-2">© Hisaaboo</p>
      </footer>
    </div>
  );
}
