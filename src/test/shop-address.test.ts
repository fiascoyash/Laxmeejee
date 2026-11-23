import { describe, expect, it } from 'vitest';
import { directionsTo, joinAddress, pinFromText, splitAddress, suggest, isValidIndianPhone } from '@/lib/shopAddress';

describe('shop address pin', () => {
  it('round-trips a pin inside the address text', () => {
    const a = joinAddress('Shop 12, Civil Lines', { lat: 29.372, lng: 78.136 });
    expect(splitAddress(a)).toEqual({ street: 'Shop 12, Civil Lines', pin: { lat: 29.372, lng: 78.136 } });
  });
  it('directions use the pin when present', () => {
    expect(directionsTo('S Kumar', joinAddress('X', { lat: 29.372, lng: 78.136 }))).toContain('destination=29.372%2C78.136');
  });
  it('reads coordinates from a full Google Maps link', () => {
    expect(pinFromText('https://www.google.com/maps/place/X/@29.3721,78.1362,17z')).toEqual({ lat: 29.3721, lng: 78.1362 });
    expect(pinFromText('https://maps.app.goo.gl/abc')).toBeNull();
  });
  it('suggests cities by prefix', () => { expect(suggest(['Bijnor', 'Bareilly', 'Agra'], 'bi')).toEqual(['Bijnor']); });
  it('validates Indian mobile numbers', () => { expect(isValidIndianPhone('9411690904')).toBe(true); expect(isValidIndianPhone('12345')).toBe(false); });
});
