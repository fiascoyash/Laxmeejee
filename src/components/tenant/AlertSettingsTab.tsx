import { useEffect, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { loadAlertSettings, saveAlertSettings, stopOrderAlert, testOrderAlert, unlockAudio, type AlertSettings, type AlertStyle } from "./orderAlerts";

const OPTIONS: { id: AlertStyle; title: string; hint: string }[] = [
  { id: "chime", title: "Simple Chime", hint: "Quick 2-tone ping, plays once." },
  { id: "continuous", title: "Continuous Ring", hint: "Keeps ringing like Zomato/Rapido until you dismiss it." },
  { id: "voice", title: "Ring + Voice Announcement", hint: "Rings and speaks the table number or customer name." },
];

type Perm = "granted" | "denied" | "default" | "unsupported";

export function AlertSettingsTab({ businessId }: { businessId: string }) {
  const [s, setS] = useState<AlertSettings>({ style: "continuous", volume: 0.8 });
  const [perm, setPerm] = useState<Perm>("default");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setS(loadAlertSettings(businessId));
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    return () => stopOrderAlert();
  }, [businessId]);

  const update = (next: AlertSettings) => { setS(next); saveAlertSettings(businessId, next); };

  async function test() {
    await unlockAudio();
    testOrderAlert(s.style, s.volume);
    setTesting(true);
    setTimeout(() => setTesting(false), s.style === "voice" ? 7000 : 4000);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    try { setPerm(await Notification.requestPermission()); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5 text-sm">
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">Alert style for new orders</legend>
        {OPTIONS.map((o) => (
          <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${s.style === o.id ? "border-primary bg-primary/5" : ""}`}>
            <input type="radio" name="alert-style" className="mt-1" checked={s.style === o.id} onChange={() => update({ ...s, style: o.id })} />
            <span><span className="block font-medium">{o.title}</span><span className="text-xs text-muted-foreground">{o.hint}</span></span>
          </label>
        ))}
      </fieldset>

      <div>
        <div className="mb-2 flex items-center justify-between font-medium"><span className="flex items-center gap-2"><Volume2 className="size-4" aria-hidden />Volume</span><span>{Math.round(s.volume * 100)}%</span></div>
        <Slider aria-label="Alert volume" min={0} max={100} step={5} value={[Math.round(s.volume * 100)]} onValueChange={([v]) => update({ ...s, volume: (v ?? 0) / 100 })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={test} disabled={testing}>{testing ? "Playing…" : "Test alert"}</Button>
        {testing && <Button type="button" variant="outline" onClick={() => { stopOrderAlert(); setTesting(false); }}>Stop</Button>}
        {s.volume === 0 && <span className="text-xs text-destructive">Volume is 0% — you will not hear new orders.</span>}
      </div>

      <div className="rounded-lg border p-3">
        <p className="flex items-center gap-2 font-medium">
          {perm === "granted" ? <Bell className="size-4 text-primary" aria-hidden /> : <BellOff className="size-4 text-muted-foreground" aria-hidden />}
          Desktop notifications: {perm === "granted" ? "Allowed" : perm === "denied" ? "Blocked" : perm === "unsupported" ? "Not supported in this browser" : "Not enabled yet"}
        </p>
        {perm === "default" && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={enableNotifications}>Enable notifications</Button>}
        {perm === "denied" && <p className="mt-1 text-xs text-muted-foreground">Allow notifications for this site from the lock icon in your browser's address bar.</p>}
        <p className="mt-2 text-xs text-muted-foreground">Keep this tab open. Tap anywhere on the page once after opening it so the browser allows sound.</p>
      </div>
    </div>
  );
}
