/*
# Add Invoice Payments Table

## Purpose
Supports the professional Khata Book / Ledger payment tracking system.
Each invoice can have multiple partial payments recorded against it.

## New Tables

### `invoice_payments`
Stores individual payment entries for invoices.
- `id` (text, primary key) — matches the client-generated ID from localStorage
- `invoice_id` (text, not null) — references the invoice (stored in localStorage by its generated ID)
- `date` (date, not null) — the payment date
- `amount` (numeric 12,2) — payment amount received
- `mode` (text) — payment method: cash, upi, bank_transfer, cheque, card, other
- `reference` (text, nullable) — reference number (cheque no, UTR, etc.)
- `notes` (text, nullable) — optional notes
- `created_at` (timestamptz) — record creation timestamp

## Security
- RLS enabled
- No authentication required (single-tenant app, no sign-in screen)
- All policies scoped to `anon, authenticated` so the anon-key frontend can read and write
- Using `USING (true)` because data is intentionally shared / public for this single-tenant app

## Notes
1. This is a single-tenant app — no user_id column needed.
2. invoice_id is text (not uuid FK) because invoices are stored in localStorage with text IDs.
3. The application uses localStorage as primary store; this table provides cloud backup and future cloud sync.
*/

CREATE TABLE IF NOT EXISTS invoice_payments (
  id text PRIMARY KEY,
  invoice_id text NOT NULL,
  date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  mode text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(date);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoice_payments" ON invoice_payments;
CREATE POLICY "anon_select_invoice_payments" ON invoice_payments FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invoice_payments" ON invoice_payments;
CREATE POLICY "anon_insert_invoice_payments" ON invoice_payments FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invoice_payments" ON invoice_payments;
CREATE POLICY "anon_update_invoice_payments" ON invoice_payments FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invoice_payments" ON invoice_payments;
CREATE POLICY "anon_delete_invoice_payments" ON invoice_payments FOR DELETE
TO anon, authenticated USING (true);
