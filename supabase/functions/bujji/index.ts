// POST /functions/v1/bujji
//   multipart: audio=<file>, pipeline=bujji|baseline|indic_raw, family_id, dry_run=1, strict=1,
//              reference=<true transcript, eval only>, text=<typed fallback>
//   or JSON:   { text, pipeline, family_id, dry_run }
// Returns the transcript, correction, intent JSON, spoken reply and the action
// the app should take. Unless dry_run, posts a line to the family feed.
import { env } from "../_shared/env.ts";
import { CORS, errorJson, json } from "../_shared/http.ts";
import { insertEvent, loadFamily } from "../_shared/db.ts";
import { type Pipeline, runPipeline } from "../_shared/pipeline.ts";

const pick = (v: unknown): Pipeline => (v === "baseline" || v === "indic_raw" ? v : "bujji");

declare const Deno: { serve(h: (req: Request) => Response | Promise<Response>): void };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const E = env();
    let audio: Blob | undefined;
    let filename = "clip.m4a";
    let text: string | undefined;
    let pipeline: Pipeline = "bujji";
    let familyId = "demo-1";
    let dryRun = false;
    let strict = false;
    let reference: string | undefined;

    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const f = form.get("audio");
      if (f && typeof f !== "string") { audio = f; filename = (f as File).name || filename; }
      text = (form.get("text") as string) || undefined;
      pipeline = pick(form.get("pipeline"));
      reference = (form.get("reference") as string) || undefined;
      familyId = (form.get("family_id") as string) || familyId;
      dryRun = form.get("dry_run") === "1";
      strict = form.get("strict") === "1";
    } else {
      const body = await req.json();
      text = body.text;
      pipeline = pick(body.pipeline);
      reference = body.reference || undefined;
      familyId = body.family_id || familyId;
      dryRun = !!body.dry_run;
      strict = !!body.strict;
    }
    if (!audio && !text) return json({ error: "send audio or text" }, 400);

    const family = await loadFamily(E.db, familyId);
    const result = await runPipeline({ pipeline, family, stt: E.stt, llm: E.llm, audio, filename, text, strict, reference });

    if (!dryRun && result.feed) {
      await insertEvent(E.db, {
        family_id: familyId,
        type: result.feed.type,
        summary: result.feed.summary,
        urgency: result.feed.urgency,
        details: { transcript: result.transcript, intent: result.intent, overrides: result.overrides, source: "voice" },
      });
    }
    return json(result);
  } catch (e) {
    return errorJson(e);
  }
});
