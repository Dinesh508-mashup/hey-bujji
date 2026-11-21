// POST /functions/v1/check-message  ("Bujji, check this")
//   multipart: file=<screenshot or screen recording>, text=<pasted message>, lang=te|hi, dry_run=1
//   or JSON:   { text, lang, dry_run }
// The LLM (OpenAI by default, Gemini for videos) reads the message. Use dummy messages
// only while testing.
// Screenshots are never stored.
import { env } from "../_shared/env.ts";
import { CORS, errorJson, json } from "../_shared/http.ts";
import { insertEvent } from "../_shared/db.ts";
import { llmJson } from "../_shared/intent.ts";

declare const Deno: { serve(h: (req: Request) => Response | Promise<Response>): void };

const PROMPT = `You check messages for an elderly parent in India. The input is a pasted message, a phone screenshot, or a short screen recording (SMS, WhatsApp, a call screen, a web page).
Decide whether it is a scam. Common Indian scams: fake KYC update links, "your account will be blocked", OTP or PIN requests, fake parcel or customs fees, lottery or prize wins, electricity bill disconnection threats, fake police / CBI / "digital arrest" calls, job or investment offers, UPI "collect" requests disguised as payments, unknown APK files.
Ordinary messages (family chat, real bank balance or debit alerts that do not ask for anything, OTPs the user requested themselves with no one asking for them) are safe.
Never repeat any OTP, PIN, account or card number you see.
Return JSON: {"verdict":"scam"|"suspicious"|"safe","signals":[short English phrases],"reason":"one short English sentence","sender":"who it claims to be or null"}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["scam", "suspicious", "safe"] },
    signals: { type: "ARRAY", items: { type: "STRING" } },
    reason: { type: "STRING" },
    sender: { type: "STRING", nullable: true },
  },
  required: ["verdict", "signals", "reason"],
};

const REPLIES = {
  te: {
    scam: "అమ్మా, ఇది మోసం! ఏ లింక్ నొక్కకండి, OTP లేదా డబ్బులు ఇవ్వకండి. రవికి చెప్పాను.",
    suspicious: "ఇది అనుమానంగా ఉంది. ఏమీ నొక్కకండి, ముందు రవిని అడగండి.",
    safe: "ఇది మామూలు మెసేజ్ లాగా ఉంది. పర్వాలేదు.",
  },
  hi: {
    scam: "यह धोखा है! कोई लिंक मत दबाइए, OTP या पैसे मत दीजिए। रवि को बता दिया।",
    suspicious: "यह संदिग्ध लग रहा है। कुछ मत दबाइए, पहले रवि से पूछिए।",
    safe: "यह सामान्य संदेश लग रहा है। कोई बात नहीं।",
  },
};
const ENGLISH = {
  scam: "This is a scam. Don't tap any link or share an OTP or money. I told Ravi.",
  suspicious: "This looks suspicious. Don't tap anything; ask Ravi first.",
  safe: "This looks like a normal message.",
};

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const E = env();
    let text = "";
    let lang: "te" | "hi" = "te";
    let dryRun = false;
    let source = "text";
    let familyId = "demo-1";
    const parts: unknown[] = [];

    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      text = (form.get("text") as string) ?? "";
      lang = form.get("lang") === "hi" ? "hi" : "te";
      dryRun = form.get("dry_run") === "1";
      familyId = (form.get("family_id") as string) || familyId;
      const f = form.get("file");
      if (f && typeof f !== "string") {
        const mime = f.type || "image/jpeg";
        if (f.size > 18_000_000) return json({ error: "file too large (max ~18 MB)" }, 413);
        parts.push({ inline_data: { mime_type: mime, data: toBase64(new Uint8Array(await f.arrayBuffer())) } });
        source = mime.startsWith("video") ? "screen recording" : "screenshot";
      }
    } else {
      const body = await req.json();
      text = body.text ?? "";
      lang = body.lang === "hi" ? "hi" : "te";
      dryRun = !!body.dry_run;
      familyId = body.family_id || familyId;
    }
    if (!text && !parts.length) return json({ error: "send text or a file" }, 400);

    const prompt = text ? `${PROMPT}\n\nPasted message:\n"""\n${text}\n"""` : PROMPT;
    const r = await llmJson(E.llm, prompt, SCHEMA, parts) as { verdict: "scam" | "suspicious" | "safe"; signals: string[]; reason: string; sender?: string | null };
    const verdict = (["scam", "suspicious", "safe"] as const).includes(r.verdict) ? r.verdict : "suspicious";

    const result = {
      verdict,
      signals: r.signals ?? [],
      reason: r.reason ?? "",
      sender: r.sender ?? null,
      reply: { text: REPLIES[lang][verdict], english: ENGLISH[verdict], lang: lang === "hi" ? "hi-IN" : "te-IN" },
    };
    if (!dryRun && verdict !== "safe") {
      await insertEvent(E.db, {
        family_id: familyId,
        type: "scam",
        summary: verdict === "scam" ? `Scam message blocked (${source}): ${result.reason}` : `Suspicious message checked (${source}): ${result.reason}`,
        urgency: verdict === "scam" ? "high" : "normal",
        details: { verdict, signals: result.signals, sender: result.sender, source },
      });
    }
    return json(result);
  } catch (e) {
    return errorJson(e);
  }
});
