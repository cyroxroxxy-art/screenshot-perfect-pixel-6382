import { Info, Layers } from "lucide-react";
import type { AnalysisResponse, Citation } from "@/lib/types";
import { CalculationCard } from "./CalculationCard";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { EvidenceCard } from "./EvidenceCard";

export function AnswerCard({ result, onViewCitation }: { result: AnalysisResponse; onViewCitation: (c: Citation) => void }) {
  return (
    <div className="space-y-5">
      <section className="glass animate-fade-up rounded-xl p-4">
        <p className="label-caps mb-2">AI Answer</p>
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{result.answer}</div>
        <div className="mt-4 border-t pt-3">
          <ConfidenceBadge level={result.confidence} />
        </div>
      </section>

      {result.calculations.length > 0 && (
        <section className="space-y-2">
          <p className="label-caps">Calculation</p>
          {result.calculations.map((c, i) => (
            <CalculationCard key={i} calc={c} />
          ))}
        </section>
      )}

      {result.citations.length > 0 && (
        <section className="space-y-2">
          <p className="label-caps">Evidence · {result.citations.length}</p>
          {result.citations.map((c, i) => (
            <EvidenceCard key={i} index={i} citation={c} onView={() => onViewCitation(c)} />
          ))}
        </section>
      )}

      {result.limitations.length > 0 && (
        <section className="rounded-xl border border-warning/30 bg-warning/5 p-3.5">
          <p className="label-caps mb-1.5 flex items-center gap-1.5">
            <Info className="size-3.5" /> Limitations
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="flex cursor-pointer items-center gap-1.5">
          <Layers className="size-3.5" /> Pages retrieved for this answer ({result.pagesConsidered.length})
        </summary>
        <ul className="mt-2 space-y-0.5 pl-5 font-mono">
          {result.pagesConsidered.map((p, i) => (
            <li key={i}>
              {p.documentName} · p.{p.pageNumber}
              {p.imageSent ? " · image analyzed" : " · text only"}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
