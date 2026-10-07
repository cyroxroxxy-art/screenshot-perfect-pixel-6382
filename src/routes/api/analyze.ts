import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { analyze } from "@/lib/server/analyze.server";
import { AppError, errorResponse, getAdmin, json, requireWorkspace } from "@/lib/server/http.server";

const Body = z.object({
  question: z.string().trim().min(3, "Please enter a question.").max(1000),
  selected: z
    .array(z.object({ documentId: z.string().uuid(), pageNumber: z.number().int().min(1) }))
    .max(500),
});

export const Route = createFileRoute("/api/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let requestId: string | null = null;
        try {
          const workspaceId = requireWorkspace(request);
          const parsed = Body.safeParse(await request.json().catch(() => null));
          if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 400, "validation");
          const { question, selected } = parsed.data;
          if (!selected.length) throw new AppError("No pages are selected.", 400, "no_pages");

          const db = await getAdmin();
          const { data: row } = await db
            .from("analysis_requests")
            .insert({ workspace_id: workspaceId, question, document_ids: [...new Set(selected.map((s) => s.documentId))] })
            .select("id")
            .single();
          requestId = row?.id ?? null;

          const result = await analyze({ workspaceId, question, selected, signal: request.signal });
          if (requestId)
            await db
              .from("analysis_requests")
              .update({ status: "completed", response: result as never, pages_used: result.pagesConsidered as never })
              .eq("id", requestId);
          return json(result);
        } catch (err) {
          if (requestId) {
            const db = await getAdmin();
            await db
              .from("analysis_requests")
              .update({ status: "failed", error: err instanceof Error ? err.message : "error" })
              .eq("id", requestId);
          }
          return errorResponse(err);
        }
      },
    },
  },
});
