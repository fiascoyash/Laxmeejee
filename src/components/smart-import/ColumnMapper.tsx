// ─── Column Mapper Component ───────────────────────────────────────────────────
// Allows user to click column headers within the selected table area.
// Highlights the clicked area and extracts column values for preview.

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Check, X, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { ColumnMapping, TableSelection } from './types';
import { ImportFieldKey } from '../../types';
import { getPageTextData, PdfTextItem } from './extractionEngine';

export interface ColumnMapperProps {
  zoom: number;
  viewport: { width: number; height: number } | null;
  currentPage: number;
  tableSelection: TableSelection;
  existingMappings: ColumnMapping[];
  onMappingAdd: (mapping: ColumnMapping) => void;
  onMappingRemove?: (fieldKey: ImportFieldKey) => void;
}

// Mapping steps in order
const MAPPING_STEPS: { fieldKey: ImportFieldKey; label: string; instruction: string; required: boolean }[] = [
  { fieldKey: 'productName', label: 'Product Name', instruction: 'Click the "Description of Goods" or product name column header', required: true },
  { fieldKey: 'quantity', label: 'Quantity', instruction: 'Click the Qty / Quantity column header', required: true },
  { fieldKey: 'hsnSac', label: 'HSN/SAC', instruction: 'Click the HSN/SAC column header (skip if not present)', required: false },
  { fieldKey: 'unit', label: 'Unit', instruction: 'Click the Unit column header (skip if not present)', required: false },
  { fieldKey: 'purchasePrice', label: 'Purchase Rate', instruction: 'Click the Rate / Price column header', required: true },
  { fieldKey: 'gstPercent', label: 'GST %', instruction: 'Click the GST column header (skip if not present)', required: false },
  { fieldKey: 'amount', label: 'Amount', instruction: 'Click the Amount / Total column header (skip if not present)', required: false },
];

