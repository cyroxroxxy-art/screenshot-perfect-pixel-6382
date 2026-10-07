import { CALC_OPERATIONS, runCalculation, type CalcRequest } from "@/lib/calc";
import type { AnalysisResponse, Citation, Confidence, ContentType, SelectedPage } from "@/lib/types";
import { bytesToDataUrl, callStructured, type ResponsesInputPart } from "./ai.server";
import { AppError, getAdmin } from "./http.server";
import { evidenceAppears, isVisualQuestion, retrieve, type RetrievablePage } from "./retrieval.server";

const INSUFFICIENT = "I can't determine this reliably from the selected evidence.";
const CONTENT_TYPES = ["text", "table", "chart", "graph", "image", "scanned"] as const;
const MAX_IMAGES = 4;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "confidence", "citations", "calculations", "limitations", "conflict"],
  properties: {
    answer: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    conflict: { type: "boolean" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["documentName", "pageNumber", "section", "evidence", "contentType"],
        properties: {
          documentName: { type: "string" },
          pageNumber: { type: "integer" },
          section: { type: "string" },
          evidence: { type: "string" },
          contentType: { type: "string", enum: CONTENT_TYPES },
        },
      },
    },
    calculations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "operation", "operands", "unit"],
        properties: {
          label: { type: "string" },
          operation: { type: "string", enum: CALC_OPERATIONS },
          operands: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "value"],
              properties: { label: { type: "string" }, value: { type: "number" } },
            },
          },
          unit: { type: "string" },
        },
      },
    },
    limitations: { type: "array", items: { type: "string" } },
  },
} as const;

interface ModelOutput {
  answer: string;
  confidence: Confidence;
  conflict: boolean;
  citations: { documentName: string; pageNumber: number; section: string; evidence: string; contentType: ContentType }[];
  calculations: CalcRequest[];
  limitations: string[];
}

const INSTRUCTIONS = `You are DocMind, a meticulous document-analysis assistant.
Rules:
- Use ONLY the provided page text and page images. Never use outside knowledge or invent facts.
- Every factual claim must be supported by a citation pointing to the exact document name and page number provided. Quote short verbatim evidence from the page text; for evidence read from an image (chart, graph, picture, scanned page), describe precisely what is visible.
- Only cite pages that were provided to you.
- If the evidence is insufficient, answer exactly "${INSUFFICIENT}", set confidence to "low", give no citations, and add the limitation "Insufficient evidence was found in the selected documents."
- If documents conflict, say so explicitly, set conflict=true, and cite both sources.
- For any arithmetic (totals, differences, percentage change, averages, ratios, max/min), DO NOT compute the final number yourself in calculations. Put each needed calculation in "calculations" with operation and numeric operands (plain numbers, no units). For percentage_increase/decrease/change give operands in order [old, new]. For subtract/divide give [a, b]. The application will compute results; in the answer you may refer to the calculation by label. Use an empty array when no math is needed.
- Confidence: high = directly stated and clearly cited; medium = requires interpretation of a visual or partial evidence; low = weak or missing evidence.
- Keep the answer concise and well-structured (short paragraphs or bullets).`;

