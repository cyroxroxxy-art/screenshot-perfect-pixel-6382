import { cn } from "@/lib/utils";
import type { DocumentWithPages } from "@/lib/types";

const TYPE_DOT: Record<string, string> = {
  text: "bg-muted-foreground/50",
  table: "bg-primary",
  chart: "bg-violet",
  graph: "bg-violet",
  image: "bg-warning",
  scanned: "bg-destructive",
};

export function PageSelector({
  docs,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  onOpenPage,
}: {
  docs: DocumentWithPages[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onOpenPage: (docId: string, page: number) => void;
}) {
  const total = docs.reduce((s, d) => s + d.pages.length, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="label-caps">
          Selected pages · {selected.size}/{total}
        </p>
        <div className="flex gap-1">
          <button onClick={onSelectAll} className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-secondary">
            Select all
          </button>
          <button onClick={onClear} className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-secondary">
            Clear
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {docs.map((d) => (
          <div key={d.id}>
            <p className="mb-1 truncate text-xs text-muted-foreground">{d.filename}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {d.pages.map((p) => {
                const key = `${d.id}:${p.page_number}`;
                const on = selected.has(key);
                return (
                  <button
                    key={key}
                    title={`Page ${p.page_number} · ${p.content_type}${p.section ? ` · ${p.section}` : ""} (double-click to view)`}
                    onClick={() => onToggle(key)}
                    onDoubleClick={() => onOpenPage(d.id, p.page_number)}
                    className={cn(
                      "relative h-9 rounded-md border font-mono text-xs transition-all",
                      on ? "border-primary bg-primary/20 text-foreground" : "bg-secondary/30 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {p.page_number}
                    <span className={cn("absolute right-1 top-1 size-1.5 rounded-full", TYPE_DOT[p.content_type] ?? TYPE_DOT.text)} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {Object.entries({ text: "Text", table: "Table", chart: "Chart/graph", image: "Image", scanned: "Scanned" }).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", TYPE_DOT[k])} /> {v}
          </span>
        ))}
      </div>
    </div>
  );
}
