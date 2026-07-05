// ─── PDF Viewer Component ───────────────────────────────────────────────────────
// Renders PDF pages to canvas with zoom/pan controls.
// Provides overlay for interactive elements (table selection, column clicks).

import { useState, useEffect, useRef, ReactNode } from 'react';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { PageTextData } from './extractionEngine';
import { extractTextFromPdf } from './extractionEngine';

export interface PdfViewerProps {
  file: File;
  currentPage: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onDocumentLoad: (pdfDoc: any, pageCount: number, pageTextData: PageTextData[], viewport: { width: number; height: number }) => void;
  children?: ReactNode;
}

export function PdfViewer({
  file,
  currentPage,
  zoom,
  onPageChange,
  onZoomChange,
  onDocumentLoad,
  children,
}: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [, setViewport] = useState<{ width: number; height: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

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

        // Extract text from all pages (for column detection)
        const pageTextData = await extractTextFromPdf(doc);

        if (cancelled) return;

        // Get viewport from first page
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        setViewport({ width: vp.width, height: vp.height });

        onDocumentLoad(doc, doc.numPages, pageTextData, { width: vp.width, height: vp.height });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const vp = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      } catch (err) {
        console.warn('PDF render error:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  return (
    <div className="flex flex-col h-full bg-slate-700">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 text-white flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
            onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
            disabled={currentPage >= pageCount}
            className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.2))}
            className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs px-2 py-1 bg-slate-700 rounded-md min-w-[55px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(3, zoom + 0.2))}
            className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => onZoomChange(1.2)}
            className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            title="Reset zoom"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto p-4 flex justify-center" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading PDF...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-300 gap-2 p-4 text-center">
            <AlertTriangle className="w-6 h-6" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="relative inline-block shadow-2xl">
            <canvas
              ref={canvasRef}
              className="block bg-white"
              style={{ maxWidth: 'none' }}
            />
            {/* Overlay for interactive elements */}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
