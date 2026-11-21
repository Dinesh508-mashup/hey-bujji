// Sanity check: the correction step alone, on the TRUE transcripts.
// This is not the evaluation (no speech model involved); it just shows the
// lists cover the test sentences. node --test eval/truth.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { correct } from "../supabase/functions/_shared/correct.ts";
import { DEMO_FAMILY } from "../supabase/functions/_shared/lexicon.ts";

const rows = readFileSync(new URL("./truth.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map((l) => l.split(","));

for (const [id, transcript, intent, medicine, time, contact, , symptom, moneySent] of rows) {
  test(`${id}: ${transcript}`, () => {
    const c = correct(transcript, DEMO_FAMILY);
    if (intent === "took_medicine" || intent === "set_reminder") assert.equal(c.medicine ?? "", medicine, "medicine");
    if (intent === "set_reminder") assert.equal(c.time ?? "", time, "time");
    if (intent === "call_family") assert.equal(c.contact ?? "", contact, "contact");
    if (intent === "red_flag") assert.equal(c.symptom ?? "", symptom, "symptom");
    else assert.equal(c.symptom, null, "no false red flag");
    if (intent === "scam_report") assert.ok(c.scam, "scam");
    else assert.equal(c.scam, false, "no false scam");
    assert.equal(String(c.moneySent), moneySent, "money_sent");
  });
}
