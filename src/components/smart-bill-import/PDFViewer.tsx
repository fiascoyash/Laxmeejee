import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Play, AlertCircle } from 'lucide-react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PDFViewerProps {
  pdfFile: File;
  onStartMapping: () => void;
  onBack: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfFile,
  onStartMapping,
  onBack,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // Load PDF document from File object
  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      console.log('PDFViewer: Starting PDF load...');
      console.log('PDFViewer: pdfFile name:', pdfFile?.name);
      console.log('PDFViewer: pdfFile type:', pdfFile?.type);
      console.log('PDFViewer: pdfFile size:', pdfFile?.size);

      if (!pdfFile) {
        setError('No PDF file received.');
        setLoading(false);
        return;
      }

      try {
        // Read the file as ArrayBuffer - this creates a fresh buffer each time
        console.log('PDFViewer: Reading file as ArrayBuffer...');
        const arrayBuffer = await pdfFile.arrayBuffer();
        console.log('PDFViewer: ArrayBuffer size:', arrayBuffer.byteLength);

        // Create Uint8Array from ArrayBuffer
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log('PDFViewer: Created Uint8Array, length:', uint8Array.length);

        // Load the PDF document
        console.log('PDFViewer: Calling getDocument...');
        const loadingTask = pdfjsLib.getDocument({
          data: uint8Array,
          cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).href,
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        console.log('PDFViewer: PDF loaded successfully, numPages:', pdf.numPages);

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setError(null);
      } catch (err) {
        console.error('PDFViewer: Error loading PDF:', err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfFile]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !containerRef.current) {
      console.log('PDFViewer: renderPage skipped - no pdfDoc or container');
      return;
    }

    console.log('PDFViewer: renderPage starting for page', currentPage);
    setRendering(true);

    const container = containerRef.current;

    // Clear previous content
    container.innerHTML = '';

    try {
      // Get the page
      const page = await pdfDoc.getPage(currentPage);
      console.log('PDFViewer: Got page', currentPage);

      const viewport = page.getViewport({ scale });
      console.log('PDFViewer: viewport dimensions:', viewport.width, 'x', viewport.height);

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.style.border = '1px solid #e5e7eb';
      canvas.style.backgroundColor = '#ffffff';

      container.appendChild(canvas);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get canvas 2D context');
      }

      // Render the page
      console.log('PDFViewer: Rendering page to canvas...');
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      console.log('PDFViewer: Page rendered successfully');

      // Render text layer for selection
      try {
        const textContent = await page.getTextContent();
        console.log('PDFViewer: Got text content, items:', textContent.items.length);

        // Create text layer div
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: ${viewport.width}px;
          height: ${viewport.height}px;
          opacity: 1;
          mix-blend-mode: multiply;
          pointer-events: none;
        `;

        // Render text items
        textContent.items.forEach((item) => {
          if ('str' in item && item.str.trim()) {
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.cssText = `
              position: absolute;
              left: ${tx[4]}px;
              top: ${viewport.height - tx[5]}px;
              font-size: ${Math.abs(tx[0]) || 12}px;
              font-family: sans-serif;
              color: transparent;
              white-space: pre;
              pointer-events: none;
            `;
            textLayerDiv.appendChild(span);
          }
        });

        container.appendChild(textLayerDiv);
        console.log('PDFViewer: Text layer rendered');
      } catch (textErr) {
        console.warn('PDFViewer: Text layer error:', textErr);
        // Continue without text layer
      }

      setError(null);
    } catch (err) {
      console.error('PDFViewer: Error rendering page:', err);
      setError(`Failed to render page: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRendering(false);
    }
  }, [pdfDoc, currentPage, scale]);

  // Render when document changes or page/scale changes
  useEffect(() => {
    if (pdfDoc && !loading) {
      renderPage();
    }
  }, [pdfDoc, currentPage, scale, loading, renderPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(Math.min(scale + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale - 0.25, 0.5));
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">View PDF Bill</h2>
            <p className="text-slate-600 text-sm">Loading PDF...</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
        </div>
        <div className="flex items-center justify-center h-[400px] bg-slate-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading PDF document...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">View PDF Bill</h2>
            <p className="text-red-600 text-sm">Error loading PDF</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
        </div>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-medium mb-1">Failed to load PDF</h3>
              <p className="text-red-600 text-sm mb-3">{error}</p>
              <p className="text-red-500 text-xs">
                File: {pdfFile?.name || 'Unknown'} | Size: {pdfFile?.size?.toLocaleString() || 'N/A'} bytes
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main viewer
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">View PDF Bill</h2>
          <p className="text-slate-600 text-sm">
            Review the PDF and start mapping when ready
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={onStartMapping}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Mapping
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-slate-700 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-slate-700 min-w-[60px] text-center font-medium">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div
        className="border border-slate-200 rounded-lg overflow-auto bg-slate-100"
        style={{ maxHeight: '600px' }}
      >
        {rendering && (
          <div className="flex items-center justify-center py-4 bg-slate-50 border-b border-slate-200">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mr-2" />
            <span className="text-slate-600 text-sm">Rendering page...</span>
          </div>
        )}
        <div
          ref={containerRef}
          className="pdf-container p-4 flex justify-center"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Debug info */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
        <div className="grid grid-cols-2 gap-2">
          <span>File: {pdfFile?.name}</span>
          <span>Size: {pdfFile?.size?.toLocaleString() || 'N/A'} bytes</span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-amber-800 text-sm">
          <strong>Note:</strong> Review all pages of your supplier bill.
          Click "Start Mapping" to begin teaching the system which values to extract.
        </p>
      </div>
    </div>
  );
};
