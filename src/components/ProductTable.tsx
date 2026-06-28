import { Product, ProductCatalogItem, TableColumn, GstMode, TemplateField, TemplateSettings, DEFAULT_TEMPLATE_SETTINGS } from '../types';
import { generateId, calculateProductAmount, calculateTaxSummary, getDefaultProductColumns, calculateRoundOff, calculateGrandTotalAmount, roundTo2 } from '../utils/storage';
import { Plus, Trash2, Package, ChevronDown, Settings2 } from 'lucide-react';
import { useState, useMemo } from 'react';

interface Props {
  products: Product[];
  onChange: (products: Product[]) => void;
  catalog: ProductCatalogItem[];
  columns?: TableColumn[];
  onColumnsChange?: (columns: TableColumn[]) => void;
  gstMode?: GstMode;
  onGstModeChange?: (mode: GstMode) => void;
  // Custom fields from template schema
  customFields?: TemplateField[];
  // Template settings - controls which columns are visible
  templateSettings?: TemplateSettings;
}

export function ProductTable({ products, onChange, catalog, columns, onColumnsChange, gstMode = 'inclusive', onGstModeChange, customFields = [], templateSettings }: Props) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const settings = templateSettings || DEFAULT_TEMPLATE_SETTINGS;

  // Merge columns with template settings visibility
  const activeColumns = useMemo(() => {
    const baseColumns = columns && columns.length > 0 ? columns : getDefaultProductColumns();

    // Update visibility based on template settings
    return baseColumns.map(col => {
      // Map template settings to column keys
      const settingMap: Record<string, boolean> = {
        description: settings.showDescription,
        quantity: settings.showQuantity,
        unit: settings.showUnit,
        discount: settings.showDiscount,
        tax: settings.showTax,
        batchNumber: settings.showBatchNumber,
        expiryDate: settings.showExpiryDate,
      };

      if (col.key in settingMap && settingMap[col.key] !== undefined) {
        return { ...col, visible: settingMap[col.key] };
      }
      return col;
    });
  }, [columns, settings]);

  const visibleColumns = activeColumns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  const toggleColumn = (colId: string) => {
    if (!onColumnsChange) return;
    onColumnsChange(activeColumns.map(c => c.id === colId ? { ...c, visible: !c.visible } : c));
  };

  const addProduct = () => {
    const newProduct: Product = {
      id: generateId(),
      name: '',
      hsnCode: '',
      gstPercent: 18,
      quantity: 1,
      unitPrice: 0,
      batchNumber: '',
      expiryDate: '',
      discount: 0,
      customFields: {},
    };
    onChange([...products, newProduct]);
  };

  const addFromCatalog = (catalogItem: ProductCatalogItem) => {
    const newProduct: Product = {
      id: generateId(),
      name: catalogItem.name,
      hsnCode: catalogItem.hsnCode,
      gstPercent: catalogItem.gstPercent,
      quantity: 1,
      unitPrice: catalogItem.defaultPrice,
      batchNumber: '',
      expiryDate: '',
      discount: 0,
      customFields: {},
    };
    onChange([...products, newProduct]);
    setShowCatalog(false);
  };

  const removeProduct = (id: string) => {
    onChange(products.filter(p => p.id !== id));
  };

  const updateProduct = (id: string, field: keyof Product, value: string | number) => {
    onChange(products.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const updateCustomField = (productId: string, fieldKey: string, value: string | number | boolean) => {
    onChange(products.map(p =>
      p.id === productId
        ? { ...p, customFields: { ...p.customFields, [fieldKey]: value } }
        : p
    ));
  };

  const isColumnVisible = (key: string) => visibleColumns.some(c => c.key === key);

  const taxSummary = calculateTaxSummary(products, gstMode);
  const grandTotalAmount = calculateGrandTotalAmount(products, gstMode);
  const totalTaxable = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
  const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
  const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

  const renderCell = (product: Product, colKey: string) => {
    switch (colKey) {
      case 'sno': return null;
      case 'name':
        return (
          <input
            type="text"
            value={product.name}
            onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Product/Service name"
          />
        );
      case 'hsnCode':
      case 'sacCode':
        return (
          <input
            type="text"
            value={product.hsnCode}
            onChange={(e) => updateProduct(product.id, 'hsnCode', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
            placeholder={colKey === 'sacCode' ? 'SAC' : 'HSN'}
          />
        );
      case 'gstPercent':
        return (
          <select
            value={product.gstPercent}
            onChange={(e) => updateProduct(product.id, 'gstPercent', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
          >
            <option value={0}>0%</option>
            <option value={5}>5%</option>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
        );
      case 'quantity':
        return (
          <input
            type="number"
            min="1"
            value={product.quantity}
            onChange={(e) => updateProduct(product.id, 'quantity', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
          />
        );
      case 'unitPrice':
        return (
          <input
            type="number"
            min="0"
            step="0.01"
            value={product.unitPrice}
            onChange={(e) => updateProduct(product.id, 'unitPrice', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right"
          />
        );
      case 'amount':
        return (
          <span className="text-right font-medium text-gray-800 block">
            Rs. {calculateProductAmount(product).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      case 'batchNumber':
        return (
          <input
            type="text"
            value={product.batchNumber || ''}
            onChange={(e) => updateProduct(product.id, 'batchNumber', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
            placeholder="Batch#"
          />
        );
      case 'expiryDate':
        return (
          <input
            type="month"
            value={product.expiryDate || ''}
            onChange={(e) => updateProduct(product.id, 'expiryDate', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
            placeholder="MM/YYYY"
          />
        );
      case 'discount':
        return (
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={product.discount || 0}
            onChange={(e) => updateProduct(product.id, 'discount', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
          />
        );
      case 'mrp':
        return (
          <input
            type="number"
            min="0"
            step="0.01"
            value={product.mrp || 0}
            onChange={(e) => updateProduct(product.id, 'mrp', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right"
          />
        );
      case 'partNumber':
        return (
          <input
            type="text"
            value={product.partNumber || ''}
            onChange={(e) => updateProduct(product.id, 'partNumber', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
            placeholder="Part#"
          />
        );
      case 'vehicleModel':
        return (
          <input
            type="text"
            value={product.vehicleModel || ''}
            onChange={(e) => updateProduct(product.id, 'vehicleModel', e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Vehicle"
          />
        );
      case 'warrantyMonths':
        return (
          <input
            type="number"
            min="0"
            value={product.warrantyMonths || 0}
            onChange={(e) => updateProduct(product.id, 'warrantyMonths', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
          />
        );
      case 'wattage':
        return (
          <input
            type="number"
            min="0"
            value={product.wattage || 0}
            onChange={(e) => updateProduct(product.id, 'wattage', Number(e.target.value))}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
            placeholder="W"
          />
        );
      default:
        // Handle custom fields from template schema
        const customField = customFields.find(f => f.key === colKey);
        if (customField) {
          const value = product.customFields?.[colKey] ?? customField.defaultValue ?? '';
          if (customField.type === 'number') {
            return (
              <input
                type="number"
                value={value as number}
                onChange={(e) => updateCustomField(product.id, colKey, Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder={customField.placeholder}
              />
            );
          }
          if (customField.type === 'date') {
            return (
              <input
                type="month"
                value={value as string}
                onChange={(e) => updateCustomField(product.id, colKey, e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            );
          }
          if (customField.type === 'select' && customField.options) {
            return (
              <select
                value={value as string}
                onChange={(e) => updateCustomField(product.id, colKey, e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {customField.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            );
          }
          // Default: text input
          return (
            <input
              type="text"
              value={value as string}
              onChange={(e) => updateCustomField(product.id, colKey, e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder={customField.placeholder}
            />
          );
        }
        return null;
    }
  };

  const getCellClass = (colKey: string) => {
    if (colKey === 'name') return 'px-3 py-2 min-w-64';
    if (colKey === 'sno') return 'px-3 py-2 text-gray-500 w-8';
    if (colKey === 'amount') return 'px-3 py-2 text-right font-medium text-gray-800';
    if (colKey === 'quantity' || colKey === 'gstPercent') return 'px-3 py-2 text-center';
    return 'px-3 py-2';
  };

  const getHeaderClass = (colKey: string) => {
    if (colKey === 'name') return 'px-3 py-3 text-left font-semibold text-gray-700 min-w-64';
    if (colKey === 'sno') return 'px-3 py-3 text-left font-semibold text-gray-700 w-8';
    if (colKey === 'amount') return 'px-3 py-3 text-right font-semibold text-gray-700 w-32';
    if (colKey === 'quantity' || colKey === 'gstPercent') return 'px-3 py-3 text-center font-semibold text-gray-700 w-24';
    if (colKey === 'hsnCode') return 'px-3 py-3 text-left font-semibold text-gray-700 w-24';
    if (colKey === 'unitPrice') return 'px-3 py-3 text-right font-semibold text-gray-700 w-32';
    return 'px-3 py-3 text-left font-semibold text-gray-700';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Products / Services
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
              title="Toggle column visibility"
            >
              <Settings2 className="w-4 h-4" />
              Columns
              <ChevronDown className="w-4 h-4" />
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">Toggle Columns</div>
                {activeColumns.filter(c => c.key !== 'sno' && c.key !== 'amount').map(col => (
                  <label key={col.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded px-1">
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded"
                    />
                    <span className="text-gray-700">{col.label}</span>
                  </label>
                ))}
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                  # and Amount columns are always visible.
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Package className="w-4 h-4" />
              From Catalog
              <ChevronDown className="w-4 h-4" />
            </button>
            {showCatalog && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                {catalog.length === 0 ? (
                  <div className="p-4 text-gray-500 text-center text-sm">No products in catalog</div>
                ) : (
                  catalog.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addFromCatalog(item)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-xs text-gray-500">HSN: {item.hsnCode} | GST: {item.gstPercent}%</div>
                      </div>
                      <div className="text-blue-600 font-medium">Rs. {item.defaultPrice.toLocaleString()}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={addProduct}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              {visibleColumns.map(col => (
                <th key={col.id} className={getHeaderClass(col.key)}>{col.label}</th>
              ))}
              <th className="px-3 py-3 text-center font-semibold text-gray-700 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                {visibleColumns.map(col => (
                  <td key={col.id} className={getCellClass(col.key)}>
                    {col.key === 'sno' ? index + 1 : renderCell(product, col.key)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-3 py-8 text-center text-gray-500">
                  No products added. Click "Add Row" or "From Catalog" to add products.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tax Summary Table */}
      {products.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Tax Summary (HSN-wise)</h4>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                {isColumnVisible('hsnCode') && (
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">HSN Code</th>
                )}
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Taxable Amount</th>
                {isColumnVisible('gstPercent') && (
                  <>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700">CGST %</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">CGST Amt</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700">SGST %</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">SGST Amt</th>
                  </>
                )}
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Amt</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(taxSummary.entries()).map(([key, data]) => {
                const hsnCode = key.split('_')[0];
                return (
                  <tr key={key} className="border-b border-gray-100">
                    {isColumnVisible('hsnCode') && (
                      <td className="px-3 py-2 font-mono">{hsnCode}</td>
                    )}
                    <td className="px-3 py-2 text-right">{data.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    {isColumnVisible('gstPercent') && (
                      <>
                        <td className="px-3 py-2 text-center">{data.cgstRate}%</td>
                        <td className="px-3 py-2 text-right">{data.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-center">{data.sgstRate}%</td>
                        <td className="px-3 py-2 text-right">{data.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-medium">
                      {(data.taxableAmount + data.cgstAmount + data.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      {products.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
          {/* GST Mode Toggle */}
          {onGstModeChange && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">GST Mode</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gstMode"
                    checked={gstMode === 'inclusive'}
                    onChange={() => onGstModeChange('inclusive')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Inclusive GST (price includes GST)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gstMode"
                    checked={gstMode === 'exclusive'}
                    onChange={() => onGstModeChange('exclusive')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Exclusive GST (add GST on top)</span>
                </label>
              </div>
            </div>
          )}
          <div className="w-80 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Taxable Amount:</span>
              <span className="font-medium">Rs. {totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {isColumnVisible('gstPercent') && (
              <>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">CGST:</span>
                  <span className="font-medium">Rs. {totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">SGST:</span>
                  <span className="font-medium">Rs. {totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Round Off:</span>
              <span className="font-medium">Rs. {roundOff >= 0 ? roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '(' + Math.abs(roundOff).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + ')'}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-gray-300 mt-2">
              <span className="text-gray-800 font-bold text-lg">Grand Total:</span>
              <span className="font-bold text-lg text-blue-600">Rs. {roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
