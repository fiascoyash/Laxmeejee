// ─── Product Matcher Component ─────────────────────────────────────────────────
// Matches extracted products against the catalog.
// Allows user to choose: match existing, create new, or skip.

import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, X, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ExtractedProduct, MatchedProduct, MatchDecision } from './types';
import { ProductCatalogItem, UnitType } from '../../types';
import { generateId } from '../../utils/storage';

export interface ProductMatcherProps {
  products: ExtractedProduct[];
  catalog: ProductCatalogItem[];
  onMatch: (matchedProducts: MatchedProduct[]) => void;
  onBack: () => void;
}

// Match confidence levels
type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

interface MatchCandidate {
  product: ProductCatalogItem;
  score: number;
  level: ConfidenceLevel;
}

// Simple fuzzy matching for product names
const scoreMatch = (name: string, catalogItem: ProductCatalogItem): { score: number; level: ConfidenceLevel } => {
  const nameLower = name.toLowerCase().trim();
  const catalogLower = catalogItem.name.toLowerCase().trim();

  // Exact match
  if (nameLower === catalogLower) {
    return { score: 100, level: 'high' };
  }

  // Name contains catalog or vice versa
  if (nameLower.includes(catalogLower) || catalogLower.includes(nameLower)) {
    return { score: 80, level: 'high' };
  }

  // Check for partial word matches
  const nameWords = nameLower.split(/\s+/);
  const catalogWords = catalogLower.split(/\s+/);

  let matchedWords = 0;
  for (const word of nameWords) {
    if (word.length >= 3 && catalogWords.some((cw) => cw.includes(word) || word.includes(cw))) {
      matchedWords++;
    }
  }

  const wordScore = nameWords.length > 0 ? (matchedWords / nameWords.length) * 70 : 0;

  if (wordScore >= 60) {
    return { score: wordScore, level: 'medium' };
  }

  if (wordScore >= 30) {
    return { score: wordScore, level: 'low' };
  }

  return { score: 0, level: 'none' };
};

