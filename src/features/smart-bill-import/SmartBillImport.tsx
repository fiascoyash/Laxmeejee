import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MousePointerClick,
  CheckCircle2,
  Layers,
  Eraser,
  Info,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  X,
  Building2,
  Receipt,
  Check,
  Search,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import { ProductCatalogItem, UnitType, SupplierData, ProductPurchase, ProductStockMovement } from '../../types';
import { storage, generateId, generateSku } from '../../utils/storage';

type Viewport = ReturnType<PDFDocumentProxy['getPage']> extends Promise<infer P>
  ? P extends { getViewport(opts: { scale: number }): infer V }
    ? V
    : never
  : never;

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

type FieldKey =
  | 'productName'
  | 'hsn'
  | 'gstPercent'
  | 'quantity'
  | 'rate'
  | 'unit'
  | 'amount';

const FIELD_ORDER: FieldKey[] = [
  'productName',
  'hsn',
  'gstPercent',
  'quantity',
  'rate',
  'unit',
  'amount',
];

const NUMERIC_FIELDS: FieldKey[] = ['gstPercent', 'quantity', 'rate', 'amount'];

const FIELD_LABELS: Record<FieldKey, string> = {
  productName: 'Product Name',
  hsn: 'HSN',
  gstPercent: 'GST %',
  quantity: 'Quantity',
  rate: 'Purchase Rate',
  unit: 'Unit',
  amount: 'Amount',
};

type FormData = Record<FieldKey, string>;

const EMPTY_FORM: FormData = {
  productName: '',
  hsn: '',
  gstPercent: '',
  quantity: '',
  rate: '',
  unit: '',
  amount: '',
};

type TextSpan = {
  id: number;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
};

type ReviewProduct = {
  id: string;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
} & FormData;

type ImportResult = {
  id: string;
  productName: string;
  action: 'created' | 'updated' | 'failed';
  reason?: string;
};

function cleanNumeric(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[₹$€£]|Rs\.?|INR|USD|EUR|GBP/gi, '');
  s = s.replace(/\s+/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const parts = s.split(',');
    if (parts.length > 1 && parts.every((p, i) => i === parts.length - 1 || p.length === 3)) {
      s = parts.join('');
    }
  }
  s = s.replace(/[^0-9.\-]/g, '');
  const dots = s.split('.');
  if (dots.length > 2) s = dots[0] + '.' + dots.slice(1).join('');
  return s;
}

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

// Parse unit string to UnitType
function parseUnit(unitStr: string): UnitType {
  const normalized = unitStr.toLowerCase().trim();
  const unitMap: Record<string, UnitType> = {
    'piece': 'piece', 'pc': 'piece', 'pcs': 'piece', 'each': 'piece', 'ea': 'piece',
    'box': 'box', 'bx': 'box',
    'packet': 'packet', 'pkt': 'packet', 'pack': 'packet',
    'strip': 'strip',
    'bottle': 'bottle', 'btl': 'bottle',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'gram': 'gram', 'g': 'gram', 'gm': 'gram', 'grams': 'gram',
    'liter': 'liter', 'l': 'liter', 'litre': 'liter', 'ltr': 'liter',
    'meter': 'meter', 'm': 'meter', 'mtr': 'meter',
    'feet': 'feet', 'ft': 'feet',
    'bag': 'bag',
    'ton': 'ton',
    'set': 'set',
    'service': 'service', 'svc': 'service',
    'hour': 'hour', 'hr': 'hour', 'hrs': 'hour',
    'day': 'day',
  };
  return unitMap[normalized] || 'piece';
}

interface SmartBillImportProps {
  catalog: ProductCatalogItem[];
  onCatalogChange: (catalog: ProductCatalogItem[]) => void;
  suppliers: SupplierData[];
}

