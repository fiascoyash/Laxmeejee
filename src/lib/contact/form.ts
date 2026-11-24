export const ROLES = ["Customer", "Business Owner", "Other"] as const;
export type Role = (typeof ROLES)[number];

export const ENQUIRY_TYPES: Record<Role, string[]> = {
  Customer: ["Find a shop or product", "Order and tracking", "QR ordering", "Account and login", "Website technical issue"],
  "Business Owner": ["Storefront setup", "Product catalogue or Excel import", "QR management", "Orders", "Billing, invoices or quotations", "Subscription", "Technical issue"],
  Other: ["General enquiry", "Partnership or collaboration", "Feedback or suggestion", "Privacy or data request", "Grievance or complaint", "Other"],
};

export const MESSAGE_MAX = 2000;
export const SUPPORT_EMAIL = "support@hisaaboo.com";

export type ContactValues = {
  name: string; email: string; mobile: string; role: Role | ""; enquiryType: string;
  reference: string; subject: string; message: string; consent: boolean; preferred: "Email" | "Phone";
};

export const emptyContact: ContactValues = {
  name: "", email: "", mobile: "", role: "", enquiryType: "", reference: "", subject: "", message: "", consent: false, preferred: "Email",
};

export function validateContact(v: ContactValues): Partial<Record<keyof ContactValues, string>> {
  const e: Partial<Record<keyof ContactValues, string>> = {};
  if (!v.name.trim()) e.name = "Please enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "Please enter a valid email address.";
  const mob = v.mobile.replace(/[\s-]/g, "");
  if (mob && !/^(\+91|0)?[6-9]\d{9}$/.test(mob)) e.mobile = "Please enter a valid 10-digit Indian mobile number.";
  if (v.preferred === "Phone" && !mob) e.mobile = "Add a mobile number to be contacted by phone.";
  if (!v.role) e.role = "Please tell us who you are.";
  else if (!ENQUIRY_TYPES[v.role].includes(v.enquiryType)) e.enquiryType = "Please choose an enquiry type.";
  if (!v.subject.trim()) e.subject = "Please add a short subject.";
  else if (v.subject.trim().length > 150) e.subject = "Subject must be 150 characters or fewer.";
  if (!v.message.trim()) e.message = "Please describe your enquiry.";
  else if (v.message.length > MESSAGE_MAX) e.message = `Message must be ${MESSAGE_MAX} characters or fewer.`;
  if (!v.consent) e.consent = "Please acknowledge the contact privacy notice to continue.";
  return e;
}

export function buildMailto(v: ContactValues): string {
  const lines = [
    `Name: ${v.name.trim()}`, `Email: ${v.email.trim()}`, v.mobile.trim() && `Mobile: ${v.mobile.trim()}`,
    `I am a: ${v.role}`, `Enquiry type: ${v.enquiryType}`, v.reference.trim() && `Order ID / Business: ${v.reference.trim()}`,
    `Preferred contact: ${v.preferred}`, "", v.message.trim(),
  ].filter((l): l is string => typeof l === "string");
  const subject = `[${v.enquiryType}] ${v.subject.trim()}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
