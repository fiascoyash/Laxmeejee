import { createFileRoute, Link } from "@tanstack/react-router";
import { HisaabooLogo } from "@/components/brand/HisaabooLogo";
import { ArrowRight, CheckCircle2, FileText, LayoutTemplate, MapPin, Search, Store, Sun } from "lucide-react";
import { normalizeDiscovery } from "@/lib/discovery";
import { heroLocalShopImage } from "@/legacy/components/heroLocalShopImage";
import { FounderPhoto } from "@/components/about/FounderPhoto";

const SITE = "https://hisaaboo.com";
const TITLE = "About Hisaaboo – Our Story & Vision";
const DESCRIPTION =
  "Discover the story behind Hisaaboo, founded in Bijnor, India, to connect local businesses and customers through digital commerce.";
const OG_TITLE = "Our Story – Hisaaboo";
const OG_DESCRIPTION =
  "A local beginning in Bijnor. A bigger ambition to connect neighbourhood businesses and customers.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: OG_TITLE },
      { property: "og:description", content: OG_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/about` },
      { property: "og:site_name", content: "Hisaaboo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: OG_TITLE },
      { name: "twitter:description", content: OG_DESCRIPTION },
      { property: "og:image", content: `${SITE}/og/about-hisaaboo.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Yash, founder of Hisaaboo — Our Story" },
      { name: "twitter:image", content: `${SITE}/og/about-hisaaboo.jpg` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/about` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Hisaaboo",
          url: `${SITE}/about`,
          description: DESCRIPTION,
          about: {
            "@type": "Organization",
            name: "Hisaaboo",
            url: SITE,
            slogan: "Your local market, connected.",
            founder: { "@type": "Person", name: "Yash", image: `${SITE}/og/about-hisaaboo.jpg` },
            foundingLocation: { "@type": "Place", name: "Bijnor, Uttar Pradesh, India" },
          },
        }),
      },
    ],
  }),
  component: AboutPage,
});

const shopsSearch = normalizeDiscovery({});

const TIMELINE = [
  { icon: Store, title: "A family-business need", text: "A billing and quotation solution for M/s S. Kumar Light in Bijnor." },
  { icon: FileText, title: "Billing & quotation tool", text: "Invoices, quotations and a flexible Template Builder." },
  { icon: LayoutTemplate, title: "Wider business tools", text: "Products, stock, customers and everyday operations." },
  { icon: MapPin, title: "Local-commerce vision", text: "Connecting neighbourhood shops with the customers around them." },
];

const FOR_BUSINESSES = [
  "Manage invoices and quotations.",
  "Organise products and business information.",
  "Create digital storefronts.",
  "Showcase products and services online.",
  "Connect with customers through QR codes and digital ordering.",
  "Manage customer orders and everyday business activities.",
];

const FOR_CUSTOMERS = [
  "Discover shops in their locality.",
  "Find specific products and services.",
  "Explore what nearby businesses offer.",
  "Connect with local shopkeepers.",
  "Order and interact with businesses more conveniently.",
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-slate-700">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" search={shopsSearch} className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <HisaabooLogo size={34} /><span className="sr-only">Hisaaboo</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2 text-sm font-medium text-slate-600 sm:gap-6">
            <Link to="/" search={shopsSearch} hash="shops" className="hidden hover:text-emerald-600 sm:inline">Find Shops</Link>
            <Link to="/" search={shopsSearch} hash="features" className="hidden hover:text-emerald-600 md:inline">Features</Link>
            <Link to="/" search={shopsSearch} hash="how" className="hidden hover:text-emerald-600 md:inline">How it works</Link>
            <Link to="/about" aria-current="page" className="hidden font-semibold text-emerald-600 sm:inline">About</Link>
            <Link to="/billing" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700">Login</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* 1. Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-white">
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-24">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Our story</p>
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">About Hisaaboo</h1>
              <p className="mt-4 text-2xl font-semibold text-emerald-700 sm:text-3xl">Your local market, connected.</p>
              <p className="mt-8 max-w-2xl text-lg font-semibold leading-relaxed text-slate-800">
                Every big idea has a beginning. Hisaaboo began with a simple problem in a small business in Bijnor, Uttar Pradesh.
              </p>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
                Today, we are building something bigger: a platform that brings local businesses and their customers closer together.
              </p>
            </div>
            <div className="rounded-3xl bg-slate-900 p-8 text-slate-300 shadow-xl sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">The brand promise</p>
              <p className="mt-4 text-2xl font-bold leading-snug text-white">A personal beginning. A broader local-commerce ambition.</p>
              <dl className="mt-8 space-y-4 text-sm">
                <div className="flex gap-3"><dt className="w-20 shrink-0 text-slate-500">Founder</dt><dd className="font-medium text-white">Yash</dd></div>
                <div className="flex gap-3"><dt className="w-20 shrink-0 text-slate-500">Origin</dt><dd className="font-medium text-white">Bijnor, Uttar Pradesh, India</dd></div>
                <div className="flex gap-3"><dt className="w-20 shrink-0 text-slate-500">Mission</dt><dd className="font-medium text-white">Discover locally. Connect directly. Grow together.</dd></div>
              </dl>
            </div>
          </div>
        </section>

        {/* 2. Origin */}
        <section aria-labelledby="origin" className="py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8">
            <div className="max-w-3xl">
              <h2 id="origin" className="text-3xl font-bold text-slate-900 sm:text-4xl">Where it all started</h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed">
                <p>My name is Yash, and I come from Bijnor, Uttar Pradesh, India. I grew up and studied in the same city, graduating with a Bachelor of Science in Computer Science from Vardhman College, Bijnor.</p>
                <p>The idea behind Hisaaboo came after my father’s firm, M/s S. Kumar Light, was registered as a vendor under the PM Surya Ghar Yojana.</p>
                <p>As I became involved in the business, I realised that we needed a simple billing and quotation solution. I started exploring existing software, looking for something that could create invoices in the style my father preferred.</p>
                <p>I searched through different billing platforms, but I could not find one that offered exactly what we needed.</p>
                <p>I eventually found a product that came close to the invoice design we were looking for. But when I tried to continue using it after the trial period, the subscription cost felt high for the basic set of features we needed. That experience made me think: Could I build something that gives small businesses the flexibility they need without making everyday business tools feel unnecessarily expensive?</p>
                <p>At first, I was not completely serious when I said I could build something myself. It was more of a passing, humorous thought. But the idea stayed with me.</p>
                <p className="text-xl font-semibold text-slate-900">And that is how Hisaaboo began.</p>
              </div>
            </div>
            <aside className="self-start rounded-3xl border border-emerald-100 bg-emerald-50/60 p-8 lg:sticky lg:top-24">
              <Store className="h-10 w-10 text-emerald-600" aria-hidden="true" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">The family business</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">M/s S. Kumar Light</p>
              <p className="mt-1 text-slate-600">Bijnor, Uttar Pradesh</p>
              <p className="mt-6 text-sm leading-relaxed text-slate-600">Registered as a vendor under the PM Surya Ghar Yojana — and the place where the need for a simple, flexible billing and quotation tool first became real.</p>
            </aside>
          </div>
        </section>

        {/* 3. Product evolution */}
        <section aria-labelledby="evolution" className="bg-slate-50 py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="evolution" className="max-w-3xl text-3xl font-bold text-slate-900 sm:text-4xl">From a billing tool to a bigger vision</h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TIMELINE.map((step, i) => (
                <li key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="text-xs font-semibold text-emerald-600">Step {i + 1}</span>
                  <step.icon className="mt-3 h-8 w-8 text-emerald-600" aria-hidden="true" />
                  <h3 className="mt-3 font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 grid gap-6 text-lg leading-relaxed lg:grid-cols-2 lg:gap-12">
              <div className="space-y-5">
                <p>My initial goal was straightforward: build a billing and quotation platform that I could actually use in my father’s business.</p>
                <p>I started developing Hisaaboo with invoices, quotations and a flexible Template Builder that allowed businesses to design their documents according to their own requirements.</p>
                <p>As the project grew, I began looking at established business-management platforms. I discovered how much more they offered, including inventory, stock management, customer records and other operational tools.</p>
              </div>
              <div className="space-y-5">
                <p>For a while, I found myself trying to compete with companies that had large teams, established products and significant resources. Eventually, I understood something important: having a vision does not mean copying everything that already exists. It means understanding which problems matter and building solutions that genuinely make a difference.</p>
                <p>I stopped chasing features simply because other platforms had them. Instead, I started thinking about the problems I could see in my own business and in the businesses around me.</p>
                <p className="font-semibold text-slate-900">That changed the direction of Hisaaboo.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. The insight */}
        <section aria-labelledby="insight" className="py-16 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <h2 id="insight" className="text-3xl font-bold text-slate-900 sm:text-4xl">The idea that changed everything</h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed">
                <p>I began asking myself a simple question: If customers can discover and purchase products through online platforms, why should neighbourhood shops remain difficult to find online?</p>
                <p>Think about a customer looking for a very specific product. Sometimes, they order from a large e-commerce platform, pay more than they expected or wait for delivery, simply because they do not know which nearby shop stocks that particular product.</p>
                <p>At the same time, a shopkeeper in their own city might already have exactly what they are looking for. The customer cannot find the shop, and the shopkeeper cannot reach that customer. Both exist in the same city, but they never connect.</p>
                <p className="text-xl font-semibold text-slate-900">What if we could bring them together?</p>
                <p>That question became the foundation of Hisaaboo’s bigger vision.</p>
              </div>
            </div>
            <figure>
              <img
                src={heroLocalShopImage}
                alt="Illustration of a customer using a phone at a neighbourhood shop counter while the shopkeeper helps"
                width={1100}
                height={924}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-3xl shadow-xl"
              />
              <figcaption className="mt-6 rounded-2xl bg-slate-900 p-6 text-slate-300">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">The central idea</span>
                <span className="mt-2 block text-lg font-semibold leading-snug text-white">Help customers discover local shops and products, while giving local businesses a practical way to be present online and connect with people nearby.</span>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 5. Two audiences */}
        <section aria-labelledby="building" className="bg-gradient-to-b from-emerald-50/50 to-white py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="building" className="text-3xl font-bold text-slate-900 sm:text-4xl">What we are building with Hisaaboo</h2>
            <p className="mt-3 text-lg font-semibold text-slate-700">Hisaaboo is growing into a connected platform for local commerce.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <AudienceCard eyebrow="For businesses" title="For businesses, we want to make it easier to:" items={FOR_BUSINESSES} variant="dark">
                <Link to="/billing" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-900 transition-colors hover:bg-emerald-400">
                  Get Started for Your Business <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </AudienceCard>
              <AudienceCard eyebrow="For customers" title="For customers, we want to make it easier to:" items={FOR_CUSTOMERS} variant="light">
                <Link to="/" search={shopsSearch} hash="shops" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-emerald-700">
                  <Search className="h-4 w-4" aria-hidden="true" /> Explore Local Shops
                </Link>
              </AudienceCard>
            </div>
            <p className="mt-10 max-w-3xl text-lg leading-relaxed">Our goal is not simply to put another shop directory on the internet. We want to make local businesses more accessible and give customers better ways to discover what already exists around them.</p>
          </div>
        </section>

        {/* 6. Founder note — founder photo at the end of the story */}
        <section aria-labelledby="founder-note" className="py-16 lg:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
            <div>
              <h2 id="founder-note" className="text-3xl font-bold text-slate-900 sm:text-4xl">Built from a local beginning, with a bigger ambition</h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed">
                <p>Hisaaboo started in Bijnor, with a problem in my own family business.</p>
                <p>I do not know exactly how far this journey will go. I also understand that building something meaningful takes much more than an idea. It requires listening, experimenting, making mistakes and improving continuously.</p>
                <p>But I want to keep building something that has real value for the people who use it.</p>
                <p>One day, five or ten years from now, I want to look back at 2026 and remember where this journey started.</p>
                <p>What began as an attempt to create a better invoice for my father’s business has become an ambition to connect local businesses and customers through one platform.</p>
                <p className="text-xl font-semibold text-slate-900">And this is only the beginning.</p>
              </div>
            </div>
            <FounderPhoto />
          </div>
        </section>

        {/* 7. Sign-off + CTA */}
        <section aria-labelledby="cta" className="bg-slate-900 py-16 text-center lg:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Hisaaboo</p>
            <h2 id="cta" className="mt-3 text-3xl font-bold text-white sm:text-4xl">Your local market, connected.</h2>
            <p className="mt-3 text-lg text-slate-300">Discover locally. Connect directly. Grow together.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/" search={shopsSearch} hash="shops" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-emerald-400">
                Explore Local Shops <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/billing" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-6 py-3 font-semibold text-white transition-colors hover:border-emerald-400 hover:text-emerald-300">
                Get Started for Your Business
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900 py-8 text-center text-sm text-slate-500">
        <nav aria-label="Footer" className="mb-3 flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link to="/" search={shopsSearch} className="hover:text-emerald-400">Home</Link>
          <Link to="/" search={shopsSearch} hash="shops" className="hover:text-emerald-400">Find Shops</Link>
          <Link to="/" search={shopsSearch} hash="features" className="hover:text-emerald-400">Features</Link>
          <Link to="/" search={shopsSearch} hash="how" className="hover:text-emerald-400">How it works</Link>
          <Link to="/billing" className="hover:text-emerald-400">Login</Link>
        </nav>
        <p>© {new Date().getFullYear()} Hisaaboo. Your local market, connected.</p>
      </footer>
    </div>
  );
}

function AudienceCard({ eyebrow, title, items, variant, children }: { eyebrow: string; title: string; items: string[]; variant: "dark" | "light"; children: React.ReactNode }) {
  const dark = variant === "dark";
  return (
    <article className={dark ? "flex flex-col rounded-3xl bg-slate-900 p-8 text-slate-300" : "flex flex-col rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm"}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-emerald-400" : "text-emerald-600"}`}>{eyebrow}</p>
      <h3 className={`mt-3 text-xl font-bold ${dark ? "text-white" : "text-slate-900"}`}>{title}</h3>
      <ul className="mt-5 flex-1 space-y-3">
        {items.map(item => (
          <li key={item} className="flex gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${dark ? "text-emerald-400" : "text-emerald-600"}`} aria-hidden="true" />{item}</li>
        ))}
      </ul>
      <div className="mt-8">{children}</div>
    </article>
  );
}
