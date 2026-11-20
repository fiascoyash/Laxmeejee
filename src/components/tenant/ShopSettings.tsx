import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { STORE_THEMES, storeThemeStyle } from "@/lib/store-themes";

export type Business = {
  id: string; slug: string; public_name: string; is_published: boolean;
  category: string | null; city: string | null; locality: string | null;
  address: string | null; phone: string | null; hours: string | null; tagline: string | null;
  accent_color?: string | null;
};

type CatalogItem = { id: string; name: string; category?: string; unit?: string; sellingPrice?: number; description?: string; stockQuantity?: number };

function readCatalog(): CatalogItem[] {
  try { return JSON.parse(localStorage.getItem("solar_product_catalog") || "[]"); } catch { return []; }
}

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground";

export function ShopSettings({ business, initialTab = "profile", onClose, onSaved, onCatalogueUpdated }: {
  business: Business;
  initialTab?: "profile" | "catalogue" | "look" | "qr";
  onClose: () => void;
  onSaved: (b: Business) => void;
  onCatalogueUpdated?: (count: number) => void;
}) {
  const [tab, setTab] = useState<"profile" | "catalogue" | "look" | "qr">(initialTab);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="shop-settings-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border bg-card text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="shop-settings-title" className="font-semibold">Shop page settings</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
        </div>
        <div className="flex gap-1 border-b px-4 pt-2 text-sm">
          {(["profile", "catalogue", "look", "qr"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-2 ${tab === t ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground"}`}>
              {t === "profile" ? "Shop profile" : t === "catalogue" ? "Online catalogue" : t === "look" ? "Photos & colours" : "Counter QR"}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto p-4">
          {tab === "profile" && <ProfileTab business={business} onSaved={onSaved} />}
          {tab === "catalogue" && <CatalogueTab business={business} onUpdated={onCatalogueUpdated} />}
          {tab === "look" && <LookTab business={business} onSaved={onSaved} />}
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
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.public_name.trim()) return setMsg("Shop name is required.");
    setBusy(true); setMsg("");
    const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Record<string, string | null>;
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
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save profile"}</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function CatalogueTab({ business, onUpdated }: { business: Business; onUpdated: ((count: number) => void) | undefined }) {
  const [catalog] = useState<CatalogItem[]>(readCatalog);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("shop_products").select("product_id").eq("business_id", business.id).then(({ data }) => {
      setSelected(new Set((data ?? []).map((r) => r.product_id))); setLoaded(true);
    });
  }, [business.id]);

  function toggle(id: string) { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); }

  async function publish() {
    setBusy(true); setMsg("");
    const { data: existing } = await supabase.from("shop_products").select("product_id, description").eq("business_id", business.id);
    const descs = new Map((existing ?? []).map((r) => [r.product_id, r.description]));
    const rows = catalog.filter((p) => selected.has(p.id)).map((p) => ({
      business_id: business.id, product_id: p.id, name: p.name, category: p.category || null, unit: p.unit || null,
      price: Number(p.sellingPrice) || 0, description: descs.get(p.id) || p.description || null,
      in_stock: (Number(p.stockQuantity) || 0) > 0, updated_at: new Date().toISOString(),
    }));
    const keep = rows.map((r) => r.product_id);
    let del = supabase.from("shop_products").delete().eq("business_id", business.id);
    if (keep.length) del = del.not("product_id", "in", `(${keep.map((k) => `"${k.replace(/"/g, "")}"`).join(",")})`);
    const { error: e1 } = await del;
    const { error: e2 } = rows.length ? await supabase.from("shop_products").upsert(rows) : { error: null };
    setBusy(false);
    const failed = e1 || e2;
    if (!failed) onUpdated?.(rows.length);
    setMsg(failed ? "Could not update: " + failed.message : `${rows.length} product(s) now on your shop page.`);
  }

  const shown = catalog.filter((p) => p.name?.toLowerCase().includes(q.toLowerCase()));
  if (!catalog.length) return <p className="text-sm text-muted-foreground">Your product catalogue is empty. Add products first, then choose which to show online.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Tick the products customers should see on your shop page. Prices use your selling price. Press the button again after changing prices or stock.</p>
      <div className="flex gap-2">
        <input className={input} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="whitespace-nowrap text-sm text-primary" onClick={() => setSelected(new Set(catalog.map((p) => p.id)))}>Select all</button>
        <button type="button" className="text-sm text-muted-foreground" onClick={() => setSelected(new Set())}>Clear</button>
      </div>
      <ul className="max-h-[40vh] divide-y overflow-y-auto rounded-md border">
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={!loaded} />
              <span className="flex-1">{p.name}</span>
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

