import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, FlaskConical, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AnswerCard } from "@/components/docmind/AnswerCard";
import { DocumentLibrary, type UploadJob } from "@/components/docmind/DocumentLibrary";
import { DocumentUpload } from "@/components/docmind/DocumentUpload";
import { ErrorState } from "@/components/docmind/ErrorState";
import { LoadingAnalysis } from "@/components/docmind/LoadingAnalysis";
import { PageSelector } from "@/components/docmind/PageSelector";
import { PdfViewer } from "@/components/docmind/PdfViewer";
import { QuestionInput } from "@/components/docmind/QuestionInput";
import { api, ApiError } from "@/lib/api";
import { PdfError, processPdf } from "@/lib/pdf-processing";
import type { AnalysisResponse, Citation, DocumentWithPages } from "@/lib/types";

const DEMO_URL = "/demo/Nimbus_Annual_Report_2024.pdf";
const DEMO_NAME = "Nimbus_Annual_Report_2024.pdf";

export const Route = createFileRoute("/workspace")({
  validateSearch: z.object({ demo: z.boolean().optional(), upload: z.boolean().optional() }),
  head: () => ({
    meta: [
      { title: "Workspace — DocMind AI" },
      { name: "description", content: "Upload PDFs, select pages and ask evidence-backed questions with page-level citations." },
      { property: "og:title", content: "Workspace — DocMind AI" },
      { property: "og:description", content: "Ask questions across your PDFs and verify every answer against the cited page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

const STEP_INDEX = { reading: 1, extracting: 2, detecting: 3, preparing: 4 } as const;

function Workspace() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const docsQ = useQuery({ queryKey: ["documents"], queryFn: api.listDocuments, enabled: ready });
  const docs: DocumentWithPages[] = docsQ.data ?? [];

  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<{ docId: string; page: number; evidence?: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const knownDocs = useRef<Set<string>>(new Set());

  // auto-select pages of newly loaded documents; open first doc
  useEffect(() => {
    const fresh = docs.filter((d) => !knownDocs.current.has(d.id));
    if (!fresh.length) return;
    fresh.forEach((d) => knownDocs.current.add(d.id));
    setSelected((s) => {
      const n = new Set(s);
      fresh.forEach((d) => d.pages.forEach((p) => n.add(`${d.id}:${p.page_number}`)));
      return n;
    });
    setView((v) => v ?? { docId: fresh[0].id, page: 1 });
  }, [docs]);

  // keep polling while OCR is pending
  const ocrPending = docs.some((d) => d.pages.some((p) => p.processing_status === "needs_ocr"));
  useEffect(() => {
    if (!ocrPending) return;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["documents"] }), 4000);
    return () => clearInterval(t);
  }, [ocrPending, qc]);

  const ingest = useCallback(
    async (file: Blob, filename: string, isDemo: boolean) => {
      const key = `${filename}-${Date.now()}`;
      const update = (patch: Partial<UploadJob>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));
      setJobs((js) => [...js, { key, filename, step: 0 }]);
      try {
        const processed = await processPdf(file, (step, done, total) =>
          update({ step: STEP_INDEX[step], detail: total > 1 ? `page ${Math.min(done + 1, total)} of ${total}` : undefined }),
        );
        update({ step: 4, detail: "uploading pages" });
        const res = await api.upload(file, filename, processed, isDemo);
        setJobs((js) => js.filter((j) => j.key !== key));
        await qc.invalidateQueries({ queryKey: ["documents"] });
        setView({ docId: res.id, page: 1 });
        toast.success(`${filename} processed · ${res.pageCount} pages`);
        if (res.scannedPages > 0) {
          toast.info(`Running OCR on ${res.scannedPages} scanned page(s)…`);
          api
            .runOcr(res.id)
            .then(() => qc.invalidateQueries({ queryKey: ["documents"] }))
            .catch((e: Error) => {
              toast.error(`OCR failed: ${e.message}`);
              qc.invalidateQueries({ queryKey: ["documents"] });
            });
        }
      } catch (e) {
        const msg = e instanceof PdfError || e instanceof ApiError ? e.message : "PDF could not be processed.";
        update({ error: msg, retry: () => { setJobs((js) => js.filter((j) => j.key !== key)); ingest(file, filename, isDemo); } });
      }
    },
    [qc],
  );

  const onFiles = (files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < files.length) toast.error("Only PDF files are supported.");
    pdfs.forEach((f) => ingest(f, f.name, false));
  };

  const loadDemo = useCallback(async () => {
    if (docs.some((d) => d.is_demo)) {
      toast.info("Demo document is already loaded.");
      return;
    }
    try {
      const res = await fetch(DEMO_URL);
      if (!res.ok) throw new Error();
      await ingest(await res.blob(), DEMO_NAME, true);
    } catch {
      toast.error("Could not load the demo document.");
    }
  }, [docs, ingest]);

  // landing-page intents
  const handledIntent = useRef(false);
  useEffect(() => {
    if (!ready || docsQ.isLoading || handledIntent.current) return;
    handledIntent.current = true;
    if (search.demo) loadDemo();
    else if (search.upload) uploadInput.current?.click();
  }, [ready, docsQ.isLoading, search.demo, search.upload, loadDemo]);

  const removeDoc = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setSelected((s) => new Set([...s].filter((k) => !k.startsWith(id))));
      if (view?.docId === id) setView(null);
      knownDocs.current.delete(id);
      await qc.invalidateQueries({ queryKey: ["documents"] });
      setView((v) => v ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const runAnalysis = async () => {
    setError(null);
    if (!docs.length) return setError("No document has been uploaded.");
    if (!selected.size) return setError("No pages are selected.");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setResult(null);
    try {
      const sel = [...selected].map((k) => {
        const [documentId, n] = k.split(":");
        return { documentId, pageNumber: Number(n) };
      });
      setResult(await api.analyze(question.trim(), sel, ctrl.signal));
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "aborted")) setError((e as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const openCitation = (c: Citation) => {
    if (!c.documentId) return;
    setView({ docId: c.documentId, page: c.pageNumber, evidence: c.evidence });
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const viewDoc = docs.find((d) => d.id === view?.docId) ?? null;
  const isDemoOnly = docs.length > 0 && docs.every((d) => d.is_demo);

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" position="top-center" />
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand">
              <BrainCircuit className="size-4 text-primary-foreground" />
            </span>
            <span className="font-display text-sm font-bold tracking-wider">DOCMIND AI</span>
          </Link>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">Multimodal Document Intelligence</span>
          <div className="ml-auto flex items-center gap-2">
            {isDemoOnly && <span className="rounded bg-violet/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-violet">Demo document</span>}
            <Button size="sm" variant="glass" onClick={loadDemo}>
              <FlaskConical /> Try demo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
        {/* LEFT */}
        <aside className="space-y-5 lg:sticky lg:top-18 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
          <div>
            <p className="label-caps mb-2">Documents</p>
            <div className="space-y-2">
              <DocumentUpload onFiles={onFiles} compact={docs.length > 0} inputRef={uploadInput} />
              {docsQ.error && <ErrorState title="Could not load documents" message={(docsQ.error as Error).message} onRetry={() => docsQ.refetch()} />}
              <DocumentLibrary
                docs={docs}
                jobs={jobs}
                activeDocId={view?.docId ?? null}
                onOpen={(id) => setView({ docId: id, page: 1 })}
                onRemove={removeDoc}
                onDismissJob={(k) => setJobs((js) => js.filter((j) => j.key !== k))}
              />
            </div>
          </div>
          {docs.length > 0 && (
            <PageSelector
              docs={docs}
              selected={selected}
              onToggle={(k) =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(k)) n.delete(k);
                  else n.add(k);
                  return n;
                })
              }
              onSelectAll={() => setSelected(new Set(docs.flatMap((d) => d.pages.map((p) => `${d.id}:${p.page_number}`))))}
              onClear={() => setSelected(new Set())}
              onOpenPage={(docId, page) => setView({ docId, page })}
            />
          )}
        </aside>

        {/* CENTER */}
        <section ref={viewerRef} className="min-w-0 scroll-mt-20">
          <PdfViewer
            docId={viewDoc?.id ?? null}
            page={view?.page ?? 1}
            pageCount={viewDoc?.page_count ?? 1}
            evidence={view?.evidence}
            onPage={(n) => view && setView({ docId: view.docId, page: n })}
          />
        </section>

        {/* RIGHT */}
        <aside className="space-y-4 lg:sticky lg:top-18 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pl-1">
          <div>
            <h2 className="mb-2 font-display text-lg font-bold tracking-wide">ASK YOUR DOCUMENTS</h2>
            <QuestionInput
              value={question}
              onChange={setQuestion}
              onSubmit={runAnalysis}
              onStop={() => abortRef.current?.abort()}
              busy={busy}
              disabled={!docs.length}
            />
            {docs.length > 0 && selected.size === 0 && <p className="mt-2 text-xs text-warning">Select at least one page to analyze.</p>}
          </div>
          {busy && <LoadingAnalysis />}
          {error && <ErrorState title="Analysis failed" message={error} onRetry={question.trim() ? runAnalysis : undefined} />}
          {result && !busy && <AnswerCard result={result} onViewCitation={openCitation} />}
          {!result && !busy && !error && (
            <div className="grid place-items-center rounded-xl border border-dashed p-8 text-center">
              <MessageSquareText className="size-7 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">{docs.length ? "Ask a question about your documents." : "Upload a document to begin."}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
