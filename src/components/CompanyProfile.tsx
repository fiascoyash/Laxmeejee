import { useState } from 'react';
import { CompanyProfile as CompanyProfileType, BusinessType, BUSINESS_TYPE_OPTIONS, businessComplianceConfig, ComplianceFieldKey, ComplianceEntry, complianceValidation } from '../types';
import { Building2, Mail, Phone, MapPin, Save, Upload, X, Briefcase, ShieldCheck } from 'lucide-react';
import { sanitizeMobile, sanitizeGstin, isValidMobile, isValidGstin } from '../utils/validation';
import { sanitizeComplianceValue, validateComplianceValue, getComplianceHelpText } from '../utils/complianceValidation';

interface Props {
  profile: CompanyProfileType;
  onSave: (profile: CompanyProfileType) => void;
  onClose: () => void;
}

/**
 * Normalize a loaded compliance object into the new ComplianceEntry format.
 * Old saved data may have plain string values instead of { value, showOnQuotation, showOnInvoice }.
 */
function normalizeCompliance(
  raw: Partial<Record<ComplianceFieldKey, ComplianceEntry | string>> | undefined,
): Partial<Record<ComplianceFieldKey, ComplianceEntry>> {
  if (!raw) return {};
  const result: Partial<Record<ComplianceFieldKey, ComplianceEntry>> = {};
  for (const key of Object.keys(raw) as ComplianceFieldKey[]) {
    const entry = raw[key];
    if (typeof entry === 'string') {
      result[key] = { value: entry, showOnQuotation: false, showOnInvoice: false };
    } else if (entry && typeof entry === 'object') {
      result[key] = {
        value: entry.value || '',
        showOnQuotation: entry.showOnQuotation ?? false,
        showOnInvoice: entry.showOnInvoice ?? false,
      };
    }
  }
  return result;
}

