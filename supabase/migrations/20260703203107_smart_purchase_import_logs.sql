/*
# Smart Purchase Import Engine — Import Audit Log

1. Purpose
   Adds a durable audit-trail table for the new Smart Purchase Import module.
   Every time a user confirms a purchase import, a row is written here so the
   business has a permanent, queryable record of what was imported, by whom,
   from which file, and for which supplier invoice.

   This module is purely additive. No existing table is modified, renamed, or
   dropped. The existing `product_purchases` and `product_stock_movements`
   tables continue to be used as-is for per-product purchase history and stock
   movement audit (Steps 9 and 10 of the spec). This new table records the
   import-level event (Step 11).

2. New Tables
   - `purchase_import_logs`
     - id (uuid, primary key)
     - import_date (timestamptz, when the import was confirmed)
     - imported_by (text, free-text user label — app has no auth)
     - file_name (text, original uploaded file name)
     - format (text, 'csv' | 'xlsx' | 'pdf')
     - supplier_id (text, optional, links to supplier in localStorage)
     - supplier_name (text, optional, denormalized for readability)
     - invoice_number (text, optional, supplier bill number)
     - products_imported (integer, count of rows committed)
     - total_value (numeric, sum of line amounts)
     - status (text, 'success' | 'partial' | 'failed')
     - errors (jsonb, array of error strings)
     - rows (jsonb, snapshot of committed rows for audit)
     - created_at (timestamptz)

3. Indexes
   - `idx_purchase_import_logs_date` on import_date DESC (recent-first listing)
   - `idx_purchase_import_logs_supplier` on supplier_id (per-supplier history)
   - `idx_purchase_import_logs_invoice` on invoice_number (duplicate detection)

4. Security
   - Enable RLS on `purchase_import_logs`.
   - Single-tenant, no-auth app: allow anon + authenticated CRUD so the
     anon-key frontend can read and write its own audit trail. This matches
     the existing `product_purchases` / `product_stock_movements` policy style.

5. Notes
   - No foreign keys to `product_purchases` or `product_stock_movements`:
     those tables reference localStorage product IDs (text), and the import
     log is an event record, not a per-product ledger. The `rows` jsonb
     column carries the per-product snapshot for audit purposes.
   - Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS so re-running
     is safe even after a timeout.
*/

CREATE TABLE IF NOT EXISTS purchase_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_date timestamptz NOT NULL DEFAULT now(),
  imported_by text,
  file_name text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv', 'xlsx', 'pdf')),
  supplier_id text,
  supplier_name text,
  invoice_number text,
  products_imported integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_import_logs_date ON purchase_import_logs (import_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_import_logs_supplier ON purchase_import_logs (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_import_logs_invoice ON purchase_import_logs (invoice_number);

ALTER TABLE purchase_import_logs ENABLE ROW LEVEL SECURITY;

-- Policies (single-tenant, anon + authenticated CRUD)
DROP POLICY IF EXISTS "anon_select_purchase_import_logs" ON purchase_import_logs;
CREATE POLICY "anon_select_purchase_import_logs" ON purchase_import_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_purchase_import_logs" ON purchase_import_logs;
CREATE POLICY "anon_insert_purchase_import_logs" ON purchase_import_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_purchase_import_logs" ON purchase_import_logs;
CREATE POLICY "anon_update_purchase_import_logs" ON purchase_import_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_purchase_import_logs" ON purchase_import_logs;
CREATE POLICY "anon_delete_purchase_import_logs" ON purchase_import_logs FOR DELETE
  TO anon, authenticated USING (true);