// Deterministic hash-based embedding (1536 dims) for the knowledge base.
// Production would use a real embedding model (e.g. OpenAI text-embedding-3-small);
// this provides a dependency-free, deterministic vector for the pgvector pipeline.
export const EMBED_DIMS = 1536;

export function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIMS).fill(0);
  const tokens = text.toLowerCase().match(/[a-zà-ÿ0-9]+/g) ?? [];
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    vec[h % EMBED_DIMS] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function embedToVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => v.toFixed(6)).join(",")}]`;
}