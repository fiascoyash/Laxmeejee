import { Zap } from "lucide-react";
import { responseRating, type ResponseStats } from "@/lib/discovery";

export function ResponseBadge({ stats, className = "" }: { stats?: ResponseStats | null | undefined; className?: string }) {
  const r = responseRating(stats);
  if (!r) return <p className={`text-xs text-muted-foreground ${className}`}>New on Hisaaboo · no response rating yet</p>;
  return (
    <p className={`flex flex-wrap items-center gap-1.5 text-xs ${className}`} title={`Based on ${r.orders} recent orders`}>
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary"><Zap className="size-3" aria-hidden="true" />{r.score.toFixed(1)} · {r.label}</span>
      <span className="text-muted-foreground">Replies in {r.time}</span>
    </p>
  );
}
