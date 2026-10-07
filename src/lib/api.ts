import type { AnalysisResponse, DocumentWithPages, PageDetail, SelectedPage } from "./types";
import type { ProcessedPdf } from "./pdf-processing";
import { getWorkspaceId } from "./workspace";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-workspace-id", getWorkspaceId());
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError("Analysis was cancelled.", 499, "aborted");
    throw new ApiError("Network error: could not reach the server.", 0, "network");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 504 || res.status === 524) throw new ApiError("Analysis timed out. Please retry.", res.status, "timeout");
    throw new ApiError(body?.error ?? `Request failed (${res.status}).`, res.status, body?.code);
  }
  return body as T;
}

export const api = {
  listDocuments: () => call<DocumentWithPages[]>("/api/documents/"),
  getPage: (id: string, n: number) => call<PageDetail>(`/api/documents/${id}/pages/${n}`),
  deleteDocument: (id: string) => call<{ ok: true }>(`/api/documents/${id}/`, { method: "DELETE" }),
  runOcr: (id: string) => call<{ processed: { page: number; status: string }[] }>(`/api/documents/${id}/ocr`, { method: "POST" }),
  analyze: (question: string, selected: SelectedPage[], signal?: AbortSignal) =>
    call<AnalysisResponse>("/api/analyze", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, selected }),
    }),
  upload: (file: Blob, filename: string, processed: ProcessedPdf, isDemo: boolean) => {
    const fd = new FormData();
    fd.append("file", file, filename);
    fd.append("filename", filename);
    fd.append("isDemo", String(isDemo));
    fd.append(
      "pages",
      JSON.stringify(
        processed.pages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
          section: p.section,
          contentType: p.contentType,
          hasVisuals: p.hasVisuals,
        })),
      ),
    );
    for (const p of processed.pages) if (p.image) fd.append(`page_${p.pageNumber}`, p.image, `${p.pageNumber}.jpg`);
    return call<{ id: string; pageCount: number; scannedPages: number }>("/api/upload", { method: "POST", body: fd });
  },
};
