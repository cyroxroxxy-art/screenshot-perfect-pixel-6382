import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocumentUpload({ onFiles, compact, inputRef }: { onFiles: (files: File[]) => void; compact?: boolean; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition-all",
        compact ? "p-3" : "p-6",
        over ? "border-primary bg-primary/10 shadow-glow" : "border-border hover:border-primary/60 hover:bg-secondary/40",
      )}
    >
      <UploadCloud className={cn("text-primary", compact ? "size-5" : "size-7")} />
      <p className="text-sm font-medium">{compact ? "Add PDFs" : "Drop PDFs here or click to upload"}</p>
      {!compact && <p className="text-xs text-muted-foreground">Up to 40 MB · 120 pages per file</p>}
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
