import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun, FileText, Receipt, Users, Truck, BarChart3, Package, Calculator,
  ArrowRight, CheckCircle2, IndianRupee, TrendingUp, Zap, ShieldCheck,
  Smartphone, Printer, FileDown, Sparkles, BookOpen, Clock,
} from 'lucide-react';

interface Props {
  onEnterApp: () => void;
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

function VyapariIllustration() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Soft gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/50 via-teal-50/40 to-sky-50/30 rounded-[2.5rem] blur-2xl landing-pulse-glow" />
      <div className="absolute top-1/4 right-1/4 w-40 h-40 bg-emerald-200/30 rounded-full blur-3xl landing-pulse-glow" style={{ animationDelay: '1s' }} />

      {/* Main illustration card */}
      <div className="relative aspect-square flex items-end justify-center">
        <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-xl">
          <defs>
            <linearGradient id="deskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <linearGradient id="shirtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#0d5d57" />
            </linearGradient>
            <linearGradient id="laptopScreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.15" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Floor shadow */}
          <ellipse cx="200" cy="372" rx="155" ry="14" fill="#cbd5e1" opacity="0.4" />

          {/* Desk */}
          <rect x="48" y="335" width="304" height="38" rx="8" fill="url(#deskGrad)" stroke="#cbd5e1" strokeWidth="1.5" filter="url(#softShadow)" />
          <line x1="48" y1="355" x2="352" y2="355" stroke="#cbd5e1" strokeWidth="1" opacity="0.5" />

          {/* Chair back */}
          <rect x="168" y="195" width="64" height="150" rx="14" fill="#334155" filter="url(#softShadow)" />
          <rect x="172" y="200" width="56" height="140" rx="10" fill="#3f4d63" />
          <line x1="200" y1="205" x2="200" y2="335" stroke="#2c3a4f" strokeWidth="1" opacity="0.3" />

          {/* Character — shoulders/torso */}
          <g filter="url(#softShadow)">
            {/* Torso/shirt */}
            <path d="M 158 215 Q 200 200 242 215 L 252 320 Q 200 332 148 320 Z" fill="url(#shirtGrad)" />
            {/* Neck */}
            <rect x="193" y="192" width="14" height="24" rx="6" fill="#d4a373" />
            {/* Collar V-shape */}
            <path d="M 180 210 Q 200 222 220 210 L 214 232 L 200 240 L 186 232 Z" fill="#0d9488" />
            <path d="M 186 232 L 200 240 L 214 232 L 210 246 L 190 246 Z" fill="#0c7d72" />
          </g>

          {/* Head */}
          <g filter="url(#softShadow)">
            {/* Face */}
            <ellipse cx="200" cy="165" rx="34" ry="36" fill="#e8b88f" />
            {/* Ears */}
            <ellipse cx="167" cy="168" rx="5" ry="7" fill="#d4a373" />
            <ellipse cx="233" cy="168" rx="5" ry="7" fill="#d4a373" />
            {/* Hair — modern combed style */}
            <path d="M 168 148 Q 175 128 200 124 Q 225 128 232 148 Q 235 155 230 152 Q 220 138 200 136 Q 180 138 170 152 Q 165 155 168 148 Z" fill="#1a1a2e" />
            <path d="M 170 152 Q 200 140 230 152 Q 232 156 228 154 Q 200 144 172 154 Q 168 156 170 152 Z" fill="#16213e" />
            {/* Eyebrows */}
            <path d="M 180 158 Q 186 155 192 158" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 208 158 Q 214 155 220 158" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Glasses */}
            <rect x="178" y="160" width="16" height="12" rx="6" fill="none" stroke="#334155" strokeWidth="1.8" />
            <rect x="206" y="160" width="16" height="12" rx="6" fill="none" stroke="#334155" strokeWidth="1.8" />
            <line x1="194" y1="166" x2="206" y2="166" stroke="#334155" strokeWidth="1.8" />
            {/* Eyes behind glasses */}
            <circle cx="186" cy="166" r="2" fill="#1a1a2e" />
            <circle cx="214" cy="166" r="2" fill="#1a1a2e" />
            {/* Nose */}
            <path d="M 200 172 Q 198 178 200 182 Q 202 178 200 172" stroke="#c4956a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {/* Friendly smile */}
            <path d="M 188 186 Q 200 196 212 186" stroke="#1a1a2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Cheek hint */}
            <ellipse cx="176" cy="178" rx="5" ry="3" fill="#f0a8a8" opacity="0.3" />
            <ellipse cx="224" cy="178" rx="5" ry="3" fill="#f0a8a8" opacity="0.3" />
          </g>

          {/* Left arm — reaching toward laptop */}
          <path d="M 158 218 Q 130 250 118 285" stroke="url(#shirtGrad)" strokeWidth="16" fill="none" strokeLinecap="round" filter="url(#softShadow)" />
          <circle cx="118" cy="285" r="9" fill="#e8b88f" />

          {/* Right arm — on calculator */}
          <path d="M 242 218 Q 268 245 278 275" stroke="url(#shirtGrad)" strokeWidth="16" fill="none" strokeLinecap="round" filter="url(#softShadow)" />
          <circle cx="278" cy="275" r="9" fill="#e8b88f" />

          {/* Laptop showing Hisaaboo */}
          <g filter="url(#softShadow)">
            {/* Screen */}
            <rect x="88" y="248" width="88" height="60" rx="6" fill="url(#laptopScreen)" />
            <rect x="94" y="254" width="76" height="48" rx="3" fill="#0f766e" opacity="0.95" />
            {/* Hisaaboo logo on screen */}
            <circle cx="132" cy="266" r="4" fill="#34d399" />
            <text x="132" y="280" textAnchor="middle" fill="#34d399" fontSize="7" fontWeight="bold" fontFamily="system-ui">Hisaaboo</text>
            {/* Screen content lines */}
            <rect x="100" y="286" width="24" height="2.5" rx="1" fill="#5eead4" opacity="0.6" />
            <rect x="128" y="286" width="36" height="2.5" rx="1" fill="#5eead4" opacity="0.4" />
            <rect x="100" y="293" width="44" height="2" rx="1" fill="#5eead4" opacity="0.3" />
            {/* Laptop base */}
            <path d="M 82 308 L 182 308 L 188 318 L 76 318 Z" fill="#475569" />
            <rect x="78" y="316" width="108" height="5" rx="2.5" fill="#334155" />
          </g>

          {/* Calculator */}
          <g filter="url(#softShadow)">
            <rect x="238" y="248" width="56" height="72" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x="244" y="254" width="44" height="16" rx="3" fill="#0f172a" />
            <text x="284" y="265" textAnchor="end" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="bold">₹12,450</text>
            {/* Buttons grid */}
            {[0, 1, 2].map(row =>
              [0, 1, 2].map(col => (
                <circle key={`${row}-${col}`} cx={252 + col * 12} cy={278 + row * 12} r="4" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" />
              ))
            )}
            <circle cx="288" cy="278" r="4" fill="#f59e0b" />
            <circle cx="288" cy="290" r="4" fill="#10b981" />
            <circle cx="288" cy="302" r="4" fill="#ef4444" />
          </g>

          {/* Ledger book (khata) */}
          <g filter="url(#softShadow)" transform="rotate(-12 170 300)">
            <rect x="148" y="278" width="48" height="60" rx="3" fill="#b91c1c" />
            <rect x="152" y="282" width="40" height="52" rx="1" fill="#fef3c7" />
            <line x1="156" y1="290" x2="188" y2="290" stroke="#d4a373" strokeWidth="1" />
            <line x1="156" y1="296" x2="184" y2="296" stroke="#d4a373" strokeWidth="1" />
            <line x1="156" y1="302" x2="186" y2="302" stroke="#d4a373" strokeWidth="1" />
            <line x1="156" y1="308" x2="180" y2="308" stroke="#d4a373" strokeWidth="1" />
            <line x1="156" y1="314" x2="186" y2="314" stroke="#d4a373" strokeWidth="1" />
            <line x1="156" y1="320" x2="182" y2="320" stroke="#d4a373" strokeWidth="1" />
            <text x="172" y="274" textAnchor="middle" fill="#fbbf24" fontSize="6" fontWeight="bold">KHATA</text>
          </g>

          {/* Pen */}
          <g transform="rotate(25 310 310)" filter="url(#softShadow)">
            <rect x="298" y="306" width="30" height="5" rx="2.5" fill="#1e293b" />
            <path d="M 328 308 L 334 308 L 328 304 L 328 312 Z" fill="#0f172a" />
            <rect x="300" y="307" width="8" height="3" rx="1" fill="#3b82f6" />
          </g>

          {/* Mobile phone — Payment Received */}
          <g filter="url(#softShadow)">
            <rect x="306" y="226" width="34" height="58" rx="7" fill="#1e293b" />
            <rect x="309" y="232" width="28" height="46" rx="4" fill="#f0fdf4" />
            <circle cx="323" cy="280" r="2" fill="#64748b" />
            {/* Notification card */}
            <rect x="311" y="236" width="24" height="20" rx="3" fill="#dcfce7" />
            <circle cx="316" cy="242" r="2.5" fill="#10b981" />
            <text x="323" y="244" textAnchor="middle" fill="#065f46" fontSize="4" fontWeight="bold">Payment</text>
            <text x="323" y="250" textAnchor="middle" fill="#065f46" fontSize="4" fontWeight="bold">Received</text>
            <rect x="313" y="262" width="20" height="2" rx="1" fill="#86efac" />
            <rect x="313" y="268" width="14" height="2" rx="1" fill="#86efac" />
          </g>

          {/* Small ₹ floating symbols */}
          <text x="72" y="230" fill="#10b981" fontSize="14" fontWeight="bold" opacity="0.3">₹</text>
          <text x="340" y="200" fill="#10b981" fontSize="11" fontWeight="bold" opacity="0.25">₹</text>
          <text x="60" y="280" fill="#0f766e" fontSize="9" fontWeight="bold" opacity="0.2">₹</text>
        </svg>

        {/* Floating UI cards around character */}
        <FloatingBadge icon={Receipt} label="Invoice" sublabel="INV-2026-0042" className="top-[6%] -left-2 sm:-left-8" delay="0s" color="emerald" />
        <FloatingBadge icon={IndianRupee} label="Payment Received" sublabel="₹ 12,450" className="top-[22%] -right-2 sm:-right-10" delay="0.6s" color="emerald" />
        <FloatingBadge icon={FileText} label="Quotation" sublabel="QT-2026-0018" className="bottom-[30%] -left-3 sm:-left-12" delay="1s" color="blue" />
        <FloatingBadge icon={BarChart3} label="GST Report" sublabel="GSTR-1 Ready" className="bottom-[10%] -right-2 sm:-right-8" delay="0.3s" color="amber" />
        <FloatingBadge icon={Users} label="Customers" sublabel="248 active" className="top-[48%] -right-4 sm:-right-14" delay="1.4s" color="violet" />
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

