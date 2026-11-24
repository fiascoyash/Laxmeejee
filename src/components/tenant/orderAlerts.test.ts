import { describe, expect, it } from "vitest";
import { alertSpeechText, parseAlertSettings } from "./orderAlerts";

describe("order alert settings", () => {
  it("falls back to continuous ring at 80% for missing/invalid data", () => {
    expect(parseAlertSettings(null)).toEqual({ style: "continuous", volume: 0.8 });
    expect(parseAlertSettings("{bad")).toEqual({ style: "continuous", volume: 0.8 });
  });
  it("keeps a saved style and clamps volume to 0–100%", () => {
    expect(parseAlertSettings(JSON.stringify({ style: "voice", volume: 3 }))).toEqual({ style: "voice", volume: 1 });
    expect(parseAlertSettings(JSON.stringify({ style: "chime", volume: -1 }))).toEqual({ style: "chime", volume: 0 });
  });
});

describe("voice announcement", () => {
  it("speaks the table number for dine-in", () => {
    expect(alertSpeechText({ table: "Table 3", total: 450 })).toBe("New Dine-in order! Table 3, amount Rupees 450.");
  });
  it("speaks the customer name for pickup", () => {
    expect(alertSpeechText({ customerName: "Ramesh", total: 320 })).toBe("New pickup order from Ramesh, Rupees 320.");
  });
  it("adds the far-away warning", () => {
    expect(alertSpeechText({ table: "Table 3", total: 450, isFar: true })).toContain("Warning, placed far from restaurant.");
  });
});
