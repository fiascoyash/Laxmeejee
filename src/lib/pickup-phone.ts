export function normalizePickupPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

export function isValidPickupPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePickupPhone(value));
}
