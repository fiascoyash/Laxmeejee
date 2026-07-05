// ─── Table Selector Component ──────────────────────────────────────────────────
// Allows user to draw a rectangle around the product table area in a PDF.
// The selection defines the region for column extraction.

import { useState, useRef, useCallback, useEffect } from 'react';
import { TableSelection } from './types';

export interface TableSelectorProps {
  zoom: number;
  viewport: { width: number; height: number } | null;
  currentPage: number;
  onSelection: (selection: TableSelection) => void;
  initialSelection?: TableSelection | null;
}

export function TableSelector({
  zoom,
  viewport,
  currentPage,
  onSelection,
  initialSelection,
}: TableSelectorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<TableSelection | null>(initialSelection || null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Convert screen coordinates to PDF coordinates
  const screenToPdf = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      if (!viewport) return { x: 0, y: 0 };
      return {
        x: screenX / zoom,
        y: viewport.height - screenY / zoom, // PDF Y is bottom-up
      };
    },
    [viewport, zoom]
  );

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current || !viewport) return;

      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      setIsDrawing(true);
      setStart({ x: screenX, y: screenY });
      setCurrent({ x: screenX, y: screenY });
      setSelection(null);
    },
    [viewport]
  );

  // Handle mouse move - update drawing
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !containerRef.current || !viewport || !start) return;

      const rect = containerRef.current.getBoundingClientRect();
      const screenX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const screenY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      setCurrent({ x: screenX, y: screenY });
    },
    [isDrawing, viewport, start]
  );

  // Handle mouse up - finish drawing
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !start || !current || !viewport) {
      setIsDrawing(false);
      return;
    }

    setIsDrawing(false);

    // Calculate bounds in screen coordinates
    const minScreenX = Math.min(start.x, current.x);
    const maxScreenX = Math.max(start.x, current.x);
    const minScreenY = Math.min(start.y, current.y);
    const maxScreenY = Math.max(start.y, current.y);

    // Convert to PDF coordinates
    const topLeft = screenToPdf(minScreenX, minScreenY);
    const bottomRight = screenToPdf(maxScreenX, maxScreenY);

    // In PDF coordinates:
    // - x is left-to-right (same as screen)
    // - y is bottom-to-top (inverse of screen)
    const newX = topLeft.x;
    const newY = bottomRight.y; // Bottom of selection in screen = lower Y in PDF
    const newWidth = bottomRight.x - topLeft.x;
    const newHeight = topLeft.y - bottomRight.y; // Top of selection in screen = higher Y in PDF

    const newSelection: TableSelection = {
      x: newX,
      y: newY,
      width: Math.max(10, newWidth),
      height: Math.max(10, newHeight),
      page: currentPage,
      // Screen coordinates for rendering
      left: minScreenX,
      top: minScreenY,
      right: maxScreenX,
      bottom: maxScreenY,
    };

    console.log('[TableSelector] Selection created:', newSelection);
    setSelection(newSelection);
    onSelection(newSelection);
  }, [isDrawing, start, current, viewport, currentPage, screenToPdf, onSelection]);

  // Reset when initial selection changes
  useEffect(() => {
    if (initialSelection) {
      setSelection(initialSelection);
    }
  }, [initialSelection]);

  // Render selection rectangle
  const renderSelection = () => {
    if (!selection && !isDrawing) return null;

    let left, top, width, height;

    if (isDrawing && start && current) {
      left = Math.min(start.x, current.x);
      top = Math.min(start.y, current.y);
      width = Math.abs(current.x - start.x);
      height = Math.abs(current.y - start.y);
    } else if (selection) {
      // Use screen coordinates from selection
      left = selection.left;
      top = selection.top;
      width = selection.right - selection.left;
      height = selection.bottom - selection.top;
    } else {
      return null;
    }

    return (
      <div
        className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
        style={{
          left,
          top,
          width,
          height,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Dimension labels */}
        <div className="absolute -top-6 left-0 bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded">
          {(width / zoom).toFixed(0)}pt
        </div>
        <div className="absolute -right-12 top-0 bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded">
          {(height / zoom).toFixed(0)}pt
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDrawing) handleMouseUp();
      }}
    >
      {/* Instructions */}
      {!selection && !isDrawing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/80 text-white px-4 py-2 rounded-lg text-sm">
            Click and drag to select the product table area
          </div>
        </div>
      )}

      {/* Selection rectangle */}
      {renderSelection()}

      {/* Selection instructions */}
      {selection && !isDrawing && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs pointer-events-none">
          Table selected - Click column headers in the right panel
        </div>
      )}
    </div>
  );
}
