import { readFileSync, writeFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";

const DIMS = 1536;
function embed(text) {
  const vec = new Array(DIMS).fill(0);
  const tokens = text.toLowerCase().match(/[a-zà-ÿ0-9]+/g) ?? [];
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    vec[h % DIMS] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}
const vecLiteral = (vec) => `[${vec.map((v) => v.toFixed(6)).join(",")}]`;
const esc = (s) => s.replace(/'/g, "''");

const knowledgeDir = fileURLToPath(new URL("../../../supabase/knowledge", import.meta.url));
const files = readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

const rows = [];
for (const file of files) {
  const title = file.replace(/\.md$/, "");
  const content = readFileSync(`${knowledgeDir}/${file}`, "utf8").trim();
  // one chunk per file (topic), strip the leading heading for the body
  const body = content.replace(/^#\s.*\n/, "").trim();
  const emb = vecLiteral(embed(body));
  rows.push(
    `insert into ai_knowledge (title, content, embedding, language) values ('${esc(title)}', '${esc(body)}', '${emb}'::vector(${DIMS}), 'fr');`,
  );
}

const sql = `-- Auto-generated knowledge embeddings (${rows.length} chunks)\n` + rows.join("\n");
writeFileSync(fileURLToPath(new URL("../../../supabase/knowledge-embeddings.sql", import.meta.url)), sql, "utf8");
console.log(`Generated ${rows.length} chunks from ${files.length} files`);