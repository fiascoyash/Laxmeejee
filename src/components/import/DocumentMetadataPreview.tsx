import type { DocumentMetadata } from '../../types';
import {
  FileText,
  Calendar,
  Building2,
  Hash,
  CreditCard,
  Globe,
  Layers,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Props {
  metadata: DocumentMetadata | undefined;
  fileName: string;
  format: 'csv' | 'xlsx' | 'pdf';
}

export function DocumentMetadataPreview({ metadata, fileName, format }: Props) {
  if (!metadata) return null;

  const formatExtensions: Record<string, string> = {
    csv: 'CSV',
    xlsx: 'Excel',
    pdf: 'PDF',
  };

  const detectedFields = [
    { key: 'invoiceNumber', label: 'Invoice Number', value: metadata.invoiceNumber, icon: Hash },
    { key: 'invoiceDate', label: 'Invoice Date', value: metadata.invoiceDate, icon: Calendar },
    { key: 'supplierName', label: 'Supplier Name', value: metadata.supplierName, icon: Building2 },
    { key: 'supplierGstin', label: 'GSTIN', value: metadata.supplierGstin, icon: CreditCard },
    { key: 'currency', label: 'Currency', value: metadata.currency, icon: Globe },
    { key: 'pageCount', label: 'Pages', value: metadata.pageCount.toString(), icon: Layers },
  ];

  const detectedCount = detectedFields.filter(f => f.value).length;
  const confidence = metadata.isScanned ? 'scanned' : detectedCount >= 4 ? 'high' : detectedCount >= 2 ? 'medium' : 'low';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" />
          Document Detected
        </h3>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
            {formatExtensions[format]}
          </span>
          {metadata.isScanned ? (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Scanned
            </span>
          ) : confidence === 'high' ? (
            <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Complete
            </span>
          ) : confidence === 'medium' ? (
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Partial
            </span>
          ) : (
            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
              Limited
            </span>
          )}
        </div>
      </div>

      {/* File name */}
      <p className="text-sm text-slate-600 mb-4 truncate" title={fileName}>
        {fileName}
      </p>

      {/* Detected fields grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {detectedFields.map(({ key, label, value, icon: Icon }) => (
          <div
            key={key}
            className={`p-2 rounded-lg border ${
              value
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className={`w-3.5 h-3.5 ${value ? 'text-emerald-600' : 'text-slate-400'}`} />
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className={`text-sm font-medium truncate ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}>
              {value || 'Not detected'}
            </p>
          </div>
        ))}
      </div>

      {/* Scanned PDF warning */}
      {metadata.isScanned && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Scanned PDF detected.</strong> OCR support coming soon.
              Please upload a text-based PDF or convert to Excel/CSV.
            </span>
          </p>
        </div>
      )}

      {/* Keywords detected */}
      {metadata.detectedKeywords && metadata.detectedKeywords.length > 0 && !metadata.isScanned && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-1.5">Keywords detected:</p>
          <div className="flex flex-wrap gap-1">
            {metadata.detectedKeywords.slice(0, 8).map((kw, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
              >
                {kw}
              </span>
            ))}
            {metadata.detectedKeywords.length > 8 && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                +{metadata.detectedKeywords.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
