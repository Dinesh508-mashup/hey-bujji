// Health suggestions for the family, worked out from Amma's own check results and age.
// Plain, fixed rules (no AI), so every suggestion can show exactly why it appears.
// General wellness tips only: not a diagnosis, and every food/vitamin idea says to check with her doctor.
// Pure functions (no React Native imports) so they can be tested.

import { chairStandBelowAverage } from "./signal.ts";

export type Ev = { type: string; details: Record<string, unknown>; created_at: string; sample?: boolean };
export type Level = "good" | "watch" | "doctor";
export type Suggestion = {
  id: string;
  level: Level;
  area: string;          // "Legs & knees", "Breathing", ...
  title: string;
  why: string;           // the reading behind it
  tips: string[];
  food: string[];
  task?: { kind: "medicine" | "breathing" | "chair_stand" | "memory" | "walk" | "call" | "custom"; title: string; time: string | null; note: string | null };
};

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
const latest = (evs: Ev[], type: string, field: string) => evs.find((e) => e.type === type && num(e.details?.[field]) !== null);
const days = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
const when = (iso: string, now: Date) => { const d = days(iso, now); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

/** events: newest first. */
export function healthSuggestions(events: Ev[], age: number, now = new Date(), sex: "female" | "male" = "female"): Suggestion[] {
  const out: Suggestion[] = [];
  const recent = events.filter((e) => days(e.created_at, now) <= 30);

  // ---- legs & knees (chair stand, CDC STEADI 30-second chair stand)
  const chair = latest(recent, "chair_stand", "stands");
  if (chair) {
    const n = num(chair.details.stands)!;
    const below = chair.details.below_average === true || chairStandBelowAverage(n, age, sex);
    out.push(below ? {
      id: "legs", level: "watch", area: "Legs & knees",
      title: "Leg strength is below average for her age",
      why: `${n} chair stands in 30 s (${when(chair.created_at, now)}); the CDC STEADI average for a ${age}-year-old woman is higher. Weak legs and knee pain raise the risk of falls.`,
      tips: ["Practise sit-to-stand from a firm chair, 2 sets of 5, holding the armrest if needed", "A short daily walk on flat ground", "If her knees hurt when standing up, mention it to her doctor"],
      food: ["Calcium: milk, curd, buttermilk, ragi, sesame (til)", "Vitamin D: 15 minutes of morning sunlight; ask the doctor whether a vitamin D test is due", "Protein for muscle: dal, eggs, paneer, sprouts at each meal"],
      task: { kind: "chair_stand", title: "Chair stand practice", time: "10:00", note: "Firm chair, hold the armrest, 2 × 5 slowly" },
    } : {
      id: "legs", level: "good", area: "Legs & knees",
      title: "Leg strength looks fine",
      why: `${n} chair stands in 30 s (${when(chair.created_at, now)}), at or above the average for her age.`,
      tips: ["Keep up daily walking to hold on to it"], food: [],
    });
  }

  // ---- steps (from walks Amma finished)
  const walks = recent.filter((e) => e.type === "task_done" && num(e.details?.steps) !== null && days(e.created_at, now) <= 7);
  const avgSteps = walks.length ? Math.round(walks.reduce((s, e) => s + num(e.details.steps)!, 0) / walks.length) : null;
  if (avgSteps === null || avgSteps < 2000) {
    out.push({
      id: "steps", level: "watch", area: "Daily movement",
      title: avgSteps === null ? "No walks recorded this week" : "Walks are short",
      why: avgSteps === null ? "No walk with a step count in the last 7 days." : `About ${avgSteps.toLocaleString("en-IN")} steps per walk this week.`,
      tips: ["A 15-minute walk after the evening tea", "Walk with someone, or call family while walking"],
      food: ["Water: a glass after the walk; older adults often drink too little"],
      task: { kind: "walk", title: "Evening walk, 15 minutes", time: "17:30", note: "Flat road, comfortable footwear" },
    });
  } else {
    out.push({ id: "steps", level: "good", area: "Daily movement", title: "Walking well", why: `About ${avgSteps.toLocaleString("en-IN")} steps per walk this week.`, tips: ["Keep the daily walk going"], food: [] });
  }

  // ---- breathing (resting rate)
  const br = latest(recent, "breathing", "bpm");
  if (br) {
    const b = Math.round(num(br.details.bpm)!);
    const level: Level = b > 24 || b < 10 ? "doctor" : b > 20 || b < 12 ? "watch" : "good";
    out.push({
      id: "breathing", level, area: "Breathing",
      title: level === "good" ? "Resting breathing is in the usual range" : level === "doctor" ? "Resting breathing is outside the usual range" : "Resting breathing is a little high",
      why: `${b} breaths a minute at rest (${when(br.created_at, now)}); about 12–20 is usual for adults.`,
      tips: level === "good" ? ["Repeat the check once a week to watch the trend"]
        : level === "doctor" ? ["Please show this to her doctor, especially if she feels breathless", "Repeat the check lying still to confirm"]
        : ["Repeat the check tomorrow, lying still and calm", "Slow-breathing practice: in for 4, out for 6, for 5 minutes"],
      food: [],
      task: level === "good" ? undefined : { kind: "breathing", title: "Breathing check", time: "19:00", note: "Lie down, phone flat on chest, 60 seconds" },
    });
  } else {
    out.push({
      id: "breathing", level: "watch", area: "Breathing", title: "No breathing check yet",
      why: "No breathing check in the last 30 days.", tips: ["A weekly 60-second check shows the trend"], food: [],
      task: { kind: "breathing", title: "Breathing check", time: "19:00", note: "Lie down, phone flat on chest, 60 seconds" },
    });
  }

  // ---- heart rate (wellness check)
  const hr = latest(recent, "heart_rate", "bpm");
  if (hr) {
    const h = Math.round(num(hr.details.bpm)!);
    const level: Level = h > 110 || h < 45 ? "doctor" : h > 100 || h < 50 ? "watch" : "good";
    out.push({
      id: "heart", level, area: "Heart rate",
      title: level === "good" ? "Resting heart rate is in the usual range" : "Resting heart rate is outside the usual range",
      why: `${h} beats a minute (${when(hr.created_at, now)}); 60–100 is usual at rest. Phone wellness check, not an ECG.`,
      tips: level === "good" ? ["Keep taking her BP tablet on time"] : ["Re-check after 10 minutes of rest", "Show the reading to her doctor, with her BP readings"],
      food: level === "good" ? [] : ["Less salt and pickles; more fruit and vegetables (potassium) unless her doctor says otherwise"],
    });
  }

  // ---- memory (3-word recall)
  const mem = latest(recent, "memory", "score");
  if (mem) {
    const m = num(mem.details.score)!;
    const level: Level = m <= 1 ? "doctor" : m === 2 ? "watch" : "good";
    out.push({
      id: "memory", level, area: "Memory",
      title: level === "good" ? "Remembered all 3 words" : `Remembered ${m} of 3 words`,
      why: `3-word recall ${when(mem.created_at, now)}. One low score is common; a falling trend over weeks is worth raising with a doctor.`,
      tips: level === "good" ? ["Keep her talking and doing puzzles"] : ["Daily short conversation calls with family", "Simple puzzles, reading aloud, old songs", ...(level === "doctor" ? ["Mention it at her next doctor visit"] : [])],
      food: level === "good" ? [] : ["Nuts, leafy greens, fish or flax seeds; ask the doctor whether her B12 should be checked"],
      task: level === "good" ? undefined : { kind: "memory", title: "Memory check", time: "11:00", note: "3 words, every few days" },
    });
  }

  // ---- age-based general note
  if (age >= 60) {
    out.push({
      id: "age", level: "good", area: `General, age ${age}`,
      title: "Routine checks worth asking about",
      why: `At ${age}, vitamin D and B12 are often low in older Indian adults, and thirst signals weaken.`,
      tips: ["Ask her doctor if a vitamin D, B12 and HbA1c test is due", "Keep a water bottle near her chair"],
      food: ["No vitamin tablets without her doctor's advice (they can interact with BP and sugar medicines)"],
    });
  }

  const order: Record<Level, number> = { doctor: 0, watch: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
