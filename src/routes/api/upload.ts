import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppError, errorResponse, getAdmin, json, requireWorkspace } from "@/lib/server/http.server";

const MAX_BYTES = 40 * 1024 * 1024;
const PageMeta = z.object({
  pageNumber: z.number().int().min(1),
  text: z.string().max(200_000),
  section: z.string().max(300).nullable(),
  contentType: z.enum(["text", "table", "chart", "graph", "image", "scanned"]),
  hasVisuals: z.boolean(),
});

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let docId: string | null = null;
        try {
          const workspaceId = requireWorkspace(request);
          const form = await request.formData().catch(() => {
            throw new AppError("Upload could not be read. Document may be too large.", 400, "bad_form");
          });
          const file = form.get("file");
          if (!(file instanceof File)) throw new AppError("No PDF file was provided.", 400, "no_file");
          if (file.size > MAX_BYTES) throw new AppError("Document is too large (max 40 MB).", 413, "too_large");
          const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
          if (String.fromCharCode(...head) !== "%PDF-") throw new AppError("File is not a valid PDF.", 400, "not_pdf");

          const pagesParsed = z.array(PageMeta).min(1).max(200).safeParse(JSON.parse(String(form.get("pages") ?? "[]")));
          if (!pagesParsed.success) throw new AppError("PDF could not be processed: page data is invalid.", 400, "bad_pages");
          const pages = pagesParsed.data;
          const filename = String(form.get("filename") || file.name || "document.pdf").slice(0, 200);
          const isDemo = form.get("isDemo") === "true";

          const db = await getAdmin();
          const { data: doc, error } = await db
            .from("documents")
            .insert({ workspace_id: workspaceId, filename, page_count: pages.length, is_demo: isDemo, upload_status: "processing" })
            .select("*")
            .single();
          if (error || !doc) throw new AppError("Could not save the document.", 500, "db");
          docId = doc.id;

          const base = `${workspaceId}/${doc.id}`;
          const { error: upErr } = await db.storage
            .from("documents")
            .upload(`${base}/original.pdf`, file, { contentType: "application/pdf", upsert: true });
          if (upErr) throw new AppError("PDF could not be stored.", 500, "storage");

          const rows = await Promise.all(
            pages.map(async (p) => {
              const img = form.get(`page_${p.pageNumber}`);
              let image_path: string | null = null;
              if (img instanceof File && img.size > 0) {
                const path = `${base}/pages/${p.pageNumber}.jpg`;
                const { error: e } = await db.storage.from("documents").upload(path, img, { contentType: "image/jpeg", upsert: true });
                if (!e) image_path = path;
              }
              return {
                document_id: doc.id,
                page_number: p.pageNumber,
                extracted_text: p.text,
                section: p.section,
                content_type: p.contentType,
                has_visuals: p.hasVisuals,
                image_path,
                processing_status: p.contentType === "scanned" ? (image_path ? "needs_ocr" : "ocr_unavailable") : "processed",
              };
            }),
          );
          const { error: pErr } = await db.from("document_pages").insert(rows);
          if (pErr) throw new AppError("Could not save page data.", 500, "db");

          await db
            .from("documents")
            .update({ upload_status: "processed", storage_path: `${base}/original.pdf` })
            .eq("id", doc.id);

          return json({
            id: doc.id,
            pageCount: pages.length,
            scannedPages: rows.filter((r) => r.processing_status === "needs_ocr").length,
          });
        } catch (e) {
          if (docId) {
            const db = await getAdmin();
            await db.from("documents").update({ upload_status: "failed" }).eq("id", docId);
          }
          return errorResponse(e);
        }
      },
    },
  },
});
