import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowDown, ArrowRight, MapPin, Sun, Store, Search, FileText, QrCode, Quote, GraduationCap, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeDiscovery } from '@/lib/discovery';
import portrait from '@/assets/yash-hisaaboo.webp.asset.json';

const title = 'About Hisaaboo – Our Story & Vision';
const description = 'Discover the story behind Hisaaboo, founded in Bijnor, India, to connect local businesses and customers through digital commerce.';
const homeSearch = normalizeDiscovery({});

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title }, { name: 'description', content: description },
      { property: 'og:title', content: 'Our Story – Hisaaboo' },
      { property: 'og:description', content: 'A local beginning in Bijnor. A bigger ambition to connect neighbourhood businesses and customers.' },
      { property: 'og:type', content: 'website' }, { property: 'og:url', content: 'https://hisaaboo.com/about' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title }, { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: 'https://hisaaboo.com/about' }],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify({
      '@context': 'https://schema.org', '@type': 'AboutPage', '@id': 'https://hisaaboo.com/about#page',
      url: 'https://hisaaboo.com/about', name: title, description,
      mainEntity: { '@type': 'Organization', name: 'Hisaaboo', url: 'https://hisaaboo.com/',
        slogan: 'Your local market, connected.', founder: { '@type': 'Person', name: 'Yash',
          homeLocation: { '@type': 'Place', name: 'Bijnor, Uttar Pradesh, India' },
          alumniOf: { '@type': 'CollegeOrUniversity', name: 'Vardhman College, Bijnor' } } },
    }) }],
  }),
  component: AboutPage,
});

function BusinessLink({ label = 'Get started for your business' }: { label?: string }) {
  return <Button asChild className="about-cta h-auto min-h-11 whitespace-normal px-5 py-3"><Link to="/billing">{label}<ArrowRight aria-hidden="true" /></Link></Button>;
}

