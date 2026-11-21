// Heart rate wellness check: decide whether a microphone recording made with the
// phone pressed on the chest contains a real, steady heartbeat. Not a medical test.
//
// Pure maths, no React Native imports, so it runs under `node --test` with synthetic
// signals. Every limit comes from heartConfig.ts.
//
// Steps:
//  1. Motion sensor: reject heavy shaking, and reject "perfectly still" (a table:
//     no breathing movement at all).
//  2. Compare the chest recording with 3 s of room sound: on the chest the heart band
//     (20–150 Hz) must be much louder, and the room band (voices, TV) must not be.
//  3. Envelope of the heart band -> autocorrelation -> a repeating beat at 40–180/min.
//  4. Pick the individual beats; need >= 10, evenly spaced. Rate = 60 / median interval.

import { HEART, type HeartFailReason } from "./heartConfig.ts";
import type { MotionSample } from "./signal.ts";

type Cfg = typeof HEART;

export type HeartMetrics = {
  seconds: number;
  sampleRate: number;
  heartBandGain: number | null;  // chest heart-band energy / baseline
  roomBandGain: number | null;   // chest room-band energy / baseline
  heartBandShare: number | null; // share of chest energy in the heart band
  periodicity: number | null;    // autocorrelation peak of the beat envelope
  beats: number | null;
  intervalCv: number | null;
  intervalOutliers: number | null;
  shake: number | null;          // m/s²
  breathingMotion: number | null; // g
  motionSamples: number;
};

export type HeartResult =
  | { ok: true; bpm: number; metrics: HeartMetrics }
  | { ok: false; reason: HeartFailReason; why: string; metrics: HeartMetrics };

// ---------- filters ----------

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function biquad(kind: "lowpass" | "highpass", f: number, fs: number, q = Math.SQRT1_2): Biquad {
  const w = (2 * Math.PI * Math.min(f, fs * 0.45)) / fs;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
  const b = kind === "lowpass" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

function run(x: ArrayLike<number>, c: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** 4th-order band-pass (two high-pass + two low-pass biquads). */
export function bandpass(x: ArrayLike<number>, lo: number, hi: number, fs: number): Float32Array {
  const hp = biquad("highpass", lo, fs), lp = biquad("lowpass", hi, fs);
  return run(run(run(run(x, hp), hp), lp), lp);
}

/** Mean square, skipping the first 0.2 s where the filters settle. */
function power(x: Float32Array, fs: number): number {
  const start = Math.min(x.length - 1, Math.floor(fs * 0.2));
  let s = 0;
  for (let i = start; i < x.length; i++) s += x[i] * x[i];
  return s / Math.max(1, x.length - start);
}

const mean = (xs: ArrayLike<number>) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i]; return xs.length ? s / xs.length : 0; };
function stdOf(xs: ArrayLike<number>) { const m = mean(xs); let s = 0; for (let i = 0; i < xs.length; i++) s += (xs[i] - m) ** 2; return xs.length ? Math.sqrt(s / xs.length) : 0; }
function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function boxcar(xs: ArrayLike<number>, win: number): Float32Array {
  const out = new Float32Array(xs.length), h = win >> 1;
  let sum = 0, n = 0, lo = 0, hi = -1;
  for (let i = 0; i < xs.length; i++) {
    while (hi < Math.min(xs.length - 1, i + h)) { hi++; sum += xs[hi]; n++; }
    while (lo < i - h) { sum -= xs[lo]; lo++; n--; }
    out[i] = sum / n;
  }
  return out;
}

// ---------- motion ----------

export function motionChecks(samples: MotionSample[], cfg: Cfg = HEART) {
  if (samples.length < 20) return { shake: null, breathingMotion: null };
  const mags = samples.filter((s) => s.a).map((s) => Math.hypot(s.a!.x, s.a!.y, s.a!.z));
  const shake = mags.length ? stdOf(mags) : null;
  const dt = (samples[samples.length - 1].t - samples[0].t) / 1000 / (samples.length - 1) || cfg.motionIntervalMs / 1000;
  const smooth = Math.max(1, Math.round(0.5 / dt)), trend = Math.max(3, Math.round(8 / dt));
  // gravity in g (expo reports m/s²); breathing = slow wobble of the gravity direction
  let breathing = 0;
  for (const k of ["x", "y", "z"] as const) {
    const g = samples.map((s) => s.g[k] / 9.81);
    const sm = boxcar(g, smooth), tr = boxcar(g, trend);
    const detr = Array.from(sm, (v, i) => v - tr[i]);
    breathing = Math.max(breathing, stdOf(detr));
  }
  return { shake, breathingMotion: breathing };
}

// ---------- main ----------

