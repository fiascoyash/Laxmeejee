import { useState } from "react";
import {
  ArrowUpRight,
  BellRing,
  Check,
  Copy,
  ExternalLink,
  Package,
  QrCode,
  RefreshCw,
  Share2,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { useMerchantStore } from "./store-context";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  accepted: "Accepted",
  ready: "Ready for pickup",
};

async function copyText(value: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand?.("copy") ?? false;
    field.remove();
    return copied;
  }
}

function billFromOrder(order: Tables<"pickup_orders">) {
  window.dispatchEvent(new CustomEvent("hisaaboo:bill-from-order", { detail: order }));
}

export function OnlineStoreHub() {
  const store = useMerchantStore();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  if (!store) return null;

  const {
    business,
    newOrders,
    activeOrders,
    publishedProducts,
    recentOrders,
    storeError,
    publishing,
    openOrders,
    openShopSettings,
    togglePublish,
    refreshStore,
  } = store;
  const shopUrl = `${window.location.origin}/shop/${business.slug}`;
  const shareText = encodeURIComponent(`Browse ${business.public_name} and order for pickup: ${shopUrl}`);

  async function copyShopLink() {
    const copied = await copyText(shopUrl);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <section aria-labelledby="online-store-heading" className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="online-store-heading" className="text-lg font-bold">Your online store</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${business.is_published ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${business.is_published ? "bg-stock-action" : "bg-muted-foreground"}`} />
                  {business.is_published ? "Live" : "Not published"}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{business.public_name}</p>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Share your shop, keep its catalogue current, and turn customer pickups into GST bills without leaving your desk.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <StoreStat icon={<Package className="h-4 w-4" />} label="Products online" value={publishedProducts === null ? "—" : String(publishedProducts)} />
            <StoreStat icon={<ShoppingBag className="h-4 w-4" />} label="Active pickups" value={String(activeOrders)} />
            <StoreStat icon={<BellRing className="h-4 w-4" />} label="New orders" value={String(newOrders)} highlight={newOrders > 0} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={shopUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" /> View shop page
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copyShopLink}>
              {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copyState === "copied" ? "Link copied" : copyState === "failed" ? "Copy failed" : "Copy shop link"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">
                <Share2 aria-hidden="true" /> Share on WhatsApp
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => openShopSettings("qr")}>
              <QrCode aria-hidden="true" /> Counter QR
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => openShopSettings("catalogue")}>
              Update catalogue <ArrowUpRight aria-hidden="true" />
            </Button>
          </div>
          <Button type="button" size="sm" variant={business.is_published ? "ghost" : "default"} className="mt-3" disabled={publishing} onClick={() => void togglePublish()}>
            {publishing ? "Updating…" : business.is_published ? "Unpublish shop page" : "Publish shop page"}
          </Button>
          {storeError && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <span>{storeError}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void refreshStore()}>
                <RefreshCw aria-hidden="true" /> Retry
              </Button>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Pickup queue</h3>
              <p className="text-xs text-muted-foreground">Latest orders waiting for action</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={openOrders}>View all</Button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
              <ShoppingBag className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No active pickups</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">New customer orders will appear here with a live alert.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y">
              {recentOrders.map((order) => {
                const items = (order.items as { name?: string; qty?: number }[] | null) ?? [];
                const itemSummary = items.map((item) => `${item.name ?? "Item"} × ${item.qty ?? 1}`).join(", ");
                return (
                  <li key={order.id} className="py-3 first:pt-1 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">#{order.order_code} · {order.customer_name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={itemSummary}>{itemSummary || "Pickup order"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold">₹{Number(order.total).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-muted-foreground">{STATUS_LABEL[order.status] ?? order.status}</p>
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="secondary" className="mt-2 w-full" onClick={() => billFromOrder(order)}>
                      Generate GST bill <ArrowUpRight aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function StoreStat({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${highlight ? "bg-secondary" : "bg-background"}`}>
      <div className="flex items-start gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] font-medium uppercase leading-4 tracking-wide sm:text-[11px]">{label}</span></div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
