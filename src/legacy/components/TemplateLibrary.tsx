// @ts-nocheck -- original Hisaaboo code, type-checked loosely
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QuotationTemplate, TemplateCategory } from '../types';
import {
  Edit2, Trash2, Copy, Eye, Layout, Star, MoreVertical, Crown, Sparkles,
  Search, LayoutGrid, List, Download, Pencil, X,
} from 'lucide-react';

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

type StatusFilter = 'all' | 'default' | 'premium' | 'custom';
type SortKey = 'recent' | 'oldest' | 'nameAsc' | 'nameDesc';
type ViewMode = 'grid' | 'list';

interface MenuPos {
  top: number;
  left: number;
  maxHeight: number;
}

interface Props {
  templates: QuotationTemplate[];
  onEdit: (template: QuotationTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSetDefault: (id: string) => void;
  onPreview: (template: QuotationTemplate) => void;
  onCreateNew: () => void;
  onRename: (id: string, name: string) => void;
}

const MENU_WIDTH = 176; // w-44
const MENU_EST_HEIGHT = 260;
const VIEWPORT_GAP = 8;

export function TemplateLibrary({
  templates,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
  onPreview,
  onCreateNew,
  onRename,
}: Props) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TemplateCategory>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [renaming, setRenaming] = useState<QuotationTemplate | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ─── Dropdown positioning: portal to body, flips up when no room below ───
  const openMenu = (templateId: string) => {
    if (menuFor === templateId) {
      setMenuFor(null);
      return;
    }
    const btn = menuButtonRefs.current[templateId];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP;
    const spaceAbove = rect.top - VIEWPORT_GAP;
    const openUp = spaceBelow < MENU_EST_HEIGHT && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_EST_HEIGHT, available));
    let left = rect.right - MENU_WIDTH;
    left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP));
    const top = openUp
      ? Math.max(VIEWPORT_GAP, rect.top - Math.min(MENU_EST_HEIGHT, available) - 4)
      : rect.bottom + 4;
    setMenuPos({ top, left, maxHeight });
    setMenuFor(templateId);
  };

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      const btn = menuButtonRefs.current[menuFor];
      if (btn?.contains(target)) return;
      setMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuFor(null);
    };
    const onScroll = () => setMenuFor(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuFor]);

  // ─── Summary counts (dynamic from existing data) ───
  const summary = useMemo(() => ({
    total: templates.length,
    custom: templates.filter(t => !t.isPremium).length,
    defaults: templates.filter(t => t.isDefault).length,
  }), [templates]);

  const categoriesPresent = useMemo(() => {
    const set = new Set<TemplateCategory>();
    templates.forEach(t => t.category && set.add(t.category));
    return Array.from(set);
  }, [templates]);

  // ─── Search / filter / sort ───
  const visibleTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = templates.filter(t => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (statusFilter === 'default' && !t.isDefault) return false;
      if (statusFilter === 'premium' && !t.isPremium) return false;
      if (statusFilter === 'custom' && (t.isPremium || t.isDefault)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortKey === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (sortKey === 'nameAsc') return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
    return list;
  }, [templates, search, categoryFilter, statusFilter, sortKey]);

  const exportTemplate = (template: QuotationTemplate) => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'template'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startRename = (template: QuotationTemplate) => {
    setRenaming(template);
    setRenameValue(template.name);
    setMenuFor(null);
  };

  const confirmRename = () => {
    const name = renameValue.trim();
    if (renaming && name && name !== renaming.name) {
      onRename(renaming.id, name);
    }
    setRenaming(null);
  };

  const menuTemplate = menuFor ? templates.find(t => t.id === menuFor) : null;

  const renderMenu = () => {
    if (!menuTemplate || !menuPos) return null;
    const t = menuTemplate;
    const itemCls = 'w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2';
    return createPortal(
      <div
        ref={menuRef}
        style={{ top: menuPos.top, left: menuPos.left, maxHeight: menuPos.maxHeight }}
        className="fixed w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] overflow-y-auto"
        role="menu"
      >
        <button onClick={() => { onEdit(t); setMenuFor(null); }} className={itemCls}>
          <Edit2 className="w-4 h-4" /> Edit
        </button>
        <button onClick={() => { onPreview(t); setMenuFor(null); }} className={itemCls}>
          <Eye className="w-4 h-4" /> Preview
        </button>
        <button onClick={() => { onDuplicate(t.id); setMenuFor(null); }} className={itemCls}>
          <Copy className="w-4 h-4" /> Duplicate
        </button>
        <button onClick={() => startRename(t)} className={itemCls}>
          <Pencil className="w-4 h-4" /> Rename
        </button>
        {!t.isDefault && (
          <button onClick={() => { onSetDefault(t.id); setMenuFor(null); }} className={itemCls}>
            <Star className="w-4 h-4" /> Set Default
          </button>
        )}
        <button onClick={() => { exportTemplate(t); setMenuFor(null); }} className={itemCls}>
          <Download className="w-4 h-4" /> Export
        </button>
        {!t.isDefault && (
          <button
            onClick={() => { onDelete(t.id); setMenuFor(null); }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        )}
      </div>,
      document.body
    );
  };

  const renderBadges = (template: QuotationTemplate) => (
    <>
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
    </>
  );

  const renderMenuButton = (template: QuotationTemplate) => (
    <button
      ref={el => { menuButtonRefs.current[template.id] = el; }}
      onClick={() => openMenu(template.id)}
      className="p-1 hover:bg-slate-100 rounded"
      aria-label={`Actions for ${template.name}`}
      aria-haspopup="menu"
      aria-expanded={menuFor === template.id}
    >
      <MoreVertical className="w-4 h-4 text-slate-500" />
    </button>
  );

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

  const selectCls = 'px-2 py-2 border border-slate-300 rounded-md text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{summary.total}</div>
          <div className="text-xs text-slate-500">Total Templates</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{summary.custom}</div>
          <div className="text-xs text-slate-500">Custom Templates</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{summary.defaults}</div>
          <div className="text-xs text-slate-500">Default Templates</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)} className={selectCls} aria-label="Filter by category">
          <option value="all">All Categories</option>
          {categoriesPresent.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className={selectCls} aria-label="Filter by status">
          <option value="all">All Status</option>
          <option value="default">Default</option>
          <option value="premium">Premium</option>
          <option value="custom">Custom</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className={selectCls} aria-label="Sort templates">
          <option value="recent">Recently Updated</option>
          <option value="oldest">Oldest Updated</option>
          <option value="nameAsc">Name A–Z</option>
          <option value="nameDesc">Name Z–A</option>
        </select>
        <div className="flex border border-slate-300 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            aria-label="List view"
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2 text-sm"
        >
          <Layout className="w-4 h-4" />
          New Template
        </button>
      </div>

      {visibleTemplates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-500">No templates match your search or filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ─── Grid view (existing card design preserved) ─── */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map(template => (
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
                <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                  {renderBadges(template)}
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
                  {renderMenuButton(template)}
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
      ) : (
        /* ─── List view ─── */
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {visibleTemplates.map(template => (
            <div key={template.id} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                template.isPremium ? 'bg-amber-50' : 'bg-slate-100'
              }`}>
                {template.isPremium ? (
                  <Crown className="w-5 h-5 text-amber-400" />
                ) : (
                  <Layout className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-800 truncate">{template.name}</h3>
                  {renderBadges(template)}
                  {template.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                      <Star className="w-3 h-3" /> Default
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {(template.blocks || []).length} blocks · Updated {new Date(template.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => onEdit(template)}
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => onPreview(template)}
                className="px-3 py-1.5 border border-slate-300 text-sm rounded hover:bg-slate-50 shrink-0"
              >
                <Eye className="w-4 h-4" />
              </button>
              {renderMenuButton(template)}
            </div>
          ))}
        </div>
      )}

      {renderMenu()}

      {/* Rename dialog */}
      {renaming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4" onClick={() => setRenaming(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Rename Template</h3>
              <button onClick={() => setRenaming(null)} className="p-1 hover:bg-slate-100 rounded" aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenaming(null); }}
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Template name"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenaming(null)}
                className="px-4 py-2 border border-slate-300 text-sm rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRename}
                disabled={!renameValue.trim()}
                className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
