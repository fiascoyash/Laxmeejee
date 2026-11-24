import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase, CheckCircle2, Handshake, Info, Mail, MapPin, Menu, X, QrCode, Search, ShoppingBag, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HisaabooLogo } from "@/components/brand/HisaabooLogo";
import { normalizeDiscovery } from "@/lib/discovery";
import { ENQUIRY_TYPES, MESSAGE_MAX, ROLES, SUPPORT_EMAIL, buildMailto, emptyContact, validateContact, type ContactValues, type Role } from "@/lib/contact/form";

const SITE = "https://hisaaboo.com";
const TITLE = "Contact Hisaaboo - Customer & Merchant Support";
const DESCRIPTION = "Contact Hisaaboo for help with local shop discovery, orders, QR ordering, merchant storefronts, product catalogues and business tools.";
const ADDRESS = "B-14, Nai Basti, Near Choudhary Honda, Bijnor, Uttar Pradesh - 246701";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/contact` },
      { property: "og:site_name", content: "Hisaaboo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE}/contact` }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact Hisaaboo",
        url: `${SITE}/contact`,
        description: DESCRIPTION,
        about: {
          "@type": "Organization",
          name: "Hisaaboo",
          url: SITE,
          slogan: "Bringing Local Shops & Customer Together.",
          email: SUPPORT_EMAIL,
          contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, areaServed: "IN" },
        },
      }),
    }],
  }),
  component: ContactPage,
});

const shopsSearch = normalizeDiscovery({});

const CUSTOMER_HELP = [
  "Finding local shops and products.",
  "Placing orders through a shop's digital storefront or QR code.",
  "Order tracking and order-related technical issues.",
  "Website access and account-related assistance.",
  "Reporting an issue with the Hisaaboo platform.",
];
const MERCHANT_HELP = [
  "Creating and managing your digital storefront.",
  "Adding products and importing product catalogues.",
  "Generating and managing QR codes.",
  "Receiving and managing customer orders.",
  "Using Hisaaboo billing, quotations and business tools.",
  "Account, subscription and technical assistance.",
];

const inputCls = "mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive";

function ContactPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [values, setValues] = useState<ContactValues>(emptyContact);
  const [errors, setErrors] = useState<ReturnType<typeof validateContact>>({});
  const [status, setStatus] = useState<"idle" | "opening" | "done">("idle");
  const formRef = useRef<HTMLElement>(null);

  const set = <K extends keyof ContactValues>(k: K, v: ContactValues[K]) => {
    setValues(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => { const next = { ...p }; delete next[k]; return next; });
  };

  const preset = (role: Role, enquiryType: string) => {
    setValues(p => ({ ...p, role, enquiryType }));
    setStatus("idle");
    formRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  };

  const showRef = values.role === "Business Owner" || /order|qr|tracking/i.test(values.enquiryType);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "opening") return;
    const errs = validateContact(values);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) { document.getElementById(`f-${first}`)?.focus(); return; }
    setStatus("opening");
    window.location.href = buildMailto(values);
    window.setTimeout(() => setStatus("done"), 600);
  };

  return (
    <div className="contact-page min-h-screen bg-background text-public-copy">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" search={shopsSearch} className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <HisaabooLogo size={34} /><span className="sr-only">Hisaaboo</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm font-medium text-public-copy sm:gap-6">
            <Link to="/" search={shopsSearch} hash="shops" className="hidden hover:text-primary sm:inline">Find Shops</Link>
            <Link to="/" search={shopsSearch} hash="features" className="hidden hover:text-primary md:inline">Features</Link>
            <Link to="/" search={shopsSearch} hash="how" className="hidden hover:text-primary md:inline">How it works</Link>
            <Link to="/about" className="hidden hover:text-primary sm:inline">About</Link>
            <Link to="/contact" aria-current="page" className="hidden font-semibold text-primary sm:inline">Contact</Link>
            <Button variant="ghost" size="icon" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="contact-mobile-nav" onClick={() => setMenuOpen(p => !p)} className="sm:hidden">{menuOpen ? <X /> : <Menu />}</Button>
            <Link to="/billing" className="rounded-lg bg-primary px-4 py-2 font-semibold text-public-inverse-foreground shadow-sm transition-colors hover:bg-primary/90">Login</Link>
          </nav>
        </div>
        {menuOpen && <nav id="contact-mobile-nav" aria-label="Mobile navigation" className="grid gap-1 border-t border-border bg-background px-4 py-3 sm:hidden">
          <Link to="/" search={shopsSearch} hash="shops" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-3">Find Shops</Link>
          <Link to="/about" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-3">About Us</Link>
          <Link to="/contact" aria-current="page" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-3 font-semibold text-primary">Contact Us</Link>
        </nav>}
      </header>

      <main>
        {/* Hero */}
        <section className="bg-public-tint/50">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-normal text-primary">Hisaaboo support · Contact Us</p>
              <h1 className="text-4xl font-extrabold text-foreground sm:text-6xl">Contact Us</h1>
              <p className="mt-4 text-2xl font-semibold text-primary sm:text-3xl">We're here to help.</p>
              <p className="mt-8 max-w-2xl text-lg font-semibold leading-relaxed text-foreground">
                Whether you're looking for a local shop, need assistance with an order, or want to grow your business with Hisaaboo, we're here to help.
              </p>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-public-copy">
                At Hisaaboo, we believe connecting local businesses and customers should be simple. Reach out to us whenever you need assistance.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#message" className="h-auto whitespace-normal inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-public-inverse-foreground transition-colors hover:bg-primary/90">Send us a message <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="h-auto whitespace-normal inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"><Mail className="h-4 w-4" aria-hidden="true" /> {SUPPORT_EMAIL}</a>
              </div>
            </div>

          </div>
        </section>

        {/* How can we help */}
        <section aria-labelledby="help" className="py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">Choose your path</p>
            <h2 id="help" className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">How can we help you?</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <article className="flex flex-col rounded-3xl border border-border bg-background p-8 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-public-tint text-primary"><UserRound className="h-6 w-6" aria-hidden="true" /></div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-normal text-primary">For customers</p>
                <h3 className="mt-2 text-xl font-bold text-foreground">Customer Support</h3>
                <p className="mt-2">Need help finding a shop, exploring products or using Hisaaboo? We're here to assist you with:</p>
                <HelpList items={CUSTOMER_HELP} />
                <p className="mt-5 text-sm text-muted-foreground">For order-related queries, include the order reference and shop name if available.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link to="/" search={shopsSearch} hash="shops" className="chip inline-flex items-center gap-1.5 rounded-full border border-border bg-public-tint px-3.5 py-1.5 text-sm font-medium text-primary hover:bg-public-tint"><Search className="h-3.5 w-3.5" aria-hidden="true" /> Find a shop or product</Link>
                  <Chip onClick={() => preset("Customer", "Order and tracking")} icon={ShoppingBag}>Order or tracking help</Chip>
                  <Chip onClick={() => preset("Customer", "QR ordering")} icon={QrCode}>QR ordering help</Chip>
                  <Chip onClick={() => preset("Customer", "Account and login")} icon={UserRound}>Account help</Chip>
                </div>
              </article>
              <article className="flex flex-col rounded-3xl bg-public-inverse p-8 text-public-inverse-muted">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-public-highlight/15 text-public-highlight"><Store className="h-6 w-6" aria-hidden="true" /></div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-normal text-public-highlight">For businesses</p>
                <h3 className="mt-2 text-xl font-bold text-public-inverse-foreground">Business & Merchant Support</h3>
                <p className="mt-2">Are you a shopkeeper looking to bring your business online? We can help you with:</p>
                <HelpList items={MERCHANT_HELP} dark />
                <div className="mt-8">
                  <Button type="button" onClick={() => preset("Business Owner", "Storefront setup")} className="h-auto max-w-full whitespace-normal inline-flex items-center gap-2 rounded-lg bg-public-highlight px-5 py-3 font-semibold text-foreground transition-colors hover:bg-public-highlight/90">
                    Contact merchant support <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            </div>

            <div className="mt-6 flex flex-col items-start gap-4 rounded-3xl border border-border bg-muted p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="flex gap-4">
                <Handshake className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">General & Business Enquiries</h3>
                  <p className="mt-1">For partnerships, business collaborations, feedback, suggestions or other enquiries, please contact our team.</p>
                </div>
              </div>
              <Button variant="link" type="button" onClick={() => preset("Other", "Partnership or collaboration")} className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline">Start an enquiry →</Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="get-in-touch" className="border-y border-border bg-muted py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 id="get-in-touch" className="text-3xl font-bold text-foreground">Get in Touch</h2>
              <p className="mt-3">One support team for customers and merchants.</p>
              <dl className="mt-8 grid gap-6 text-base md:grid-cols-2">
                <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><dt className="text-public-copy">Email</dt><dd><a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline-offset-4 hover:text-public-highlight hover:underline">{SUPPORT_EMAIL}</a></dd></div></div>
                <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><dt className="text-public-copy">Business / correspondence address</dt><dd className="font-medium not-italic text-foreground"><address className="not-italic">{ADDRESS}</address></dd></div></div>
              </dl>
            </div>
        </section>

        {/* Form */}
        <section id="message" ref={formRef} aria-labelledby="form-title" className="scroll-mt-20 bg-public-tint/40 py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
            <div>
              <h2 id="form-title" className="text-3xl font-bold text-foreground sm:text-4xl">Send Us a Message</h2>
              <p className="mt-4 text-lg leading-relaxed">Have a question or need assistance? Complete the contact form and share the details of your enquiry.</p>
              <p className="mt-3 leading-relaxed">Our team will review your message and respond through your preferred contact method.</p>
              <div id="privacy-notice" className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-background p-5 text-sm leading-relaxed shadow-sm">
                <p className="flex items-center gap-2 font-semibold text-foreground"><Info className="h-4 w-4 text-primary" aria-hidden="true" /> Your privacy</p>
                <p className="mt-2">Hisaaboo will use the information you provide to review and respond to your enquiry. Please do not submit passwords, banking credentials or unrelated sensitive information.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
              {status === "done" ? (
                <div role="status" aria-live="polite" className="py-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-2xl font-bold text-foreground">Your email is ready to send</h3>
                  <p className="mx-auto mt-3 max-w-md">Use your email app to send your enquiry to <a className="font-semibold text-primary" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Press <strong>Send</strong> there to submit it. If nothing opened, please email us directly.</p>
                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <a href={buildMailto(values)} className="h-auto whitespace-normal inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-public-inverse-foreground hover:bg-primary/90">Open email again</a>
                    <Button variant="outline" type="button" onClick={() => { setValues(emptyContact); setStatus("idle"); }} className="h-auto whitespace-normal inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 font-semibold text-foreground hover:border-primary">Start a new message</Button>
                  </div>
                </div>
              ) : (
                <form noValidate onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
                  <Field id="name" label="Full Name" required error={errors.name}>
                    <input id="f-name" autoComplete="name" value={values.name} onChange={e => set("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "e-name" : undefined} className={inputCls} />
                  </Field>
                  <Field id="email" label="Email Address" required error={errors.email}>
                    <input id="f-email" type="email" autoComplete="email" value={values.email} onChange={e => set("email", e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "e-email" : undefined} className={inputCls} />
                  </Field>
                  <Field id="role" label="I am a" required error={errors.role}>
                    <select id="f-role" value={values.role} onChange={e => { set("role", e.target.value as Role); set("enquiryType", ""); }} aria-invalid={!!errors.role} aria-describedby={errors.role ? "e-role" : undefined} className={inputCls}>
                      <option value="">Select…</option>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field id="enquiryType" label="Enquiry Type" required error={errors.enquiryType}>
                    <select id="f-enquiryType" value={values.enquiryType} disabled={!values.role} onChange={e => set("enquiryType", e.target.value)} aria-invalid={!!errors.enquiryType} aria-describedby={errors.enquiryType ? "e-enquiryType" : undefined} className={`${inputCls} disabled:bg-muted disabled:text-muted-foreground`}>
                      <option value="">{values.role ? "Select…" : "Choose “I am a” first"}</option>
                      {values.role && ENQUIRY_TYPES[values.role].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field id="mobile" label="Mobile Number" hint="Optional — only if you'd like a call back" error={errors.mobile}>
                    <input id="f-mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="10-digit mobile number" value={values.mobile} onChange={e => { set("mobile", e.target.value); if (!e.target.value.trim()) set("preferred", "Email"); }} aria-invalid={!!errors.mobile} aria-describedby={errors.mobile ? "e-mobile" : undefined} className={inputCls} />
                  </Field>
                  {showRef ? (
                    <Field id="reference" label={values.role === "Business Owner" ? "Business Name" : "Order ID or Shop Name"} hint="Optional">
                      <input id="f-reference" value={values.reference} onChange={e => set("reference", e.target.value)} className={inputCls} />
                    </Field>
                  ) : <div className="hidden sm:block" />}
                  <div className="sm:col-span-2">
                    <Field id="subject" label="Subject" required error={errors.subject}>
                      <input id="f-subject" maxLength={150} value={values.subject} onChange={e => set("subject", e.target.value)} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "e-subject" : undefined} className={inputCls} />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field id="message" label="Your Message" required error={errors.message}>
                      <textarea id="f-message" rows={6} maxLength={MESSAGE_MAX} value={values.message} onChange={e => set("message", e.target.value)} aria-invalid={!!errors.message} aria-describedby={`c-message${errors.message ? " e-message" : ""}`} className={`${inputCls} resize-y`} />
                    </Field>
                    <p id="c-message" className="mt-1 text-right text-xs text-muted-foreground">{values.message.length}/{MESSAGE_MAX}</p>
                  </div>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm font-semibold text-foreground">Preferred contact method</legend>
                    <div className="mt-2 flex gap-6 text-sm">
                      {(["Email", "Phone"] as const).map(m => (
                        <label key={m} className="inline-flex items-center gap-2"><input type="radio" name="preferred" disabled={m === "Phone" && !values.mobile.trim()} checked={values.preferred === m} onChange={() => set("preferred", m)} className="h-4 w-4 accent-primary" /> {m}</label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="sm:col-span-2">
                    <label className="flex gap-3 text-sm leading-relaxed">
                      <input id="f-consent" type="checkbox" checked={values.consent} onChange={e => set("consent", e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "e-consent" : undefined} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                      <span>I understand Hisaaboo will use these details only to review and respond to my enquiry, as described in the <a href="#privacy-notice" className="font-semibold text-primary underline underline-offset-4">privacy notice</a>. <span className="text-destructive" aria-hidden="true">*</span></span>
                    </label>
                    {errors.consent && <p id="e-consent" role="alert" className="mt-1 text-sm text-destructive">{errors.consent}</p>}
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">Submitting opens your email app with this message addressed to {SUPPORT_EMAIL}.</p>
                    <Button type="submit" disabled={status === "opening"} className="h-auto whitespace-normal inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-public-inverse-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60">
                      {status === "opening" ? "Opening…" : "Send message"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Orders note */}
        <section aria-labelledby="orders-note" className="py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border-l-4 border-primary bg-muted p-8">
              <h2 id="orders-note" className="flex items-center gap-3 text-2xl font-bold text-foreground"><Briefcase className="h-6 w-6 text-primary" aria-hidden="true" /> A Note About Orders</h2>
              <div className="mt-4 space-y-3 leading-relaxed">
                <p>Hisaaboo helps customers discover and connect with local businesses.</p>
                <p>Product availability, final pricing, order acceptance, fulfilment and shop-specific policies may depend on the individual merchant.</p>
                <p>For an issue involving a particular shop or order, please include the order reference and business name so we can direct your concern appropriately.</p>
              </div>
              <Link to="/track" search={{ code: "", phone: "" }} className="mt-5 inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline">Track a pickup order <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        {/* Stay connected */}
        <section aria-labelledby="cta" className="bg-public-inverse py-16 text-center lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-normal text-public-highlight">Stay connected</p>
            <h2 id="cta" className="mt-3 text-3xl font-bold text-public-inverse-foreground sm:text-4xl">Bringing Local Shops &amp; Customer Together.</h2>
            <p className="mt-3 text-lg text-public-inverse-muted">Follow Hisaaboo for product updates, new features, local business stories and announcements.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/" search={shopsSearch} hash="shops" className="h-auto whitespace-normal inline-flex items-center justify-center gap-2 rounded-lg bg-public-highlight px-6 py-3 font-semibold text-foreground transition-colors hover:bg-public-highlight/90">Explore Local Shops <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/billing" className="h-auto whitespace-normal inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-semibold text-public-inverse-foreground transition-colors hover:border-public-highlight hover:text-public-highlight">Get Started for Your Business</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-public-inverse py-12 text-sm text-public-inverse-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-2xl font-bold text-public-inverse-foreground">Hisaaboo</p><p className="mt-3">Bringing Local Shops &amp; Customer Together.</p><p className="mt-2">Discover locally. Connect directly. Grow together.</p></div>
            <nav aria-label="Product" className="space-y-3"><h2 className="font-semibold text-public-inverse-foreground">Product</h2><Link to="/" search={shopsSearch} hash="features" className="block hover:text-public-highlight">Features</Link><Link to="/" search={shopsSearch} hash="how" className="block hover:text-public-highlight">How It Works</Link><Link to="/billing" className="block hover:text-public-highlight">For Businesses</Link></nav>
            <nav aria-label="Discover and company" className="space-y-3"><h2 className="font-semibold text-public-inverse-foreground">Discover & Company</h2><Link to="/" search={shopsSearch} hash="shops" className="block hover:text-public-highlight">Find Shops</Link><Link to="/about" className="block hover:text-public-highlight">About Us</Link><Link to="/contact" className="block hover:text-public-highlight">Contact Us</Link></nav>
            <nav aria-label="Support" className="space-y-3"><h2 className="font-semibold text-public-inverse-foreground">Support</h2><a href={`mailto:${SUPPORT_EMAIL}`} className="block break-words hover:text-public-highlight">{SUPPORT_EMAIL}</a><Link to="/track" search={{ code: "", phone: "" }} className="block hover:text-public-highlight">Track a pickup order</Link><a href="#privacy-notice" className="block hover:text-public-highlight">Contact privacy notice</a><Button variant="link" onClick={() => preset("Other", "Grievance or complaint")} className="h-auto p-0 text-public-inverse-muted hover:text-public-highlight">Grievance or complaint</Button></nav>
          </div>
          <address className="mt-10 max-w-2xl not-italic leading-relaxed">Business / correspondence address: {ADDRESS}</address>
          <p className="mt-6 border-t border-public-inverse-muted/20 pt-6">© {new Date().getFullYear()} Hisaaboo. Bringing Local Shops &amp; Customer Together.</p>
        </div>
      </footer>
    </div>
  );
}

function HelpList({ items, dark }: { items: string[]; dark?: boolean }) {
  return (
    <ul className="mt-5 flex-1 space-y-3">
      {items.map(i => <li key={i} className="flex gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${dark ? "text-public-highlight" : "text-primary"}`} aria-hidden="true" />{i}</li>)}
    </ul>
  );
}

function Chip({ onClick, icon: Icon, children }: { onClick: () => void; icon: typeof Search; children: React.ReactNode }) {
  return (
    <Button variant="outline" type="button" onClick={onClick} className="h-auto whitespace-normal inline-flex items-center gap-1.5 rounded-full border border-border bg-public-tint px-3.5 py-1.5 text-sm font-medium text-primary hover:bg-public-tint">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {children}
    </Button>
  );
}

function Field({ id, label, required, hint, error, children }: { id: string; label: string; required?: boolean; hint?: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`f-${id}`} className="text-sm font-semibold text-foreground">
        {label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </label>
      {children}
      {error && <p id={`e-${id}`} role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
