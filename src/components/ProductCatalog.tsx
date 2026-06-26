import { useState } from 'react';
import { ProductCatalogItem } from '../types';
import { generateId } from '../utils/storage';
import { Package, Plus, Trash2, Edit, X, Save } from 'lucide-react';

interface Props {
  catalog: ProductCatalogItem[];
  onSave: (catalog: ProductCatalogItem[]) => void;
}

export function ProductCatalog({ catalog, onSave }: Props) {
  const [editing, setEditing] = useState<ProductCatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    setEditing({
      id: '',
      name: '',
      hsnCode: '',
      gstPercent: 18,
      defaultPrice: 0,
      createdAt: new Date().toISOString(),
    });
    setShowForm(true);
  };

  const handleEdit = (item: ProductCatalogItem) => {
    setEditing({ ...item });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!editing) return;

    if (!editing.id) {
      editing.id = generateId();
      editing.createdAt = new Date().toISOString();
      onSave([...catalog, editing]);
    } else {
      onSave(catalog.map(c => c.id === editing.id ? editing : c));
    }

    setEditing(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      onSave(catalog.filter(c => c.id !== id));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Product Catalog
        </h3>
        <button
          onClick={handleAdd}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Product Name</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">HSN Code</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">GST %</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Default Price</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map(item => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-center font-mono text-gray-600">{item.hsnCode}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{item.gstPercent}%</span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">Rs. {item.defaultPrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {catalog.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No products in catalog. Click "Add Product" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Modal */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">
                {editing.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Solar Panel 335W"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                <input
                  type="text"
                  value={editing.hsnCode}
                  onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="e.g., 8541"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Percentage</label>
                <select
                  value={editing.gstPercent}
                  onChange={(e) => setEditing({ ...editing, gstPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={18}>18%</option>
                  <option value={40}>40%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Price (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.defaultPrice}
                  onChange={(e) => setEditing({ ...editing, defaultPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
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
