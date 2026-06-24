import { Product, ProductCatalogItem } from '../types';
import { generateId, calculateProductAmount, calculateTaxSummary } from '../utils/storage';
import { Plus, Trash2, Package, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Props {
  products: Product[];
  onChange: (products: Product[]) => void;
  catalog: ProductCatalogItem[];
}

export function ProductTable({ products, onChange, catalog }: Props) {
  const [showCatalog, setShowCatalog] = useState(false);

  const addProduct = () => {
    const newProduct: Product = {
      id: generateId(),
      name: '',
      hsnCode: '',
      gstPercent: 12,
      quantity: 1,
      unitPrice: 0,
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

  const taxSummary = calculateTaxSummary(products);
  const totalTaxable = products.reduce((sum, p) => sum + calculateProductAmount(p), 0);
  const totalCgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0);
  const totalSgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0);
  const grandTotal = totalTaxable + totalCgst + totalSgst;

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
              <th className="px-3 py-3 text-left font-semibold text-gray-700 w-8">#</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 min-w-64">Product Name</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 w-24">HSN Code</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700 w-20">GST %</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700 w-24">Qty</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 w-32">Unit Price</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 w-32">Amount</th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Product/Service name"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={product.hsnCode}
                    onChange={(e) => updateProduct(product.id, 'hsnCode', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center font-mono"
                    placeholder="HSN"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={product.gstPercent}
                    onChange={(e) => updateProduct(product.id, 'gstPercent', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                  >
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="1"
                    value={product.quantity}
                    onChange={(e) => updateProduct(product.id, 'quantity', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-center"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.unitPrice}
                    onChange={(e) => updateProduct(product.id, 'unitPrice', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right"
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-800">
                  Rs. {calculateProductAmount(product).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
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
                <th className="px-3 py-2 text-left font-semibold text-gray-700">HSN Code</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Taxable Amount</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">CGST %</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">CGST Amt</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-700">SGST %</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">SGST Amt</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Amt</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(taxSummary.entries()).map(([key, data]) => {
                const hsnCode = key.split('_')[0];
                return (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono">{hsnCode}</td>
                    <td className="px-3 py-2 text-right">{data.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-center">{data.cgstRate}%</td>
                    <td className="px-3 py-2 text-right">{data.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-center">{data.sgstRate}%</td>
                    <td className="px-3 py-2 text-right">{data.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
        <div className="mt-6 flex justify-end">
          <div className="w-80 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Taxable Amount:</span>
              <span className="font-medium">Rs. {totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">CGST:</span>
              <span className="font-medium">Rs. {totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">SGST:</span>
              <span className="font-medium">Rs. {totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-gray-300 mt-2">
              <span className="text-gray-800 font-bold text-lg">Grand Total:</span>
              <span className="font-bold text-lg text-blue-600">Rs. {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
