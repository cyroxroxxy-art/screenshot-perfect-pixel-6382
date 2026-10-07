import { ArrowUpRight, Sparkle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "What was the revenue in 2024?",
  "Which year had the highest revenue?",
  "Calculate the percentage increase from 2023 to 2024.",
  "What does the chart show?",
  "What are the main findings of this report?",
];

export function QuestionInput({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-2 focus-within:shadow-glow">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy && !disabled && value.trim()) onSubmit();
            }
          }}
          placeholder="Ask a question about your documents..."
          className="min-h-24 resize-none border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0"
          maxLength={1000}
        />
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-[10px] text-muted-foreground">Enter to analyze · Shift+Enter new line</span>
          {busy ? (
            <Button size="sm" variant="glass" onClick={onStop}>
              <Square /> Stop
            </Button>
          ) : (
            <Button size="sm" variant="hero" onClick={onSubmit} disabled={disabled || !value.trim()}>
              ANALYZE <ArrowUpRight />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className="flex items-center gap-1 rounded-full border bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Sparkle className="size-3" /> {q}
          </button>
        ))}
      </div>
    </div>
  );
}
