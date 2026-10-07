import type { CalculationResult } from "./types";

export const CALC_OPERATIONS = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "percentage_increase",
  "percentage_decrease",
  "percentage_change",
  "average",
  "ratio",
  "max",
  "min",
  "difference",
] as const;
export type CalcOperation = (typeof CALC_OPERATIONS)[number];

export interface CalcRequest {
  label: string;
  operation: CalcOperation;
  operands: { label: string; value: number }[];
  unit: string;
}

const fmt = (n: number) =>
  Number.isInteger(n) ? n.toString() : (Math.round(n * 10000) / 10000).toString();

/** Deterministic arithmetic — the model chooses operands, application code computes. */
export function runCalculation(req: CalcRequest): CalculationResult {
  const vals = req.operands.map((o) => o.value).filter((v) => Number.isFinite(v));
  const base: Omit<CalculationResult, "formula" | "result" | "display"> = {
    label: req.label,
    operation: req.operation,
    inputs: req.operands,
    unit: req.unit,
  };
  const bad = (why: string): CalculationResult => ({ ...base, formula: why, result: null, display: "Not computable" });
  if (vals.length === 0) return bad("No numeric inputs");
  const a = vals[0] ?? 0;
  const b = vals[1] ?? 0;
  let result: number;
  let formula: string;
  let pct = false;
  switch (req.operation) {
    case "add":
      result = vals.reduce((s, v) => s + v, 0);
      formula = vals.map(fmt).join(" + ");
      break;
    case "subtract":
    case "difference":
      if (vals.length < 2) return bad("Needs two values");
      result = a - b;
      formula = `${fmt(a)} − ${fmt(b)}`;
      break;
    case "multiply":
      result = vals.reduce((s, v) => s * v, 1);
      formula = vals.map(fmt).join(" × ");
      break;
    case "divide":
    case "ratio":
      if (vals.length < 2) return bad("Needs two values");
      if (b === 0) return bad("Division by zero");
      result = a / b;
      formula = `${fmt(a)} ÷ ${fmt(b)}`;
      break;
    case "percentage_increase":
    case "percentage_decrease":
    case "percentage_change":
      if (vals.length < 2) return bad("Needs old and new value");
      if (a === 0) return bad("Old value is zero");
      result = ((b - a) / Math.abs(a)) * 100;
      if (req.operation === "percentage_decrease") result = -result;
      formula =
        req.operation === "percentage_decrease"
          ? `((${fmt(a)} − ${fmt(b)}) / ${fmt(a)}) × 100`
          : `((${fmt(b)} − ${fmt(a)}) / ${fmt(a)}) × 100`;
      pct = true;
      break;
    case "average":
      result = vals.reduce((s, v) => s + v, 0) / vals.length;
      formula = `(${vals.map(fmt).join(" + ")}) / ${vals.length}`;
      break;
    case "max":
      result = Math.max(...vals);
      formula = `max(${vals.map(fmt).join(", ")})`;
      break;
    case "min":
      result = Math.min(...vals);
      formula = `min(${vals.map(fmt).join(", ")})`;
      break;
    default:
      return bad("Unsupported operation");
  }
  const rounded = Math.round(result * 100) / 100;
  const display = pct ? `${rounded.toFixed(2)}%` : `${fmt(rounded)}${req.unit && req.operation !== "ratio" ? ` ${req.unit}` : ""}`;
  return { ...base, formula, result: rounded, display };
}
