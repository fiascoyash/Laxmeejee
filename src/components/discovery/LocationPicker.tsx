import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LocateFixed, Loader2, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isValidPincode, makeLocation, reverseGeocode, type CustomerLocation } from '@/lib/customerLocation';

type Status = { kind: 'idle' } | { kind: 'locating' } | { kind: 'resolving' } | { kind: 'note'; text: string };

/** Location pill + chooser. Asks for GPS only when the customer taps "Use current location". */
export function LocationPicker({ location, onChange, cities, localities }: {
  location: CustomerLocation | null;
  onChange: (next: CustomerLocation | null) => void;
  cities: string[];
  localities: string[];
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  const cityInput = useRef<HTMLInputElement>(null);
  const ids = useId();

  useEffect(() => {
    if (!open) { cancelled.current = true; abort.current?.abort(); return; }
    setCity(location?.city ?? ''); setArea(location?.locality ?? ''); setPin(location?.pincode ?? '');
    setStatus({ kind: 'idle' }); setFormError('');
  }, [open, location]);

  function fallBack(text: string) {
    setStatus({ kind: 'note', text });
    requestAnimationFrame(() => cityInput.current?.focus());
  }

  function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { fallBack('Location isn’t available on this device. Enter your area below instead.'); return; }
    setStatus({ kind: 'locating' });
    cancelled.current = false;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (cancelled.current) return;
      setStatus({ kind: 'resolving' });
      const controller = new AbortController();
      abort.current = controller;
      const timer = setTimeout(() => controller.abort(), 8000);
      let place: { locality?: string; city?: string; pincode?: string } = {};
      try { place = await reverseGeocode(coords.latitude, coords.longitude, controller.signal); } catch { /* keep coordinates, name stays generic */ }
      clearTimeout(timer);
      if (cancelled.current) return;
      const next = makeLocation({ latitude: coords.latitude, longitude: coords.longitude, ...place }, 'gps');
      if (next) { onChange(next); setOpen(false); }
    }, error => {
      if (cancelled.current) return;
      fallBack(error.code === error.PERMISSION_DENIED
        ? 'Location permission is off. No problem — enter your city, area or pincode below.'
        : 'We couldn’t find your location just now. Enter your city, area or pincode below.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 });
  }

  function saveManual(e: React.FormEvent) {
    e.preventDefault();
    const p = pin.trim();
    if (p && !isValidPincode(p)) { setFormError('Pincode should be 6 digits, like 246701.'); return; }
    const next = makeLocation({ city, locality: area, pincode: p }, 'manual');
    if (!next) { setFormError('Enter a city, area or pincode.'); return; }
    onChange(next); setOpen(false);
  }

  const busy = status.kind === 'locating' || status.kind === 'resolving';
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-stock-action hover:text-stock-action" aria-label={location ? `Your location: ${location.label}. Change location` : 'Set your location'}>
        <MapPin className="size-4 shrink-0 text-stock-action" aria-hidden="true" />
        <span className="truncate">{location ? location.label : 'Set your location'}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose your location</DialogTitle>
            <DialogDescription>We use it to show shops closest to you first. It stays on this device.</DialogDescription>
          </DialogHeader>
          <Button type="button" onClick={useCurrentLocation} disabled={busy} className="h-11 w-full bg-stock-action text-stock-action-foreground hover:bg-stock-action/90">
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
            {status.kind === 'locating' ? 'Finding you…' : status.kind === 'resolving' ? 'Getting your area…' : 'Use current location'}
          </Button>
          {status.kind === 'note' && <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{status.text}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or enter it yourself<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={saveManual} className="grid gap-3" noValidate>
            <label className="text-sm font-medium">City
              <Input ref={cityInput} value={city} onChange={e => setCity(e.target.value)} list={`${ids}-cities`} placeholder="e.g. Bijnor" maxLength={80} autoComplete="address-level2" className="mt-1 h-10" />
              <datalist id={`${ids}-cities`}>{cities.map(c => <option key={c} value={c} />)}</datalist>
            </label>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <label className="text-sm font-medium">Area / locality
                <Input value={area} onChange={e => setArea(e.target.value)} list={`${ids}-areas`} placeholder="e.g. Civil Lines" maxLength={80} className="mt-1 h-10" />
                <datalist id={`${ids}-areas`}>{localities.map(l => <option key={l} value={l} />)}</datalist>
              </label>
              <label className="text-sm font-medium">Pincode
                <Input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="246701" maxLength={6} autoComplete="postal-code" className="mt-1 h-10" />
              </label>
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {location ? <Button type="button" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}><X aria-hidden="true" />Clear location</Button> : <span />}
              <Button type="submit" variant="outline">Save location</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
