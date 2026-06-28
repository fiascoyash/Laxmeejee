import { useState, useRef, useCallback, useEffect } from 'react';
import {
  QuotationTemplate, TemplateBlock, BlockType, TableColumn,
  CompanyProfile, Customer, Quotation, Product, A4_WIDTH, A4_HEIGHT, TemplateSettings, DEFAULT_TEMPLATE_SETTINGS, ThemeId, INVOICE_THEMES, BlockZone
} from '../types';
import { generateId, getDefaultProductColumns } from '../utils/storage';
import {
  Trash2, Plus, Save, Settings, Type, Image,
  Building2, User, FileText, Calendar, Table, CreditCard, PenTool, FileWarning, Truck,
  ChevronDown, GripVertical, LucideIcon, Square, Minus, MoveVertical, AlignJustify,
  ArrowUp, ArrowDown, Undo2, Redo2, Copy, Keyboard, X, PanelLeftClose, PanelLeft, Shield, Package, Hammer
} from 'lucide-react';
import { useTemplateHistory } from '../hooks/useTemplateHistory';
import { TemplateSettingsPanel } from './TemplateSettingsPanel';
import { DocumentRenderer } from './DocumentRenderer';

interface Props {
  template: QuotationTemplate;
  companyProfile: CompanyProfile;
  sampleData: {
    customer: Customer;
    quotation: Quotation;
    products: Product[];
  };
  onSave: (template: QuotationTemplate) => void;
  onClose: () => void;
}

const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  company_logo: Image,
  company_details: Building2,
  customer_details: User,
  ship_to_details: Truck,
  quotation_number: FileText,
  quotation_date: Calendar,
  product_table: Table,
  gst_summary: FileText,
  bank_details: CreditCard,
  signature_box: PenTool,
  footer_notes: Type,
  terms_conditions: FileWarning,
  totals: FileText,
  text_block: Type,
  rectangle: Square,
  horizontal_line: Minus,
  vertical_line: MoveVertical,
  divider: AlignJustify,
  warranty: Shield,
  transport_details: Truck,
  delivery_details: Package,
  installation_details: Hammer,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  company_logo: 'Company Logo',
  company_details: 'Company Details',
  customer_details: 'Customer Details (Bill To)',
  ship_to_details: 'Ship To Details',
  quotation_number: 'Quotation Number',
  quotation_date: 'Quotation Date',
  product_table: 'Product Table',
  gst_summary: 'GST Summary',
  bank_details: 'Bank Details',
  signature_box: 'Signature Box',
  footer_notes: 'Footer Notes',
  terms_conditions: 'Terms & Conditions',
  totals: 'Totals',
  text_block: 'Custom Text',
  rectangle: 'Rectangle',
  horizontal_line: 'Horizontal Line',
  vertical_line: 'Vertical Line',
  divider: 'Divider',
  warranty: 'Warranty',
  transport_details: 'Transport Details',
  delivery_details: 'Delivery Details',
  installation_details: 'Installation Details',
};

// Only these block types can be added as custom blocks
const INSERTABLE_BLOCKS: BlockType[] = [
  'bank_details',
  'signature_box',
  'terms_conditions',
  'footer_notes',
  'warranty',
  'transport_details',
  'delivery_details',
  'installation_details',
  'divider',
  'text_block',
];

const ZONE_LABELS: Record<BlockZone, string> = {
  // Horizontal flow zones
  after_header: 'After Header',
  after_meta: 'After Invoice Details',
  after_party: 'After Party Details',
  after_products: 'After Product Table',
  after_totals: 'After Totals',
  after_bank: 'After Bank Details',
  footer: 'At Footer',
  // Split zones
  party_left: 'Bill To Area (Left)',
  party_right: 'Ship To Area (Right)',
  bank_left: 'Bank Area (Left)',
  bank_right: 'Signature Area (Right)',
  footer_left: 'Footer Left',
  footer_center: 'Footer Center',
  footer_right: 'Footer Right',
  // Legacy
  canvas: 'Free Position (Legacy)',
};

