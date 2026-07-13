import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Save, Upload, AlertCircle, Check } from 'lucide-react';
import { ProductCatalogItem, UnitType, UNIT_OPTIONS, IndustryType, INDUSTRY_OPTIONS } from '../types';
import { generateId, generateSku, getDefaultUnit } from '../utils/storage';

interface BulkImportRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: UnitType;
  purchasePrice: number;
  sellingPrice: number;
  gstPercent: number;
  hsnSacCode: string;
  supplier: string;
  minStockAlert: number;
  isValid: boolean;
  errors: Record<string, string>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (products: ProductCatalogItem[]) => void;
  existingCatalog: ProductCatalogItem[];
  suppliers: string[];
  categories: string[];
  businessType?: string;
}

const createEmptyRow = (id: string, previousRow?: BulkImportRow): BulkImportRow => ({
  id,
  name: '',
  category: previousRow?.category || '',
  quantity: 0,
  unit: previousRow?.unit || 'piece',
  purchasePrice: 0,
  sellingPrice: 0,
  gstPercent: previousRow?.gstPercent || 18,
  hsnSacCode: '',
  supplier: previousRow?.supplier || '',
  minStockAlert: 0,
  isValid: false,
  errors: {},
});

const INITIAL_ROWS = 10;

export function BulkImportModal({ isOpen, onClose, onSave, existingCatalog, suppliers: propSuppliers, categories: propCategories, businessType }: Props) {
  const [rows, setRows] = useState<BulkImportRow[]>(() => {
    const initialRows: BulkImportRow[] = [];
    for (let i = 0; i < INITIAL_ROWS; i++) {
      initialRows.push(createEmptyRow(generateId()));
    }
    return initialRows;
  });
  const [pasteHint, setPasteHint] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const lastFocusedCell = useRef<{ row: number; col: string } | null>(null);

  // Get unique suppliers from existing catalog
  const suppliers = propSuppliers.length > 0
    ? propSuppliers
    : Array.from(new Set(existingCatalog.map(p => p.brand).filter(Boolean)));

  // Get unique categories from existing catalog
  const categories = propCategories.length > 0
    ? propCategories
    : Array.from(new Set(existingCatalog.map(p => p.category).filter(Boolean)));

  // Reset rows when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialRows: BulkImportRow[] = [];
      for (let i = 0; i < INITIAL_ROWS; i++) {
        initialRows.push(createEmptyRow(generateId()));
      }
      setRows(initialRows);
    }
  }, [isOpen]);

  // Validate a single row
  const validateRow = useCallback((row: BulkImportRow): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (!row.name.trim()) {
      errors.name = 'Required';
    }
    if (!row.category.trim()) {
      errors.category = 'Required';
    }
    if (!row.hsnSacCode.trim()) {
      errors.hsnSacCode = 'Required';
    }
    if (row.sellingPrice <= 0) {
      errors.sellingPrice = 'Must be > 0';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, []);

  // Update a single cell
  const updateCell = (rowId: string, field: keyof BulkImportRow, value: string | number) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      const rowIndex = newRows.findIndex(r => r.id === rowId);
      if (rowIndex === -1) return prevRows;

      const updatedRow = { ...newRows[rowIndex], [field]: value };
      const previousRow = rowIndex > 0 ? newRows[rowIndex - 1] : undefined;

      // Auto-fill from previous row for category and unit if empty
      if (field === 'category' && !value && previousRow?.category) {
        updatedRow.category = previousRow.category;
      }
      if (field === 'unit' && !value && previousRow?.unit) {
        updatedRow.unit = previousRow.unit;
      }

      const validation = validateRow(updatedRow);
      updatedRow.isValid = validation.isValid;
      updatedRow.errors = validation.errors;

      newRows[rowIndex] = updatedRow;
      return newRows;
    });
  };

  // Add new row
  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    const newRow = createEmptyRow(generateId(), lastRow);
    setRows([...rows, newRow]);
  };

  // Remove row
  const removeRow = (rowId: string) => {
    if (rows.length <= 1) return;
    setRows(rows.filter(r => r.id !== rowId));
  };

  // Handle paste from Excel
  const handlePaste = (e: React.ClipboardEvent, rowId: string, field: string) => {
    e.preventDefault();

    const clipboardData = e.clipboardData.getData('text');
    const lines = clipboardData.split('\n').filter(line => line.trim());

    if (lines.length <= 1) {
      // Single value, just paste normally
      const value = clipboardData.trim();
      updateCell(rowId, field as keyof BulkImportRow, value);
      return;
    }

    // Multi-line paste (from Excel - tab separated)
    const rowIndex = rows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;

    const newRows = [...rows];

    lines.forEach((line, lineIndex) => {
      const targetRowIndex = rowIndex + lineIndex;

      // Add new rows if needed
      while (newRows.length <= targetRowIndex) {
        const lastRow = newRows[newRows.length - 1];
        newRows.push(createEmptyRow(generateId(), lastRow));
      }

      const cells = line.split('\t').map(cell => cell.trim());
      const targetRow = newRows[targetRowIndex];

      // Map cells to fields (Excel column order)
      const fieldOrder: (keyof BulkImportRow)[] = [
        'name', 'category', 'quantity', 'unit', 'purchasePrice',
        'sellingPrice', 'gstPercent', 'hsnSacCode', 'supplier', 'minStockAlert'
      ];

      cells.forEach((cellValue, cellIndex) => {
        if (cellIndex < fieldOrder.length) {
          const fieldName = fieldOrder[cellIndex];
          if (fieldName === 'quantity' || fieldName === 'purchasePrice' ||
              fieldName === 'sellingPrice' || fieldName === 'gstPercent' ||
              fieldName === 'minStockAlert') {
            (targetRow as any)[fieldName] = parseFloat(cellValue) || 0;
          } else {
            (targetRow as any)[fieldName] = cellValue;
          }
        }
      });

      const validation = validateRow(targetRow);
      targetRow.isValid = validation.isValid;
      targetRow.errors = validation.errors;
    });

    setRows(newRows);
  };

  // Check for duplicate products
  const checkForDuplicate = (name: string): ProductCatalogItem | undefined => {
    const normalizedName = name.toLowerCase().trim();
    return existingCatalog.find(p => p.name.toLowerCase().trim() === normalizedName);
  };

  // Save all valid rows
  const handleSave = () => {
    const validRows = rows.filter(r => r.isValid && r.name.trim());

    if (validRows.length === 0) {
      alert('Please add at least one valid product with name, category, HSN/SAC, and selling price.');
      return;
    }

    const newProducts: ProductCatalogItem[] = [];
    const duplicates: string[] = [];

    validRows.forEach(row => {
      const duplicate = checkForDuplicate(row.name);
      if (duplicate) {
        duplicates.push(row.name);
      } else {
        const now = new Date().toISOString();
        const product: ProductCatalogItem = {
          id: generateId(),
          name: row.name.trim(),
          sku: generateSku(row.name),
          category: row.category.trim(),
          unit: row.unit,
          purchasePrice: row.purchasePrice,
          sellingPrice: row.sellingPrice,
          gstPercent: row.gstPercent,
          hsnSacCode: row.hsnSacCode.trim(),
          stockQuantity: row.quantity,
          minStockAlert: row.minStockAlert,
          brand: row.supplier.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };
        newProducts.push(product);
      }
    });

    if (duplicates.length > 0) {
      const proceed = confirm(
        `${duplicates.length} product(s) already exist:\n${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}\n\nThese will be skipped. Continue with ${newProducts.length} new products?`
      );
      if (!proceed) return;
    }

    if (newProducts.length > 0) {
      onSave([...existingCatalog, ...newProducts]);
      onClose();
    } else if (duplicates.length > 0) {
      alert('All products already exist. No new products were added.');
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, field: string) => {
    const rowIndex = rows.findIndex(r => r.id === rowId);
    const fields = ['name', 'category', 'quantity', 'unit', 'purchasePrice', 'sellingPrice', 'gstPercent', 'hsnSacCode', 'supplier', 'minStockAlert'];
    const fieldIndex = fields.indexOf(field);

    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      // Move to next field or next row
      if (fieldIndex < fields.length - 1) {
        // Move to next field
        const nextField = fields[fieldIndex + 1];
        const input = tableRef.current?.querySelector(`[data-row="${rowIndex}"][data-field="${nextField}"]`) as HTMLInputElement;
        input?.focus();
      } else if (rowIndex < rows.length - 1) {
        // Move to first field of next row
        const nextRowId = rows[rowIndex + 1].id;
        const input = tableRef.current?.querySelector(`[data-row="${rowIndex + 1}"][data-field="name"]`) as HTMLInputElement;
        input?.focus();
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      // Move to previous field or previous row
      if (fieldIndex > 0) {
        const prevField = fields[fieldIndex - 1];
        const input = tableRef.current?.querySelector(`[data-row="${rowIndex}"][data-field="${prevField}"]`) as HTMLInputElement;
        input?.focus();
      } else if (rowIndex > 0) {
        const prevRowId = rows[rowIndex - 1].id;
        const input = tableRef.current?.querySelector(`[data-row="${rowIndex - 1}"][data-field="minStockAlert"]`) as HTMLInputElement;
        input?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        const input = tableRef.current?.querySelector(`[data-row="${rowIndex + 1}"][data-field="${field}"]`) as HTMLInputElement;
        input?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) {
        const input = tableRef.current?.querySelector(`[data-row="${rowIndex - 1}"][data-field="${field}"]`) as HTMLInputElement;
        input?.focus();
      }
    }
  };

  if (!isOpen) return null;

  const validRowCount = rows.filter(r => r.isValid).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Bulk Import Products</h3>
            <p className="text-sm text-slate-500 mt-1">
              Paste from Excel (Ctrl+V) or enter manually. {validRowCount} valid row(s) ready.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paste hint banner */}
        {pasteHint && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
            <Upload className="w-4 h-4" />
            <span>Click any cell and press <kbd className="px-1.5 py-0.5 bg-blue-200 rounded text-xs font-mono">Ctrl+V</kbd> to paste from Excel</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table ref={tableRef} className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-10">#</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b min-w-[180px]">Product Name *</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b min-w-[120px]">Category *</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-20">Qty</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-24">Unit</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-24">Purchase Price</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-24">Selling Price *</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-20">GST %</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b min-w-[100px]">HSN/SAC *</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b min-w-[100px]">Supplier</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 border-b w-20">Stock Alert</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-b w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className={`border-b hover:bg-slate-50 ${row.isValid ? 'bg-green-50/30' : ''}`}>
                  <td className="px-2 py-1 text-slate-500 text-center">
                    {rowIndex + 1}
                    {row.isValid && <Check className="w-3 h-3 text-green-600 inline ml-1" />}
                  </td>

                  {/* Product Name */}
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateCell(row.id, 'name', e.target.value)}
                      onPaste={(e) => handlePaste(e, row.id, 'name')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'name')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="name"
                      className={`w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${
                        row.errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      }`}
                      placeholder="Product name"
                    />
                  </td>

                  {/* Category */}
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => updateCell(row.id, 'category', e.target.value)}
                      onPaste={(e) => handlePaste(e, row.id, 'category')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'category')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="category"
                      list="bulk-category-list"
                      className={`w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${
                        row.errors.category ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      }`}
                      placeholder="Category"
                    />
                  </td>

                  {/* Quantity */}
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      value={row.quantity || ''}
                      onChange={(e) => updateCell(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                      onPaste={(e) => handlePaste(e, row.id, 'quantity')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'quantity')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="quantity"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-2 py-1">
                    <select
                      value={row.unit}
                      onChange={(e) => updateCell(row.id, 'unit', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'unit')}
                      data-row={rowIndex}
                      data-field="unit"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      {UNIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Purchase Price */}
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.purchasePrice || ''}
                      onChange={(e) => updateCell(row.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                      onPaste={(e) => handlePaste(e, row.id, 'purchasePrice')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'purchasePrice')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="purchasePrice"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-right"
                    />
                  </td>

                  {/* Selling Price */}
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.sellingPrice || ''}
                      onChange={(e) => updateCell(row.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                      onPaste={(e) => handlePaste(e, row.id, 'sellingPrice')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'sellingPrice')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="sellingPrice"
                      className={`w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-right ${
                        row.errors.sellingPrice ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      }`}
                    />
                  </td>

                  {/* GST % */}
                  <td className="px-2 py-1">
                    <select
                      value={row.gstPercent}
                      onChange={(e) => updateCell(row.id, 'gstPercent', parseInt(e.target.value))}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'gstPercent')}
                      data-row={rowIndex}
                      data-field="gstPercent"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                      <option value={40}>40%</option>
                    </select>
                  </td>

                  {/* HSN/SAC */}
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.hsnSacCode}
                      onChange={(e) => updateCell(row.id, 'hsnSacCode', e.target.value)}
                      onPaste={(e) => handlePaste(e, row.id, 'hsnSacCode')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'hsnSacCode')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="hsnSacCode"
                      className={`w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-center ${
                        row.errors.hsnSacCode ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      }`}
                      placeholder="HSN"
                    />
                  </td>

                  {/* Supplier */}
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.supplier}
                      onChange={(e) => updateCell(row.id, 'supplier', e.target.value)}
                      onPaste={(e) => handlePaste(e, row.id, 'supplier')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'supplier')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="supplier"
                      list="bulk-supplier-list"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Supplier"
                    />
                  </td>

                  {/* Stock Alert */}
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      value={row.minStockAlert || ''}
                      onChange={(e) => updateCell(row.id, 'minStockAlert', parseFloat(e.target.value) || 0)}
                      onPaste={(e) => handlePaste(e, row.id, 'minStockAlert')}
                      onKeyDown={(e) => handleKeyDown(e, row.id, 'minStockAlert')}
                      onFocus={() => setPasteHint(true)}
                      onBlur={() => setPasteHint(false)}
                      data-row={rowIndex}
                      data-field="minStockAlert"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
                    />
                  </td>

                  {/* Delete button */}
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove row"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Datalists for autocomplete */}
          <datalist id="bulk-category-list">
            {categories.map(cat => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          <datalist id="bulk-supplier-list">
            {suppliers.map(sup => (
              <option key={sup} value={sup} />
            ))}
          </datalist>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-slate-50 shrink-0">
          <button
            onClick={addRow}
            className="px-3 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Import {validRowCount} Product{validRowCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
