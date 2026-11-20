import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode, type MouseEvent } from "react";
import {
  Sun, FileText, Layers, Boxes, Store, Search, QrCode, ShoppingBag, MapPin,
  Users, ArrowRight, Sparkles, Receipt, LayoutTemplate, Compass, MessageCircle,
} from "lucide-react";
import { normalizeDiscovery } from "@/lib/discovery";
import { founderPhotoUrl } from "@/components/about/founder";

const TITLE = "About Hisaaboo – Our Story & Vision";
const DESC = "Discover the story behind Hisaaboo, founded in Bijnor, India, to connect local businesses and customers through digital commerce.";
const OG_TITLE = "Our Story – Hisaaboo";
const OG_DESC = "A local beginning in Bijnor. A bigger ambition to connect neighbourhood businesses and customers.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "keywords", content: "About Hisaaboo, local commerce platform, digital storefronts, local businesses in India, QR ordering, Bijnor" },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: OG_TITLE },
      { property: "og:description", content: OG_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/about" },
      { property: "og:site_name", content: "Hisaaboo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: OG_TITLE },
      { name: "twitter:description", content: OG_DESC },
    ],
    links: [{ rel: "canonical", href: "/about" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: TITLE,
          description: DESC,
          url: "/about",
          about: { "@type": "Organization", name: "Hisaaboo", slogan: "Your local market, connected." },
        }),
      },
    ],
  }),
  component: AboutPage,
});

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(".about-reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-visible"), io.unobserve(e.target))),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

function tilt(e: MouseEvent<HTMLElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
}
function untilt(e: MouseEvent<HTMLElement>) { e.currentTarget.style.transform = ""; }

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div onMouseMove={tilt} onMouseLeave={untilt} className={`about-glass about-tilt about-reveal rounded-2xl p-6 hover:about-glow ${className}`}>
      {children}
    </div>
  );
}

const timeline = [
  { icon: Store, title: "A family-business need", text: "M/s S. Kumar Light in Bijnor needed simple billing and quotations." },
  { icon: FileText, title: "Billing & quotation tool", text: "Invoices, quotations and a flexible Template Builder." },
  { icon: Boxes, title: "Wider business tools", text: "Learning which problems truly matter for small businesses." },
  { icon: Compass, title: "Local-commerce vision", text: "Connecting neighbourhood shops with customers nearby." },
];

const forBusiness = [
  { icon: Receipt, t: "Manage invoices and quotations" },
  { icon: Layers, t: "Organise products and business information" },
  { icon: LayoutTemplate, t: "Create digital storefronts" },
  { icon: Sparkles, t: "Showcase products and services online" },
  { icon: QrCode, t: "Connect through QR codes and digital ordering" },
  { icon: ShoppingBag, t: "Manage orders and everyday activities" },
];
const forCustomers = [
  { icon: MapPin, t: "Discover shops in their locality" },
  { icon: Search, t: "Find specific products and services" },
  { icon: Compass, t: "Explore what nearby businesses offer" },
  { icon: MessageCircle, t: "Connect with local shopkeepers" },
  { icon: ShoppingBag, t: "Order and interact more conveniently" },
];

