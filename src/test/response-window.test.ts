import { describe, expect, it } from "vitest";
import { formatCountdown, responseMsLeft } from "@/lib/response-window";

describe("15-minute reply window", () => {
  it("gives 15 minutes from order time", () => {
    expect(responseMsLeft(0, 0)).toBe(15 * 60 * 1000);
    expect(responseMsLeft(0, 15 * 60 * 1000 + 1)).toBeLessThan(0);
  });
  it("formats remaining time", () => {
    expect(formatCountdown(14 * 60 * 1000 + 5000)).toBe("14:05");
  });
});
