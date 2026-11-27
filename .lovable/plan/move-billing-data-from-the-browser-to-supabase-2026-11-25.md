# Move billing data from the browser to Supabase

## What changes for you
- Invoices, quotations, customers, suppliers, the product catalogue, company profile, templates, numbering, labels/notes, credit/debit notes and default terms get saved to your Supabase database for the signed-in shop.
- Signing in with Google on any phone or computer loads the same data. Clearing the browser no longer loses anything.
- The first time an owner signs in after this update, data already in their browser gets uploaded to the cloud, so nothing is lost.
- If a different shop signs in on the same browser, that shop sees only its own data.
- A small "Saved to cloud / Syncing / Offline – will sync" indicator appears in the billing app.
- Screens, buttons and workflows stay the same.

## Step 1 — Database update (you run it)
I'll write one SQL file, `supabase/migrations/<date>_business_records.sql`, and paste it in chat. You run it in the Supabase SQL editor. I will not run anything.
- New table `business_records`: one row per invoice, customer, quotation and so on (columns: business_id, collection, record_id, data, updated_at, deleted).
- Same shop isolation as the existing tables: `business_id` defaults to `current_business_id()`, and RLS uses `is_business_member()`. Only members of a shop can read or write its rows.
- GRANTs for `authenticated` and `service_role` only. No public access.
- Realtime enabled, so a second open device sees changes.

## Step 2 — App changes (after you confirm the SQL ran)
- A sync layer next to the existing storage code. The browser copy stays as a fast working cache, so the app still opens instantly and works offline.
- Every save also goes to the cloud, record by record. Two devices editing different invoices won't overwrite each other.
- On sign-in: pull the cloud data, merge it with anything only in this browser (first-time upload), then refresh the screens.
- Failed saves are queued and retried when the connection returns.
- Leave unchanged: payments, stock purchases, stock movements and imported bills (already in the cloud), plus screen preferences such as column choices and dashboard layout (these stay per device).

## Not included
- No change to sign-in, onboarding, the public shop pages or existing tables.
- The Data Storage warning stays removed. It becomes accurate once this ships.

## Technical details
- Collections map to localStorage keys: `solar_invoices`, `solar_quotations`, `solar_customers`, `laxmeejee_suppliers`, `laxmeejee_supplier_transactions`, `solar_product_catalog`, `solar_quotation_templates`, `hisaaboo_credit_debit_notes`, plus singleton keys (`solar_company_profile`, `solar_numbering_settings`, `laxmeejee_document_labels_notes`, `hisaaboo_default_terms`) stored with `record_id = 'singleton'`.
- Write path: wrap the storage setters, diff the previous and next arrays by `id`, upsert changed rows and soft-delete removed rows. Conflicts are settled last-write-wins on `updated_at` for each record.
- Cache is namespaced by business: track `hisaaboo_sync_business_id`. When a different business signs in, clear the synced keys before pulling.
- Primary key `(business_id, collection, record_id)`, plus an index on `(business_id, updated_at)` for incremental pulls.
