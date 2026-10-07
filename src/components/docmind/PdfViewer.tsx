import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSearch, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ErrorState } from "./ErrorState";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlight evidence in extracted text: exact match, else longest matching word run. */
function Highlighted({ text, evidence }: { text: string; evidence?: string | undefined }) {
  const parts = useMemo(() => {
    if (!evidence) return [text];
    const words = evidence.replace(/[“”"]/g, "").split(/\s+/).filter(Boolean);
    for (let len = words.length; len >= Math.min(4, words.length); len--) {
      for (let i = 0; i + len <= words.length; i++) {
        const re = new RegExp(words.slice(i, i + len).map(escapeRe).join("\\s+"), "i");
        const m = text.match(re);
        if (m && m.index !== undefined) return [text.slice(0, m.index), <mark key="m" className="rounded bg-warning/40 px-0.5 text-foreground">{m[0]}</mark>, text.slice(m.index + m[0].length)];
      }
    }
    return [text];
  }, [text, evidence]);
  return <>{parts}</>;
}

export function PdfViewer({
  docId,
  page,
  pageCount,
  evidence,
  onPage,
}: {
  docId: string | null;
  page: number;
  pageCount: number;
  evidence?: string | undefined;
  onPage: (n: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [showText, setShowText] = useState(false);
  const q = useQuery({
    queryKey: ["page", docId, page],
    queryFn: () => api.getPage(docId!, page),
    enabled: !!docId,
    staleTime: 50 * 60 * 1000,
  });

  if (!docId)
    return (
      <div className="grid h-full min-h-[420px] place-items-center rounded-xl border border-dashed text-center">
        <div>
          <FileSearch className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Upload a document to begin.</p>
        </div>
      </div>
    );

  const d = q.data;
  return (
    <div className="flex h-full flex-col">
      <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{d?.documentName ?? "Loading…"}</p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-16 text-center font-mono text-xs">
            {page} / {pageCount}
          </span>
          <Button size="icon" variant="ghost" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            <ChevronRight />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="icon" variant="ghost" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
            <ZoomOut />
          </Button>
          <span className="w-10 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
            <ZoomIn />
          </Button>
        </div>
      </div>

      {d && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="rounded-md bg-secondary px-2 py-0.5 font-mono uppercase tracking-wider">{d.contentType}</span>
          {d.section && <span className="truncate text-muted-foreground">{d.section}</span>}
          <button onClick={() => setShowText((s) => !s)} className="ml-auto text-primary hover:underline">
            {showText ? "Show page image" : "Show extracted text"}
          </button>
        </div>
      )}

      <div className="relative min-h-[420px] flex-1 overflow-auto rounded-xl border bg-secondary/30 p-3 grid-lines">
        {q.isLoading && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        {q.error && <ErrorState title="Could not load page" message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {d && !showText && (
          <div key={`${docId}-${page}`} className="animate-fade-up mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? 820 : undefined }}>
            {d.imageUrl ? (
              <img src={d.imageUrl} alt={`${d.documentName} page ${page}`} className={cn("w-full rounded-md bg-paper shadow-2xl", evidence && "ring-2 ring-warning")} />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No page image available.</p>
            )}
          </div>
        )}
        {d && showText && (
          <pre className="whitespace-pre-wrap p-2 font-sans text-sm leading-relaxed" style={{ fontSize: `${zoom * 0.875}rem` }}>
            {d.extractedText ? <Highlighted text={d.extractedText} evidence={evidence} /> : "Could not extract text from this page."}
          </pre>
        )}
      </div>
      {evidence && d && (
        <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
          <span className="font-semibold">Cited evidence:</span> “{evidence}”{" "}
          {!showText && (
            <button onClick={() => setShowText(true)} className="text-primary underline">
              highlight in text
            </button>
          )}
        </p>
      )}
    </div>
  );
}
