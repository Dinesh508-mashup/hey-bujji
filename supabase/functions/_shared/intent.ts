// Intent extraction. The SAME prompt is used for the Whisper baseline and for
// Hey Bujji (fair comparison rule); only the transcript fed in differs.

import type { Correction } from "./correct.ts";
import { COMMON_MEDICINES, type Family } from "./lexicon.ts";

export const INTENTS = ["took_medicine", "set_reminder", "call_family", "red_flag", "scam_report", "order_food", "book_cab", "video_call", "other"] as const;
export type IntentName = typeof INTENTS[number];

export type Intent = {
  intent: IntentName;
  medicine: string | null;
  time: string | null;
  contact: string | null;
  urgency: "normal" | "high" | "urgent";
  symptom: "chest_pain" | "breathlessness" | "dizziness" | "other" | null;
  money_sent: boolean;
  language: "te" | "hi" | "en";
  items?: string[];           // order_food: what to order
  destination?: string | null; // book_cab: where to go
};

export function buildPrompt(family: Family, transcript: string): string {
  const meds = family.medicines.map((m) => `${m.name}${m.purpose ? ` (for ${m.purpose === "bp" ? "BP" : m.purpose})` : ""}`).join(", ");
  const contacts = family.contacts.map((c) => `${c.name} (${c.relation}; also called ${c.nicknames.slice(0, 5).join(", ")})`).join("; ");
  return `You are Hey Bujji, a voice assistant for an elderly parent in India who speaks Telugu, Hindi or Telugu-English.
Read the transcript of ONE spoken request and return ONE JSON object describing it.

Family
- Parent: ${family.parentName}
- Parent's medicines: ${meds}
- Contacts: ${contacts}

Intents
- took_medicine: the parent says they already took a medicine ("teesukunna", "vesukunna", "le li", "ayipoyayi").
- set_reminder: the parent asks to be reminded about a medicine or task at a time ("gurthu cheyyi", "yaad dilana", "remind").
- call_family: the parent asks to call or phone someone ("call cheyyi", "phone kalupu", "phone lagao").
- red_flag: the parent reports chest pain, breathlessness, dizziness, fainting or a fall.
- scam_report: the parent reports a suspicious call or message: someone asking for an OTP, PIN, money, KYC update, a link, or threatening with police.
- video_call: the parent asks for a video call with someone ("video call cheyyi", "video call lagao", "I want to see my son").
- order_food: the parent asks to order food or groceries ("order cheyyi", "tecchi pettu", "mangao", "order banana and bread").
- book_cab: the parent asks for a cab, taxi or auto to go somewhere ("cab book cheyyi", "auto bulao", "book a cab to the hospital").
- other: anything else.

Fields
- intent: one of the intents above.
- medicine: the medicine's name exactly as in the parent's list or a standard generic name; "BP tablet" means the parent's BP medicine and "sugar tablet" the sugar medicine; "all" if they took all their tablets; otherwise null.
- time: "HH:MM" in 24-hour time if a clock time is stated (raatri/raat = night, saayantram/shaam = evening, udayam/subah = morning, madhyaahnam/dopahar = afternoon); otherwise null.
- contact: the contact's name from the list above (for call_family and video_call), otherwise null.
- urgency: "urgent" for red_flag, "high" for scam_report, otherwise "normal".
- symptom: chest_pain, breathlessness, dizziness, other, or null.
- money_sent: true only if the parent says money was already sent or paid.
- language: "te", "hi" or "en", the main language spoken.
- items: for order_food, the list of things to order in English (e.g. ["banana", "bread"]); otherwise [].
- destination: for book_cab, where to go in English (e.g. "Hospital", "Temple"); otherwise null.

Transcript:
"""
${transcript}
"""
Return only the JSON object.`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: [...INTENTS] },
    medicine: { type: "STRING", nullable: true },
    time: { type: "STRING", nullable: true },
    contact: { type: "STRING", nullable: true },
    urgency: { type: "STRING", enum: ["normal", "high", "urgent"] },
    symptom: { type: "STRING", nullable: true },
    money_sent: { type: "BOOLEAN" },
    language: { type: "STRING", enum: ["te", "hi", "en"] },
    items: { type: "ARRAY", items: { type: "STRING" } },
    destination: { type: "STRING", nullable: true },
  },
  required: ["intent", "medicine", "time", "contact", "urgency", "symptom", "money_sent", "language"],
};