export function CompanyProfile({ profile, onSave, onClose }: Props) {
  const [formData, setFormData] = useState<CompanyProfileType>({
    ...profile,
    compliance: normalizeCompliance(profile.compliance as Partial<Record<ComplianceFieldKey, ComplianceEntry | string>> | undefined),
  });

  const complianceFields = businessComplianceConfig[formData.businessType || 'general'] || [];

  const getEntry = (key: ComplianceFieldKey): ComplianceEntry => {
    const existing = formData.compliance?.[key];
    if (existing && typeof existing === 'object') {
      return existing;
    }
    return { value: '', showOnQuotation: false, showOnInvoice: false };
  };

  const handleComplianceValueChange = (key: ComplianceFieldKey, raw: string) => {
    const sanitized = sanitizeComplianceValue(key, raw);
    setFormData(prev => {
      const current = prev.compliance?.[key];
      const entry: ComplianceEntry = typeof current === 'object' && current
        ? { ...current, value: sanitized }
        : { value: sanitized, showOnQuotation: false, showOnInvoice: false };
      return {
        ...prev,
        compliance: { ...(prev.compliance || {}), [key]: entry },
      };
    });
  };

  const handleComplianceToggle = (key: ComplianceFieldKey, field: 'showOnQuotation' | 'showOnInvoice') => {
    setFormData(prev => {
      const current = prev.compliance?.[key];
      const entry: ComplianceEntry = typeof current === 'object' && current
        ? { ...current, [field]: !current[field] }
        : { value: '', [field]: true, [(field === 'showOnQuotation' ? 'showOnInvoice' : 'showOnQuotation') as 'showOnInvoice' | 'showOnQuotation']: false };
      return {
        ...prev,
        compliance: { ...(prev.compliance || {}), [key]: entry },
      };
    });
  };

  const handleImageUpload = (field: 'logo' | 'signature') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, [field]: reader.result as string });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.phone && !isValidMobile(formData.phone)) {
      alert('Please enter a valid 10-digit phone number or leave it blank');
      return;
    }
    if (formData.gstNumber && !isValidGstin(formData.gstNumber)) {
      alert('Please enter a valid 15-character GSTIN or leave it blank');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Company Profile
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Business Type Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Business Type
                </label>
                <select
                  value={formData.businessType || 'general'}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value as BusinessType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500 bg-white"
                >
                  {BUSINESS_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  Select your business type to enable industry-specific product fields.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: sanitizeGstin(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500 font-mono uppercase"
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                />
                {formData.gstNumber && !isValidGstin(formData.gstNumber) && (
                  <p className="text-xs text-red-500 mt-1">Invalid GSTIN format</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Mail className="w-4 h-4" /> Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Phone className="w-4 h-4" /> Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: sanitizeMobile(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                    maxLength={10}
                  />
                  {formData.phone && !isValidMobile(formData.phone) && (
                    <p className="text-xs text-red-500 mt-1">Phone number must be exactly 10 digits</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => handleImageUpload('logo')}
                    className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors overflow-hidden"
                  >
                    {formData.logo ? (
                      <img src={formData.logo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Upload className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  {formData.logo && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo: '' })}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Bank Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={formData.bankAccount}
                        onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={formData.bankIfsc}
                        onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                    <input
                      type="text"
                      value={formData.bankBranch}
                      onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Authorized Signature</label>
                <div className="flex items-start gap-4">
                  <div
                    onClick={() => handleImageUpload('signature')}
                    className="w-48 h-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors overflow-hidden"
                  >
                    {formData.signature ? (
                      <img src={formData.signature} alt="Signature" className="w-full h-full object-contain" />
                    ) : (
                      <Upload className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  {formData.signature && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, signature: '' })}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Business Compliance Details — full-width, industry-specific fields */}
          {complianceFields.length > 0 && (
            <div className="mt-6 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Business Compliance Details
              </h3>

              {/* Document Display sub-section */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Document Display</h4>
                <p className="text-xs text-slate-500">
                  Choose which business compliance details should appear on your quotations and invoices.
                </p>
              </div>

              <div className="space-y-4">
                {complianceFields.map(field => {
                  const entry = getEntry(field.key);
                  const error = validateComplianceValue(field.key, entry.value);
                  const helpText = getComplianceHelpText(field.key, entry.value);
                  const config = complianceValidation[field.key];
                  const isComplete = config?.exactLength !== undefined && entry.value.length === config.exactLength;
                  return (
                    <div key={field.key} className="bg-white rounded-md p-3 border border-emerald-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                          <input
                            type="text"
                            value={entry.value}
                            onChange={(e) => handleComplianceValueChange(field.key, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500 bg-white font-mono ${
                              error
                                ? 'border-red-400 focus:border-red-500'
                                : isComplete
                                ? 'border-emerald-400 focus:border-emerald-500'
                                : 'border-slate-300 focus:border-blue-500'
                            } ${config?.uppercase ? 'uppercase' : ''}`}
                            placeholder={field.placeholder || ''}
                            maxLength={config?.maxLength}
                          />
                          {error && (
                            <p className="text-xs text-red-500 mt-1">{error}</p>
                          )}
                          {!error && helpText && (
                            <p className={`text-xs mt-1 ${isComplete ? 'text-emerald-600' : 'text-slate-500'}`}>
                              {helpText}
                            </p>
                          )}
                        </div>

                        {/* Display toggles */}
                        <div>
                          <span className="block text-sm font-medium text-slate-700 mb-1">Display on:</span>
                          <div className="flex items-center gap-4 h-[42px]">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={entry.showOnQuotation}
                                onChange={() => handleComplianceToggle(field.key, 'showOnQuotation')}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-slate-700">Quotation</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={entry.showOnInvoice}
                                onChange={() => handleComplianceToggle(field.key, 'showOnInvoice')}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-sm text-slate-700">Invoice</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500 mt-3">
                Fields shown are based on the selected Business Type. Values are saved with your profile and preserved when switching types.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
