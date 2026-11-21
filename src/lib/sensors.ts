// Collects DeviceMotion samples for a fixed duration.
import { DeviceMotion } from "expo-sensors";
import type { MotionSample } from "./signal";

export async function motionAvailable(): Promise<boolean> {
  try {
    if (!(await DeviceMotion.isAvailableAsync())) return false;
    const p = await DeviceMotion.requestPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

/** Record motion for `seconds`; onTick reports elapsed seconds. Returns a stop() handle and a promise of samples. */
export function recordMotion(seconds: number, intervalMs: number, onTick?: (elapsed: number, latest: MotionSample) => void) {
  const samples: MotionSample[] = [];
  const t0 = Date.now();
  let resolveFn: (s: MotionSample[]) => void = () => {};
  const done = new Promise<MotionSample[]>((r) => (resolveFn = r));
  DeviceMotion.setUpdateInterval(intervalMs);
  const sub = DeviceMotion.addListener((m) => {
    const t = Date.now() - t0;
    const s: MotionSample = {
      t,
      g: m.accelerationIncludingGravity ?? { x: 0, y: 0, z: 0 },
      a: m.acceleration ?? null,
    };
    samples.push(s);
    onTick?.(t / 1000, s);
    if (t >= seconds * 1000) finish();
  });
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    sub.remove();
    resolveFn(samples);
  }
  return { done, stop: finish };
}
