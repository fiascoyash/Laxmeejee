// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { RULE48_COPIES } from '../legacy/utils/templatePdfExport';
describe('CGST Rule 48 copies', () => {
  it('uses the statutory labels', () => {
    expect(RULE48_COPIES.original).toBe('ORIGINAL FOR RECIPIENT');
    expect(RULE48_COPIES.transporter).toBe('DUPLICATE FOR TRANSPORTER');
    expect(RULE48_COPIES.supplier).toBe('TRIPLICATE FOR SUPPLIER');
  });
});
