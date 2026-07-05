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
  SupplierPdfLayout,
  MatchDecision,
  StockMovementRecord,
  PurchaseHistoryEntry,
  UnitType,
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
  Save,
} from 'lucide-react';
import { FieldMappingStep } from './import/FieldMappingStep';
import { ProductMatchingStep } from './import/ProductMatchingStep';
import { ImportPreviewStep } from './import/ImportPreviewStep';
import { ImportLogView } from './import/ImportLogView';
import { ConfidenceScoreDisplay } from './import/ConfidenceScoreDisplay';
import { ImportValidationSummary } from './import/ImportValidationSummary';
import { DocumentMetadataPreview } from './import/DocumentMetadataPreview';
import {
  InteractivePdfMapping,
  InteractivePdfMappingResult,
} from './import/InteractivePdfMapping';

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
  const [saveTemplateAfterImport, setSaveTemplateAfterImport] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showInteractiveMapping, setShowInteractiveMapping] = useState<boolean>(false);
  const [savedPdfLayout, setSavedPdfLayout] = useState<SupplierPdfLayout | null>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId]
  );

  // ─── Step 1: Upload ──────────────────────────────────────────────────────
  // PDF and Excel/CSV follow different workflows:
  //   - PDF: parser extracts metadata only, then opens Interactive PDF Mapping
  //     for visual column selection. No dropdown mapping.
  //   - Excel/CSV: automatic parser extracts rows, dropdown mapping applies.
  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setParseError('');
    setUploadedFile(file);
    try {
      const result = await parseFile(file);
      setParseResult(result);

      // Check for scanned PDF
      if (result.metadata?.isScanned) {
        setParseError('Scanned PDFs are not supported yet. Please upload a text-based PDF or Excel file.');
        return;
      }

      // Auto-fill metadata from detected document (both flows use this)
      if (result.metadata) {
        if (result.metadata.invoiceNumber) {
          setInvoiceNumber(result.metadata.invoiceNumber);
        }
        if (result.metadata.supplierName) {
          const matchedSupplier = suppliers.find(s =>
            s.firmName.toLowerCase().includes(result.metadata!.supplierName!.toLowerCase()) ||
            result.metadata!.supplierName!.toLowerCase().includes(s.firmName.toLowerCase())
          );
          if (matchedSupplier) {
            setSelectedSupplierId(matchedSupplier.id);
          }
        }
      }

      // ─── PDF workflow: detect metadata, then user opens Interactive PDF Mapping ──
      // We don't auto-open the mapper here — the user may want to select a
      // supplier first (which enables saved-layout auto-apply). They click
      // "Open Visual Mapper" on the upload step to proceed.
      if (result.format === 'pdf') {
        // Try to find a saved layout for this supplier (by supplierId or GSTIN)
        let savedLayout: SupplierPdfLayout | null = null;
        if (selectedSupplierId) {
          savedLayout = storage.getSupplierPdfLayoutBySupplierId(selectedSupplierId) || null;
        }
        if (!savedLayout && result.metadata?.supplierGstin) {
          savedLayout = storage.getSupplierPdfLayoutByGstin(result.metadata.supplierGstin) || null;
        }
        setSavedPdfLayout(savedLayout);
        return;
      }

      // ─── Excel/CSV workflow: automatic parsing + dropdown mapping ─────────
      if (result.rows.length === 0) {
        setParseError(result.warnings.join(' ') || 'No data rows found in the file.');
        return;
      }

      const suggested = suggestMappings(result.headers);
      setMappings(suggested);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to read file.');
    } finally {
      setParsing(false);
    }
  }, [suppliers, selectedSupplierId]);

  const applySupplierTemplate = useCallback(
    (supplierId: string) => {
      if (!supplierId || !parseResult) return;
      const template = storage.getSupplierImportTemplateBySupplierId(supplierId);
      if (!template) return;

      // Update template usage stats
      const updatedTemplate = {
        ...template,
        useCount: (template.useCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      };
      storage.saveSupplierImportTemplate(updatedTemplate);

      // Only carry over mappings whose source column still exists
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
    // For PDFs, load any saved visual layout for this supplier
    if (supplierId && parseResult?.format === 'pdf') {
      const layout = storage.getSupplierPdfLayoutBySupplierId(supplierId);
      setSavedPdfLayout(layout || null);
    }
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

    // Create stock snapshot for tracking
    const stockSnapshot = new Map<string, number>();
    catalog.forEach(p => stockSnapshot.set(p.id, p.stockQuantity));

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

      // Pre-resolve the product
      let resolvedProduct: ProductCatalogItem | null = null;
      let stockBefore = 0;

      if (decision === 'match_existing' && top) {
        resolvedProduct = { ...top.product };
        stockBefore = stockSnapshot.get(top.product.id) || 0;
      } else {
        const now = new Date().toISOString();
        resolvedProduct = {
          id: generateId(),
          name: productName || `Imported Product ${idx + 1}`,
          category: 'Imported',
          unit: ((get('unit') as string) || 'piece') as UnitType,
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
        stockBefore = 0;
      }

      return {
        id: `${Date.now()}-${idx}`,
        rowIndex: idx + 1,
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
        unit: (get('unit') as string) || undefined,
        serialNumber: (get('serialNumber') as string) || undefined,
        discount: (get('discount') as number) || undefined,
        candidates,
        selectedCandidateId: top && top.level !== 'none' ? top.product.id : null,
        decision,
        resolvedProduct,
        warnings,
        stockBefore,
        stockAfter: stockBefore + quantity,
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

        // Get current stock for before/after tracking
        const currentStock = selectedCandidateId
          ? catalog.find(p => p.id === selectedCandidateId)?.stockQuantity || 0
          : 0;

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
            unit: (r.unit || 'piece') as UnitType,
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

        return {
          ...r,
          decision,
          selectedCandidateId,
          resolvedProduct,
          stockBefore: decision === 'match_existing' && selectedCandidateId ? currentStock : 0,
          stockAfter: decision === 'match_existing' && selectedCandidateId ? currentStock + r.quantity : r.quantity,
        };
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
    console.log('[SmartPurchaseImport] Products Passed to Preview:', previewRows);
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
    console.log('[SmartPurchaseImport] Products Passed to Confirm Import:', committedRows);

    const now = new Date().toISOString();
    const supplierName = selectedSupplier?.firmName;
    const invNumber = invoiceNumber || committedRows[0]?.supplierInvoiceNumber || '';

    // Build the new catalog: update matched products, add new products.
    const catalogMap = new Map<string, ProductCatalogItem>(catalog.map((p) => [p.id, { ...p }]));
    const newProducts: ProductCatalogItem[] = [];
    const errors: string[] = [];
    let totalValue = 0;

    // Stock movements and purchase history for audit
    const stockMovements: StockMovementRecord[] = [];
    const purchaseHistory: PurchaseHistoryEntry[] = [];

    for (const row of committedRows) {
      const product = row.resolvedProduct!;
      const rowValue = row.quantity * row.purchasePrice;
      totalValue += rowValue;

      if (row.decision === 'match_existing' && catalogMap.has(product.id)) {
        const existing = catalogMap.get(product.id)!;

        // Update product with all tracking fields
        const updated: ProductCatalogItem = {
          ...existing,
          stockQuantity: existing.stockQuantity + row.quantity,
          purchasePrice: row.purchasePrice || existing.purchasePrice,
          // Refresh batch/expiry only when the import provides them
          ...(row.batch ? { batchNumber: row.batch } : {}),
          ...(row.expiry ? { expiryDate: row.expiry } : {}),
          // Update tracking fields
          updatedAt: now,
        };
        catalogMap.set(existing.id, updated);

        // Record stock movement
        stockMovements.push({
          date: importDate,
          supplierId: selectedSupplier?.id,
          supplierName,
          invoiceNumber: invNumber,
          productId: product.id,
          productName: product.name,
          purchaseQty: row.quantity,
          purchasePrice: row.purchasePrice,
          stockBefore: existing.stockQuantity,
          stockAfter: existing.stockQuantity + row.quantity,
          user: importedBy,
          importSource: parseResult.format,
        });

        // Record purchase history
        purchaseHistory.push({
          id: generateId(),
          productId: product.id,
          supplierId: selectedSupplier?.id,
          supplierName,
          invoiceNumber: invNumber,
          invoiceDate: parseResult.metadata?.invoiceDate || importDate,
          purchasePrice: row.purchasePrice,
          quantityPurchased: row.quantity,
          gstPercent: row.gstPercent,
          batch: row.batch,
          expiry: row.expiry,
          importedBy,
          importTime: now,
          importSource: parseResult.format,
        });
      } else if (row.decision === 'create_new') {
        const newProduct: ProductCatalogItem = {
          ...product,
          stockQuantity: row.quantity,
          createdAt: now,
          updatedAt: now,
        };
        catalogMap.set(newProduct.id, newProduct);
        newProducts.push(newProduct);

        // Record stock movement for new product
        stockMovements.push({
          date: importDate,
          supplierId: selectedSupplier?.id,
          supplierName,
          invoiceNumber: invNumber,
          productId: newProduct.id,
          productName: newProduct.name,
          purchaseQty: row.quantity,
          purchasePrice: row.purchasePrice,
          stockBefore: 0,
          stockAfter: row.quantity,
          user: importedBy,
          importSource: parseResult.format,
        });

        // Record purchase history
        purchaseHistory.push({
          id: generateId(),
          productId: newProduct.id,
          supplierId: selectedSupplier?.id,
          supplierName,
          invoiceNumber: invNumber,
          invoiceDate: parseResult.metadata?.invoiceDate || importDate,
          purchasePrice: row.purchasePrice,
          quantityPurchased: row.quantity,
          gstPercent: row.gstPercent,
          batch: row.batch,
          expiry: row.expiry,
          importedBy,
          importTime: now,
          importSource: parseResult.format,
        });
      }
    }

    const updatedCatalog = Array.from(catalogMap.values());

    // Persist catalog + supplier ledger locally.
    storage.saveProductCatalog(updatedCatalog);
    onCatalogChange(updatedCatalog);

    // Save purchase history to storage
    purchaseHistory.forEach(entry => {
      storage.savePurchaseHistory(entry);
    });

    // Save stock movements to storage
    stockMovements.forEach(movement => {
      storage.saveStockMovement(movement);
    });

    // If a supplier is selected and the import created a purchase, record a supplier transaction
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

    // Save supplier template if requested
    if (saveTemplateAfterImport && selectedSupplier) {
      saveSupplierTemplateInternal();
    }

    // Write to Supabase for audit trail
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

    // Build the import log entry
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
      confidence: parseResult.confidence,
      metadata: parseResult.metadata,
      rows: committedRows.map((r) => ({
        productName: r.importedProductName,
        matchedProductId: r.decision === 'match_existing' ? r.resolvedProduct?.id : undefined,
        matchedProductName: r.decision === 'match_existing' ? r.resolvedProduct?.name : undefined,
        quantity: r.quantity,
        purchasePrice: r.purchasePrice,
        gstPercent: r.gstPercent,
        decision: r.decision,
        stockBefore: r.stockBefore,
        stockAfter: r.stockAfter,
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
        console.warn('Supabase import log write failed:', e);
      }
    }

    setImportLog(logEntry);
    setStep('done');
  };

  // ─── Save supplier template ─────────────────────────────────────────────
  const saveSupplierTemplateInternal = () => {
    if (!selectedSupplier) return;

    const existing = storage.getSupplierImportTemplateBySupplierId(selectedSupplier.id);
    const template: SupplierImportTemplate = {
      id: existing?.id || generateId(),
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.firmName,
      supplierGstin: selectedSupplier.gstNumber,
      mappings,
      columnPositions: parseResult?.headers.map((_, i) => i),
      originalHeaders: parseResult?.headers,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useCount: (existing?.useCount || 0) + 1,
      lastUsedAt: new Date().toISOString(),
    };
    storage.saveSupplierImportTemplate(template);
  };

  const saveSupplierTemplate = () => {
    saveSupplierTemplateInternal();
    alert(`Mapping saved for ${selectedSupplier?.firmName}. Future imports from this supplier will auto-apply this mapping.`);
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
    setSaveTemplateAfterImport(false);
    setUploadedFile(null);
    setShowInteractiveMapping(false);
    setSavedPdfLayout(null);
  };

  // ─── Apply interactive PDF mapping result ─────────────────────────────────
  // Takes the visually-extracted product rows + metadata from the Interactive
  // PDF Mapping modal, saves the supplier layout (if requested), builds
  // ImportPreviewRow[] for the matching step, and advances the flow.
  const applyInteractivePdfResult = (result: InteractivePdfMappingResult) => {
    console.log('[SmartPurchaseImport] Visual Mapping Completed', result);
    if (!parseResult) {
      setShowInteractiveMapping(false);
      return;
    }

    // Update metadata from the interactive mapper
    if (result.metadataValues.invoiceNumber) {
      setInvoiceNumber(result.metadataValues.invoiceNumber);
    }
    if (result.metadataValues.invoiceDate) {
      setImportDate(result.metadataValues.invoiceDate || new Date().toISOString().split('T')[0]);
    }
    if (result.metadataValues.supplierName) {
      const matchedSupplier = suppliers.find(s =>
        s.firmName.toLowerCase().includes(result.metadataValues.supplierName!.toLowerCase()) ||
        result.metadataValues.supplierName!.toLowerCase().includes(s.firmName.toLowerCase())
      );
      if (matchedSupplier) {
        setSelectedSupplierId(matchedSupplier.id);
      }
    }
    if (parseResult.metadata) {
      const updatedMeta = { ...parseResult.metadata };
      if (result.metadataValues.invoiceNumber) updatedMeta.invoiceNumber = result.metadataValues.invoiceNumber;
      if (result.metadataValues.invoiceDate) updatedMeta.invoiceDate = result.metadataValues.invoiceDate;
      if (result.metadataValues.supplierName) updatedMeta.supplierName = result.metadataValues.supplierName;
      if (result.metadataValues.supplierGstin) updatedMeta.supplierGstin = result.metadataValues.supplierGstin;
      if (result.metadataValues.invoiceTotal) updatedMeta.invoiceTotal = result.metadataValues.invoiceTotal;
      setParseResult((prev) => (prev ? { ...prev, metadata: updatedMeta } : prev));
    }

    // Note: supplier PDF layout saving (with column coordinates) is handled
    // inside InteractivePdfMapping before calling onApply, since the detected
    // column coordinates are only available there.

    // Filter out rows with no product name — these are footer/junk rows that
    // slipped through column detection. They must not become fake products.
    const validProductRows = result.productRows.filter(
      (pr) => pr.productName && pr.productName.trim() !== ''
    );
    console.log('[SmartPurchaseImport] Products Extracted from Visual Mapping:', validProductRows);

    const stockSnapshot = new Map<string, number>();
    catalog.forEach(p => stockSnapshot.set(p.id, p.stockQuantity));

    const rows: ImportPreviewRow[] = validProductRows.map((pr, idx) => {
      const productName = pr.productName || '';
      const quantity = parseFloat(pr.quantity) || 0;
      const purchasePrice = parseFloat(pr.purchasePrice) || 0;
      const gstPercent = parseFloat(pr.gstPercent) || 0;

      const warnings: string[] = [];
      if (!productName) warnings.push('Missing product name.');
      if (quantity <= 0) warnings.push('Quantity is zero or missing.');
      if (purchasePrice <= 0) warnings.push('Purchase price is zero or missing.');

      const candidates = findMatchCandidates(productName, catalog);
      const top = bestCandidate(productName, catalog);
      const decision: MatchDecision = top && top.level !== 'none' ? 'match_existing' : 'create_new';

      let resolvedProduct: ProductCatalogItem | null = null;
      let stockBefore = 0;

      if (decision === 'match_existing' && top) {
        resolvedProduct = { ...top.product };
        stockBefore = stockSnapshot.get(top.product.id) || 0;
      } else {
        const now = new Date().toISOString();
        resolvedProduct = {
          id: generateId(),
          name: productName || `Imported Product ${idx + 1}`,
          category: 'Imported',
          unit: (pr.unit || 'piece') as UnitType,
          purchasePrice,
          sellingPrice: purchasePrice,
          gstPercent,
          hsnSacCode: pr.hsnSac || '',
          stockQuantity: 0,
          createdAt: now,
          updatedAt: now,
        };
        stockBefore = 0;
      }

      return {
        id: `${Date.now()}-${idx}`,
        rowIndex: idx + 1,
        importedProductName: productName,
        quantity,
        purchasePrice,
        gstPercent,
        hsnSac: pr.hsnSac || undefined,
        unit: pr.unit || undefined,
        amount: parseFloat(pr.amount) || undefined,
        candidates,
        selectedCandidateId: top && top.level !== 'none' ? top.product.id : null,
        decision,
        resolvedProduct,
        warnings,
        stockBefore,
        stockAfter: stockBefore + quantity,
      };
    });

    setPreviewRows(rows);
    console.log('[SmartPurchaseImport] Products Stored in workflow state:', rows);
    console.log('[SmartPurchaseImport] Products Passed to Match Products:', rows);
    setShowInteractiveMapping(false);
    setStep('matching');
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // Build validation summary for preview step
  const existingProductsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    catalog.forEach(p => map.set(p.id, true));
    return map;
  }, [catalog]);

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
          onNext={() => {
            // PDFs open the Interactive PDF Mapper; Excel/CSV go to dropdown mapping
            if (parseResult?.format === 'pdf') {
              setShowInteractiveMapping(true);
            } else {
              setStep('mapping');
            }
          }}
          canProceed={!!parseResult && !parseResult.metadata?.isScanned && (parseResult.format === 'pdf' || parseResult.rows.length > 0)}
        />
      )}

      {/* Dropdown mapping step — Excel/CSV only. PDFs use Interactive PDF Mapping. */}
      {step === 'mapping' && parseResult && parseResult.format !== 'pdf' && (
        <div className="space-y-4">
          {/* Confidence Score Display */}
          <ConfidenceScoreDisplay
            score={parseResult.confidence}
            issues={parseResult.confidenceIssues}
          />

          {/* Document Metadata Preview */}
          {parseResult.metadata && (
            <DocumentMetadataPreview
              metadata={parseResult.metadata}
              fileName={parseResult.fileName}
              format={parseResult.format}
            />
          )}

          <FieldMappingStep
            parseResult={parseResult}
            mappings={mappings}
            setMappings={setMappings}
            selectedSupplier={selectedSupplier}
            onSaveTemplate={saveSupplierTemplate}
            onBack={() => setStep('upload')}
            onNext={goToMatching}
          />
        </div>
      )}

      {step === 'matching' && (
        <div className="space-y-4">
          <ImportValidationSummary
            rows={previewRows}
            existingProducts={existingProductsMap}
          />
          <ProductMatchingStep
            rows={previewRows}
            onUpdateDecision={updateRowDecision}
            onUpdateField={updateRowField}
            onBack={() => setStep('mapping')}
            onNext={goToPreview}
          />
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          {/* Save template checkbox */}
          {selectedSupplier && (
            <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={saveTemplateAfterImport}
                onChange={(e) => setSaveTemplateAfterImport(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <Save className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700">
                Save this supplier layout for future imports from {selectedSupplier.firmName}
              </span>
            </label>
          )}
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
        </div>
      )}

      {step === 'done' && importLog && (
        <ImportDoneView log={importLog} onNewImport={resetAll} onViewHistory={() => setShowLogView(true)} />
      )}

      {showLogView && <ImportLogView onClose={() => setShowLogView(false)} />}

      {showInteractiveMapping && uploadedFile && parseResult && (
        <InteractivePdfMapping
          file={uploadedFile}
          initialMetadata={parseResult.metadata}
          suppliers={suppliers}
          selectedSupplierId={selectedSupplierId}
          onSelectSupplier={handleSupplierChange}
          savedLayout={savedPdfLayout}
          onApply={applyInteractivePdfResult}
          onCancel={() => setShowInteractiveMapping(false)}
        />
      )}
    </div>
  );
}

// ─── Upload step ─────────────────────────────────────────────────────────────

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
          Drag and drop a file, or click to browse. Supported formats: CSV, Excel (.xlsx), text-based PDF.
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
              <p className="text-sm text-slate-600">Reading file...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Drop file here or click to upload</p>
              <p className="text-xs text-slate-400">CSV, Excel, or text-based PDF (no scanned PDFs)</p>
            </div>
          )}
        </label>

        {parseError && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{parseError}</p>
          </div>
        )}

        {/* Excel/CSV success: rows extracted */}
        {parseResult && parseResult.format !== 'pdf' && parseResult.rows.length > 0 && !parseResult.metadata?.isScanned && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">
                Extracted {parseResult.rows.length} rows, {parseResult.headers.length} columns
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              {parseResult.format === 'xlsx' ? (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
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

        {/* PDF success: metadata detected, visual mapping next */}
        {parseResult && parseResult.format === 'pdf' && !parseResult.metadata?.isScanned && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">
                PDF ready for visual mapping
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <FileIcon className="w-3.5 h-3.5" />
              <span>{parseResult.fileName}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                {parseResult.metadata?.pageCount || 1} page{(parseResult.metadata?.pageCount || 1) > 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Click <strong>Continue to Mapping</strong> to open the visual PDF mapper and teach the product columns.
            </p>
          </div>
        )}

        {/* Document metadata preview */}
        {parseResult?.metadata && !parseResult.metadata.isScanned && (
          <div className="mt-4">
            <DocumentMetadataPreview
              metadata={parseResult.metadata}
              fileName={parseResult.fileName}
              format={parseResult.format}
            />
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
              <option value="">- Select supplier (optional) -</option>
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
          {parseResult?.format === 'pdf' ? 'Open Visual Mapper' : 'Continue to Mapping'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Done view ──────────────────────────────────────────────────────────────

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
        {log.confidence !== undefined && (
          <p className="text-sm text-slate-500 mt-1">
            Import confidence: <strong>{log.confidence}%</strong>
          </p>
        )}
        {log.errors.length > 0 && (
          <div className="mt-3 p-3 bg-white/60 rounded-lg border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 mb-1">Errors ({log.errors.length}):</p>
            <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
              {log.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {log.errors.length > 5 && <li>... and {log.errors.length - 5} more</li>}
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
