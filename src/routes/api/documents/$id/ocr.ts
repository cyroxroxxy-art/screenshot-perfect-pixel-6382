import { createFileRoute } from "@tanstack/react-router";
import { bytesToDataUrl, callStructured } from "@/lib/server/ai.server";
import { assertDocumentOwned, errorResponse, getAdmin, json, parseUuid, requireWorkspace } from "@/lib/server/http.server";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "text", "contentType", "section"],
  properties: {
    readable: { type: "boolean" },
    text: { type: "string" },
    contentType: { type: "string", enum: ["text", "table", "chart", "graph", "image", "scanned"] },
    section: { type: "string" },
  },
};

const MAX_OCR_PAGES = 12;

/** OCR for scanned pages using the multimodal model on the rendered page image. */
export const Route = createFileRoute("/api/documents/$id/ocr")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const workspaceId = requireWorkspace(request);
          const id = parseUuid(params.id, "document id");
          await assertDocumentOwned(id, workspaceId);
          const db = await getAdmin();
          const { data: pages } = await db
            .from("document_pages")
            .select("id, page_number, image_path")
            .eq("document_id", id)
            .eq("content_type", "scanned")
            .eq("processing_status", "needs_ocr")
            .order("page_number")
            .limit(MAX_OCR_PAGES);

          const results: { page: number; status: string }[] = [];
          for (const p of pages ?? []) {
            try {
              if (!p.image_path) throw new Error("no image");
              const { data: blob, error } = await db.storage.from("documents").download(p.image_path);
              if (error || !blob) throw new Error("download failed");
              const out = await callStructured<{ readable: boolean; text: string; contentType: string; section: string }>({
                instructions:
                  "You are an OCR engine. Transcribe ALL legible text on this scanned page exactly, preserving table rows as lines with cells separated by ' | '. Do not summarize or invent. If the page is not legible set readable=false and text=''. Classify the dominant content type and give the page's section heading if visible (else '').",
                content: [
                  { type: "input_text", text: `Transcribe page ${p.page_number}.` },
                  { type: "input_image", image_url: bytesToDataUrl(await blob.arrayBuffer()), detail: "high" },
                ],
                schemaName: "ocr_page",
                schema: SCHEMA,
                effort: "low",
                signal: request.signal,
              });
              await db
                .from("document_pages")
                .update({
                  extracted_text: out.readable ? out.text : "",
                  processing_status: out.readable ? "ocr_complete" : "ocr_unreadable",
                  section: out.section || null,
                  has_visuals: true,
                })
                .eq("id", p.id);
              results.push({ page: p.page_number, status: out.readable ? "ocr_complete" : "ocr_unreadable" });
            } catch (e) {
              await db.from("document_pages").update({ processing_status: "ocr_failed" }).eq("id", p.id);
              results.push({ page: p.page_number, status: "ocr_failed" });
              // stop on account-level AI failures (credits, rate limit) rather than hammering
              if (e && typeof e === "object" && "status" in e && [402, 403, 429].includes((e as { status: number }).status)) break;
            }
          }
          return json({ processed: results });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
