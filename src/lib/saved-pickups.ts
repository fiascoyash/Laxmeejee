export type SavedPickup = { code: string; phone: string; nickname: string; slug: string };
export const PICKUP_STORAGE_KEY = 'hisaaboo_active_pickups';
const CHANGED = 'hisaaboo:pickups-changed';

export function readSavedPickups(): SavedPickup[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(PICKUP_STORAGE_KEY) ?? '[]');
    return Array.isArray(rows) ? rows.filter((r): r is SavedPickup => r && typeof r.code === 'string' && typeof r.phone === 'string' && typeof r.nickname === 'string' && typeof r.slug === 'string') : [];
  } catch { return []; }
}

export function savePickup(order: SavedPickup): boolean {
  try {
    const rows = readSavedPickups().filter(r => !(r.code === order.code && r.phone === order.phone));
    localStorage.setItem(PICKUP_STORAGE_KEY, JSON.stringify([order, ...rows]));
    window.dispatchEvent(new Event(CHANGED));
    return true;
  } catch { return false; }
}

export function removeSavedPickup(code: string, phone: string) {
  try {
    localStorage.setItem(PICKUP_STORAGE_KEY, JSON.stringify(readSavedPickups().filter(r => !(r.code === code && r.phone === phone))));
    window.dispatchEvent(new Event(CHANGED));
  } catch { /* Tracking still works when browser storage is unavailable. */ }
}

export function watchSavedPickups(refresh: () => void) {
  window.addEventListener('storage', refresh);
  window.addEventListener(CHANGED, refresh);
  return () => { window.removeEventListener('storage', refresh); window.removeEventListener(CHANGED, refresh); };
}