import React, { useState, useMemo } from 'react';
import {
  Search,
  Check,
  Plus,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react';
import { BillMappedProduct, ProductCatalogItem, UNIT_OPTIONS } from '../../types';

interface ProductMatcherProps {
  products: BillMappedProduct[];
  catalog: ProductCatalogItem[];
  onProductsChange: (products: BillMappedProduct[]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface MatchCandidate {
  product: ProductCatalogItem;
  score: number;
}

// Simple similarity function
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 80;

  // Word overlap
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const intersection = words1.filter((w) => words2.includes(w));
  const union = [...new Set([...words1, ...words2])];
  if (union.length === 0) return 0;
  return Math.round((intersection.length / union.length) * 70);
};

export const ProductMatcher: React.FC<ProductMatcherProps> = ({
  products,
  catalog,
  onProductsChange,
  onNext,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    purchasePrice: 0,
    sellingPrice: 0,
    gstPercent: 18,
    hsnSacCode: '',
    unit: 'piece' as const,
    category: 'Imported',
  });

  const activeProduct = products[activeProductIndex];

  // Find match candidates for a product
  const findCandidates = (productName: string): MatchCandidate[] => {
    if (!productName) return [];

    const candidates = catalog
      .map((p) => ({
        product: p,
        score: calculateSimilarity(productName, p.name),
      }))
      .filter((c) => c.score > 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return candidates;
  };

  // Calculate candidates for all products
  const productCandidates = useMemo(() => {
    return products.map((p) => findCandidates(p.productName));
  }, [products, catalog]);

  const handleMatch = (productIndex: number, catalogProduct: ProductCatalogItem) => {
    onProductsChange(
      products.map((p, i) =>
        i === productIndex
          ? {
              ...p,
              matchedProductId: catalogProduct.id,
              decision: 'match_existing' as const,
              // Update values from catalog if empty
              gstPercent: p.gstPercent || catalogProduct.gstPercent,
              hsnSac: p.hsnSac || catalogProduct.hsnSacCode,
            }
          : p
      )
    );
  };

  const handleCreateNew = (productIndex: number) => {
    onProductsChange(
      products.map((p, i) =>
        i === productIndex
          ? { ...p, decision: 'create_new' as const, matchedProductId: undefined }
          : p
      )
    );
  };

  const handleSkip = (productIndex: number) => {
    onProductsChange(
      products.map((p, i) =>
        i === productIndex
          ? { ...p, decision: 'skip' as const }
          : p
      )
    );
  };

  const createNewProduct = () => {
    if (!newProductForm.name) {
      alert('Product name is required.');
      return;
    }

    const newProduct: ProductCatalogItem = {
      id: `catalog-${Date.now()}`,
      name: newProductForm.name,
      purchasePrice: newProductForm.purchasePrice,
      sellingPrice: newProductForm.sellingPrice || newProductForm.purchasePrice * 1.2,
      gstPercent: newProductForm.gstPercent,
      hsnSacCode: newProductForm.hsnSacCode,
      unit: newProductForm.unit,
      category: newProductForm.category,
      stockQuantity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to catalog
    const updatedCatalog = [...catalog, newProduct];

    // Update the active product to reference this new catalog item
    onProductsChange(
      products.map((p, i) =>
        i === activeProductIndex
          ? {
              ...p,
              matchedProductId: newProduct.id,
              decision: 'create_new' as const,
            }
          : p
      )
    );

    setShowNewProductForm(false);
    setNewProductForm({
      name: '',
      purchasePrice: 0,
      sellingPrice: 0,
      gstPercent: 18,
      hsnSacCode: '',
      unit: 'piece',
      category: 'Imported',
    });
  };

  // Count matched/unmatched
  const stats = useMemo(() => {
    let matched = 0;
    let newProducts = 0;
    let skipped = 0;
    let pending = 0;

    products.forEach((p) => {
      switch (p.decision) {
        case 'match_existing':
          matched++;
          break;
        case 'create_new':
          newProducts++;
          break;
        case 'skip':
          skipped++;
          break;
        default:
          pending++;
      }
    });

    return { matched, newProducts, skipped, pending };
  }, [products]);

  const allProductsHandled = products.every((p) => p.decision && p.decision !== undefined);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Match Products to Catalog
          </h2>
          <p className="text-slate-600 text-sm">
            Link products to existing catalog items or create new ones
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
          <div className="text-2xl font-bold text-emerald-600">{stats.matched}</div>
          <div className="text-sm text-emerald-700">Matched</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{stats.newProducts}</div>
          <div className="text-sm text-blue-700">New</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
          <div className="text-2xl font-bold text-slate-600">{stats.skipped}</div>
          <div className="text-sm text-slate-700">Skipped</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-amber-700">Pending</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Product List */}
        <div className="lg:col-span-1">
          <h3 className="font-medium text-slate-800 mb-2">Products</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {products.map((product, index) => (
              <button
                key={product.id}
                onClick={() => setActiveProductIndex(index)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  index === activeProductIndex
                    ? 'border-emerald-500 bg-emerald-50'
                    : product.decision === 'match_existing'
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : product.decision === 'create_new'
                    ? 'border-blue-200 bg-blue-50/50'
                    : product.decision === 'skip'
                    ? 'border-slate-200 bg-slate-50/50 opacity-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800 text-sm truncate">
                    {product.productName}
                  </span>
                  {product.decision && product.decision !== 'skip' && (
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {product.quantity} x Rs. {product.purchasePrice}
                </div>
                {product.matchedProductId && (
                  <div className="text-xs text-emerald-600 mt-1">
                    Matched: {catalog.find((c) => c.id === product.matchedProductId)?.name}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Match Panel */}
        <div className="lg:col-span-2">
          {activeProduct && (
            <div className="border border-slate-200 rounded-lg">
              {/* Current Product */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2">
                  {activeProduct.productName}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Qty:</span>{' '}
                    <span className="font-medium">{activeProduct.quantity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rate:</span>{' '}
                    <span className="font-medium">Rs. {activeProduct.purchasePrice}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">GST:</span>{' '}
                    <span className="font-medium">{activeProduct.gstPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search catalog..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Candidates */}
              <div className="p-4 space-y-3 max-h-[250px] overflow-y-auto">
                {productCandidates[activeProductIndex]?.length > 0 ? (
                  productCandidates[activeProductIndex]
                    .filter((c) =>
                      searchQuery
                        ? c.product.name.toLowerCase().includes(searchQuery.toLowerCase())
                        : true
                    )
                    .map((candidate) => (
                      <button
                        key={candidate.product.id}
                        onClick={() => handleMatch(activeProductIndex, candidate.product)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          activeProduct.matchedProductId === candidate.product.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-slate-800">
                              {candidate.product.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              GST: {candidate.product.gstPercent}% | HSN: {candidate.product.hsnSacCode || 'N/A'}
                            </div>
                          </div>
                          <div
                            className={`text-xs px-2 py-1 rounded ${
                              candidate.score >= 80
                                ? 'bg-emerald-100 text-emerald-700'
                                : candidate.score >= 50
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {candidate.score}% match
                          </div>
                        </div>
                      </button>
                    ))
                ) : (
                  <div className="text-center py-4 text-slate-500">
                    No matches found. Create a new product.
                  </div>
                )}

                {/* Create New Button */}
                <button
                  onClick={() => {
                    setNewProductForm({
                      ...newProductForm,
                      name: activeProduct.productName,
                      purchasePrice: activeProduct.purchasePrice,
                      gstPercent: activeProduct.gstPercent,
                      hsnSacCode: activeProduct.hsnSac || '',
                    });
                    setShowNewProductForm(true);
                  }}
                  className="w-full p-3 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-700">Create New Product</span>
                  </div>
                </button>

                {/* Skip Button */}
                <button
                  onClick={() => handleSkip(activeProductIndex)}
                  className="w-full p-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-left"
                >
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600">Skip this product</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Product Modal */}
      {showNewProductForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Create New Catalog Product
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newProductForm.name}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Purchase Price
                    </label>
                    <input
                      type="number"
                      value={newProductForm.purchasePrice}
                      onChange={(e) =>
                        setNewProductForm({
                          ...newProductForm,
                          purchasePrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Selling Price
                    </label>
                    <input
                      type="number"
                      value={newProductForm.sellingPrice}
                      onChange={(e) =>
                        setNewProductForm({
                          ...newProductForm,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      GST %
                    </label>
                    <select
                      value={newProductForm.gstPercent}
                      onChange={(e) =>
                        setNewProductForm({
                          ...newProductForm,
                          gstPercent: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={newProductForm.unit}
                      onChange={(e) =>
                        setNewProductForm({
                          ...newProductForm,
                          unit: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      {UNIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    HSN/SAC Code
                  </label>
                  <input
                    type="text"
                    value={newProductForm.hsnSacCode}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, hsnSacCode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewProductForm(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewProduct}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Create & Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onNext}
          disabled={!allProductsHandled}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Continue to Confirm
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {!allProductsHandled && (
        <div className="mt-3 text-right">
          <span className="text-sm text-amber-600 flex items-center gap-1 justify-end">
            <AlertTriangle className="w-4 h-4" />
            Match all products before continuing
          </span>
        </div>
      )}
    </div>
  );
};
