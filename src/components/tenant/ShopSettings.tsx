import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { db as supabase } from "@/lib/db";
import { storage } from '@/legacy/utils/storage';
import type { ProductCatalogItem } from '@/legacy/types';
import { catalogueRows, validMapsUrl } from '@/lib/shop-catalogue';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { ProductPhoto } from './ProductPhoto';

export type Business = {
  id: string; slug: string; public_name: string; is_published: boolean;
  category: string | null; city: string | null; locality: string | null;
  address: string | null; phone: string | null; hours: string | null; tagline: string | null;
  maps_url?: string | null;
};

function readCatalog(): ProductCatalogItem[] {
  try { return storage.getProductCatalog(); } catch { return []; }
}

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground";

export function ShopSettings({ business, initialTab = "profile", onClose, onSaved, onCatalogueUpdated }: {
  business: Business;
  initialTab?: "profile" | "catalogue" | "qr";
  onClose: () => void;
  onSaved: (b: Business) => void;
  onCatalogueUpdated?: (count: number) => void;
}) {
  const [tab, setTab] = useState<"profile" | "catalogue" | "qr">(initialTab);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shop-settings-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border bg-card text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="shop-settings-title" className="font-semibold">Shop page settings</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
        </div>
        <div className="flex gap-1 border-b px-4 pt-2 text-sm">
          {(["profile", "catalogue", "qr"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-2 ${tab === t ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground"}`}>
              {t === "profile" ? "Shop profile" : t === "catalogue" ? "Online catalogue" : "Counter QR"}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto p-4">
          {tab === "profile" && <ProfileTab business={business} onSaved={onSaved} />}
          {tab === "catalogue" && <CatalogueTab business={business} onUpdated={onCatalogueUpdated} />}
          {tab === "qr" && <QrTab business={business} />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ business, onSaved }: { business: Business; onSaved: (b: Business) => void }) {
  const [f, setF] = useState({
    public_name: business.public_name, tagline: business.tagline ?? "", category: business.category ?? "",
    phone: business.phone ?? "", address: business.address ?? "", locality: business.locality ?? "",
    city: business.city ?? "", hours: business.hours ?? "",
    maps_url: business.maps_url ?? '',
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapsEnabled, setMapsEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.from('businesses').select('maps_url').limit(0).then(({ error }) => { if (active) setMapsEnabled(!error); });
    return () => { active = false; };
  }, []);

  function locate() {
    if (!navigator.geolocation) return setMsg('Location is unavailable. Paste a Google Maps link instead.');
    setLocating(true); setMsg('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setF(current => ({ ...current, maps_url: `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}` }));
      setLocating(false);
    }, () => { setMsg('Location could not be found. Allow location access or paste a Google Maps link.'); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000 });
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.public_name.trim()) return setMsg("Shop name is required.");
    if (mapsEnabled && f.maps_url.trim() && !validMapsUrl(f.maps_url)) return setMsg('Enter a valid Google Maps HTTPS link.');
    setBusy(true); setMsg("");
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Record<string, string | null>;
    if (!mapsEnabled) delete clean['maps_url'];
    const { data, error } = await supabase.from("businesses").update({ ...clean, public_name: f.public_name.trim(), updated_at: new Date().toISOString() })
      .eq("id", business.id).select("*").single();
    setBusy(false);
    if (error) return setMsg("Could not save: " + error.message);
    onSaved(data as Business); setMsg("Saved.");
  }

  const fields: [keyof typeof f, string, string?][] = [
    ["public_name", "Shop name"], ["tagline", "Short line about your shop", "e.g. LED lights & electrical goods since 1995"],
    ["category", "Category", "e.g. Electricals"], ["phone", "Phone"], ["address", "Street address"],
    ["locality", "Area / locality"], ["city", "City"], ["hours", "Timings", "e.g. Mon–Sat 10am–8pm"],
  ];
  return (
    <div className="space-y-3">
      {fields.map(([k, label, ph]) => (
        <label key={k} className="block text-sm">
          <span className="mb-1 block font-medium">{label}</span>
          {k === "address" ? <textarea rows={2} className={input} value={f[k]} onChange={set(k)} />
            : <input className={input} value={f[k]} placeholder={ph} onChange={set(k)} />}
        </label>
      ))}
      <label className="block text-sm"><span className="mb-1 block font-medium">Google Maps location</span><input className={input} value={f.maps_url} onChange={set('maps_url')} disabled={!mapsEnabled} placeholder="https://maps.app.goo.gl/…" /></label>
      <Button type="button" variant="outline" disabled={!mapsEnabled || locating} onClick={locate}><MapPin />{locating ? 'Finding location…' : 'Use current location'}</Button>
      {!mapsEnabled && <p className="text-sm text-muted-foreground">Saved map pins are awaiting store setup permission. Customers can still get directions using your street address.</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save profile"}</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function CatalogueTab({ business, onUpdated }: { business: Business; onUpdated: ((count: number) => void) | undefined }) {
  const [catalog] = useState<ProductCatalogItem[]>(readCatalog);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [photosEnabled, setPhotosEnabled] = useState(false);

  useEffect(() => {
    supabase.from("shop_products").select("product_id").eq("business_id", business.id).then(({ data, error }) => {
      if (error) { setMsg('Could not load published products: ' + error.message); return; }
      setSelected(new Set((data ?? []).map((r) => r.product_id))); setLoaded(true);
    });
    supabase.from('shop_products').select('image_path').limit(0).then(({ error }) => setPhotosEnabled(!error));
  }, [business.id]);

  function toggle(id: string) { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); }

  async function publish() {
    setBusy(true); setMsg("");
    const rows = catalogueRows(business.id, catalog, selected, photosEnabled);
    // Persist defaults too, so billing and the online store share the same catalogue.
    storage.saveProductCatalog(catalog);
    const { error: e2 } = rows.length ? await supabase.from("shop_products").upsert(rows, { onConflict: 'business_id,product_id' }) : { error: null };
    if (e2) { setBusy(false); setMsg('Could not update: ' + e2.message); return; }
    const keep = rows.map((r) => r.product_id);
    let del = supabase.from("shop_products").delete().eq("business_id", business.id);
    if (keep.length) del = del.not("product_id", "in", `(${keep.map((k) => `"${k.replace(/"/g, "")}"`).join(",")})`);
    const { error: e1 } = await del;
    setBusy(false);
    const failed = e1 || e2;
    if (!failed) onUpdated?.(rows.length);
    setMsg(failed ? "Could not update: " + failed.message : `${rows.length} product(s) now on your shop page.`);
  }

  const shown = catalog.filter((p) => [p.name, p.category, p.sku].join(' ').toLowerCase().includes(q.trim().toLowerCase()));
  if (!catalog.length) return <p className="text-sm text-muted-foreground">Your product catalogue is empty. Add products first, then choose which to show online.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Tick the products customers should see on your shop page. Prices use your selling price. Press the button again after changing prices or stock.</p>
      <div className="flex gap-2">
        <input className={input} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="ghost" type="button" disabled={!loaded || busy} onClick={() => setSelected(new Set(catalog.map((p) => p.id)))}>Select all</Button>
        <Button variant="ghost" type="button" disabled={!loaded || busy} onClick={() => setSelected(new Set())}>Clear</Button>
      </div>
      <ul className="max-h-[40vh] divide-y overflow-y-auto rounded-md border">
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={!loaded || busy} />
              {p.imagePath && <ProductPhoto path={p.imagePath} name={p.name} className="h-12 w-12" />}
              <span className="min-w-0 flex-1 break-words">{p.name}{p.category && <span className="block text-xs text-muted-foreground">{p.category}</span>}</span>
              <span className="text-muted-foreground">₹{Number(p.sellingPrice || 0).toLocaleString("en-IN")}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy || !loaded} onClick={publish} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? "Updating…" : `Update shop page (${selected.size})`}</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function QrTab({ business }: { business: Business }) {
  const url = `${window.location.origin}/shop/${business.slug}`;
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(url, { width: 600, margin: 2 }).then(setSrc); }, [url]);

  function print() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${business.public_name} QR</title></head><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h1 style="margin:0">${business.public_name.replace(/</g, "&lt;")}</h1><p style="font-size:18px">Scan to see our products & prices</p>
      <img src="${src}" style="width:360px;height:360px"/><p style="font-size:14px">${url}</p>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-3 text-center">
      {!business.is_published && <p className="rounded-md bg-muted p-2 text-sm text-muted-foreground">Your shop page is not published yet — customers who scan will see "not found" until you publish it.</p>}
      {src && <img src={src} alt="Shop QR code" className="mx-auto h-56 w-56" />}
      <p className="break-all text-sm text-muted-foreground">{url}</p>
      <div className="flex justify-center gap-2">
        <a href={src} download={`${business.slug}-qr.png`} className="rounded-md border px-4 py-2 text-sm">Download</a>
        <button type="button" onClick={print} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Print counter standee</button>
      </div>
    </div>
  );
}
