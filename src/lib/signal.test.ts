// node --test src/lib/signal.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseBreathing, analyseChairStand, chairStandBelowAverage, type MotionSample } from "./signal.ts";

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5; }

function breathing(bpm: number, seconds: number, noise = 0.004, fs = 20): MotionSample[] {
  const r = rng(7);
  const out: MotionSample[] = [];
  for (let i = 0; i < seconds * fs; i++) {
    const t = i / fs;
    const tilt = 0.03 * Math.sin(2 * Math.PI * (bpm / 60) * t) + 0.01 * t / seconds; // breath + slow drift
    out.push({ t: t * 1000, g: { x: noise * r(), y: 0.2 + noise * r(), z: -9.8 + tilt + noise * r() }, a: { x: 0.01 * r(), y: 0.01 * r(), z: 0.01 * r() } });
  }
  return out;
}

test("breathing rate within ±1 of synthetic truth", () => {
  for (const bpm of [10, 14, 18, 24]) {
    const r = analyseBreathing(breathing(bpm, 60));
    assert.equal(r.quality, "good", `bpm ${bpm}`);
    assert.ok(Math.abs(r.breathsPerMinute - bpm) <= 1, `expected ${bpm}, got ${r.breathsPerMinute}`);
  }
});

test("breathing: too short and noisy are flagged", () => {
  assert.equal(analyseBreathing(breathing(15, 10)).quality, "too_short");
  const moving = breathing(15, 60).map((s, i) => (i % 5 === 0 ? { ...s, a: { x: 3, y: 2, z: 2 } } : s));
  assert.equal(analyseBreathing(moving).quality, "noisy");
});

function chairStands(n: number, seconds = 30, fs = 50): MotionSample[] {
  const out: MotionSample[] = [];
  const period = seconds / n;
  for (let i = 0; i < seconds * fs; i++) {
    const t = i / fs;
    const ph = (t % period) / period; // 0..1: stand in first half, sit in second
    // stand: up-accel then decel; sit: down-accel then decel
    const up = ph < 0.5 ? 2.5 * Math.sin(2 * Math.PI * ph * 2) : -2.5 * Math.sin(2 * Math.PI * (ph - 0.5) * 2);
    const a = { x: 0, y: 0, z: up }; // gravity points -z, so moving up is +z
    out.push({ t: t * 1000, g: { x: a.x, y: a.y, z: -9.8 + a.z }, a });
  }
  return out;
}

test("chair stand count matches synthetic stands", () => {
  for (const n of [6, 10, 14]) {
    const r = analyseChairStand(chairStands(n));
    assert.ok(Math.abs(r.stands - n) <= 1, `expected ${n}, got ${r.stands}`);
  }
});

test("CDC STEADI thresholds", () => {
  assert.equal(chairStandBelowAverage(9, 68, "female"), true);
  assert.equal(chairStandBelowAverage(12, 68, "female"), false);
});
