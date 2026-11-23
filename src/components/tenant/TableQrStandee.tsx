import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { storeTheme } from "@/lib/store-themes";
import { BULK_MAX, FENCE_DEFAULT, FENCE_MAX, FENCE_MIN, bulkTables, loadTableFence, makeFence, normalizeTable, saveTableFence, tableUrl, type TableFence } from "@/lib/tableOrders";

type StandeeBusiness = { id: string; slug: string; public_name: string; is_published: boolean; accent_color?: string | null };
type Card = { table: string; url: string; qr: string };
type Texts = { headline: string; message: string };

const input = "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TAGLINE = "Digital Menu & Smart GST Billing for Modern Shops & Restaurants";
const CTA = "Own a restaurant or shop? Launch your digital store for free at www.hisaaboo.com";

function cardHtml(c: Card, shop: string, t: Texts, accent: string | null | undefined) {
  const th = storeTheme(accent);
  return `<div class="card" style="--accent:${th.store};--accent-fg:${th.fg};--deep:${th.deep}">
    <div class="top"><div class="shop">${esc(shop)}</div>${t.headline ? `<div class="head">${esc(t.headline)}</div>` : ""}</div>
    ${t.message ? `<div class="msg">${esc(t.message)}</div>` : ""}
    <img class="qr" src="${c.qr}" alt="QR"/>
    ${c.table ? `<div class="table">${esc(c.table.toUpperCase())}</div>` : `<div class="table counter">SCAN AT COUNTER</div>`}
    <div class="brand"><div class="pb">⚡ Powered by <b>Hisaaboo</b></div><div class="tag">${esc(TAGLINE)}</div><div class="cta">${esc(CTA)}</div></div>
  </div>`;
}

