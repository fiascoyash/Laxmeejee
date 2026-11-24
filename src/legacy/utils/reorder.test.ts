import { describe, it, expect } from 'vitest';
import { moveItem } from './reorder';

const rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${i + 1}`, qty: i + 1 }));

describe('moveItem', () => {
  it('moves item #9 to position #2 and shifts the rest down', () => {
    const out = moveItem(rows, 8, 1);
    expect(out.map(r => r.id)).toEqual(['r1', 'r9', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r10']);
  });
  it('keeps the moved row object intact', () => {
    expect(moveItem(rows, 8, 1)[1]).toBe(rows[8]);
  });
  it('clamps positions beyond the list', () => {
    expect(moveItem(rows, 0, 99).at(-1)?.id).toBe('r1');
  });
  it('does not mutate the original list', () => {
    moveItem(rows, 0, 5);
    expect(rows[0]?.id).toBe('r1');
  });
});
