import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatCountdown, responseMsLeft } from "@/lib/response-window";

export function ResponseCountdown({ createdAt, audience }: { createdAt: string; audience: "merchant" | "customer" }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = responseMsLeft(createdAt, now);
  const over = left <= 0;
  const text = audience === "merchant"
    ? over ? `Missed the 15-min window — waiting ${formatCountdown(-left)} extra. Reply now.` : `${formatCountdown(left)} left to accept or decline`
    : over ? "The shop hasn't replied in 15 minutes. You can call them or cancel." : `Shop must reply within ${formatCountdown(left)}`;
  return (
    <p role="timer" className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${over ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
      <Timer className="size-3.5" aria-hidden="true" />{text}
    </p>
  );
}
