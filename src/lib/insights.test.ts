import { test } from "node:test";
import assert from "node:assert/strict";
import { healthSuggestions, type Ev } from "./insights.ts";

const now = new Date(2026, 10, 22, 12);
const ev = (type: string, details: Record<string, unknown>, daysAgo = 0): Ev => ({ type, details, created_at: new Date(now.getTime() - daysAgo * 86400000).toISOString() });

test("weak chair stand suggests leg work, calcium/vitamin D and a task", () => {
  const s = healthSuggestions([ev("chair_stand", { stands: 7, below_average: true })], 68, now);
  const legs = s.find((x) => x.id === "legs")!;
  assert.equal(legs.level, "watch");
  assert.ok(legs.food.some((f) => /calcium/i.test(f)) && legs.food.some((f) => /vitamin d/i.test(f)));
  assert.equal(legs.task?.kind, "chair_stand");
});

test("abnormal breathing goes first and says see a doctor", () => {
  const s = healthSuggestions([ev("breathing", { bpm: 28 }), ev("chair_stand", { stands: 14 })], 68, now);
  assert.equal(s[0].id, "breathing");
  assert.equal(s[0].level, "doctor");
});

test("good readings are reported as good, low walks get a walk task", () => {
  const s = healthSuggestions([ev("breathing", { bpm: 15 }), ev("heart_rate", { bpm: 72 }), ev("memory", { score: 3 }), ev("task_done", { steps: 600 })], 68, now);
  assert.equal(s.find((x) => x.id === "breathing")!.level, "good");
  assert.equal(s.find((x) => x.id === "heart")!.level, "good");
  assert.equal(s.find((x) => x.id === "steps")!.task?.kind, "walk");
});

test("readings older than 30 days are ignored", () => {
  const s = healthSuggestions([ev("breathing", { bpm: 30 }, 45)], 68, now);
  assert.equal(s.find((x) => x.id === "breathing")!.title, "No breathing check yet");
});
