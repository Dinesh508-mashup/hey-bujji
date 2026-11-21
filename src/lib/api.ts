// Calls to the Supabase edge functions. No API keys here: only the public anon key.
import { Platform } from "react-native";
import { FAMILY_ID, FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./config";
import { supabase } from "./supabase";

export type Intent = {
  intent: "took_medicine" | "set_reminder" | "call_family" | "red_flag" | "scam_report" | "other";
  medicine: string | null;
  time: string | null;
  contact: string | null;
  urgency: "normal" | "high" | "urgent";
  symptom: string | null;
  money_sent: boolean;
  language: "te" | "hi" | "en";
};

export type Action =
  | { type: "call"; name: string; relation: string; phone: string }
  | { type: "reminder"; time: string; medicine: string | null }
  | { type: "emergency"; number: "108" }
  | { type: "dial"; number: "1930"; reason: string }
  | { type: "none" };

export type Reply = { text: string; english: string; lang: "te-IN" | "hi-IN" };

export type BujjiResult = {
  transcript: string;
  corrected: string | null;
  correction: { fixes: { kind: string; heard: string; fixed: string }[] } | null;
  intent: Intent;
  overrides: string[];
  llmSource: "gemini" | "rules";
  reply: Reply;
  action: Action;
  stt: { provider: string; ms: number } | null;
  ms: number;
};

export type CheckResult = {
  verdict: "scam" | "suspicious" | "safe";
  signals: string[];
  reason: string;
  sender: string | null;
  reply: Reply;
};

export const authHeaders = { authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY };

async function post<T>(fn: string, body: FormData | object): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
    method: "POST",
    headers: isForm ? authHeaders : { ...authHeaders, "content-type": "application/json" },
    body: isForm ? (body as FormData) : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** Append a local file (iOS file:// URI or web blob: URI) to a FormData. */
async function appendFile(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    // React Native's FormData accepts { uri, name, type }
    form.append(field, { uri, name, type } as unknown as Blob);
  }
}

export async function sendVoice(uri: string): Promise<BujjiResult> {
  const form = new FormData();
  const ext = uri.split(".").pop()?.split("?")[0] || "m4a";
  const isWebm = Platform.OS === "web" && !/m4a|mp4|wav/.test(ext);
  await appendFile(form, "audio", uri, isWebm ? "clip.webm" : `clip.${ext}`, isWebm ? "audio/webm" : "audio/m4a");
  form.append("pipeline", "bujji");
  form.append("family_id", FAMILY_ID);
  return post<BujjiResult>("bujji", form);
}

export function sendText(text: string): Promise<BujjiResult> {
  return post<BujjiResult>("bujji", { text, pipeline: "bujji", family_id: FAMILY_ID });
}

export async function checkMessage(input: { text?: string; file?: { uri: string; mime: string; name: string } }, lang: "te" | "hi" = "te"): Promise<CheckResult> {
  const form = new FormData();
  if (input.text) form.append("text", input.text);
  if (input.file) await appendFile(form, "file", input.file.uri, input.file.name, input.file.mime);
  form.append("lang", lang);
  form.append("family_id", FAMILY_ID);
  return post<CheckResult>("check-message", form);
}

export function ttsUrl(text: string, lang: string): string {
  return `${FUNCTIONS_URL}/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
}

/** Sensor checks write straight to the feed (demo family only, allowed by RLS). */
export async function logEvent(type: string, summary: string, urgency: "normal" | "high" | "urgent" = "normal", details: object = {}) {
  const { error } = await supabase.from("events").insert({ family_id: FAMILY_ID, type, summary, urgency, details });
  if (error) console.warn("logEvent failed", error.message);
}
