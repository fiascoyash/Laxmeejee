import { createFileRoute, ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BusinessGate } from '@/components/tenant/BusinessGate';
import { getBillingView, isPublicLandingHash } from '@/lib/billing-navigation';
import { normalizeDiscovery } from '@/lib/discovery';

const LegacyApp = lazy(() => import('@/legacy/Root'));
export const Route = createFileRoute('/billing')({
  head: () => ({ meta: [
    { title: 'Hisaaboo Billing — Your Business Desk' },
    { name: 'description', content: 'Manage your Hisaaboo shop, pickup orders, GST invoices, stock and customers.' },
    { property: 'og:title', content: 'Hisaaboo Billing — Your Business Desk' },
    { property: 'og:description', content: 'Your shop’s billing, inventory and pickup order desk.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Billing,
});
function Billing() {
  return <ClientOnly fallback={<div className="min-h-screen" />}><BillingDesk /></ClientOnly>;
}

function BillingDesk() {
  const navigate = Route.useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const resolveDestination = () => {
      const hash = window.location.hash;
      if (isPublicLandingHash(hash)) {
        setReady(false);
        void navigate({ to: '/', search: normalizeDiscovery({}), hash: '', replace: true });
        return;
      }
      const view = getBillingView(hash);
      if (hash !== `#${view}`) {
        void navigate({ to: '/billing', hash: view, replace: true });
      }
      setReady(true);
    };
    resolveDestination();
    window.addEventListener('hashchange', resolveDestination);
    return () => window.removeEventListener('hashchange', resolveDestination);
  }, [navigate]);
  if (!ready) return <div className="min-h-screen" />;
  return <Suspense fallback={<div className="min-h-screen" />}><BusinessGate><LegacyApp /></BusinessGate></Suspense>;
}