export interface RetrievablePage {
  documentId: string;
  documentName: string;
  pageNumber: number;
  text: string;
  contentType: string;
  hasVisuals: boolean;
  imagePath: string | null;
  section: string | null;
}

const STOP = new Set(
  "a an and are as at be by for from has have how in is it its of on or that the this to was were what which who will with does do did page pages document documents show shows tell me about according".split(
    " ",
  ),
);

export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.%\u0900-\u097f ]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));

const VISUAL_RE = /\b(chart|graph|plot|figure|image|picture|photo|diagram|visual|bar|pie|line|trend|logo|map|scan|scanned|illustration)\b/i;

export function isVisualQuestion(q: string) {
  return VISUAL_RE.test(q);
}

function mentionedPages(q: string): number[] {
  return [...q.matchAll(/\bpages?\s+(\d{1,4})(?:\s*(?:-|to|and|&)\s*(\d{1,4}))?/gi)].flatMap((m) => {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const out: number[] = [];
    for (let i = Math.min(a, b); i <= Math.max(a, b) && out.length < 10; i++) out.push(i);
    return out;
  });
}

/** BM25 retrieval over page chunks, with boosts for explicit page references and visual questions. */
export function retrieve(question: string, pages: RetrievablePage[], k = 6) {
  const qTokens = [...new Set(tokenize(question))];
  const docs = pages.map((p) => {
    // chunk pages into ~120-token windows; page score = best chunk score
    const toks = tokenize(`${p.section ?? ""} ${p.text}`);
    const chunks: string[][] = [];
    for (let i = 0; i < Math.max(toks.length, 1); i += 90) chunks.push(toks.slice(i, i + 120));
    return { page: p, chunks };
  });
  const allChunks = docs.flatMap((d) => d.chunks);
  const N = Math.max(allChunks.length, 1);
  const avgLen = allChunks.reduce((s, c) => s + c.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const c of allChunks) for (const t of new Set(c)) df.set(t, (df.get(t) ?? 0) + 1);

  const mentions = mentionedPages(question);
  const visual = isVisualQuestion(question);

  const scored = docs.map(({ page, chunks }) => {
    let best = 0;
    for (const c of chunks) {
      const tf = new Map<string, number>();
      for (const t of c) tf.set(t, (tf.get(t) ?? 0) + 1);
      let s = 0;
      for (const q of qTokens) {
        const f = tf.get(q) ?? 0;
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
        s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (c.length / avgLen))));
      }
      best = Math.max(best, s);
    }
    if (mentions.includes(page.pageNumber)) best += 50;
    if (visual && page.hasVisuals) best += 3;
    if (page.contentType === "scanned") best += 0.5;
    return { page, score: best };
  });

  scored.sort((a, b) => b.score - a.score);
  const positive = scored.filter((s) => s.score > 0);
  const pool = positive.length ? positive : scored; // generic questions (e.g. "main findings")

  // keep each document represented for cross-document questions
  const docIds = [...new Set(pages.map((p) => p.documentId))];
  const picked = new Map<string, (typeof scored)[number]>();
  const key = (p: RetrievablePage) => `${p.documentId}:${p.pageNumber}`;
  if (docIds.length > 1) {
    for (const id of docIds) {
      const top = pool.find((s) => s.page.documentId === id);
      if (top) picked.set(key(top.page), top);
    }
  }
  for (const s of pool) {
    if (picked.size >= k) break;
    picked.set(key(s.page), s);
  }
  return [...picked.values()].sort((a, b) => b.score - a.score);
}

/** Loose check that quoted evidence actually appears in the page text. */
export function evidenceAppears(evidence: string, pageText: string) {
  const ev = tokenize(evidence);
  if (!ev.length) return false;
  const pt = new Set(tokenize(pageText));
  const hits = ev.filter((t) => pt.has(t)).length;
  return hits / ev.length >= 0.6;
}
