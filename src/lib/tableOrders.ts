/** Table / dine-in QR helpers. The table travels inside the order note as a "[Table 3]" prefix, so no database change is needed. */

export const TABLE_MAX = 30;
export const BULK_MAX = 50;
export const NOTE_MAX = 500;

/** Clean a table name from a URL or input: no brackets/control chars, single spaces, max 30 chars. */
export function normalizeTable(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw).replace(/[\u0000-\u001f[\]<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, TABLE_MAX).trim();
}

/* ---------- Dine-in location check (stops orders from a screenshot at home) ---------- */

/** Restaurant spot + allowed radius (metres). Travels in the table QR link as ?geo=lat,lng,radius. */
export type TableFence = { lat: number; lng: number; r: number };
/** Where the customer's phone was when they ordered: coords, GPS accuracy and distance to the restaurant (metres). */
export type OrderSpot = { lat: number; lng: number; acc: number; dist: number };

export const FENCE_DEFAULT = 150;
export const FENCE_MIN = 50;
export const FENCE_MAX = 1000;
/** GPS readings rougher than this cannot prove the customer is inside. */
export const ACCURACY_MAX = 500;
/** Extra slack for normal indoor GPS drift. */
const DRIFT_MAX = 100;

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const okLat = (v: number) => Number.isFinite(v) && Math.abs(v) <= 90;
const okLng = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function makeFence(lat: unknown, lng: unknown, r: unknown = FENCE_DEFAULT): TableFence | null {
  const la = num(lat), ln = num(lng), rr = Math.round(num(r));
  if (!okLat(la) || !okLng(ln) || (la === 0 && ln === 0)) return null;
  return { lat: Math.round(la * 1e5) / 1e5, lng: Math.round(ln * 1e5) / 1e5, r: Number.isFinite(rr) ? Math.min(FENCE_MAX, Math.max(FENCE_MIN, rr)) : FENCE_DEFAULT };
}

export const encodeFence = (f: TableFence) => `${f.lat},${f.lng},${f.r}`;

export function parseFence(raw: unknown): TableFence | null {
  if (typeof raw !== "string") return null;
  const [a, b, c] = raw.split(",");
  return makeFence(a, b, c ?? FENCE_DEFAULT);
}

/** Customer side: can this GPS reading place a table order? */
export function checkFence(fence: TableFence, pos: { lat: number; lng: number; accuracy: number }):
  { result: "inside" | "outside" | "imprecise"; dist: number } {
  const dist = Math.round(distanceMeters(fence, pos));
  const acc = Number.isFinite(pos.accuracy) ? Math.max(0, pos.accuracy) : Infinity;
  if (dist <= fence.r + Math.min(acc, DRIFT_MAX)) return { result: "inside", dist };
  if (acc > ACCURACY_MAX) return { result: "imprecise", dist };
  return { result: "outside", dist };
}

