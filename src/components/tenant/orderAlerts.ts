/**
 * Merchant order alert engine. Everything is synthesised with Web Audio + speechSynthesis,
 * so no audio files ship with the app. Preferences live in localStorage per shop.
 */
export type AlertStyle = "chime" | "continuous" | "voice";
export type AlertSettings = { style: AlertStyle; volume: number };
export type AlertOrderInfo = { table?: string; customerName?: string; total?: number; isFar?: boolean };

export const DEFAULT_ALERT_SETTINGS: AlertSettings = { style: "continuous", volume: 0.8 };
const STYLES: AlertStyle[] = ["chime", "continuous", "voice"];
/** Safety cap so a forgotten tab does not ring forever (ms). */
const MAX_RING_MS = 3 * 60 * 1000;
const LOOP_MS = 1800;

export const alertSettingsKey = (businessId: string) => `hisaaboo_order_alert_settings_${businessId}`;

export function parseAlertSettings(raw: string | null | undefined): AlertSettings {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<AlertSettings> | null;
    const style = v && STYLES.includes(v.style as AlertStyle) ? (v.style as AlertStyle) : DEFAULT_ALERT_SETTINGS.style;
    const vol = Number(v?.volume);
    return { style, volume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : DEFAULT_ALERT_SETTINGS.volume };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

export function loadAlertSettings(businessId: string): AlertSettings {
  if (typeof window === "undefined") return { ...DEFAULT_ALERT_SETTINGS };
  try { return parseAlertSettings(localStorage.getItem(alertSettingsKey(businessId))); } catch { return { ...DEFAULT_ALERT_SETTINGS }; }
}

export function saveAlertSettings(businessId: string, s: AlertSettings) {
  try { localStorage.setItem(alertSettingsKey(businessId), JSON.stringify(parseAlertSettings(JSON.stringify(s)))); } catch { /* ignore */ }
}

/** Sentence spoken in voice mode. */
export function alertSpeechText(o: AlertOrderInfo): string {
  const amount = o.total != null && Number.isFinite(Number(o.total)) ? `, amount Rupees ${Math.round(Number(o.total))}` : "";
  const base = o.table
    ? `New Dine-in order! ${o.table}${amount}.`
    : `New pickup order${o.customerName ? ` from ${o.customerName}` : ""}${amount ? `, Rupees ${Math.round(Number(o.total))}` : ""}.`;
  return o.isFar ? `${base} Warning, placed far from restaurant.` : base;
}

/* ---------------- Audio plumbing ---------------- */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices: OscillatorNode[] = [];
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let capTimer: ReturnType<typeof setTimeout> | null = null;
let ringing = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  return ctx;
}

export function isAudioUnlocked(): boolean {
  return !!ctx && ctx.state === "running";
}

/** Resume audio from a user gesture. Safe to call often. */
export function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return Promise.resolve(false);
  if (c.state === "running") return Promise.resolve(true);
  return c.resume().then(() => c.state === "running").catch(() => false);
}

/** Resume audio on the first tap/click/key anywhere. Returns a cleanup. */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const h = () => { void unlockAudio(); };
  const evs = ["pointerdown", "keydown", "touchstart"] as const;
  evs.forEach((e) => window.addEventListener(e, h, { passive: true }));
  return () => evs.forEach((e) => window.removeEventListener(e, h));
}

function tone(freq: number, at: number, dur: number, peak: number, type: OscillatorType = "sine") {
  const c = getCtx(); if (!c || !master) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
  voices.push(o);
  o.onended = () => { voices = voices.filter((v) => v !== o); };
}

function setVolume(v: number) {
  if (master && ctx) master.gain.setValueAtTime(Math.min(1, Math.max(0, v)), ctx.currentTime);
}

function playChimeOnce() {
  ([[880, 0], [1320, 0.18], [880, 0.6], [1320, 0.78]] as const).forEach(([f, t]) => tone(f, t, 0.35, 0.5));
}

/** Insistent POS-style arpeggio (C major triad up + octave, doubled). ~1.2s. */
function playRingOnce() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  [0, 0.6].forEach((base) => notes.forEach((f, i) => {
    tone(f, base + i * 0.12, 0.22, 0.55, "triangle");
    tone(f * 2, base + i * 0.12, 0.12, 0.12, "sine");
  }));
}

function speak(text: string, volume: number, onDone: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { onDone(); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN"; u.rate = 0.95; u.volume = Math.min(1, Math.max(0, volume));
    let done = false; const finish = () => { if (!done) { done = true; onDone(); } };
    u.onend = finish; u.onerror = finish;
    setTimeout(finish, 9000);
    window.speechSynthesis.speak(u);
  } catch { onDone(); }
}

/** Silence everything immediately. */
export function stopOrderAlert() {
  ringing = false;
  if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
  if (capTimer) { clearTimeout(capTimer); capTimer = null; }
  voices.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
  voices = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}

export function isOrderAlertRinging() { return ringing; }

export type StartAlertOptions = AlertSettings & { order?: AlertOrderInfo; maxMs?: number };

/** Start the chosen alert. chime plays once; continuous/voice loop until stopOrderAlert(). */
export function startOrderAlert(opts: StartAlertOptions) {
  stopOrderAlert();
  const c = getCtx(); if (!c) return;
  void unlockAudio();
  setVolume(opts.volume);
  if (opts.style === "chime") { playChimeOnce(); return; }
  ringing = true;
  capTimer = setTimeout(stopOrderAlert, opts.maxMs ?? MAX_RING_MS);
  if (opts.style === "continuous") {
    const loop = () => { if (!ringing) return; playRingOnce(); loopTimer = setTimeout(loop, LOOP_MS); };
    loop();
    return;
  }
  const text = alertSpeechText(opts.order ?? {});
  const loop = () => {
    if (!ringing) return;
    playRingOnce();
    loopTimer = setTimeout(() => {
      if (!ringing) return;
      speak(text, opts.volume, () => { if (ringing) loopTimer = setTimeout(loop, 1200); });
    }, 1300);
  };
  loop();
}

/** 4-second preview for settings. */
export function testOrderAlert(style: AlertStyle, volume: number) {
  startOrderAlert({ style, volume, maxMs: style === "voice" ? 7000 : 4000, order: { table: "Table 3", total: 450 } });
}

/** Back-compat: the original quick chime. */
export function playChime() {
  startOrderAlert({ style: "chime", volume: DEFAULT_ALERT_SETTINGS.volume });
}
