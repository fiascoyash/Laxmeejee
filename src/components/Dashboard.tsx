import { useMemo } from 'react';
import {
  TrendingUp, Receipt, FileText, Users, Truck, Package,
  Clock, Award, ArrowUpRight, PlusCircle, List, ChevronRight,
  Activity, Zap, AlertCircle, BarChart2, Star, ShoppingBag,
  CalendarDays, UserPlus, PackagePlus
} from 'lucide-react';
import { Invoice, Quotation, CustomerData, SupplierData, ProductCatalogItem, CompanyProfile } from '../types';

interface DashboardProps {
  invoices: Invoice[];
  quotations: Quotation[];
  customers: CustomerData[];
  suppliers: SupplierData[];
  catalog: ProductCatalogItem[];
  companyProfile: CompanyProfile;
  onNewInvoice: () => void;
  onNewQuotation: () => void;
  onNavigate: (view: 'invoiceList' | 'list' | 'customers' | 'suppliers' | 'catalog' | 'gstReports') => void;
  onShowCompanyProfile: () => void;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusColor: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-700',
  Unpaid: 'bg-red-100 text-red-700',
  'Partial Payment': 'bg-amber-100 text-amber-700',
  Draft: 'bg-slate-100 text-slate-600',
};

export function Dashboard({
  invoices, quotations, customers, suppliers, catalog,
  companyProfile, onNewInvoice, onNewQuotation, onNavigate, onShowCompanyProfile,
}: DashboardProps) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const stats = useMemo(() => {
    const totalSales = invoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const avgInvoice = invoices.length > 0 ? totalSales / invoices.length : 0;

    const monthlyInvoices = invoices.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthlyRevenue = monthlyInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);

    const todayInvoices = invoices.filter(i => i.date === todayStr);
    const todaySales = todayInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);

    const pendingInvoices = invoices.filter(i => i.status === 'Unpaid' || i.status === 'Partial Payment');
    const pendingPayments = pendingInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);

    const highestInvoice = invoices.reduce((max, i) => (i.grandTotal > (max?.grandTotal || 0) ? i : max), invoices[0] || null);

    const monthlyQuotations = quotations.filter(q => {
      const d = new Date(q.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyCustomers = customers.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Top customers by invoice total
    const customerMap = new Map<string, { name: string; total: number; count: number }>();
    invoices.forEach(inv => {
      const name = inv.customer.name || 'Unknown';
      const existing = customerMap.get(name) || { name, total: 0, count: 0 };
      customerMap.set(name, { name, total: existing.total + inv.grandTotal, count: existing.count + 1 });
    });
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Recent activity
    type ActivityItem = { type: string; label: string; sub: string; time: string; icon: string; color: string };
    const activities: ActivityItem[] = [
      ...invoices.map(i => ({
        type: 'invoice',
        label: `Invoice ${i.invoiceNumber}`,
        sub: i.customer.name || '—',
        time: i.createdAt || i.date,
        icon: 'receipt',
        color: 'emerald',
      })),
      ...quotations.map(q => ({
        type: 'quotation',
        label: `Quotation ${q.quotationNumber}`,
        sub: q.customer.name || '—',
        time: q.createdAt || q.date,
        icon: 'file',
        color: 'blue',
      })),
      ...customers.map(c => ({
        type: 'customer',
        label: `Customer Added`,
        sub: c.name,
        time: c.createdAt,
        icon: 'user',
        color: 'teal',
      })),
      ...suppliers.map(s => ({
        type: 'supplier',
        label: `Supplier Added`,
        sub: s.firmName,
        time: s.createdAt,
        icon: 'truck',
        color: 'amber',
      })),
    ]
      .filter(a => !!a.time)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);

    const latestCustomer = customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
    const recentInvoices = [...invoices]
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
      .slice(0, 5);
    const recentQuotations = [...quotations]
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
      .slice(0, 5);

    return {
      totalSales, avgInvoice, monthlyRevenue, monthlyInvoices, todaySales,
      pendingPayments, highestInvoice, topCustomers, activities,
      latestCustomer, recentInvoices, recentQuotations, monthlyQuotations, monthlyCustomers,
    };
  }, [invoices, quotations, customers, suppliers, todayStr, currentMonth, currentYear]);

  const kpiCards = [
    {
      title: 'Total Sales',
      value: fmt(stats.totalSales),
      sub: `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Monthly Revenue',
      value: fmt(stats.monthlyRevenue),
      sub: `${today.toLocaleString('en-IN', { month: 'long' })} ${currentYear}`,
      icon: BarChart2,
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Total Invoices',
      value: invoices.length.toString(),
      sub: `${stats.monthlyInvoices.length} this month`,
      icon: Receipt,
      gradient: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-50',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      title: 'Total Quotations',
      value: quotations.length.toString(),
      sub: `${stats.monthlyQuotations.length} this month`,
      icon: FileText,
      gradient: 'from-cyan-500 to-cyan-600',
      bg: 'bg-cyan-50',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      title: 'Total Customers',
      value: customers.length.toString(),
      sub: `${stats.monthlyCustomers.length} new this month`,
      icon: Users,
      gradient: 'from-violet-500 to-violet-600',
      bg: 'bg-violet-50',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
    {
      title: 'Total Suppliers',
      value: suppliers.length.toString(),
      sub: 'registered vendors',
      icon: Truck,
      gradient: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Pending Payments',
      value: fmt(stats.pendingPayments),
      sub: `${invoices.filter(i => i.status === 'Unpaid' || i.status === 'Partial Payment').length} unpaid invoices`,
      icon: AlertCircle,
      gradient: 'from-red-500 to-red-600',
      bg: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
    },
    {
      title: 'Avg. Invoice Value',
      value: fmt(stats.avgInvoice),
      sub: 'per invoice',
      icon: Award,
      gradient: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
  ];

  const activityIconMap: Record<string, JSX.Element> = {
    receipt: <Receipt className="w-4 h-4" />,
    file: <FileText className="w-4 h-4" />,
    user: <Users className="w-4 h-4" />,
    truck: <Truck className="w-4 h-4" />,
  };
  const activityColorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    teal: 'bg-teal-100 text-teal-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  const greetingHour = today.getHours();
  const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">{greeting}</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
            {companyProfile.companyName || 'Business Dashboard'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {!companyProfile.companyName && (
          <button
            onClick={onShowCompanyProfile}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md"
          >
            <Zap className="w-4 h-4" />
            Setup Company Profile
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map(card => (
            <div
              key={card.title}
              className={`${card.bg} rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`${card.iconBg} p-2.5 rounded-xl`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{card.title}</p>
              <p className="text-xl font-bold text-slate-800 leading-tight">{card.value}</p>
              <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Business Overview + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Business Overview
            </h2>
            <span className="text-xs text-slate-400 font-medium">{today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Today's Sales */}
            <OverviewCard
              label="Today's Sales"
              value={fmt(stats.todaySales)}
              sub={`${invoices.filter(i => i.date === todayStr).length} invoices`}
              icon={<CalendarDays className="w-4 h-4" />}
              accent="emerald"
            />
            {/* This Month Sales */}
            <OverviewCard
              label="This Month Sales"
              value={fmt(stats.monthlyRevenue)}
              sub={`${stats.monthlyInvoices.length} invoices`}
              icon={<TrendingUp className="w-4 h-4" />}
              accent="blue"
            />
            {/* Total Products */}
            <OverviewCard
              label="Total Products"
              value={catalog.length.toString()}
              sub="in catalog"
              icon={<ShoppingBag className="w-4 h-4" />}
              accent="teal"
            />
            {/* Highest Invoice */}
            <OverviewCard
              label="Highest Invoice"
              value={stats.highestInvoice ? fmt(stats.highestInvoice.grandTotal) : '—'}
              sub={stats.highestInvoice?.invoiceNumber || 'No invoices yet'}
              icon={<Star className="w-4 h-4" />}
              accent="amber"
            />
            {/* Latest Customer */}
            <OverviewCard
              label="Latest Customer"
              value={stats.latestCustomer?.name || '—'}
              sub={stats.latestCustomer ? formatDate(stats.latestCustomer.createdAt) : 'No customers yet'}
              icon={<UserPlus className="w-4 h-4" />}
              accent="violet"
            />
            {/* Latest Invoice */}
            <OverviewCard
              label="Latest Invoice"
              value={stats.recentInvoices[0]?.invoiceNumber || '—'}
              sub={stats.recentInvoices[0] ? fmtFull(stats.recentInvoices[0].grandTotal) : 'No invoices yet'}
              icon={<Receipt className="w-4 h-4" />}
              accent="cyan"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-amber-500" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <QuickAction
              label="New Invoice"
              sub="Create a blank invoice"
              icon={<PlusCircle className="w-5 h-5" />}
              color="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onNewInvoice}
            />
            <QuickAction
              label="New Quotation"
              sub="Create a quotation"
              icon={<FileText className="w-5 h-5" />}
              color="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onNewQuotation}
            />
            <QuickAction
              label="Invoice History"
              sub={`${invoices.length} invoices total`}
              icon={<List className="w-5 h-5" />}
              color="bg-slate-100 hover:bg-slate-200 text-slate-700"
              onClick={() => onNavigate('invoiceList')}
            />
            <QuickAction
              label="Customers"
              sub={`${customers.length} registered`}
              icon={<Users className="w-5 h-5" />}
              color="bg-slate-100 hover:bg-slate-200 text-slate-700"
              onClick={() => onNavigate('customers')}
            />
            <QuickAction
              label="Suppliers"
              sub={`${suppliers.length} vendors`}
              icon={<Truck className="w-5 h-5" />}
              color="bg-slate-100 hover:bg-slate-200 text-slate-700"
              onClick={() => onNavigate('suppliers')}
            />
            <QuickAction
              label="Product Catalog"
              sub={`${catalog.length} products`}
              icon={<Package className="w-5 h-5" />}
              color="bg-slate-100 hover:bg-slate-200 text-slate-700"
              onClick={() => onNavigate('catalog')}
            />
          </div>
        </div>
      </div>

      {/* Monthly Performance */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            Monthly Performance
          </h2>
          <span className="text-xs font-medium text-slate-400">{today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <PerformanceCard
            label="Revenue"
            value={fmt(stats.monthlyRevenue)}
            total={stats.totalSales > 0 ? Math.round((stats.monthlyRevenue / stats.totalSales) * 100) : 0}
            color="bg-emerald-500"
            trackColor="bg-emerald-100"
          />
          <PerformanceCard
            label="Invoices"
            value={stats.monthlyInvoices.length.toString()}
            total={invoices.length > 0 ? Math.round((stats.monthlyInvoices.length / invoices.length) * 100) : 0}
            color="bg-blue-500"
            trackColor="bg-blue-100"
          />
          <PerformanceCard
            label="Quotations"
            value={stats.monthlyQuotations.length.toString()}
            total={quotations.length > 0 ? Math.round((stats.monthlyQuotations.length / quotations.length) * 100) : 0}
            color="bg-cyan-500"
            trackColor="bg-cyan-100"
          />
          <PerformanceCard
            label="New Customers"
            value={stats.monthlyCustomers.length.toString()}
            total={customers.length > 0 ? Math.round((stats.monthlyCustomers.length / customers.length) * 100) : 0}
            color="bg-violet-500"
            trackColor="bg-violet-100"
          />
        </div>
      </section>

      {/* Recent Invoices + Recent Quotations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-500" />
              Recent Invoices
            </h2>
            <button
              onClick={() => onNavigate('invoiceList')}
              className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-0.5 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {stats.recentInvoices.length === 0 ? (
            <EmptyState icon={<Receipt className="w-8 h-8" />} text="No invoices yet" sub="Create your first invoice to see it here" />
          ) : (
            <div className="space-y-3">
              {stats.recentInvoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex-shrink-0 w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700 truncate">{inv.invoiceNumber}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{inv.customer.name || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">{fmt(inv.grandTotal)}</p>
                    <p className="text-xs text-slate-400">{formatDate(inv.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quotations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Recent Quotations
            </h2>
            <button
              onClick={() => onNavigate('list')}
              className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-0.5 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {stats.recentQuotations.length === 0 ? (
            <EmptyState icon={<FileText className="w-8 h-8" />} text="No quotations yet" sub="Create your first quotation to see it here" />
          ) : (
            <div className="space-y-3">
              {stats.recentQuotations.map(q => (
                <div key={q.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex-shrink-0 w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{q.quotationNumber}</p>
                    <p className="text-xs text-slate-400 truncate">{q.customer.name || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">{fmt(q.grandTotal)}</p>
                    <p className="text-xs text-slate-400">{formatDate(q.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Customers + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Top Customers
            </h2>
            <button
              onClick={() => onNavigate('customers')}
              className="text-xs text-amber-600 font-medium hover:text-amber-700 flex items-center gap-0.5 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {stats.topCustomers.length === 0 ? (
            <EmptyState icon={<Users className="w-8 h-8" />} text="No customer data yet" sub="Customer rankings will appear as you create invoices" />
          ) : (
            <div className="space-y-3">
              {stats.topCustomers.map((c, idx) => (
                <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-slate-200 text-slate-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.count} invoice{c.count !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800 flex-shrink-0">{fmt(c.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-teal-500" />
            Recent Activity
          </h2>
          {stats.activities.length === 0 ? (
            <EmptyState icon={<Clock className="w-8 h-8" />} text="No activity yet" sub="Your recent business actions will appear here" />
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100" />
              <div className="space-y-4">
                {stats.activities.map((a, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 ${activityColorMap[a.color] || 'bg-slate-100 text-slate-600'}`}>
                      {activityIconMap[a.icon]}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-semibold text-slate-700">{a.label}</p>
                      <p className="text-xs text-slate-400 truncate">{a.sub}</p>
                    </div>
                    <p className="text-xs text-slate-400 flex-shrink-0 pt-1">{formatDate(a.time)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Catalog Low Stock Alert */}
      {catalog.some(p => typeof p.minStockAlert === 'number' && p.stockQuantity <= p.minStockAlert!) && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-800">Low Stock Alert</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {catalog
              .filter(p => typeof p.minStockAlert === 'number' && p.stockQuantity <= p.minStockAlert!)
              .slice(0, 4)
              .map(p => (
                <div key={p.id} className="bg-white rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <PackagePlus className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-semibold text-slate-700 truncate">{p.name}</p>
                  </div>
                  <p className="text-xs text-amber-700">Stock: {p.stockQuantity} (min: {p.minStockAlert})</p>
                </div>
              ))}
          </div>
          <button
            onClick={() => onNavigate('catalog')}
            className="mt-4 text-sm font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 transition-colors"
          >
            Manage Inventory <ChevronRight className="w-4 h-4" />
          </button>
        </section>
      )}
    </div>
  );
}

// --- Sub-components ---

function OverviewCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub: string; icon: JSX.Element; accent: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    teal: 'bg-teal-50 text-teal-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colors[accent] || 'bg-slate-100 text-slate-600'}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-base font-bold text-slate-800 truncate">{value}</p>
      <p className="text-xs text-slate-400 truncate">{sub}</p>
    </div>
  );
}

function QuickAction({ label, sub, icon, color, onClick }: {
  label: string; sub: string; icon: JSX.Element; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.01] active:scale-100 ${color}`}
    >
      {icon}
      <div className="text-left flex-1">
        <div className="font-semibold leading-tight">{label}</div>
        <div className="text-xs opacity-70 font-normal">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 opacity-60" />
    </button>
  );
}

function PerformanceCard({ label, value, total, color, trackColor }: {
  label: string; value: string; total: number; color: string; trackColor: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <div className={`w-full h-2 rounded-full ${trackColor}`}>
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(total, 100)}%` }}
        />
      </div>
      <p className="text-xs text-slate-400">{total}% of total</p>
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: JSX.Element; text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-slate-200 mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-500">{text}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
