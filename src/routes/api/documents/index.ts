import { createFileRoute } from "@tanstack/react-router";
import { AppError, errorResponse, getAdmin, json, requireWorkspace } from "@/lib/server/http.server";

export const Route = createFileRoute("/api/documents/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const workspaceId = requireWorkspace(request);
          const db = await getAdmin();
          const { data: docs, error } = await db
            .from("documents")
            .select("id, filename, upload_status, page_count, is_demo, created_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: true });
          if (error) throw new AppError("Could not load documents.", 500, "db");
          const ids = (docs ?? []).map((d) => d.id);
          const { data: pages, error: pErr } = ids.length
            ? await db
                .from("document_pages")
                .select("document_id, page_number, content_type, has_visuals, section, processing_status, extracted_text")
                .in("document_id", ids)
                .order("page_number")
            : { data: [], error: null };
          if (pErr) throw new AppError("Could not load document pages.", 500, "db");
          return json(
            (docs ?? []).map((d) => ({
              ...d,
              pages: (pages ?? [])
                .filter((p) => p.document_id === d.id)
                .map((p) => ({
                  page_number: p.page_number,
                  content_type: p.content_type,
                  has_visuals: p.has_visuals,
                  section: p.section,
                  processing_status: p.processing_status,
                  text_length: (p.extracted_text ?? "").length,
                })),
            })),
          );
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
