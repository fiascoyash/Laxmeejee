import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ProductCatalogItem, UNIT_OPTIONS } from '../types';
import { Package, Star, Clock, Search } from 'lucide-react';
import { useEscapeStack } from '../hooks/useEscapeStack';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: ProductCatalogItem) => void;
  catalog: ProductCatalogItem[];
  recentlyUsed: ProductCatalogItem[];
  frequentlyUsed: ProductCatalogItem[];
  placeholder?: string;
  className?: string;
}

const MAX_RESULTS = 8;

export function ProductAutocomplete({
  value,
  onChange,
  onSelect,
  catalog,
  recentlyUsed,
  frequentlyUsed,
  placeholder = 'Product/Service name',
  className = '',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEscapeStack(isOpen ? () => setIsOpen(false) : null, 1);

  const query = value.trim();

  const searchResults = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const scored: { item: ProductCatalogItem; score: number }[] = [];

    for (const item of catalog) {
      const name = item.name.toLowerCase();
      const sku = item.sku?.toLowerCase() || '';
      const hsn = item.hsnSacCode?.toLowerCase() || '';
      const desc = item.description?.toLowerCase() || '';

      let score = -1;
      if (name === q) score = 1000;
      else if (name.startsWith(q)) score = 900;
      else if (name.includes(q)) score = 800;
      else if (sku && sku.includes(q)) score = 700;
      else if (hsn && hsn.includes(q)) score = 600;
      else if (desc && desc.includes(q)) score = 500;

      if (score >= 0) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS).map(s => s.item);
  }, [catalog, query]);

  const flatItems = useMemo(() => {
    if (query) return searchResults;
    const combined: ProductCatalogItem[] = [];
    const seen = new Set<string>();
    for (const item of frequentlyUsed) {
      const key = item.name.trim().toLowerCase();
      if (!seen.has(key)) { combined.push(item); seen.add(key); }
    }
    for (const item of recentlyUsed) {
      const key = item.name.trim().toLowerCase();
      if (!seen.has(key)) { combined.push(item); seen.add(key); }
    }
    return combined.slice(0, 20);
  }, [query, searchResults, frequentlyUsed, recentlyUsed]);

  const hasFrequent = !query && frequentlyUsed.length > 0;
  const frequentCount = hasFrequent ? frequentlyUsed.length : 0;
  const totalItems = flatItems.length;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${highlightedIndex}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((item: ProductCatalogItem) => {
    onSelect(item);
    setIsOpen(false);
    inputRef.current?.blur();
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && isOpen && flatItems[highlightedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[highlightedIndex]);
    } else if (e.key === 'Tab') {
      if (isOpen && flatItems[highlightedIndex]) {
        handleSelect(flatItems[highlightedIndex]);
      } else {
        setIsOpen(false);
      }
    }
  };

  const renderSuggestion = (item: ProductCatalogItem, idx: number) => {
    const isHighlighted = highlightedIndex === idx;
    return (
      <button
        key={item.id}
        type="button"
        data-idx={idx}
        onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
        onMouseEnter={() => setHighlightedIndex(idx)}
        className={`w-full px-3 py-2.5 text-left border-b border-slate-100 last:border-b-0 flex justify-between items-center gap-2 transition-colors ${
          isHighlighted ? 'bg-emerald-50' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-medium text-slate-800 truncate text-sm">{item.name}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {item.sku && <span className="font-mono">SKU: {item.sku}</span>}
            {item.hsnSacCode && <span>HSN: {item.hsnSacCode}</span>}
            <span>GST: {item.gstPercent}%</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-emerald-600 font-medium text-sm">₹{(item.sellingPrice || 0).toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-400">{UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit}</div>
        </div>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className={className || 'w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-blue-500'}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto min-w-[320px]"
        >
          {totalItems === 0 ? (
            <div className="p-4 text-slate-500 text-center text-sm">
              {query ? 'No matching product found.' : 'No products available. Start typing to search, or enter a product manually.'}
            </div>
          ) : query ? (
            flatItems.map((item, idx) => renderSuggestion(item, idx))
          ) : (
            <>
              {hasFrequent && (
                <>
                  <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5 text-xs font-semibold text-amber-700 sticky top-0">
                    <Star className="w-3.5 h-3.5" />
                    Frequently Used
                  </div>
                  {frequentlyUsed.map((item, idx) => renderSuggestion(item, idx))}
                </>
              )}
              {recentlyUsed.length > 0 && (
                <>
                  <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center gap-1.5 text-xs font-semibold text-blue-700 sticky top-0">
                    <Clock className="w-3.5 h-3.5" />
                    Recently Used
                  </div>
                  {recentlyUsed
                    .filter(item => !frequentlyUsed.some(f => f.name.trim().toLowerCase() === item.name.trim().toLowerCase()))
                    .map((item, idx) => renderSuggestion(item, idx + frequentCount))}
                </>
              )}
            </>
          )}
          {query && totalItems > 0 && (
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
              <Search className="w-3 h-3" />
              {totalItems} match{totalItems !== 1 ? 'es' : ''} • Enter to select
            </div>
          )}
        </div>
      )}
    </div>
  );
}
