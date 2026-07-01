import { useState, useMemo } from 'react';
import {
  ProductCatalogItem, IndustryType, UnitType, ExpiryStatus, BusinessType,
  UNIT_OPTIONS, INDUSTRY_OPTIONS, INDUSTRY_FIELDS, BUSINESS_TYPE_FIELDS, getIndustryTypeFromBusinessType
} from '../types';
import {
  generateId, getExpiryStatus, getExpiryStatusLabel, isLowStock, getDaysUntilExpiry, generateSku, getDefaultUnit
} from '../utils/storage';
import {
  Package, Plus, Trash2, Edit, X, Save, Search, Filter, AlertTriangle, Clock, AlertCircle, ChevronDown, Building2, Briefcase
} from 'lucide-react';

interface Props {
  catalog: ProductCatalogItem[];
  onSave: (catalog: ProductCatalogItem[]) => void;
  businessType?: BusinessType;
}

export function ProductCatalog({ catalog, onSave, businessType }: Props) {
  const [editing, setEditing] = useState<ProductCatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGstRate, setSelectedGstRate] = useState<string>('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false);
  const [filterExpired, setFilterExpired] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIndustryType, setSelectedIndustryType] = useState<IndustryType>(() => getIndustryTypeFromBusinessType(businessType));

  // Get business type fields for dynamic form
  const businessTypeFields = useMemo(() => {
    return businessType ? BUSINESS_TYPE_FIELDS[businessType] || [] : [];
  }, [businessType]);

  // Get unique categories from catalog
  const categories = useMemo(() => {
    const cats = new Set(catalog.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [catalog]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = [...catalog];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        p.category.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // GST rate filter
    if (selectedGstRate !== '') {
      filtered = filtered.filter(p => p.gstPercent === Number(selectedGstRate));
    }

    // Low stock filter
    if (filterLowStock) {
      filtered = filtered.filter(p => isLowStock(p));
    }

    // Expiring soon filter
    if (filterExpiringSoon) {
      filtered = filtered.filter(p => getExpiryStatus(p.expiryDate) === 'expiring_soon');
    }

    // Expired filter
    if (filterExpired) {
      filtered = filtered.filter(p => getExpiryStatus(p.expiryDate) === 'expired');
    }

    return filtered;
  }, [catalog, searchQuery, selectedCategory, selectedGstRate, filterLowStock, filterExpiringSoon, filterExpired]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedGstRate('');
    setFilterLowStock(false);
    setFilterExpiringSoon(false);
    setFilterExpired(false);
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedGstRate !== '' || filterLowStock || filterExpiringSoon || filterExpired;

  const handleAdd = () => {
    const now = new Date().toISOString();
    const industryType = getIndustryTypeFromBusinessType(businessType);
    setEditing({
      id: '',
      name: '',
      sku: '',
      category: '',
      unit: getDefaultUnit(industryType),
      purchasePrice: 0,
      sellingPrice: 0,
      gstPercent: 18,
      hsnCode: '',
      stockQuantity: 0,
      minStockAlert: 0,
      brand: '',
      description: '',
      industryType: industryType,
      attributes: {},
      createdAt: now,
      updatedAt: now,
    });
    setSelectedIndustryType(industryType);
    setShowForm(true);
  };

  const handleEdit = (item: ProductCatalogItem) => {
    setEditing({ ...item });
    if (item.industryType) {
      setSelectedIndustryType(item.industryType);
    }
    setShowForm(true);
  };

  const handleDuplicate = (item: ProductCatalogItem) => {
    const now = new Date().toISOString();
    const newItem: ProductCatalogItem = {
      ...item,
      id: generateId(),
      name: `${item.name} (Copy)`,
      sku: generateSku(item.name),
      createdAt: now,
      updatedAt: now,
    };
    onSave([...catalog, newItem]);
  };

  const handleSave = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert('Please enter a product name');
      return;
    }
    if (!editing.hsnCode.trim()) {
      alert('Please enter an HSN code');
      return;
    }

    const now = new Date().toISOString();
    if (!editing.id) {
      editing.id = generateId();
      editing.createdAt = now;
      editing.sku = editing.sku || generateSku(editing.name);
      onSave([...catalog, editing]);
    } else {
      onSave(catalog.map(c => c.id === editing.id ? { ...editing, updatedAt: now } : c));
    }

    setEditing(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      onSave(catalog.filter(c => c.id !== id));
    }
  };

  const updateField = (field: keyof ProductCatalogItem, value: string | number) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  // Get expiry status badge styling
  const getExpiryBadge = (status: ExpiryStatus) => {
    switch (status) {
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
            <AlertCircle className="w-3 h-3" /> Expired
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            <Clock className="w-3 h-3" /> Expiring Soon
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
            Safe
          </span>
        );
    }
  };

  // Get stock warning badge
  const getStockBadge = (item: ProductCatalogItem) => {
    if (isLowStock(item)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
          <AlertTriangle className="w-3 h-3" /> Low Stock
        </span>
      );
    }
    return (
      <span className="text-slate-600">{item.stockQuantity} {UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit}</span>
    );
  };

  // Render industry-specific fields in form
  const renderIndustryFields = () => {
    if (!editing || selectedIndustryType === 'custom') return null;

    const industryConfig = INDUSTRY_FIELDS[selectedIndustryType];
    if (!industryConfig || industryConfig.fields.length === 0) return null;

    return industryConfig.fields.map(field => {
      const label = industryConfig.labels[field] || field;

      switch (field) {
        case 'sku':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.sku || ''}
                onChange={(e) => updateField('sku', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="Auto-generated or custom SKU"
              />
            </div>
          );
        case 'brand':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.brand || ''}
                onChange={(e) => updateField('brand', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Brand name"
              />
            </div>
          );
        case 'unit':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <select
                value={editing.unit || 'piece'}
                onChange={(e) => updateField('unit', e.target.value as UnitType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {UNIT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          );
        case 'batchNumber':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.batchNumber || ''}
                onChange={(e) => updateField('batchNumber', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="Batch number"
              />
            </div>
          );
        case 'manufacturingDate':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="date"
                value={editing.manufacturingDate || ''}
                onChange={(e) => updateField('manufacturingDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          );
        case 'expiryDate':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="date"
                value={editing.expiryDate || ''}
                onChange={(e) => updateField('expiryDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          );
        case 'wattage':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="number"
                min="0"
                value={editing.wattage || ''}
                onChange={(e) => updateField('wattage', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Wattage in Watts"
              />
            </div>
          );
        case 'warrantyMonths':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="number"
                min="0"
                value={editing.warrantyMonths || ''}
                onChange={(e) => updateField('warrantyMonths', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Warranty period"
              />
            </div>
          );
        case 'partNumber':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.partNumber || ''}
                onChange={(e) => updateField('partNumber', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="Part/OEM number"
              />
            </div>
          );
        case 'modelNumber':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.modelNumber || ''}
                onChange={(e) => updateField('modelNumber', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Model number"
              />
            </div>
          );
        case 'variant':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.variant || ''}
                onChange={(e) => updateField('variant', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Variant/Grade"
              />
            </div>
          );
        case 'serialNumber':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.serialNumber || ''}
                onChange={(e) => updateField('serialNumber', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="Serial number"
              />
            </div>
          );
        case 'sacCode':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="text"
                value={editing.sacCode || ''}
                onChange={(e) => updateField('sacCode', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="SAC code for services"
              />
            </div>
          );
        case 'billingUnit':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <select
                value={editing.billingUnit || 'per_hour'}
                onChange={(e) => updateField('billingUnit', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="per_hour">Per Hour</option>
                <option value="fixed">Fixed Charge</option>
                <option value="per_day">Per Day</option>
              </select>
            </div>
          );
        case 'serviceDuration':
          return (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type="number"
                min="0"
                value={editing.serviceDuration || ''}
                onChange={(e) => updateField('serviceDuration', Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Duration in hours/days"
              />
            </div>
          );
        default:
          return null;
      }
    });
  };

  // Render business type specific fields (NEW)
  const renderBusinessTypeFields = () => {
    if (!editing || !businessType || businessTypeFields.length === 0) return null;

    return businessTypeFields.map(field => {
      const value = editing.attributes?.[field.key] ?? '';

      switch (field.type) {
        case 'text':
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={value as string}
                onChange={(e) => {
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, [field.key]: e.target.value }
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder={field.placeholder}
              />
            </div>
          );
        case 'number':
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={value as number}
                onChange={(e) => {
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, [field.key]: e.target.value }
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder={field.placeholder}
              />
            </div>
          );
        case 'date':
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="date"
                value={value as string}
                onChange={(e) => {
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, [field.key]: e.target.value }
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          );
        case 'select':
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <select
                value={value as string}
                onChange={(e) => {
                  setEditing({
                    ...editing,
                    attributes: { ...editing.attributes, [field.key]: e.target.value }
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              >
                <option value="">Select...</option>
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b bg-slate-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Product Catalog
          </h3>
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Search by name, SKU, category, brand..."
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 border rounded-md flex items-center gap-2 text-sm transition-colors ${
                hasActiveFilters
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {[searchQuery, selectedCategory, selectedGstRate !== '' ? selectedGstRate : null, filterLowStock, filterExpiringSoon, filterExpired].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">GST Rate</label>
                <select
                  value={selectedGstRate}
                  onChange={(e) => setSelectedGstRate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">All Rates</option>
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Stock Status</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-slate-700">Low Stock Only</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Status</label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterExpiringSoon}
                      onChange={(e) => setFilterExpiringSoon(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-amber-700">Expiring Soon</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterExpired}
                      onChange={(e) => setFilterExpired(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-red-700">Expired</span>
                  </label>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-slate-600 hover:text-slate-800 underline"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Product Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">SKU</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Stock</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Unit</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">GST%</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Selling Price</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Value On Hand</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700">Expiry</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(item => {
              const expiryStatus = getExpiryStatus(item.expiryDate);
              return (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    {item.brand && (
                      <div className="text-xs text-slate-500">{item.brand}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-600 text-xs">
                    {item.sku || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStockBadge(item)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 text-xs">
                    {UNIT_OPTIONS.find(u => u.value === item.unit)?.label || item.unit}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {item.gstPercent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    Rs. {(item.sellingPrice || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-700">
                    Rs. {((item.purchasePrice || 0) * (item.stockQuantity || 0)).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.expiryDate ? getExpiryBadge(expiryStatus) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(item)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Duplicate"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  {catalog.length === 0
                    ? 'No products in catalog. Click "Add Product" to add one.'
                    : 'No products match your search criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      {catalog.length > 0 && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-4 text-xs text-slate-600">
          <span>Total Products: <strong className="text-slate-800">{catalog.length}</strong></span>
          <span>|
            <span className="text-amber-600 ml-1">
              {catalog.filter(p => getExpiryStatus(p.expiryDate) === 'expiring_soon').length} Expiring Soon
            </span>
          </span>
          <span>|
            <span className="text-red-600 ml-1">
              {catalog.filter(p => getExpiryStatus(p.expiryDate) === 'expired').length} Expired
            </span>
          </span>
          <span>|
            <span className="text-red-700 ml-1">
              {catalog.filter(p => isLowStock(p)).length} Low Stock
            </span>
          </span>
          <span>|
            <span className="text-emerald-700 ml-1 font-medium">
              Total Inventory Value: <strong>Rs. {catalog.reduce((sum, p) => sum + (p.purchasePrice || 0) * (p.stockQuantity || 0), 0).toLocaleString()}</strong>
            </span>
          </span>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
            <div className="flex justify-between items-center p-4 border-b bg-slate-50 sticky top-0">
              <h3 className="text-lg font-semibold text-slate-800">
                {editing.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Industry Type Selection */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Industry Type
                </label>
                <select
                  value={selectedIndustryType}
                  onChange={(e) => {
                    const newType = e.target.value as IndustryType;
                    setSelectedIndustryType(newType);
                    setEditing({
                      ...editing,
                      industryType: newType,
                      unit: getDefaultUnit(newType),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {INDUSTRY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    value={editing.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g., Solar, Medicine, Automobile"
                    list="category-list"
                  />
                  <datalist id="category-list">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                  <select
                    value={editing.unit}
                    onChange={(e) => updateField('unit', e.target.value as UnitType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {UNIT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Industry-Specific Fields */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Industry-Specific Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderIndustryFields()}
                </div>
              </div>

              {/* Business Type Dynamic Fields (NEW) */}
              {businessTypeFields.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Additional Product Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderBusinessTypeFields()}
                  </div>
                </div>
              )}

              {/* Pricing */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Pricing</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editing.purchasePrice}
                      onChange={(e) => updateField('purchasePrice', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (Rs.) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editing.sellingPrice}
                      onChange={(e) => updateField('sellingPrice', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">GST %</label>
                    <select
                      value={editing.gstPercent}
                      onChange={(e) => updateField('gstPercent', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GST & HSN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HSN/SAC Code *</label>
                  <input
                    type="text"
                    value={editing.hsnCode}
                    onChange={(e) => updateField('hsnCode', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    placeholder="e.g., 8541 for electronics"
                  />
                </div>
              </div>

              {/* Stock Management */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Stock Management</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={editing.stockQuantity}
                      onChange={(e) => updateField('stockQuantity', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Alert Level</label>
                    <input
                      type="number"
                      min="0"
                      value={editing.minStockAlert || ''}
                      onChange={(e) => updateField('minStockAlert', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Low stock warning threshold"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Description</label>
                <textarea
                  value={editing.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                  placeholder="Additional product details..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-slate-50 sticky bottom-0">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
