import { supabase } from "@/integrations/supabase/client";

/** Billing data keys kept on the device and mirrored to the merchant's cloud copy. */
export const isSyncedKey = (k: string) => /^(solar_|laxmeejee_|hisaaboo_)/.test(k);
const OWNER_KEY = "hisaaboo:data-owner";

export function collectLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (isSyncedKey(k)) out[k] = localStorage.getItem(k) ?? "";
  }
  return out;
}

function clearLocal() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (isSyncedKey(k)) keys.push(k); }
  keys.forEach((k) => localStorage.removeItem(k));
}

/** Decide what the device should hold for this merchant: cloud wins; first-time owners upload device data. */
export function planHydrate(remote: Record<string, string> | null, deviceOwner: string | null, userId: string) {
  if (remote) return "use-remote" as const;
  if (deviceOwner && deviceOwner !== userId) return "start-empty" as const;
  return "upload-local" as const;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let activeUser: string | null = null;
let patched = false;

async function push(userId: string) {
  const { error } = await supabase.from("user_settings")
    .upsert({ owner_id: userId, settings: { store: collectLocal() } as never }, { onConflict: "owner_id" });
  if (error) console.warn("Cloud sync failed", error.message);
}

export function schedulePush() {
  if (!activeUser) return;
  const u = activeUser;
  clearTimeout(timer);
  timer = setTimeout(() => void push(u), 1500);
}

function patchStorage() {
  if (patched) return;
  patched = true;
  const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k: string, v: string) { set.call(this, k, v); if (this === localStorage && isSyncedKey(k)) schedulePush(); };
  Storage.prototype.removeItem = function (k: string) { rem.call(this, k); if (this === localStorage && isSyncedKey(k)) schedulePush(); };
  window.addEventListener("pagehide", () => { if (activeUser) void push(activeUser); });
}

/** Load the merchant's cloud copy onto this device, then keep it in sync. */
export async function startSync(userId: string): Promise<void> {
  activeUser = null;
  const { data, error } = await supabase.from("user_settings").select("settings").eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  const remote = ((data?.settings as { store?: Record<string, string> } | null)?.store) ?? null;
  const plan = planHydrate(remote, localStorage.getItem(OWNER_KEY), userId);
  if (plan !== "upload-local") clearLocal();
  if (plan === "use-remote") for (const [k, v] of Object.entries(remote!)) localStorage.setItem(k, v);
  localStorage.setItem(OWNER_KEY, userId);
  activeUser = userId;
  patchStorage();
  if (plan === "upload-local") await push(userId);
}

export async function stopSync() {
  clearTimeout(timer);
  if (activeUser) await push(activeUser);
  activeUser = null;
}