export function ColumnMapper({
  zoom,
  viewport,
  currentPage,
  tableSelection,
  existingMappings,
  onMappingAdd,
}: ColumnMapperProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<PdfTextItem | null>(null);

  // Find current step based on existing mappings
  useEffect(() => {
    // Find first unmapped required field
    const firstUnmappedRequired = MAPPING_STEPS.findIndex(
      (step) => step.required && !existingMappings.find((m) => m.fieldKey === step.fieldKey)
    );
    if (firstUnmappedRequired >= 0) {
      setCurrentStepIdx(firstUnmappedRequired);
    } else {
      // All required mapped - go to first unmapped optional
      const firstUnmapped = MAPPING_STEPS.findIndex(
        (step) => !existingMappings.find((m) => m.fieldKey === step.fieldKey)
      );
      if (firstUnmapped >= 0) {
        setCurrentStepIdx(firstUnmapped);
      }
    }
  }, [existingMappings]);

  const currentStep = MAPPING_STEPS[currentStepIdx];
  const pageTextData = getPageTextData().find((p) => p.page === currentPage);

  // Get items within table selection
  const itemsInSelection = useMemo(() => {
    if (!pageTextData || !tableSelection) return [];
    return pageTextData.items.filter((item) => {
      const inX = item.x >= tableSelection.x && item.x <= tableSelection.x + tableSelection.width;
      const inY = item.y >= tableSelection.y && item.y <= tableSelection.y + tableSelection.height;
      return inX && inY;
    });
  }, [pageTextData, tableSelection]);

  // Handle click on overlay
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / zoom;
      const clickY = (e.clientY - rect.top) / zoom;

      // Convert to PDF Y (inverted)
      const pdfY = viewport ? viewport.height - clickY : 0;

      // Find closest text item to click position
      let bestItem: PdfTextItem | null = null;
      let bestDist = Infinity;

      for (const item of itemsInSelection) {
        const dist = Math.hypot(item.x - clickX, item.y - pdfY);
        if (dist < bestDist && dist < 30) {
          bestDist = dist;
          bestItem = item;
        }
      }

      if (bestItem) {
        // Calculate column bounds from this header
        const xStart = Math.max(tableSelection.x, bestItem.x - 5);
        const xEnd = Math.min(tableSelection.x + tableSelection.width, bestItem.x + bestItem.width + 20);

        const mapping: ColumnMapping = {
          fieldKey: currentStep.fieldKey,
          headerText: bestItem.str,
          x: bestItem.x,
          y: bestItem.y,
          width: bestItem.width,
          xStart,
          xEnd,
        };

        console.log('[ColumnMapper] Mapping added:', mapping);
        onMappingAdd(mapping);

        // Auto-advance to next step
        const nextUnmapped = MAPPING_STEPS.findIndex(
          (step, idx) => idx > currentStepIdx && !existingMappings.find((m) => m.fieldKey === step.fieldKey)
        );
        if (nextUnmapped >= 0) {
          setCurrentStepIdx(nextUnmapped);
        }
      }
    },
    [currentStep, currentStepIdx, itemsInSelection, tableSelection, viewport, zoom, onMappingAdd, existingMappings]
  );

  // Handle hover
  const handleOverlayMove = useCallback(
    (e: React.MouseEvent) => {
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      const hoverX = (e.clientX - rect.left) / zoom;
      const hoverY = (e.clientY - rect.top) / zoom;
      const pdfY = viewport ? viewport.height - hoverY : 0;

      let bestItem: PdfTextItem | null = null;
      let bestDist = Infinity;

      for (const item of itemsInSelection) {
        const dist = Math.hypot(item.x - hoverX, item.y - pdfY);
        if (dist < bestDist && dist < 30) {
          bestDist = dist;
          bestItem = item;
        }
      }

      setHoveredItem(bestItem);
    },
    [itemsInSelection, viewport, zoom]
  );

  // Convert PDF coords to screen coords for rendering
  const pdfToScreen = useCallback(
    (item: PdfTextItem): { left: number; top: number; width: number; height: number } => {
      if (!viewport) return { left: 0, top: 0, width: 0, height: 0 };
      return {
        left: item.x * zoom,
        top: (viewport.height - item.y - item.height) * zoom,
        width: item.width * zoom,
        height: item.height * zoom,
      };
    },
    [viewport, zoom]
  );

  return (
    <div className="absolute inset-0 pointer-events-auto">
      {/* Click overlay */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onClick={handleOverlayClick}
        onMouseMove={handleOverlayMove}
        onMouseLeave={() => setHoveredItem(null)}
      />

      {/* Hovered item highlight */}
      {hoveredItem && (
        <div
          className="absolute border-2 border-emerald-400 bg-emerald-400/20 rounded-sm pointer-events-none"
          style={pdfToScreen(hoveredItem)}
        />
      )}

      {/* Mapped column highlights */}
      {existingMappings.map((mapping) => {
        const step = MAPPING_STEPS.find((s) => s.fieldKey === mapping.fieldKey);
        if (!step || mapping.x === 0) return null;

        const screenPos = pdfToScreen({
          x: mapping.x,
          y: mapping.y,
          width: mapping.width,
          height: 12,
          page: currentPage,
          str: mapping.headerText,
        });

        return (
          <div
            key={mapping.fieldKey}
            className="absolute border-2 border-emerald-500 bg-emerald-500/10 rounded-sm pointer-events-none"
            style={{
              left: mapping.xStart * zoom,
              top: screenPos.top,
              width: (mapping.xEnd - mapping.xStart) * zoom,
              height: Math.max(10, (viewport ? viewport.height : 0) - mapping.y) * zoom,
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-semibold px-1 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap">
              {step.label}
            </span>
          </div>
        );
      })}

      {/* Current step instruction overlay */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 pointer-events-none">
        <MousePointerClick className="w-4 h-4" />
        <span>
          Click the <strong>{currentStep.label}</strong> column header
        </span>
      </div>
    </div>
  );
}

// ─── Column Mapping Sidebar ────────────────────────────────────────────────────

export interface ColumnMappingSidebarProps {
  existingMappings: ColumnMapping[];
  onMappingRemove: (fieldKey: ImportFieldKey) => void;
  onComplete: () => void;
  onBack: () => void;
}

export function ColumnMappingSidebar({
  existingMappings,
  onMappingRemove,
  onComplete,
  onBack,
}: ColumnMappingSidebarProps) {
  const requiredFields = MAPPING_STEPS.filter((s) => s.required);
  const mappedRequired = requiredFields.filter((s) =>
    existingMappings.find((m) => m.fieldKey === s.fieldKey)
  ).length;
  const allRequiredMapped = mappedRequired === requiredFields.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h3 className="font-semibold text-slate-800">Map Columns</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Click each column header in the PDF to identify it.
        </p>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {MAPPING_STEPS.map((step) => {
          const mapping = existingMappings.find((m) => m.fieldKey === step.fieldKey);
          const isDone = !!mapping;

          return (
            <div
              key={step.fieldKey}
              className={`rounded-lg border p-3 transition-colors ${
                isDone
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                  )}
                  <span className={`text-sm font-medium ${isDone ? 'text-slate-800' : 'text-slate-500'}`}>
                    {step.label}
                  </span>
                  {step.required && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                      required
                    </span>
                  )}
                </div>
                {mapping && (
                  <button
                    onClick={() => onMappingRemove(step.fieldKey)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Clear this column"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {mapping ? (
                <p className="text-xs text-slate-500">
                  Header: <span className="font-mono text-slate-700">{mapping.headerText}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400">{step.instruction}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {mappedRequired}/{requiredFields.length} required columns
          </span>
          {allRequiredMapped && (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Ready to extract
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={onComplete}
            disabled={!allRequiredMapped}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Extract Products
          </button>
        </div>
      </div>
    </div>
  );
}