const CSS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111}
.card{width:105mm;height:148mm;border:3mm solid var(--accent);border-radius:6mm;padding:5mm;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{width:100%;background:var(--accent);color:var(--accent-fg);border-radius:3mm;padding:3mm}
.shop{font-size:17pt;font-weight:900;line-height:1.1;word-break:break-word}.head{font-size:11pt;font-weight:700;margin-top:1mm}
.msg{font-size:8.5pt;margin-top:2mm;line-height:1.3;max-height:13mm;overflow:hidden;white-space:pre-line}
.qr{width:58mm;height:58mm;margin-top:2mm}
.table{margin-top:1mm;background:var(--deep);color:#fff;font-weight:900;font-size:16pt;letter-spacing:.06em;padding:1.5mm 6mm;border-radius:3mm;max-width:100%;word-break:break-word}
.table.counter{font-size:11pt}
.brand{margin-top:auto;width:100%;border-top:0.4mm dashed #bbb;padding-top:2mm}
.pb{font-size:10pt}.pb b{font-weight:900}.tag{font-size:7pt;color:#444;margin-top:.5mm}.cta{font-size:7pt;font-weight:700;margin-top:1mm;color:#111}
.sheet{display:grid;page-break-after:always;break-after:page}
.sheet.four{grid-template-columns:105mm 105mm;grid-template-rows:148mm 148mm;width:210mm;height:296mm}
.sheet.two{grid-template-columns:148mm 148mm;width:297mm;height:209mm}
.sheet.two .card{width:148mm;height:209mm;padding:8mm}.sheet.two .qr{width:85mm;height:85mm}.sheet.two .shop{font-size:24pt}.sheet.two .head{font-size:15pt}.sheet.two .msg{font-size:11pt;max-height:18mm}.sheet.two .table{font-size:22pt}.sheet.two .pb{font-size:13pt}.sheet.two .tag,.sheet.two .cta{font-size:9pt}
.slot{outline:0.2mm dashed #999;display:flex;align-items:center;justify-content:center}
@media screen{body{background:#eee}.sheet{background:#fff;margin:10px auto;box-shadow:0 2px 8px #0002}}`;

function loadTexts(id: string): Texts {
  try { const v = JSON.parse(localStorage.getItem(`hisaaboo_standee_${id}`) || "null"); if (v && typeof v.headline === "string") return { headline: v.headline, message: String(v.message ?? "") }; } catch { /* ignore */ }
  return { headline: "Scan to Order & Dine", message: "" };
}

export function TableQrStandee({ business }: { business: StandeeBusiness }) {
  const origin = typeof window === "undefined" ? "https://hisaaboo.com" : window.location.origin;
  const [mode, setMode] = useState<"counter" | "table">("counter");
  const [bulk, setBulk] = useState(false);
  const [single, setSingle] = useState("Table 1");
  const [prefix, setPrefix] = useState("Table ");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [layout, setLayout] = useState<"four" | "two">("four");
  const [texts, setTexts] = useState<Texts>(() => loadTexts(business.id));
  const [cards, setCards] = useState<Card[]>([]);
  const [fence, setFence] = useState<TableFence | null>(() => loadTableFence(business.id));
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [saved, setSaved] = useState(false);
  function updateFence(f: TableFence | null) { setFence(f); saveTableFence(business.id, f); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  function useHere() {
    if (!navigator.geolocation) { setLocError("This device can't share its location."); return; }
    setLocating(true); setLocError("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); updateFence(makeFence(p.coords.latitude, p.coords.longitude, fence?.r ?? FENCE_DEFAULT)); },
      () => { setLocating(false); setLocError("Couldn't get your location. Allow location access and stand inside the restaurant, then try again."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  useEffect(() => { try { localStorage.setItem(`hisaaboo_standee_${business.id}`, JSON.stringify(texts)); } catch { /* ignore */ } }, [texts, business.id]);

  const tables = useMemo(() => mode === "counter" ? [""] : bulk ? bulkTables(prefix, from, to) : [normalizeTable(single)].filter(Boolean), [mode, bulk, single, prefix, from, to]);

  useEffect(() => {
    let alive = true;
    Promise.all(tables.map(async (table) => {
      const url = tableUrl(origin, business.slug, table, fence);
      return { table, url, qr: await QRCode.toDataURL(url, { width: 600, margin: 1 }) };
    })).then((c) => { if (alive) setCards(c); });
    return () => { alive = false; };
  }, [tables, origin, business.slug, fence]);

  const first = cards[0];
  const previewDoc = first ? `<html><head><style>${CSS} body{background:transparent;display:flex;justify-content:center;padding:8px}</style></head><body>${cardHtml(first, business.public_name, texts, business.accent_color)}</body></html>` : "";

  function print() {
    const w = window.open("", "_blank");
    if (!w || !cards.length) return;
    const per = layout === "four" ? 4 : 2;
    const sheets: string[] = [];
    for (let i = 0; i < cards.length; i += per) {
      sheets.push(`<div class="sheet ${layout}">${cards.slice(i, i + per).map((c) => `<div class="slot">${cardHtml(c, business.public_name, texts, business.accent_color)}</div>`).join("")}</div>`);
    }
    w.document.write(`<html><head><title>${esc(business.public_name)} QR standees</title><style>@page{size:A4 ${layout === "four" ? "portrait" : "landscape"};margin:0}${CSS}</style></head><body>${sheets.join("")}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }

  async function downloadPng(c: Card) {
    const th = storeTheme(business.accent_color);
    const W = 800, H = 1100, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    if (!g) return;
    const img = new Image();
    await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); img.src = c.qr; });
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.fillStyle = th.store; g.fillRect(0, 0, W, 170);
    g.textAlign = "center"; g.fillStyle = th.fg;
    g.font = "900 54px system-ui, sans-serif"; g.fillText(business.public_name.slice(0, 26), W / 2, 85);
    g.font = "700 32px system-ui, sans-serif"; g.fillText(texts.headline.slice(0, 40), W / 2, 140);
    g.drawImage(img, 140, 210, 520, 520);
    g.fillStyle = th.deep; g.fillRect(150, 760, 500, 100);
    g.fillStyle = "#fff"; g.font = "900 52px system-ui, sans-serif"; g.fillText((c.table || "Scan at counter").toUpperCase().slice(0, 18), W / 2, 830);
    g.fillStyle = "#111"; g.font = "400 30px system-ui, sans-serif"; g.fillText("⚡ Powered by Hisaaboo", W / 2, 950);
    g.fillStyle = "#444"; g.font = "400 22px system-ui, sans-serif"; g.fillText("Launch your digital store for free at www.hisaaboo.com", W / 2, 995);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = `${business.slug}${c.table ? `-${c.table.replace(/\s+/g, "-").toLowerCase()}` : ""}-qr.png`;
    a.click();
  }

  const tab = (on: boolean) => `rounded-md px-3 py-1.5 text-sm ${on ? "bg-primary font-medium text-primary-foreground" : "border text-muted-foreground"}`;
  return (
    <div className="space-y-4">
      {!business.is_published && <p className="rounded-md bg-muted p-2 text-sm text-muted-foreground">Your shop page is not published yet — customers who scan will see "not found" until you publish it.</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="QR type">
        <button type="button" aria-pressed={mode === "counter"} className={tab(mode === "counter")} onClick={() => setMode("counter")}>Main counter / shop QR</button>
        <button type="button" aria-pressed={mode === "table"} className={tab(mode === "table")} onClick={() => setMode("table")}>Table / dine-in QR</button>
      </div>

      {mode === "table" && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex gap-2 text-sm">
            <label className="flex items-center gap-1"><input type="radio" checked={!bulk} onChange={() => setBulk(false)} /> One table</label>
            <label className="flex items-center gap-1"><input type="radio" checked={bulk} onChange={() => setBulk(true)} /> Many tables at once</label>
          </div>
          {!bulk ? (
            <label className="block text-sm"><span className="mb-1 block font-medium">Table or area name</span><input aria-label="Table name" className={input} value={single} maxLength={30} placeholder="Table 5, Balcony 2, Garden Lounge" onChange={(e) => setSingle(e.target.value)} /></label>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <label className="col-span-3 sm:col-span-1"><span className="mb-1 block font-medium">Name before number</span><input aria-label="Table prefix" className={input} value={prefix} maxLength={20} onChange={(e) => setPrefix(e.target.value)} /></label>
              <label><span className="mb-1 block font-medium">From</span><input aria-label="From number" type="number" min={0} className={input} value={from} onChange={(e) => setFrom(Number(e.target.value))} /></label>
              <label><span className="mb-1 block font-medium">To</span><input aria-label="To number" type="number" min={0} className={input} value={to} onChange={(e) => setTo(Number(e.target.value))} /></label>
              <p className="col-span-3 text-xs text-muted-foreground">{tables.length ? `${tables.length} card(s): ${tables[0]} … ${tables[tables.length - 1]}` : "Enter a valid number range."} Up to {BULK_MAX} at a time.</p>
            </div>
          )}
        </div>
      )}

      {mode === "table" && (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p className="font-medium">Stop fake orders from home</p>
          <p className="text-xs text-muted-foreground">Save your restaurant's spot while standing inside it. Table orders will then work only within the range you pick.</p>
          {fence ? (
            <p className="rounded bg-success/10 p-2 text-xs text-success">✓ Location saved — table orders work within {fence.r} m of your restaurant.</p>
          ) : (
            <p className="rounded bg-warning/10 p-2 text-xs text-warning-foreground">Location not saved — anyone with a QR photo can order. Orders will show "Location not checked".</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={locating} onClick={useHere} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">{locating ? "Finding location…" : fence ? "Update to my current location" : "Use my current location"}</button>
            {fence && <button type="button" onClick={() => updateFence(null)} className="rounded-md border px-3 py-1.5 text-sm">Turn off location check</button>}
            {saved && <span className="text-xs text-success">Saved</span>}
          </div>
          {fence && (
            <label className="block"><span className="mb-1 block text-xs font-medium">Allowed range: {fence.r} m</span>
              <input aria-label="Allowed range in metres" type="range" min={FENCE_MIN} max={FENCE_MAX} step={50} value={fence.r} onChange={(e) => updateFence(makeFence(fence.lat, fence.lng, Number(e.target.value)))} className="w-full" />
            </label>
          )}
          {locError && <p role="alert" className="text-xs text-destructive">{locError}</p>}
          {fence && <p className="text-xs text-muted-foreground">Reprint your table QRs after saving or changing this — older printed QRs don't carry the location.</p>}
        </div>
      )}

      <div className="grid gap-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">Headline</span><input aria-label="Headline" className={input} value={texts.headline} maxLength={40} onChange={(e) => setTexts({ ...texts, headline: e.target.value })} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Message for customers (optional)</span><textarea aria-label="Message" rows={2} className={input} value={texts.message} maxLength={140} placeholder="e.g. Freshly cooked to order. Wi-Fi: FoodieGuest / Welcome123" onChange={(e) => setTexts({ ...texts, message: e.target.value })} /></label>
      </div>

      {first && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview{cards.length > 1 ? ` (first of ${cards.length})` : ""}</p>
          <iframe title="Standee preview" srcDoc={previewDoc} className="mx-auto block h-[600px] w-[430px] max-w-full rounded-md border bg-muted" />
          <p className="break-all text-center text-xs text-muted-foreground">{first.url}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <select aria-label="Cards per page" className="rounded-md border bg-background px-2 py-2 text-sm" value={layout} onChange={(e) => setLayout(e.target.value as "four" | "two")}>
          <option value="four">4 per A4 page (A6 cards)</option>
          <option value="two">2 per A4 page (A5 cards)</option>
        </select>
        <button type="button" disabled={!cards.length} onClick={print} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">Print standee{cards.length > 1 ? "s" : ""}</button>
        {cards.length === 1 && first && <button type="button" onClick={() => void downloadPng(first)} className="rounded-md border px-4 py-2 text-sm">Download PNG</button>}
      </div>
      {cards.length > 1 && (
        <details className="text-sm"><summary className="cursor-pointer text-primary">Download PNG for one table</summary>
          <div className="mt-2 flex flex-wrap gap-2">{cards.map((c) => <button key={c.table} type="button" onClick={() => void downloadPng(c)} className="rounded-md border px-2 py-1 text-xs">{c.table}</button>)}</div>
        </details>
      )}
    </div>
  );
}
