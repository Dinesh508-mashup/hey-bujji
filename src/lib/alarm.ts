// When does a task from Ravi ring, and what countdown does Amma see? Pure functions
// (no React Native imports) so they can be tested.

export const RING_WINDOW_MIN = 60; // keep ringing for up to 60 min after the set time if not stopped

type T = { time: string | null; last_done_at: string | null };

const dayKey = (d: Date) => d.toDateString();

/** Milliseconds from `now` to today's set time (negative once it has passed). Null if the task has no time. */
export function msUntil(t: T, now: Date): number | null {
  if (!t.time) return null;
  const [h, m] = t.time.split(":").map(Number);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  return at.getTime() - now.getTime();
}

export function doneToday(t: T, now: Date) {
  return !!t.last_done_at && dayKey(new Date(t.last_done_at)) === dayKey(now);
}

/** Ring if the set time has come (within the window), it isn't done, and Amma hasn't stopped it today. */
export function shouldRing(t: T, now: Date, stoppedToday: boolean): boolean {
  const ms = msUntil(t, now);
  if (ms === null || doneToday(t, now) || stoppedToday) return false;
  return ms <= 0 && -ms < RING_WINDOW_MIN * 60_000;
}

/** "in 1 h 20 min", "in 45 s", "now", "8 min ago". */
export function countdownLabel(ms: number): string {
  if (Math.abs(ms) < 60_000 && ms > 0) return `in ${Math.ceil(ms / 1000)} s`;
  if (ms <= 0 && ms > -60_000) return "now";
  const mins = Math.round(Math.abs(ms) / 60_000);
  const h = Math.floor(mins / 60), m = mins % 60;
  const span = h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  return ms > 0 ? `in ${span}` : `${span} ago`;
}
