/** Table / dine-in QR helpers. The table travels inside the order note as a "[Table 3]" prefix, so no database change is needed. */

export const TABLE_MAX = 30;
export const BULK_MAX = 50;
export const NOTE_MAX = 500;

/** Clean a table name from a URL or input: no brackets/control chars, single spaces, max 30 chars. */
export function normalizeTable(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw).replace(/[\u0000-\u001f[\]<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, TABLE_MAX).trim();
}

/** Note sent with the order: "[Table 3] customer note". */
export function tableNote(table: string, note: string): string {
  const t = normalizeTable(table);
  const n = note.trim();
  if (!t) return n.slice(0, NOTE_MAX);
  return `[${t}]${n ? ` ${n}` : ""}`.slice(0, NOTE_MAX);
}

/** Split a stored note back into its table tag and the customer's own note. */
export function parseTableNote(note: string | null | undefined): { table: string; note: string } {
  const s = note ?? "";
  const m = /^\[([^\]]{1,30})\]\s*/.exec(s);
  if (!m || !m[1]) return { table: "", note: s };
  return { table: m[1].trim(), note: s.slice(m[0].length) };
}

/** Public shop link, optionally for one table. */
export function tableUrl(origin: string, slug: string, table = ""): string {
  const base = `${origin.replace(/\/$/, "")}/shop/${encodeURIComponent(slug)}`;
  const t = normalizeTable(table);
  return t ? `${base}?table=${encodeURIComponent(t).replace(/%20/g, "+")}` : base;
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
export function newOrderAlert(o: { customer_name: string; order_code: string; total: number; note?: string | null }): { banner: string; title: string; body: string } {
  const { table } = parseTableNote(o.note);
  const amount = `₹${Number(o.total).toLocaleString("en-IN")}`;
  if (table) {
    return {
      banner: `New Dine-in order (${table}) — #${o.order_code} from ${o.customer_name} (${amount})`,
      title: `New Dine-in order — ${table}`,
      body: `${o.customer_name} — #${o.order_code} (${amount})`,
    };
  }
  return { banner: `New pickup order #${o.order_code} from ${o.customer_name} — ${amount}`, title: "New pickup order", body: `${o.customer_name} — #${o.order_code}` };
}
