// ─── Smart Purchase Import Module ─────────────────────────────────────────────
// Complete rewrite with modular architecture:
//   - PDF workflow: Visual table selection + column mapping
//   - Excel/CSV workflow: Automatic column detection

export { SmartPurchaseImport } from './SmartPurchaseImport';
export type {
  PdfWorkflowPhase,
  ExcelWorkflowPhase,
  TableSelection,
  ColumnMapping,
  ExtractedProduct,
  MatchedProduct,
  SupplierLayoutTemplate,
} from './types';
export {
  extractProductsFromSelection,
  extractTextFromPdf,
} from './extractionEngine';
