import { createFileRoute } from "@tanstack/react-router";
import { assertDocumentOwned, errorResponse, getAdmin, json, parseUuid, requireWorkspace } from "@/lib/server/http.server";

export const Route = createFileRoute("/api/documents/$id/")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const workspaceId = requireWorkspace(request);
          const id = parseUuid(params.id, "document id");
          const doc = await assertDocumentOwned(id, workspaceId);
          const db = await getAdmin();
          const { data: pages } = await db.from("document_pages").select("image_path").eq("document_id", id);
          const paths = [doc.storage_path, ...(pages ?? []).map((p) => p.image_path)].filter(Boolean) as string[];
          if (paths.length) await db.storage.from("documents").remove(paths);
          await db.from("documents").delete().eq("id", id);
          return json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
