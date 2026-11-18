import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { savePickup, type SavedPickup } from "@/lib/saved-pickups";
import { isValidPickupPhone, normalizePickupPhone } from "@/lib/pickup-phone";

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

export function PickupCheckout({ slug, products, cart, compact = false }: { slug: string; products: P[]; cart: ReturnType<typeof useCart>; compact?: boolean }) {
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
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("place_pickup_order", {
        _slug: slug, _name: name.trim(), _phone: normalizedPhone, _note: note,
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
      <h2 className={`${compact ? "text-base" : "text-lg"} font-semibold text-foreground`}>Pick up at store</h2>
      <ul className="text-sm">
        {lines.map((p) => <li key={p.product_id} className="flex justify-between"><span>{p.name} × {(cart.qty[p.product_id] ?? 0)}</span><span>₹{(Number(p.price) * (cart.qty[p.product_id] ?? 0)).toLocaleString("en-IN")}</span></li>)}
        <li className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Estimated total</span><span>₹{total.toLocaleString("en-IN")}</span></li>
      </ul>
      <label className="block text-sm font-medium">Give this order a nickname<input required aria-label="Order nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Batman, Chai Lover… who’s picking up?" minLength={2} maxLength={80} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" /></label>
      <p className="text-xs text-muted-foreground">Your real name works too. Keep this nickname private — it helps recover your order.</p>
      <input required aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" autoComplete="tel" maxLength={16} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the shop (optional)" maxLength={500} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Placing order…" : "Place pickup order"}</Button>
      <p className="text-xs text-muted-foreground">No online payment — pay at the shop when you collect.</p>
    </form>
  );
}
