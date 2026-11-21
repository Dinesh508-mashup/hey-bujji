// Pure signal processing for the motion-sensor checks. No React Native imports,
// so it runs under `node --test` with synthetic data.

export type Vec = { x: number; y: number; z: number };
export type MotionSample = { t: number; g: Vec; a: Vec | null }; // t in ms; g = acceleration incl. gravity; a = user acceleration

export function movingAverage(xs: number[], win: number): number[] {
  if (win <= 1) return xs.slice();
  const out: number[] = new Array(xs.length);
  let sum = 0;
  const q: number[] = [];
  const half = Math.floor(win / 2);
  // centred window
  const pad = (i: number) => xs[Math.min(xs.length - 1, Math.max(0, i))];
  for (let i = -half; i < xs.length + half; i++) {
    const v = pad(i);
    q.push(v);
    sum += v;
    if (q.length > win) sum -= q.shift()!;
    const c = i - half;
    if (c >= 0 && c < xs.length) out[c] = sum / q.length;
  }
  return out;
}

export function std(xs: number[]): number {
  if (!xs.length) return 0;
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
}

function sampleRate(samples: { t: number }[]): number {
  if (samples.length < 2) return 20;
  return (samples.length - 1) / ((samples[samples.length - 1].t - samples[0].t) / 1000);
}

/** Count peaks with hysteresis: a peak is counted when the signal rises above +th and then falls below -th. */
export function countCycles(xs: number[], th: number, minGapSamples: number): number[] {
  const peaks: number[] = [];
  let state: "low" | "high" = xs[0] > th ? "high" : "low";
  let maxIdx = 0;
  for (let i = 0; i < xs.length; i++) {
    if (state === "low" && xs[i] > th) { state = "high"; maxIdx = i; }
    else if (state === "high") {
      if (xs[i] > xs[maxIdx]) maxIdx = i;
      if (xs[i] < -th) {
        if (!peaks.length || maxIdx - peaks[peaks.length - 1] >= minGapSamples) peaks.push(maxIdx);
        state = "low";
      }
    }
  }
  return peaks;
}

export type BreathingResult = {
  breathsPerMinute: number;
  breaths: number;
  seconds: number;
  quality: "good" | "noisy" | "too_short";
  axis: "x" | "y" | "z";
  trace: number[]; // downsampled filtered signal for the chart
};

/**
 * Phone lying on the chest: each breath tilts it slightly, which shows up in
 * the gravity component. Detrend (4 s), smooth (0.7 s), count cycles.
 */
export function analyseBreathing(samples: MotionSample[]): BreathingResult {
  const seconds = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0;
  const empty = { breathsPerMinute: 0, breaths: 0, seconds, axis: "z" as const, trace: [] };
  if (seconds < 20) return { ...empty, quality: "too_short" };
  const fs = sampleRate(samples);

  const filtered = (["x", "y", "z"] as const).map((axis) => {
    const raw = samples.map((s) => s.g[axis]);
    const trend = movingAverage(raw, Math.round(fs * 4));
    const detrended = raw.map((v, i) => v - trend[i]);
    return { axis, sig: movingAverage(detrended, Math.max(1, Math.round(fs * 0.7))) };
  });
  // the axis that moves most with breathing
  const best = filtered.reduce((a, b) => (std(b.sig) > std(a.sig) ? b : a));
  const s = std(best.sig);
  const peaks = countCycles(best.sig, s * 0.35, Math.round(fs * 1.5)); // max 40 breaths/min

  // movement check: jerky user acceleration means talking or shifting
  const jerk = samples.filter((x) => x.a).map((x) => Math.hypot(x.a!.x, x.a!.y, x.a!.z));
  const moving = jerk.filter((j) => j > 1.2).length / Math.max(1, jerk.length);
  const bpm = Math.round((peaks.length / seconds) * 60 * 10) / 10;
  const quality = moving > 0.08 || s < 1e-4 || bpm < 4 || bpm > 40 ? "noisy" : "good";

  const step = Math.max(1, Math.floor(best.sig.length / 240));
  return { breathsPerMinute: bpm, breaths: peaks.length, seconds, quality, axis: best.axis, trace: best.sig.filter((_, i) => i % step === 0) };
}

export type ChairStandResult = { stands: number; seconds: number; trace: number[] };

/**
 * Phone held flat against the chest, arms crossed. Vertical acceleration goes
 * up-then-down on each stand (and down-then-up on each sit). Count stands.
 */
export function analyseChairStand(samples: MotionSample[]): ChairStandResult {
  const seconds = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / 1000 : 0;
  if (samples.length < 10) return { stands: 0, seconds, trace: [] };
  const fs = sampleRate(samples);
  const vertical = samples.map((s) => {
    const a = s.a ?? { x: 0, y: 0, z: 0 };
    const grav = { x: s.g.x - a.x, y: s.g.y - a.y, z: s.g.z - a.z };
    const n = Math.hypot(grav.x, grav.y, grav.z) || 1;
    // positive = moving up (against gravity). Gravity vector points down in device frame as reported (+9.8 when face up on iOS uses -z); sign-normalise by projecting onto -gravity
    return -(a.x * grav.x + a.y * grav.y + a.z * grav.z) / n;
  });
  const sig = movingAverage(vertical, Math.max(1, Math.round(fs * 0.3)));
  const th = Math.max(0.6, std(sig) * 0.6);
  const minGap = Math.round(fs * 0.4);

  let stands = 0;
  let lastStand = -Infinity;
  let pending: { sign: 1 | -1; idx: number } | null = null;
  for (let i = 0; i < sig.length; i++) {
    const sign = sig[i] > th ? 1 : sig[i] < -th ? -1 : 0;
    if (!sign) continue;
    // idx = last sample of the current run, so the window measures the gap between runs
    if (!pending || pending.sign === sign) { pending = { sign: sign as 1 | -1, idx: i }; continue; }
    // sign flipped: + then - is a stand, - then + is a sit
    if (pending.sign === 1 && i - pending.idx <= fs * 2 && i - lastStand > minGap * 3) { stands++; lastStand = i; }
    pending = { sign: sign as 1 | -1, idx: i };
  }
  const step = Math.max(1, Math.floor(sig.length / 240));
  return { stands, seconds, trace: sig.filter((_, i) => i % step === 0) };
}

/** CDC STEADI 30-second chair stand: below these counts is "below average" for age. */
export function chairStandBelowAverage(stands: number, age: number, sex: "female" | "male"): boolean {
  const table: [number, number, number][] = [
    // [age from, men below, women below]
    [60, 14, 12], [65, 12, 11], [70, 12, 10], [75, 11, 10], [80, 10, 9], [85, 8, 8], [90, 7, 4],
  ];
  const row = [...table].reverse().find(([from]) => age >= from) ?? table[0];
  return stands < (sex === "male" ? row[1] : row[2]);
}
