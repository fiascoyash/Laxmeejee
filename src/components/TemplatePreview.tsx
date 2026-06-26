import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, A4_WIDTH, A4_HEIGHT, BlockType } from '../types';
import { calculateProductAmount, calculateTaxSummary, calculateRoundOff, numberToWords, roundTo2 } from '../utils/storage';
import { resolvePlaceholders } from '../utils/placeholders';
import { X, FileDown } from 'lucide-react';
import { exportTemplatePDF } from '../utils/templatePdfExport';

interface Props {
  template: QuotationTemplate;
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  onClose: () => void;
}

const MM_TO_PX = 3.7795275591;

export function TemplatePreview({ template, company, customer, quotation, products, onClose }: Props) {
  const taxSummary = calculateTaxSummary(products);
  // Taxable amount is extracted from inclusive prices
  const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
  const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
  const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
  // Grand total is sum of inclusive product amounts
  const grandTotalAmount = roundTo2(products.reduce((sum, p) => sum + calculateProductAmount(p), 0));
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

  const context = { company, customer, quotation, products };

  const handleExportPDF = () => {
    exportTemplatePDF(template, company, customer, quotation, products);
  };

  const renderBlockContent = (block: { id: string; type: BlockType; content?: string }) => {
    const { type, content } = block;

    switch (type) {
      case 'company_logo':
        return company.logo ? (
          <img src={company.logo} alt="Logo" className="w-full h-full object-contain" />
        ) : null;

      case 'company_details':
        return (
          <div>
            <div className="font-bold text-lg">{company.companyName}</div>
            {company.gstNumber && <div className="text-xs font-medium">GSTIN: {company.gstNumber}</div>}
            {company.address && <div className="text-xs">{company.address}</div>}
            <div className="text-xs">{company.phone} {company.email}</div>
          </div>
        );

      case 'customer_details':
        return (
          <div>
            <div className="font-semibold text-sm mb-1">Bill To:</div>
            <div className="font-medium text-sm">{customer.name}</div>
            {customer.billingAddress && <div className="text-xs">{customer.billingAddress}</div>}
            <div className="text-xs">{customer.village} {customer.district}</div>
            {customer.mobile && <div className="text-xs">Mobile: {customer.mobile}</div>}
          </div>
        );

      case 'ship_to_details':
        return (
          <div>
            <div className="font-semibold text-sm mb-1">Ship To:</div>
            {quotation.shipTo?.name && <div className="font-medium text-sm">{quotation.shipTo.name}</div>}
            {quotation.shipTo?.address && <div className="text-xs">{quotation.shipTo.address}</div>}
            {quotation.shipTo?.mobile && <div className="text-xs">Mobile: {quotation.shipTo.mobile}</div>}
          </div>
        );

      case 'quotation_number':
        return (
          <div className="font-semibold">
            Quotation No: {quotation.quotationNumber}
          </div>
        );

      case 'quotation_date':
        return (
          <div>
            Date: {quotation.date}
          </div>
        );

      case 'product_table': {
        const visibleColumns = (template.productColumns || []).filter(c => c.visible).sort((a, b) => a.order - b.order);
        return (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {visibleColumns.map(col => (
                  <th key={col.id} className="border border-gray-300 px-1 py-0.5 text-left font-semibold">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  {visibleColumns.map(col => (
                    <td key={col.id} className="border border-gray-300 px-1 py-0.5">
                      {col.key === 'sno' ? i + 1 :
                       col.key === 'name' ? p.name :
                       col.key === 'hsnCode' ? p.hsnCode :
                       col.key === 'gstPercent' ? `${p.gstPercent}%` :
                       col.key === 'quantity' ? p.quantity :
                       col.key === 'unitPrice' ? p.unitPrice.toLocaleString('en-IN') :
                       col.key === 'amount' ? calculateProductAmount(p).toLocaleString('en-IN', { minimumFractionDigits: 2 }) :
                       ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      case 'gst_summary':
        return (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-1 py-0.5">HSN</th>
                <th className="border border-gray-300 px-1 py-0.5">Taxable</th>
                <th className="border border-gray-300 px-1 py-0.5">CGST</th>
                <th className="border border-gray-300 px-1 py-0.5">SGST</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(taxSummary.entries()).map(([key, data]) => (
                <tr key={key}>
                  <td className="border border-gray-300 px-1 py-0.5">{key.split('_')[0]}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right">{data.taxableAmount.toFixed(2)}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right">{data.cgstAmount.toFixed(2)}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right">{data.sgstAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'bank_details':
        return (
          <div className="text-xs">
            <div className="font-semibold mb-1">Bank Details:</div>
            <div>{company.bankName}</div>
            <div>A/c: {company.bankAccount} | IFSC: {company.bankIfsc}</div>
            {company.bankBranch && <div>Branch: {company.bankBranch}</div>}
          </div>
        );

      case 'signature_box':
        return company.signature ? (
          <img src={company.signature} alt="Signature" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col justify-end">
            <div className="border-t border-gray-400 pt-1 text-center text-xs">Authorized Sign</div>
          </div>
        );

      case 'terms_conditions':
        return (
          <div className="text-xs">
            <div className="font-semibold mb-1">Terms & Conditions:</div>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Quotation valid for 30 days</li>
              <li>50% advance, balance before delivery</li>
            </ol>
          </div>
        );

      case 'footer_notes':
        return <div className="text-xs text-center text-gray-500">{resolvePlaceholders(content || 'Thank you!', context)}</div>;

      case 'totals':
        return (
          <div className="text-xs text-right">
            <div>Taxable: Rs. {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>CGST: Rs. {totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>SGST: Rs. {totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>Round Off: Rs. {roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div className="font-bold text-sm border-t mt-1 pt-1">
              Grand Total: Rs. {roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs italic">
              ({numberToWords(roundedGrandTotal)})
            </div>
          </div>
        );

      case 'text_block':
        return (
          <div className="text-xs whitespace-pre-wrap">
            {resolvePlaceholders(content || '', context)}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-full overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Template Preview: {template.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-gray-200 flex justify-center">
          <div
            className="bg-white shadow-2xl relative"
            style={{
              width: A4_WIDTH * MM_TO_PX,
              height: A4_HEIGHT * MM_TO_PX,
            }}
          >
            {template.blocks.filter(b => b.visible).map(block => (
              <div
                key={block.id}
                className="absolute overflow-hidden"
                style={{
                  left: block.x * MM_TO_PX,
                  top: block.y * MM_TO_PX,
                  width: block.width * MM_TO_PX,
                  height: block.height * MM_TO_PX,
                }}
              >
                {renderBlockContent(block)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
