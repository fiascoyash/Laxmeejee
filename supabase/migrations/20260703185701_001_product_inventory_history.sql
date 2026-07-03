/*
# Product Inventory History Tables

1. New Tables
- `product_purchases` - Records each purchase/stock addition
  - id (uuid, primary key)
  - product_id (text, references product catalog)
  - supplier_name (text)
  - quantity (integer, quantity added)
  - purchase_price (numeric, price per unit)
  - total_value (numeric, computed: quantity * purchase_price)
  - purchase_date (date)
  - notes (text, optional)
  - created_at (timestamp)

- `product_stock_movements` - Records all stock changes
  - id (uuid, primary key)
  - product_id (text, references product catalog)
  - movement_type (text: 'purchase', 'sale', 'adjustment', 'return')
  - quantity_change (integer, positive for additions, negative for deductions)
  - balance_after (integer, stock quantity after the movement)
  - reference_type (text, optional: 'purchase', 'invoice', 'manual')
  - reference_id (text, optional: link to purchase/invoice)
  - notes (text, optional)
  - created_at (timestamp)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS product_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  supplier_name text,
  quantity integer NOT NULL,
  purchase_price numeric NOT NULL,
  total_value numeric GENERATED ALWAYS AS (quantity * purchase_price) STORED,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return')),
  quantity_change integer NOT NULL,
  balance_after integer NOT NULL,
  reference_type text,
  reference_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON product_purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON product_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON product_stock_movements(created_at DESC);

-- Enable RLS
ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies for product_purchases (single-tenant, anon access)
DROP POLICY IF EXISTS "anon_select_purchases" ON product_purchases;
CREATE POLICY "anon_select_purchases" ON product_purchases FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_purchases" ON product_purchases;
CREATE POLICY "anon_insert_purchases" ON product_purchases FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_purchases" ON product_purchases;
CREATE POLICY "anon_update_purchases" ON product_purchases FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_purchases" ON product_purchases;
CREATE POLICY "anon_delete_purchases" ON product_purchases FOR DELETE
  TO anon, authenticated USING (true);

-- Policies for product_stock_movements (single-tenant, anon access)
DROP POLICY IF EXISTS "anon_select_movements" ON product_stock_movements;
CREATE POLICY "anon_select_movements" ON product_stock_movements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_movements" ON product_stock_movements;
CREATE POLICY "anon_insert_movements" ON product_stock_movements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_movements" ON product_stock_movements;
CREATE POLICY "anon_update_movements" ON product_stock_movements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_movements" ON product_stock_movements;
CREATE POLICY "anon_delete_movements" ON product_stock_movements FOR DELETE
  TO anon, authenticated USING (true);