import { useState, useEffect } from 'react';
import { X, Package, TrendingUp, DollarSign, Calendar, Truck, ArrowUp, ArrowDown, Edit, Plus } from 'lucide-react';
import { ProductCatalogItem, ProductPurchase, ProductStockMovement, ProductLedgerSummary, SupplierData } from '../types';
import { createClient } from '@supabase/supabase-js';
import { AddExistingStockModal } from './AddExistingStockModal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductCatalogItem;
  suppliers: SupplierData[];
  onUpdateProduct: (product: ProductCatalogItem) => void;
}

export function ProductLedgerModal({ isOpen, onClose, product, suppliers, onUpdateProduct }: Props) {
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [movements, setMovements] = useState<ProductStockMovement[]>([]);
  const [summary, setSummary] = useState<ProductLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddStock, setShowAddStock] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'purchases' | 'movements'>('summary');

  useEffect(() => {
    if (isOpen && product.id && supabase) {
      fetchHistory();
    }
  }, [isOpen, product.id]);

  const fetchHistory = async () => {
    if (!supabase) {
      // Fallback to mock data if no Supabase
      calculateSummaryFromLocalStorage();
      return;
    }

    setLoading(true);
    try {
      // Fetch purchases
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('product_purchases')
        .select('*')
        .eq('product_id', product.id)
        .order('purchase_date', { ascending: false });

      if (!purchaseError && purchaseData) {
        setPurchases(purchaseData.map(p => ({
          id: p.id,
          productId: p.product_id,
          supplierName: p.supplier_name,
          quantity: p.quantity,
          purchasePrice: parseFloat(p.purchase_price),
          totalValue: parseFloat(p.total_value),
          purchaseDate: p.purchase_date,
          notes: p.notes,
          createdAt: p.created_at,
        })));
      }

      // Fetch stock movements
      const { data: movementData, error: movementError } = await supabase
        .from('product_stock_movements')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });

      if (!movementError && movementData) {
        setMovements(movementData.map(m => ({
          id: m.id,
          productId: m.product_id,
          movementType: m.movement_type,
          quantityChange: m.quantity_change,
          balanceAfter: m.balance_after,
          referenceType: m.reference_type,
          referenceId: m.reference_id,
          notes: m.notes,
          createdAt: m.created_at,
        })));
      }

      // Calculate summary
      calculateSummary(purchaseData || [], product);
    } catch (err) {
      console.error('Error fetching history:', err);
      calculateSummaryFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (purchaseData: any[], currentProduct: ProductCatalogItem) => {
    const totalPurchaseValue = purchaseData.reduce((sum: number, p: any) => sum + parseFloat(p.total_value || 0), 0);
    const totalQuantity = purchaseData.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
    const avgPurchasePrice = totalQuantity > 0 ? totalPurchaseValue / totalQuantity : currentProduct.purchasePrice;

    // Find primary supplier (most frequent)
    const supplierCounts: Record<string, number> = {};
    purchaseData.forEach((p: any) => {
      if (p.supplier_name) {
        supplierCounts[p.supplier_name] = (supplierCounts[p.supplier_name] || 0) + 1;
      }
    });
    const primarySupplier = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || currentProduct.brand;

    // Find last purchase date
    const lastPurchaseDate = purchaseData.length > 0
      ? purchaseData[0].purchase_date
      : undefined;

    setSummary({
      currentStock: currentProduct.stockQuantity,
      averagePurchasePrice: avgPurchasePrice,
      sellingPrice: currentProduct.sellingPrice,
      totalStockValue: currentProduct.purchasePrice * currentProduct.stockQuantity,
      lastPurchaseDate,
      primarySupplier,
    });
  };

  const calculateSummaryFromLocalStorage = () => {
    // Use only current product data if no history exists
    setPurchases([]);
    setMovements([]);
    setSummary({
      currentStock: product.stockQuantity,
      averagePurchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      totalStockValue: product.purchasePrice * product.stockQuantity,
      lastPurchaseDate: undefined,
      primarySupplier: product.brand,
    });
  };

  const handleAddStock = async (updatedProduct: ProductCatalogItem) => {
    onUpdateProduct(updatedProduct);
    setShowAddStock(false);

    // Refresh history after adding stock
    if (supabase) {
      await fetchHistory();
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number) => {
    return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'Purchase';
      case 'sale': return 'Sale';
      case 'adjustment': return 'Adjustment';
      case 'return': return 'Return';
      default: return type;
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'text-green-600 bg-green-50';
      case 'sale': return 'text-red-600 bg-red-50';
      case 'adjustment': return 'text-blue-600 bg-blue-50';
      case 'return': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{product.name}</h3>
            <p className="text-sm text-slate-500">
              {product.category} {product.sku && `| SKU: ${product.sku}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddStock(true)}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Stock
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {[
            { id: 'summary', label: 'Summary' },
            { id: 'purchases', label: 'Purchase History' },
            { id: 'movements', label: 'Stock Movements' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : (
            <>
              {/* Summary Tab */}
              {activeTab === 'summary' && summary && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Current Stock */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <Package className="w-4 h-4" />
                        <span className="text-sm">Current Stock</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">
                        {summary.currentStock}
                        <span className="text-base font-normal text-slate-500 ml-1">{product.unit}</span>
                      </div>
                    </div>

                    {/* Average Purchase Price */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">Avg. Purchase Price</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">
                        {formatCurrency(summary.averagePurchasePrice)}
                      </div>
                    </div>

                    {/* Selling Price */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Selling Price</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">
                        {formatCurrency(summary.sellingPrice)}
                      </div>
                    </div>

                    {/* Total Stock Value */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Total Stock Value</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(summary.totalStockValue)}
                      </div>
                    </div>

                    {/* Last Purchase Date */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Last Purchase</span>
                      </div>
                      <div className="text-lg font-bold text-slate-800">
                        {summary.lastPurchaseDate ? formatDate(summary.lastPurchaseDate) : 'N/A'}
                      </div>
                    </div>

                    {/* Primary Supplier */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <Truck className="w-4 h-4" />
                        <span className="text-sm">Primary Supplier</span>
                      </div>
                      <div className="text-lg font-bold text-slate-800 truncate" title={summary.primarySupplier}>
                        {summary.primarySupplier || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Quick Statistics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Total Purchases:</span>
                        <span className="font-medium text-slate-800 ml-2">{purchases.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Qty Purchased:</span>
                        <span className="font-medium text-slate-800 ml-2">
                          {purchases.reduce((sum, p) => sum + p.quantity, 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Movements:</span>
                        <span className="font-medium text-slate-800 ml-2">{movements.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">GST Rate:</span>
                        <span className="font-medium text-slate-800 ml-2">{product.gstPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase History Tab */}
              {activeTab === 'purchases' && (
                <div>
                  {purchases.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No purchase history recorded yet.</p>
                      <p className="text-sm mt-1">Click "Add Stock" to add your first purchase.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Supplier</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Qty Added</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Purchase Price</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Total Value</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchases.map((purchase, index) => (
                            <tr key={purchase.id || index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2">{formatDate(purchase.purchaseDate)}</td>
                              <td className="px-3 py-2 font-medium">{purchase.supplierName || '-'}</td>
                              <td className="px-3 py-2 text-right text-green-600 font-medium">
                                +{purchase.quantity}
                              </td>
                              <td className="px-3 py-2 text-right">{formatCurrency(purchase.purchasePrice)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(purchase.totalValue)}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{purchase.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100">
                          <tr>
                            <td className="px-3 py-2 font-medium" colSpan={2}>Total</td>
                            <td className="px-3 py-2 text-right font-medium text-green-600">
                              +{purchases.reduce((sum, p) => sum + p.quantity, 0)}
                            </td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-right font-bold">
                              {formatCurrency(purchases.reduce((sum, p) => sum + p.totalValue, 0))}
                            </td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Stock Movements Tab */}
              {activeTab === 'movements' && (
                <div>
                  {movements.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No stock movement history recorded yet.</p>
                      <p className="text-sm mt-1">Movements will be tracked automatically when you add or sell stock.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Type</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Change</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Balance After</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movements.map((movement, index) => (
                            <tr key={movement.id || index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2">{formatDate(movement.createdAt)}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getMovementTypeColor(movement.movementType)}`}>
                                  {movement.movementType === 'purchase' && <ArrowUp className="w-3 h-3" />}
                                  {movement.movementType === 'sale' && <ArrowDown className="w-3 h-3" />}
                                  {getMovementTypeLabel(movement.movementType)}
                                </span>
                              </td>
                              <td className={`px-3 py-2 text-right font-medium ${
                                movement.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {movement.quantityChange >= 0 ? '+' : ''}{movement.quantityChange}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-800">
                                {movement.balanceAfter}
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{movement.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add Stock Modal */}
      <AddExistingStockModal
        isOpen={showAddStock}
        onClose={() => setShowAddStock(false)}
        onSave={handleAddStock}
        product={product}
        suppliers={suppliers}
      />
    </div>
  );
}
