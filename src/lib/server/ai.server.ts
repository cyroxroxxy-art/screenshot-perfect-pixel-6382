import { AppError } from "./http.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const DEFAULT_MODEL = "openai/gpt-6-astra";

export type ResponsesInputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "high" | "low" | "auto" };

interface CallOptions {
  instructions: string;
  content: ResponsesInputPart[];
  schemaName: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  signal?: AbortSignal | undefined;
}

function mapStatus(status: number, body: string): AppError {
  let msg = "";
  try {
    msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? "";
  } catch {
    msg = body.slice(0, 200);
  }
  if (status === 401) return new AppError("AI API key is missing or invalid.", 500, "ai_key");
  if (status === 402)
    return new AppError(msg || "AI credits are exhausted. Add credits to the workspace to continue.", 402, "ai_credits");
  if (status === 403) return new AppError(msg || "AI access was denied for this request.", 403, "ai_denied");
  if (status === 429) return new AppError("AI service is rate limited. Please wait a moment and retry.", 429, "ai_rate");
  if (status === 400) return new AppError(`AI request was rejected: ${msg || "invalid request"}`, 400, "ai_bad_request");
  return new AppError("AI service is unavailable. Please retry.", 503, "ai_unavailable");
}

/** Streams a Responses API call server-side and returns the parsed structured JSON output. */
export async function callStructured<T>(opts: CallOptions): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AppError("AI API key is missing.", 500, "ai_key");
  const model = process.env["OPENAI_MODEL"] || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: "POST",
      signal: opts.signal ?? null,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model,
        instructions: opts.instructions,
        input: [{ role: "user", content: opts.content }],
        stream: true,
        store: false,
        reasoning: { effort: opts.effort ?? "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: opts.schemaName, schema: opts.schema, strict: true } },
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new AppError("Analysis was cancelled.", 499, "aborted");
    throw new AppError("AI service is unavailable. Please retry.", 503, "ai_unavailable");
  }
  if (!res.ok || !res.body) throw mapStatus(res.status, await res.text().catch(() => ""));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let refusal = "";
  let failed: string | null = null;

  const handle = (raw: string) => {
    const dataLines = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    if (!dataLines.length) return;
    const data = dataLines.join("\n");
    if (data === "[DONE]") return;
    let evt: { type?: string; delta?: string; response?: { error?: { message?: string } }; message?: string };
    try {
      evt = JSON.parse(data);
    } catch {
      return;
    }
    if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
    else if (evt.type === "response.refusal.delta" && evt.delta) refusal += evt.delta;
    else if (evt.type === "response.failed" || evt.type === "error")
      failed = evt.response?.error?.message ?? evt.message ?? "AI response failed";
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);

  if (refusal) throw new AppError(`The AI declined this request: ${refusal}`, 422, "ai_refusal");
  if (failed) throw new AppError(`AI service error: ${failed}`, 502, "ai_failed");
  if (!text.trim()) throw new AppError("AI returned an empty response. Please retry.", 502, "ai_empty");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError("AI returned an invalid response format. Please retry.", 502, "ai_parse");
  }
}

export function bytesToDataUrl(bytes: ArrayBuffer, mime = "image/jpeg") {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
