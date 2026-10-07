import { Calculator } from "lucide-react";
import type { CalculationResult } from "@/lib/types";

export function CalculationCard({ calc }: { calc: CalculationResult }) {
  return (
    <div className="glass animate-fade-up rounded-xl p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Calculator className="size-4 text-violet" /> {calc.label}
      </p>
      <dl className="mt-3 space-y-1.5">
        {calc.inputs.map((i, k) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className="font-mono">
              {i.value}
              {calc.unit ? ` ${calc.unit}` : ""}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 rounded-lg bg-secondary/60 p-3 font-mono text-sm">
        <p className="text-muted-foreground">{calc.formula}</p>
        <p className="mt-1 text-lg font-semibold text-gradient">= {calc.display}</p>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Computed by DocMind from cited values, not by the AI model.</p>
    </div>
  );
}
