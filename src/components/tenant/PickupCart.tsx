import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { savePickup, type SavedPickup } from "@/lib/saved-pickups";
import { isValidPickupPhone, normalizePickupPhone } from "@/lib/pickup-phone";
import { NOTE_MAX, checkFence, formatDistance, tableNote, type OrderSpot, type TableFence } from "@/lib/tableOrders";

type Blocked = { kind: "outside" | "imprecise" | "denied"; dist?: number; acc?: number };

/** One fresh GPS reading; rejects when location is off, denied or unavailable. */
function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

type P = { product_id: string; name: string; unit: string | null; price: number; in_stock: boolean };

export function useCart() {
  const [qty, setQty] = useState<Record<string, number>>({});
  const set = (id: string, n: number) => setQty((q) => { const c = { ...q }; if (n <= 0) delete c[id]; else c[id] = n; return c; });
  return { qty, set, clear: () => setQty({}) };
}

export function QtyControl({ p, cart }: { p: P; cart: ReturnType<typeof useCart> }) {
  if (!p.in_stock) return null;
  const n = cart.qty[p.product_id] ?? 0;
  if (!n) return <Button type="button" variant="outline" size="sm" onClick={() => cart.set(p.product_id, 1)} className="mt-1">Add</Button>;
  return (
    <div className="mt-1 inline-flex items-center rounded-md border">
      <Button type="button" variant="ghost" size="icon" aria-label="Less" onClick={() => cart.set(p.product_id, n - 1)}>−</Button>
      <span className="min-w-6 text-center text-sm">{n}</span>
      <Button type="button" variant="ghost" size="icon" aria-label="More" onClick={() => cart.set(p.product_id, n + 1)}>+</Button>
    </div>
  );
}