export function analyseHeart(input: {
  baseline: ArrayLike<number>; chest: ArrayLike<number>; sampleRate: number; motion: MotionSample[] | null;
}, cfg: Cfg = HEART): HeartResult {
  const fs = input.sampleRate;
  const m: HeartMetrics = {
    seconds: input.chest.length / fs, sampleRate: fs,
    heartBandGain: null, roomBandGain: null, heartBandShare: null, periodicity: null,
    beats: null, intervalCv: null, intervalOutliers: null, shake: null, breathingMotion: null,
    motionSamples: input.motion?.length ?? 0,
  };
  const fail = (reason: HeartFailReason, why: string): HeartResult => ({ ok: false, reason, why, metrics: m });

  if (m.seconds < cfg.chestSeconds * 0.8) return fail("no_rhythm", `Recording too short (${m.seconds.toFixed(1)} s)`);

  // 1. motion
  if (input.motion) {
    const mc = motionChecks(input.motion, cfg);
    m.shake = mc.shake; m.breathingMotion = mc.breathingMotion;
    if (mc.shake !== null && mc.shake > cfg.maxShake) return fail("too_much_movement", `Shaking ${mc.shake.toFixed(3)} > ${cfg.maxShake}`);
    if (mc.breathingMotion !== null && mc.breathingMotion < cfg.minBreathingMotion) {
      return fail("not_on_chest", `No breathing movement (${mc.breathingMotion.toFixed(4)} g < ${cfg.minBreathingMotion}): phone looks like it is on a table`);
    }
  }

  // 2. on the chest? compare with the room baseline
  const [hLo, hHi] = cfg.heartBand, [rLo, rHi] = cfg.roomBand;
  const heart = bandpass(input.chest, hLo, hHi, fs);
  const eps = 1e-12;
  const heartE = power(heart, fs);
  const roomE = power(bandpass(input.chest, rLo, rHi, fs), fs);
  const totalE = power(run(input.chest, biquad("highpass", 10, fs)), fs);
  const heartE0 = power(bandpass(input.baseline, hLo, hHi, fs), fs);
  const roomE0 = power(bandpass(input.baseline, rLo, rHi, fs), fs);
  m.heartBandGain = heartE / (heartE0 + eps);
  m.roomBandGain = roomE / (roomE0 + eps);
  m.heartBandShare = heartE / (totalE + eps);
  if (m.roomBandGain > cfg.maxRoomBandGain) return fail("noisy", `Room sound got louder on the chest (${m.roomBandGain.toFixed(1)}x > ${cfg.maxRoomBandGain}x): talking or TV`);
  if (m.heartBandGain < cfg.minHeartBandGain) return fail("not_on_chest", `Low sound barely changed (${m.heartBandGain.toFixed(1)}x < ${cfg.minHeartBandGain}x)`);
  if (m.heartBandShare < cfg.minHeartBandShare) return fail("not_on_chest", `Only ${(m.heartBandShare * 100).toFixed(0)}% of the sound is low and deep (< ${cfg.minHeartBandShare * 100}%)`);

  // 3. beat envelope at 100 Hz
  const envRate = 100, block = Math.max(1, Math.round(fs / envRate));
  const n = Math.floor(heart.length / block), raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < block; j++) s += Math.abs(heart[i * block + j]); raw[i] = s / block; }
  const sm = boxcar(raw, 5), slow = boxcar(raw, 150);
  const env = Array.from(sm, (v, i) => v - slow[i]).slice(20); // skip filter settling
  let e0 = 0; for (const v of env) e0 += v * v;
  const minLag = Math.round((60 / cfg.maxBpm) * envRate), maxLag = Math.round((60 / cfg.minBpm) * envRate);
  let bestLag = 0, best = -1;
  for (let lag = minLag; lag <= maxLag && lag < env.length; lag++) {
    let s = 0; for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    const r = s / (e0 + eps);
    if (r > best) { best = r; bestLag = lag; }
  }
  m.periodicity = best;
  if (best < cfg.minPeriodicity) return fail("no_rhythm", `No repeating beat (rhythm score ${best.toFixed(2)} < ${cfg.minPeriodicity})`);

  // 4. individual beats: tallest peaks at least 0.6 period apart
  const height = mean(env) + 0.5 * stdOf(env), minGap = Math.round(bestLag * 0.6);
  const cands: number[] = [];
  for (let i = 1; i < env.length - 1; i++) if (env[i] > height && env[i] >= env[i - 1] && env[i] > env[i + 1]) cands.push(i);
  cands.sort((a, b) => env[b] - env[a]);
  const kept: number[] = [];
  for (const c of cands) if (kept.every((k) => Math.abs(k - c) >= minGap)) kept.push(c);
  kept.sort((a, b) => a - b);
  m.beats = kept.length;
  if (kept.length < cfg.minBeats) return fail("no_rhythm", `Only ${kept.length} beats found (need ${cfg.minBeats})`);

  const ibi = kept.slice(1).map((k, i) => (k - kept[i]) / envRate);
  const med = median(ibi);
  m.intervalCv = stdOf(ibi) / mean(ibi);
  m.intervalOutliers = ibi.filter((x) => Math.abs(x - med) / med > 0.3).length / ibi.length;
  if (m.intervalOutliers > cfg.maxIntervalOutliers || m.intervalCv > cfg.maxIntervalCv) {
    return fail("noisy", `Beats are uneven (variation ${(m.intervalCv * 100).toFixed(0)}%, ${(m.intervalOutliers * 100).toFixed(0)}% off-beat)`);
  }
  const bpm = 60 / med;
  if (bpm < cfg.minBpm || bpm > cfg.maxBpm) return fail("no_rhythm", `Rate ${bpm.toFixed(0)}/min is outside ${cfg.minBpm}–${cfg.maxBpm}`);
  return { ok: true, bpm: Math.round(bpm), metrics: m };
}
