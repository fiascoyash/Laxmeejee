import { describe, expect, it } from 'vitest';
import { CUSTOMER_LOCATION_KEY, formatDistance, haversineKm, loadCustomerLocation, makeLocation, placeFromNominatim, proximityOf, saveCustomerLocation } from '@/lib/customerLocation';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe('Customer location', () => {
  it('measures distance with the Haversine formula', () => {
    // Bijnor to Najibabad is about 33 km in a straight line.
    const km = haversineKm({ latitude: 29.3732, longitude: 78.1351 }, { latitude: 29.6128, longitude: 78.3436 });
    expect(km).toBeGreaterThan(32);
    expect(km).toBeLessThan(34);
  });
  it('labels distances in metres under 1 km and kilometres above', () => {
    expect(formatDistance(0.6)).toBe('600 m away');
    expect(formatDistance(2.43)).toBe('2.4 km away');
    expect(formatDistance(14.6)).toBe('15 km away');
  });
  it('uses exact distance when both have coordinates', () => {
    const loc = makeLocation({ latitude: 29.3732, longitude: 78.1351 }, 'gps');
    const p = proximityOf({ latitude: 29.3786, longitude: 78.1351, address: null, locality: null, city: null }, loc);
    expect(p.tier).toBe('distance');
    expect(p.label).toBe('600 m away');
  });
  it('remembers the chosen location on this device and can forget it', () => {
    const storage = memory();
    saveCustomerLocation(makeLocation({ city: 'Bijnor', locality: 'Civil Lines', pincode: '246701' }, 'manual', 1), storage);
    expect(loadCustomerLocation(storage)).toMatchObject({ city: 'Bijnor', locality: 'Civil Lines', pincode: '246701', label: 'Civil Lines, Bijnor · 246701' });
    saveCustomerLocation(null, storage);
    expect(storage.getItem(CUSTOMER_LOCATION_KEY)).toBeNull();
  });
  it('rejects empty input and invalid pincodes', () => {
    expect(makeLocation({ city: '  ' }, 'manual')).toBeNull();
    expect(makeLocation({ pincode: '012345' }, 'manual')).toBeNull();
  });
  it('reads locality, city and pincode from a reverse-geocode answer', () => {
    expect(placeFromNominatim({ address: { suburb: 'Civil Lines', city: 'Bijnor', state: 'Uttar Pradesh', postcode: '246701' } })).toEqual({ locality: 'Civil Lines', city: 'Bijnor', pincode: '246701' });
    expect(placeFromNominatim({ address: { village: 'Jhalu', county: 'Bijnor', postcode: '24 67 01' } })).toEqual({ locality: 'Jhalu', city: 'Bijnor', pincode: '246701' });
  });
});
