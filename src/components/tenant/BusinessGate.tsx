import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AuthScreen } from "./AuthScreen";
import { OnboardingForm } from "./OnboardingForm";
import { ShopSettings, type Business } from "./ShopSettings";
import { PickupOrders } from "./PickupOrders";
import { installAudioUnlock, loadAlertSettings, startOrderAlert, stopOrderAlert } from "./orderAlerts";
import { BellRing, UtensilsCrossed } from "lucide-react";
import { loadTableFence, newOrderAlert, parseTableNote, verifyOrderSpot } from "@/lib/tableOrders";
import { MerchantStoreProvider, type ShopSettingsTab } from "./store-context";

/** Mark a pickup order collected once its GST bill is saved (non-draft). */
function useBilledOrders(enabled: boolean, onDone: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const h = async (e: Event) => {
      const { orderId } = (e as CustomEvent).detail ?? {};
      if (!orderId) return;
      await supabase.from("pickup_orders").update({ status: "collected", updated_at: new Date().toISOString() }).eq("id", orderId);
      onDone();
    };
    window.addEventListener("hisaaboo:invoice-saved", h);
    return () => window.removeEventListener("hisaaboo:invoice-saved", h);
  }, [enabled, onDone]);
}

const DEMO_NAME = "Solar Energy Solutions Pvt Ltd";

