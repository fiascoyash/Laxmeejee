import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  User,
  FileText,
  Calendar,
  AlertTriangle,
  Save,
  ChevronRight,
} from 'lucide-react';
import {
  BillMappedProduct,
  ProductCatalogItem,
  SupplierData,
  UNIT_OPTIONS,
} from '../../types';
import { storage } from '../../utils/storage';

interface ImportConfirmationProps {
  products: BillMappedProduct[];
  catalog: ProductCatalogItem[];
  suppliers: SupplierData[];
  selectedSupplier: SupplierData | null;
  onSupplierChange: (supplier: SupplierData | null) => void;
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  onCatalogChange: (catalog: ProductCatalogItem[]) => void;
  onSuppliersChange: (suppliers: SupplierData[]) => void;
  onComplete: () => void;
  onBack: () => void;
}

export const ImportConfirmation: React.FC<ImportConfirmationProps> = ({
  products,
  catalog,
  suppliers,
  selectedSupplier,
  onSupplierChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  onCatalogChange,
  onComplete,
  onBack,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  // Calculate totals
  const summary = useMemo(() => {
    let totalQuantity = 0;
    let totalValue = 0;
    let totalGST = 0;

    products.forEach((p) => {
      if (p.decision === 'skip') return;

      totalQuantity += p.quantity;
      const amount = p.amount || p.quantity * p.purchasePrice;
      totalValue += amount;

      // Calculate GST
      const gstAmount = amount * (p.gstPercent / 100);
      totalGST += gstAmount;
    });

    return {
      totalProducts: products.filter((p) => p.decision !== 'skip').length,
      totalQuantity,
      totalValue,
      totalGST,
      grandTotal: totalValue + totalGST,
    };
  }, [products]);

  // Check for valid import
  const canImport = useMemo(() => {
    if (products.filter((p) => p.decision !== 'skip').length === 0) return false;
    if (!invoiceNumber.trim()) return false;
    if (!selectedSupplier) return false;
    return true;
  }, [products, invoiceNumber, selectedSupplier]);

  // Handle import
  const handleImport = async () => {
    if (!canImport || !selectedSupplier) return;

    setIsImporting(true);

    try {
      // Update catalog stock for matched products
      const updatedCatalog = catalog.map((item) => {
        const matchedProduct = products.find(
          (p) => p.matchedProductId === item.id && p.decision === 'match_existing'
        );
        if (matchedProduct) {
          return {
            ...item,
            stockQuantity: item.stockQuantity + matchedProduct.quantity,
            purchasePrice: matchedProduct.purchasePrice, // Update purchase price
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      // Add new products to catalog
      const newCatalogItems: ProductCatalogItem[] = products
        .filter((p) => p.decision === 'create_new' && !p.matchedProductId)
        .map((p) => ({
          id: `catalog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: p.productName,
          category: 'Imported',
          unit: (p.unit as any) || 'piece',
          purchasePrice: p.purchasePrice,
          sellingPrice: p.purchasePrice * 1.2, // Default 20% margin
          gstPercent: p.gstPercent,
          hsnSacCode: p.hsnSac || '',
          stockQuantity: p.quantity,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      // Save updated catalog
      const finalCatalog = [...updatedCatalog, ...newCatalogItems];
      onCatalogChange(finalCatalog);
      storage.saveProductCatalog(finalCatalog);

      // Save to Supabase for audit trail
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          // Create purchase import log
          await supabase.from('purchase_import_logs').insert({
            import_date: new Date().toISOString(),
            imported_by: 'user',
            file_name: 'Smart Bill Import',
            format: 'pdf',
            supplier_id: selectedSupplier.id,
            supplier_name: selectedSupplier.firmName,
            invoice_number: invoiceNumber,
            products_imported: summary.totalProducts,
            total_value: summary.grandTotal,
            status: 'success',
            errors: [],
            rows: products
              .filter((p) => p.decision !== 'skip')
              .map((p) => ({
                product_name: p.productName,
                quantity: p.quantity,
                purchase_price: p.purchasePrice,
                gst_percent: p.gstPercent,
                decision: p.decision,
              })),
          });

          // Create stock movement records
          for (const product of products.filter((p) => p.decision !== 'skip')) {
            const catalogItem = finalCatalog.find(
              (c) =>
                c.id === product.matchedProductId ||
                c.name === product.productName
            );

            if (catalogItem) {
              await supabase.from('product_stock_movements').insert({
                product_id: catalogItem.id,
                movement_type: 'purchase',
                quantity_change: product.quantity,
                balance_after: catalogItem.stockQuantity,
                reference_type: 'purchase',
                reference_id: invoiceNumber,
                notes: `Supplier: ${selectedSupplier.firmName}, Invoice: ${invoiceNumber}`,
              });
            }
          }
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue even if DB save fails
      }

      alert(`Successfully imported ${summary.totalProducts} products!`);
      onComplete();
    } catch (error) {
      console.error('Import error:', error);
      alert('Error during import. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle new supplier creation
  const handleCreateSupplier = () => {
    if (!newSupplierName.trim()) return;

    const newSupplier: SupplierData = {
      id: `supplier-${Date.now()}`,
      firmName: newSupplierName.trim(),
      openingBalance: 0,
      openingBalanceType: 'to_pay',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSuppliers = [...suppliers, newSupplier];
    onSuppliersChange(updatedSuppliers);
    storage.saveSupplier(newSupplier);
    onSupplierChange(newSupplier);
    setShowNewSupplier(false);
    setNewSupplierName('');
  };

  // Get product details for display
  const getProductDetails = (product: BillMappedProduct) => {
    if (product.decision === 'skip') {
      return { status: 'Skipped', color: 'text-slate-500' };
    }

    if (product.matchedProductId) {
      const matched = catalog.find((c) => c.id === product.matchedProductId);
      if (matched) {
        return { status: `Matched: ${matched.name}`, color: 'text-emerald-600' };
      }
    }

    if (product.decision === 'create_new') {
      return { status: 'New product', color: 'text-blue-600' };
    }

    return { status: 'Pending', color: 'text-amber-600' };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Confirm Import
          </h2>
          <p className="text-slate-600 text-sm">
            Review details and complete the import
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Invoice Details */}
        <div className="space-y-4">
          {/* Supplier Selection */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Supplier
            </h3>

            {selectedSupplier ? (
              <div className="bg-white rounded-lg border border-emerald-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">
                      {selectedSupplier.firmName}
                    </div>
                    {selectedSupplier.gstNumber && (
                      <div className="text-sm text-slate-500">
                        GSTIN: {selectedSupplier.gstNumber}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onSupplierChange(null)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedSupplier?.id || ''}
                  onChange={(e) => {
                    const supplier = suppliers.find((s) => s.id === e.target.value);
                    onSupplierChange(supplier || null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firmName}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowNewSupplier(true)}
                  className="w-full px-4 py-2 border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-emerald-400 hover:text-emerald-600 text-sm"
                >
                  + Add New Supplier
                </button>
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Invoice Details
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => onInvoiceNumberChange(e.target.value)}
                  placeholder="Enter invoice number..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => onInvoiceDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <h3 className="font-medium text-emerald-800 mb-3">Import Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-700">Products to Import:</span>
                <span className="font-medium text-emerald-800">
                  {summary.totalProducts}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Total Quantity:</span>
                <span className="font-medium text-emerald-800">
                  {summary.totalQuantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Subtotal:</span>
                <span className="font-medium text-emerald-800">
                  Rs. {summary.totalValue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-700">Total GST:</span>
                <span className="font-medium text-emerald-800">
                  Rs. {summary.totalGST.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-emerald-300 text-base">
                <span className="font-semibold text-emerald-800">Grand Total:</span>
                <span className="font-bold text-emerald-900">
                  Rs. {summary.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Product List */}
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-medium text-slate-800 mb-3">Products ({products.length})</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {products.map((product) => {
              const details = getProductDetails(product);
              return (
                <div
                  key={product.id}
                  className={`p-3 rounded-lg border ${
                    product.decision === 'skip'
                      ? 'bg-slate-100 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 text-sm">
                        {product.productName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {product.quantity} x Rs. {product.purchasePrice} = Rs.{' '}
                        {(product.amount || product.quantity * product.purchasePrice).toFixed(2)}
                      </div>
                    </div>
                    <div className={`text-xs font-medium ${details.color}`}>
                      {details.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Supplier Modal */}
      {showNewSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Add New Supplier
            </h3>
            <input
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Supplier / Firm name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNewSupplier(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSupplier}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Add Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {!canImport && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <ul className="list-disc list-inside space-y-1">
                {!selectedSupplier && <li>Select a supplier</li>}
                {!invoiceNumber.trim() && <li>Enter an invoice number</li>}
                {summary.totalProducts === 0 && <li>At least one product to import</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          This will update stock levels and create purchase records.
        </div>
        <button
          onClick={handleImport}
          disabled={!canImport || isImporting}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isImporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Importing...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Complete Import
            </>
          )}
        </button>
      </div>
    </div>
  );
};
