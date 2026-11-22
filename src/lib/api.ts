// Calls to the Supabase edge functions. No API keys here: only the public anon key.
import { Platform } from "react-native";
import { File } from "expo-file-system";
import { FAMILY_ID, FUNCTIONS_URL, MOCK, SUPABASE_ANON_KEY } from "./config";
import { mockFunction } from "./mockBackend";
import { supabase } from "./supabase";
import { currentLang } from "./language";

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
  | { type: "video"; name: string; phone: string }
  | { type: "order"; items: string[]; order_id?: string }
  | { type: "cab"; destination: string; order_id?: string; ride?: import("../components/Orders").Ride }
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

type Part = { name: string; value: string } | { name: string; uri: string; filename: string; type: string };

async function post<T>(fn: string, body: Part[] | object): Promise<T> {
  if (MOCK) return (await mockFunction(fn, body as never)) as T;
  const init: { method: string; headers: Record<string, string>; body: BodyInit } = Array.isArray(body)
    ? await multipart(body as Part[])
    : { method: "POST", headers: { ...authHeaders, "content-type": "application/json" }, body: JSON.stringify(body) };
  const res = await fetch(`${FUNCTIONS_URL}/${fn}`, init);
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

/**
 * Multipart upload. Web: a normal FormData. iPhone: the multipart body is built by hand
 * from the file's bytes, because Expo SDK 58's fetch rejects React Native's
 * { uri, name, type } file parts ("Unsupported FormDataPart implementation").
 */
async function multipart(parts: Part[]) {
  if (Platform.OS === "web") {
    const form = new FormData();
    for (const p of parts) {
      if ("value" in p) form.append(p.name, p.value);
      else form.append(p.name, await (await fetch(p.uri)).blob(), p.filename);
    }
    return { method: "POST", headers: { ...authHeaders }, body: form as BodyInit };
  }
  const boundary = `----bujji${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const p of parts) {
    if ("value" in p) {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`));
    } else {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\nContent-Type: ${p.type}\r\n\r\n`));
      chunks.push(await new File(p.uri).bytes());
      chunks.push(enc.encode("\r\n"));
    }
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return { method: "POST", headers: { ...authHeaders, "content-type": `multipart/form-data; boundary=${boundary}` }, body: out as unknown as BodyInit };
}

export async function sendVoice(uri: string, opts: { dryRun?: boolean } = {}): Promise<BujjiResult> {
  const ext = uri.split(".").pop()?.split("?")[0] || "m4a";
  const isWebm = Platform.OS === "web" && !/m4a|mp4|wav/.test(ext);
  const parts: Part[] = [
    { name: "audio", uri, filename: isWebm ? "clip.webm" : `clip.${ext}`, type: isWebm ? "audio/webm" : "audio/x-m4a" }, // Sarvam rejects "audio/m4a"
    { name: "pipeline", value: "bujji" },
    { name: "family_id", value: FAMILY_ID },
  ];
  if (opts.dryRun) parts.push({ name: "dry_run", value: "1" }); // understand only: nothing posted to the family feed
  if (currentLang() !== "en") parts.push({ name: "reply_lang", value: currentLang() });
  return post<BujjiResult>("bujji", parts);
}

export function sendText(text: string): Promise<BujjiResult> {
  const l = currentLang();
  return post<BujjiResult>("bujji", { text, pipeline: "bujji", family_id: FAMILY_ID, ...(l !== "en" ? { reply_lang: l } : {}) });
}

export async function checkMessage(input: { text?: string; file?: { uri: string; mime: string; name: string } }, lang: "te" | "hi" = "te"): Promise<CheckResult> {
  const parts: Part[] = [{ name: "lang", value: lang }, { name: "family_id", value: FAMILY_ID }];
  if (input.text) parts.push({ name: "text", value: input.text });
  if (input.file) parts.push({ name: "file", uri: input.file.uri, filename: input.file.name, type: input.file.mime });
  return post<CheckResult>("check-message", parts);
}

export function ttsUrl(text: string, lang: string): string {
  return `${FUNCTIONS_URL}/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`;
}

/** Sensor checks write straight to the feed (demo family only, allowed by RLS). */
export async function logEvent(type: string, summary: string, urgency: "normal" | "high" | "urgent" = "normal", details: object = {}) {
  const { error } = await supabase.from("events").insert({ family_id: FAMILY_ID, type, summary, urgency, details });
  if (error) console.warn("logEvent failed", error.message);
}
