import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { ProductCatalogItem, SupplierData, BillMappedProduct } from '../../types';
import { UploadPDF } from './UploadPDF';
import { PDFViewer } from './PDFViewer';
import { MappingWizard } from './MappingWizard';
import { EditableProducts } from './EditableProducts';
import { ProductMatcher } from './ProductMatcher';
import { ImportConfirmation } from './ImportConfirmation';
import { storage } from '../../utils/storage';

type ImportStep = 'upload' | 'view' | 'mapping' | 'edit' | 'match' | 'confirm';

interface SmartBillImportProps {
  catalog: ProductCatalogItem[];
  suppliers: SupplierData[];
  onCatalogChange: (catalog: ProductCatalogItem[]) => void;
  onSuppliersChange: (suppliers: SupplierData[]) => void;
}

export const SmartBillImport: React.FC<SmartBillImportProps> = ({
  catalog,
  suppliers,
  onCatalogChange,
  onSuppliersChange,
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  // Store the File object, not ArrayBuffer - each component reads it fresh to avoid detached buffer issues
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mappedProducts, setMappedProducts] = useState<BillMappedProduct[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierData | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);

  // Handle PDF upload - store File, not ArrayBuffer
  const handlePdfUpload = useCallback((file: File) => {
    setPdfFile(file);
    setStep('view');
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    switch (step) {
      case 'view':
        setStep('upload');
        setPdfFile(null);
        break;
      case 'mapping':
        setStep('view');
        break;
      case 'edit':
        setStep('mapping');
        setMappedProducts([]);
        break;
      case 'match':
        setStep('edit');
        break;
      case 'confirm':
        setStep('match');
        break;
      default:
        setStep('upload');
    }
  }, [step]);

  // Start mapping wizard
  const handleStartMapping = useCallback(() => {
    setStep('mapping');
  }, []);

  // Handle products mapped from wizard
  const handleProductsMapped = useCallback((products: BillMappedProduct[]) => {
    setMappedProducts(products);
    setStep('edit');
  }, []);

  // Handle products edited
  const handleProductsEdited = useCallback((products: BillMappedProduct[]) => {
    setMappedProducts(products);
    setStep('match');
  }, []);

  // Handle matching complete
  const handleMatchingComplete = useCallback((products: BillMappedProduct[]) => {
    setMappedProducts(products);
    setStep('confirm');
  }, []);

  // Handle import complete
  const handleImportComplete = useCallback(() => {
    // Reset everything
    setStep('upload');
    setPdfFile(null);
    setMappedProducts([]);
    setSelectedSupplier(null);
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Step configuration
  const steps = [
    { id: 'upload', label: 'Upload', icon: Upload, completed: step !== 'upload' },
    { id: 'view', label: 'View PDF', icon: FileText, completed: ['mapping', 'edit', 'match', 'confirm'].includes(step) },
    { id: 'mapping', label: 'Map Products', icon: FileText, completed: ['edit', 'match', 'confirm'].includes(step) },
    { id: 'edit', label: 'Edit', icon: FileText, completed: ['match', 'confirm'].includes(step) },
    { id: 'match', label: 'Match', icon: FileText, completed: ['confirm'].includes(step) },
    { id: 'confirm', label: 'Confirm', icon: CheckCircle, completed: false },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Smart Bill Import</h1>
        <p className="text-slate-600">
          Upload a PDF bill and teach the system which values to import.
          No automatic detection - you control exactly what gets imported.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => {
                  // Allow clicking on completed steps to go back
                  if (s.completed || s.id === step) {
                    if (index < currentStepIndex) {
                      switch (s.id) {
                        case 'upload':
                          handleBack();
                          break;
                        case 'view':
                          if (step !== 'upload') setStep('view');
                          break;
                        case 'mapping':
                          if (['edit', 'match', 'confirm'].includes(step)) setStep('mapping');
                          break;
                        case 'edit':
                          if (['match', 'confirm'].includes(step)) setStep('edit');
                          break;
                        case 'match':
                          if (step === 'confirm') setStep('match');
                          break;
                      }
                    }
                  }
                }}
                disabled={!s.completed && s.id !== step}
                className={`flex flex-col items-center ${
                  s.completed || s.id === step
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed opacity-50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    s.id === step
                      ? 'bg-emerald-600 text-white'
                      : s.completed
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <span
                  className={`mt-2 text-sm font-medium ${
                    s.id === step
                      ? 'text-emerald-600'
                      : s.completed
                      ? 'text-emerald-500'
                      : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    index < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        {step === 'upload' && (
          <UploadPDF onUpload={handlePdfUpload} />
        )}

        {step === 'view' && pdfFile && (
          <PDFViewer
            pdfFile={pdfFile}
            onStartMapping={handleStartMapping}
            onBack={handleBack}
          />
        )}

        {step === 'mapping' && pdfFile && (
          <MappingWizard
            pdfFile={pdfFile}
            onProductsMapped={handleProductsMapped}
            onBack={handleBack}
          />
        )}

        {step === 'edit' && (
          <EditableProducts
            products={mappedProducts}
            onProductsChange={setMappedProducts}
            onNext={handleProductsEdited}
            onBack={handleBack}
          />
        )}

        {step === 'match' && (
          <ProductMatcher
            products={mappedProducts}
            catalog={catalog}
            onProductsChange={setMappedProducts}
            onNext={handleMatchingComplete}
            onBack={handleBack}
          />
        )}

        {step === 'confirm' && (
          <ImportConfirmation
            products={mappedProducts}
            catalog={catalog}
            suppliers={suppliers}
            selectedSupplier={selectedSupplier}
            onSupplierChange={setSelectedSupplier}
            invoiceNumber={invoiceNumber}
            onInvoiceNumberChange={setInvoiceNumber}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            onCatalogChange={onCatalogChange}
            onSuppliersChange={onSuppliersChange}
            onComplete={handleImportComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};
