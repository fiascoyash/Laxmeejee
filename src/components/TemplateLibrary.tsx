import { useState } from 'react';
import { QuotationTemplate, TemplateCategory } from '../types';
import { Edit2, Trash2, Copy, Eye, Layout, Star, MoreVertical, Crown, Sparkles } from 'lucide-react';

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  professional: 'Professional',
  gst: 'GST Focused',
  retail: 'Retail',
  modern: 'Modern',
  luxury: 'Luxury',
  specialty: 'Specialty',
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  professional: 'bg-slate-100 text-slate-700',
  gst: 'bg-green-100 text-green-700',
  retail: 'bg-orange-100 text-orange-700',
  modern: 'bg-blue-100 text-blue-700',
  luxury: 'bg-amber-100 text-amber-700',
  specialty: 'bg-purple-100 text-purple-700',
};

interface Props {
  templates: QuotationTemplate[];
  onEdit: (template: QuotationTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSetDefault: (id: string) => void;
  onPreview: (template: QuotationTemplate) => void;
  onCreateNew: () => void;
}

export function TemplateLibrary({
  templates,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
  onPreview,
  onCreateNew,
}: Props) {
  const [showMenu, setShowMenu] = useState<string | null>(null);

  if (templates.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
        <Layout className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">No Templates Yet</h3>
        <p className="text-slate-500 mb-4">Create your first quotation template.</p>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
        >
          Create Template
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2"
        >
          <Layout className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <div
            key={template.id}
            className={`bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow ${
              template.isPremium ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
            }`}
          >
            {/* Template Preview Thumbnail */}
            <div className={`h-40 border-b flex items-center justify-center relative ${
              template.isPremium ? 'bg-gradient-to-br from-amber-50 to-yellow-50' : 'bg-slate-50'
            }`}>
              <div className="text-4xl text-slate-300">
                {template.isPremium ? (
                  <Crown className="w-12 h-12 mx-auto text-amber-400" />
                ) : (
                  <Layout className="w-12 h-12 mx-auto" />
                )}
              </div>
              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                {template.category && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[template.category]}`}>
                    {CATEGORY_LABELS[template.category]}
                  </span>
                )}
                {template.isPremium && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500 text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Premium
                  </span>
                )}
              </div>
              {template.isDefault && (
                <div className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                  <Star className="w-3 h-3" /> Default
                </div>
              )}
            </div>

            {/* Template Info */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(showMenu === template.id ? null : template.id)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </button>

                  {showMenu === template.id && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                      <button
                        onClick={() => {
                          onEdit(template);
                          setShowMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          onPreview(template);
                          setShowMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" /> Preview
                      </button>
                      <button
                        onClick={() => {
                          onDuplicate(template.id);
                          setShowMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4" /> Duplicate
                      </button>
                      {!template.isDefault && (
                        <button
                          onClick={() => {
                            onSetDefault(template.id);
                            setShowMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Star className="w-4 h-4" /> Set Default
                        </button>
                      )}
                      {!template.isDefault && (
                        <button
                          onClick={() => {
                            onDelete(template.id);
                            setShowMenu(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onEdit(template)}
                  className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => onPreview(template)}
                  className="px-3 py-1.5 border border-slate-300 text-sm rounded hover:bg-slate-50"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-400 mt-3">
                {(template.blocks || []).length} blocks · Updated {new Date(template.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
