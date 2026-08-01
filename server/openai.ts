/**
 * OpenAI integration: structured story generation (GPT-4o) and per-page
 * illustration generation (gpt-image-1, dall-e-3 fallback). Raw REST via
 * fetch — no SDK dependency needed for these three calls.
 */

const OPENAI_URL = "https://api.openai.com/v1";

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function openaiRequest(path: string, body: object): Promise<Record<string, any>> {
  const res = await fetch(`${OPENAI_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${path} failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  }
  return res.json() as Promise<Record<string, any>>;
}

/** Structured JSON output via response_format json_schema (strict). */
export async function openaiStructured<T>(
  system: string,
  user: string,
  schema: object,
  name: string,
): Promise<T> {
  const data = await openaiRequest("/chat/completions", {
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    max_tokens: 8000,
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return JSON.parse(content) as T;
}

/** Short conversational reply (chat + voice-fallback text mode). */
export async function openaiChatReply(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const data = await openaiRequest("/chat/completions", {
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: system }, ...messages],
    max_tokens: 300,
  });
  return data.choices?.[0]?.message?.content ?? "";
}

/** One storybook illustration as PNG bytes; null on failure (caller falls back to SVG). */
export async function openaiImage(prompt: string): Promise<Buffer | null> {
  const models: { model: string; extra: Record<string, unknown> }[] = [
    { model: "gpt-image-1", extra: { quality: "low", size: "1024x1024" } },
    { model: "dall-e-3", extra: { size: "1024x1024", response_format: "b64_json" } },
  ];
  for (const { model, extra } of models) {
    try {
      const data = await openaiRequest("/images/generations", { model, prompt, n: 1, ...extra });
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, "base64");
      const url = data.data?.[0]?.url;
      if (url) {
        const img = await fetch(url);
        if (img.ok) return Buffer.from(await img.arrayBuffer());
      }
    } catch (err) {
      console.warn(`[openai] image via ${model} failed:`, String(err).slice(0, 200));
    }
  }
  return null;
}
