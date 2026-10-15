import "server-only";

// OpenAI (ChatGPT) — used for the long-form recruit evaluations and for voice
// transcription (Whisper) when Coach speaks his read of the film. Plain fetch,
// no SDK dependency, mirroring lib/groq.ts. Requires OPENAI_API_KEY.
const KEY = process.env.OPENAI_API_KEY;
export const openaiConfigured = Boolean(KEY);
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
export const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface OpenAIChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  // Force a valid JSON object back (response_format json_object). The prompt
  // must mention "JSON" for the API to accept this.
  jsonMode?: boolean;
}

export async function generateWithOpenAI(prompt: string, options: OpenAIChatOptions = {}): Promise<string> {
  if (!KEY) throw new Error("ChatGPT isn't connected yet. Add your OpenAI key (OPENAI_API_KEY) to turn it on.");

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) messages.push({ role: "system", content: options.systemPrompt });
  messages.push({ role: "user", content: prompt });

  // 90s guard — a long-form evaluation is bigger than a blog post.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 2600,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 220)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("ChatGPT timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Transcribe a recorded audio clip (Coach talking through the film) to text via
// Whisper. Takes the audio blob + a filename hint (the extension matters to the API).
export async function transcribeAudio(blob: Blob, filename = "audio.webm"): Promise<string> {
  if (!KEY) throw new Error("ChatGPT isn't connected yet. Add your OpenAI key (OPENAI_API_KEY) to turn it on.");

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  form.append("language", "en");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` }, // let fetch set the multipart boundary
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI transcription ${res.status}: ${t.slice(0, 220)}`);
    }
    const data = await res.json();
    return String(data?.text || "").trim();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Transcription timed out. Please try a shorter clip.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
