import { useState } from 'react';
import {
  ParseResult,
  FieldMapping,
  ImportFieldKey,
  SupplierData,
} from '../../types';
import { IMPORT_FIELD_DEFINITIONS } from '../../types';
import { ArrowRight, ArrowLeft, Save, Link2, Check, AlertTriangle, GripVertical } from 'lucide-react';

interface Props {
  parseResult: ParseResult;
  mappings: FieldMapping[];
  setMappings: (m: FieldMapping[]) => void;
  selectedSupplier: SupplierData | null;
  onSaveTemplate: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function FieldMappingStep({
  parseResult,
  mappings,
  setMappings,
  selectedSupplier,
  onSaveTemplate,
  onBack,
  onNext,
}: Props) {
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverField, setDragOverField] = useState<ImportFieldKey | null>(null);

  const mappedCount = mappings.filter((m) => m.fieldKey).length;
  const requiredFields = IMPORT_FIELD_DEFINITIONS.filter((f) => f.required);
  const mappedRequired = requiredFields.filter((f) => mappings.some((m) => m.fieldKey === f.key)).length;

  const setFieldForColumn = (column: string, fieldKey: ImportFieldKey | null) => {
    // If this field was already mapped to another column, clear that one so
    // each canonical field is mapped to at most one source column.
    setMappings(
      mappings.map((m) => {
        if (m.sourceColumn === column) return { ...m, fieldKey };
        if (m.fieldKey === fieldKey && fieldKey !== null) return { ...m, fieldKey: null };
        return m;
      })
    );
  };

  const handleDropOnField = (fieldKey: ImportFieldKey) => {
    if (!draggedColumn) return;
    setFieldForColumn(draggedColumn, fieldKey);
    setDraggedColumn(null);
    setDragOverField(null);
  };

  // Group columns: mapped columns appear under their assigned field, unmapped
  // columns appear in the "unmapped" tray for dragging onto fields.
  const unmappedColumns = mappings.filter((m) => !m.fieldKey).map((m) => m.sourceColumn);
  const fieldToColumn = new Map<ImportFieldKey, string>();
  for (const m of mappings) {
    if (m.fieldKey) fieldToColumn.set(m.fieldKey, m.sourceColumn);
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-600" />
              Map Supplier Columns to Fields
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Drag a source column onto a field, or use the dropdown. Every supplier uses different headers — that's fine.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">
              {mappedRequired}/{requiredFields.length} required
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              {mappedCount} mapped
            </span>
          </div>
        </div>
      </div>

      {/* Low-confidence warning (Step 12) */}
      {parseResult.confidence < 60 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Extraction confidence is low ({parseResult.confidence}%). Please verify the mapping carefully — inventory will not be updated until you confirm on the next steps.
          </p>
        </div>
      )}

      {/* Unmapped columns tray */}
      {unmappedColumns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Source Columns — drag onto a field below
          </p>
          <div className="flex flex-wrap gap-2">
            {unmappedColumns.map((col) => (
              <div
                key={col}
                draggable
                onDragStart={() => setDraggedColumn(col)}
                onDragEnd={() => setDraggedColumn(null)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg cursor-grab active:cursor-grabbing hover:border-emerald-400 hover:bg-emerald-50 transition-colors select-none"
              >
                <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">{col}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field mapping grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {IMPORT_FIELD_DEFINITIONS.map((field) => {
            const assignedColumn = fieldToColumn.get(field.key) || null;
            const isDragOver = dragOverField === field.key;
            return (
              <div
                key={field.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverField(field.key);
                }}
                onDragLeave={() => setDragOverField(null)}
                onDrop={() => handleDropOnField(field.key)}
                className={`rounded-lg border p-3 transition-colors ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50'
                    : assignedColumn
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{field.label}</span>
                    {field.required && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">required</span>
                    )}
                  </div>
                  {assignedColumn && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 mb-2">{field.description}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={assignedColumn || ''}
                    onChange={(e) => setFieldForColumn(e.target.value, e.target.value ? field.key : null)}
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">— not mapped —</option>
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {assignedColumn && (
                    <button
                      onClick={() => setFieldForColumn(assignedColumn, null)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Unmap"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {assignedColumn && (
                  <div className="mt-2 text-xs text-slate-500">
                    Sample:{' '}
                    <span className="font-mono text-slate-700">
                      {String(parseResult.rows[0]?.[assignedColumn] ?? '—')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save supplier template (Step 5) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="font-medium text-slate-800 flex items-center gap-2">
              <Save className="w-4 h-4 text-emerald-600" />
              Save mapping for this supplier?
            </h4>
            <p className="text-sm text-slate-500 mt-1">
              {selectedSupplier
                ? `Next time you import a bill from ${selectedSupplier.firmName}, this mapping will be applied automatically.`
                : 'Select a supplier on the upload step to enable template saving.'}
            </p>
          </div>
          <button
            onClick={onSaveTemplate}
            disabled={!selectedSupplier}
            className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Supplier Template
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          Continue to Matching
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