/** Copy the registered shop name into the billing profile when it still shows the demo placeholder. */
function syncCompanyName(b: Business) {
  try {
    const raw = localStorage.getItem("solar_company_profile");
    const prof = raw ? JSON.parse(raw) : null;
    if (!prof) {
      localStorage.setItem("solar_company_profile", JSON.stringify({ companyName: b.public_name, logo: "", gstNumber: "", address: b.address ?? "", email: "", phone: b.phone ?? "", bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", signature: "", businessType: "general", compliance: {} }));
    } else if (!prof.companyName || prof.companyName === DEMO_NAME) {
      localStorage.setItem("solar_company_profile", JSON.stringify({ ...prof, companyName: b.public_name }));
    }
  } catch { /* ignore */ }
}

/** Owner sign-in + business setup in front of the billing app. Data isolation itself is enforced by database policies. */
export function BusinessGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [business, setBusiness] = useState<Business | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<ShopSettingsTab>("profile");
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [newOrders, setNewOrders] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [publishedProducts, setPublishedProducts] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<Tables<"pickup_orders">[]>([]);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [alert, setAlert] = useState<{ text: string; table: string; far: boolean } | null>(null);
  const [ordersVersion, setOrdersVersion] = useState(0);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadBusiness = useCallback(async () => {
    const { data: m } = await supabase.from("business_members").select("business_id").order("created_at").limit(1).maybeSingle();
    if (!m) return setBusiness(null);
    const { data: b } = await supabase.from("businesses").select("*").eq("id", m.business_id).maybeSingle();
    if (b) syncCompanyName(b as Business);
    setBusiness((b as Business) ?? null);
  }, []);

  useEffect(() => {
    if (session) { setBusiness(undefined); loadBusiness(); } else setBusiness(undefined);
  }, [session?.user.id, loadBusiness]);

  const businessId = business?.id;
  const bumpOrders = useCallback(() => setOrdersVersion((v) => v + 1), []);
  const loadStore = useCallback(async () => {
    if (!businessId) return;
    const [newResult, activeResult, productsResult, recentResult] = await Promise.all([
      supabase.from("pickup_orders").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "new"),
      supabase.from("pickup_orders").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["new", "accepted", "ready"]),
      supabase.from("shop_products").select("product_id", { count: "exact", head: true }).eq("business_id", businessId),
      supabase.from("pickup_orders").select("*").eq("business_id", businessId).in("status", ["new", "accepted", "ready"]).order("created_at", { ascending: false }).limit(3),
    ]);
    if (!newResult.error) setNewOrders(newResult.count ?? 0);
    if (!activeResult.error) setActiveOrders(activeResult.count ?? 0);
    if (!productsResult.error) setPublishedProducts(productsResult.count ?? 0);
    if (!recentResult.error) setRecentOrders(recentResult.data ?? []);
    const failed = newResult.error || activeResult.error || productsResult.error || recentResult.error;
    setStoreError(failed ? "Some live store details could not be loaded. Your billing data is unaffected." : null);
  }, [businessId]);

  const handleBilledOrder = useCallback(() => {
    bumpOrders();
    void loadStore();
  }, [bumpOrders, loadStore]);
  useBilledOrders(!!businessId, handleBilledOrder);

  useEffect(() => {
    if (!businessId) {
      setNewOrders(0);
      setActiveOrders(0);
      setPublishedProducts(null);
      setRecentOrders([]);
      return;
    }
    void loadStore();
    const ch = supabase.channel(`orders-${businessId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_orders", filter: `business_id=eq.${businessId}` }, (payload) => {
        setOrdersVersion((v) => v + 1);
        void loadStore();
        if (payload.eventType === "INSERT") {
          const o = payload.new as { customer_name: string; order_code: string; total: number; note?: string | null };
          const fence = loadTableFence(businessId);
          const msg = newOrderAlert(o, fence);
          const tagged = parseTableNote(o.note);
          const far = !!tagged.table && verifyOrderSpot(tagged.spot, fence).status === "far";
          startOrderAlert({ ...loadAlertSettings(businessId), order: { ...(tagged.table ? { table: tagged.table } : {}), customerName: o.customer_name, total: Number(o.total), isFar: far } });
          setAlert({ text: msg.banner, table: tagged.table, far });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(msg.title, { body: msg.body });
        }
      }).subscribe();
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    return () => { supabase.removeChannel(ch); stopOrderAlert(); };
  }, [businessId, loadStore]);

  useEffect(() => installAudioUnlock(), []);
  const dismissAlert = useCallback(() => { stopOrderAlert(); setAlert(null); }, []);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }, [queryClient]);

  const togglePublish = useCallback(async () => {
    if (!business) return;
    setPublishing(true);
    setStoreError(null);
    const { data, error } = await supabase.from("businesses").update({ is_published: !business.is_published }).eq("id", business.id).select("*").single();
    setPublishing(false);
    if (error || !data) {
      setStoreError("Could not change shop visibility. Please try again.");
      return;
    }
    setBusiness(data as Business);
  }, [business]);

  const openOrders = useCallback(() => { stopOrderAlert(); setOrdersOpen(true); }, []);
  const openShopSettings = useCallback((tab: ShopSettingsTab = "profile") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const storeValue = useMemo(() => business ? ({
    business,
    newOrders,
    activeOrders,
    publishedProducts,
    recentOrders,
    ordersVersion,
    storeError,
    publishing,
    openOrders,
    openShopSettings,
    togglePublish,
    signOut,
    refreshStore: loadStore,
  }) : null, [business, newOrders, activeOrders, publishedProducts, recentOrders, ordersVersion, storeError, publishing, openOrders, openShopSettings, togglePublish, signOut, loadStore]);

  if (session === undefined) return <div className="min-h-screen" />;
  if (!session) return <AuthScreen />;
  if (business === undefined) return <div className="min-h-screen" />;
  if (!business || !storeValue) return <OnboardingForm onCreated={loadBusiness} onSignOut={signOut} />;

  return (
    <MerchantStoreProvider value={storeValue}>
      {children}
      {ordersOpen && <PickupOrders businessId={business.id} version={ordersVersion} onClose={() => setOrdersOpen(false)} />}
      {alert && (
        <div role="alert" className="order-alert-banner fixed inset-x-2 top-2 z-[80] mx-auto max-w-xl rounded-xl border-2 border-primary bg-card p-4 text-card-foreground shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="order-alert-bell grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><BellRing className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              {alert.table && <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"><UtensilsCrossed className="size-3" aria-hidden />{alert.table}</span>}
              <p className={`text-sm font-semibold ${alert.far ? "text-destructive" : ""}`}>{alert.text}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90" onClick={() => { dismissAlert(); setOrdersOpen(true); }}>View order</button>
            <button type="button" className="rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted" onClick={dismissAlert}>Mute / Dismiss</button>
          </div>
        </div>
      )}
      {settingsOpen && (
        <ShopSettings
          business={business}
          initialTab={settingsTab}
          onClose={() => setSettingsOpen(false)}
          onSaved={setBusiness}
          onCatalogueUpdated={setPublishedProducts}
        />
      )}
    </MerchantStoreProvider>
  );
}
