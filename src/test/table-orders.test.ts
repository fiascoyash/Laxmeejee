import { describe, expect, it } from "vitest";
import { bulkTables, newOrderAlert, normalizeTable, parseTableNote, tableNote, tableUrl } from "@/lib/tableOrders";

describe("table QR links", () => {
  it("adds ?table=<name> to the shop link", () => {
    expect(tableUrl("https://hisaaboo.com", "kumar-lights", "Table 2")).toBe("https://hisaaboo.com/shop/kumar-lights?table=Table+2");
  });
  it("keeps the plain shop link for the main counter QR", () => {
    expect(tableUrl("https://hisaaboo.com", "kumar-lights")).toBe("https://hisaaboo.com/shop/kumar-lights");
  });
  it("bulk generates Table 1 to Table 10", () => {
    const t = bulkTables("Table ", 1, 10);
    expect(t).toHaveLength(10);
    expect(t[0]).toBe("Table 1");
    expect(t[9]).toBe("Table 10");
  });
  it("caps a bulk sheet at 50 cards", () => {
    expect(bulkTables("T", 1, 500)).toHaveLength(50);
  });
  it("cleans unsafe table names", () => {
    expect(normalizeTable("  [Roof]<b>  3 ")).toBe("Roof b 3");
  });
});

describe("table tag on orders", () => {
  it("prefixes the order note with [Table 3]", () => {
    expect(tableNote("Table 3", "less spicy")).toBe("[Table 3] less spicy");
  });
  it("leaves notes alone without a table", () => {
    expect(tableNote("", "less spicy")).toBe("less spicy");
  });
  it("reads the table back for the order queue", () => {
    expect(parseTableNote("[Table 3] less spicy")).toEqual({ table: "Table 3", note: "less spicy" });
    expect(parseTableNote("just a note")).toEqual({ table: "", note: "just a note" });
  });
});

describe("instant new-order alert", () => {
  it("names the table for dine-in orders", () => {
    const a = newOrderAlert({ customer_name: "Yash", order_code: "104", total: 450, note: "[Table 3] less spicy" });
    expect(a.banner).toBe("New Dine-in order (Table 3) — #104 from Yash (₹450)");
    expect(a.title).toBe("New Dine-in order — Table 3");
  });
  it("keeps the pickup wording for counter orders", () => {
    const a = newOrderAlert({ customer_name: "Yash", order_code: "104", total: 450, note: "" });
    expect(a.banner).toBe("New pickup order #104 from Yash — ₹450");
    expect(a.title).toBe("New pickup order");
  });
});
