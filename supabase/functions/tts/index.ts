// GET /functions/v1/tts?text=...&lang=te-IN
// Sarvam text-to-speech, used when the iPhone has no Telugu/Hindi voice.
// Returns audio/wav so the app can play it straight from the URL.
import { env } from "../_shared/env.ts";
import { CORS, errorJson, json } from "../_shared/http.ts";

declare const Deno: { serve(h: (req: Request) => Response | Promise<Response>): void };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const E = env();
    if (!E.stt.sarvamKey) return json({ error: "SARVAM_API_KEY is not set" }, 500);
    const url = new URL(req.url);
    let text = url.searchParams.get("text") ?? "";
    let lang = url.searchParams.get("lang") ?? "te-IN";
    if (req.method === "POST") ({ text = text, lang = lang } = await req.json());
    if (!text) return json({ error: "text required" }, 400);

    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": E.stt.sarvamKey, "content-type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 1500),
        target_language_code: lang,
        speaker: E.sarvamTtsSpeaker || "kavitha",
        model: E.sarvamTtsModel || "bulbul:v3",
        pace: 0.9,
      }),
    });
    if (!res.ok) return json({ error: `Sarvam TTS ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502);
    const data = await res.json();
    const b64: string = data.audios?.[0] ?? "";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { ...CORS, "content-type": "audio/wav", "cache-control": "public, max-age=86400" } });
  } catch (e) {
    return errorJson(e);
  }
});