function AboutPage() {
  const ref = useReveal();
  const spot = useRef<HTMLDivElement>(null);
  const shopsSearch = normalizeDiscovery({});

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    spot.current?.style.setProperty("--x", `${e.clientX}px`);
    spot.current?.style.setProperty("--y", `${e.clientY}px`);
  };

  return (
    <div ref={ref} onMouseMove={onMove} className="relative min-h-screen overflow-hidden bg-about-bg text-about-text">
      {/* ambient layers */}
      <div aria-hidden className="pointer-events-none fixed inset-0 about-grid" />
      <div aria-hidden className="about-orb bg-about-green" style={{ width: 520, height: 520, top: -160, left: -120 }} />
      <div aria-hidden className="about-orb bg-about-mint" style={{ width: 420, height: 420, top: "40%", right: -140, animationDelay: "-6s" }} />
      <div aria-hidden className="about-orb bg-about-green" style={{ width: 380, height: 380, bottom: -120, left: "30%", animationDelay: "-12s" }} />
      <div
        ref={spot}
        aria-hidden
        className="pointer-events-none fixed inset-0 hidden md:block"
        style={{ background: "radial-gradient(500px circle at var(--x,50%) var(--y,30%), color-mix(in oklab, var(--about-mint) 10%, transparent), transparent 60%)" }}
      />

      {/* nav */}
      <header className="relative z-10">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" search={shopsSearch} className="flex items-center gap-2 font-bold tracking-tight">
            <Sun className="h-7 w-7 text-about-green" aria-hidden /> Hisaaboo
          </Link>
          <div className="flex items-center gap-4 text-sm text-about-muted">
            <Link to="/" search={shopsSearch} className="hover:text-about-mint transition-colors">Home</Link>
            <Link to="/billing" className="rounded-lg bg-about-green px-4 py-2 font-semibold text-about-bg transition hover:opacity-90">Start Free</Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* hero */}
        <section className="py-14 text-center sm:py-28">
          <p className="about-reveal mb-5 inline-flex items-center gap-2 rounded-full about-glass px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] sm:px-4 sm:text-xs sm:tracking-[0.2em] text-about-mint">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Founded in Bijnor, Uttar Pradesh
          </p>
          <h1 className="about-reveal text-4xl font-extrabold tracking-tight sm:text-7xl">About <span className="about-gradient-text">Hisaaboo</span></h1>
          <p className="about-reveal mt-5 text-2xl font-semibold text-about-mint sm:text-3xl">Your local market, connected.</p>
          <p className="about-reveal mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-about-muted">
            Every big idea has a beginning. Hisaaboo began with a simple problem in a small business in Bijnor, Uttar Pradesh.
            Today, we are building something bigger: a platform that brings local businesses and their customers closer together.
          </p>
        </section>

        {/* origin */}
        <section aria-labelledby="origin" className="grid gap-10 py-16 lg:grid-cols-5">
          <div className="lg:col-span-3 about-reveal space-y-5 text-lg leading-relaxed text-about-muted">
            <h2 id="origin" className="text-3xl font-bold text-about-text sm:text-4xl">Where it all started</h2>
            <p>My name is Yash, and I come from Bijnor, Uttar Pradesh, India. I grew up and studied in the same city, graduating with a Bachelor of Science in Computer Science from Vardhman College, Bijnor.</p>
            <p>The idea behind Hisaaboo came after my father’s firm, <strong className="text-about-text">M/s S. Kumar Light</strong>, was registered as a vendor under the PM Surya Ghar Yojana.</p>
            <p>As I became involved in the business, I realised that we needed a simple billing and quotation solution. I started exploring existing software, looking for something that could create invoices in the style my father preferred. I searched through different billing platforms, but I could not find one that offered exactly what we needed.</p>
            <p>I eventually found a product that came close to the invoice design we were looking for. But when I tried to continue using it after the trial period, the subscription cost felt high for the basic set of features we needed.</p>
            <p>At first, I was not completely serious when I said I could build something myself. It was more of a passing, humorous thought. But the idea stayed with me. <span className="text-about-mint">And that is how Hisaaboo began.</span></p>
          </div>
          <div className="lg:col-span-2 flex items-center">
            <Card className="w-full">
              <p className="text-sm uppercase tracking-widest text-about-mint">The question that started it</p>
              <blockquote className="mt-4 text-xl font-semibold leading-snug sm:text-2xl">
                “Could I build something that gives small businesses the flexibility they need without making everyday business tools feel unnecessarily expensive?”
              </blockquote>
            </Card>
          </div>
        </section>

        {/* evolution */}
        <section aria-labelledby="evolution" className="py-16">
          <h2 id="evolution" className="about-reveal text-3xl font-bold sm:text-4xl">From a billing tool to a bigger vision</h2>
          <div className="about-reveal mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-about-muted">
            <p>My initial goal was straightforward: build a billing and quotation platform that I could actually use in my father’s business. I started developing Hisaaboo with invoices, quotations and a flexible Template Builder that allowed businesses to design their documents according to their own requirements.</p>
            <p>As the project grew, I discovered how much more established platforms offered. For a while, I found myself trying to compete with companies that had large teams and significant resources. Eventually, I understood something important: having a vision does not mean copying everything that already exists. It means understanding which problems matter and building solutions that genuinely make a difference.</p>
            <p>I stopped chasing features simply because other platforms had them. That changed the direction of Hisaaboo.</p>
          </div>
          <ol className="relative mt-12 grid gap-5 md:grid-cols-4">
            <div aria-hidden className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-about-green to-transparent md:block" />
            {timeline.map((s, i) => (
              <li key={s.title} className="about-reveal" style={{ transitionDelay: `${i * 120}ms` }}>
                <Card className="h-full">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-about-green/15 text-about-mint about-glow">
                    <s.icon className="h-6 w-6" aria-hidden />
                  </div>
                  <p className="text-xs font-mono text-about-mint">0{i + 1}</p>
                  <h3 className="mt-1 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-about-muted">{s.text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* insight */}
        <section aria-labelledby="insight" className="py-16">
          <div className="about-reveal about-glass relative overflow-hidden rounded-3xl p-5 sm:p-12">
            <h2 id="insight" className="text-3xl font-bold sm:text-4xl">The idea that changed everything</h2>
            <p className="mt-5 max-w-3xl text-xl text-about-mint">If customers can discover and purchase products through online platforms, why should neighbourhood shops remain difficult to find online?</p>
            <div className="mt-8 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-2xl border border-about-line p-5">
                <Users className="h-7 w-7 text-about-mint" aria-hidden />
                <h3 className="mt-3 font-semibold">The customer</h3>
                <p className="mt-1 text-sm text-about-muted">Looking for a specific product — often ordering online, paying more or waiting, because they don’t know which nearby shop has it.</p>
              </div>
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <span aria-hidden className="about-ring opacity-60" />
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-about-bg text-sm font-bold text-about-mint">?</span>
              </div>
              <div className="rounded-2xl border border-about-line p-5">
                <Store className="h-7 w-7 text-about-mint" aria-hidden />
                <h3 className="mt-3 font-semibold">The shopkeeper</h3>
                <p className="mt-1 text-sm text-about-muted">In the same city, already stocking exactly that product — but unable to reach that customer.</p>
              </div>
            </div>
            <p className="mt-8 text-lg text-about-muted">Both exist in the same city, but they never connect. <strong className="text-about-text">What if we could bring them together?</strong> That question became the foundation of Hisaaboo’s bigger vision.</p>
          </div>
        </section>

        {/* audiences */}
        <section aria-labelledby="building" className="py-16">
          <h2 id="building" className="about-reveal text-3xl font-bold sm:text-4xl">What we are building with Hisaaboo</h2>
          <p className="about-reveal mt-4 max-w-3xl text-lg text-about-muted">Hisaaboo is growing into a connected platform for local commerce. Some of this is available today and some is still on the way.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[
              { title: "For businesses", lead: "We want to make it easier to:", items: forBusiness, cta: <Link to="/billing" className="inline-flex items-center gap-2 font-semibold text-about-mint hover:underline">Get started for your business <ArrowRight className="h-4 w-4" aria-hidden /></Link> },
              { title: "For customers", lead: "We want to make it easier to:", items: forCustomers, cta: <Link to="/" search={shopsSearch} hash="shops" className="inline-flex items-center gap-2 font-semibold text-about-mint hover:underline">Explore local shops <ArrowRight className="h-4 w-4" aria-hidden /></Link> },
            ].map((a) => (
              <Card key={a.title} className="flex flex-col">
                <h3 className="text-2xl font-bold">{a.title}</h3>
                <p className="mt-1 text-about-muted">{a.lead}</p>
                <ul className="mt-5 flex-1 space-y-3">
                  {a.items.map((it) => (
                    <li key={it.t} className="flex items-start gap-3">
                      <it.icon className="mt-0.5 h-5 w-5 shrink-0 text-about-green" aria-hidden />
                      <span>{it.t}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">{a.cta}</div>
              </Card>
            ))}
          </div>
          <p className="about-reveal mt-8 max-w-3xl text-lg text-about-muted">Our goal is not simply to put another shop directory on the internet. We want to make local businesses more accessible and give customers better ways to discover what already exists around them.</p>
        </section>

        {/* founder note */}
        <section aria-labelledby="founder" className="py-16">
          <div className="about-reveal about-glass grid items-center gap-10 rounded-3xl p-5 sm:p-12 md:grid-cols-[auto_1fr]">
            <div className="relative mx-auto h-52 w-52 sm:h-64 sm:w-64">
              <span aria-hidden className="about-ring" />
              <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-about-bg bg-about-bg">
                {founderPhotoUrl ? (
                  <img src={founderPhotoUrl} alt="Yash, founder of Hisaaboo" loading="lazy" width={512} height={512} className="h-full w-full object-cover" style={{ objectPosition: "50% 28%" }} />
                ) : (
                  <div role="img" aria-label="Yash, founder of Hisaaboo" className="flex h-full w-full items-center justify-center text-7xl font-extrabold about-gradient-text">Y</div>
                )}
              </div>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-about-muted">
              <h2 id="founder" className="text-3xl font-bold text-about-text sm:text-4xl">Built from a local beginning, with a bigger ambition</h2>
              <p>Hisaaboo started in Bijnor, with a problem in my own family business. I do not know exactly how far this journey will go. Building something meaningful takes much more than an idea — it requires listening, experimenting, making mistakes and improving continuously.</p>
              <p>But I want to keep building something that has real value for the people who use it. One day, five or ten years from now, I want to look back at 2026 and remember where this journey started.</p>
              <p>What began as an attempt to create a better invoice for my father’s business has become an ambition to connect local businesses and customers through one platform. <span className="text-about-mint">And this is only the beginning.</span></p>
              <p className="pt-2 font-semibold text-about-text">— Yash, Founder</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta" className="py-20 text-center">
          <p className="about-reveal text-sm font-bold uppercase tracking-[0.3em] text-about-mint">Hisaaboo</p>
          <h2 id="cta" className="about-reveal mt-3 text-4xl font-extrabold sm:text-5xl"><span className="about-gradient-text">Your local market, connected.</span></h2>
          <p className="about-reveal mt-4 text-lg text-about-muted">Discover locally. Connect directly. Grow together.</p>
          <div className="about-reveal mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/" search={shopsSearch} hash="shops" className="about-glass rounded-xl px-6 py-3 font-semibold transition hover:about-glow">Explore Local Shops</Link>
            <Link to="/billing" className="rounded-xl bg-about-green px-6 py-3 font-semibold text-about-bg transition about-glow hover:opacity-90">Get Started for Your Business</Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-about-line py-8 text-center text-sm text-about-muted">
        © {new Date().getFullYear()} Hisaaboo. Made in Bijnor, for local businesses across India.
      </footer>
    </div>
  );
}