export function PickupCheckout({ slug, products, cart, compact = false, table = "", fence = null, onLeaveTable }: { slug: string; products: P[]; cart: ReturnType<typeof useCart>; compact?: boolean; table?: string; fence?: TableFence | null; onLeaveTable?: () => void }) {
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [placed, setPlaced] = useState<SavedPickup | null>(null);
  const [saved, setSaved] = useState(false);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (placed) confirmation.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }, [placed]);
  const lines = products.filter((p) => (cart.qty[p.product_id] ?? 0));
  const total = lines.reduce((s, p) => s + Number(p.price) * (cart.qty[p.product_id] ?? 0), 0);

  if (placed && !lines.length) return (
    <div ref={confirmation} role="status" className="mt-4 rounded-lg border border-primary bg-primary/5 p-4 text-sm">
      <p className="flex items-start gap-2 font-semibold text-foreground"><CheckCircle2 className="size-5 shrink-0 text-primary" />Order placed for {placed.nickname}!</p>
      <p className="mt-3 text-xs text-muted-foreground">Pickup code</p>
      <p className="mt-1 font-mono text-3xl font-bold">{placed.code}</p>
      <Button asChild size="lg" className="mt-4 w-full"><Link to="/track" search={{ code: placed.code, phone: placed.phone }}>Track Order<ArrowRight /></Link></Button>
      <p className="mt-3 text-xs text-muted-foreground">{saved ? 'Saved on this browser. ' : 'This browser could not save your code. '}Recover active orders with your mobile number and nickname: <strong className="break-words">{placed.nickname}</strong>.</p>
      <p className="mt-2 text-xs text-muted-foreground">Show your code at the counter and pay when you collect.</p>
    </div>
  );
  if (!lines.length) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const normalizedPhone = normalizePickupPhone(phone);
    if (!isValidPickupPhone(normalizedPhone)) { setErr('Enter a valid 10-digit Indian mobile number.'); return; }
    setBusy(true); setBlocked(null);
    try {
      // Table QR with a restaurant spot: only phones inside the restaurant can order to a table.
      let spot: OrderSpot | null = null;
      if (table && fence) {
        setChecking(true);
        let pos: { lat: number; lng: number; accuracy: number };
        try { pos = await currentPosition(); } catch { setBlocked({ kind: "denied" }); return; } finally { setChecking(false); }
        const check = checkFence(fence, pos);
        if (check.result !== "inside") { setBlocked({ kind: check.result, dist: check.dist, acc: Math.round(pos.accuracy) }); return; }
        spot = { lat: pos.lat, lng: pos.lng, acc: Math.round(pos.accuracy), dist: check.dist };
      }
      const { data, error } = await supabase.rpc("place_pickup_order", {
        _slug: slug, _name: name.trim(), _phone: normalizedPhone, _note: tableNote(table, note, spot),
        _items: lines.map((p) => ({ product_id: p.product_id, qty: (cart.qty[p.product_id] ?? 0) })),
      });
      if (error || typeof data !== 'string' || !data) { setErr(error?.message ?? 'Could not place your order. Please try again.'); return; }
      const order = { code: data, phone: normalizedPhone, nickname: name.trim(), slug };
      setSaved(savePickup(order)); setPlaced(order); cart.clear(); setName(""); setPhone(""); setNote("");
    } catch { setErr('Could not place your order. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className={`${compact ? "mt-4 p-3" : "mt-6 p-4"} space-y-3 rounded-lg border`}>
      <h2 className={`${compact ? "text-base" : "text-lg"} font-semibold text-foreground`}>{table ? `Order to ${table}` : "Pick up at store"}</h2>
      {table && <p className="rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground">Dine-in: the shop will see this order is for {table}.</p>}
      {table && fence && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Table orders work only inside the restaurant. We check your location once when you place the order and share it only with this shop.</p>}
      <ul className="text-sm">
        {lines.map((p) => <li key={p.product_id} className="flex justify-between"><span>{p.name} × {(cart.qty[p.product_id] ?? 0)}</span><span>₹{(Number(p.price) * (cart.qty[p.product_id] ?? 0)).toLocaleString("en-IN")}</span></li>)}
        <li className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Estimated total</span><span>₹{total.toLocaleString("en-IN")}</span></li>
      </ul>
      <label className="block text-sm font-medium">Give this order a nickname<input required aria-label="Order nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Batman, Chai Lover… who’s picking up?" minLength={2} maxLength={80} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
      <p className="text-xs text-muted-foreground">Your real name works too. Keep this nickname private — it helps recover your order.</p>
      <input required aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" autoComplete="tel" maxLength={16} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the shop (optional)" maxLength={table ? NOTE_MAX - table.length - (fence ? 45 : 3) : NOTE_MAX} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {blocked && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          {blocked.kind === "outside" && <>
            <p className="font-semibold">Table orders are only available while dining inside the restaurant.</p>
            <p className="text-xs text-muted-foreground">Your phone seems to be about {formatDistance(blocked.dist ?? NaN)} away. Please visit the restaurant to place a table order.</p>
          </>}
          {blocked.kind === "imprecise" && <>
            <p className="font-semibold">We couldn't confirm you're inside the restaurant.</p>
            <p className="text-xs text-muted-foreground">Your phone's location is too rough (±{formatDistance(blocked.acc ?? NaN)}). Turn on GPS / precise location, then try again.</p>
          </>}
          {blocked.kind === "denied" && <>
            <p className="font-semibold">Allow location to order to {table}.</p>
            <p className="text-xs text-muted-foreground">Table orders need a one-time location check so nobody can order to this table from outside. Allow location for this site in your browser, then try again.</p>
          </>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={busy}>Try again</Button>
            {onLeaveTable && <Button type="button" size="sm" variant="ghost" onClick={() => { setBlocked(null); onLeaveTable(); }}>Order for pickup instead</Button>}
          </div>
        </div>
      )}
      <Button type="submit" disabled={busy} className="w-full">{checking ? "Checking you're at the restaurant…" : busy ? "Placing order…" : table ? "Place order" : "Place pickup order"}</Button>
      <p className="text-xs text-muted-foreground">No online payment — pay at the shop when you collect.</p>
    </form>
  );
}
