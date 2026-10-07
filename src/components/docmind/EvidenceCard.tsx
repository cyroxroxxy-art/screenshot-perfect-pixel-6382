import { Eye, FileText, ShieldCheck, ShieldAlert, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Citation } from "@/lib/types";

export function EvidenceCard({ citation, index, onView }: { citation: Citation; index: number; onView: () => void }) {
  return (
    <div className="glass animate-fade-up rounded-xl p-3.5" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <FileText className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{citation.documentName}</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            Page {citation.pageNumber}
            {citation.section ? ` · ${citation.section}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-secondary-foreground">
          {citation.contentType}
        </span>
      </div>
      <blockquote className="mt-2.5 border-l-2 border-primary/60 pl-3 text-sm leading-relaxed text-foreground/90">
        “{citation.evidence}”
      </blockquote>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {citation.visualSource ? (
            <>
              <ImageIcon className="size-3.5 text-violet" /> Read from page image
            </>
          ) : citation.verified ? (
            <>
              <ShieldCheck className="size-3.5 text-success" /> Matched in page text
            </>
          ) : (
            <>
              <ShieldAlert className="size-3.5 text-warning" /> Not matched exactly
            </>
          )}
        </span>
        <Button size="sm" variant="glass" onClick={onView}>
          <Eye /> View page
        </Button>
      </div>
    </div>
  );
}