type ShopRow = { product_id: string; name: string; price: number; category: string | null; image_path: string | null; description?: string | null };

function LookTab({ business, onSaved }: { business: Business; onSaved: (b: Business) => void }) {
  const saved = business.accent_color || "amber";
  const [accent, setAccent] = useState(saved);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ShopRow[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState("");

  async function loadRows() {
    const { data } = await supabase.from("shop_products").select("product_id, name, price, category, image_path, description").eq("business_id", business.id).order("name");
    const list = (data ?? []) as ShopRow[];
    setRows(list);
    const paths = list.map((r) => r.image_path).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("product-photos").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      for (const r of list) { const s = signed?.find((x) => x.path === r.image_path); if (s?.signedUrl) m[r.product_id] = s.signedUrl; }
      setThumbs(m);
    }
  }
  useEffect(() => { void loadRows(); }, [business.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAccent() {
    setBusy(true); setMsg("");
    const { data, error } = await supabase.from("businesses").update({ accent_color: accent, updated_at: new Date().toISOString() }).eq("id", business.id).select("*").single();
    setBusy(false);
    if (error) return setMsg("Could not save: " + error.message);
    onSaved(data as Business); setMsg("Colour saved. Your shop page now uses it.");
  }

  async function upload(row: ShopRow, file: File) {
    setPhotoMsg("");
    if (!file.type.startsWith("image/")) return setPhotoMsg("Please choose a photo file.");
    if (file.size > 5 * 1024 * 1024) return setPhotoMsg("Photo must be smaller than 5 MB.");
    setUploading(row.product_id);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${business.id}/${row.product_id.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-photos").upload(path, file, { contentType: file.type });
    if (!error) {
      const { error: e2 } = await supabase.from("shop_products").update({ image_path: path }).eq("business_id", business.id).eq("product_id", row.product_id);
      if (!e2 && row.image_path) await supabase.storage.from("product-photos").remove([row.image_path]);
      if (e2) setPhotoMsg("Could not save photo: " + e2.message);
    } else setPhotoMsg("Could not upload: " + error.message);
    setUploading(null);
    await loadRows();
  }

  async function saveDetails(row: ShopRow, name: string, description: string) {
    setPhotoMsg("");
    const n = name.trim().slice(0, 120), d = description.trim().slice(0, 500);
    if (n.length < 2) return setPhotoMsg("Product name is too short.");
    const { error } = await supabase.from("shop_products").update({ name: n, description: d || null }).eq("business_id", business.id).eq("product_id", row.product_id);
    if (error) return setPhotoMsg("Could not save details: " + error.message);
    setPhotoMsg("Saved details for " + n + ".");
    await loadRows();
  }

  async function removePhoto(row: ShopRow) {
    if (!row.image_path) return;
    setUploading(row.product_id);
    await supabase.from("shop_products").update({ image_path: null }).eq("business_id", business.id).eq("product_id", row.product_id);
    await supabase.storage.from("product-photos").remove([row.image_path]);
    setUploading(null);
    await loadRows();
  }

  const preview = rows?.slice(0, 2) ?? [];
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-semibold">Shop page colour</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STORE_THEMES.map((t) => (
            <button key={t.id} type="button" onClick={() => setAccent(t.id)} aria-pressed={accent === t.id}
              className={`rounded-lg border p-2 text-xs font-medium transition-all ${accent === t.id ? "border-primary ring-2 ring-primary" : "hover:border-foreground/40"}`}>
              <span className="mb-1 block h-8 rounded-md" style={{ ...storeThemeStyle(t.id), backgroundImage: "var(--gradient-store-hero)" }} />
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Preview (not saved yet)</p>
        <div className="overflow-hidden rounded-xl border bg-store-surface" style={storeThemeStyle(accent)}>
          <div className="flex items-center gap-3 p-4" style={{ backgroundImage: "var(--gradient-store-hero)" }}>
            <span className="flex h-12 w-12 -rotate-3 items-center justify-center rounded-2xl bg-store-deep text-xl font-black text-store-deep-foreground shadow-store-lift">{business.public_name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 text-store-foreground">
              <p className="truncate text-lg font-black">{business.public_name}</p>
              {business.tagline && <p className="truncate text-xs opacity-80">{business.tagline}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {(preview.length ? preview : [{ product_id: "a", name: "Sample item", price: 99 } as ShopRow]).map((p) => (
              <div key={p.product_id} className="rounded-xl bg-background p-2 shadow-store-card">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-store-surface text-2xl font-black text-store-foreground/30">
                  {thumbs[p.product_id] ? <img src={thumbs[p.product_id]} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0)}
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-foreground">{p.name}</p>
                <div className="flex items-center justify-between"><span className="text-sm font-black text-foreground">₹{Number(p.price).toLocaleString("en-IN")}</span><span className="rounded-md bg-store-deep px-2 py-0.5 text-[10px] font-bold text-store-deep-foreground">ADD</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={busy || accent === saved} onClick={saveAccent} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save colour"}</button>
          {accent !== saved && <button type="button" onClick={() => setAccent(saved)} className="text-sm text-muted-foreground">Undo</button>}
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Product photos</h3>
        {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p>
          : rows.length === 0 ? <p className="text-sm text-muted-foreground">Put products on your shop page first (Online catalogue tab), then add their photos here.</p>
          : (
          <ul className="divide-y rounded-md border">
            {rows.map((r) => (
              <li key={r.product_id} className="flex items-center gap-3 p-2 text-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted font-bold text-muted-foreground">
                  {thumbs[r.product_id] && r.image_path ? <img src={thumbs[r.product_id]} alt="" className="h-full w-full object-cover" /> : r.name.charAt(0)}
                </span>
                <DetailsEditor row={r} onSave={saveDetails} />
                {uploading === r.product_id ? <span className="text-xs text-muted-foreground">Uploading…</span> : (
                  <>
                    <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      {r.image_path ? "Change" : "Add photo"}
                      <input type="file" accept="image/*" className="sr-only" aria-label={`Photo for ${r.name}`} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(r, f); }} />
                    </label>
                    {r.image_path && <button type="button" onClick={() => removePhoto(r)} className="text-xs text-destructive">Remove</button>}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {photoMsg && <p className={`text-sm ${photoMsg.startsWith("Saved") ? "text-primary" : "text-destructive"}`}>{photoMsg}</p>}
      </section>
    </div>
  );
}

function DetailsEditor({ row, onSave }: { row: ShopRow; onSave: (r: ShopRow, name: string, desc: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row.name);
  const [desc, setDesc] = useState(row.description ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(row.name); setDesc(row.description ?? ""); }, [row.name, row.description]);
  if (!open) return (
    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(true)}>
      <span className="block truncate">{row.name}</span>
      <span className="block truncate text-xs text-muted-foreground">{row.description || "+ Add product details"}</span>
    </button>
  );
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <input className={input} aria-label="Product name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <textarea className={input} aria-label="Product details" rows={3} maxLength={500} placeholder="Key details: size, brand, pack, use…" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" onClick={async () => { setBusy(true); await onSave(row, name, desc); setBusy(false); setOpen(false); }}>{busy ? "Saving…" : "Save details"}</button>
        <button type="button" className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
