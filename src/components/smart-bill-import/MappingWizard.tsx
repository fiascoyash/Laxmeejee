import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import {
  BillMappedProduct,
  BillFieldKey,
  BillFieldDefinition,
  BILL_FIELD_DEFINITIONS,
} from '../../types';

// Set worker path - use local worker bundled with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  transform: number[];
}

interface MappingWizardProps {
  pdfFile: File;
  onProductsMapped: (products: BillMappedProduct[]) => void;
  onBack: () => void;
}

export const MappingWizard: React.FC<MappingWizardProps> = ({
  pdfFile,
  onProductsMapped,
  onBack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Field mapping state
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [products, setProducts] = useState<Partial<BillMappedProduct>[]>([{}]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  // Required fields for each product
  const requiredFields: BillFieldKey[] = ['productName', 'quantity', 'purchasePrice', 'gstPercent'];
  const optionalFields: BillFieldKey[] = ['hsnSac', 'unit', 'amount'];

  const currentField: BillFieldKey = requiredFields[currentFieldIndex] || optionalFields[currentFieldIndex - requiredFields.length];
  const fieldDef: BillFieldDefinition | undefined = BILL_FIELD_DEFINITIONS.find(f => f.key === currentField);

  // Load PDF document from File object (fresh read each time)
  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      console.log('MappingWizard: Starting PDF load from File...');

      try {
        // Read the file fresh - this creates a new ArrayBuffer each time
        const arrayBuffer = await pdfFile.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        console.log('MappingWizard: ArrayBuffer size:', arrayBuffer.byteLength);

        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;

        console.log('MappingWizard: PDF loaded, numPages:', pdf.numPages);

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setError(null);
      } catch (err) {
        console.error('MappingWizard: Error loading PDF:', err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfFile]);

  // Render page with clickable text
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      // Create canvas container
      const canvasContainer = document.createElement('div');
      canvasContainer.style.position = 'relative';
      canvasContainer.style.margin = '0 auto';
      canvasContainer.style.width = `${viewport.width}px`;
      canvasContainer.style.height = `${viewport.height}px`;

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvasContainer.appendChild(canvas);

      // Render PDF page
      const context = canvas.getContext('2d');
      if (context) {
        await page.render({
          canvasContext: context,
          viewport,
        }).promise;
      }

      // Get text content
      const textContent = await page.getTextContent();
      const items: TextItem[] = [];

      textContent.items.forEach((item) => {
        if ('str' in item && item.str.trim()) {
          items.push({
            str: item.str,
            x: item.transform[4],
            y: viewport.height - item.transform[5],
            width: item.width,
            height: Math.abs(item.transform[0]) || 12,
            transform: item.transform,
          });
        }
      });

      setTextItems(items);

      // Create interactive text layer
      const textLayerDiv = document.createElement('div');
      textLayerDiv.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${viewport.width}px;
        height: ${viewport.height}px;
      `;

      textContent.items.forEach((item) => {
        if ('str' in item && item.str.trim()) {
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const span = document.createElement('span');
          span.textContent = item.str;
          span.dataset.text = item.str;
          span.style.cssText = `
            position: absolute;
            left: ${tx[4]}px;
            top: ${viewport.height - tx[5]}px;
            font-size: ${Math.abs(tx[0]) || 12}px;
            font-family: sans-serif;
            white-space: pre;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 4px;
            transition: background-color 0.2s;
          `;

          span.addEventListener('mouseenter', () => {
            span.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
          });

          span.addEventListener('mouseleave', () => {
            span.style.backgroundColor = 'transparent';
          });

          span.addEventListener('click', () => {
            handleTextClick(item.str);
          });

          textLayerDiv.appendChild(span);
        }
      });

      canvasContainer.appendChild(textLayerDiv);
      container.appendChild(canvasContainer);
    } catch (err) {
      console.error('MappingWizard: Error rendering page:', err);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    if (pdfDoc && !loading) {
      renderPage();
    }
  }, [pdfDoc, currentPage, scale, loading, renderPage]);

  // Handle text click
  const handleTextClick = (text: string) => {
    const currentProduct = products[currentProductIndex] || {};

    // Clean up the text
    let cleanValue = text.trim();

    // Parse numeric values for number fields
    if (fieldDef?.type === 'number') {
      // Remove currency symbols, commas, units
      cleanValue = cleanValue.replace(/[Rs.,$,\u20B9]/g, '').replace(/[^0-9.]/g, '');
      const numValue = parseFloat(cleanValue);
      if (!isNaN(numValue)) {
        cleanValue = String(numValue);
      }
    }

    // Set the value
    setProducts((prev) => {
      const updated = [...prev];
      updated[currentProductIndex] = {
        ...updated[currentProductIndex],
        id: updated[currentProductIndex]?.id || `product-${Date.now()}`,
        [currentField]: fieldDef?.type === 'number' ? parseFloat(cleanValue) || 0 : cleanValue,
      };
      return updated;
    });

    // Move to next field
    advanceField();
  };

  // Advance to next field
  const advanceField = () => {
    const totalFields = requiredFields.length + optionalFields.length;
    if (currentFieldIndex < totalFields - 1) {
      setCurrentFieldIndex(currentFieldIndex + 1);
    }
  };

  // Skip current field
  const skipField = () => {
    advanceField();
  };

  // Start next product
  const startNextProduct = () => {
    setProducts((prev) => [...prev, {}]);
    setCurrentProductIndex(products.length);
    setCurrentFieldIndex(0); // Start from productName
  };

  // Delete current product
  const deleteCurrentProduct = () => {
    if (products.length <= 1) {
      // Reset the current product
      setProducts([{}]);
      setCurrentFieldIndex(0);
    } else {
      const newProducts = products.filter((_, i) => i !== currentProductIndex);
      setProducts(newProducts);
      setCurrentProductIndex(Math.max(0, currentProductIndex - 1));
      setCurrentFieldIndex(0);
    }
  };

  // Finish mapping
  const finishMapping = () => {
    // Filter incomplete products (must have productName and quantity at minimum)
    const completeProducts = products.filter(
      (p) => p.productName && p.quantity
    ) as BillMappedProduct[];

    if (completeProducts.length === 0) {
      alert('Please map at least one product with a name and quantity.');
      return;
    }

    // Set default decision
    const finalProducts = completeProducts.map((p) => ({
      ...p,
      decision: 'create_new' as const,
    }));

    onProductsMapped(finalProducts);
  };

  // Navigation
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleZoomIn = () => setScale(Math.min(scale + 0.25, 3));
  const handleZoomOut = () => setScale(Math.max(scale - 0.25, 0.5));

  const currentProduct = products[currentProductIndex] || {};
  const mappedProductsCount = products.filter((p) => p.productName && p.quantity).length;
  const isLastField = currentFieldIndex >= requiredFields.length + optionalFields.length - 1;

  // Loading state
  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading PDF for mapping...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">Error loading PDF</p>
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Teach the System
          </h2>
          <p className="text-slate-600 text-sm">
            Click on text in the PDF to map values for each field
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* PDF Viewer */}
        <div className="lg:col-span-2">
          {/* Controls */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2 mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-700">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded hover:bg-slate-200"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-700 min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded hover:bg-slate-200"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PDF Canvas */}
          <div
            className="border border-slate-200 rounded-lg overflow-auto bg-slate-100"
            style={{ maxHeight: '500px' }}
          >
            <div ref={containerRef} className="pdf-container p-4" />
          </div>
        </div>

        {/* Mapping Panel */}
        <div className="bg-slate-50 rounded-lg p-4">
          {/* Product Tabs */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
            {products.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentProductIndex(idx);
                  setCurrentFieldIndex(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${
                  idx === currentProductIndex
                    ? 'bg-emerald-600 text-white'
                    : p.productName
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {p.productName || `Product ${idx + 1}`}
                {p.productName && p.quantity && (
                  <Check className="w-3 h-3" />
                )}
              </button>
            ))}
            <button
              onClick={startNextProduct}
              className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Current Field Instruction */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                {currentFieldIndex < requiredFields.length ? 'Required' : 'Optional'}
              </span>
              {fieldDef && (
                <span className="text-xs text-slate-500">{fieldDef.description}</span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Click on: <span className="text-emerald-600">{fieldDef?.label}</span>
            </h3>
            <p className="text-sm text-slate-600">
              Find {fieldDef?.label.toLowerCase()} in the PDF and click on it.
            </p>

            {/* Manual Input */}
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  type={fieldDef?.type === 'number' ? 'number' : 'text'}
                  placeholder={`Or type ${fieldDef?.label.toLowerCase()}...`}
                  value={(currentProduct[currentField as keyof BillMappedProduct] as string) || ''}
                  onChange={(e) => {
                    const value = fieldDef?.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                    setProducts((prev) => {
                      const updated = [...prev];
                      updated[currentProductIndex] = {
                        ...updated[currentProductIndex],
                        id: updated[currentProductIndex]?.id || `product-${Date.now()}`,
                        [currentField]: value,
                      };
                      return updated;
                    });
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  onClick={advanceField}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Current Product Values */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 mb-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Product {currentProductIndex + 1} Values
            </h4>
            <div className="space-y-2 text-sm">
              {[...requiredFields, ...optionalFields].map((fieldKey) => {
                const def = BILL_FIELD_DEFINITIONS.find((f) => f.key === fieldKey);
                const value = currentProduct[fieldKey as keyof BillMappedProduct];
                const isCurrent = currentField === fieldKey;

                return (
                  <div
                    key={fieldKey}
                    className={`flex items-center justify-between p-2 rounded ${
                      isCurrent
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-slate-50'
                    }`}
                  >
                    <span
                      className={`${
                        fieldKey === currentField ? 'text-emerald-700 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {def?.label}:
                    </span>
                    <span
                      className={`font-medium ${
                        value !== undefined && value !== '' ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {value !== undefined && value !== ''
                        ? value
                        : '--'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={skipField}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-sm"
            >
              Skip this field
            </button>
            <button
              onClick={deleteCurrentProduct}
              className="w-full px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Product
            </button>
          </div>

          {/* Finish Button */}
          <button
            onClick={finishMapping}
            disabled={mappedProductsCount === 0}
            className="w-full mt-4 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Done Mapping ({mappedProductsCount} product{mappedProductsCount !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
};
