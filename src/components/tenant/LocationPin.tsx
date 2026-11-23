import { useState } from "react";
import { reverseGeocode } from "@/lib/customerLocation";
import { mapsPinUrl, pinFromText, type Pin } from "@/lib/shopAddress";

export function LocationPin({ pin, onPin, onPlace }: {
  pin: Pin | null; onPin: (p: Pin | null) => void;
  onPlace?: (p: { locality?: string; city?: string; pincode?: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");

  function useGps() {
    if (!navigator.geolocation) return setMsg("This device can't share its location.");
    setBusy(true); setMsg("");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onPin(p);
      const acc = Math.round(pos.coords.accuracy);
      setMsg(acc > 100 ? `Pinned, but accuracy is about ${acc} m. Stand inside the shop and try again, or paste a Google Maps link.` : `Pinned (accurate to about ${acc} m).`);
      try { onPlace?.(await reverseGeocode(p.lat, p.lng)); } catch { /* optional */ }
      setBusy(false);
    }, (err) => {
      setBusy(false);
      setMsg(err.code === 1 ? "Location permission was blocked. Allow it in your browser, or paste a Google Maps link below." : "Couldn't get your location. Try again or paste a Google Maps link.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  function useLink() {
    const p = pinFromText(link);
    if (!p) return setMsg(/goo\.gl|maps\.app/.test(link) ? "Short links can't be read. Open the link, then copy the full address from the browser bar." : "Couldn't find a location in that link. Paste the full Google Maps link or \"latitude, longitude\".");
    onPin(p); setLink(""); setMsg("Pinned from your Google Maps link.");
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useGps} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Finding location…" : pin ? "📍 Re-pin my shop location" : "📍 Pin my shop location"}
        </button>
        {pin && <>
          <a href={mapsPinUrl(pin)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Check on Google Maps</a>
          <button type="button" onClick={() => { onPin(null); setMsg("Pin removed."); }} className="text-sm text-muted-foreground hover:text-foreground">Remove pin</button>
        </>}
      </div>
      {pin && (
        <iframe title="Shop pin preview" loading="lazy" className="h-40 w-full rounded-md border"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${pin.lng - 0.003},${pin.lat - 0.002},${pin.lng + 0.003},${pin.lat + 0.002}&layer=mapnik&marker=${pin.lat},${pin.lng}`} />
      )}
      <div className="flex gap-2">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a Google Maps link / latitude, longitude"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground" />
        <button type="button" onClick={useLink} disabled={!link.trim()} className="rounded-md border px-3 text-sm disabled:opacity-50">Use</button>
      </div>
      <p className="text-xs text-muted-foreground">{msg || "Customers get exact Google Maps directions to this pin."}</p>
    </div>
  );
}
