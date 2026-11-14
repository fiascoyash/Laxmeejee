/** Short two-tone chime via Web Audio (no audio file needed). Browsers allow it after any click on the page. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ([[880, 0], [1320, 0.18], [880, 0.6], [1320, 0.78]] as [number, number][]).forEach(([f, t]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* ignore */ }
}
