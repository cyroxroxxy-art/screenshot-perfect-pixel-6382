import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/types";

const STYLES: Record<Confidence, { bar: string; text: string; fill: number }> = {
  high: { bar: "bg-success", text: "text-success", fill: 3 },
  medium: { bar: "bg-warning", text: "text-warning", fill: 2 },
  low: { bar: "bg-destructive", text: "text-destructive", fill: 1 },
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const s = STYLES[level];
  return (
    <div className="flex items-center gap-3">
      <span className="label-caps">Confidence</span>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2 w-6 rounded-full", i <= s.fill ? s.bar : "bg-muted")} />
        ))}
      </div>
      <span className={cn("font-mono text-xs font-semibold uppercase tracking-widest", s.text)}>{level}</span>
    </div>
  );
}
