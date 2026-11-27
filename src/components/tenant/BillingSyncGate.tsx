import { useEffect, useReducer, useState, type ReactNode } from 'react';
import { CloudCheck, CloudUpload, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BillingSync } from '@/lib/billing-sync';
import { billingSyncTransport } from '@/lib/billing-sync-transport';
import { billingStorage } from '@/lib/billing-cache';

export function BillingSyncGate({ businessId, businessName, address, phone, children }: {
  businessId: string; businessName: string; address: string; phone: string; children: ReactNode;
}) {
  const [, refresh] = useReducer((v: number) => v + 1, 0);
  const [controller, setController] = useState<BillingSync>();
  const [retryVersion, setRetryVersion] = useState(0);
  const [choiceError, setChoiceError] = useState('');
  useEffect(() => {
    const sync = new BillingSync(businessId, billingSyncTransport, refresh);
    setController(sync);
    void sync.start();
    return () => sync.stop();
  }, [businessId, retryVersion]);

  useEffect(() => {
    if (!controller?.ready) return;
    const raw = billingStorage.getItem('solar_company_profile');
    const profile = raw ? JSON.parse(raw) as { companyName?: string } : null;
    if (!profile || !profile.companyName || profile.companyName === 'Solar Energy Solutions Pvt Ltd') {
      billingStorage.setItem('solar_company_profile', JSON.stringify(profile ? { ...profile, companyName: businessName } : {
        companyName: businessName, logo: '', gstNumber: '', address, email: '', phone,
        bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '', signature: '', businessType: 'general', compliance: {},
      }));
      window.dispatchEvent(new Event('hisaaboo:billing-refreshed'));
    }
  }, [controller, controller?.ready, businessName, address, phone]);

  const choose = async (upload: boolean) => {
    try { setChoiceError(''); await controller?.chooseImport(upload); }
    catch { setChoiceError('Could not prepare your saved data. Your original browser copy is still safe. Please retry.'); }
  };
  if (!controller || controller.businessId !== businessId || controller.state === 'loading') {
    return <div role="status" className="grid min-h-screen place-content-center bg-background text-foreground"><p className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin motion-reduce:animate-none" />Loading your billing data…</p></div>;
  }
  if (controller.state === 'import') {
    return <div className="grid min-h-screen place-content-center bg-background px-5 text-foreground">
      <section className="mx-auto w-full max-w-lg space-y-5" aria-labelledby="billing-import-title">
        <CloudUpload className="size-10 text-primary" />
        <h1 id="billing-import-title" className="text-2xl font-semibold">Keep your existing billing data</h1>
        <p className="break-words">Add the {controller.importCount} saved records on this browser to <strong>{businessName}</strong>?</p>
        <p className="text-sm text-muted-foreground">Only continue if these records belong to this shop. Records already saved online will be kept, and your original browser copy will remain backed up.</p>
        {choiceError && <p role="alert" className="text-sm text-destructive">{choiceError}</p>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => { void choose(true); }}><CloudUpload />Add my saved data</Button>
          <Button variant="outline" onClick={() => { void choose(false); }}>Use only this shop’s online data</Button>
        </div>
      </section>
    </div>;
  }
  if (!controller.ready) {
    return <div className="grid min-h-screen place-content-center bg-background px-5 text-foreground"><section className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Billing data could not be loaded</h1>
      <p role="alert">{controller.error}</p>
      <Button onClick={() => setRetryVersion(v => v + 1)}><RefreshCw />Retry</Button>
    </section></div>;
  }
  const pending = controller.state === 'syncing';
  const offline = controller.state === 'offline';
  const Icon = offline ? CloudOff : pending ? CloudUpload : CloudCheck;
  return <>
    {children}
    <div role="status" aria-live="polite" className="fixed bottom-2 right-2 z-40 flex max-w-[calc(100%-1rem)] items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm" title={controller.error || 'Billing data sync'}>
      <Icon className="size-4 shrink-0" />
      <span>{offline ? 'Saved on device · Sync retry pending' : pending ? 'Syncing billing data…' : 'Billing data synced'}</span>
      {offline && <Button size="icon" variant="ghost" className="size-7" aria-label="Retry billing sync" onClick={() => { void controller.tick(); }}><RefreshCw /></Button>}
    </div>
  </>;
}