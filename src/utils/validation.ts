// Shared validation utilities for Mobile, GSTIN, and B2B/B2C bill type detection.

export type BillType = 'B2B' | 'B2C';

// ─── Mobile Number ─────────────────────────────────────────────────────────

/** Strip non-digits and cap at 10 digits. */
export const sanitizeMobile = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 10);
};

/** True when exactly 10 digits present. */
export const isValidMobile = (value: string | undefined): boolean => {
  if (!value) return false;
  return /^\d{10}$/.test(value);
};

// ─── GSTIN ──────────────────────────────────────────────────────────────────

// Valid GST state codes (01–38)
const VALID_STATE_CODES = new Set([
  '01','02','03','05','06','07','08','09','10','11','12','13','14','15','16',
  '17','18','19','20','21','22','23','24','26','27','28','29','30','31','32',
  '33','34','35','36','37','38',
]);

// Factor table for GSTIN checksum (36-base alternating factor of 2)
const charValue = (ch: string): number => {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - '0'.charCodeAt(0);
  return ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
};

/** Strip non-alphanumeric, uppercase, cap at 15 chars. */
export const sanitizeGstin = (value: string): string => {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 15);
};

/** Full GSTIN format + checksum validation. */
export const isValidGstin = (value: string | undefined): boolean => {
  if (!value) return false;
  const gstin = value.trim().toUpperCase();
  if (gstin.length !== 15) return false;
  if (!/^[A-Z0-9]+$/.test(gstin)) return false;

  // First 2 chars = valid state code
  if (!VALID_STATE_CODES.has(gstin.slice(0, 2))) return false;

  // Char 14 (index 13) = 'Z' (default for regular taxpayer)
  if (gstin[13] !== 'Z') return false;

  // Checksum (Luhn mod 36): process first 14 chars right-to-left, factor 2,1,2,1,...
  const CHECKSUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  let factor = 2;
  for (let i = 13; i >= 0; i--) {
    const codePoint = CHECKSUM_CHARS.indexOf(gstin[i]);
    if (codePoint < 0) return false;
    let digit = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / 36) + (digit % 36);
    sum += digit;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return CHECKSUM_CHARS[checkCodePoint] === gstin[14];
};

// ─── Bill Type Detection ────────────────────────────────────────────────────

/** B2B when valid GSTIN present, B2C otherwise. */
export const detectBillType = (gstin: string | undefined): BillType => {
  return isValidGstin(gstin) ? 'B2B' : 'B2C';
};
