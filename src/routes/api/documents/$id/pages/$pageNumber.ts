import { createFileRoute } from "@tanstack/react-router";
import {
  AppError,
  assertDocumentOwned,
  errorResponse,
  getAdmin,
  json,
  parseUuid,
  requireWorkspace,
} from "@/lib/server/http.server";

export const Route = createFileRoute("/api/documents/$id/pages/$pageNumber")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const workspaceId = requireWorkspace(request);
          const id = parseUuid(params.id, "document id");
          const n = Number(params.pageNumber);
          if (!Number.isInteger(n) || n < 1) throw new AppError("Invalid page number.", 400, "bad_page");
          const doc = await assertDocumentOwned(id, workspaceId);
          const db = await getAdmin();
          const { data: page } = await db
            .from("document_pages")
            .select("*")
            .eq("document_id", id)
            .eq("page_number", n)
            .maybeSingle();
          if (!page) throw new AppError("Page not found.", 404, "not_found");
          let imageUrl: string | null = null;
          if (page.image_path) {
            const { data } = await db.storage.from("documents").createSignedUrl(page.image_path, 3600);
            imageUrl = data?.signedUrl ?? null;
          }
          return json({
            documentId: id,
            documentName: doc.filename,
            pageNumber: n,
            pageCount: doc.page_count,
            extractedText: page.extracted_text,
            section: page.section,
            contentType: page.content_type,
            imageUrl,
          });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
