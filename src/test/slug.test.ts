import { describe, it, expect } from "vitest";
import { slugify, isValidSlug } from "@/lib/slug";

describe("shop web address", () => {
  it("turns a shop name into a lowercase dashed address", () => {
    expect(slugify("Laxmi Hardware & Electricals, Bijnor")).toBe("laxmi-hardware-electricals-bijnor");
  });
  it("rejects addresses shorter than 3 characters or with capitals/spaces", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("Laxmi Shop")).toBe(false);
    expect(isValidSlug("-laxmi")).toBe(false);
    expect(isValidSlug("laxmi-hardware")).toBe(true);
  });
});
