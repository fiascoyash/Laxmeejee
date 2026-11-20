import { describe, expect, it } from 'vitest';
import { isValidPickupPhone, normalizePickupPhone } from '@/lib/pickup-phone';

describe('Guest pickup mobile number', () => {
  it('accepts a 10-digit Indian mobile number', () => {
    expect(isValidPickupPhone('9876543210')).toBe(true);
  });

  it('normalizes a +91 country code before saving or tracking', () => {
    expect(normalizePickupPhone('+91 98765 43210')).toBe('9876543210');
    expect(isValidPickupPhone('+91 98765 43210')).toBe(true);
  });

  it.each(['1234567890', '987654321', '98765432109', ''])('rejects invalid mobile number %s', value => {
    expect(isValidPickupPhone(value)).toBe(false);
  });
});
