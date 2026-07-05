// ─── Smart Purchase Import Types ─────────────────────────────────────────────

import { ImportFieldKey, SupplierData, ProductCatalogItem } from '../../types';

// ─── Workflow Phases ────────────────────────────────────────────────────────

export type PdfWorkflowPhase =
  | 'upload'        // Step 1: Upload PDF, show preview
  | 'select_table'  // Step 2: Draw rectangle around product table
  | 'map_columns'   // Step 3: Click column headers to map fields
  | 'edit_preview'  // Step 4: Editable product grid preview
  | 'match_products'// Step 5: Match with catalog
  | 'confirm_import';// Step 6: Final import execution

export type ExcelWorkflowPhase =
  | 'upload'        // Step 1: Upload Excel/CSV
  | 'auto_map'      // Step 2: Automatic column mapping (dropdowns)
  | 'match_products'// Step 3: Match with catalog
  | 'confirm_import';// Step 4: Final import execution

// ─── PDF Coordinate Types ─────────────────────────────────────────────────────

export interface PdfCoords {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface TableSelection {
  // Rectangle bounds in PDF coordinate space
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  // Normalized for UI display
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ColumnMapping {
  fieldKey: ImportFieldKey;
  // Header text item the user clicked
  headerText: string;
  // Position in PDF coords
  x: number;
  y: number;
  width: number;
  // Detected column bounds for extraction
  xStart: number;
  xEnd: number;
}

// ─── Extracted Product Row ───────────────────────────────────────────────────

export interface ExtractedProduct {
  id: string;
  // Raw extracted text values
  productName: string;
  quantity: string;
  hsnSac: string;
  unit: string;
  purchaseRate: string;
  gstPercent: string;
  amount: string;
  // Row position for debugging
  yPosition: number;
}

// ─── Matched Product ──────────────────────────────────────────────────────────

export type MatchDecision = 'match_existing' | 'create_new' | 'skip';

export interface MatchedProduct extends ExtractedProduct {
  // Match decision
  decision: MatchDecision;
  // Matched catalog product (if match_existing)
  matchedProductId: string | null;
  matchedProductName: string | null;
  // Resolved product (either matched or new product stub)
  resolvedProduct: ProductCatalogItem | null;
  // Stock tracking
  stockBefore: number;
  stockAfter: number;
  // Validation warnings
  warnings: string[];
}

// ─── Supplier Layout Template ────────────────────────────────────────────────

export interface SupplierLayoutTemplate {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  // Table selection rectangle for reuse
  tableSelection: {
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
  };
  // Column mappings for reuse
  columnMappings: ColumnMapping[];
  // Usage tracking
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
}

// ─── Workflow State ───────────────────────────────────────────────────────────

export interface PdfWorkflowState {
  phase: PdfWorkflowPhase;
  // File data
  file: File | null;
  pdfDoc: any | null;
  pageCount: number;
  currentPage: number;
  zoom: number;
  // Table selection
  tableSelection: TableSelection | null;
  // Column mappings
  columnMappings: ColumnMapping[];
  // Extracted products
  extractedProducts: ExtractedProduct[];
  // Matched/mapped products
  matchedProducts: MatchedProduct[];
  // Import metadata
  supplier: SupplierData | null;
  invoiceNumber: string;
  importDate: string;
  importedBy: string;
  // Saved layout (for auto-apply)
  savedLayout: SupplierLayoutTemplate | null;
  // Errors
  error: string | null;
}

export interface ExcelWorkflowState {
  phase: ExcelWorkflowPhase;
  file: File | null;
  headers: string[];
  rows: Record<string, string>[];
  columnMappings: { sourceColumn: string; fieldKey: ImportFieldKey | null }[];
  matchedProducts: MatchedProduct[];
  supplier: SupplierData | null;
  invoiceNumber: string;
  importDate: string;
  importedBy: string;
  error: string | null;
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface PdfViewerProps {
  file: File;
  currentPage: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onDocumentLoad: (doc: any, pageCount: number) => void;
  children?: React.ReactNode;
}

export interface TableSelectorProps {
  pdfDoc: any;
  currentPage: number;
  zoom: number;
  viewport: { width: number; height: number } | null;
  onSelection: (selection: TableSelection) => void;
  initialSelection?: TableSelection | null;
}

export interface ColumnMapperProps {
  pdfDoc: any;
  currentPage: number;
  zoom: number;
  tableSelection: TableSelection;
  existingMappings: ColumnMapping[];
  onMappingAdd: (mapping: ColumnMapping) => void;
  onMappingRemove: (fieldKey: ImportFieldKey) => void;
  onMappingUpdate: (fieldKey: ImportFieldKey, mapping: ColumnMapping) => void;
}

export interface EditablePreviewProps {
  products: ExtractedProduct[];
  onProductsChange: (products: ExtractedProduct[]) => void;
}

export interface ProductMatcherProps {
  products: ExtractedProduct[];
  catalog: ProductCatalogItem[];
  onMatch: (matchedProducts: MatchedProduct[]) => void;
}

export interface ImportConfirmProps {
  matchedProducts: MatchedProduct[];
  supplier: SupplierData | null;
  invoiceNumber: string;
  importDate: string;
  onConfirm: () => void;
  onBack: () => void;
}
