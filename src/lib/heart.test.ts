// Synthetic scenarios for the heart rate wellness check. These test the decision
// logic only; they say nothing about accuracy on a real iPhone (see README).
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseHeart, type HeartResult } from "./heart.ts";
import type { MotionSample } from "./signal.ts";

const FS = 4000;
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

function noise(sec: number, amp: number) { return Float32Array.from({ length: sec * FS }, () => amp * gauss()); }
function add(a: Float32Array, b: ArrayLike<number>) { for (let i = 0; i < a.length; i++) a[i] += b[i] ?? 0; return a; }

/** Heart sounds: S1 (40 Hz, 80 ms) then S2 (60 Hz, 60 ms) 0.3 s later, every beat. */
function heartbeat(sec: number, bpm: number, amp: number, jitter = 0.02, irregular = false) {
  const x = new Float32Array(sec * FS);
  let t = 0.3;
  while (t < sec - 0.5) {
    for (const [off, f, dur, a] of [[0, 40, 0.08, 1], [0.3, 60, 0.06, 0.6]] as const) {
      const c = (t + off) * FS;
      for (let i = -dur * FS; i < dur * FS; i++) {
        const k = Math.round(c + i);
        if (k >= 0 && k < x.length) x[k] += amp * a * Math.exp(-((i / FS / (dur / 2.5)) ** 2)) * Math.sin(2 * Math.PI * f * (k / FS));
      }
    }
    const period = 60 / bpm;
    t += irregular ? period * (0.5 + rand()) : period * (1 + jitter * gauss());
  }
  return x;
}

/** Fan / mains hum: steady 50 + 100 Hz plus broadband. */
function fan(sec: number, amp: number) {
  return Float32Array.from({ length: sec * FS }, (_, i) => amp * (Math.sin(2 * Math.PI * 50 * i / FS) + 0.5 * Math.sin(2 * Math.PI * 100 * i / FS)) + amp * 0.3 * gauss());
}

/** Speech-like: harmonics of a 180 Hz voice up to 2 kHz, switching on/off ~4 times a second. */
function speech(sec: number, amp: number) {
  return Float32Array.from({ length: sec * FS }, (_, i) => {
    const t = i / FS, on = Math.sin(2 * Math.PI * 4 * t) > -0.2 ? 1 : 0;
    let v = 0; for (let h = 1; h <= 10; h++) v += Math.sin(2 * Math.PI * 180 * h * t) / h;
    return on * amp * v;
  });
}

/** Motion: breathing = slow gravity wobble (g units * 9.81), shake = random user acceleration. */
function motion(sec: number, breathingG: number, shake: number): MotionSample[] {
  return Array.from({ length: sec * 20 }, (_, i) => {
    const t = i * 50, b = breathingG * 9.81 * Math.sin(2 * Math.PI * 0.25 * (t / 1000));
    return { t, g: { x: 0.0005 * gauss(), y: b, z: -9.81 + 0.0005 * gauss() }, a: { x: shake * gauss(), y: shake * gauss(), z: shake * gauss() } };
  });
}

const CHEST_MOTION = () => motion(20, 0.02, 0.02); // lying, breathing
const HAND_MOTION = () => motion(20, 0.015, 0.06); // held in the air: some sway, still breathing-like
const TABLE_MOTION = () => motion(20, 0, 0.003);   // perfectly still

function check(name: string, r: HeartResult) {
  console.log(`${name.padEnd(28)} ${r.ok ? `OK ${r.bpm}/min` : `FAIL ${r.reason.padEnd(17)} ${r.why}`}`);
  return r;
}

const room = (amp = 0.01) => noise(3, amp);

test("phone in the air (room noise only) fails", () => {
  const r = check("air", analyseHeart({ baseline: room(), chest: noise(20, 0.01), sampleRate: FS, motion: HAND_MOTION() }));
  assert.equal(r.ok, false);
});

test("phone on a table fails", () => {
  const r = check("table", analyseHeart({ baseline: room(), chest: noise(20, 0.004), sampleRate: FS, motion: TABLE_MOTION() }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "not_on_chest");
});

test("phone near a fan fails", () => {
  const base = add(room(), fan(3, 0.05));
  const r = check("fan", analyseHeart({ baseline: base, chest: add(noise(20, 0.01), fan(20, 0.05)), sampleRate: FS, motion: HAND_MOTION() }));
  assert.equal(r.ok, false);
});

test("phone near a TV (speech) fails", () => {
  const base = add(room(), speech(3, 0.05));
  const r = check("tv", analyseHeart({ baseline: base, chest: add(noise(20, 0.01), speech(20, 0.05)), sampleRate: FS, motion: HAND_MOTION() }));
  assert.equal(r.ok, false);
});

test("phone on the chest while talking fails", () => {
  const chest = add(add(heartbeat(20, 72, 0.3), noise(20, 0.003)), speech(20, 0.15));
  const r = check("chest + talking", analyseHeart({ baseline: room(), chest, sampleRate: FS, motion: CHEST_MOTION() }));
  assert.equal(r.ok, false);
});

test("shaking fails with too much movement", () => {
  const chest = add(heartbeat(20, 72, 0.3), noise(20, 0.003));
  const r = check("shaking", analyseHeart({ baseline: room(), chest, sampleRate: FS, motion: motion(20, 0.02, 0.6) }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "too_much_movement");
});

test("uneven, messy beats fail", () => {
  const chest = add(heartbeat(20, 72, 0.3, 0, true), noise(20, 0.003));
  const r = check("irregular", analyseHeart({ baseline: room(), chest, sampleRate: FS, motion: CHEST_MOTION() }));
  assert.equal(r.ok, false);
});

for (const bpm of [55, 72, 95, 130]) {
  test(`phone on the chest, lying still, ${bpm}/min works`, () => {
    const chest = add(heartbeat(20, bpm, 0.3), noise(20, 0.003));
    const r = check(`chest still ${bpm}`, analyseHeart({ baseline: room(), chest, sampleRate: FS, motion: CHEST_MOTION() }));
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(Math.abs(r.bpm - bpm) <= 3, `got ${r.bpm}, expected ~${bpm}`);
  });
}
