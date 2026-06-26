import { useState, useRef, useCallback } from 'react';
import {
  QuotationTemplate, TemplateBlock, BlockType, BlockStyle, TableColumn,
  CompanyProfile, Customer, Quotation, Product, A4_WIDTH, A4_HEIGHT
} from '../types';
import { generateId, getDefaultProductColumns, calculateProductAmount, calculateTaxSummary } from '../utils/storage';
import {
  Trash2, Plus, Save, Settings, Type, Image,
  Building2, User, FileText, Calendar, Table, CreditCard, PenTool, FileWarning, Truck,
  ChevronDown, GripVertical, LucideIcon, Square, Minus, MoveVertical, AlignJustify,
  Lock, Unlock, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown
} from 'lucide-react';

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
};

const MM_TO_PX = 3.7795275591; // 1mm = 3.78px at 96 DPI

export function TemplateBuilder({ template, companyProfile, sampleData, onSave, onClose }: Props) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(template.blocks);
  const [productColumns, setProductColumns] = useState<TableColumn[]>(template.productColumns || getDefaultProductColumns());
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState(template.name);
  const [templateDescription, setTemplateDescription] = useState(template.description || '');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [draggingBlock, setDraggingBlock] = useState<string | null>(null);
  const [resizingBlock, setResizingBlock] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [editTextContent, setEditTextContent] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Calculate totals for preview
  const totalAmount = sampleData.products.reduce((sum, p) => sum + calculateProductAmount(p), 0);
  const taxSummary = calculateTaxSummary(sampleData.products);
  const totalCgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0);
  const totalSgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0);
  const grandTotal = totalAmount + totalCgst + totalSgst;

  const handleMouseDown = useCallback((e: React.MouseEvent, blockId: string) => {
    if ((e.target as HTMLElement).closest('.resize-handle') || editingText) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    if (block.locked) {
      setSelectedBlock(blockId);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragOffset.current = {
      x: e.clientX - (rect.left + block.x * MM_TO_PX),
      y: e.clientY - (rect.top + block.y * MM_TO_PX),
    };

    setDraggingBlock(blockId);
    setSelectedBlock(blockId);
  }, [blocks, editingText]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingBlock && !resizingBlock) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (draggingBlock) {
      const newX = Math.max(0, Math.min(A4_WIDTH - 20, (e.clientX - rect.left - dragOffset.current.x) / MM_TO_PX));
      const newY = Math.max(0, Math.min(A4_HEIGHT - 20, (e.clientY - rect.top - dragOffset.current.y) / MM_TO_PX));

      setBlocks(prev => prev.map(b =>
        b.id === draggingBlock ? { ...b, x: Math.round(newX), y: Math.round(newY) } : b
      ));
    }

    if (resizingBlock) {
      const block = blocks.find(b => b.id === resizingBlock);
      if (!block) return;

      const newWidth = Math.max(20, (e.clientX - rect.left) / MM_TO_PX - block.x);
      const newHeight = Math.max(10, (e.clientY - rect.top) / MM_TO_PX - block.y);

      setBlocks(prev => prev.map(b =>
        b.id === resizingBlock
          ? { ...b, width: Math.round(Math.min(190, newWidth)), height: Math.round(Math.min(280, newHeight)) }
          : b
      ));
    }
  }, [draggingBlock, resizingBlock, blocks]);

  const handleMouseUp = useCallback(() => {
    setDraggingBlock(null);
    setResizingBlock(null);
  }, []);

  const addBlock = (type: BlockType) => {
    const maxZ = blocks.reduce((max, b) => Math.max(max, b.zIndex || 0), 0);
    const defaults: Record<string, { width: number; height: number; content?: string; style?: BlockStyle }> = {
      product_table: { width: 190, height: 60 },
      text_block: { width: 80, height: 20, content: 'Double-click to edit' },
      rectangle: { width: 60, height: 40, style: { filled: false, borderWidth: 1, borderColor: '#000000', backgroundColor: '#ffffff', borderRadius: 0 } },
      horizontal_line: { width: 100, height: 2, style: { thickness: 1, color: '#000000' } },
      vertical_line: { width: 2, height: 60, style: { thickness: 1, color: '#000000' } },
      divider: { width: 190, height: 4, style: { thickness: 1, color: '#cccccc' } },
    };
    const d = defaults[type] || { width: 60, height: 30 };
    const newBlock: TemplateBlock = {
      id: generateId(),
      type,
      x: 50,
      y: 50,
      width: d.width,
      height: d.height,
      visible: true,
      content: d.content,
      style: d.style,
      zIndex: maxZ + 1,
    };
    setBlocks([...blocks, newBlock]);
    setShowAddBlock(false);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    setSelectedBlock(null);
  };

  const updateBlockContent = (id: string, content: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
    setEditingText(null);
  };

  const addColumn = () => {
    const newColumn: TableColumn = {
      id: generateId(),
      key: `custom_${productColumns.length}`,
      label: 'New Column',
      width: 15,
      visible: true,
      order: productColumns.length,
    };
    setProductColumns([...productColumns, newColumn]);
  };

  const updateColumn = (id: string, field: keyof TableColumn, value: string | number | boolean) => {
    setProductColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeColumn = (id: string) => {
    setProductColumns(productColumns.filter(c => c.id !== id));
  };

  const moveColumn = (id: string, direction: 'up' | 'down') => {
    const sorted = [...productColumns].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(c => c.id === id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [sorted[index - 1].order, sorted[index].order] = [sorted[index].order, sorted[index - 1].order];
    } else if (direction === 'down' && index < sorted.length - 1) {
      [sorted[index + 1].order, sorted[index].order] = [sorted[index].order, sorted[index + 1].order];
    }
    setProductColumns(sorted);
  };

  const handleSave = () => {
    const updatedTemplate: QuotationTemplate = {
      ...template,
      id: template.id || generateId(),
      name: templateName,
      description: templateDescription,
      blocks,
      productColumns,
      updatedAt: new Date().toISOString(),
    };
    onSave(updatedTemplate);
  };

  const startTextEdit = (block: TemplateBlock) => {
    setEditingText(block.id);
    setEditTextContent(block.content || '');
  };

  const renderBlockContent = (block: TemplateBlock) => {
    const { type, content } = block;

    switch (type) {
      case 'company_logo':
        return companyProfile.logo ? (
          <img src={companyProfile.logo} alt="Logo" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">
            <Image className="w-8 h-8 text-gray-300" />
          </div>
        );

      case 'company_details':
        return (
          <div className="text-sm">
            <div className="font-bold text-lg">{companyProfile.companyName || '{{company_name}}'}</div>
            {companyProfile.gstNumber && <div className="text-xs font-medium">GSTIN: {companyProfile.gstNumber}</div>}
            {companyProfile.address && <div className="text-xs">{companyProfile.address}</div>}
            <div className="text-xs">{companyProfile.phone} {companyProfile.email}</div>
          </div>
        );

      case 'customer_details':
        return (
          <div className="text-sm">
            <div className="font-semibold mb-1">Bill To:</div>
            <div className="font-medium">{sampleData.customer.name || '{{customer_name}}'}</div>
            {sampleData.customer.billingAddress && <div className="text-xs">{sampleData.customer.billingAddress}</div>}
            <div className="text-xs">{sampleData.customer.village} {sampleData.customer.district}</div>
            {sampleData.customer.mobile && <div className="text-xs">Mobile: {sampleData.customer.mobile}</div>}
          </div>
        );

      case 'ship_to_details':
        return (
          <div className="text-sm">
            <div className="font-semibold mb-1">Ship To:</div>
            <div className="font-medium">{sampleData.quotation.shipTo?.name || '{{ship_name}}'}</div>
            {sampleData.quotation.shipTo?.address && <div className="text-xs">{sampleData.quotation.shipTo.address}</div>}
            {sampleData.quotation.shipTo?.mobile && <div className="text-xs">Mobile: {sampleData.quotation.shipTo.mobile}</div>}
          </div>
        );

      case 'quotation_number':
        return (
          <div className="text-sm font-semibold">
            Quotation No: {sampleData.quotation.quotationNumber || '{{quotation_no}}'}
          </div>
        );

      case 'quotation_date':
        return (
          <div className="text-sm">
            Date: {sampleData.quotation.date || '{{date}}'}
          </div>
        );

      case 'product_table': {
        const visibleColumns = productColumns.filter(c => c.visible).sort((a, b) => a.order - b.order);
        return (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {visibleColumns.map(col => (
                  <th key={col.id} className="border border-gray-300 px-1 py-0.5 text-left">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleData.products.slice(0, 3).map((p, i) => (
                <tr key={i}>
                  {visibleColumns.map(col => (
                    <td key={col.id} className="border border-gray-300 px-1 py-0.5">
                      {col.key === 'sno' ? i + 1 :
                       col.key === 'name' ? p.name :
                       col.key === 'hsnCode' ? p.hsnCode :
                       col.key === 'gstPercent' ? `${p.gstPercent}%` :
                       col.key === 'quantity' ? p.quantity :
                       col.key === 'unitPrice' ? p.unitPrice.toLocaleString() :
                       col.key === 'amount' ? calculateProductAmount(p).toLocaleString() : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      case 'gst_summary':
        return (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-1">HSN</th>
                <th className="border border-gray-300 px-1">Taxable</th>
                <th className="border border-gray-300 px-1">CGST</th>
                <th className="border border-gray-300 px-1">SGST</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(calculateTaxSummary(sampleData.products).entries()).slice(0, 2).map(([key, data]) => (
                <tr key={key}>
                  <td className="border border-gray-300 px-1">{key.split('_')[0]}</td>
                  <td className="border border-gray-300 px-1">{data.taxableAmount.toFixed(0)}</td>
                  <td className="border border-gray-300 px-1">{data.cgstAmount.toFixed(0)}</td>
                  <td className="border border-gray-300 px-1">{data.sgstAmount.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'bank_details':
        return (
          <div className="text-xs">
            <div className="font-semibold mb-1">Bank Details:</div>
            <div>{companyProfile.bankName || 'Bank Name'}</div>
            <div>A/c: {companyProfile.bankAccount} | IFSC: {companyProfile.bankIfsc}</div>
          </div>
        );

      case 'signature_box':
        return companyProfile.signature ? (
          <img src={companyProfile.signature} alt="Signature" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col justify-end">
            <div className="border-t border-gray-400 pt-1 text-center text-xs">Authorized Sign</div>
          </div>
        );

      case 'terms_conditions':
        return (
          <div className="text-xs">
            <div className="font-semibold mb-1">Terms & Conditions:</div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Quotation valid for 30 days</li>
              <li>50% advance, balance before delivery</li>
            </ol>
          </div>
        );

      case 'footer_notes':
        return <div className="text-xs text-center text-gray-600">Thank you for your business!</div>;

      case 'totals':
        return (
          <div className="text-xs text-right">
            <div>Total: Rs. {totalAmount.toLocaleString()}</div>
            <div>CGST: Rs. {totalCgst.toLocaleString()}</div>
            <div>SGST: Rs. {totalSgst.toLocaleString()}</div>
            <div className="font-bold border-t mt-1 pt-1">Grand Total: Rs. {grandTotal.toLocaleString()}</div>
          </div>
        );

      case 'text_block':
        return editingText === block.id ? (
          <textarea
            autoFocus
            value={editTextContent}
            onChange={(e) => setEditTextContent(e.target.value)}
            onBlur={() => updateBlockContent(block.id, editTextContent)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                updateBlockContent(block.id, editTextContent);
              }
            }}
            className="w-full h-full text-xs p-1 bg-yellow-50 resize-none outline-none"
          />
        ) : (
          <div
            className="text-xs p-1 hover:bg-yellow-50 cursor-text h-full"
            onDoubleClick={() => startTextEdit(block)}
          >
            {content || 'Double-click to edit'}
          </div>
        );

      case 'rectangle': {
        const s = block.style || {};
        return (
          <div
            className="w-full h-full pointer-events-none"
            style={{
              border: s.filled ? 'none' : `${s.borderWidth || 1}px solid ${s.borderColor || '#000000'}`,
              backgroundColor: s.filled ? (s.backgroundColor || '#ffffff') : 'transparent',
              borderRadius: `${s.borderRadius || 0}px`,
            }}
          />
        );
      }

      case 'horizontal_line':
        return (
          <div
            className="w-full pointer-events-none flex items-center"
            style={{ height: '100%' }}
          >
            <div
              style={{
                width: '100%',
                height: `${block.style?.thickness || 1}px`,
                backgroundColor: block.style?.color || '#000000',
              }}
            />
          </div>
        );

      case 'vertical_line':
        return (
          <div
            className="h-full pointer-events-none flex items-center justify-center"
            style={{ width: '100%' }}
          >
            <div
              style={{
                height: '100%',
                width: `${block.style?.thickness || 1}px`,
                backgroundColor: block.style?.color || '#000000',
              }}
            />
          </div>
        );

      case 'divider':
        return (
          <div className="w-full h-full pointer-events-none flex items-center">
            <div style={{ width: '100%', height: `${block.style?.thickness || 1}px`, backgroundColor: block.style?.color || '#cccccc' }} />
          </div>
        );

      default:
        return null;
    }
  };

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
        </div>

        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800 mb-2">Add Blocks</h3>
          <div className="relative">
            <button
              onClick={() => setShowAddBlock(!showAddBlock)}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Block
              <ChevronDown className="w-4 h-4" />
            </button>
            {showAddBlock && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                {(Object.keys(BLOCK_LABELS) as BlockType[]).map(type => {
                  const Icon = BLOCK_ICONS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => addBlock(type)}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                    >
                      <Icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{BLOCK_LABELS[type]}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
        </div>

        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div className="p-4 bg-gray-50 border-b max-h-64 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-sm">Product Table Columns</h4>
              <button onClick={addColumn} className="text-blue-600 text-xs hover:underline">+ Add</button>
            </div>
            <div className="space-y-1">
              {[...productColumns].sort((a, b) => a.order - b.order).map(col => (
                <div key={col.id} className="flex items-center gap-1 bg-white p-1 rounded border text-xs">
                  <GripVertical className="w-3 h-3 text-gray-400 cursor-move" />
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => updateColumn(col.id, 'visible', e.target.checked)}
                    className="w-3 h-3"
                  />
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(col.id, 'label', e.target.value)}
                    className="flex-1 px-1 py-0.5 border-0 text-xs"
                  />
                  <input
                    type="number"
                    value={col.width}
                    onChange={(e) => updateColumn(col.id, 'width', Number(e.target.value))}
                    className="w-10 px-1 py-0.5 border rounded text-xs"
                    title="Width %"
                  />
                  <button onClick={() => moveColumn(col.id, 'up')} className="p-0.5 hover:bg-gray-100" title="Move Up">↑</button>
                  <button onClick={() => moveColumn(col.id, 'down')} className="p-0.5 hover:bg-gray-100" title="Move Down">↓</button>
                  <button onClick={() => removeColumn(col.id)} className="p-0.5 text-red-500 hover:bg-red-50" title="Delete">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blocks List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Blocks</h3>
          <div className="space-y-1">
            {blocks.map(block => {
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
                  {!block.visible && <span className="text-xs text-gray-400">hidden</span>}
                </div>
              );
            })}
          </div>
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

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-8 bg-gray-200 flex items-start justify-center">
        <div
          ref={containerRef}
          className="bg-white shadow-2xl relative"
          style={{
            width: A4_WIDTH * MM_TO_PX,
            height: A4_HEIGHT * MM_TO_PX,
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* A4 Grid Lines (subtle) */}
          <div className="absolute inset-0 pointer-events-none opacity-10">
            {[...Array(22)].map((_, i) => (
              <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-gray-400" style={{ left: i * 10 * MM_TO_PX }} />
            ))}
            {[...Array(30)].map((_, i) => (
              <div key={`h${i}`} className="absolute left-0 right-0 border-t border-gray-400" style={{ top: i * 10 * MM_TO_PX }} />
            ))}
          </div>

          {/* Blocks */}
          {blocks.filter(b => b.visible).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(block => (
            <div
              key={block.id}
              className={`absolute ${block.locked ? 'cursor-default' : 'cursor-move'} overflow-hidden ${
                selectedBlock === block.id ? 'ring-2 ring-blue-500' : ''
              } ${draggingBlock === block.id ? 'opacity-80' : ''}`}
              style={{
                left: block.x * MM_TO_PX,
                top: block.y * MM_TO_PX,
                width: block.width * MM_TO_PX,
                height: block.height * MM_TO_PX,
              }}
              onMouseDown={(e) => handleMouseDown(e, block.id)}
            >
              {renderBlockContent(block)}

              {/* Lock indicator */}
              {block.locked && (
                <div className="absolute top-0 right-0 p-0.5 bg-amber-100 rounded-bl">
                  <Lock className="w-3 h-3 text-amber-600" />
                </div>
              )}

              {/* Resize Handle */}
              {!block.locked && (
                <div
                  className="resize-handle absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize opacity-0 hover:opacity-100"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingBlock(block.id);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-64 bg-white border-l border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-4">Properties</h3>
        {selectedBlock ? (
          <>
            {(() => {
              const block = blocks.find(b => b.id === selectedBlock);
              if (!block) return null;

              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Block Type</label>
                    <div className="px-3 py-2 bg-gray-100 rounded text-sm">{BLOCK_LABELS[block.type]}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">X (mm)</label>
                      <input
                        type="number"
                        value={block.x}
                        onChange={(e) => setBlocks(prev => prev.map(b =>
                          b.id === selectedBlock ? { ...b, x: Number(e.target.value) } : b
                        ))}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Y (mm)</label>
                      <input
                        type="number"
                        value={block.y}
                        onChange={(e) => setBlocks(prev => prev.map(b =>
                          b.id === selectedBlock ? { ...b, y: Number(e.target.value) } : b
                        ))}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Width (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={block.width}
                        onChange={(e) => setBlocks(prev => prev.map(b =>
                          b.id === selectedBlock ? { ...b, width: Number(e.target.value) } : b
                        ))}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Height (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="280"
                        value={block.height}
                        onChange={(e) => setBlocks(prev => prev.map(b =>
                          b.id === selectedBlock ? { ...b, height: Number(e.target.value) } : b
                        ))}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="visible"
                      checked={block.visible}
                      onChange={(e) => setBlocks(prev => prev.map(b =>
                        b.id === selectedBlock ? { ...b, visible: e.target.checked } : b
                      ))}
                    />
                    <label htmlFor="visible" className="text-sm">Visible</label>
                  </div>

                  {(block.type === 'text_block' || block.type === 'footer_notes' || block.type === 'terms_conditions') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
                      <textarea
                        value={block.content || ''}
                        onChange={(e) => setBlocks(prev => prev.map(b =>
                          b.id === selectedBlock ? { ...b, content: e.target.value } : b
                        ))}
                        className="w-full px-2 py-1 border rounded text-sm resize-none"
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Rectangle properties */}
                  {block.type === 'rectangle' && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-semibold text-gray-700">Rectangle Style</h4>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={block.style?.filled || false}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, filled: e.target.checked } } : b
                          ))}
                        />
                        Filled background
                      </label>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Border thickness (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={block.style?.borderWidth ?? 1}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, borderWidth: Number(e.target.value) } } : b
                          ))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Border color</label>
                        <input
                          type="color"
                          value={block.style?.borderColor || '#000000'}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, borderColor: e.target.value } } : b
                          ))}
                          className="w-full h-8 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Background color</label>
                        <input
                          type="color"
                          value={block.style?.backgroundColor || '#ffffff'}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, backgroundColor: e.target.value } } : b
                          ))}
                          className="w-full h-8 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Corner radius (px)</label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={block.style?.borderRadius ?? 0}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, borderRadius: Number(e.target.value) } } : b
                          ))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Line properties */}
                  {(block.type === 'horizontal_line' || block.type === 'vertical_line' || block.type === 'divider') && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-semibold text-gray-700">Line Style</h4>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Thickness (px)</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={block.style?.thickness ?? 1}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, thickness: Number(e.target.value) } } : b
                          ))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Color</label>
                        <input
                          type="color"
                          value={block.style?.color || '#000000'}
                          onChange={(e) => setBlocks(prev => prev.map(b =>
                            b.id === selectedBlock ? { ...b, style: { ...b.style, color: e.target.value } } : b
                          ))}
                          className="w-full h-8 border rounded"
                        />
                      </div>
                    </div>
                  )}

                  {/* Lock / Unlock */}
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <button
                      onClick={() => setBlocks(prev => prev.map(b =>
                        b.id === selectedBlock ? { ...b, locked: !b.locked } : b
                      ))}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors"
                      style={{
                        backgroundColor: block.locked ? '#fef3c7' : '#f3f4f6',
                        color: block.locked ? '#92400e' : '#374151',
                      }}
                    >
                      {block.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      {block.locked ? 'Locked' : 'Unlocked'}
                    </button>
                    <span className="text-xs text-gray-500">
                      {block.locked ? 'Cannot drag accidentally' : 'Free to drag'}
                    </span>
                  </div>

                  {/* Layer Controls */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Layer Order</label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setBlocks(prev => {
                          const sorted = [...prev].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
                          const idx = sorted.findIndex(b => b.id === selectedBlock);
                          if (idx < sorted.length - 1) {
                            [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
                            return sorted.map((b, i) => ({ ...b, zIndex: i }));
                          }
                          return prev;
                        })}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        <ArrowUp className="w-3 h-3" /> Forward
                      </button>
                      <button
                        onClick={() => setBlocks(prev => {
                          const sorted = [...prev].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
                          const idx = sorted.findIndex(b => b.id === selectedBlock);
                          if (idx > 0) {
                            [sorted[idx], sorted[idx - 1]] = [sorted[idx - 1], sorted[idx]];
                            return sorted.map((b, i) => ({ ...b, zIndex: i }));
                          }
                          return prev;
                        })}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        <ArrowDown className="w-3 h-3" /> Backward
                      </button>
                      <button
                        onClick={() => setBlocks(prev => {
                          const maxZ = prev.reduce((max, b) => Math.max(max, b.zIndex || 0), 0);
                          return prev.map(b => b.id === selectedBlock ? { ...b, zIndex: maxZ + 1 } : b);
                        })}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        <ChevronsUp className="w-3 h-3" /> To Front
                      </button>
                      <button
                        onClick={() => setBlocks(prev => {
                          const minZ = prev.reduce((min, b) => Math.min(min, b.zIndex || 0), 0);
                          return prev.map(b => b.id === selectedBlock ? { ...b, zIndex: minZ - 1 } : b);
                        })}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        <ChevronsDown className="w-3 h-3" /> To Back
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => removeBlock(selectedBlock)}
                    className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-md flex items-center justify-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Block
                  </button>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="text-sm text-gray-500">
            Select a block to edit its properties.
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Tips:</strong><br />
                - Drag blocks to reposition<br />
                - Resize from corner handle<br />
                - Double-click text blocks to edit<br />
                - Use placeholders: {'{{customer_name}}'}, {'{{quotation_no}}'}, etc.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
