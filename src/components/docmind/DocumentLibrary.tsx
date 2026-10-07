import { CheckCircle2, FileText, Loader2, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentWithPages } from "@/lib/types";
import { StepList } from "./LoadingAnalysis";
import { ErrorState } from "./ErrorState";

export interface UploadJob {
  key: string;
  filename: string;
  step: number; // 0 uploading..4 preparing; 5 done
  detail?: string | undefined;
  error?: string;
  retry?: () => void;
}

const PROCESS_STEPS = ["Uploading", "Reading pages", "Extracting content", "Detecting tables and visuals", "Preparing document"];

export function DocumentLibrary({
  docs,
  jobs,
  activeDocId,
  onOpen,
  onRemove,
  onDismissJob,
}: {
  docs: DocumentWithPages[];
  jobs: UploadJob[];
  activeDocId: string | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onDismissJob: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      {jobs.map((j) =>
        j.error ? (
          <div key={j.key} className="space-y-1">
            <ErrorState title={`PDF could not be processed — ${j.filename}`} message={j.error} onRetry={j.retry} />
            <button className="text-xs text-muted-foreground underline" onClick={() => onDismissJob(j.key)}>
              Dismiss
            </button>
          </div>
        ) : (
          <div key={j.key}>
            <p className="mb-1.5 truncate text-sm font-medium">{j.filename}</p>
            <StepList title={`Processing document${j.detail ? ` · ${j.detail}` : ""}`} steps={PROCESS_STEPS} active={j.step} />
          </div>
        ),
      )}
      {docs.map((d) => {
        const scanned = d.pages.filter((p) => p.content_type === "scanned").length;
        const ocrPending = d.pages.some((p) => p.processing_status === "needs_ocr");
        return (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(d.id)}
            onKeyDown={(e) => e.key === "Enter" && onOpen(d.id)}
            className={cn(
              "group glass flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-all hover:border-primary/40",
              activeDocId === d.id && "border-primary/60 shadow-glow",
            )}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15">
              <FileText className="size-4 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={d.filename}>
                {d.filename}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {d.page_count} pages{scanned ? ` · ${scanned} scanned` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {d.upload_status === "processed" ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    {ocrPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                    {ocrPending ? "Running OCR" : "Processed"}
                  </span>
                ) : d.upload_status === "failed" ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <XCircle className="size-3" /> Failed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-warning">
                    <Loader2 className="size-3 animate-spin" /> Processing
                  </span>
                )}
                {d.is_demo && (
                  <span className="rounded bg-violet/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-violet">Demo document</span>
                )}
              </div>
            </div>
            <button
              aria-label={`Remove ${d.filename}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(d.id);
              }}
              className="rounded-md p-1.5 text-muted-foreground opacity-60 transition hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
