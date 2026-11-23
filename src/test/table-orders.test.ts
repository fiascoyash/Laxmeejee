import { describe, expect, it } from "vitest";
import { checkFence, verifyOrderSpot, bulkTables, newOrderAlert, normalizeTable, parseTableNote, tableNote, tableUrl } from "@/lib/tableOrders";

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
    expect(parseTableNote("[Table 3] less spicy")).toEqual({ table: "Table 3", note: "less spicy", spot: null });
    expect(parseTableNote("just a note")).toEqual({ table: "", note: "just a note", spot: null });
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

describe("dine-in geofence", () => {
  const fence = { lat: 29.37, lng: 78.13, r: 150 };
  it("allows a table order placed inside the 150 m range", () => {
    expect(checkFence(fence, { lat: 29.3705, lng: 78.13, accuracy: 20 }).result).toBe("inside");
  });
  it("blocks a table order placed 2 km away", () => {
    expect(checkFence(fence, { lat: 29.388, lng: 78.13, accuracy: 20 }).result).toBe("outside");
  });
  it("warns the merchant when an order note carries a far-away spot", () => {
    const a = newOrderAlert({ customer_name: "Yash", order_code: "9", total: 100, note: "[Table 4][@29.38800,78.13000,20,2000] hi" }, fence);
    expect(a.banner).toContain("check Table 4 before cooking");
    expect(verifyOrderSpot(null, fence).status).toBe("unchecked");
  });
});
