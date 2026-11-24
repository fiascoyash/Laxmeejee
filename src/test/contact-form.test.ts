import { describe, it, expect } from "vitest";
import { validateContact, emptyContact, buildMailto } from "@/lib/contact/form";

const ok = { ...emptyContact, name: "Asha", email: "asha@example.com", role: "Customer" as const, enquiryType: "QR ordering", subject: "Help", message: "Hi", consent: true };

describe("contact form", () => {
  it("accepts a complete enquiry", () => expect(validateContact(ok)).toEqual({}));
  it("requires privacy acknowledgement", () => expect(validateContact({ ...ok, consent: false }).consent).toBeTruthy());
  it("rejects blank name after trimming", () => expect(validateContact({ ...ok, name: "   " }).name).toBeTruthy());
  it("rejects enquiry type not matching role", () => expect(validateContact({ ...ok, enquiryType: "Subscription" }).enquiryType).toBeTruthy());
  it("rejects invalid Indian mobile", () => expect(validateContact({ ...ok, mobile: "12345" }).mobile).toBeTruthy());
  it("requires mobile when phone preferred", () => expect(validateContact({ ...ok, preferred: "Phone" }).mobile).toBeTruthy());
  it("addresses email to support", () => expect(buildMailto(ok).startsWith("mailto:support@hisaaboo.com?")).toBe(true));
  it("allows optional mobile to be omitted for email enquiries", () => expect(validateContact({ ...ok, mobile: "", preferred: "Email" })).toEqual({}));
  it("accepts a 10-digit Indian callback number", () => expect(validateContact({ ...ok, mobile: "9876543210", preferred: "Phone" })).toEqual({}));
  it("limits the subject to 150 characters", () => expect(validateContact({ ...ok, subject: "a".repeat(151) }).subject).toBeDefined());
  it("accepts the 2000-character message boundary", () => expect(validateContact({ ...ok, message: "a".repeat(2000) })).toEqual({}));
  it("rejects messages longer than 2000 characters", () => expect(validateContact({ ...ok, message: "a".repeat(2001) }).message).toBeDefined());
  it("encodes the enquiry and reply information into the email", () => {
    const mail = new URL(buildMailto({ ...ok, reference: "Shop & order 42" }));
    expect(mail.searchParams.get("subject")).toBe("[QR ordering] Help");
    expect(mail.searchParams.get("body")).toContain("Email: asha@example.com");
    expect(mail.searchParams.get("body")).toContain("Order ID / Business: Shop & order 42");
  });
});
