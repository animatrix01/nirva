// §c.5 Citation contract: every operational claim references exactly
// [Document title, revision, page/section, chunk_id]
export interface ParsedCitation {
  title: string;
  revision: string;
  locator: string;
  chunkId: string;
  raw: string;
}

export function parseCitation(citation: string): ParsedCitation | null {
  const inner = citation.trim().replace(/^\[/, "").replace(/\]$/, "");
  const parts = inner.split(",").map((p) => p.trim());
  if (parts.length !== 4) return null;
  const [title, revision, locator, chunkId] = parts;
  if (!title || !revision || !locator || !chunkId) return null;
  return { title, revision, locator, chunkId, raw: citation };
}

export function citationSortKey(citation: string): string {
  return citation.toLowerCase();
}