const findMatchCandidates = (name: string, catalog: ProductCatalogItem[]): MatchCandidate[] => {
  if (!name.trim()) return [];

  const candidates: MatchCandidate[] = catalog
    .map((product) => {
      const { score, level } = scoreMatch(name, product);
      return { product, score, level };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return candidates;
};

export function ProductMatcher({
  products,
  catalog,
  onMatch,
  onBack,
}: ProductMatcherProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [matchDecisions, setMatchDecisions] = useState<Record<string, { decision: MatchDecision; matchedId: string | null }>>({});

  // Initialize match decisions
  useMemo(() => {
    const initial: Record<string, { decision: MatchDecision; matchedId: string | null }> = {};
    products.forEach((p) => {
      const candidates = findMatchCandidates(p.productName, catalog);
      const best = candidates[0];

      initial[p.id] = {
        decision: best && best.level !== 'none' ? 'match_existing' : 'create_new',
        matchedId: best && best.level !== 'none' ? best.product.id : null,
      };
    });
    setMatchDecisions(initial);
  }, [products, catalog]);

  // Update decision for a product
  const updateDecision = useCallback((productId: string, decision: MatchDecision, matchedId: string | null) => {
    setMatchDecisions((prev) => ({
      ...prev,
      [productId]: { decision, matchedId },
    }));
  }, []);

  // Calculate matched products
  const matchedProducts = useMemo((): MatchedProduct[] => {
    return products.map((p) => {
      const decision = matchDecisions[p.id] || { decision: 'create_new' as MatchDecision, matchedId: null };
      const qty = parseFloat(p.quantity) || 0;
      const rate = parseFloat(p.purchaseRate) || 0;
      const gst = parseFloat(p.gstPercent) || 0;

      let resolvedProduct: ProductCatalogItem | null = null;
      let stockBefore = 0;

      if (decision.decision === 'match_existing' && decision.matchedId) {
        const matched = catalog.find((c) => c.id === decision.matchedId);
        if (matched) {
          resolvedProduct = { ...matched };
          stockBefore = matched.stockQuantity;
        }
      } else if (decision.decision === 'create_new') {
        const now = new Date().toISOString();
        resolvedProduct = {
          id: generateId(),
          name: p.productName || `Imported Product`,
          category: 'Imported',
          unit: (p.unit || 'piece') as UnitType,
          purchasePrice: rate,
          sellingPrice: rate,
          gstPercent: gst,
          hsnSacCode: p.hsnSac || '',
          stockQuantity: 0,
          createdAt: now,
          updatedAt: now,
        };
        stockBefore = 0;
      }

      const warnings: string[] = [];
      if (!p.productName.trim()) warnings.push('Missing product name');
      if (qty <= 0) warnings.push('Invalid quantity');
      if (rate <= 0) warnings.push('Invalid rate');

      return {
        ...p,
        decision: decision.decision,
        matchedProductId: decision.matchedId,
        matchedProductName: decision.matchedId
          ? catalog.find((c) => c.id === decision.matchedId)?.name || null
          : null,
        resolvedProduct,
        stockBefore,
        stockAfter: stockBefore + qty,
        warnings,
      };
    });
  }, [products, matchDecisions, catalog]);

  // Summary statistics
  const stats = useMemo(() => {
    const matched = matchedProducts.filter((p) => p.decision === 'match_existing').length;
    const newProducts = matchedProducts.filter((p) => p.decision === 'create_new').length;
    const skipped = matchedProducts.filter((p) => p.decision === 'skip').length;
    const withWarnings = matchedProducts.filter((p) => p.warnings.length > 0).length;

    return { matched, newProducts, skipped, withWarnings, total: matchedProducts.length };
  }, [matchedProducts]);

  // Proceed Handler
  const handleProceed = useCallback(() => {
    onMatch(matchedProducts);
  }, [matchedProducts, onMatch]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-600" />
          Match Products
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Match each product with your catalog, or add as new products.
        </p>
      </div>

      {/* Summary */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-emerald-700">
            <Check className="w-3.5 h-3.5 inline mr-1" />
            {stats.matched} matched
          </span>
          <span className="text-blue-700">
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            {stats.newProducts} new
          </span>
          {stats.skipped > 0 && (
            <span className="text-slate-500">
              <X className="w-3.5 h-3.5 inline mr-1" />
              {stats.skipped} skipped
            </span>
          )}
          {stats.withWarnings > 0 && (
            <span className="text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              {stats.withWarnings} issues
            </span>
          )}
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {matchedProducts.map((p) => {
          const candidates = findMatchCandidates(p.productName, catalog);
          const decision = matchDecisions[p.id] || { decision: 'create_new', matchedId: null };
          const isExpanded = expandedRow === p.id;

          return (
            <div key={p.id} className="border-b border-slate-100">
              {/* Main row */}
              <div
                className="px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedRow(isExpanded ? null : p.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {p.productName || <span className="text-slate-400 italic">No name</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.quantity} {p.unit} @ Rs. {p.purchaseRate}
                    {p.warnings.length > 0 && (
                      <span className="text-amber-600 ml-2">
                        ({p.warnings.join(', ')})
                      </span>
                    )}
                  </p>
                </div>

                {/* Decision badge */}
                <div
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    decision.decision === 'match_existing'
                      ? 'bg-emerald-100 text-emerald-700'
                      : decision.decision === 'create_new'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {decision.decision === 'match_existing'
                    ? `Match: ${p.matchedProductName || 'Unknown'}`
                    : decision.decision === 'create_new'
                    ? 'New'
                    : 'Skip'}
                </div>

                {/* Expand icon */}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 py-2 bg-slate-50 space-y-2">
                  {/* Match candidates */}
                  {candidates.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Match with existing:</p>
                      <div className="space-y-1">
                        {candidates.map((c) => (
                          <button
                            key={c.product.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDecision(p.id, 'match_existing', c.product.id);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                              decision.matchedId === c.product.id
                                ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                                : 'bg-white border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="font-medium">{c.product.name}</span>
                            <span className="text-slate-400 ml-1">
                              (Stock: {c.product.stockQuantity})
                            </span>
                            <span
                              className={`ml-1 px-1 rounded ${
                                c.level === 'high'
                                  ? 'bg-emerald-200 text-emerald-700'
                                  : c.level === 'medium'
                                  ? 'bg-blue-200 text-blue-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {c.level}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDecision(p.id, 'create_new', null);
                      }}
                      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium border ${
                        decision.decision === 'create_new'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" />
                      Create New
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDecision(p.id, 'skip', null);
                      }}
                      className={`px-2 py-1.5 rounded text-xs font-medium border ${
                        decision.decision === 'skip'
                          ? 'bg-slate-100 border-slate-300 text-slate-700'
                          : 'bg-white border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0 space-y-2">
        <div className="text-xs text-slate-500">
          {stats.matched} matched · {stats.newProducts} new · {stats.skipped} skipped
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={handleProceed}
            disabled={matchedProducts.length === 0}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed to Import ({matchedProducts.filter((p) => p.decision !== 'skip').length})
          </button>
        </div>
      </div>
    </div>
  );
}