function AboutPage() {
  return <div className="about-page">
    <header className="about-header">
      <nav aria-label="Main navigation" className="about-wrap flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
        <Link to="/" search={homeSearch} className="flex items-center gap-2 text-xl font-bold"><Sun className="size-7 text-about-green" aria-hidden="true" />Hisaaboo</Link>
        <div className="flex items-center gap-3 sm:gap-6 text-sm"><Link to="/" search={homeSearch} className="hidden sm:block">Explore shops</Link><span aria-current="page" className="text-about-green">Our story</span><BusinessLink label="For businesses" /></div>
      </nav>
    </header>
    <main id="main-content">
      <section className="about-hero" aria-labelledby="about-title">
        <img src={portrait.url} alt="Yash, founder of Hisaaboo" width="620" height="822" fetchPriority="high" className="about-hero-photo" />
        <div className="about-hero-shade" aria-hidden="true" />
        <div className="about-wrap relative z-10 py-16 sm:py-24">
          <p className="about-eyebrow text-about-mint">A LOCAL BEGINNING. A BIGGER AMBITION.</p>
          <h1 id="about-title" className="mt-6 text-5xl font-semibold sm:text-7xl">About{' '}<br />Hisaaboo<span className="text-about-green">.</span></h1>
          <p className="mt-6 max-w-md text-2xl text-about-mint">Your local market, connected.</p>
          <p className="mt-5 max-w-md text-base leading-7 text-about-soft">Every big idea has a beginning. Ours began with a simple problem in a small business in Bijnor, Uttar Pradesh.</p>
          <a href="#beginning" className="mt-8 inline-flex items-center gap-3 text-sm font-medium text-about-mint">Meet the story behind Hisaaboo<ArrowDown className="size-4" aria-hidden="true" /></a>
        </div>
        <div className="about-photo-caption"><span className="text-sm font-semibold">Yash</span><span className="text-xs text-about-soft">Founder · Bijnor, India</span></div>
      </section>
      <div className="about-origin-strip"><div className="about-wrap flex flex-wrap justify-between gap-5 py-6 text-sm"><span className="flex items-center gap-2"><MapPin className="size-4" aria-hidden="true" />ROOTED IN BIJNOR, INDIA</span><span>Built from a real family-business need</span><span className="text-about-green">Growing towards connected local commerce ↗</span></div></div>

      <section id="beginning" className="about-wrap about-section grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div><p className="about-eyebrow">01 / THE BEGINNING</p><h2 className="about-heading mt-4">A better invoice.<br />An unexpected beginning.</h2><div className="mt-8 flex items-start gap-3 text-sm text-muted-foreground"><GraduationCap className="size-6 shrink-0 text-about-green" aria-hidden="true" /><p>B.Sc. Computer Science<br /><span className="text-foreground">Vardhman College, Bijnor</span></p></div></div>
        <div className="about-prose"><p>My name is Yash, and I come from Bijnor, Uttar Pradesh, India. I grew up and studied in the same city. The idea behind Hisaaboo came after my father’s firm, <strong>M/s S. Kumar Light</strong>, was registered as a vendor under the PM Surya Ghar Yojana.</p><p>As I became involved in the business, I realised that we needed a simple billing and quotation solution—one that could create invoices in the style my father preferred.</p><p>I searched through different billing platforms. One came close, but after the trial period, the subscription cost felt high for the basic features we needed. It made me wonder: could I build something that gave small businesses more flexibility without making everyday tools feel unnecessarily expensive?</p><p>At first, saying “I could build it myself” was almost a joke. <strong>But the idea stayed with me. And that is how Hisaaboo began.</strong></p></div>
      </section>

      <section className="about-evolution about-section">
        <div className="about-wrap"><p className="about-eyebrow">02 / THE EVOLUTION</p><div className="mt-4 grid gap-5 md:grid-cols-2"><h2 className="about-heading">From a billing tool<br />to a bigger vision.</h2><p className="about-prose">Having a vision does not mean copying everything that already exists. It means understanding which problems matter—and building solutions that genuinely make a difference.</p></div>
          <ol className="about-timeline mt-12 grid gap-8 md:grid-cols-4">
            {[
              { icon: HeartHandshake, title: 'A family-business need', text: 'A practical problem in my father’s business: invoices that worked the way we needed.' },
              { icon: FileText, title: 'The first building blocks', text: 'Invoices, quotations and a flexible Template Builder to shape our own documents.' },
              { icon: Store, title: 'A change in perspective', text: 'I stopped chasing features and started listening to the problems in businesses around me.' },
              { icon: QrCode, title: 'A connected local market', text: 'A broader vision: help neighbourhood businesses and nearby customers find one another.' },
            ].map((step, index) => <li key={step.title} className="relative"><div className="mb-6 flex items-center justify-between"><step.icon className="size-7 text-about-green" aria-hidden="true" /><span className="font-mono text-sm text-muted-foreground">0{index + 1}</span></div><h3 className="text-lg font-semibold">{step.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="about-insight about-section"><div className="about-wrap grid items-center gap-12 lg:grid-cols-2">
        <div><p className="about-eyebrow text-about-mint">03 / THE CONNECTION</p><h2 className="about-heading mt-5">The right product.<br />The nearby shop.<br /><span className="text-about-mint">The missing connection.</span></h2><div className="about-prose mt-6 text-about-soft"><p>Sometimes a customer orders online and waits for delivery, simply because they do not know which nearby shop stocks what they need.</p><p>A shopkeeper in the same city might already have exactly that product. The customer cannot find the shop, and the shopkeeper cannot reach that customer.</p><p className="text-about-ink text-xl font-medium">What if we could bring them together?</p></div></div>
        <div className="about-connection" aria-label="Hisaaboo connects a customer looking for a product with a nearby shop stocking it"><div className="flex justify-between gap-4"><div className="flex-1"><Search className="mx-auto size-10" aria-hidden="true" /><p className="mt-5 text-lg font-medium">Looking for it</p><p className="mt-2 text-sm text-about-soft">A customer nearby</p></div><div className="flex-1"><Store className="mx-auto size-10" aria-hidden="true" /><p className="mt-5 text-lg font-medium">Already stocking it</p><p className="mt-2 text-sm text-about-soft">A local shopkeeper</p></div></div><div className="about-connection-line" aria-hidden="true" /><div className="flex items-center justify-center gap-3 text-2xl font-semibold text-about-mint"><Sun aria-hidden="true" />Hisaaboo</div><p className="mt-3 text-sm text-about-soft">Discover locally. Connect directly.</p></div>
      </div></section>

      <section className="about-wrap about-section"><p className="about-eyebrow">04 / WHAT WE ARE BUILDING</p><h2 className="about-heading mt-4">Two sides of the same neighbourhood.</h2><p className="about-prose mt-5 max-w-2xl">We are growing towards a connected platform for local commerce. Not simply another shop directory, but a way to make local businesses more accessible and help people discover what already exists around them.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="about-audience"><Store className="size-8 text-about-green" aria-hidden="true" /><h3 className="mt-5 text-2xl font-semibold">For businesses</h3><p className="mt-3 text-muted-foreground">Practical tools today. A more connected tomorrow.</p><ul className="mt-6 space-y-3 text-sm leading-6"><li>Manage invoices and quotations.</li><li>Organise products and business information.</li><li>Create digital storefronts and showcase your catalogue.</li><li>Our ambition: deepen QR ordering, customer connections and everyday business tools.</li></ul><div className="mt-8"><BusinessLink /></div></article>
          <article className="about-audience about-audience-mint"><Search className="size-8 text-about-green" aria-hidden="true" /><h3 className="mt-5 text-2xl font-semibold">For customers</h3><p className="mt-3 text-muted-foreground">Your next discovery could be just around the corner.</p><ul className="mt-6 space-y-3 text-sm leading-6"><li>Discover shops in your locality.</li><li>Find products and explore nearby catalogues.</li><li>Connect with local shopkeepers and order for pickup.</li><li>Our ambition: make local discovery and interactions even more convenient.</li></ul><Button asChild variant="outline" className="mt-8 h-auto min-h-11 whitespace-normal px-5 py-3"><Link to="/" search={homeSearch} hash="shops">Explore local shops<ArrowRight aria-hidden="true" /></Link></Button></article>
        </div>
      </section>

      <section className="about-founder-note about-section"><div className="about-wrap grid gap-10 md:grid-cols-[240px_1fr]"><figure><img src={portrait.url} alt="Portrait of Yash, Hisaaboo’s founder" width="620" height="822" loading="lazy" className="aspect-[3/4] w-full max-w-60 rounded-md object-cover" /><figcaption className="mt-4 text-lg font-semibold">Yash <span className="block text-sm font-normal text-muted-foreground">Founder, Hisaaboo</span></figcaption></figure><div><p className="about-eyebrow">05 / A NOTE FROM THE FOUNDER</p><Quote className="mt-6 size-9 text-about-green" aria-hidden="true" /><blockquote className="mt-4 text-2xl font-medium leading-relaxed sm:text-3xl">“I want to keep building something that has real value for the people who use it.”</blockquote><div className="about-prose mt-6"><p>I do not know exactly how far this journey will go. Building something meaningful requires listening, experimenting, making mistakes and improving continuously.</p><p>One day, five or ten years from now, I want to look back at 2026 and remember where this journey started. What began as an attempt to create a better invoice for my father’s business has become an ambition to connect local businesses and customers through one platform.</p><p className="font-semibold text-foreground">And this is only the beginning.</p></div></div></div></section>

      <section className="about-wrap py-16 text-center sm:py-24"><p className="about-eyebrow">DISCOVER LOCALLY. CONNECT DIRECTLY. GROW TOGETHER.</p><h2 className="about-heading mt-5">Your local market, connected.</h2><div className="mt-8 flex flex-wrap justify-center gap-4"><BusinessLink /><Button asChild variant="outline" className="h-11"><Link to="/" search={homeSearch} hash="shops">Explore local shops<ArrowRight aria-hidden="true" /></Link></Button></div></section>
    </main>
    <footer className="about-footer"><div className="about-wrap flex flex-wrap items-center justify-between gap-5 py-8 text-sm"><Link to="/" search={homeSearch} className="flex items-center gap-2 text-lg font-semibold"><Sun className="size-5 text-about-mint" aria-hidden="true" />Hisaaboo</Link><p>Your local market, connected.</p><Link to="/" search={homeSearch}>Back to home ↗</Link></div></footer>
  </div>;
}