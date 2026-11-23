import { useEffect, useId, useRef, useState } from "react";

/** Brand artwork colours (logo only; part of the mark, not theme colours). */
const LIME = "#84E100";
const DEEP = "#0F3D24";
const WHITE = "#FFFFFF";

export type OwlMode = "idle" | "typing" | "searching" | "qr";
type Look = { x: number; y: number }; // -1..1

/** Shared gaze: follows pointer/touch, glances on scroll, idles; disabled with reduced motion. */
function useGaze(ref: React.RefObject<SVGSVGElement | null>, mode: OwlMode, lookTarget?: number) {
  const [look, setLook] = useState<Look>({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, idle = 0, blinkT = 0, scanT = 0, lastY = window.scrollY, pending: Look | null = null;
    const apply = () => { raf = 0; if (pending) setLook(pending); pending = null; };
    const queue = (l: Look) => { pending = l; if (!raf) raf = requestAnimationFrame(apply); };
    const toward = (cx: number, cy: number) => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      const a = Math.atan2(dy, dx), d = Math.min(1, Math.hypot(dx, dy) / 300);
      queue({ x: Math.cos(a) * d, y: Math.sin(a) * d });
    };
    const scheduleBlink = () => { blinkT = window.setTimeout(() => { setBlink(true); window.setTimeout(() => setBlink(false), 140); scheduleBlink(); }, 3500 + Math.random() * 2500); };
    scheduleBlink();
    if (reduced) return () => clearTimeout(blinkT);
    const resetIdle = () => { clearTimeout(idle); idle = window.setTimeout(function wander() { queue({ x: Math.random() * 1.6 - 0.8, y: Math.random() * 0.8 - 0.4 }); idle = window.setTimeout(wander, 2500 + Math.random() * 2000); }, 4000); };
    const onMove = (e: PointerEvent) => { if (mode === "idle") { toward(e.clientX, e.clientY); resetIdle(); } };
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t && mode === "idle") { toward(t.clientX, t.clientY); resetIdle(); } };
    const onScroll = () => { if (mode !== "idle") return; const y = window.scrollY; queue({ x: 0, y: y > lastY ? 0.7 : -0.7 }); lastY = y; resetIdle(); };
    if (mode === "searching") { let dir = 1; scanT = window.setInterval(() => { dir = -dir; queue({ x: dir, y: 0.1 }); }, 600); }
    if (mode === "qr") queue({ x: 0, y: 1 });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    resetIdle();
    return () => {
      cancelAnimationFrame(raf); clearTimeout(idle); clearTimeout(blinkT); clearInterval(scanT);
      window.removeEventListener("pointermove", onMove); window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch); window.removeEventListener("scroll", onScroll);
    };
  }, [ref, mode]);
  const typed = mode === "typing" ? { x: Math.max(-1, Math.min(1, ((lookTarget ?? 0) / 20) * 2 - 1)), y: 0.6 } : null;
  return { look: typed ?? look, blink };
}

function Eye({ cx, cy, r, look, blink, iris = true }: { cx: number; cy: number; r: number; look: Look; blink: boolean; iris?: boolean }) {
  const max = r * 0.42; // clamp: pupils never leave the eyeball
  const px = look.x * max, py = look.y * max;
  return (
    <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scaleY(${blink ? 0.1 : 1})`, transition: "transform 90ms ease" }}>
      <circle cx={cx} cy={cy} r={r} fill={WHITE} />
      <g style={{ transform: `translate(${px}px, ${py}px)`, transition: "transform 160ms ease-out" }}>
        {iris && <circle cx={cx} cy={cy} r={r * 0.5} fill={LIME} />}
        <circle cx={cx} cy={cy} r={r * (iris ? 0.24 : 0.42)} fill={DEEP} />
      </g>
    </g>
  );
}

/** Geometric owl head mascot. */
export function HisaabooOwl({ size = 40, mode = "idle", lookTarget, className, title = "Hisaaboo owl" }: { size?: number; mode?: OwlMode; lookTarget?: number; className?: string | undefined; title?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const { look, blink } = useGaze(ref, mode, lookTarget);
  const id = useId();
  return (
    <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-labelledby={id} style={{ flexShrink: 0 }}>
      <title id={id}>{title}</title>
      <path d="M14 22 L32 34 L68 34 L86 22 L84 62 Q84 92 50 94 Q16 92 16 62 Z" fill={LIME} />
      <path d="M30 66 Q50 82 70 66 Q66 86 50 88 Q34 86 30 66 Z" fill={DEEP} opacity="0.18" />
      <Eye cx={34} cy={54} r={15} look={look} blink={blink} />
      <Eye cx={66} cy={54} r={15} look={look} blink={blink} />
      <path d="M45 68 L55 68 L50 77 Z" fill={DEEP} />
    </svg>
  );
}

/** Rounded lowercase "hisaaboo" wordmark whose "oo" are watching eyes. tone="dark" = white text for dark backgrounds. */
export function HisaabooWordmark({ height = 28, tone = "light", className }: { height?: number; tone?: "light" | "dark"; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const { look, blink } = useGaze(ref, "idle");
  const ink = tone === "dark" ? WHITE : DEEP;
  return (
    <svg ref={ref} viewBox="0 0 218 56" height={height} width={(height * 218) / 56} className={className} role="img" aria-label="hisaaboo" style={{ flexShrink: 0 }}>
      <text x="0" y="44" fill={ink} fontFamily="'Nunito','Varela Round','Arial Rounded MT Bold',system-ui,sans-serif" fontWeight="900" fontSize="50" textLength="150" lengthAdjust="spacingAndGlyphs">hisaab</text>
      <g>
        <circle cx="168" cy="29" r="16" fill={LIME} />
        <circle cx="201" cy="29" r="16" fill={LIME} />
        <Eye cx={168} cy={29} r={10} look={look} blink={blink} iris={false} />
        <Eye cx={201} cy={29} r={10} look={look} blink={blink} iris={false} />
      </g>
    </svg>
  );
}

/** Logo lockups: full (owl above wordmark), wordmark (owl + wordmark inline for navbars), owl-only. */
export function HisaabooLogo({ variant = "wordmark", tone = "light", size = 32, className }: { variant?: "full" | "wordmark" | "owl-only"; tone?: "light" | "dark"; size?: number; className?: string }) {
  if (variant === "owl-only") return <HisaabooOwl size={size} className={className} />;
  if (variant === "full") return <span className={`inline-flex flex-col items-center gap-1 ${className ?? ""}`}><HisaabooOwl size={size * 2} /><HisaabooWordmark height={size} tone={tone} /></span>;
  return <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}><HisaabooOwl size={size} /><HisaabooWordmark height={size * 0.8} tone={tone} /></span>;
}