export default function SmartBillImport({ catalog, onCatalogChange, suppliers }: SmartBillImportProps) {
  // --- PDF state ---
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.4);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Form state ---
  const [activeField, setActiveField] = useState<FieldKey>('productName');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [flashField, setFlashField] = useState<FieldKey | null>(null);

  // --- Review list state ---
  const [reviewList, setReviewList] = useState<ReviewProduct[]>([]);

  // --- Invoice details state ---
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState<boolean>(false);

  // --- Import state ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [textSpans, setTextSpans] = useState<TextSpan[]>([]);
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRowComplete = useMemo(
    () => FIELD_ORDER.every((k) => formData[k].trim() !== ''),
    [formData],
  );

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(s =>
      s.firmName.toLowerCase().includes(search) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(search)) ||
      (s.gstNumber && s.gstNumber.toLowerCase().includes(search))
    );
  }, [suppliers, supplierSearch]);

  const selectedSupplier = useMemo(() =>
    suppliers.find(s => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId]
  );

  // --- File upload ---
  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      return;
    }
    setError(null);
    setLoading(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(1);
      setFormData(EMPTY_FORM);
      setActiveField('productName');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF.');
      setPdfDoc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Render page (canvas + text layer) ---
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;

    const render = async () => {
      const page = await pdfDoc.getPage(pageNum);
      const viewport: Viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (err) {
        if ((err as Error)?.name === 'RenderingCancelledException') return;
        if (!cancelled) setError('Failed to render page.');
        return;
      }
      if (cancelled) return;

      const textContent = await page.getTextContent();
      const spans: TextSpan[] = [];
      let id = 0;
      for (const item of textContent.items) {
        const ti = item as TextItem;
        if (!('str' in ti) || typeof ti.str !== 'string' || ti.str.trim() === '') continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, ti.transform);
        const fontSize = Math.hypot(tx[2], tx[3]);
        const left = tx[4];
        const top = tx[5] - fontSize;
        const width = ti.width * viewport.scale;
        const height = Math.max(fontSize, ti.height * viewport.scale);
        spans.push({
          id: id++,
          text: ti.str,
          left,
          top,
          width,
          height,
          fontSize,
        });
      }
      if (!cancelled) {
        setTextSpans(spans);
        setRenderedSize({ w: viewport.width, h: viewport.height });
      }
    };

    render();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]);

  // --- Resize handling ---
  useEffect(() => {
    if (!pdfDoc || !renderedSize) return;
    const container = containerRef.current;
    if (!container) return;

    const fit = () => {
      const availWidth = container.clientWidth - 32;
      if (availWidth <= 0) return;
      const naturalWidth = renderedSize.w;
      if (naturalWidth > availWidth) {
        const ratio = availWidth / naturalWidth;
        const newScale = Math.max(0.4, Math.round(ratio * scale * 100) / 100);
        if (Math.abs(newScale - scale) > 0.01) {
          setScale(newScale);
        }
      }
    };

    fit();
  }, [pdfDoc, renderedSize, scale]);

  // --- Click-to-fill handler ---
  const handleTextLayerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const span = target.closest('[data-text-id]') as HTMLElement | null;
      if (!span) return;
      const raw = span.innerText || span.textContent || '';
      if (!raw.trim()) return;

      const isShift = e.shiftKey;
      const field = activeField;
      const cleaned = NUMERIC_FIELDS.includes(field) ? cleanNumeric(raw) : cleanText(raw);

      setFormData((prev) => {
        const next = { ...prev };
        if (isShift) {
          next[field] = prev[field] ? `${prev[field]} ${cleaned}`.trim() : cleaned;
        } else {
          next[field] = cleaned;
        }
        return next;
      });

      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlashField(field);
      flashTimerRef.current = setTimeout(() => setFlashField(null), 600);

      if (!isShift) {
        const nextField = computeNextField(formData, field);
        if (nextField) setActiveField(nextField);
      }
    },
    [activeField, formData],
  );

  // --- Form input handlers ---
  const onFieldFocus = (key: FieldKey) => () => setActiveField(key);

  const onFieldChange =
    (key: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setActiveField('productName');
  };

  // --- Add Product handler ---
  const handleAddProduct = () => {
    if (!selectedSupplierId) {
      alert('Please select a Supplier first');
      return;
    }
    if (!formData.productName.trim()) {
      alert('Product Name is required');
      return;
    }
    const newProduct: ReviewProduct = {
      id: generateId(),
      ...formData,
      supplierId: selectedSupplierId,
      supplierName: selectedSupplier?.firmName || '',
      invoiceNumber: invoiceNumber.trim(),
    };
    setReviewList((prev) => [...prev, newProduct]);
    resetForm();
  };

  // --- Remove product from review list ---
  const handleRemoveProduct = (id: string) => {
    setReviewList((prev) => prev.filter((p) => p.id !== id));
  };

  // --- Preview what will happen on import ---
  const getImportPreview = useMemo(() => {
    const namesInBatch = new Set<string>();
    let newCount = 0;
    let updateCount = 0;

    for (const product of reviewList) {
      const normalizedName = product.productName.toLowerCase().trim();

      // Check if already processed in this batch
      if (namesInBatch.has(normalizedName)) {
        // Will update the same product (deduplicated in batch)
        continue;
      }

      // Check against existing catalog (from props)
      const existing = catalog.find(
        (p) => p.name.toLowerCase().trim() === normalizedName
      );

      if (existing) {
        updateCount++;
      } else {
        newCount++;
      }
      namesInBatch.add(normalizedName);
    }

    return { newCount, updateCount };
  }, [reviewList, catalog]);

  // --- Execute import ---
  const executeImport = useCallback(async () => {
    if (reviewList.length === 0) return;

    setIsImporting(true);
    const results: ImportResult[] = [];
    const updatedCatalog = [...catalog];
    const processedNames = new Set<string>();
    const importDate = new Date().toISOString().split('T')[0];

    for (const reviewProduct of reviewList) {
      const normalizedName = reviewProduct.productName.toLowerCase().trim();

      try {
        // Check if already processed in this batch (deduplication)
        if (processedNames.has(normalizedName)) {
          results.push({
            id: reviewProduct.id,
            productName: reviewProduct.productName,
            action: 'failed',
            reason: 'Duplicate product name in import batch',
          });
          continue;
        }

        // Find existing product
        const existingIndex = updatedCatalog.findIndex(
          (p) => p.name.toLowerCase().trim() === normalizedName
        );

        const now = new Date().toISOString();
        const quantity = parseFloat(reviewProduct.quantity) || 0;
        const gstPercent = parseFloat(reviewProduct.gstPercent) || 18;
        const purchasePrice = parseFloat(reviewProduct.rate) || 0;
        const hsnSacCode = reviewProduct.hsn || '';
        const unit = reviewProduct.unit ? parseUnit(reviewProduct.unit) : 'piece';
        const totalValue = quantity * purchasePrice;

        let productId: string;
        let previousStock = 0;
        let newStock: number;

        if (existingIndex >= 0) {
          // Update existing product
          const existing = updatedCatalog[existingIndex];
          previousStock = existing.stockQuantity;
          newStock = previousStock + quantity;
          productId = existing.id;

          updatedCatalog[existingIndex] = {
            ...existing,
            stockQuantity: newStock,
            hsnSacCode: hsnSacCode || existing.hsnSacCode,
            gstPercent: gstPercent,
            purchasePrice: purchasePrice || existing.purchasePrice,
            unit: unit,
            updatedAt: now,
          };
          results.push({
            id: reviewProduct.id,
            productName: reviewProduct.productName,
            action: 'updated',
          });
        } else {
          // Create new product
          productId = generateId();
          newStock = quantity;

          const newProduct: ProductCatalogItem = {
            id: productId,
            name: reviewProduct.productName.trim(),
            sku: generateSku(reviewProduct.productName),
            category: 'Imported',
            unit: unit,
            purchasePrice: purchasePrice,
            sellingPrice: purchasePrice, // Default selling price to purchase price
            gstPercent: gstPercent,
            hsnSacCode: hsnSacCode,
            stockQuantity: quantity,
            minStockAlert: 0,
            industryType: 'retail',
            createdAt: now,
            updatedAt: now,
          };
          updatedCatalog.push(newProduct);
          results.push({
            id: reviewProduct.id,
            productName: reviewProduct.productName,
            action: 'created',
          });
        }

        // Create stock history entries
        // 1. ProductPurchase record
        const purchaseRecord: ProductPurchase = {
          id: generateId(),
          productId,
          supplierName: reviewProduct.supplierName,
          quantity,
          purchasePrice,
          totalValue,
          purchaseDate: importDate,
          notes: reviewProduct.invoiceNumber ? `Invoice: ${reviewProduct.invoiceNumber}` : undefined,
          createdAt: now,
        };
        storage.saveProductPurchase(purchaseRecord);

        // 2. ProductStockMovement record
        const stockMovement: ProductStockMovement = {
          id: generateId(),
          productId,
          movementType: 'purchase',
          quantityChange: quantity,
          balanceAfter: newStock,
          referenceType: 'purchase',
          referenceId: purchaseRecord.id,
          notes: reviewProduct.supplierName
            ? `${reviewProduct.supplierName}${reviewProduct.invoiceNumber ? ` • Inv: ${reviewProduct.invoiceNumber}` : ''}`
            : undefined,
          createdAt: now,
        };
        storage.saveProductStockMovement(stockMovement);

        processedNames.add(normalizedName);
      } catch (err) {
        results.push({
          id: reviewProduct.id,
          productName: reviewProduct.productName,
          action: 'failed',
          reason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Save updated catalog via the prop callback (updates both localStorage and React state)
    onCatalogChange(updatedCatalog);

    setImportResults(results);
    setIsImporting(false);
    setShowConfirmModal(false);

    // Keep only failed items in review list
    const failedIds = results.filter(r => r.action === 'failed').map(r => r.id);
    setReviewList(prev => prev.filter(p => failedIds.includes(p.id)));
  }, [reviewList, catalog, onCatalogChange]);

  const closeResultsModal = () => {
    setImportResults(null);
  };

  const zoomIn = () => setScale((s) => Math.min(3, Math.round((s + 0.2) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(0.4, Math.round((s - 0.2) * 100) / 100));

  const goPrevPage = () => setPageNum((p) => Math.max(1, p - 1));
  const goNextPage = () => setPageNum((p) => Math.min(numPages, p + 1));

  const createdCount = importResults?.filter(r => r.action === 'created').length || 0;
  const updatedCount = importResults?.filter(r => r.action === 'updated').length || 0;
  const failedCount = importResults?.filter(r => r.action === 'failed').length || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 leading-tight">
              Smart Bill Import
            </h1>
            <p className="text-xs text-slate-500">
              Click text on the PDF to fill the inventory form
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm">
            <Upload className="w-4 h-4" />
            Upload PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onFileChange}
            />
          </label>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-0 min-h-0">
        {/* Left: PDF viewer */}
        <section className="relative flex flex-col min-h-0 border-r border-slate-200 bg-slate-100/40">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
              <span className="truncate max-w-[40ch]">
                {fileName || 'No file loaded'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={goPrevPage}
                disabled={!pdfDoc || pageNum <= 1}
                className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-2 tabular-nums">
                {pdfDoc ? `${pageNum} / ${numPages}` : '—'}
              </span>
              <button
                onClick={goNextPage}
                disabled={!pdfDoc || pageNum >= numPages}
                className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <button
                onClick={zoomOut}
                disabled={!pdfDoc}
                className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-1 tabular-nums w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                disabled={!pdfDoc}
                className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewer area */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto p-4 flex justify-center"
          >
            {!pdfDoc && !loading && (
              <EmptyState error={error} />
            )}
            {loading && (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-3 py-20">
                <div className="w-10 h-10 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
                <p className="text-sm">Loading PDF…</p>
              </div>
            )}
            {pdfDoc && (
              <div className="relative shadow-xl" style={{ background: 'white' }}>
                <canvas ref={canvasRef} className="block" />
                <div
                  ref={textLayerRef}
                  onClick={handleTextLayerClick}
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: renderedSize?.w, height: renderedSize?.h }}
                >
                  {textSpans.map((s) => (
                    <span
                      key={s.id}
                      data-text-id={s.id}
                      className="absolute text-transparent hover:bg-emerald-400/25 hover:ring-1 hover:ring-emerald-500/60 cursor-pointer select-none transition-colors"
                      style={{
                        left: s.left,
                        top: s.top,
                        width: s.width,
                        height: s.height,
                        fontSize: s.fontSize,
                        lineHeight: `${s.height}px`,
                        fontFamily: 'sans-serif',
                        whiteSpace: 'pre',
                      }}
                    >
                      {s.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: Form sidebar */}
        <aside className="flex flex-col min-h-0 bg-white overflow-y-auto">
          {/* Invoice Details Section */}
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              <Receipt className="w-3.5 h-3.5" />
              Invoice Details
            </div>

            {/* Supplier Dropdown */}
            <div className="relative mb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between transition-all ${
                  selectedSupplierId
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className={selectedSupplierId ? 'text-slate-800' : 'text-slate-400'}>
                  {selectedSupplier?.firmName || 'Select supplier...'}
                </span>
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showSupplierDropdown ? 'rotate-90' : ''}`} />
              </button>

              {showSupplierDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search suppliers..."
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {filteredSuppliers.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center">
                        No suppliers found
                      </div>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId(supplier.id);
                            setShowSupplierDropdown(false);
                            setSupplierSearch('');
                          }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center justify-between ${
                            selectedSupplierId === supplier.id ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-800">{supplier.firmName}</div>
                            {supplier.gstNumber && (
                              <div className="text-slate-500">GST: {supplier.gstNumber}</div>
                            )}
                          </div>
                          {selectedSupplierId === supplier.id && (
                            <Check className="w-4 h-4 text-emerald-600" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Invoice Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Supplier's invoice number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                />
                <Receipt className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Optional: Enter the supplier's invoice number for reference
              </p>
            </div>
          </div>

          {/* Active field tracker */}
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/40">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <MousePointerClick className="w-3.5 h-3.5" />
              Active Field Tracker
            </div>
            {isRowComplete ? (
              <div className="mt-2 flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Row complete</span>
                <span className="text-xs text-slate-500">— click Reset or Add Product</span>
              </div>
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-sm text-slate-500">Now filling:</span>
                <span className="text-lg font-semibold text-slate-900">
                  {FIELD_LABELS[activeField]}
                </span>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Click a text span on the PDF to fill this field.{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[10px] font-semibold text-slate-600">
                Shift
              </kbd>{' '}
              + click to append multiple spans.
            </p>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                Inventory Intake
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddProduct}
                  disabled={!selectedSupplierId || !formData.productName.trim()}
                  className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-2.5 py-1.5 rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </button>
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-md transition-colors"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {FIELD_ORDER.map((key) => (
                <FieldInput
                  key={key}
                  label={FIELD_LABELS[key]}
                  value={formData[key]}
                  isActive={activeField === key}
                  isFlash={flashField === key}
                  isNumeric={NUMERIC_FIELDS.includes(key)}
                  onFocus={onFieldFocus(key)}
                  onChange={onFieldChange(key)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                Numeric fields auto-strip currency symbols and thousands separators.
                Clicking a field here makes it the active listener.
              </p>
            </div>
          </div>

          {/* Review List */}
          {reviewList.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Products to Import ({reviewList.length})
                  </h3>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Import
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {reviewList.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-start justify-between p-3 bg-white rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {product.productName || 'Unnamed Product'}
                        </p>
                        {(product.supplierName || product.invoiceNumber) && (
                          <p className="mt-0.5 text-slate-400 truncate">
                            {product.supplierName && <span>{product.supplierName}</span>}
                            {product.supplierName && product.invoiceNumber && <span> • </span>}
                            {product.invoiceNumber && <span>Inv: {product.invoiceNumber}</span>}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-500">
                          {product.hsn && <span>HSN: {product.hsn}</span>}
                          {product.gstPercent && <span>GST: {product.gstPercent}%</span>}
                          {product.quantity && <span>Qty: {product.quantity}</span>}
                          {product.rate && <span>Rate: {product.rate}</span>}
                          {product.unit && <span>Unit: {product.unit}</span>}
                          {product.amount && <span>Amt: {product.amount}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirm Import
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isImporting}
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                You are about to import <strong>{reviewList.length}</strong> product(s) into your Product Catalog.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">New products to create:</span>
                  <span className="font-semibold text-emerald-700">{getImportPreview.newCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Existing products to update:</span>
                  <span className="font-semibold text-blue-700">{getImportPreview.updateCount}</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Existing products will have their stock quantity increased,
                  and their HSN, GST%, Purchase Rate, and Unit will be overwritten with the imported values.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-white transition-colors text-sm"
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                onClick={executeImport}
                disabled={isImporting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Confirm Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {importResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {failedCount > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                )}
                Import Complete
              </h3>
              <button
                onClick={closeResultsModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Products created:</span>
                  <span className="font-semibold text-emerald-700">{createdCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Products updated:</span>
                  <span className="font-semibold text-blue-700">{updatedCount}</span>
                </div>
                {failedCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Failed:</span>
                    <span className="font-semibold text-red-700">{failedCount}</span>
                  </div>
                )}
              </div>
              {failedCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-800 font-medium mb-2">Failed items:</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {importResults
                      .filter(r => r.action === 'failed')
                      .map(r => (
                        <li key={r.id}>
                          • {r.productName}: {r.reason}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {failedCount > 0 ? (
                <p className="text-xs text-slate-500">
                  Failed items remain in the review list for you to retry.
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  All products have been imported. The review list has been cleared.
                </p>
              )}
            </div>
            <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={closeResultsModal}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function computeNextField(data: FormData, current: FieldKey): FieldKey | null {
  const idx = FIELD_ORDER.indexOf(current);
  for (let i = idx + 1; i < FIELD_ORDER.length; i++) {
    if (data[FIELD_ORDER[i]].trim() === '') return FIELD_ORDER[i];
  }
  return null;
}

function FieldInput({
  label,
  value,
  isActive,
  isFlash,
  isNumeric,
  onFocus,
  onChange,
}: {
  label: string;
  value: string;
  isActive: boolean;
  isFlash: boolean;
  isNumeric: boolean;
  onFocus: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span
        className={`block text-xs font-medium mb-1 transition-colors ${
          isActive ? 'text-emerald-700' : 'text-slate-500'
        }`}
      >
        {label}
        {isActive && (
          <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            listening
          </span>
        )}
      </span>
      <input
        type="text"
        inputMode={isNumeric ? 'decimal' : 'text'}
        value={value}
        onFocus={onFocus}
        onChange={onChange}
        className={`w-full px-3 py-2 rounded-lg border text-sm transition-all outline-none ${
          isFlash
            ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300/50'
            : isActive
            ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-300/40'
            : 'border-slate-200 bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300/30'
        }`}
        placeholder={isNumeric ? '0.00' : '—'}
      />
    </label>
  );
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700">Upload a supplier invoice</h3>
      <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
        Drag a PDF invoice into the viewer to start clicking text and filling the
        inventory form on the right.
      </p>
      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}
