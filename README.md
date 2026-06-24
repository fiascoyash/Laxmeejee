# GST Quotation Maker for Solar Business

A professional GST-compliant quotation maker designed specifically for solar businesses. Create customized quotations with automatic tax calculation, PDF export, and a powerful template builder.

## Features

### Core Features
- **Company Profile Management** - Logo, GST number, address, bank details, signature
- **Customer Details** - Full customer information with billing address
- **Product Catalog** - 10 pre-loaded solar products (panels, inverters, batteries, etc.)
- **GST Calculation** - Supports multiple GST slabs (5%, 12%, 18%, 28%)
- **Tax Summary** - Auto-generated HSN-wise tax summary (CGST + SGST)
- **Quotation History** - Save, edit, duplicate, delete quotations
- **PDF Export** - Professional A4 PDF with exact template layout

### Template Builder
- **Drag-and-Drop Editor** - Canva-like template customization
- **12 Block Types** - Company logo, customer details, product table, etc.
- **Customizable Columns** - Add/remove/reorder product table columns
- **Dynamic Placeholders** - `{{customer_name}}`, `{{quotation_no}}`, etc.
- **Template Library** - Create unlimited custom templates
- **Live A4 Preview** - WYSIWYG preview matching PDF output

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **jsPDF + AutoTable** for PDF generation
- **Lucide React** for icons
- **LocalStorage** for data persistence

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
npm run dev
```

### Build for Production

```bash
npm run build
```

The `dist` folder is ready for deployment.

## Deployment

### Netlify
1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Deploy!

The app uses client-side routing with `_redirects` file for SPA support.

## Project Structure

```
src/
├── components/
│   ├── CompanyProfile.tsx      # Edit company details
│   ├── CustomerDetails.tsx     # Customer form
│   ├── ProductTable.tsx        # Products with GST
│   ├── ProductCatalog.tsx      # Manage products
│   ├── QuotationList.tsx       # History view
│   ├── TemplateBuilder.tsx     # Drag-drop editor
│   ├── TemplateLibrary.tsx     # Template management
│   ├── TemplatePreview.tsx     # A4 preview
│   └── TemplateSelection.tsx   # Choose template
├── utils/
│   ├── storage.ts              # LocalStorage helpers
│   ├── templatePdfExport.ts    # PDF generation
│   └── placeholders.ts         # Dynamic text
├── types.ts                    # TypeScript interfaces
├── App.tsx                     # Main application
└── main.tsx                    # Entry point
```

## Usage Flow

1. **Setup Company Profile** - Add your company details, logo, bank info
2. **Create Template** (optional) - Design custom quotation layout
3. **Create Quotation**:
   - Select template
   - Fill customer details
   - Add products from catalog
   - Preview and export PDF
4. **Manage History** - View, edit, duplicate past quotations

## Data Storage

All data is stored locally in the browser's localStorage:
- `solar_company_profile` - Company settings
- `solar_quotations` - Saved quotations
- `solar_product_catalog` - Product list
- `solar_quotation_templates` - Custom templates

Clear browser data will remove all stored information.

## License

MIT
