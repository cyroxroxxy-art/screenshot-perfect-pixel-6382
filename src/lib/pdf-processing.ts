import type { ContentType } from "./types";

export interface ProcessedPage {
  pageNumber: number;
  text: string;
  section: string | null;
  contentType: ContentType;
  hasVisuals: boolean;
  image: Blob | null;
}
export interface ProcessedPdf {
  pageCount: number;
  pages: ProcessedPage[];
}

export const MAX_PDF_BYTES = 40 * 1024 * 1024;
export const MAX_PAGES = 120;
export class PdfError extends Error {}

type Step = "reading" | "extracting" | "detecting" | "preparing";

/** Browser-side PDF processing: page-by-page text extraction, visual detection and page rendering. */
export async function processPdf(
  file: Blob,
  onProgress: (step: Step, done: number, total: number) => void,
): Promise<ProcessedPdf> {
  if (file.size > MAX_PDF_BYTES) throw new PdfError("Document is too large (max 40 MB).");
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") throw new PdfError("File is not a valid PDF.");

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  onProgress("reading", 0, 1);
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    throw new PdfError("PDF could not be processed. It may be corrupted or password-protected.");
  }
  const total = doc.numPages;
  if (total > MAX_PAGES) throw new PdfError(`Document is too large (${total} pages, max ${MAX_PAGES}).`);

  const OPS = pdfjs.OPS;
  const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
  const pages: ProcessedPage[] = [];

  for (let i = 1; i <= total; i++) {
    onProgress("extracting", i - 1, total);
    const page = await doc.getPage(i);

    // text, grouped into lines by y position
    const tc = await page.getTextContent();
    const lines: { y: number; parts: { x: number; s: string }[] }[] = [];
    for (const item of tc.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      let line = lines.find((l) => Math.abs(l.y - y) <= 3);
      if (!line) lines.push((line = { y, parts: [] }));
      line.parts.push({ x, s: item.str });
    }
    lines.sort((a, b) => b.y - a.y);
    const textLines = lines.map((l) =>
      l.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    const text = textLines.join("\n");

    onProgress("detecting", i - 1, total);
    const ops = await page.getOperatorList();
    let images = 0;
    let paths = 0;
    for (const fn of ops.fnArray) {
      if (imageOps.has(fn)) images++;
      else if (fn === OPS.constructPath) paths++;
    }

    const numericLines = textLines.filter((l) => (l.match(/-?\d[\d,.]*%?/g) ?? []).length >= 3).length;
    const compact = text.replace(/\s/g, "");
    let contentType: ContentType = "text";
    if (compact.length < 40) contentType = "scanned";
    else if ((images > 0 || paths > 40) && /\b(chart|figure|fig\.|graph|plot|trends?)\b/i.test(text))
      contentType = /\b(graph|line|trend)\b/i.test(text) && !/\b(bar|pie)\b/i.test(text) ? "graph" : "chart";
    else if (numericLines >= 3 || /\btable\s*\d*\b/i.test(text)) contentType = "table";
    else if (images > 0) contentType = "image";
    const hasVisuals = images > 0 || paths > 40 || contentType !== "text";

    const section =
      textLines.find((l) => /^(section|chapter|part)\b|^\d+(\.\d+)*\s+[A-Z]/i.test(l) && l.length <= 90) ??
      textLines.find((l) => l.length > 3 && l.length <= 80) ??
      null;

    onProgress("preparing", i - 1, total);
    const viewport0 = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1400 / viewport0.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    let image: Blob | null = null;
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      image = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    }
    page.cleanup();
    pages.push({ pageNumber: i, text, section, contentType, hasVisuals, image });
  }
  onProgress("preparing", total, total);
  await doc.destroy();
  return { pageCount: total, pages };
}
