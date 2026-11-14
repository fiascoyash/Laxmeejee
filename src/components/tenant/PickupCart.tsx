import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type P = { product_id: string; name: string; unit: string | null; price: number; in_stock: boolean };

export function useCart() {
  const [qty, setQty] = useState<Record<string, number>>({});
  const set = (id: string, n: number) => setQty((q) => { const c = { ...q }; if (n <= 0) delete c[id]; else c[id] = n; return c; });
  return { qty, set, clear: () => setQty({}) };
}

export function QtyControl({ p, cart }: { p: P; cart: ReturnType<typeof useCart> }) {
  if (!p.in_stock) return null;
  const n = cart.qty[p.product_id] ?? 0;
  if (!n) return <button type="button" onClick={() => cart.set(p.product_id, 1)} className="mt-1 rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10">Add</button>;
  return (
    <div className="mt-1 inline-flex items-center rounded-md border">
      <button type="button" aria-label="Less" className="px-2 py-1" onClick={() => cart.set(p.product_id, n - 1)}>−</button>
      <span className="min-w-6 text-center text-sm">{n}</span>
      <button type="button" aria-label="More" className="px-2 py-1" onClick={() => cart.set(p.product_id, n + 1)}>+</button>
    </div>
  );
}

export function PickupCheckout({ slug, products, cart }: { slug: string; products: P[]; cart: ReturnType<typeof useCart> }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [code, setCode] = useState("");
  const lines = products.filter((p) => (cart.qty[p.product_id] ?? 0));
  const total = lines.reduce((s, p) => s + Number(p.price) * (cart.qty[p.product_id] ?? 0), 0);

  if (code) return (
    <div className="mt-6 rounded-lg border border-primary bg-primary/5 p-4 text-sm">
      <p className="font-semibold text-foreground">Order placed! Your pickup code is <span className="text-lg tracking-widest">{code}</span></p>
      <p className="mt-1 text-muted-foreground">Show this code at the shop counter. Payment is made at the shop when you collect.</p>
      <button type="button" className="mt-3 text-primary hover:underline" onClick={() => setCode("")}>Place another order</button>
    </div>
  );
  if (!lines.length) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const { data, error } = await supabase.rpc("place_pickup_order", {
      _slug: slug, _name: name, _phone: phone, _note: note,
      _items: lines.map((p) => ({ product_id: p.product_id, qty: (cart.qty[p.product_id] ?? 0) })),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setCode(data as string); cart.clear(); setName(""); setPhone(""); setNote("");
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold text-foreground">Pick up at store</h2>
      <ul className="text-sm">
        {lines.map((p) => <li key={p.product_id} className="flex justify-between"><span>{p.name} × {(cart.qty[p.product_id] ?? 0)}</span><span>₹{(Number(p.price) * (cart.qty[p.product_id] ?? 0)).toLocaleString("en-IN")}</span></li>)}
        <li className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Estimated total</span><span>₹{total.toLocaleString("en-IN")}</span></li>
      </ul>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" maxLength={14} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the shop (optional)" maxLength={500} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "Placing order…" : "Place pickup order"}</button>
      <p className="text-xs text-muted-foreground">No online payment — pay at the shop when you collect.</p>
    </form>
  );
}