export async function analyze(params: {
  workspaceId: string;
  question: string;
  selected: SelectedPage[];
  signal?: AbortSignal;
}): Promise<AnalysisResponse> {
  const { workspaceId, question, selected } = params;
  if (!selected.length) throw new AppError("No pages are selected.", 400, "no_pages");
  const db = await getAdmin();

  const docIds = [...new Set(selected.map((s) => s.documentId))];
  const { data: docs, error: dErr } = await db
    .from("documents")
    .select("id, filename")
    .eq("workspace_id", workspaceId)
    .in("id", docIds);
  if (dErr) throw new AppError("Database error while loading documents.", 500, "db");
  if (!docs?.length) throw new AppError("No document has been uploaded.", 400, "no_docs");
  const nameById = new Map(docs.map((d) => [d.id, d.filename]));

  const { data: pageRows, error: pErr } = await db
    .from("document_pages")
    .select("document_id, page_number, extracted_text, content_type, has_visuals, image_path, section")
    .in("document_id", [...nameById.keys()]);
  if (pErr) throw new AppError("Database error while loading pages.", 500, "db");

  const want = new Set(selected.map((s) => `${s.documentId}:${s.pageNumber}`));
  const pages: RetrievablePage[] = (pageRows ?? [])
    .filter((r) => want.has(`${r.document_id}:${r.page_number}`))
    .map((r) => ({
      documentId: r.document_id,
      documentName: nameById.get(r.document_id)!,
      pageNumber: r.page_number,
      text: r.extracted_text ?? "",
      contentType: r.content_type,
      hasVisuals: r.has_visuals,
      imagePath: r.image_path,
      section: r.section,
    }));
  if (!pages.length) throw new AppError("No pages are selected.", 400, "no_pages");

  const ranked = retrieve(question, pages, 6);
  const visualQ = isVisualQuestion(question);

  // choose which page images to send to the multimodal model
  const imageTargets = ranked
    .filter(
      ({ page }) =>
        page.imagePath &&
        (page.hasVisuals || ["table", "chart", "graph", "image", "scanned"].includes(page.contentType) || visualQ || page.text.length < 80),
    )
    .slice(0, MAX_IMAGES);
  if (!imageTargets.length && ranked[0]?.page.imagePath && ranked.length <= 2) imageTargets.push(ranked[0]);

  const images = new Map<string, string>();
  await Promise.all(
    imageTargets.map(async ({ page }) => {
      const { data, error } = await db.storage.from("documents").download(page.imagePath!);
      if (!error && data) images.set(`${page.documentId}:${page.pageNumber}`, bytesToDataUrl(await data.arrayBuffer()));
    }),
  );

  const content: ResponsesInputPart[] = [
    {
      type: "input_text",
      text: `QUESTION: ${question}\n\nDOCUMENTS IN SCOPE: ${[...new Set(pages.map((p) => p.documentName))].join(", ")}\n\nRETRIEVED PAGES (most relevant first):`,
    },
  ];
  for (const { page } of ranked) {
    const k = `${page.documentId}:${page.pageNumber}`;
    const txt = page.text.trim() ? page.text.slice(0, 6000) : "(no selectable text on this page)";
    content.push({
      type: "input_text",
      text: `\n=== Document: "${page.documentName}" | Page ${page.pageNumber} | Section: ${page.section ?? "unknown"} | Detected type: ${page.contentType}${images.has(k) ? " | page image attached below" : ""} ===\n${txt}`,
    });
    const img = images.get(k);
    if (img) {
      content.push({ type: "input_text", text: `[Image of "${page.documentName}" page ${page.pageNumber}]` });
      content.push({ type: "input_image", image_url: img, detail: "high" });
    }
  }

  const out = await callStructured<ModelOutput>({
    instructions: INSTRUCTIONS,
    content,
    schemaName: "docmind_answer",
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
    signal: params.signal,
  });

  // ---- verify & post-process ----
  const byKey = new Map(ranked.map(({ page }) => [`${page.documentName.toLowerCase()}:${page.pageNumber}`, page]));
  const citations: Citation[] = [];
  const dropped: string[] = [];
  for (const c of out.citations ?? []) {
    const p = byKey.get(`${c.documentName.toLowerCase()}:${c.pageNumber}`) ??
      ranked.map((r) => r.page).find((pg) => pg.pageNumber === c.pageNumber && pg.documentName.toLowerCase().includes(c.documentName.toLowerCase().replace(/\.pdf$/, "")));
    if (!p) {
      dropped.push(`${c.documentName} p.${c.pageNumber}`);
      continue;
    }
    const visualSource = images.has(`${p.documentId}:${p.pageNumber}`);
    const verified = evidenceAppears(c.evidence, p.text) || visualSource;
    citations.push({
      documentId: p.documentId,
      documentName: p.documentName,
      pageNumber: p.pageNumber,
      section: c.section || p.section || "",
      evidence: c.evidence,
      contentType: (CONTENT_TYPES as readonly string[]).includes(c.contentType) ? c.contentType : (p.contentType as ContentType),
      verified,
      visualSource: visualSource && !evidenceAppears(c.evidence, p.text),
    });
  }
  // de-duplicate
  const seen = new Set<string>();
  const uniqueCitations = citations.filter((c) => {
    const k = `${c.documentId}:${c.pageNumber}:${c.evidence.slice(0, 40)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const limitations = [...(out.limitations ?? [])];
  if (dropped.length) limitations.push(`Removed citations to pages that were not part of the evidence: ${dropped.join(", ")}.`);
  let confidence: Confidence = out.confidence;
  let answer = out.answer?.trim() || INSUFFICIENT;
  const insufficient = answer.startsWith("I can't determine this reliably");
  if (insufficient) {
    confidence = "low";
    if (!limitations.some((l) => /insufficient/i.test(l))) limitations.push("Insufficient evidence was found in the selected documents.");
  } else if (!uniqueCitations.length) {
    confidence = "low";
    limitations.push("The answer could not be linked to verifiable page evidence.");
  } else if (uniqueCitations.some((c) => !c.verified) && confidence === "high") {
    confidence = "medium";
    limitations.push("Some quoted evidence could not be matched exactly to the page text.");
  }
  if (out.conflict && !/conflict/i.test(answer)) answer += "\n\nNote: the documents contain conflicting information.";

  const calculations = (out.calculations ?? []).map(runCalculation);

  return {
    answer,
    confidence,
    citations: insufficient ? [] : uniqueCitations,
    calculations: insufficient ? [] : calculations,
    limitations,
    pagesConsidered: ranked.map(({ page }) => ({
      documentName: page.documentName,
      pageNumber: page.pageNumber,
      imageSent: images.has(`${page.documentId}:${page.pageNumber}`),
    })),
  };
}