export type LlmConfig = {
  provider?: string; // "openai" | "gemini"; default: openai when OPENAI_API_KEY is set
  openaiKey?: string;
  openaiModel?: string;
  geminiKey?: string;
  geminiModel?: string;
};

type InlinePart = { inline_data?: { mime_type: string; data: string } };

export function llmProvider(cfg: LlmConfig): "openai" | "gemini" {
  if (cfg.provider === "openai" || cfg.provider === "gemini") return cfg.provider;
  return cfg.openaiKey ? "openai" : "gemini";
}

/**
 * One JSON call to whichever LLM is configured. Every pipeline goes through
 * this same function, so Whisper and Hey Bujji always use the same model.
 * OpenAI can't read video, so a screen recording goes to Gemini when a
 * Gemini key exists.
 */
export async function llmJson(cfg: LlmConfig, prompt: string, schema?: unknown, parts: unknown[] = []): Promise<unknown> {
  const hasVideo = (parts as InlinePart[]).some((p) => p.inline_data?.mime_type.startsWith("video"));
  if (llmProvider(cfg) === "openai" && !(hasVideo && cfg.geminiKey)) return openaiJson(cfg, prompt, parts);
  return geminiJson(cfg, prompt, schema, parts);
}

export async function openaiJson(cfg: LlmConfig, prompt: string, parts: unknown[] = []): Promise<unknown> {
  if (!cfg.openaiKey) throw new Error("OPENAI_API_KEY is not set");
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const p of parts as InlinePart[]) {
    const d = p.inline_data;
    if (!d) continue;
    if (!d.mime_type.startsWith("image")) throw new Error("OpenAI can only read images; send a screenshot or set GEMINI_API_KEY for videos");
    content.push({ type: "image_url", image_url: { url: `data:${d.mime_type};base64,${d.data}` } });
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.openaiKey}` },
    body: JSON.stringify({
      model: cfg.openaiModel || "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
}

export async function geminiJson(cfg: LlmConfig, prompt: string, schema?: unknown, parts: unknown[] = []): Promise<unknown> {
  if (!cfg.geminiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = cfg.geminiModel || "gemini-2.5-flash";
  const generationConfig: Record<string, unknown> = { temperature: 0, responseMimeType: "application/json" };
  if (schema) generationConfig.responseSchema = schema;
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }], generationConfig }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
}

/** Turn "8 PM", "20:00", "8:00 pm" into "HH:MM". Format only, no guessing. */
export function normaliseClock(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const m = v.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Case-insensitive exact canonicalisation of names (applied equally to both pipelines). */
function canonical(value: unknown, names: string[]): string | null {
  if (typeof value !== "string" || !value.trim() || value.toLowerCase() === "null") return null;
  const v = value.trim();
  if (v.toLowerCase() === "all") return "all";
  return names.find((n) => n.toLowerCase() === v.toLowerCase()) ?? v;
}

export function validateIntent(raw: unknown, family: Family): Intent {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const intent = (INTENTS as readonly string[]).includes(o.intent as string) ? (o.intent as IntentName) : "other";
  const medNames = [...family.medicines.map((m) => m.name), ...COMMON_MEDICINES.map((m) => m.name)];
  const urgency = ["normal", "high", "urgent"].includes(o.urgency as string) ? (o.urgency as Intent["urgency"]) : "normal";
  const symptom = ["chest_pain", "breathlessness", "dizziness", "other"].includes(o.symptom as string) ? (o.symptom as Intent["symptom"]) : null;
  const language = ["te", "hi", "en"].includes(o.language as string) ? (o.language as Intent["language"]) : "te";
  return {
    intent,
    medicine: canonical(o.medicine, medNames),
    time: normaliseClock(o.time),
    contact: canonical(o.contact, family.contacts.map((c) => c.name)),
    urgency,
    symptom,
    money_sent: o.money_sent === true,
    language,
    items: Array.isArray(o.items) ? (o.items as unknown[]).filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()).slice(0, 10) : [],
    destination: typeof o.destination === "string" && o.destination.trim() ? o.destination.trim() : null,
  };
}

export async function extractIntent(cfg: LlmConfig, family: Family, transcript: string): Promise<Intent> {
  const raw = await llmJson(cfg, buildPrompt(family, transcript), RESPONSE_SCHEMA);
  return validateIntent(raw, family);
}

function orderItems(t: string): string[] {
  const m = t.match(/\border\s+(.+)/);
  if (!m) return [];
  return m[1].replace(/\b(please|from swiggy|from zomato|cheyyi|karo)\b/g, "").split(/,|\band\b|\baur\b/).map((x) => x.trim()).filter(Boolean).slice(0, 10);
}

/** Keyword fallback used only when the LLM is unavailable, so the live demo never goes silent. */
export function rulesIntent(c: Correction, transcript: string): Intent {
  const t = transcript.toLowerCase();
  let intent: IntentName = "other";
  if (c.symptom) intent = "red_flag";
  else if (c.scam) intent = "scam_report";
  else if (/\bvideo\b/.test(t)) intent = "video_call";
  else if (/\b(cab|taxi|auto|uber|ola|rapido)\b/.test(t)) intent = "book_cab";
  else if (/\b(order|swiggy|zomato|mangao|tecchi|deliver)\b/.test(t)) intent = "order_food";
  else if (/(call|phone|fon|kaal|kalupu|lagao|కాల్|फ़ोन|फोन)/.test(t) && c.contact) intent = "call_family";
  else if (/(gurthu|gurtu|yaad|remind|గుర్తు|याद)/.test(t) || (c.time && c.medicine)) intent = "set_reminder";
  else if (c.medicine) intent = "took_medicine";
  return {
    intent,
    medicine: intent === "took_medicine" || intent === "set_reminder" ? c.medicine : null,
    time: intent === "set_reminder" || intent === "took_medicine" ? c.time : null,
    contact: intent === "call_family" || intent === "video_call" ? (c.contact ?? (intent === "video_call" ? "Ravi" : null)) : null,
    urgency: intent === "red_flag" ? "urgent" : intent === "scam_report" ? "high" : "normal",
    symptom: c.symptom,
    money_sent: c.moneySent,
    language: c.language,
    items: intent === "order_food" ? orderItems(t) : [],
    destination: intent === "book_cab" ? (t.match(/\bto (the )?([a-z ]+?)(\.|$)/)?.[2]?.trim() ?? (/hospital|aspatri|aaspatri/.test(t) ? "hospital" : null)) : null,
  };
}

/**
 * Hey Bujji only: the correction step's high-confidence matches win over the
 * LLM, and red-flag phrases always escalate. Every override is recorded so
 * the results page can say how much of the gain came from the lists.
 */
export function mergeCorrection(llm: Intent, c: Correction): { intent: Intent; overrides: string[] } {
  const out = { ...llm };
  const overrides: string[] = [];
  const set = <K extends keyof Intent>(k: K, v: Intent[K]) => {
    if (out[k] !== v) { overrides.push(`${k}: ${JSON.stringify(out[k])} -> ${JSON.stringify(v)}`); out[k] = v; }
  };
  if (c.symptom) {
    set("intent", "red_flag");
    set("urgency", "urgent");
    if (!out.symptom || out.symptom === "other") set("symptom", c.symptom);
  } else if (c.scam && out.intent === "other") {
    set("intent", "scam_report");
    set("urgency", "high");
  }
  if (c.moneySent && out.intent === "scam_report") set("money_sent", true);
  if (out.intent === "took_medicine" || out.intent === "set_reminder") {
    if (c.medicine) set("medicine", c.medicine);
    if (c.time) set("time", c.time);
  }
  if (out.intent === "call_family" && c.contact) set("contact", c.contact);
  if (out.intent === "red_flag") { out.medicine = null; out.contact = null; }
  return { intent: out, overrides };
}
