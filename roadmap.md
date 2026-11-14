# Add Stock
- [x] Keep Add Stock within the viewport with a scrolling form and fixed controls.
- [x] Validate unit-aware quantities/costs and save optional details with purchase/movement history exactly once.
- [x] Refresh existing product details and verify desktop/mobile saves and failures.

# Stage 1 — Tenant foundation
- [x] Shops + owner membership with per-shop data isolation
- [x] Owner sign-in (email, Google) and business setup
- [x] Public shop page at /shop/<address>
- [x] Stage 2: shop profile editor, counter QR, public catalogue, name sync

# Collected-order recovery
- [x] Allow GST billing from collected orders and reopening to Ready for pickup.
- [x] Verify recovery controls and failure handling.

# Stage 6 — Local discovery
- [x] Public homepage search for shops and products with city, locality, and category filters.
- [x] Keep owner billing separate and link search results to existing pickup storefronts.
- [x] Verify public visibility, search, filters, and mobile layout.

# Unified landing page
- [x] One homepage for customers (shop search) and shopkeepers (login), using the original Hisaaboo design.
- [x] Showcase newly added features: shop page, counter QR, pickup orders, live chime, 1-click GST bill, GST tools.

# Clear homepage routing
- [x] Default billing to the dashboard and return retired billing landing bookmarks to the shared homepage.
- [x] Add a visible Find local shops link to the billing header and verify public/merchant navigation.

# Online store hub — Option A
- [x] Replace the floating shop menu with sidebar store actions, a top-bar order bell, and sign-out.
- [x] Add a dashboard store hub with live catalogue/order counts, sharing, QR, and quick GST billing.
- [x] Verify live updates, compact layouts, and pickup recovery through GST invoice prefill; restore the checked order to Collected without saving an invoice.
- [x] Run all 64 behavior checks and confirm the signed-in desktop/compact views, QR, and catalogue controls have no page errors.
