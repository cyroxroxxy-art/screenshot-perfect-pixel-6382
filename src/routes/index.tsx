import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BrainCircuit, FileText, Files, FlaskConical, Image, ScanText, Table2, Target, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocMind AI — Multimodal Document Intelligence" },
      { name: "description", content: "Ask questions about PDFs — text, tables, charts, images and scans — and verify every answer with page-level citations." },
      { property: "og:title", content: "DocMind AI — Multimodal Document Intelligence" },
      { property: "og:description", content: "Ask questions. Understand documents. Verify every answer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: FileText, title: "Text Understanding", body: "Page-by-page extraction with section detection." },
  { icon: Table2, title: "Table Analysis", body: "Reads rows and columns to compare and total values." },
  { icon: BarChart3, title: "Chart & Graph Analysis", body: "Page images go to a vision model to read bars, lines and pies." },
  { icon: Image, title: "Image Understanding", body: "Describes figures, photos and diagrams on the page." },
  { icon: ScanText, title: "OCR", body: "Scanned pages are detected and transcribed automatically." },
  { icon: Files, title: "Cross-Document Reasoning", body: "Compare figures across reports, with conflicts flagged." },
  { icon: Target, title: "Page-Level Evidence", body: "Every claim cites a page you can open and inspect." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <header className="relative mx-auto flex h-16 max-w-6xl items-center px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand shadow-glow">
            <BrainCircuit className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display font-bold tracking-wider">DOCMIND AI</span>
        </div>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">HNX26PSI01</span>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-14 md:pt-24">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <p className="label-caps">Multimodal Document Intelligence</p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.02] md:text-7xl">
            DOCMIND <span className="text-gradient">AI</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            Ask questions. Understand documents. <span className="text-foreground">Verify every answer.</span>
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="hero" className="h-12 px-7">
              <Link to="/workspace" search={{ upload: true }}>
                <UploadCloud /> UPLOAD DOCUMENTS
              </Link>
            </Button>
            <Button asChild size="lg" variant="glass" className="h-12 px-7">
              <Link to="/workspace" search={{ demo: true }}>
                <FlaskConical /> TRY DEMO
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass group animate-fade-up rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
              style={{ animationDelay: `${120 + i * 50}ms` }}
            >
              <f.icon className="size-5 text-primary transition-colors group-hover:text-violet" />
              <h3 className="mt-4 font-display font-semibold">✓ {f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
          <Link to="/workspace" className="glass group flex flex-col justify-between rounded-2xl bg-brand/10 p-5 transition-all hover:border-primary/60">
            <span className="label-caps">Open workspace</span>
            <span className="mt-6 flex items-center gap-2 font-display font-semibold">
              Start analyzing <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>

        <ol className="mx-auto mt-20 flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {["Upload", "Extract", "OCR", "Retrieve", "Multimodal reasoning", "Calculate", "Cite"].map((s, i, a) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-full border px-3 py-1">{s}</span>
              {i < a.length - 1 && <ArrowRight className="size-3" />}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
