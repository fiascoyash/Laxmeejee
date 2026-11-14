// @ts-nocheck -- original Hisaaboo code, type-checked loosely
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import heroShop from '@/assets/hero-local-shop.jpg';
import {
  Sun, FileText, Receipt, Users, Truck, BarChart3, Package, Calculator,
  ArrowRight, CheckCircle2, IndianRupee, TrendingUp, Zap, ShieldCheck,
  Smartphone, Printer, FileDown, Sparkles, BookOpen, Clock,
  Store, QrCode, ShoppingBag, BellRing, Cloud, Search,
} from 'lucide-react';

interface Props {
  onEnterApp: () => void;
  /** Customer shop search shown inside the hero. */
  heroSearch?: ReactNode;
  /** Live local shop directory shown right after the hero. */
  directory?: ReactNode;
}

const BRAND_SCRIPTS = [
  'Hisaaboo',
  'हिसाबू',
  'ਹਿਸਾਬੂ',
  'હિસાબૂ',
  'হিসাবু',
  'హిసాబూ',
  'ಹಿಸಾಬೂ',
  'ഹിസാബൂ',
  'हिसाबू',
];

const SCRIPT_LABELS: Record<string, string> = {
  'Hisaaboo': 'English',
  'हिसाबू': 'हिन्दी',
  'ਹਿਸਾਬੂ': 'ਪੰਜਾਬੀ',
  'હિસાબૂ': 'ગુજરાતી',
  'হিসাবু': 'বাংলা',
  'హిసాబూ': 'తెలుగు',
  'ಹಿಸಾಬೂ': 'ಕನ್ನಡ',
  'ഹിസാബൂ': 'മലയാളം',
};

