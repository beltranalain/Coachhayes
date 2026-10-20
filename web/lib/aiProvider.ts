import "server-only";
import { generateWithGroq } from "./groq";

// Provider-agnostic AI layer for the evaluations feature. All three text
// providers (OpenAI, DeepSeek, Groq) speak the OpenAI chat/completions dialect,
// so we route by whichever key is present. Transcription (Whisper) is offered by
// OpenAI and Groq — NOT DeepSeek — so voice falls back to Groq.
//
// Preference order lets you "upgrade" later just by adding a key:
//   text:  OPENAI  ->  DEEPSEEK  ->  GROQ
//   voice: OPENAI  ->  GROQ
// Force one with AI_EVAL_PROVIDER = openai | deepseek | groq.
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

type TextProvider = "openai" | "deepseek" | "groq";

export function evalProvider(): TextProvider | null {
  const forced = process.env.AI_EVAL_PROVIDER as TextProvider | undefined;
  if (forced === "openai" && OPENAI_KEY) return "openai";
  if (forced === "deepseek" && DEEPSEEK_KEY) return "deepseek";
  if (forced === "groq" && GROQ_KEY) return "groq";
  if (OPENAI_KEY) return "openai";
  if (DEEPSEEK_KEY) return "deepseek";
  if (GROQ_KEY) return "groq";
  return null;
}
export const evalConfigured = (): boolean => evalProvider() != null;
export const evalProviderLabel = (): string => ({ openai: "ChatGPT", deepseek: "DeepSeek", groq: "Groq" } as const)[evalProvider() || "groq"];

export interface TextOptions { systemPrompt?: string; jsonMode?: boolean; temperature?: number; maxTokens?: number; }

export async function generateEvalText(prompt: string, opts: TextOptions = {}): Promise<string> {
  const p = evalProvider();
  if (!p) throw new Error("No AI text provider is connected. Add GROQ_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY.");
  if (p === "groq") return generateWithGroq(prompt, opts);

  const cfg = p === "openai"
    ? { base: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY!, model: process.env.OPENAI_MODEL || "gpt-4o" }
    : { base: "https://api.deepseek.com/chat/completions", key: DEEPSEEK_KEY!, model: process.env.DEEPSEEK_MODEL || "deepseek-chat" };

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(cfg.base, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 2600,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${p} ${res.status}: ${t.slice(0, 220)}`); }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("The AI writer timed out. Please try again.");
    throw e;
  } finally { clearTimeout(timer); }
}

// ---- Voice transcription (Whisper) ----
type VoiceProvider = "openai" | "groq";
export function transcribeProvider(): VoiceProvider | null {
  if (OPENAI_KEY) return "openai";
  if (GROQ_KEY) return "groq";
  return null;
}
export const transcribeConfigured = (): boolean => transcribeProvider() != null;

export async function transcribeClip(blob: Blob, filename = "audio.webm"): Promise<string> {
  const p = transcribeProvider();
  if (!p) throw new Error("No transcription provider is connected. Add GROQ_API_KEY or OPENAI_API_KEY.");
  const cfg = p === "openai"
    ? { base: "https://api.openai.com/v1/audio/transcriptions", key: OPENAI_KEY!, model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1" }
    : { base: "https://api.groq.com/openai/v1/audio/transcriptions", key: GROQ_KEY!, model: process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo" };

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", cfg.model);
  form.append("language", "en");
  form.append("temperature", "0");
  // verbose_json returns per-segment no_speech_prob so we can drop silent
  // segments (that's what makes Whisper hallucinate "Thank you." on silence).
  form.append("response_format", "verbose_json");
  form.append("prompt", "Coach Hayes breaking down a high school football recruit's game film: position, technique, athleticism, strengths and areas to improve.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(cfg.base, { method: "POST", headers: { Authorization: `Bearer ${cfg.key}` }, body: form, signal: controller.signal });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Transcription ${res.status}: ${t.slice(0, 220)}`); }
    const data = await res.json();
    if (Array.isArray(data?.segments) && data.segments.length) {
      const voiced = data.segments
        .filter((s: any) => (s?.no_speech_prob ?? 0) < 0.7)
        .map((s: any) => String(s?.text || "").trim())
        .filter(Boolean);
      return voiced.join(" ").trim();
    }
    return String(data?.text || "").trim();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Transcription timed out. Please try a shorter clip.");
    throw e;
  } finally { clearTimeout(timer); }
}
