import type { GstMode, Product } from '../types';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Which field the user last typed on a row; legacy rows infer it from the manual-amount flag. */
export const priceSourceOf = (p: Product): 'rate' | 'amount' =>
  (p as any).priceSource ?? (p.isManualAmount && p.manualAmount !== undefined ? 'amount' : 'rate');

/**
 * Keep Rate and Amount consistent for the row's last-edited field.
 * Inclusive GST: Amount = Rate × Qty × (1 + GST%) (inverse of the Amount → Rate formula).
 * Exclusive GST / 0%: Amount = Rate × Qty, tax added on top by the summary.
 */
export function recalcLine<T extends Product>(p: T, gstMode: GstMode): T {
  const qty = Number(p.quantity) || 0;
  const gst = Number(p.gstPercent) || 0;
  const factor = gstMode === 'inclusive' && gst > 0 ? 1 + gst / 100 : 1;
  if (priceSourceOf(p) === 'amount' && p.manualAmount !== undefined) {
    const unitPrice = qty > 0 && p.manualAmount > 0 ? r2(p.manualAmount / qty / factor) : p.unitPrice;
    return { ...p, unitPrice, isManualAmount: true, priceSource: 'amount' } as T;
  }
  const rate = Number(p.unitPrice) || 0;
  if (factor !== 1) {
    return { ...p, isManualAmount: true, manualAmount: r2(rate * qty * factor), priceSource: 'rate' } as T;
  }
  return { ...p, isManualAmount: false, manualAmount: undefined, priceSource: 'rate' } as T;
}
