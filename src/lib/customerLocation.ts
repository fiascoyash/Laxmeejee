// Customer location for nearby-shop discovery. Stored only in this browser,
// separate from merchant billing storage.
export type CustomerLocation = {
  latitude?: number;
  longitude?: number;
  city?: string;
  locality?: string;
  pincode?: string;
  label: string;
  source: 'gps' | 'manual';
  savedAt: number;
};

export const CUSTOMER_LOCATION_KEY = 'hisaaboo_customer_location';

type Locatable = { latitude?: number | null; longitude?: number | null; pincode?: string | null; address: string | null; locality: string | null; city: string | null };

export type Proximity = {
  /** Lower is closer. Kilometres when both sides have coordinates, otherwise a match tier. */
  rank: number;
  tier: 'distance' | 'pincode' | 'locality' | 'city' | 'none';
  distanceKm?: number;
  label?: string;
};

const clean = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const norm = (v: string | null | undefined) => (v ?? '').toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isValidPincode = (v: string) => /^[1-9]\d{5}$/.test(v);

export function pincodeFrom(text: string | null | undefined): string | undefined {
  return (text ?? '').match(/\b[1-9]\d{5}\b/)?.[0];
}

export function locationLabel(parts: { locality?: string | undefined; city?: string | undefined; pincode?: string | undefined }) {
  const place = [parts.locality, parts.city].filter(Boolean).join(', ');
  return [place, parts.pincode].filter(Boolean).join(' · ') || 'Your current location';
}

/** Builds a location from user input, returning null when nothing usable was given. */
export function makeLocation(input: { latitude?: number | undefined; longitude?: number | undefined; city?: unknown; locality?: unknown; pincode?: unknown }, source: CustomerLocation['source'], now = Date.now()): CustomerLocation | null {
  const city = clean(input.city);
  const locality = clean(input.locality);
  const pin = clean(input.pincode, 6);
  const pincode = isValidPincode(pin) ? pin : '';
  const { latitude, longitude } = input;
  const hasCoords = finite(latitude) && finite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  if (!hasCoords && !city && !locality && !pincode) return null;
  const loc: CustomerLocation = { label: locationLabel({ locality: locality || undefined, city: city || undefined, pincode: pincode || undefined }), source, savedAt: now };
  if (hasCoords && finite(latitude) && finite(longitude)) { loc.latitude = latitude; loc.longitude = longitude; }
  if (city) loc.city = city;
  if (locality) loc.locality = locality;
  if (pincode) loc.pincode = pincode;
  return loc;
}

export function loadCustomerLocation(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): CustomerLocation | null {
  try {
    const raw = storage?.getItem(CUSTOMER_LOCATION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    return makeLocation({
      latitude: finite(v['latitude']) ? v['latitude'] : undefined,
      longitude: finite(v['longitude']) ? v['longitude'] : undefined,
      city: v['city'], locality: v['locality'], pincode: v['pincode'],
    }, v['source'] === 'gps' ? 'gps' : 'manual', finite(v['savedAt']) ? v['savedAt'] : Date.now());
  } catch {
    return null;
  }
}

export function saveCustomerLocation(loc: CustomerLocation | null, storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = globalThis.localStorage) {
  try {
    if (!loc) storage?.removeItem(CUSTOMER_LOCATION_KEY);
    else storage?.setItem(CUSTOMER_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // Private browsing or full storage: the choice still applies for this visit.
  }
}

export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

const sameOrContains = (a: string, b: string) => !!a && !!b && (a === b || a.includes(b) || b.includes(a));

/** How close a shop is to the customer: exact distance when coordinates exist, else pincode → locality → city. */
export function proximityOf(shop: Locatable, loc: CustomerLocation | null): Proximity {
  if (!loc) return { rank: 100, tier: 'none' };
  if (finite(loc.latitude) && finite(loc.longitude) && finite(shop.latitude) && finite(shop.longitude)) {
    const km = haversineKm({ latitude: loc.latitude, longitude: loc.longitude }, { latitude: shop.latitude, longitude: shop.longitude });
    return { rank: km, tier: 'distance', distanceKm: km, label: formatDistance(km) };
  }
  const shopPin = shop.pincode ?? pincodeFrom(shop.address);
  if (loc.pincode && shopPin && loc.pincode === shopPin) return { rank: 1, tier: 'pincode', label: 'In your area' };
  const area = norm(loc.locality);
  if (area && (sameOrContains(norm(shop.locality), area) || norm(shop.address).includes(area))) return { rank: 2, tier: 'locality', label: 'In your area' };
  const city = norm(loc.city);
  if (city && (norm(shop.city) === city || norm(shop.address).includes(city))) return { rank: 8, tier: 'city', label: `In ${shop.city?.trim() || loc.city}` };
  return { rank: 100, tier: 'none' };
}

/** Turns an OpenStreetMap Nominatim reverse-geocode response into readable place parts. */
export function placeFromNominatim(json: unknown): { locality?: string; city?: string; pincode?: string } {
  const a = (json && typeof json === 'object' ? (json as { address?: Record<string, unknown> }).address : undefined) ?? {};
  const pick = (...keys: string[]) => { for (const k of keys) { const v = clean(a[k]); if (v) return v; } return undefined; };
  const city = pick('city', 'town', 'municipality', 'county', 'state_district');
  const locality = pick('suburb', 'neighbourhood', 'quarter', 'city_district', 'village', 'hamlet', 'residential');
  const postcode = clean(a['postcode'], 12).replace(/\s/g, '');
  const out: { locality?: string; city?: string; pincode?: string } = {};
  if (locality && locality !== city) out.locality = locality;
  if (city) out.city = city;
  if (isValidPincode(postcode)) out.pincode = postcode;
  return out;
}

export async function reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=en&lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}`;
  const res = await fetch(url, signal ? { signal, headers: { Accept: 'application/json' } } : { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  return placeFromNominatim(await res.json());
}
