// @ts-nocheck -- test fixture uses loosely typed legacy parser
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseGstr2bWorkbook, Gstr2bError } from "@/legacy/utils/gstr2b";

function build() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Goods and Services Tax - GSTR 2B"], [],
    ["Financial Year", "2024-25"], ["Tax Period", "April"],
    ["GSTIN", "27AAAAA0000A1Z5"], ["Legal Name", "Test Traders"],
  ]), "Read me");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ITC Available"], [],
    ["S.no.", "Heading", "GSTR-3B table", "Integrated Tax (₹)", "Central Tax (₹)", "State/UT Tax (₹)", "Cess (₹)", "Advisory"],
    ["Part A", "All other ITC", "4(A)(5)", "", "", "", "", ""],
    ["", "B2B - Invoices", "4(A)(5)", 180, 0, 0, 0, ""],
    ["", "B2B - Credit notes", "4(A)(5)", 0, 9, 9, 0, ""],
  ]), "ITC Available");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Taxable inward supplies received from registered persons"], [],
    ["GSTIN of supplier", "Trade/Legal name", "Invoice details", "", "", "", "Place of supply", "Supply Attract Reverse Charge", "Taxable Value (₹)", "Tax Amount", "", "", "", "GSTR-1/IFF/GSTR-5 Period", "GSTR-1/IFF/GSTR-5 Filing Date", "ITC Availability", "Reason"],
    ["", "", "Invoice number", "Invoice type", "Invoice Date", "Invoice Value(₹)", "", "", "", "Integrated Tax(₹)", "Central Tax(₹)", "State/UT Tax(₹)", "Cess(₹)", "", "", "", ""],
    ["29BBBBB1111B1Z5", "Alpha", "INV-1", "Regular", "05/04/2024", 1180, "Karnataka", "No", 1000, 180, 0, 0, 0, "Apr'24", "11/05/2024", "Yes", ""],
    ["27CCCCC2222C1Z5", "Beta", "INV-2", "Regular", "06/04/2024", 590, "Maharashtra", "No", 500, 0, 45, 45, 0, "Apr'24", "11/05/2024", "No", "POS"],
  ]), "B2B");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Original details", "", "Revised details"],
    ["Invoice number", "Invoice Date", "GSTIN of supplier", "Invoice number", "Taxable Value (₹)", "Integrated Tax(₹)", "ITC Availability"],
    ["OLD-1", "01/03/2024", "29BBBBB1111B1Z5", "NEW-1", 200, 36, "Yes"],
  ]), "B2BA");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["GSTIN of supplier", "Trade/Legal name", "Credit note/Debit note details", "", "", "", "Taxable Value (₹)", "Tax Amount", "", "", "", "ITC Availability"],
    ["", "", "Note number", "Note type", "Note Date", "Note Value (₹)", "", "Integrated Tax(₹)", "Central Tax(₹)", "State/UT Tax(₹)", "Cess(₹)", ""],
    ["27CCCCC2222C1Z5", "Beta", "CN-1", "Credit Note", "10/04/2024", 118, 100, 0, 9, 9, 0, "Yes"],
  ]), "B2B-CDNR");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("GSTR-2B parser", () => {
  const r = parseGstr2bWorkbook(build(), "2b.xlsx");

  it("extracts GSTIN, FY and period", () => {
    expect(r.meta.gstin).toBe("27AAAAA0000A1Z5");
    expect(r.meta.financialYear).toBe("2024-25");
    expect(r.meta.taxPeriod).toBe("April");
  });

  it("parses B2B rows with two header rows", () => {
    const b2b = r.sheets.find((s) => s.name === "B2B")!;
    expect(b2b.records).toHaveLength(2);
    expect(b2b.records[0].fields.docNumber).toBe("INV-1");
    expect(b2b.records[0].values.igst).toBe(180);
    expect(b2b.records[1].fields.itcAvailability).toBe("No");
  });

  it("uses revised invoice number in amendments", () => {
    expect(r.sheets.find((s) => s.name === "B2BA")!.records[0].fields.docNumber).toBe("NEW-1");
  });

  it("nets credit notes and excludes amendments from headline", () => {
    expect(r.headline.taxable).toBe(1400); // 1000 + 500 - 100, B2BA not added
    expect(r.headline.igst).toBe(180);
    expect(r.headline.cgst).toBe(36);
    expect(r.headline.itcYes.igst).toBe(180);
    expect(r.headline.itcNotYes.count).toBe(1);
    expect(r.headline.records).toBe(4);
  });

  it("reconciles summary with invoice totals", () => {
    const b2b = r.reconciliations.find((x) => x.heading === "B2B - Invoices")!;
    expect(b2b.matches).toBe(true);
    expect(r.reconciliations.find((x) => x.heading === "B2B - Credit notes")!.matches).toBe(true);
  });

  it("rejects non-xlsx and non-2B files", () => {
    expect(() => parseGstr2bWorkbook(new ArrayBuffer(4), "a.pdf")).toThrow(Gstr2bError);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["hello"]]), "Sheet1");
    expect(() => parseGstr2bWorkbook(XLSX.write(wb, { type: "array", bookType: "xlsx" }), "x.xlsx")).toThrow(/GSTR-2B/);
  });
});
