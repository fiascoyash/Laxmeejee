import { CompanyProfile, businessComplianceConfig } from '../types';

export interface ComplianceDisplayItem {
  label: string;
  value: string;
}

/**
 * Returns the compliance fields that should be visible on a given document type,
 * based on the company profile's saved compliance entries and their per-document
 * display toggles. Only fields with a non-empty value and the appropriate flag
 * (showOnQuotation / showOnInvoice) are included.
 */
export function getComplianceItemsForDocument(
  company: CompanyProfile,
  docType: 'quotation' | 'invoice',
): ComplianceDisplayItem[] {
  if (!company.compliance) return [];
  const fields = businessComplianceConfig[company.businessType || 'general'] || [];
  const items: ComplianceDisplayItem[] = [];
  for (const field of fields) {
    const entry = company.compliance[field.key];
    if (!entry) continue;
    // Handle both legacy plain-string values and current ComplianceEntry objects
    const value = typeof entry === 'string' ? entry : entry.value;
    if (!value || !value.trim()) continue;
    const showOn = typeof entry === 'string'
      ? false
      : (docType === 'quotation' ? entry.showOnQuotation : entry.showOnInvoice);
    if (!showOn) continue;
    items.push({ label: field.label, value: value.trim() });
  }
  return items;
}
