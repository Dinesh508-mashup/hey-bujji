import { test } from "node:test";
import assert from "node:assert/strict";
import { voiceConfirms } from "./confirm.ts";

test("medicine confirmed by the took_medicine intent", () => {
  assert.equal(voiceConfirms({ kind: "medicine", transcript: "Amlodipine vesukunna", intent: "took_medicine" }), true);
  assert.equal(voiceConfirms({ kind: "medicine", transcript: "I took my BP tablet", intent: "took_medicine" }), true);
});

test("plain yes / done phrases confirm any task", () => {
  for (const t of ["Done", "I did it", "Yes, finished", "ho gaya", "walked for 15 minutes", "okay I called him"]) {
    assert.equal(voiceConfirms({ kind: "walk", transcript: t }), true, t);
  }
});

test("negatives and empty speech do not confirm", () => {
  for (const t of ["", "I didn't take it", "not yet", "I will do it later", "nahi liya", "I forgot"]) {
    assert.equal(voiceConfirms({ kind: "medicine", transcript: t, intent: "took_medicine" }), false, t);
  }
  assert.equal(voiceConfirms({ kind: "medicine", transcript: "what time is it", intent: "other" }), false);
});
