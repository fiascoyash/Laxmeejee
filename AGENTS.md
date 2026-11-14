<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The Hisaaboo app lives in `src/legacy/` and renders client-only at `/billing`; preserve its hash navigation and localStorage. Shared billing-navigation helpers recognize billing bookmarks on `/`, default empty/invalid `/billing` hashes to `#home`, and redirect `/billing#landing` to `/` so only the public homepage renders the welcome screen and public section hashes stay public.
- Editing an existing invoice saves directly (status derived from recorded payments, Draft preserved); the payment decision dialog is only for new invoices or explicitly finalizing a draft — keeps editing and payment collection separate.
- Keep desktop sidebar collapse separate from the mobile drawer state and use the existing shared hamburger; navigation closes only the drawer so desktop collapse survives page changes.
- Add Stock uses operation IDs, an invoker-permission RPC for atomic cloud histories, and snapshot-backed existing local keys for catalog/history; keep these boundaries to avoid duplicate increments and preserve the browser-local catalog. Additive decimal history fields retain compatibility with legacy integer workflows; use their fallback values in Product Details.
- The GSTR-2B Analyzer (Reports tab) parses workbooks fully in the browser (src/legacy/utils/gstr2b.ts) and keeps results only in component state; headline totals use original sheets only so amendments/reversals are never double-counted.
- The GSTR-3B preparation view (src/legacy/utils/gstr3b.ts + components/gst/Gstr3bPrep.tsx) is opened from the GSTR-2B Analyzer, keeps user inputs in component state only, prefers portal summary lines over row-level sums, and reads saved purchases read-only — so no records are created and nothing is double-counted.
- GSTR-1 exports (components/gst/Gstr1Exports.tsx + utils/gstr1Json.ts) only read invoices; invoice PDFs reuse exportTemplatePDF with returnBlob so ZIP PDFs match the normal invoice download.
- Credit/Debit Notes (src/legacy/utils/creditDebitNotes.ts, components/notes/) live only in localStorage key `hisaaboo_credit_debit_notes` and never modify invoices; GSTR-1 tables/JSON, GSTR-3B 3.1(a) books figure and customer khata all derive from those notes so adjustments are never stored twice.
- Invoice PDFs take a Rule 48 `copies` option in exportTemplatePDF; "All 3 copies" renders one multi-page PDF (never several downloads) and the default stays Original for Recipient.
- Tenancy: every cloud billing table carries `business_id` (defaulted by `current_business_id()`) and RLS via `is_business_member()`; businesses are created only through the `create_business` RPC (atomic shop + owner row). This keeps legacy billing inserts unchanged while isolating shops.
- `BusinessGate` wraps the legacy app at `/billing` for owner sign-in and onboarding; public shop pages live at `/shop/$slug` and read only published rows via a publishable-key server function.
- Public shop catalogue is a cloud snapshot (shop_products) the owner pushes from the browser-local catalogue; the local catalogue stays the source of truth.
- Online-store controls share the BusinessGate merchant-store context and existing settings/order dialogs; realtime refreshes the dashboard and navigation together, and GST billing uses the existing invoice event flow to avoid duplicate order state.
- Pickup-order recovery stays in the existing order queue and invoice event flow; status changes match business and prior status and confirm an updated row so stale or denied updates cannot appear successful.
- Public discovery owns `/` inside the original legacy LandingPage (heroSearch/directory slots) with URL-backed filters and Query loaders; server reads use anonymous publishable-key RLS, safe projections, and paged scans so owner sessions cannot reveal unpublished shops or private billing data.
