import { describe, it, expect } from 'vitest';
import { responseRating } from '@/lib/discovery';

describe('shop response rating', () => {
  it('shows no rating until a shop has answered 3 orders', () => {
    expect(responseRating({ responded: 2, avg_minutes: 1, quick_share: 1 })).toBeNull();
  });
  it('gives 5.0 for replies within 5 minutes', () => {
    expect(responseRating({ responded: 5, avg_minutes: 4, quick_share: 1 })?.score).toBe(5);
  });
  it('gives 4.0 for replies around the 15 minute window', () => {
    expect(responseRating({ responded: 5, avg_minutes: 14, quick_share: 0.8 })?.score).toBe(4);
  });
  it('drops half a point when most orders miss the 15 minute window', () => {
    expect(responseRating({ responded: 5, avg_minutes: 25, quick_share: 0.3 })?.score).toBe(3);
  });
});
