import { test } from "node:test";
import assert from "node:assert/strict";
import { countdownLabel, msUntil, shouldRing } from "./alarm.ts";

const at = (h: number, m: number, s = 0) => { const d = new Date(2026, 10, 22, h, m, s); return d; };
const task = (time: string | null, done: Date | null = null) => ({ time, last_done_at: done ? done.toISOString() : null });

test("countdown to the set time", () => {
  assert.equal(msUntil(task("08:00"), at(7, 30)), 30 * 60_000);
  assert.equal(msUntil(task(null), at(7, 30)), null);
  assert.equal(countdownLabel(80 * 60_000), "in 1 h 20 min");
  assert.equal(countdownLabel(45_000), "in 45 s");
  assert.equal(countdownLabel(-10_000), "now");
  assert.equal(countdownLabel(-8 * 60_000), "8 min ago");
});

test("rings at the set time until stopped, done, or an hour passes", () => {
  assert.equal(shouldRing(task("08:00"), at(7, 59, 59), false), false);
  assert.equal(shouldRing(task("08:00"), at(8, 0), false), true);
  assert.equal(shouldRing(task("08:00"), at(8, 30), false), true);
  assert.equal(shouldRing(task("08:00"), at(8, 30), true), false); // Amma pressed Stop
  assert.equal(shouldRing(task("08:00", at(8, 5)), at(8, 30), false), false); // already done
  assert.equal(shouldRing(task("08:00"), at(9, 1), false), false); // window over
  assert.equal(shouldRing(task(null), at(8, 0), false), false);
});
