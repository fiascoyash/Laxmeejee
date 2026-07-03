import { useState, useMemo, useCallback } from 'react';
import {
  ProductCatalogItem,
  SupplierData,
  ParseResult,
  FieldMapping,
  ImportPreviewRow,
  ImportLogEntry,
  ImportFieldKey,
  SupplierImportTemplate,
  MatchDecision,
} from '../types';
import { IMPORT_FIELD_DEFINITIONS } from '../types';
import { storage, generateId } from '../utils/storage';
import { parseFile, suggestMappings, coerceValue } from '../utils/importParsers';
import { findMatchCandidates, bestCandidate } from '../utils/importMatching';
import { createClient } from '@supabase/supabase-js';
import {
  Upload,
  FileText,
  ArrowRight,
  Check,
  AlertTriangle,
  Search,
  Link2,
  ClipboardCheck,
  History,
  FileSpreadsheet,
  File as FileIcon,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { FieldMappingStep } from './import/FieldMappingStep';
import { ProductMatchingStep } from './import/ProductMatchingStep';
import { ImportPreviewStep } from './import/ImportPreviewStep';
import { ImportLogView } from './import/ImportLogView';

type Step = 'upload' | 'mapping' | 'matching' | 'preview' | 'done';

const STEPS: { key: Step; label: string; icon: typeof Upload }[] = [
  { key: 'upload', label: 'Upload Bill', icon: Upload },
  { key: 'mapping', label: 'Map Fields', icon: Link2 },
  { key: 'matching', label: 'Match Products', icon: Search },
  { key: 'preview', label: 'Preview & Import', icon: ClipboardCheck },
  { key: 'done', label: 'Import Log', icon: History },
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface Props {
  catalog: ProductCatalogItem[];
  suppliers: SupplierData[];
  onCatalogChange: (catalog: ProductCatalogItem[]) => void;
  onSuppliersChange: (suppliers: SupplierData[]) => void;
}

export function SmartPurchaseImport({ catalog, suppliers, onCatalogChange, onSuppliersChange }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [importDate, setImportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [importedBy, setImportedBy] = useState<string>('Admin');
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importLog, setImportLog] = useState<ImportLogEntry | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [showLogView, setShowLogView] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);
  const [forceImport, setForceImport] = useState<boolean>(false);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId]
  );

  // ─── Step 1: Upload ──────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setParseError('');
    try {
      const result = await parseFile(file);
      setParseResult(result);
      if (result.rows.length === 0) {
        setParseError(result.warnings.join(' ') || 'No data rows found in the file.');
        return;
      }
      // Auto-suggest mappings, then apply any saved supplier template.
      const suggested = suggestMappings(result.headers);
      setMappings(suggested);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to read file.');
    } finally {
      setParsing(false);
    }
  }, []);

  const applySupplierTemplate = useCallback(
    (supplierId: string) => {
      if (!supplierId || !parseResult) return;
      const template = storage.getSupplierImportTemplateBySupplierId(supplierId);
      if (!template) return;
      // Only carry over mappings whose source column still exists in the
      // current file — suppliers sometimes rename columns between bills.
      const headerSet = new Set(parseResult.headers);
      const merged: FieldMapping[] = parseResult.headers.map((h) => {
        const fromTemplate = template.mappings.find((m) => m.sourceColumn === h);
        return fromTemplate && headerSet.has(fromTemplate.sourceColumn)
          ? { ...fromTemplate }
          : { sourceColumn: h, fieldKey: null };
      });
      setMappings(merged);
    },
    [parseResult]
  );

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    if (supplierId) applySupplierTemplate(supplierId);
  };

  // ─── Step 2: Field mapping → build preview rows ──────────────────────────
  const goToMatching = () => {
    if (!parseResult) return;
    // Validate required fields.
    const mappedKeys = new Set(mappings.filter((m) => m.fieldKey).map((m) => m.fieldKey));
    const missingRequired = IMPORT_FIELD_DEFINITIONS.filter((f) => f.required && !mappedKeys.has(f.key));
    if (missingRequired.length > 0) {
      alert(`Please map the required fields: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }

    // Build typed preview rows from the raw rows using the mapping.
    const fieldByKey = new Map<ImportFieldKey, string>();
    for (const m of mappings) {
      if (m.fieldKey) fieldByKey.set(m.fieldKey, m.sourceColumn);
    }

    const rows: ImportPreviewRow[] = parseResult.rows.map((raw, idx) => {
      const get = (key: ImportFieldKey): string | number | null => {
        const col = fieldByKey.get(key);
        if (!col) return null;
        const def = IMPORT_FIELD_DEFINITIONS.find((f) => f.key === key)!;
        return coerceValue(raw[col], def.type);
      };
      const productName = (get('productName') as string) || '';
      const quantity = (get('quantity') as number) ?? 0;
      const purchasePrice = (get('purchasePrice') as number) ?? 0;

      const warnings: string[] = [];
      if (!productName) warnings.push('Missing product name.');
      if (quantity <= 0) warnings.push('Quantity is zero or missing.');
      if (purchasePrice <= 0) warnings.push('Purchase price is zero or missing.');

      const candidates = findMatchCandidates(productName, catalog);
      const top = bestCandidate(productName, catalog);
      const decision: MatchDecision = top && top.level !== 'none' ? 'match_existing' : 'create_new';

      // Pre-resolve the product: either the matched candidate or a draft new
      // product built from the imported values.
      let resolvedProduct: ProductCatalogItem | null = null;
      if (decision === 'match_existing' && top) {
        resolvedProduct = { ...top.product };
      } else {
        const now = new Date().toISOString();
        resolvedProduct = {
          id: generateId(),
          name: productName || `Imported Product ${idx + 1}`,
          category: 'Imported',
          unit: 'piece',
          purchasePrice,
          sellingPrice: (get('mrp') as number) || purchasePrice,
          gstPercent: (get('gstPercent') as number) || 0,
          hsnSacCode: (get('hsnSac') as string) || '',
          stockQuantity: 0,
          batchNumber: (get('batch') as string) || undefined,
          expiryDate: (get('expiry') as string) || undefined,
          createdAt: now,
          updatedAt: now,
        };
      }

      return {
        id: `${Date.now()}-${idx}`,
        importedProductName: productName,
        importedDescription: (get('description') as string) || undefined,
        quantity,
        purchasePrice,
        gstPercent: (get('gstPercent') as number) || 0,
        hsnSac: (get('hsnSac') as string) || undefined,
        batch: (get('batch') as string) || undefined,
        expiry: (get('expiry') as string) || undefined,
        mrp: (get('mrp') as number) || undefined,
        amount: (get('amount') as number) || undefined,
        supplierInvoiceNumber: (get('supplierInvoiceNumber') as string) || undefined,
        candidates,
        selectedCandidateId: top && top.level !== 'none' ? top.product.id : null,
        decision,
        resolvedProduct,
        warnings,
      };
    });

    setPreviewRows(rows);
    setStep('matching');
  };

  // ─── Step 3: Product matching updates ────────────────────────────────────
  const updateRowDecision = (rowId: string, decision: MatchDecision, selectedCandidateId: string | null) => {
    setPreviewRows((rows) =>
      rows.map((r) => {
        if (r.id !== rowId) return r;
        let resolvedProduct: ProductCatalogItem | null = null;
        if (decision === 'match_existing' && selectedCandidateId) {
          const candidate = r.candidates.find((c) => c.product.id === selectedCandidateId);
          if (candidate) {
            resolvedProduct = { ...candidate.product };
          }
        } else if (decision === 'create_new') {
          const now = new Date().toISOString();
          resolvedProduct = {
            id: generateId(),
            name: r.importedProductName || 'Imported Product',
            category: 'Imported',
            unit: 'piece',
            purchasePrice: r.purchasePrice,
            sellingPrice: r.mrp || r.purchasePrice,
            gstPercent: r.gstPercent,
            hsnSacCode: r.hsnSac || '',
            stockQuantity: 0,
            batchNumber: r.batch,
            expiryDate: r.expiry,
            createdAt: now,
            updatedAt: now,
          };
        }
        return { ...r, decision, selectedCandidateId, resolvedProduct };
      })
    );
  };

  const updateRowField = (rowId: string, field: keyof ImportPreviewRow, value: string | number | undefined) => {
    setPreviewRows((rows) =>
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        // Keep resolved new-product in sync when editable fields change.
        if (r.decision === 'create_new' && r.resolvedProduct) {
          updated.resolvedProduct = {
            ...r.resolvedProduct,
            name: updated.importedProductName || r.resolvedProduct.name,
            purchasePrice: updated.purchasePrice,
            gstPercent: updated.gstPercent,
            hsnSacCode: updated.hsnSac || '',
            batchNumber: updated.batch,
            expiryDate: updated.expiry,
            sellingPrice: updated.mrp || updated.purchasePrice || r.resolvedProduct.sellingPrice,
          };
        }
        return updated;
      })
    );
  };

  // ─── Step 4: Preview → Confirm Import ────────────────────────────────────
  // This is the ONLY place inventory is mutated. Nothing before this point
  // touches the catalog, stock, or history tables.
  const checkDuplicate = useCallback((): boolean => {
    const supplierName = selectedSupplier?.firmName;
    const inv = invoiceNumber || previewRows[0]?.supplierInvoiceNumber;
    if (!supplierName || !inv) return false;
    return storage.isInvoiceAlreadyImported(supplierName, inv);
  }, [selectedSupplier, invoiceNumber, previewRows]);

  const goToPreview = () => {
    const invalid = previewRows.filter((r) => r.decision !== 'skip' && (!r.resolvedProduct || r.quantity <= 0));
    if (invalid.length > 0) {
      if (!confirm(`${invalid.length} row(s) have unresolved products or invalid quantities. They will be skipped on import. Continue?`)) {
        return;
      }
    }
    setDuplicateWarning(checkDuplicate());
    setForceImport(false);
    setStep('preview');
  };

  const confirmImport = async () => {
    if (!parseResult) return;
    if (duplicateWarning && !forceImport) {
      alert('Please confirm the duplicate invoice warning to proceed.');
      return;
    }

    const committedRows = previewRows.filter((r) => r.decision !== 'skip' && r.resolvedProduct && r.quantity > 0);
    if (committedRows.length === 0) {
      alert('No rows to import. All rows are skipped or invalid.');
      return;
    }

    const now = new Date().toISOString();
    const supplierName = selectedSupplier?.firmName;
    const invNumber = invoiceNumber || committedRows[0]?.supplierInvoiceNumber || '';

    // Build the new catalog: update matched products, add new products.
    const catalogMap = new Map<string, ProductCatalogItem>(catalog.map((p) => [p.id, { ...p }]));
    const newProducts: ProductCatalogItem[] = [];
    const errors: string[] = [];
    let totalValue = 0;

    for (const row of committedRows) {
      const product = row.resolvedProduct!;
      if (row.decision === 'match_existing' && catalogMap.has(product.id)) {
        const existing = catalogMap.get(product.id)!;
        // Update stock and purchase-related fields WITHOUT touching selling
        // price logic, GST calc, or any other existing field. We only touch
        // stock + purchase metadata, per the strict no-touch rule.
        const updated: ProductCatalogItem = {
          ...existing,
          stockQuantity: existing.stockQuantity + row.quantity,
          purchasePrice: row.purchasePrice || existing.purchasePrice,
          // Refresh batch/expiry only when the import provides them; never
          // overwrite existing values with blanks.
          ...(row.batch ? { batchNumber: row.batch } : {}),
          ...(row.expiry ? { expiryDate: row.expiry } : {}),
          updatedAt: now,
        };
        catalogMap.set(existing.id, updated);
      } else if (row.decision === 'create_new') {
        const newProduct: ProductCatalogItem = {
          ...product,
          stockQuantity: row.quantity,
          createdAt: now,
          updatedAt: now,
        };
        catalogMap.set(newProduct.id, newProduct);
        newProducts.push(newProduct);
      }
      totalValue += row.quantity * row.purchasePrice;
    }

    const updatedCatalog = Array.from(catalogMap.values());

    // Persist catalog + supplier ledger locally.
    storage.saveProductCatalog(updatedCatalog);
    onCatalogChange(updatedCatalog);

    // If a supplier is selected and the import created a purchase, record a
    // supplier transaction so the supplier ledger reflects the purchase.
    if (selectedSupplier && totalValue > 0) {
      const txns = storage.getSupplierTransactions();
      const opening = selectedSupplier.openingBalanceType === 'to_pay' ? selectedSupplier.openingBalance : -selectedSupplier.openingBalance;
      const priorBalance = txns
        .filter((t) => t.supplierId === selectedSupplier.id)
        .reduce((sum, t) => sum + (t.purchaseAmount - t.paymentMade), opening);
      const newTxn = {
        id: generateId(),
        supplierId: selectedSupplier.id,
        date: importDate,
        type: 'purchase_entry' as const,
        referenceNumber: invNumber || undefined,
        description: `Purchase import: ${parseResult.fileName}`,
        purchaseAmount: totalValue,
        paymentMade: 0,
        runningBalance: priorBalance + totalValue,
        notes: `Smart Import: ${committedRows.length} products`,
        createdAt: now,
      };
      storage.saveSupplierTransaction(newTxn);
      onSuppliersChange(storage.getSuppliers());
    }

    // Save supplier template if requested (handled in FieldMappingStep via a
    // callback that writes to storage directly).

    // Write purchase history + stock movements to Supabase for each committed
    // row. These mirror the existing AddExistingStockModal flow so the new
    // module reuses the same audit tables.
    if (supabase) {
      for (const row of committedRows) {
        const product = row.resolvedProduct!;
        const balanceAfter = updatedCatalog.find((p) => p.id === product.id)?.stockQuantity ?? row.quantity;
        try {
          await supabase.from('product_purchases').insert({
            product_id: product.id,
            supplier_name: supplierName || null,
            quantity: row.quantity,
            purchase_price: row.purchasePrice,
            purchase_date: importDate,
            notes: `Smart Import: ${parseResult.fileName}${invNumber ? ` (Inv: ${invNumber})` : ''}`,
          });
        } catch (e) {
          errors.push(`Purchase history failed for ${product.name}: ${(e as Error).message}`);
        }
        try {
          await supabase.from('product_stock_movements').insert({
            product_id: product.id,
            movement_type: 'purchase',
            quantity_change: row.quantity,
            balance_after: balanceAfter,
            reference_type: 'purchase',
            reference_id: invNumber || null,
            notes: `Smart Import: ${parseResult.fileName}`,
          });
        } catch (e) {
          errors.push(`Stock movement failed for ${product.name}: ${(e as Error).message}`);
        }
      }
    }

    // Build the import log entry (Step 11) — stored both locally and in
    // Supabase for a durable audit trail.
    const logEntry: ImportLogEntry = {
      id: generateId(),
      importDate: now,
      importedBy: importedBy || 'Admin',
      fileName: parseResult.fileName,
      format: parseResult.format,
      supplierId: selectedSupplier?.id,
      supplierName,
      invoiceNumber: invNumber,
      productsImported: committedRows.length,
      totalValue,
      status: errors.length === 0 ? 'success' : errors.length === committedRows.length ? 'failed' : 'partial',
      errors,
      rows: committedRows.map((r) => ({
        productName: r.importedProductName,
        matchedProductId: r.decision === 'match_existing' ? r.resolvedProduct?.id : undefined,
        matchedProductName: r.decision === 'match_existing' ? r.resolvedProduct?.name : undefined,
        quantity: r.quantity,
        purchasePrice: r.purchasePrice,
        gstPercent: r.gstPercent,
        decision: r.decision,
      })),
    };
    storage.saveImportLog(logEntry);
    if (supabase) {
      try {
        await supabase.from('purchase_import_logs').insert({
          id: logEntry.id,
          import_date: logEntry.importDate,
          imported_by: logEntry.importedBy,
          file_name: logEntry.fileName,
          format: logEntry.format,
          supplier_id: logEntry.supplierId || null,
          supplier_name: logEntry.supplierName || null,
          invoice_number: logEntry.invoiceNumber || null,
          products_imported: logEntry.productsImported,
          total_value: logEntry.totalValue,
          status: logEntry.status,
          errors: logEntry.errors,
          rows: logEntry.rows,
        });
      } catch (e) {
        // Local log already saved — Supabase failure is non-fatal.
        console.warn('Supabase import log write failed:', e);
      }
    }

    setImportLog(logEntry);
    setStep('done');
  };

  // ─── Save supplier template (Step 5) ─────────────────────────────────────
  const saveSupplierTemplate = () => {
    if (!selectedSupplier) {
      alert('Select a supplier to save the mapping template.');
      return;
    }
    const existing = storage.getSupplierImportTemplateBySupplierId(selectedSupplier.id);
    const template: SupplierImportTemplate = {
      id: existing?.id || generateId(),
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.firmName,
      mappings,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveSupplierImportTemplate(template);
    alert(`Mapping saved for ${selectedSupplier.firmName}. Future imports from this supplier will auto-apply this mapping.`);
  };

  // ─── Reset ───────────────────────────────────────────────────────────────
  const resetAll = () => {
    setStep('upload');
    setParseResult(null);
    setMappings([]);
    setSelectedSupplierId('');
    setInvoiceNumber('');
    setImportDate(new Date().toISOString().split('T')[0]);
    setPreviewRows([]);
    setImportLog(null);
    setParseError('');
    setDuplicateWarning(false);
    setForceImport(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-600" />
            Smart Purchase Import
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload a supplier bill, map columns, match products, and update inventory in one flow.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLogView(true)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Import History
          </button>
          {step !== 'upload' && (
            <button
              onClick={resetAll}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              New Import
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isComplete = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      isComplete
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-600'
                        : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                    }`}
                  >
                    {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-xs font-medium whitespace-nowrap ${
                      isCurrent ? 'text-emerald-700' : isComplete ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      idx < currentStepIndex ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {step === 'upload' && (
        <UploadStep
          parsing={parsing}
          parseError={parseError}
          parseResult={parseResult}
          onFile={handleFile}
          suppliers={suppliers}
          selectedSupplierId={selectedSupplierId}
          onSupplierChange={handleSupplierChange}
          invoiceNumber={invoiceNumber}
          setInvoiceNumber={setInvoiceNumber}
          importDate={importDate}
          setImportDate={setImportDate}
          importedBy={importedBy}
          setImportedBy={setImportedBy}
          onNext={() => setStep('mapping')}
          canProceed={!!parseResult && parseResult.rows.length > 0}
        />
      )}

      {step === 'mapping' && parseResult && (
        <FieldMappingStep
          parseResult={parseResult}
          mappings={mappings}
          setMappings={setMappings}
          selectedSupplier={selectedSupplier}
          onSaveTemplate={saveSupplierTemplate}
          onBack={() => setStep('upload')}
          onNext={goToMatching}
        />
      )}

      {step === 'matching' && (
        <ProductMatchingStep
          rows={previewRows}
          onUpdateDecision={updateRowDecision}
          onUpdateField={updateRowField}
          onBack={() => setStep('mapping')}
          onNext={goToPreview}
        />
      )}

      {step === 'preview' && (
        <ImportPreviewStep
          rows={previewRows}
          selectedSupplier={selectedSupplier}
          invoiceNumber={invoiceNumber || previewRows[0]?.supplierInvoiceNumber || ''}
          importDate={importDate}
          duplicateWarning={duplicateWarning}
          forceImport={forceImport}
          setForceImport={setForceImport}
          onBack={() => setStep('matching')}
          onConfirm={confirmImport}
        />
      )}

      {step === 'done' && importLog && (
        <ImportDoneView log={importLog} onNewImport={resetAll} onViewHistory={() => setShowLogView(true)} />
      )}

      {showLogView && <ImportLogView onClose={() => setShowLogView(false)} />}
    </div>
  );
}

// ─── Upload step (kept in this file because it's small) ─────────────────────

function UploadStep({
  parsing,
  parseError,
  parseResult,
  onFile,
  suppliers,
  selectedSupplierId,
  onSupplierChange,
  invoiceNumber,
  setInvoiceNumber,
  importDate,
  setImportDate,
  importedBy,
  setImportedBy,
  onNext,
  canProceed,
}: {
  parsing: boolean;
  parseError: string;
  parseResult: ParseResult | null;
  onFile: (file: File) => void;
  suppliers: SupplierData[];
  selectedSupplierId: string;
  onSupplierChange: (id: string) => void;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  importDate: string;
  setImportDate: (v: string) => void;
  importedBy: string;
  setImportedBy: (v: string) => void;
  onNext: () => void;
  canProceed: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-1">Upload Supplier Bill</h3>
        <p className="text-sm text-slate-500 mb-4">
          Drag and drop a file, or click to browse. Supported formats: CSV, Excel (.xlsx), PDF.
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-600">Reading file…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Drop file here or click to upload</p>
              <p className="text-xs text-slate-400">CSV, Excel, or PDF</p>
            </div>
          )}
        </label>

        {parseError && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{parseError}</p>
          </div>
        )}

        {parseResult && parseResult.rows.length > 0 && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">
                Extracted {parseResult.rows.length} rows, {parseResult.headers.length} columns
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              {parseResult.format === 'pdf' ? <FileIcon className="w-3.5 h-3.5" /> : parseResult.format === 'xlsx' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
              <span>{parseResult.fileName}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                Confidence: {parseResult.confidence}%
              </span>
            </div>
            {parseResult.warnings.length > 0 && (
              <ul className="mt-2 text-xs text-amber-700 list-disc list-inside space-y-0.5">
                {parseResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Import metadata */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">Import Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">— Select supplier (optional) —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firmName}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Selecting a supplier with a saved template auto-applies its column mapping.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Invoice Number</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2025-0042"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Import Date</label>
            <input
              type="date"
              value={importDate}
              onChange={(e) => setImportDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Imported By</label>
            <input
              type="text"
              value={importedBy}
              onChange={(e) => setImportedBy(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Mapping
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Done view (kept in this file because it's small) ──────────────────────

function ImportDoneView({
  log,
  onNewImport,
  onViewHistory,
}: {
  log: ImportLogEntry;
  onNewImport: () => void;
  onViewHistory: () => void;
}) {
  const isSuccess = log.status === 'success';
  const isPartial = log.status === 'partial';
  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-6 ${
          isSuccess
            ? 'bg-emerald-50 border-emerald-200'
            : isPartial
            ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          {isSuccess ? (
            <Check className="w-6 h-6 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          )}
          <h3 className="text-lg font-bold text-slate-800">
            {isSuccess ? 'Import Complete' : isPartial ? 'Import Complete with Warnings' : 'Import Failed'}
          </h3>
        </div>
        <p className="text-sm text-slate-600">
          {log.productsImported} product(s) imported from <strong>{log.fileName}</strong>
          {log.supplierName ? ` for ${log.supplierName}` : ''}.
        </p>
        <p className="text-sm text-slate-600 mt-1">
          Total purchase value: <strong>Rs. {log.totalValue.toLocaleString()}</strong>
        </p>
        {log.errors.length > 0 && (
          <div className="mt-3 p-3 bg-white/60 rounded-lg border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-1">Errors ({log.errors.length}):</p>
            <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
              {log.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {log.errors.length > 5 && <li>… and {log.errors.length - 5} more</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onViewHistory}
          className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <History className="w-4 h-4" />
          View Import History
        </button>
        <button
          onClick={onNewImport}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          New Import
        </button>
      </div>
    </div>
  );
}
