// POST /functions/v1/bujji
//   multipart: audio=<file>, pipeline=bujji|baseline|indic_raw, family_id, dry_run=1, strict=1,
//              reference=<true transcript, eval only>, text=<typed fallback>
//   or JSON:   { text, pipeline, family_id, dry_run }
// Returns the transcript, correction, intent JSON, spoken reply and the action
// the app should take. Unless dry_run, posts a line to the family feed.
import { env } from "../_shared/env.ts";
import { CORS, errorJson, json } from "../_shared/http.ts";
import { insertEvent, insertOrder, loadFamily } from "../_shared/db.ts";
import { type Pipeline, type Ride, runPipeline } from "../_shared/pipeline.ts";

const DRIVERS = [["Suresh Kumar", "Maruti Swift Dzire", "AP 16 CK 4521"], ["Ramesh Babu", "Toyota Etios", "AP 39 TB 7788"], ["Venkat Rao", "Hyundai Aura", "AP 16 DE 1290"]];
function mockRide(): Ride {
  const [driver, car, plate] = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
  return { driver, car, plate, phone: "+910000000000", otp: String(1000 + Math.floor(Math.random() * 9000)), eta_min: 3 + Math.floor(Math.random() * 6), rating: 4.7, simulated: true };
}

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
    let replyLang: "te" | "hi" | undefined;
    const pickLang = (v: unknown) => (v === "te" || v === "hi" ? v : undefined);

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
      replyLang = pickLang(form.get("reply_lang"));
    } else {
      const body = await req.json();
      text = body.text;
      pipeline = pick(body.pipeline);
      reference = body.reference || undefined;
      familyId = body.family_id || familyId;
      dryRun = !!body.dry_run;
      strict = !!body.strict;
      replyLang = pickLang(body.reply_lang);
    }
    if (!audio && !text) return json({ error: "send audio or text" }, 400);

    const family = await loadFamily(E.db, familyId);
    const result = await runPipeline({ pipeline, family, stt: E.stt, llm: E.llm, audio, filename, text, strict, reference, replyLang });

    // Orders: food goes to Ravi for approval; cabs are simulated with a mock driver and OTP.
    if (!dryRun && result.action.type === "order") {
      result.action.order_id = (await insertOrder(E.db, {
        family_id: familyId, kind: "food", status: "pending", items: result.action.items, said: result.transcript,
        details: { source: "demo_cart", note: "Demo cart: no real order is placed until a Swiggy/Zomato account is connected" },
      })) ?? undefined;
    }
    if (!dryRun && result.action.type === "cab") {
      const ride = mockRide();
      result.action.ride = ride;
      result.action.order_id = (await insertOrder(E.db, {
        family_id: familyId, kind: "cab", status: "assigned", destination: result.action.destination, said: result.transcript, details: ride,
      })) ?? undefined;
    }

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
