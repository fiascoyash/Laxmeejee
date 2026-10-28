// @ts-nocheck
import { describe, it, expect } from "vitest";
import { buildGstr3bReport } from "@/legacy/utils/gstr3b";

const base = (over = {}) => ({
  fileName: "x.xlsx", meta: {}, skippedSheets: [], reconciliations: [], warnings: [],
  headline: { itcNotYes: { igst: 0, cgst: 0, sgst: 0, cess: 0, count: 0 } },
  sheets: [], summaries: [], ...over,
});
const row = (rep, key) => rep.sections.flatMap((s) => s.rows).find((r) => r.key === key);

describe("GSTR-3B preparation", () => {
  it("uses GSTR-2B summary for 4(A)(5) and deducts credit notes", () => {
    const rep = buildGstr3bReport(base({ summaries: [
      { sheet: "ITC Available", heading: "B2B - Invoices", table: "4(A)(5)", igst: 180, cgst: 10, sgst: 10, cess: 0, isGroup: false },
      { sheet: "ITC Available", heading: "B2B - Credit notes", table: "4(A)(5)", igst: 0, cgst: 9, sgst: 9, cess: 0, isGroup: false },
    ] }), {});
    expect(row(rep, "itc_oth").values).toEqual({ igst: 180, cgst: 1, sgst: 1, cess: 0 });
    expect(row(rep, "itc_oth").origin).toBe("imported");
  });

  it("falls back to original rows with ITC Yes only, ignoring amendments", () => {
    const rec = (igst, itc, sign = 1) => ({ fields: { itcAvailability: itc }, values: { igst, cgst: 0, sgst: 0, cess: 0 }, sign });
    const rep = buildGstr3bReport(base({ sheets: [
      { name: "B2B", kind: "original", columns: ["itcAvailability"], records: [rec(100, "Yes"), rec(50, "No")] },
      { name: "B2BA", kind: "amendment", columns: ["itcAvailability"], records: [rec(999, "Yes")] },
    ] }), {});
    expect(row(rep, "itc_oth").values.igst).toBe(100);
  });

  it("shows missing user figures as required and computes net ITC once entered", () => {
    const empty = buildGstr3bReport(base(), {});
    expect(row(empty, "o_a").values.igst).toBeNull();
    expect(empty.complete).toBe(false);
    const nil = (h) => Object.fromEntries(h.map((k) => [k, 0]));
    const T = ["taxable", "igst", "cgst", "sgst", "cess"], X = ["igst", "cgst", "sgst", "cess"];
    const rep = buildGstr3bReport(base(), {
      o_a: { taxable: 1000, igst: 180, cgst: 0, sgst: 0, cess: 0 }, o_b: nil(["taxable", "igst", "cess"]), o_c: nil(["taxable"]),
      o_d: nil(T), o_e: nil(["taxable"]), itc_impS: { igst: 50, cess: 0 }, rev_42: { igst: 10, cgst: 0, sgst: 0, cess: 0 },
      rev_oth: nil(X), inel_175: nil(X), interest: nil(X),
    });
    expect(rep.complete).toBe(true);
    expect(row(rep, "itc_c").values.igst).toBe(40);
    expect(row(rep, "bal").values.igst).toBe(140);
  });
});
