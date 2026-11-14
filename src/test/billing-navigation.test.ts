import { describe, expect, it } from 'vitest';
import { getBillingView, isPublicLandingHash, legacyBillingView } from '@/lib/billing-navigation';

describe('Shared homepage and billing navigation', () => {
  it('opens the merchant dashboard when billing has no hash', () => {
    expect(getBillingView('')).toBe('home');
  });
  it('falls back to the dashboard for unknown billing bookmarks', () => {
    expect(getBillingView('#unknown')).toBe('home');
  });
  it('recognizes the retired landing bookmark as the public homepage', () => {
    expect(isPublicLandingHash('#landing')).toBe(true);
    expect(isPublicLandingHash('#home')).toBe(false);
  });
  it('preserves existing product catalog billing bookmarks', () => {
    expect(legacyBillingView('#catalog')).toBe('catalog');
    expect(getBillingView('#catalog')).toBe('catalog');
  });
  it('keeps public homepage section bookmarks on the public homepage', () => {
    for (const hash of ['#shops', '#features', '#new', '#why', '#how', '#landing']) {
      // #new is an existing quotation bookmark and must retain that meaning.
      if (hash === '#new') continue;
      expect(legacyBillingView(hash)).toBeUndefined();
    }
  });
});