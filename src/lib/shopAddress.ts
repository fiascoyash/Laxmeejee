// Shop address helpers. The map pin is stored inside the existing address text
// as a final "Map pin: lat,lng" line, so no database change is needed.
export const SHOP_CATEGORIES = [
  "Hardware & Electricals", "Solar & Energy", "Grocery & Kirana", "Restaurant & Cafe", "Sweets & Bakery",
  "Fruits & Vegetables", "Dairy & Milk", "Medical & Pharmacy", "Clothing & Fashion", "Footwear",
  "Mobile & Electronics", "Computers & Accessories", "Stationery & Books", "Cosmetics & Beauty", "Salon & Spa",
  "Jewellery", "Furniture & Home Decor", "Kitchenware & Utensils", "Building Materials", "Paints & Sanitary",
  "Auto Parts & Garage", "Toys & Gifts", "Sports & Fitness", "Pet Supplies", "Tailoring", "Printing & Xerox",
];

export const INDIAN_CITIES = [
  "Bijnor", "Najibabad", "Nagina", "Dhampur", "Chandpur", "Kiratpur", "Noorpur", "Sherkot", "Seohara", "Afzalgarh",
  "Moradabad", "Meerut", "Muzaffarnagar", "Saharanpur", "Haridwar", "Roorkee", "Dehradun", "Rampur", "Bareilly",
  "Amroha", "Hapur", "Ghaziabad", "Noida", "Greater Noida", "Delhi", "Aligarh", "Agra", "Mathura", "Lucknow",
  "Kanpur", "Prayagraj", "Varanasi", "Gorakhpur", "Ayodhya", "Jhansi", "Shahjahanpur", "Sitapur", "Budaun",
  "Gurugram", "Faridabad", "Chandigarh", "Jaipur", "Mumbai", "Pune", "Bengaluru", "Hyderabad", "Chennai",
  "Kolkata", "Ahmedabad", "Surat", "Indore", "Bhopal", "Patna", "Ranchi", "Nagpur", "Ludhiana", "Amritsar",
];

export const HOURS_PRESETS = ["Mon–Sat 10am–8pm", "Daily 9am–9pm", "Mon–Sun 8am–10pm", "Mon–Sat 9am–7pm, Sun closed", "Daily 11am–11pm"];

export type Pin = { lat: number; lng: number };
const PIN_RE = /\n?\s*Map pin:\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/i;

export function validPin(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

export function splitAddress(address: string | null | undefined): { street: string; pin: Pin | null } {
  const text = address ?? "";
  const m = text.match(PIN_RE);
  if (!m) return { street: text.trim(), pin: null };
  const lat = Number(m[1]), lng = Number(m[2]);
  return { street: text.replace(PIN_RE, "").trim(), pin: validPin(lat, lng) ? { lat, lng } : null };
}

export function joinAddress(street: string, pin: Pin | null) {
  const s = street.trim();
  if (!pin) return s;
  return `${s}${s ? "\n" : ""}Map pin: ${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`;
}

/** Reads coordinates from a pasted Google Maps link or a plain "lat, lng" text. Short links (maps.app.goo.gl) can't be read. */
export function pinFromText(text: string): Pin | null {
  const t = decodeURIComponent(text.trim());
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) { const lat = Number(m[1]), lng = Number(m[2]); if (validPin(lat, lng)) return { lat, lng }; }
  }
  return null;
}

export const mapsPinUrl = (pin: Pin) => `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;

export function directionsTo(name: string, address: string | null | undefined) {
  const { street, pin } = splitAddress(address);
  const dest = pin ? `${pin.lat},${pin.lng}` : [name, street].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function suggest(list: string[], q: string, limit = 6) {
  const n = q.trim().toLowerCase();
  if (!n) return list.slice(0, limit);
  const starts = list.filter((x) => x.toLowerCase().startsWith(n));
  const has = list.filter((x) => !starts.includes(x) && x.toLowerCase().includes(n));
  return [...starts, ...has].filter((x) => x.toLowerCase() !== n).slice(0, limit);
}

export const isValidIndianPhone = (p: string) => /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/.test(p.replace(/[\s-]/g, ""));