function MultilingualBrand() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'active' | 'exit-up' | 'exit-down'>('active');

  useEffect(() => {
    const cycleMs = 2800;
    const transitionMs = 600;
    const timer = setInterval(() => {
      setPhase('exit-up');
      setTimeout(() => {
        setIndex(prev => (prev + 1) % BRAND_SCRIPTS.length);
        setPhase('active');
      }, transitionMs);
    }, cycleMs);
    return () => clearInterval(timer);
  }, []);

  const current = BRAND_SCRIPTS[index];

  return (
    <div className="landing-brand-stack h-[1.2em] overflow-hidden">
      <span
        className={`landing-brand-layer ${phase === 'active' ? 'active' : phase}`}
        style={{ fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit' }}
      >
        {current}
      </span>
      <span className="opacity-0 pointer-events-none" aria-hidden="true">{current}</span>
    </div>
  );
}

function FloatingBadge({
  icon: Icon, label, sublabel, className, delay, color = 'emerald',
}: {
  icon: typeof FileText; label: string; sublabel?: string; className: string; delay: string; color?: 'emerald' | 'blue' | 'amber' | 'violet';
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue: { bg: 'bg-sky-50', text: 'text-sky-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  };
  const c = colorMap[color];
  return (
    <div
      className={`absolute flex items-center gap-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 px-3.5 py-2.5 ${className}`}
      style={{
        animation: `floatGentle 4.5s ease-in-out infinite ${delay}, floatCard 0.6s ease-out both`,
      }}
    >
      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        {sublabel && <span className="text-[10px] text-slate-400">{sublabel}</span>}
      </div>
    </div>
  );
}

function CounterNumber({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1500;
          const steps = 40;
          const increment = value / steps;
          let current = 0;
          const interval = setInterval(() => {
            current += increment;
            if (current >= value) {
              setDisplay(value);
              clearInterval(interval);
            } else {
              setDisplay(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-emerald-600" style={{ animation: 'countUp 0.5s ease-out both' }}>
        {display.toLocaleString('en-IN')}{suffix}
      </div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

const FEATURES = [
  { icon: Receipt, title: 'Professional Invoices', desc: 'Create GST-compliant invoices with automatic tax calculation, round-off, and multiple status tracking.' },
  { icon: FileText, title: 'Quotations', desc: 'Build detailed quotations with custom templates, product catalogs, and one-click conversion to invoices.' },
  { icon: IndianRupee, title: 'Payment Tracking', desc: 'Record partial and full payments, track outstanding amounts, and keep your cash flow clear.' },
  { icon: Users, title: 'Customer Khata', desc: 'Maintain a full customer database with history of quotations, invoices, and payments at a glance.' },
  { icon: Truck, title: 'Supplier Ledger', desc: 'Track suppliers, purchases, and vendor transactions in a dedicated supplier ledger.' },
  { icon: BarChart3, title: 'GST Reports', desc: 'Generate GSTR-1, sales register, purchase register, and HSN summaries ready for filing.' },
  { icon: Package, title: 'Product Catalog', desc: 'Store products with SKU, HSN codes, GST rates, and pricing for instant reuse on any document.' },
  { icon: Zap, title: 'Smart Bill Import', desc: 'Import supplier bills from PDF and auto-match products to your catalog in seconds.' },
  { icon: Printer, title: 'Print & PDF', desc: 'Print directly or export professional PDFs with your custom template and branding.' },
];

const STEPS = [
  { icon: FileText, title: 'Create Quotation', desc: 'Pick a template, add products from your catalog, and generate a branded quotation in minutes.' },
  { icon: Receipt, title: 'Convert to Invoice', desc: 'Turn any quotation into an invoice with one click — all details carry over automatically.' },
  { icon: IndianRupee, title: 'Record Payment', desc: 'Log partial or full payments and let Hisaaboo update the invoice status for you.' },
  { icon: BarChart3, title: 'File GST Reports', desc: 'Pull up sales registers, GSTR-1 summaries, and HSN reports whenever you need them.' },
];

const NEW_FEATURES = [
  { icon: Store, title: 'Your Own Shop Page', desc: 'Every shop gets a public web page with its products, prices, timings and address.' },
  { icon: QrCode, title: 'Counter QR Standee', desc: 'Print a QR code for your counter — customers scan it to open your shop page.' },
  { icon: ShoppingBag, title: 'Order for Pickup', desc: 'Customers order from their phone without any app and get a 6-digit pickup code.' },
  { icon: BellRing, title: 'Live Order Chime', desc: 'A sound and alert plays on your billing screen the moment a new order arrives.' },
  { icon: Zap, title: '1-Click GST Bill', desc: 'Turn any pickup order into a GST invoice with customer, items and rates already filled.' },
  { icon: Search, title: 'Local Shop Search', desc: 'Customers find your shop and products by city, locality and category.' },
  { icon: BarChart3, title: 'GSTR-1, 2B & 3B Tools', desc: 'GSTR-1 JSON export, GSTR-2B analyser and GSTR-3B preparation in one place.' },
  { icon: Cloud, title: 'Secure Cloud Account', desc: 'Sign in from any device; each shop’s records stay private to that shop.' },
];

const WHY = [
  { icon: ShieldCheck, title: 'Built for Indian GST', desc: 'CGST/SGST, HSN codes, inclusive/exclusive GST modes — all handled correctly out of the box.' },
  { icon: Smartphone, title: 'Works on Any Device', desc: 'Desktop, laptop, tablet, or mobile — your billing desk travels with you.' },
  { icon: BookOpen, title: 'Khata Book Digitized', desc: 'Replace paper ledgers with a searchable, permanent record of every customer and transaction.' },
  { icon: Clock, title: 'Save Time Daily', desc: 'Auto-numbering, product autocomplete, and reusable templates cut billing time to minutes.' },
];

export function LandingPage({ onEnterApp, heroSearch, directory }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToFeatures = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Sun className="w-7 h-7 text-emerald-500" />
            <span className={`text-xl font-bold tracking-tight ${scrolled ? 'text-slate-800' : 'text-slate-800'}`}>Hisaaboo</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            {directory && <button onClick={() => document.getElementById('shops')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-600 transition-colors">Find Shops</button>}
            <button onClick={() => document.getElementById('new')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-600 transition-colors">What's New</button>
            <button onClick={scrollToFeatures} className="hover:text-emerald-600 transition-colors">Features</button>
            <button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-600 transition-colors">How it works</button>
            <button onClick={() => document.getElementById('why')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-600 transition-colors">Why Hisaaboo</button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onEnterApp}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 transition-colors"
            >
              Login
            </button>
            <button
              onClick={onEnterApp}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
            >
              Start Free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 via-white to-white" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl landing-pulse-glow" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-teal-100/20 rounded-full blur-3xl landing-pulse-glow" style={{ animationDelay: '1.5s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            {/* Multilingual brand */}
            <div className="landing-fade-up mb-6 flex flex-col items-center lg:items-start gap-2">
              <div className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight h-[1.1em] flex items-center">
                <MultilingualBrand />
              </div>
              <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                {SCRIPT_LABELS[BRAND_SCRIPTS[0]]} · {SCRIPT_LABELS[BRAND_SCRIPTS[1]]} · {SCRIPT_LABELS[BRAND_SCRIPTS[3]]} · {SCRIPT_LABELS[BRAND_SCRIPTS[4]]}
              </span>
            </div>

            <p className="landing-fade-up text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3" style={{ animationDelay: '0.1s' }}>One platform for local commerce</p>
            <h1 className="landing-fade-up text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4" style={{ animationDelay: '0.15s' }}>
              Your local market, connected.
            </h1>
            <p className="landing-fade-up text-base text-slate-600 mb-8 max-w-lg mx-auto lg:mx-0" style={{ animationDelay: '0.25s' }}>
              Discover nearby shops, explore products and order with ease. Run your business with digital storefronts, QR ordering, order management and GST billing — all in one place.
            </p>

            {heroSearch && <div className="landing-fade-up mb-6 max-w-xl mx-auto lg:mx-0 text-left" style={{ animationDelay: '0.35s' }}>{heroSearch}</div>}

            <div className="landing-fade-up flex flex-col sm:flex-row gap-3 justify-center lg:justify-start" style={{ animationDelay: '0.4s' }}>
              <button
                onClick={() => document.getElementById(directory ? 'shops' : 'features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 group"
              >
                Explore Local Shops
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => document.getElementById('experiences')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                I'm a Business Owner
              </button>
            </div>

            <div className="landing-fade-up mt-8 flex items-center gap-4 justify-center lg:justify-start text-sm text-slate-400" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No setup needed</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> GST-ready</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Free to start</div>
            </div>
          </div>

          {/* Right: Vyapari illustration */}
          <div className="landing-slide-right relative" style={{ animationDelay: '0.3s' }}>
            <div className="relative">
              <img src={heroShop} alt="Customer confirming a pickup order with a shopkeeper at a neighbourhood store" width={1200} height={1008} className="w-full h-auto rounded-3xl shadow-2xl shadow-emerald-900/15" />
              <div className="absolute -left-2 sm:-left-4 top-6 bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 landing-float">⚡ 1-Click Pickup · Ready in store</div>
              <div className="absolute -right-2 sm:-right-4 top-1/2 bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 landing-float" style={{ animationDelay: '1s' }}>🔔 Live Order Chime</div>
              <div className="absolute left-4 -bottom-4 bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 landing-float" style={{ animationDelay: '2s' }}>🧾 GST Invoices & Khata</div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6">
          <CounterNumber value={9} label="Indian scripts" />
          <CounterNumber value={8} suffix="+" label="Core features" />
          <CounterNumber value={3} label="GST modes" />
          <CounterNumber value={100} suffix="%" label="Indian businesses" />
        </div>
      </section>

      <section id="experiences" className="py-20 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-12">One Hisaaboo. Two connected experiences.</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-8">
              <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase mb-2">For customers</p>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Discover local. Shop with ease.</h3>
              <ul className="space-y-2 text-slate-600 mb-6">
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />Find nearby shops and products with clear prices</li>
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />Order from the shop page or counter QR — no app needed</li>
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />Get a pickup code and collect in store</li>
              </ul>
              <button onClick={() => document.getElementById(directory ? 'shops' : 'features')?.scrollIntoView({ behavior: 'smooth' })} className="px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700">Explore Local Shops</button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
              <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-2">For businesses</p>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Bring your business online.</h3>
              <ul className="space-y-2 text-slate-600 mb-6">
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />Publish a shop page with a shareable link and counter QR</li>
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />Receive live pickup orders with a sound alert</li>
                <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />Turn orders into GST bills in one click, plus khata and GST reports</li>
              </ul>
              <div className="flex gap-3">
                <button onClick={onEnterApp} className="px-5 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800">Start Free</button>
                <button onClick={onEnterApp} className="px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-white">Merchant Login</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {directory && <section id="shops" className="py-16 bg-white scroll-mt-16">{directory}</section>}

      {/* What's new */}
      <section id="new" className="py-20 bg-emerald-50/50 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"><Sparkles className="w-3.5 h-3.5" /> New on Hisaaboo</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-900">Your shop, now online</h2>
            <p className="mt-3 text-slate-500 max-w-2xl mx-auto">Customers find you, order for pickup, and you bill them in one click — all connected to your billing desk.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {NEW_FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center mb-4"><f.icon className="w-5 h-5 text-emerald-600" /></div>
                <h3 className="font-semibold text-slate-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-5">
            {[
              { who: 'For customers', steps: ['Search a shop or product near you', 'Check prices and stock', 'Order for pickup — no app needed', 'Show your pickup code and collect'] },
              { who: 'For shopkeepers', steps: ['Add products and make bills', 'Put the QR standee on your counter', 'Hear the chime when an order comes', 'Make the GST bill in one click'] },
            ].map(g => (
              <div key={g.who} className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4">{g.who}</h3>
                <ol className="space-y-3">{g.steps.map((t, i) => <li key={t} className="flex gap-3 text-sm text-slate-600"><span className="w-6 h-6 shrink-0 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>{t}</li>)}</ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Hisaaboo */}
      <section id="why" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Why Hisaaboo?</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Business ka hisaab ab simple hai. Hisaaboo brings your khata book into the digital age — without the complexity.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY.map((item, i) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow landing-fade-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Everything your business needs</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              From the first quotation to the final GST report — Hisaaboo covers your entire billing workflow.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all landing-fade-up"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 bg-gradient-to-b from-emerald-50/40 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">How Hisaaboo works</h2>
            <p className="text-lg text-slate-500">Four simple steps from quotation to GST filing.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative landing-fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/20">
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-bold text-emerald-600 mb-1">STEP {i + 1}</div>
                  <h3 className="font-bold text-slate-800 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-7 -right-3 text-slate-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business workflow visual */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Your billing workflow, visualized</h2>
            <p className="text-lg text-slate-500">From product catalog to payment — every piece connected.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {[
              { icon: Package, label: 'Product Catalog' },
              { icon: FileText, label: 'Quotation' },
              { icon: Receipt, label: 'Invoice' },
              { icon: IndianRupee, label: 'Payment' },
              { icon: Users, label: 'Customer Khata' },
              { icon: BarChart3, label: 'GST Report' },
            ].map((node, i) => (
              <div key={node.label} className="flex items-center gap-3 sm:gap-4 landing-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-emerald-200 flex items-center justify-center shadow-sm landing-float" style={{ animationDelay: `${i * 0.3}s` }}>
                    <node.icon className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-slate-600">{node.label}</span>
                </div>
                {i < 5 && <ArrowRight className="w-5 h-5 text-slate-300 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GST & business management */}
      <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 text-emerald-300 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              GST & Business Management
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">GST filing, simplified.</h2>
            <p className="text-slate-300 mb-6 leading-relaxed">
              Hisaaboo handles CGST and SGST automatically, supports inclusive and exclusive GST modes, and generates the reports you need for filing — sales register, purchase register, GSTR-1 summaries, and HSN-wise breakdowns.
            </p>
            <ul className="space-y-3">
              {[
                'Automatic CGST/SGST split based on place of supply',
                'HSN/SAC code tracking on every line item',
                'GSTR-1 and sales/purchase registers at a click',
                'Round-off and grand-total calculated for you',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 p-6 landing-float">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold">GST Summary</span>
                </div>
                <span className="text-xs text-slate-400">Q1 2026</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Taxable Amount', value: '₹ 4,50,000', color: 'text-white' },
                  { label: 'CGST @ 9%', value: '₹ 40,500', color: 'text-emerald-400' },
                  { label: 'SGST @ 9%', value: '₹ 40,500', color: 'text-emerald-400' },
                  { label: 'Round Off', value: '₹ 0', color: 'text-slate-400' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{row.label}</span>
                    <span className={`font-mono font-semibold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t border-slate-700">
                  <span className="font-semibold">Grand Total</span>
                  <span className="font-mono font-bold text-emerald-400">₹ 5,31,000</span>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg landing-float" style={{ animationDelay: '1s' }}>
              GST-Ready
            </div>
          </div>
        </div>
      </section>

      {/* Built for Indian businesses */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-sm font-semibold mb-6">
            <TrendingUp className="w-4 h-4" />
            Made in India, for India
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Built for Indian businesses</h2>
          <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">
            From the local shop to the growing enterprise — Hisaaboo speaks your language, understands your tax structure, and fits the way you already work. Your khata book, reimagined for today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['हिन्दी', 'ਪੰਜਾਬੀ', 'ગુજરાતી', 'বাংলা', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം', 'English'].map((lang) => (
              <span key={lang} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-teal-600 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">Your local market, connected.</h2>
          <p className="text-lg text-emerald-50 mb-8 max-w-xl mx-auto">
            Start using Hisaaboo today — no setup, no cost to begin. Your invoices, quotations, and GST reports are a click away.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onEnterApp}
              className="px-8 py-3.5 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 shadow-xl transition-all flex items-center justify-center gap-2 group"
            >
              Start Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={onEnterApp}
              className="px-8 py-3.5 border-2 border-white/40 text-white font-bold rounded-xl hover:bg-white/10 transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sun className="w-6 h-6 text-emerald-500" />
                <span className="text-lg font-bold text-white">Hisaaboo</span>
              </div>
              <p className="text-sm">Smart Billing & Business Management</p>
              <p className="text-sm mt-2 text-slate-500">Your local market, connected.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={scrollToFeatures} className="hover:text-emerald-400 transition-colors">Features</button></li>
                <li><button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-400 transition-colors">How it works</button></li>
                <li><button onClick={() => document.getElementById('why')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-400 transition-colors">Why Hisaaboo</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Features</h4>
              <ul className="space-y-2 text-sm">
                <li>Invoices</li>
                <li>Quotations</li>
                <li>Payments</li>
                <li>GST Reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Get Started</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={onEnterApp} className="hover:text-emerald-400 transition-colors">Start Free</button></li>
                <li><button onClick={onEnterApp} className="hover:text-emerald-400 transition-colors">Login</button></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            <p>© {new Date().getFullYear()} Hisaaboo. Smart Billing & Business Management.</p>
            <p className="mt-1 text-xs">Made for Indian businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
