import { CompanyProfile, Customer, Quotation, Product } from '../types';
import { calculateProductAmount, calculateTaxSummary } from './storage';

export interface PlaceholderContext {
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
}

export const resolvePlaceholders = (text: string, context: PlaceholderContext): string => {
  const { company, customer, quotation, products } = context;

  // Calculate totals
  const totalAmount = products.reduce((sum, p) => sum + calculateProductAmount(p), 0);
  const taxSummary = calculateTaxSummary(products);
  const totalCgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0);
  const totalSgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0);
  const grandTotal = totalAmount + totalCgst + totalSgst;

  // Create replacement map
  const replacements: Record<string, string> = {
    '{{customer_name}}': customer.name || '',
    '{{quotation_no}}': quotation.quotationNumber || '',
    '{{date}}': quotation.date || '',
    '{{total_amount}}': `Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    '{{company_name}}': company.companyName || '',
    '{{gst_number}}': company.gstNumber || '',
    '{{company_address}}': company.address || '',
    '{{company_phone}}': company.phone || '',
    '{{company_email}}': company.email || '',
    '{{bank_name}}': company.bankName || '',
    '{{bank_account}}': company.bankAccount || '',
    '{{bank_ifsc}}': company.bankIfsc || '',
    '{{taxable_amount}}': `Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    '{{cgst_amount}}': `Rs. ${totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    '{{sgst_amount}}': `Rs. ${totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    '{{grand_total}}': `Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    '{{customer_address}}': customer.billingAddress || '',
    '{{customer_mobile}}': customer.mobile || '',
    '{{customer_district}}': customer.district || '',
    '{{customer_village}}': customer.village || '',
  };

  // Replace all placeholders
  let result = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return result;
};

export const getPlaceholderList = (): { key: string; description: string }[] => {
  return [
    { key: '{{customer_name}}', description: 'Customer name' },
    { key: '{{quotation_no}}', description: 'Quotation number' },
    { key: '{{date}}', description: 'Quotation date' },
    { key: '{{total_amount}}', description: 'Taxable amount (before GST)' },
    { key: '{{company_name}}', description: 'Company name' },
    { key: '{{gst_number}}', description: 'Company GST number' },
    { key: '{{company_address}}', description: 'Company address' },
    { key: '{{company_phone}}', description: 'Company phone' },
    { key: '{{company_email}}', description: 'Company email' },
    { key: '{{bank_name}}', description: 'Bank name' },
    { key: '{{bank_account}}', description: 'Bank account number' },
    { key: '{{bank_ifsc}}', description: 'Bank IFSC code' },
    { key: '{{taxable_amount}}', description: 'Subtotal before tax' },
    { key: '{{cgst_amount}}', description: 'Total CGST' },
    { key: '{{sgst_amount}}', description: 'Total SGST' },
    { key: '{{grand_total}}', description: 'Grand total with GST' },
    { key: '{{customer_address}}', description: 'Customer billing address' },
    { key: '{{customer_mobile}}', description: 'Customer mobile number' },
    { key: '{{customer_district}}', description: 'Customer district' },
    { key: '{{customer_village}}', description: 'Customer village' },
  ];
};
