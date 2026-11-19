import { describe, it, expect } from "vitest";
import { storeTheme, STORE_THEMES } from "@/lib/store-themes";

describe("storefront accent", () => {
  it("falls back to the default yellow theme for unknown or missing choices", () => {
    expect(storeTheme(undefined).id).toBe("amber");
    expect(storeTheme("nope").id).toBe("amber");
  });
  it("returns the chosen theme", () => {
    expect(storeTheme("tomato").label).toBe("Tomato Red");
    expect(STORE_THEMES.length).toBe(6);
  });
});
