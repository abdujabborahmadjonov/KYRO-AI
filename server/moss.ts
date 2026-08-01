/**
 * Retrieval over the pediatric patient-education corpus.
 *
 * With MOSS_API_KEY set, queries go to Moss (sub-10ms semantic search).
 * Without it, we fall back to a local BM25 index over ./corpus so grounding
 * always works. `npm run index-corpus` builds data/moss-index.json.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

export interface RetrievedChunk {
  source: string;
  text: string;
  score: number;
}

interface IndexedChunk {
  source: string;
  text: string;
  tokens: string[];
}

const CORPUS_DIR = path.join(process.cwd(), "corpus");
const INDEX_PATH = path.join(process.cwd(), "data", "moss-index.json");

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function chunkCorpus(): IndexedChunk[] {
  if (!existsSync(CORPUS_DIR)) return [];
  const chunks: IndexedChunk[] = [];
  for (const file of readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".md"))) {
    const content = readFileSync(path.join(CORPUS_DIR, file), "utf8");
    // Chunk on blank-line paragraph boundaries, keep headings attached
    const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 40);
    for (const p of paragraphs) {
      chunks.push({ source: file, text: p, tokens: tokenize(p) });
    }
  }
  return chunks;
}

let cachedIndex: IndexedChunk[] | null = null;

function loadIndex(): IndexedChunk[] {
  if (cachedIndex) return cachedIndex;
  if (existsSync(INDEX_PATH)) {
    cachedIndex = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  } else {
    cachedIndex = chunkCorpus();
  }
  return cachedIndex!;
}

/** BM25 ranking (k1=1.5, b=0.75) over the corpus chunks. */
function bm25(query: string, chunks: IndexedChunk[], k = 4): RetrievedChunk[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0 || chunks.length === 0) return [];

  const N = chunks.length;
  const avgLen = chunks.reduce((s, c) => s + c.tokens.length, 0) / N;
  const df = new Map<string, number>();
  for (const term of new Set(qTokens)) {
    df.set(term, chunks.filter((c) => c.tokens.includes(term)).length);
  }

  const k1 = 1.5;
  const b = 0.75;
  const scored = chunks.map((chunk) => {
    let score = 0;
    for (const term of new Set(qTokens)) {
      const n = df.get(term) ?? 0;
      if (n === 0) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const tf = chunk.tokens.filter((t) => t === term).length;
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * chunk.tokens.length) / avgLen));
    }
    return { source: chunk.source, text: chunk.text, score };
  });

  return scored.filter((c) => c.score > 0).sort((a, b2) => b2.score - a.score).slice(0, k);
}

export async function retrieve(query: string, k = 4): Promise<RetrievedChunk[]> {
  const mossKey = process.env.MOSS_API_KEY;
  if (mossKey) {
    try {
      // Moss hosted retrieval — corpus indexed by `npm run index-corpus`.
      const res = await fetch("https://api.moss.dev/v1/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${mossKey}` },
        body: JSON.stringify({ index: "bravetales-ped-ed", query, top_k: k }),
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: { source?: string; text: string; score: number }[] };
        if (data.results?.length) {
          return data.results.map((r) => ({ source: r.source ?? "moss", text: r.text, score: r.score }));
        }
      }
    } catch {
      // fall through to local index
    }
  }
  return bm25(query, loadIndex(), k);
}
