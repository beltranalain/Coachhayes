import "server-only";

// Groq — free, very fast inference for open models (default openai/gpt-oss-120b).
// Groq is OpenAI-compatible, so we POST to their chat/completions endpoint with a
// plain fetch (no SDK dependency). Free tier is generous and writes a full blog
// post in a few seconds. Override the model with the GROQ_MODEL env var.
const KEY = process.env.GROQ_API_KEY;
export const groqConfigured = Boolean(KEY);
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  // Force valid JSON output (response_format: json_object). The API
  // grammar-constrains decoding so the model MUST escape quotes inside strings —
  // critical when a field holds HTML (e.g. <a href="...">). The prompt must
  // contain the word "JSON" for the API to accept this.
  jsonMode?: boolean;
}

export async function generateWithGroq(prompt: string, options: GroqOptions = {}): Promise<string> {
  if (!KEY) throw new Error("The AI writer isn't connected yet. Add your Groq key to turn it on.");

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt });
  messages.push({ role: "user", content: prompt });

  // 45s guard: Groq is normally sub-5s, so anything longer is a stall.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Groq ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The AI writer timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
