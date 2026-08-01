/**
 * Index the pediatric patient-education corpus.
 * - Always builds the local BM25 index (data/moss-index.json) used as fallback.
 * - With MOSS_API_KEY set, also pushes chunks to a Moss index for sub-10ms
 *   semantic retrieval at conversation speed.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chunkCorpus } from "../server/moss.js";

async function main() {
  const chunks = chunkCorpus();
  if (chunks.length === 0) {
    console.error("No corpus found in ./corpus — nothing to index.");
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), "data", "moss-index.json");
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(chunks, null, 2));
  console.log(`✅ Local index: ${chunks.length} chunks from corpus → ${outPath}`);

  const key = process.env.MOSS_API_KEY;
  if (!key) {
    console.log("ℹ️  MOSS_API_KEY not set — retrieval will use the local BM25 index.");
    return;
  }

  const res = await fetch("https://api.moss.dev/v1/indexes/bravetales-ped-ed/documents", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      documents: chunks.map((c, i) => ({ id: `${c.source}-${i}`, text: c.text, metadata: { source: c.source } })),
    }),
  });
  if (res.ok) {
    console.log(`✅ Pushed ${chunks.length} chunks to Moss index "bravetales-ped-ed".`);
  } else {
    console.warn(`⚠️  Moss indexing failed (${res.status}) — local BM25 fallback will be used.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