// Group zones by category
const ZONE_GROUPS = {
  horizontal: ['after_header', 'after_meta', 'after_party', 'after_products', 'after_totals', 'after_bank', 'footer'] as BlockZone[],
  split: ['party_left', 'party_right', 'bank_left', 'bank_right', 'footer_left', 'footer_center', 'footer_right'] as BlockZone[],
};

const MM_TO_PX = 3.7795275591;

export function TemplateBuilder({ template, companyProfile, sampleData, onSave, onClose }: Props) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(template.blocks || []);
  const [productColumns, setProductColumns] = useState<TableColumn[]>(template.productColumns || getDefaultProductColumns());
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>(template.settings || DEFAULT_TEMPLATE_SETTINGS);
  const [themeId, setThemeId] = useState<ThemeId>((template as any).themeId || 'simple');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState(template.name);
  const [templateDescription, setTemplateDescription] = useState(template.description || '');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [selectedZone, setSelectedZone] = useState<BlockZone | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isUndoRedoRef = useRef(false);
  const clipboardRef = useRef<TemplateBlock | null>(null);

  const {
    canUndo,
    canRedo,
    undo,
    redo,
    pushState,
    getCurrentState,
  } = useTemplateHistory({ maxHistorySize: 50 });

  useEffect(() => {
    pushState({ blocks: template.blocks || [], productColumns: template.productColumns || getDefaultProductColumns() });
  }, []);

  useEffect(() => {
    const state = getCurrentState();
    if (state && isUndoRedoRef.current) {
      setBlocks(state.blocks);
      setProductColumns(state.productColumns);
      isUndoRedoRef.current = false;
    }
  }, [getCurrentState]);

  // No calculations needed for the builder

  const addBlock = (type: BlockType, zone: BlockZone) => {
    const zoneBlocks = blocks.filter(b => b.zone === zone);
    const maxOrder = zoneBlocks.reduce((max, b) => Math.max(max, b.order), -1);

    const newBlock: TemplateBlock = {
      id: generateId(),
      type,
      zone,
      order: maxOrder + 1,
      visible: true,
      content: getDefaultContent(type),
    };

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    pushState({ blocks: newBlocks, productColumns });
    setSelectedBlock(newBlock.id);
    setShowAddBlock(false);
    setSelectedZone(null);
  };

  const getDefaultContent = (type: BlockType): string | undefined => {
    switch (type) {
      case 'terms_conditions':
        return '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.';
      case 'warranty':
        return 'Product warranty: 12 months from date of purchase.\nWarranty covers manufacturing defects only.';
      case 'transport_details':
        return 'Transport: To be arranged by buyer';
      case 'delivery_details':
        return 'Delivery: Within 7-10 working days\nDelivery charges extra as applicable';
      case 'installation_details':
        return 'Installation: To be done by our certified technician\nInstallation charges included in the quote';
      case 'footer_notes':
        return 'Thank you for your business!';
      default:
        return undefined;
    }
  };

  const removeBlock = useCallback((id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    pushState({ blocks: newBlocks, productColumns });
    setSelectedBlock(null);
  }, [blocks, productColumns, pushState]);

  const duplicateBlock = useCallback((id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    const zoneBlocks = blocks.filter(b => b.zone === block.zone);
    const maxOrder = zoneBlocks.reduce((max, b) => Math.max(max, b.order), -1);

    const duplicatedBlock: TemplateBlock = {
      ...block,
      id: generateId(),
      order: maxOrder + 1,
    };

    const newBlocks = [...blocks, duplicatedBlock];
    setBlocks(newBlocks);
    pushState({ blocks: newBlocks, productColumns });
    setSelectedBlock(duplicatedBlock.id);
  }, [blocks, productColumns, pushState]);

  const moveBlockInZone = (id: string, direction: 'up' | 'down') => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    const zoneBlocks = blocks.filter(b => b.zone === block.zone).sort((a, b) => a.order - b.order);
    const idx = zoneBlocks.findIndex(b => b.id === id);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      [zoneBlocks[idx - 1].order, zoneBlocks[idx].order] = [zoneBlocks[idx].order, zoneBlocks[idx - 1].order];
    } else if (direction === 'down' && idx < zoneBlocks.length - 1) {
      [zoneBlocks[idx + 1].order, zoneBlocks[idx].order] = [zoneBlocks[idx].order, zoneBlocks[idx + 1].order];
    }

    const newBlocks = blocks.map(b => {
      const zoneBlock = zoneBlocks.find(zb => zb.id === b.id);
      return zoneBlock ? { ...b, order: zoneBlock.order } : b;
    });

    setBlocks(newBlocks);
    pushState({ blocks: newBlocks, productColumns });
  };

  const updateBlockContent = (id: string, content: string) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, content } : b);
    setBlocks(newBlocks);
    pushState({ blocks: newBlocks, productColumns });
  };

  const updateBlockZone = (id: string, zone: BlockZone) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    const zoneBlocks = blocks.filter(b => b.zone === zone);
    const maxOrder = zoneBlocks.reduce((max, b) => Math.max(max, b.order), -1);

    const newBlocks = blocks.map(b =>
      b.id === id ? { ...b, zone, order: maxOrder + 1 } : b
    );

    setBlocks(newBlocks);
    pushState({ blocks: newBlocks, productColumns });
  };

  const handleSave = useCallback(() => {
    const updatedTemplate: QuotationTemplate = {
      ...template,
      id: template.id || generateId(),
      name: templateName,
      description: templateDescription,
      category: template.category || 'professional',
      themeId,
      blocks,
      productColumns,
      settings: templateSettings,
      updatedAt: new Date().toISOString(),
    };
    onSave(updatedTemplate);
  }, [template, templateName, templateDescription, blocks, productColumns, templateSettings, themeId, onSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          isUndoRedoRef.current = true;
          undo();
        }
        return;
      }

      if ((ctrlKey && e.key === 'y') || (ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        if (canRedo) {
          isUndoRedoRef.current = true;
          redo();
        }
        return;
      }

      if (ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      if (ctrlKey && e.key === 'd' && selectedBlock) {
        e.preventDefault();
        duplicateBlock(selectedBlock);
        return;
      }

      if (ctrlKey && e.key === 'c' && selectedBlock) {
        e.preventDefault();
        const block = blocks.find(b => b.id === selectedBlock);
        if (block) {
          clipboardRef.current = { ...block };
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock && !isInput) {
        e.preventDefault();
        removeBlock(selectedBlock);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedBlock(null);
        setShowAddBlock(false);
        setShowShortcutsHelp(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, selectedBlock, blocks, removeBlock, duplicateBlock, handleSave]);

  const handleZoneClick = (zone: BlockZone) => {
    setSelectedZone(zone);
    setShowAddBlock(true);
  };

  const selectedBlockData = selectedBlock ? blocks.find(b => b.id === selectedBlock) : null;

  return (
    <div className="fixed inset-0 bg-gray-900/90 z-50 flex">
      {/* Left Sidebar - Tools */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-semibold text-lg"
            placeholder="Template Name"
          />
          <textarea
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
            rows={2}
            placeholder="Template description..."
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                isUndoRedoRef.current = true;
                undo();
              }}
              disabled={!canUndo}
              className={`flex-1 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                canUndo
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-200'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" /> Undo
            </button>
            <button
              onClick={() => {
                isUndoRedoRef.current = true;
                redo();
              }}
              disabled={!canRedo}
              className={`flex-1 px-3 py-1.5 rounded-md flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                canRedo
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-200'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" /> Redo
            </button>
            <button
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              className={`px-2 py-1.5 rounded-md text-sm transition-colors ${
                showShortcutsHelp
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>
          {showShortcutsHelp && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">Keyboard Shortcuts</span>
                <button onClick={() => setShowShortcutsHelp(false)} className="p-0.5 hover:bg-gray-200 rounded">
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600">
                <span><kbd className="px-1 bg-gray-200 rounded">Ctrl+Z</kbd> Undo</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Ctrl+D</kbd> Duplicate</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Ctrl+Y</kbd> Redo</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Del</kbd> Delete</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Ctrl+C</kbd> Copy</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Ctrl+S</kbd> Save</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Ctrl+V</kbd> Paste</span>
                <span><kbd className="px-1 bg-gray-200 rounded">Esc</kbd> Unselect</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800 mb-2">Add Custom Block</h3>
          <div className="relative">
            <button
              onClick={() => setShowAddBlock(!showAddBlock)}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Block
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" />
              Table Columns
            </button>
          </div>
          <div className="mt-2">
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`w-full px-3 py-2 rounded-md text-sm flex items-center justify-center gap-2 ${
                showSettingsPanel
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {showSettingsPanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              Template Settings
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Theme</label>
            <select
              value={themeId}
              onChange={(e) => setThemeId(e.target.value as ThemeId)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              {Object.values(INVOICE_THEMES).map(theme => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div className="p-4 bg-gray-50 border-b max-h-64 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-sm">Product Table Columns</h4>
              <button
                onClick={() => {
                  const newColumn: TableColumn = {
                    id: generateId(),
                    key: `custom_${productColumns.length}`,
                    label: 'New Column',
                    width: 15,
                    visible: true,
                    order: productColumns.length,
                  };
                  setProductColumns([...productColumns, newColumn]);
                }}
                className="text-blue-600 text-xs hover:underline"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1">
              {[...productColumns].sort((a, b) => a.order - b.order).map(col => (
                <div key={col.id} className="flex items-center gap-1 bg-white p-1 rounded border text-xs">
                  <GripVertical className="w-3 h-3 text-gray-400 cursor-move" />
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => {
                      const newCols = productColumns.map(c => c.id === col.id ? { ...c, visible: e.target.checked } : c);
                      setProductColumns(newCols);
                    }}
                    className="w-3 h-3"
                  />
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => {
                      const newCols = productColumns.map(c => c.id === col.id ? { ...c, label: e.target.value } : c);
                      setProductColumns(newCols);
                    }}
                    className="flex-1 px-1 py-0.5 border-0 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blocks List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Custom Blocks</h3>
          {blocks.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">
              No custom blocks added yet. Click "Add Block" or click a zone in the preview.
            </div>
          ) : (
            <div className="space-y-1">
              {blocks.sort((a, b) => {
                const zoneOrder: BlockZone[] = ['after_header', 'after_party', 'after_products', 'after_totals', 'after_bank', 'footer'];
                const zoneA = zoneOrder.indexOf(a.zone);
                const zoneB = zoneOrder.indexOf(b.zone);
                if (zoneA !== zoneB) return zoneA - zoneB;
                return a.order - b.order;
              }).map(block => {
                const Icon = BLOCK_ICONS[block.type];
                return (
                  <div
                    key={block.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      selectedBlock === block.id ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedBlock(block.id)}
                  >
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm flex-1 truncate">{BLOCK_LABELS[block.type]}</span>
                    <span className="text-xs text-gray-400">{zoneLabels(block.zone)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 space-y-2">
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Template
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          >
            Close
          </button>
        </div>
      </div>

      {/* Main Canvas Area - Document Renderer */}
      <div className="flex-1 overflow-auto p-8 bg-gray-200 flex items-start justify-center">
        <div
          ref={canvasRef}
          className="bg-white shadow-2xl relative"
          style={{
            width: A4_WIDTH * MM_TO_PX,
            minHeight: A4_HEIGHT * MM_TO_PX,
          }}
        >
          <DocumentRenderer
            themeId={themeId}
            settings={templateSettings}
            company={companyProfile}
            customer={sampleData.customer}
            quotation={sampleData.quotation}
            products={sampleData.products}
            docType="quotation"
            customBlocks={blocks}
            showZones={true}
            onZoneClick={handleZoneClick}
            onBlockClick={(id) => { if (id) setSelectedBlock(id); else setSelectedBlock(null); }}
            selectedBlockId={selectedBlock ?? undefined}
          />
        </div>
      </div>

      {/* Right Sidebar - Block Properties or Settings Panel */}
      {showSettingsPanel ? (
        <div className="w-72 border-l border-gray-200">
          <TemplateSettingsPanel
            settings={templateSettings}
            onChange={setTemplateSettings}
          />
        </div>
      ) : (
        <div className="w-64 bg-white border-l border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Properties</h3>
          {selectedBlockData ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Block Type</label>
                <div className="px-3 py-2 bg-gray-100 rounded text-sm">
                  {BLOCK_LABELS[selectedBlockData.type]}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
                <select
                  value={selectedBlockData.zone}
                  onChange={(e) => updateBlockZone(selectedBlockData.id, e.target.value as BlockZone)}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                >
                  {Object.entries(ZONE_LABELS).map(([zone, label]) => (
                    <option key={zone} value={zone}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => moveBlockInZone(selectedBlockData.id, 'up')}
                  className="flex-1 px-2 py-1.5 border rounded text-sm flex items-center justify-center gap-1 hover:bg-gray-50"
                >
                  <ArrowUp className="w-3 h-3" /> Up
                </button>
                <button
                  onClick={() => moveBlockInZone(selectedBlockData.id, 'down')}
                  className="flex-1 px-2 py-1.5 border rounded text-sm flex items-center justify-center gap-1 hover:bg-gray-50"
                >
                  <ArrowDown className="w-3 h-3" /> Down
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="blockVisible"
                  checked={selectedBlockData.visible}
                  onChange={(e) => {
                    const newBlocks = blocks.map(b =>
                      b.id === selectedBlockData.id ? { ...b, visible: e.target.checked } : b
                    );
                    setBlocks(newBlocks);
                    pushState({ blocks: newBlocks, productColumns });
                  }}
                />
                <label htmlFor="blockVisible" className="text-sm">Visible</label>
              </div>

              {['text_block', 'terms_conditions', 'warranty', 'transport_details', 'delivery_details', 'installation_details', 'footer_notes'].includes(selectedBlockData.type) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
                  <textarea
                    value={selectedBlockData.content || ''}
                    onChange={(e) => updateBlockContent(selectedBlockData.id, e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm resize-none"
                    rows={4}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => duplicateBlock(selectedBlockData.id)}
                  className="flex-1 px-2 py-1.5 border rounded text-sm flex items-center justify-center gap-1 hover:bg-gray-50"
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </button>
                <button
                  onClick={() => removeBlock(selectedBlockData.id)}
                  className="flex-1 px-2 py-1.5 bg-red-50 text-red-600 rounded text-sm flex items-center justify-center gap-1 hover:bg-red-100"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p>Select a block to edit its properties.</p>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Tips:</strong><br />
                  - Click a zone to add blocks<br />
                  - Blocks are rendered in flow layout<br />
                  - Use settings to toggle fixed sections
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Block Modal */}
      {showAddBlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddBlock(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Custom Block</h2>
              <button onClick={() => setShowAddBlock(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[65vh] overflow-y-auto">
              {/* Zone Selection - Grouped by type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Insert Into Zone</label>

                {/* Horizontal Flow Zones */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Full Width Sections</div>
                  <div className="grid grid-cols-2 gap-2">
                    {ZONE_GROUPS.horizontal.map(zone => (
                      <button
                        key={zone}
                        onClick={() => setSelectedZone(zone)}
                        className={`p-2.5 border rounded-lg text-left transition-colors ${
                          selectedZone === zone
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-sm font-medium">{ZONE_LABELS[zone]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split Zones */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Split Columns (Side by Side)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {ZONE_GROUPS.split.map(zone => (
                      <button
                        key={zone}
                        onClick={() => setSelectedZone(zone)}
                        className={`p-2 border rounded-lg text-left transition-colors ${
                          selectedZone === zone
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xs font-medium">{ZONE_LABELS[zone]}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Block Types Grid */}
              {selectedZone && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Select Block Type</label>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Zone: {ZONE_LABELS[selectedZone]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {INSERTABLE_BLOCKS.map(type => {
                      const Icon = BLOCK_ICONS[type];
                      return (
                        <button
                          key={type}
                          onClick={() => addBlock(type, selectedZone)}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{BLOCK_LABELS[type]}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function zoneLabels(zone: BlockZone): string {
  const labels: Record<BlockZone, string> = {
    after_header: '↓ Header',
    after_meta: '↓ Meta',
    after_party: '↓ Party',
    after_products: '↓ Products',
    after_totals: '↓ Totals',
    after_bank: '↓ Bank',
    footer: '↓ Footer',
    party_left: '← Bill To',
    party_right: '→ Ship To',
    bank_left: '← Bank',
    bank_right: '→ Signature',
    footer_left: '← Left',
    footer_center: '● Center',
    footer_right: '→ Right',
    canvas: 'Canvas',
  };
  return labels[zone] || zone;
}