const WHY = [
  { icon: ShieldCheck, title: 'Built for Indian GST', desc: 'CGST/SGST, HSN codes, inclusive/exclusive GST modes — all handled correctly out of the box.' },
  { icon: Smartphone, title: 'Works on Any Device', desc: 'Desktop, laptop, tablet, or mobile — your billing desk travels with you.' },
  { icon: BookOpen, title: 'Khata Book Digitized', desc: 'Replace paper ledgers with a searchable, permanent record of every customer and transaction.' },
  { icon: Clock, title: 'Save Time Daily', desc: 'Auto-numbering, product autocomplete, and reusable templates cut billing time to minutes.' },
];

export function LandingPage({ onEnterApp }: Props) {
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

            <h1 className="landing-fade-up text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-4" style={{ animationDelay: '0.15s' }}>
              Hisaab rakho. <br className="sm:hidden" />Business chalao.
            </h1>

            <p className="landing-fade-up text-lg text-slate-600 mb-2 max-w-lg mx-auto lg:mx-0" style={{ animationDelay: '0.25s' }}>
              <span className="font-semibold text-slate-800">Smart Billing & Business Management</span>
            </p>
            <p className="landing-fade-up text-base text-slate-500 mb-8 max-w-lg mx-auto lg:mx-0" style={{ animationDelay: '0.3s' }}>
              Manage invoices, quotations, payments, customers, suppliers, and GST reports — all in one simple platform built for Indian businesses.
            </p>

            <div className="landing-fade-up flex flex-col sm:flex-row gap-3 justify-center lg:justify-start" style={{ animationDelay: '0.4s' }}>
              <button
                onClick={onEnterApp}
                className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 transition-all hover:shadow-xl hover:shadow-emerald-600/30 flex items-center justify-center gap-2 group"
              >
                Start Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={onEnterApp}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                Login
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
            <VyapariIllustration />
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
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">Hisaab rakho. Business chalao.</h2>
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
              <p className="text-sm mt-2 text-slate-500">Hisaab rakho. Business chalao.</p>
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
