import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ImportFieldKey,
  DocumentMetadata,
  SupplierData,
} from '../../types';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  X,
  Check,
  RefreshCw,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Edit3,
  Eye,
  Save,
} from 'lucide-react';
import {
  PdfTextItem,
  PageTextData,
  DetectedColumn,
  detectColumnFromHeader,
  alignColumnRows,
  applySavedLayout,
  buildLayoutFromColumns,
} from '../../utils/pdfColumnDetection';
import type { SupplierPdfLayout } from '../../types';
import { storage } from '../../utils/storage';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PdfProductRow {
  id: string;
  productName: string;
  quantity: string;
  unit: string;
  hsnSac: string;
  purchasePrice: string;
  gstPercent: string;
  amount: string;
}

export interface InteractivePdfMappingResult {
  // Extracted product rows (already aligned across columns)
  productRows: PdfProductRow[];
  // Metadata values (invoice number, date, supplier name, supplier gstin)
  metadataValues: {
    invoiceNumber?: string;
    invoiceDate?: string;
    supplierName?: string;
    supplierGstin?: string;
    invoiceTotal?: string;
  };
  // Whether to remember the supplier layout
  rememberLayout: boolean;
  // The supplier to associate the layout with (if remembering)
  supplierId?: string;
}

interface Props {
  file: File;
  initialMetadata?: DocumentMetadata;
  suppliers: SupplierData[];
  selectedSupplierId: string;
  onSelectSupplier: (id: string) => void;
  savedLayout?: SupplierPdfLayout | null;
  onApply: (result: InteractivePdfMappingResult) => void;
  onCancel: () => void;
}

// ─── Step definitions for guided column mapping ─────────────────────────────

interface MappingStep {
  fieldKey: ImportFieldKey;
  label: string;
  instruction: string;
  required: boolean;
}

