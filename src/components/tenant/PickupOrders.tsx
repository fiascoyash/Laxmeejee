import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { RotateCcw, UtensilsCrossed } from "lucide-react";
import { formatDistance, loadTableFence, parseTableNote, verifyOrderSpot } from "@/lib/tableOrders";
import { ResponseCountdown } from "@/components/pickup/ResponseCountdown";

type Order = Tables<"pickup_orders">;
const NEXT: Record<string, { to: string; label: string }[]> = {
  new: [{ to: "accepted", label: "Accept" }, { to: "cancelled", label: "Decline" }],
  accepted: [{ to: "ready", label: "Mark ready" }, { to: "cancelled", label: "Cancel" }],
  ready: [{ to: "collected", label: "Collected" }, { to: "cancelled", label: "Cancel" }],
  collected: [{ to: "ready", label: "Reopen order" }],
};
const LABEL: Record<string, string> = { new: "New", accepted: "Accepted", ready: "Ready for pickup", collected: "Collected", cancelled: "Cancelled" };

export function PickupOrders({ businessId, version = 0, onClose }: { businessId: string; version?: number; onClose: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<Order | null>(null);
  const fence = loadTableFence(businessId);
  const load = useCallback(async () => {
    const { data } = await supabase.from("pickup_orders").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100);
    setOrders(data ?? []);
  }, [businessId]);
  useEffect(() => { load(); }, [load, version]);

  async function move(o: Order, status: string, reason?: string) {
    setPendingId(o.id);
    setError(null);
    try {
      const now = new Date().toISOString();
      const patch = status === "cancelled" ? { status, updated_at: now, cancelled_by: "merchant", cancel_reason: reason ?? null, cancelled_at: now } : { status, updated_at: now };
      const { data, error: updateError } = await supabase.from("pickup_orders")
        .update(patch)
        .eq("id", o.id).eq("business_id", businessId).eq("status", o.status).select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("Order changed or could not be updated.");
      await load();
    } catch {
      setError("Could not update the order. Refresh and try again.");
    } finally {
      setPendingId(null);
    }
  }
  const list = (orders ?? []).filter((o) => showDone || !["collected", "cancelled"].includes(o.status));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="pickup-orders-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-card text-card-foreground shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="pickup-orders-title" className="text-lg font-semibold">Pickup orders</h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed</label>
            <button type="button" className="text-primary hover:underline" onClick={load}>Refresh</button>
            <button type="button" aria-label="Close" className="text-xl" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
          {orders === null ? <p className="text-sm text-muted-foreground">Loading…</p> : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pickup orders yet. Customers can order from your public shop page.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((o) => {
                const items = (o.items as { name: string; qty: number; price: number; unit: string | null }[]) ?? [];
                const tagged = parseTableNote(o.note);
                return (
                  <li key={o.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{tagged.table && <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"><UtensilsCrossed className="size-3" aria-hidden="true" />{tagged.table}</span>}#{o.order_code} · {o.customer_name} · <a className="text-primary" href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{tagged.table ? "Dine-in · " : ""}{LABEL[o.status]}</span>
                    </div>
                    {tagged.table && <SpotLabel check={verifyOrderSpot(tagged.spot, fence)} table={tagged.table} />}
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</p>
                    {o.status === "new" && <ResponseCountdown createdAt={o.created_at} audience="merchant" />}
                    <CustomerHistory businessId={businessId} phone={o.customer_phone} />
                    {o.status === "cancelled" && <p className="mt-1 rounded bg-destructive/10 p-2 text-xs text-destructive">{o.cancelled_by === "customer" ? "Cancelled by customer" : "Cancelled by shop"}{o.cancel_reason ? ` — “${o.cancel_reason}”` : ""}</p>}
                    <ul className="mt-2">{items.map((i, k) => <li key={k} className="flex justify-between"><span>{i.name} × {i.qty}{i.unit ? ` ${i.unit}` : ""}</span><span>₹{(i.price * i.qty).toLocaleString("en-IN")}</span></li>)}</ul>
                    <p className="mt-1 text-right font-semibold">Total ₹{Number(o.total).toLocaleString("en-IN")}</p>
                    {tagged.note && <p className="mt-1 rounded bg-muted p-2 text-xs">Note: {tagged.note}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {o.status !== "cancelled" && (
                        <Button type="button" size="sm" variant="secondary" disabled={pendingId !== null} onClick={() => { window.dispatchEvent(new CustomEvent("hisaaboo:bill-from-order", { detail: o })); onClose(); }} className="bg-accent font-semibold text-accent-foreground ring-1 ring-primary">Generate GST bill</Button>
                      )}
                      {(NEXT[o.status] ?? []).map((n) => (
                        <Button key={n.to} type="button" size="sm" disabled={pendingId !== null} variant={n.to === "cancelled" || o.status === "collected" ? "outline" : "default"} onClick={() => n.to === "cancelled" ? setCancelFor(o) : move(o, n.to)}>{o.status === "collected" && <RotateCcw aria-hidden="true" />}{n.label}</Button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {cancelFor && <CancelReason order={cancelFor} busy={pendingId !== null} onClose={() => setCancelFor(null)} onConfirm={async (r) => { const o = cancelFor; setCancelFor(null); await move(o, "cancelled", r); }} />}
    </div>
  );
}

function SpotLabel({ check, table }: { check: ReturnType<typeof verifyOrderSpot>; table: string }) {
  if (check.status === "verified") return <p className="mt-1 text-xs font-medium text-success">✓ At restaurant{check.dist != null ? ` · ${formatDistance(check.dist)}` : ""}</p>;
  if (check.status === "far") return <p className="mt-1 rounded bg-destructive/10 p-2 text-xs font-medium text-destructive">⚠ Ordered from {formatDistance(check.dist ?? NaN)} away — look at {table} before cooking. If it's empty, call the customer or decline.</p>;
  return <p className="mt-1 text-xs text-muted-foreground">Location not checked — glance at {table} before cooking.</p>;
}

export const SHOP_CANCEL_REASONS = ["Item out of stock", "Shop / kitchen closing", "Too many orders right now"];
export const CUSTOMER_CANCEL_REASONS = ["Table empty / customer not here", "Customer phone unreachable", "Customer asked to cancel"];

function CancelReason({ order, busy, onClose, onConfirm }: { order: Order; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const chip = (r: string) => <Button key={r} type="button" size="sm" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>{r}</Button>;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/40 p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-reason-title" className="w-full max-w-md space-y-3 rounded-xl bg-card p-4 text-card-foreground shadow-xl">
        <h3 id="cancel-reason-title" className="font-semibold">Why are you cancelling #{order.order_code}?</h3>
        <p className="text-xs text-muted-foreground">The customer sees this reason on their tracking page.</p>
        <p className="text-xs font-medium">Shop reason</p><div className="flex flex-wrap gap-2">{SHOP_CANCEL_REASONS.map(chip)}</div>
        <p className="text-xs font-medium">Customer reason</p><div className="flex flex-wrap gap-2">{CUSTOMER_CANCEL_REASONS.map(chip)}</div>
        <input aria-label="Cancel reason" className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Or write your own reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Keep order</Button>
          <Button type="button" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>Cancel order</Button>
        </div>
      </div>
    </div>
  );
}

const repCache = new Map<string, Promise<{ orders: number; collected: number; customer_cancelled: number } | null>>();
function CustomerHistory({ businessId, phone }: { businessId: string; phone: string }) {
  const [rep, setRep] = useState<{ orders: number; collected: number; customer_cancelled: number } | null>(null);
  useEffect(() => {
    const key = businessId + phone;
    if (!repCache.has(key)) repCache.set(key, Promise.resolve(supabase.rpc("customer_reputation", { _business_id: businessId, _phone: phone })).then(({ data }) => (data as never) ?? null).catch(() => null));
    let alive = true; void repCache.get(key)!.then((r) => { if (alive) setRep(r); });
    return () => { alive = false; };
  }, [businessId, phone]);
  if (!rep || !rep.orders) return null;
  const badge = rep.orders <= 1 ? "New customer" : rep.customer_cancelled / rep.orders > 0.3 ? "Often cancels" : "Reliable customer";
  return <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{badge}</span> · {rep.orders} order{rep.orders > 1 ? "s" : ""}, {rep.collected} collected, {rep.customer_cancelled} cancelled by them</p>;
}
