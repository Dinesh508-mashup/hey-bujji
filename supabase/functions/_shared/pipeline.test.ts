// Pipeline wiring with a stubbed Gemini: checks the fair-comparison rule
// (same prompt, different transcript) and the correction overrides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "./pipeline.ts";
import { DEMO_FAMILY } from "./lexicon.ts";

function stubGemini(answer: Record<string, unknown>) {
  const prompts: string[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    prompts.push(body.contents[0].parts[0].text);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }));
  }) as typeof fetch;
  return prompts;
}

const base = { family: DEMO_FAMILY, stt: {}, llm: { geminiKey: "test" } };
const llmMiss = { intent: "set_reminder", medicine: null, time: "8 PM", contact: null, urgency: "normal", symptom: null, money_sent: false, language: "te" };

test("bujji pipeline fills medicine from the correction step and records the override", async () => {
  stubGemini(llmMiss);
  const r = await runPipeline({ ...base, pipeline: "bujji", text: "Raatri 8 ki sugar tablet gurthu cheyyi" });
  assert.equal(r.intent.intent, "set_reminder");
  assert.equal(r.intent.medicine, "Metformin");
  assert.equal(r.intent.time, "20:00");
  assert.ok(r.overrides.some((o) => o.startsWith("medicine")));
  assert.deepEqual(r.action, { type: "reminder", time: "20:00", medicine: "Metformin" });
});

test("baseline gets no correction, only format normalisation", async () => {
  stubGemini(llmMiss);
  const r = await runPipeline({ ...base, pipeline: "baseline", text: "Raatri 8 ki sugar tablet gurthu cheyyi" });
  assert.equal(r.intent.medicine, null);
  assert.equal(r.intent.time, "20:00");
  assert.equal(r.correction, null);
});

test("both pipelines use the same prompt template", async () => {
  const p1 = stubGemini(llmMiss);
  await runPipeline({ ...base, pipeline: "baseline", text: "X" });
  const p2 = stubGemini(llmMiss);
  await runPipeline({ ...base, pipeline: "bujji", text: "X" });
  assert.equal(p1[0], p2[0]);
});

test("red flag always escalates even if the LLM says other", async () => {
  stubGemini({ ...llmMiss, intent: "other", time: null });
  const r = await runPipeline({ ...base, pipeline: "bujji", text: "Chest lo noppi ga undi" });
  assert.equal(r.intent.intent, "red_flag");
  assert.equal(r.intent.urgency, "urgent");
  assert.equal(r.feed?.urgency, "urgent");
  assert.deepEqual(r.action, { type: "emergency", number: "108" });
});

test("live app falls back to rules when the LLM fails; eval mode does not", async () => {
  globalThis.fetch = (async () => new Response("quota", { status: 429 })) as typeof fetch;
  const r = await runPipeline({ ...base, pipeline: "bujji", text: "Abbayiki call cheyyi" });
  assert.equal(r.llmSource, "rules");
  assert.equal(r.action.type, "call");
  await assert.rejects(runPipeline({ ...base, pipeline: "bujji", text: "Abbayiki call cheyyi", strict: true }));
});

test("scam with money sent asks to dial 1930", async () => {
  stubGemini({ ...llmMiss, intent: "scam_report", time: null, urgency: "high", money_sent: false });
  const r = await runPipeline({ ...base, pipeline: "bujji", text: "OTP ichesanu, dabbulu pampesanu" });
  assert.equal(r.intent.money_sent, true);
  assert.equal(r.action.type, "dial");
  assert.match(r.reply.text, /1930/);
});

test("OpenAI is used when its key is set, with the same prompt", async () => {
  const prompts: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.match(String(url), /api\.openai\.com/);
    const body = JSON.parse(String(init.body));
    prompts.push(body.messages[0].content[0].text);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(llmMiss) } }] }));
  }) as typeof fetch;
  const r = await runPipeline({ ...base, llm: { openaiKey: "test" }, pipeline: "bujji", text: "Raatri 8 ki sugar tablet gurthu cheyyi" } as never);
  assert.equal(r.llmSource, "openai");
  assert.equal(r.intent.time, "20:00");
  assert.equal(prompts.length, 1);
});