const MAPPING_STEPS: MappingStep[] = [
  { fieldKey: 'productName', label: 'Product Name', instruction: 'Click the "Description of Goods" or product name column header', required: true },
  { fieldKey: 'quantity', label: 'Quantity', instruction: 'Click the Qty / Quantity column header', required: true },
  { fieldKey: 'hsnSac', label: 'HSN/SAC', instruction: 'Click the HSN/SAC column header (skip if not present)', required: false },
  { fieldKey: 'unit', label: 'Unit', instruction: 'Click the Unit column header (skip if not present)', required: false },
  { fieldKey: 'purchasePrice', label: 'Purchase Rate', instruction: 'Click the Rate / Price column header', required: true },
  { fieldKey: 'gstPercent', label: 'GST %', instruction: 'Click the GST column header (skip if not present)', required: false },
  { fieldKey: 'amount', label: 'Amount', instruction: 'Click the Amount / Total column header (skip if not present)', required: false },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function InteractivePdfMapping({
  file,
  initialMetadata,
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  savedLayout,
  onApply,
  onCancel,
}: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  // Text items per page, in PDF coordinate space
  const [pageTextData, setPageTextData] = useState<PageTextData[]>([]);
  // Rendered page dimensions (at scale 1) for coordinate transforms
  const [pageViewport, setPageViewport] = useState<{ width: number; height: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Current step index (0 = Product Name, 1 = Quantity, etc.)
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  // Detected columns: fieldKey -> DetectedColumn
  const [detectedColumns, setDetectedColumns] = useState<Partial<Record<ImportFieldKey, DetectedColumn>>>({});
  // Hovered text item index (for cursor feedback during selection)
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  // Whether we're in the preview/edit phase (all required steps done)
  const [phase, setPhase] = useState<'mapping' | 'preview'>('mapping');
  // Editable product rows
  const [productRows, setProductRows] = useState<PdfProductRow[]>([]);
  // Metadata values
  const [metadataValues, setMetadataValues] = useState<{
    invoiceNumber?: string;
    invoiceDate?: string;
    supplierName?: string;
    supplierGstin?: string;
    invoiceTotal?: string;
  }>({});
  // Remember layout checkbox
  const [rememberLayout, setRememberLayout] = useState(true);
  // Whether a saved layout was auto-applied
  const [layoutAutoApplied, setLayoutAutoApplied] = useState(false);

  const currentStep = MAPPING_STEPS[currentStepIdx];
  const isSelecting = phase === 'mapping';

  // ─── Load PDF document ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

        const buffer = await file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setCurrentPage(1);

        // Extract text items from all pages with positions
        const allPageText: PageTextData[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1 });

          if (i === 1) {
            setPageViewport({ width: viewport.width, height: viewport.height });
          }

          const items: PdfTextItem[] = (content.items as any[])
            .filter((it: any) => it.str && it.str.trim())
            .map((it: any) => {
              const tx = it.transform;
              const x = tx[4];
              const y = tx[5];
              const height = Math.abs(tx[3]) || 10;
              const width = it.width || (it.str.length * height * 0.5);
              return {
                str: it.str,
                x,
                y,
                width,
                height,
                page: i,
              };
            });

          allPageText.push({ page: i, items });
        }

        if (cancelled) return;
        setPageTextData(allPageText);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // ─── Initialize metadata from parser detection ────────────────────────────
  useEffect(() => {
    if (initialMetadata) {
      setMetadataValues({
        invoiceNumber: initialMetadata.invoiceNumber,
        invoiceDate: initialMetadata.invoiceDate,
        supplierName: initialMetadata.supplierName,
        supplierGstin: initialMetadata.supplierGstin,
        invoiceTotal: initialMetadata.invoiceTotal,
      });
    }
  }, [initialMetadata]);

  // ─── Auto-apply saved layout if available ─────────────────────────────────
  useEffect(() => {
    if (!savedLayout || pageTextData.length === 0) return;

    const applied = applySavedLayout(savedLayout, pageTextData);
    const newColumns: Partial<Record<ImportFieldKey, DetectedColumn>> = {};
    let allSucceeded = true;

    for (const { fieldKey, column } of applied) {
      if (column) {
        newColumns[fieldKey] = column;
      } else {
        allSucceeded = false;
      }
    }

    setDetectedColumns(newColumns);
    setLayoutAutoApplied(allSucceeded && applied.length > 0);

    // If all required columns were auto-detected, jump to preview
    if (allSucceeded) {
      const requiredFields = MAPPING_STEPS.filter(s => s.required);
      const allRequiredDetected = requiredFields.every(s => newColumns[s.fieldKey]);
      if (allRequiredDetected) {
        setPhase('preview');
      }
    }
  }, [savedLayout, pageTextData]);

  // ─── Render current page to canvas ────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.warn('PDF render error:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // ─── Get text items for the current page ──────────────────────────────────
  const currentPageText = useMemo(() => {
    return pageTextData.find((p) => p.page === currentPage)?.items || [];
  }, [pageTextData, currentPage]);

  // ─── Coordinate transform: PDF coords → overlay coords ────────────────────
  const toOverlayCoords = useCallback(
    (item: PdfTextItem) => {
      if (!pageViewport) return { left: 0, top: 0, width: 0, height: 0 };
      const scaleX = zoom;
      const scaleY = zoom;
      const top = (pageViewport.height - item.y - item.height) * scaleY;
      const left = item.x * scaleX;
      const width = item.width * scaleX;
      const height = item.height * scaleY;
      return { left, top, width, height };
    },
    [pageViewport, zoom]
  );

  // ─── Click handler on overlay: detect column from clicked header ──────────
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelecting) return;
      const overlay = overlayRef.current;
      if (!overlay) return;

      const rect = overlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Find the text item whose bounding box contains the click point.
      // Pick the smallest item containing the point (most specific = header).
      let best: PdfTextItem | null = null;
      let bestArea = Infinity;
      for (const item of currentPageText) {
        const { left, top, width, height } = toOverlayCoords(item);
        if (
          clickX >= left &&
          clickX <= left + width &&
          clickY >= top &&
          clickY <= top + height
        ) {
          const area = width * height;
          if (area < bestArea) {
            bestArea = area;
            best = item;
          }
        }
      }

      if (best) {
        const detected = detectColumnFromHeader(best, pageTextData);
        setDetectedColumns((prev) => ({
          ...prev,
          [currentStep.fieldKey]: detected,
        }));
        // Auto-advance to the next step
        if (currentStepIdx < MAPPING_STEPS.length - 1) {
          setCurrentStepIdx(currentStepIdx + 1);
        }
      }
    },
    [isSelecting, currentPageText, toOverlayCoords, currentStep, currentStepIdx, pageTextData]
  );

  // ─── Hover handler for cursor feedback ───────────────────────────────────
  const handleOverlayMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSelecting) {
        if (hoveredItem !== null) setHoveredItem(null);
        return;
      }
      const overlay = overlayRef.current;
      if (!overlay) return;

      const rect = overlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let bestIdx: number | null = null;
      let bestArea = Infinity;
      for (let i = 0; i < currentPageText.length; i++) {
        const item = currentPageText[i];
        const { left, top, width, height } = toOverlayCoords(item);
        if (x >= left && x <= left + width && y >= top && y <= top + height) {
          const area = width * height;
          if (area < bestArea) {
            bestArea = area;
            bestIdx = i;
          }
        }
      }
      setHoveredItem(bestIdx);
    },
    [isSelecting, currentPageText, toOverlayCoords, hoveredItem]
  );

  // ─── Build aligned product rows from detected columns ─────────────────────
  const alignedRows = useMemo(() => {
    const detectedList = Object.values(detectedColumns).filter(
      (c): c is DetectedColumn => c !== null
    );
    if (detectedList.length === 0) return [];
    // Debug: log selected column coordinates
    console.log('[InteractivePdfMapping] Selected column coordinates:',
      detectedList.map(c => ({
        header: c.headerItem.str,
        page: c.page,
        xStart: c.xStart,
        xEnd: c.xEnd,
        headerY: c.headerItem.y,
        valueCount: c.values.length,
        values: c.values,
        rowYPositions: c.rowYPositions,
      }))
    );
    const aligned = alignColumnRows(detectedList);
    console.log('[InteractivePdfMapping] Detected rows (aligned):', aligned);
    return aligned;
  }, [detectedColumns]);

  // ─── Sync aligned rows to editable product rows when entering preview ─────
  // alignColumnRows keys rowValues by the actual PDF header text (e.g.
  // "Description of Goods"), not by our step label (e.g. "Product Name").
  // Build a fieldKey → headerText lookup from detectedColumns to bridge them.
  useEffect(() => {
    if (phase === 'preview' && productRows.length === 0 && alignedRows.length > 0) {
      const headerByKey = new Map<ImportFieldKey, string>();
      for (const [fieldKey, col] of Object.entries(detectedColumns)) {
        if (col) {
          headerByKey.set(fieldKey as ImportFieldKey, col.headerItem.str.trim());
        }
      }
      const rows: PdfProductRow[] = alignedRows.map((r, idx) => {
        const getVal = (key: ImportFieldKey): string => {
          const header = headerByKey.get(key);
          return header ? (r.rowValues[header] ?? '') : '';
        };
        return {
          id: `row-${idx}-${Date.now()}`,
          productName: getVal('productName'),
          quantity: getVal('quantity'),
          unit: getVal('unit'),
          hsnSac: getVal('hsnSac'),
          purchasePrice: getVal('purchasePrice'),
          gstPercent: getVal('gstPercent'),
          amount: getVal('amount'),
        };
      });
      console.log('[InteractivePdfMapping] Products Extracted from PDF columns:', rows);
      console.log('[InteractivePdfMapping] Data passed to Preview:', rows);
      setProductRows(rows);
    }
  }, [phase, alignedRows, productRows.length, detectedColumns]);

  // ─── Step actions ──────────────────────────────────────────────────────────
  const skipStep = () => {
    setDetectedColumns((prev) => {
      const next = { ...prev };
      delete next[currentStep.fieldKey];
      return next;
    });
    if (currentStepIdx < MAPPING_STEPS.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIdx > 0) setCurrentStepIdx(currentStepIdx - 1);
  };

  const clearColumn = (fieldKey: ImportFieldKey) => {
    setDetectedColumns((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const [extractionError, setExtractionError] = useState<string>('');

  const goToPreview = () => {
    // Guard: if zero products extracted, do NOT open preview
    if (alignedRows.length === 0) {
      setExtractionError('No products could be extracted from the selected columns. Please re-map the columns and try again.');
      return;
    }
    setExtractionError('');
    setPhase('preview');
  };

  const backToMapping = () => {
    setPhase('mapping');
    setProductRows([]);
  };

  const updateProductRow = (id: string, field: keyof PdfProductRow, value: string) => {
    setProductRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const deleteProductRow = (id: string) => {
    setProductRows((rows) => rows.filter((r) => r.id !== id));
  };

  const addProductRow = () => {
    setProductRows((rows) => [
      ...rows,
      {
        id: `row-new-${Date.now()}`,
        productName: '',
        quantity: '',
        unit: '',
        hsnSac: '',
        purchasePrice: '',
        gstPercent: '',
        amount: '',
      },
    ]);
  };

  const handleApply = () => {
    // Save the supplier layout (with column coordinates) if requested.
    // This must happen here, where the detectedColumns (with coordinates) are
    // available — the parent only receives the extracted product rows.
    if (rememberLayout && selectedSupplierId) {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      if (supplier) {
        const columnsForLayout: { fieldKey: ImportFieldKey; column: DetectedColumn }[] = [];
        for (const [fieldKey, col] of Object.entries(detectedColumns)) {
          if (col) {
            columnsForLayout.push({ fieldKey: fieldKey as ImportFieldKey, column: col });
          }
        }

        if (columnsForLayout.length > 0) {
          const existing = storage.getSupplierPdfLayoutBySupplierId(selectedSupplierId);
          const layout = buildLayoutFromColumns(
            selectedSupplierId,
            supplier.firmName,
            metadataValues.supplierGstin || supplier.gstNumber,
            columnsForLayout,
            {
              invoiceNumber: metadataValues.invoiceNumber,
              invoiceDate: metadataValues.invoiceDate,
              supplierName: metadataValues.supplierName || supplier.firmName,
              supplierGstin: metadataValues.supplierGstin,
            }
          );
          // Preserve id and createdAt if updating an existing layout
          if (existing) {
            layout.id = existing.id;
            layout.createdAt = existing.createdAt;
            layout.useCount = (existing.useCount || 0) + 1;
          }
          storage.saveSupplierPdfLayout(layout);
        }
      }
    }

    onApply({
      productRows,
      metadataValues,
      rememberLayout,
      supplierId: selectedSupplierId || undefined,
    });
    console.log('[InteractivePdfMapping] Products sent to parent workflow:', productRows);
  };

  // ─── Derived state ─────────────────────────────────────────────────────────
  const mappedFields = Object.keys(detectedColumns) as ImportFieldKey[];
  const mappedCount = mappedFields.length;
  const requiredFields = MAPPING_STEPS.filter((s) => s.required);
  const mappedRequired = requiredFields.filter((s) => detectedColumns[s.fieldKey]).length;
  const allRequiredMapped = mappedRequired === requiredFields.length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">
              {phase === 'mapping' ? 'Teach the PDF Layout' : 'Preview & Edit Products'}
            </h2>
            <p className="text-xs text-slate-400 truncate">
              {phase === 'mapping'
                ? `Step ${currentStepIdx + 1} of ${MAPPING_STEPS.length}: ${currentStep.label}`
                : `${productRows.length} products extracted — edit before importing`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {layoutAutoApplied && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-700 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Layout auto-applied
            </span>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700 text-xs">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {mappedCount}/{MAPPING_STEPS.length} columns
          </span>
          <button
            onClick={onCancel}
            className="p-2 rounded-md hover:bg-slate-700 transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body: split panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: PDF preview */}
        <div className="flex-1 flex flex-col bg-slate-700 min-w-0">
          {/* PDF toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 text-white flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs px-2 py-1 bg-slate-700 rounded-md min-w-[80px] text-center">
                Page {currentPage} / {pageCount || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs px-2 py-1 bg-slate-700 rounded-md min-w-[55px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1.2)}
                className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
                title="Reset zoom"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PDF canvas area */}
          <div className="flex-1 overflow-auto p-4 flex justify-center" style={{ minHeight: 0 }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading PDF...</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center h-full text-red-300 gap-2 p-4 text-center">
                <AlertTriangle className="w-6 h-6" />
                <p className="text-sm">{loadError}</p>
              </div>
            ) : (
              <div className="relative inline-block shadow-2xl">
                <canvas
                  ref={canvasRef}
                  className="block bg-white"
                  style={{ maxWidth: 'none' }}
                />
                {/* Text overlay for click selection */}
                <div
                  ref={overlayRef}
                  onClick={handleOverlayClick}
                  onMouseMove={handleOverlayMove}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="absolute inset-0"
                  style={{
                    cursor: isSelecting ? 'crosshair' : 'default',
                  }}
                >
                  {/* Hovered item highlight (during selection mode) */}
                  {isSelecting && hoveredItem !== null && currentPageText[hoveredItem] && (
                    <div
                      className="absolute pointer-events-none border-2 border-emerald-400 bg-emerald-400/20 rounded-sm"
                      style={{
                        ...toOverlayCoords(currentPageText[hoveredItem]),
                      }}
                    />
                  )}
                  {/* Detected column highlights */}
                  {Object.entries(detectedColumns).map(([fieldKey, col]) => {
                    if (!col || col.page !== currentPage) return null;
                    return (
                      <div
                        key={fieldKey}
                        className="absolute pointer-events-none border-2 border-emerald-500 bg-emerald-500/10 rounded-sm"
                        style={{
                          left: col.xStart * zoom,
                          top: (pageViewport ? (pageViewport.height - col.headerItem.y - col.headerItem.height) : 0) * zoom,
                          width: (col.xEnd - col.xStart) * zoom,
                          height: ((pageViewport ? pageViewport.height : 0) - col.headerItem.y) * zoom,
                        }}
                      >
                        <span className="absolute -top-5 left-0 text-[10px] font-semibold px-1 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap">
                          {MAPPING_STEPS.find(s => s.fieldKey === fieldKey)?.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selection mode indicator */}
          {isSelecting && (
            <div className="px-3 py-2 bg-emerald-600 text-white text-xs flex items-center justify-between flex-shrink-0">
              <span className="flex items-center gap-2">
                <MousePointerClick className="w-3.5 h-3.5" />
                Click the <strong>{currentStep.label}</strong> column header in the PDF
              </span>
              <button
                onClick={() => setHoveredItem(null)}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Steps / Preview */}
        <div className="w-[420px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col">
          {phase === 'mapping' ? (
            <MappingStepsPanel
              currentStepIdx={currentStepIdx}
              detectedColumns={detectedColumns}
              onSkip={skipStep}
              onPrev={goToPrevStep}
              onClear={clearColumn}
              onGoToPreview={goToPreview}
              allRequiredMapped={allRequiredMapped}
              mappedRequired={mappedRequired}
              requiredCount={requiredFields.length}
              extractionError={extractionError}
            />
          ) : (
            <PreviewPanel
              productRows={productRows}
              metadataValues={metadataValues}
              setMetadataValues={setMetadataValues}
              suppliers={suppliers}
              selectedSupplierId={selectedSupplierId}
              onSelectSupplier={onSelectSupplier}
              rememberLayout={rememberLayout}
              setRememberLayout={setRememberLayout}
              onUpdateRow={updateProductRow}
              onDeleteRow={deleteProductRow}
              onAddRow={addProductRow}
              onBackToMapping={backToMapping}
              onApply={handleApply}
              savedLayout={savedLayout}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mapping Steps Panel (right panel during mapping phase) ──────────────────

function MappingStepsPanel({
  currentStepIdx,
  detectedColumns,
  onSkip,
  onPrev,
  onClear,
  onGoToPreview,
  allRequiredMapped,
  mappedRequired,
  requiredCount,
  extractionError,
}: {
  currentStepIdx: number;
  detectedColumns: Partial<Record<ImportFieldKey, DetectedColumn>>;
  onSkip: () => void;
  onPrev: () => void;
  onClear: (fieldKey: ImportFieldKey) => void;
  onGoToPreview: () => void;
  allRequiredMapped: boolean;
  mappedRequired: number;
  requiredCount: number;
  extractionError: string;
}) {
  const currentStep = MAPPING_STEPS[currentStepIdx];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          Column Mapping Steps
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Click each column header in the PDF. The parser auto-extracts all rows beneath it.
        </p>
      </div>

      {/* Current step instruction */}
      <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-semibold">
            Step {currentStepIdx + 1}
          </span>
          <span className="text-sm font-semibold text-slate-800">{currentStep.label}</span>
          {currentStep.required && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">required</span>
          )}
        </div>
        <p className="text-xs text-slate-600">{currentStep.instruction}</p>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: 0 }}>
        {MAPPING_STEPS.map((step, idx) => {
          const detected = detectedColumns[step.fieldKey];
          const isCurrent = idx === currentStepIdx;
          const isDone = !!detected;

          return (
            <div
              key={step.fieldKey}
              className={`rounded-lg border p-3 transition-colors ${
                isCurrent
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                  : isDone
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isCurrent ? (
                    <Circle className="w-4 h-4 text-emerald-500 fill-emerald-100" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300" />
                  )}
                  <span className={`text-sm font-medium ${isCurrent || isDone ? 'text-slate-800' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                  {step.required && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">required</span>
                  )}
                </div>
                {detected && (
                  <button
                    onClick={() => onClear(step.fieldKey)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Clear this column"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {detected ? (
                <div className="mt-1.5">
                  <p className="text-xs text-slate-500 mb-1">
                    Header: <span className="font-mono text-slate-700">{detected.headerItem.str}</span>
                  </p>
                  <p className="text-xs text-emerald-600">
                    {detected.values.length} row{detected.values.length !== 1 ? 's' : ''} detected
                  </p>
                  {detected.values.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      First: <span className="font-mono">{detected.values[0]}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">{step.instruction}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
        {extractionError && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{extractionError}</p>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {mappedRequired}/{requiredCount} required columns
          </span>
          {allRequiredMapped && (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Ready to preview
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrev}
            disabled={currentStepIdx === 0}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {!currentStep.required && (
            <button
              onClick={onSkip}
              className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-sm flex items-center gap-1.5"
            >
              Skip
            </button>
          )}
          <button
            onClick={onGoToPreview}
            disabled={!allRequiredMapped}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            Preview Products
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Panel (right panel during preview phase) ────────────────────────

function PreviewPanel({
  productRows,
  metadataValues,
  setMetadataValues,
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  rememberLayout,
  setRememberLayout,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onBackToMapping,
  onApply,
  savedLayout,
}: {
  productRows: PdfProductRow[];
  metadataValues: { invoiceNumber?: string; invoiceDate?: string; supplierName?: string; supplierGstin?: string; invoiceTotal?: string };
  setMetadataValues: (v: { invoiceNumber?: string; invoiceDate?: string; supplierName?: string; supplierGstin?: string; invoiceTotal?: string }) => void;
  suppliers: SupplierData[];
  selectedSupplierId: string;
  onSelectSupplier: (id: string) => void;
  rememberLayout: boolean;
  setRememberLayout: (v: boolean) => void;
  onUpdateRow: (id: string, field: keyof PdfProductRow, value: string) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: () => void;
  onBackToMapping: () => void;
  onApply: () => void;
  savedLayout?: SupplierPdfLayout | null;
}) {
  const totalAmount = useMemo(() => {
    return productRows.reduce((sum, r) => {
      const amt = parseFloat(r.amount || r.purchasePrice) || 0;
      const qty = parseFloat(r.quantity) || 1;
      return sum + (r.amount ? amt : amt * qty);
    }, 0);
  }, [productRows]);

  // Debug: log data received by Preview
  useEffect(() => {
    console.log('[InteractivePdfMapping] Data received by Preview:', productRows);
  }, [productRows]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-emerald-600" />
          Editable Product Preview
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {productRows.length} products extracted. Edit any cell before importing.
        </p>
      </div>

      {/* Product rows table */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {productRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            No products extracted yet. Go back and map the required columns.
          </div>
        ) : (
          <div className="p-2">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-left text-slate-500">
                  <th className="p-1.5 font-medium">Product</th>
                  <th className="p-1.5 font-medium w-14">Qty</th>
                  <th className="p-1.5 font-medium w-14">Unit</th>
                  <th className="p-1.5 font-medium w-20">HSN</th>
                  <th className="p-1.5 font-medium w-16">Rate</th>
                  <th className="p-1.5 font-medium w-12">GST</th>
                  <th className="p-1.5 font-medium w-16">Amount</th>
                  <th className="p-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.productName}
                        onChange={(e) => onUpdateRow(row.id, 'productName', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                        placeholder="Product name"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.quantity}
                        onChange={(e) => onUpdateRow(row.id, 'quantity', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => onUpdateRow(row.id, 'unit', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.hsnSac}
                        onChange={(e) => onUpdateRow(row.id, 'hsnSac', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.purchasePrice}
                        onChange={(e) => onUpdateRow(row.id, 'purchasePrice', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.gstPercent}
                        onChange={(e) => onUpdateRow(row.id, 'gstPercent', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.amount}
                        onChange={(e) => onUpdateRow(row.id, 'amount', e.target.value)}
                        className="w-full px-1.5 py-1 border border-transparent rounded hover:border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-right"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => onDeleteRow(row.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Delete row"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={onAddRow}
              className="mt-2 w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              + Add row
            </button>
          </div>
        )}
      </div>

      {/* Metadata + supplier + remember layout */}
      <div className="border-t border-slate-200 p-3 space-y-2.5 flex-shrink-0 max-h-[40%] overflow-y-auto bg-slate-50">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Invoice Details
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <MetadataInput
              label="Invoice No"
              value={metadataValues.invoiceNumber || ''}
              onChange={(v) => setMetadataValues({ ...metadataValues, invoiceNumber: v })}
            />
            <MetadataInput
              label="Invoice Date"
              value={metadataValues.invoiceDate || ''}
              onChange={(v) => setMetadataValues({ ...metadataValues, invoiceDate: v })}
            />
            <MetadataInput
              label="Supplier Name"
              value={metadataValues.supplierName || ''}
              onChange={(v) => setMetadataValues({ ...metadataValues, supplierName: v })}
            />
            <MetadataInput
              label="Supplier GSTIN"
              value={metadataValues.supplierGstin || ''}
              onChange={(v) => setMetadataValues({ ...metadataValues, supplierGstin: v })}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Supplier
          </p>
          <select
            value={selectedSupplierId}
            onChange={(e) => onSelectSupplier(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">- Select supplier (optional) -</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firmName}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
          <input
            type="checkbox"
            checked={rememberLayout}
            onChange={(e) => setRememberLayout(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div className="flex-1">
            <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              Remember this supplier layout
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              {savedLayout
                ? 'Updates the existing saved layout for this supplier.'
                : 'Next time you upload a PDF from this supplier, columns auto-map.'}
            </p>
          </div>
        </label>
      </div>

      {/* Footer actions */}
      <div className="px-3 py-3 border-t border-slate-200 bg-white flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {productRows.length} products · Total: Rs. {totalAmount.toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBackToMapping}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onApply}
            disabled={productRows.length === 0}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Confirm Import ({productRows.length})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Metadata input sub-component ────────────────────────────────────────────

function MetadataInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
      />
    </div>
  );
}
