import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepList({ title, steps, active }: { title: string; steps: string[]; active: number }) {
  return (
    <div className="glass relative overflow-hidden rounded-xl p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-primary/10 to-transparent animate-scan" />
      <p className="label-caps mb-3">{title}</p>
      <ul className="space-y-2">
        {steps.map((s, i) => {
          const state = i < active ? "done" : i === active ? "active" : "todo";
          return (
            <li key={s} className={cn("flex items-center gap-2.5 text-sm", state === "todo" ? "text-muted-foreground/60" : "text-foreground")}>
              {state === "done" ? (
                <Check className="size-4 text-success" />
              ) : state === "active" ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <span className="ml-1 mr-1 size-2 rounded-full border border-muted-foreground/50" />
              )}
              {s}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ANALYSIS_STEPS = ["Finding relevant pages", "Reading evidence", "Analyzing visual content", "Verifying evidence", "Preparing answer"];

/** Analysis runs as one server request; steps advance on a schedule and stay on the last until it returns. */
export function LoadingAnalysis() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const delays = [900, 2200, 6000, 6000];
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      if (i >= delays.length) return;
      t = setTimeout(() => {
        i++;
        setActive(i);
        next();
      }, delays[i]);
    };
    next();
    return () => clearTimeout(t);
  }, []);
  return <StepList title="Analyzing documents" steps={ANALYSIS_STEPS} active={active} />;
}