/** "35 m" / "2.3 km" */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return "";
  return m < 1000 ? `${Math.max(0, Math.round(m))} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Merchant side: was this table order placed at the restaurant? Uses the owner's saved spot when known (catches edited links). */
export function verifyOrderSpot(spot: OrderSpot | null, fence: TableFence | null):
  { status: "verified" | "far" | "unchecked"; dist: number | null } {
  if (!spot) return { status: "unchecked", dist: null };
  if (fence) {
    const dist = Math.round(distanceMeters(fence, spot));
    return { status: dist <= fence.r + Math.min(spot.acc, DRIFT_MAX) ? "verified" : "far", dist };
  }
  return { status: "verified", dist: spot.dist };
}

/** Note sent with the order: "[Table 3] customer note", plus "[@lat,lng,acc,dist]" after the table when the location was checked. */
export function tableNote(table: string, note: string, spot?: OrderSpot | null): string {
  const t = normalizeTable(table);
  const n = note.trim();
  if (!t) return n.slice(0, NOTE_MAX);
  const at = spot && okLat(spot.lat) && okLng(spot.lng)
    ? `[@${spot.lat.toFixed(5)},${spot.lng.toFixed(5)},${Math.round(spot.acc)},${Math.round(spot.dist)}]` : "";
  return `[${t}]${at}${n ? ` ${n}` : ""}`.slice(0, NOTE_MAX);
}

/** Split a stored note back into its table tag, location check and the customer's own note. */
export function parseTableNote(note: string | null | undefined): { table: string; note: string; spot: OrderSpot | null } {
  const s = note ?? "";
  const m = /^\[([^\]@][^\]]{0,29})\]\s*/.exec(s);
  if (!m || !m[1]) return { table: "", note: s, spot: null };
  let rest = s.slice(m[0].length);
  let spot: OrderSpot | null = null;
  const g = /^\[@(-?[\d.]+),(-?[\d.]+),(\d+),(\d+)\]\s*/.exec(rest);
  if (g) {
    const lat = Number(g[1]), lng = Number(g[2]);
    if (okLat(lat) && okLng(lng)) spot = { lat, lng, acc: Number(g[3]), dist: Number(g[4]) };
    rest = rest.slice(g[0].length);
  }
  return { table: m[1].trim(), note: rest, spot };
}

/** Public shop link, optionally for one table; table links carry the restaurant spot when the owner set one. */
export function tableUrl(origin: string, slug: string, table = "", fence: TableFence | null = null): string {
  const base = `${origin.replace(/\/$/, "")}/shop/${encodeURIComponent(slug)}`;
  const t = normalizeTable(table);
  if (!t) return base;
  return `${base}?table=${encodeURIComponent(t).replace(/%20/g, "+")}${fence ? `&geo=${encodeFence(fence)}` : ""}`;
}

/** Owner's restaurant spot, kept on the owner's device next to the standee texts. */
export function loadTableFence(businessId: string): TableFence | null {
  try {
    const v = JSON.parse(localStorage.getItem(`hisaaboo_table_geo_${businessId}`) || "null");
    return v ? makeFence(v.lat, v.lng, v.r) : null;
  } catch { return null; }
}
export function saveTableFence(businessId: string, fence: TableFence | null) {
  try {
    if (fence) localStorage.setItem(`hisaaboo_table_geo_${businessId}`, JSON.stringify(fence));
    else localStorage.removeItem(`hisaaboo_table_geo_${businessId}`);
  } catch { /* storage unavailable */ }
}

/** "Table " + 1..10 → ["Table 1", …]; capped at 50 cards. */
export function bulkTables(prefix: string, from: number, to: number): string[] {
  const a = Math.floor(Number(from)), b = Math.floor(Number(to));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) return [];
  const out: string[] = [];
  for (let i = a; i <= b && out.length < BULK_MAX; i++) {
    const name = normalizeTable(`${prefix}${i}`);
    if (name) out.push(name);
  }
  return out;
}

/** Texts for the merchant's instant new-order banner and browser notification; table orders name the table. */
export function newOrderAlert(o: { customer_name: string; order_code: string; total: number; note?: string | null }, fence: TableFence | null = null): { banner: string; title: string; body: string } {
  const { table, spot } = parseTableNote(o.note);
  const amount = `₹${Number(o.total).toLocaleString("en-IN")}`;
  if (table) {
    const check = verifyOrderSpot(spot, fence);
    const warn = check.status === "far" ? ` ⚠ Placed ${formatDistance(check.dist ?? NaN)} from the restaurant — check ${table} before cooking` : "";
    return {
      banner: `New Dine-in order (${table}) — #${o.order_code} from ${o.customer_name} (${amount})${warn}`,
      title: `New Dine-in order — ${table}${check.status === "far" ? " ⚠" : ""}`,
      body: `${o.customer_name} — #${o.order_code} (${amount})${check.status === "far" ? ` · placed ${formatDistance(check.dist ?? NaN)} away` : ""}`,
    };
  }
  return { banner: `New pickup order #${o.order_code} from ${o.customer_name} — ${amount}`, title: "New pickup order", body: `${o.customer_name} — #${o.order_code}` };
}
