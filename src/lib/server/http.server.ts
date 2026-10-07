import { z } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code = "error",
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) return json({ error: err.message, code: err.code }, err.status);
  console.error("[docmind] unexpected error", err);
  return json({ error: "Something went wrong on the server. Please retry.", code: "server_error" }, 500);
}

const uuid = z.string().uuid();

export function requireWorkspace(request: Request): string {
  const ws = request.headers.get("x-workspace-id");
  const parsed = uuid.safeParse(ws);
  if (!parsed.success) throw new AppError("Missing or invalid workspace id.", 400, "workspace");
  return parsed.data;
}

export function parseUuid(value: string, what = "id"): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new AppError(`Invalid ${what}.`, 400, "bad_id");
  return parsed.data;
}

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function assertDocumentOwned(documentId: string, workspaceId: string) {
  const db = await getAdmin();
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new AppError("Database error while loading the document.", 500, "db");
  if (!data) throw new AppError("Document not found.", 404, "not_found");
  return data;
}
