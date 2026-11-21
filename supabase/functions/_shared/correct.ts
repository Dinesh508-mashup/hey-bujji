// The Hey Bujji correction step: runs on the raw transcript before the LLM.
//  1. medicine names (fuzzy, across scripts) and "BP tablet" -> the parent's BP medicine
//  2. contact nicknames (abbayi, babu, beta -> Ravi)
//  3. time normaliser (raatri 8 -> 20:00, shaam 7 baje -> 19:00, enimidinnara -> 08:30)
//  4. red-flag and scam phrases, as a safety net under the LLM

import { levenshtein, phoneticKey, tokenize } from "./translit.ts";
import {
  ALL_WORDS, COMMON_MEDICINES, type Family, type Medicine, NAME_SUFFIXES, PILL_WORDS, PURPOSE_WORDS,
} from "./lexicon.ts";

export type Symptom = "chest_pain" | "breathlessness" | "dizziness";

export type Fix = { kind: "medicine" | "contact" | "time"; heard: string; fixed: string };

export type Correction = {
  /** Transcript with corrected names, plus a normalised summary line. */
  text: string;
  medicine: string | null;
  time: string | null;
  contact: string | null;
  symptom: Symptom | null;
  scam: boolean;
  moneySent: boolean;
  language: "te" | "hi" | "en";
  fixes: Fix[];
};

type Tok = { raw: string; key: string };

// ---------- helpers ----------

const keyList = (words: string[]) => words.map(phoneticKey).filter(Boolean);

/** Does a token key "start with" a word key (allowing glued case markers)? */
function startsWithWord(tokKey: string, wordKey: string): boolean {
  if (!wordKey) return false;
  if (wordKey.length <= 3) return tokKey === wordKey || NAME_SUFFIXES.some((s) => tokKey === wordKey + phoneticKey(s));
  return tokKey.startsWith(wordKey);
}

/**
 * Find a phrase: a sequence of word groups, each group a list of alternatives,
 * with up to `gap` unrelated tokens between groups. Returns [start, end) or null.
 */
function findPhrase(toks: Tok[], groups: string[][], gap = 2): [number, number] | null {
  const gk = groups.map(keyList);
  for (let start = 0; start < toks.length; start++) {
    if (!gk[0].some((w) => startsWithWord(toks[start].key, w))) continue;
    let pos = start;
    let ok = true;
    for (let g = 1; g < gk.length; g++) {
      let found = -1;
      for (let j = pos + 1; j <= Math.min(toks.length - 1, pos + 1 + gap); j++) {
        if (gk[g].some((w) => startsWithWord(toks[j].key, w))) { found = j; break; }
      }
      if (found < 0) { ok = false; break; }
      pos = found;
    }
    if (ok) return [start, pos + 1];
  }
  return null;
}

// ---------- medicines ----------

type MedCandidate = { name: string; key: string; family: boolean };

function medicineCandidates(family: Family): MedCandidate[] {
  const out: MedCandidate[] = [];
  const familyNames = new Set(family.medicines.map((m) => m.name.toLowerCase()));
  const add = (m: Medicine, isFamily: boolean) => {
    for (const v of [m.name, ...m.variants]) {
      const key = phoneticKey(v);
      if (key.length >= 3) out.push({ name: m.name, key, family: isFamily });
    }
  };
  family.medicines.forEach((m) => add(m, true));
  COMMON_MEDICINES.forEach((m) => add(m, familyNames.has(m.name.toLowerCase())));
  return out;
}

function stripSuffix(key: string): string[] {
  const out = [key];
  for (const s of NAME_SUFFIXES) {
    const sk = phoneticKey(s);
    if (sk && key.endsWith(sk) && key.length - sk.length >= 4) out.push(key.slice(0, -sk.length));
  }
  return out;
}

// Everyday words that sit within a couple of letters of a brand name
// ("tablet" ~ "Rablet"): these only ever match exactly, never fuzzily.
const NO_FUZZY = new Set(keyList([
  ...PILL_WORDS, ...ALL_WORDS, ...Object.values(PURPOSE_WORDS).flat(),
  "morning", "evening", "teesukunna", "vesukunna", "cheyyi", "gurthu", "remind", "insurance", "minute", "minutes",
]));

function matchMedicine(toks: Tok[], family: Family): { name: string; span: [number, number] } | null {
  const cands = medicineCandidates(family);
  let best: { name: string; span: [number, number]; score: number } | null = null;
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      const joined = toks.slice(i, i + n).map((t) => t.key).join("");
      if (joined.length < 3) continue;
      for (const variantKey of stripSuffix(joined)) {
        for (const c of cands) {
          let score: number | null = null;
          if (variantKey === c.key) score = 0;
          else if (c.key.length >= 6 && !NO_FUZZY.has(variantKey) && !toks.slice(i, i + n).some((t) => NO_FUZZY.has(t.key))) {
            const d = levenshtein(variantKey, c.key);
            const allowed = Math.min(3, Math.max(1, Math.floor(c.key.length * 0.25)));
            if (d <= allowed) score = d / c.key.length;
          }
          if (score === null) continue;
          score -= c.family ? 0.05 : 0; // prefer the parent's own medicines
          score -= n * 0.001; // prefer longer spans on ties
          if (!best || score < best.score) best = { name: c.name, span: [i, i + n], score };
        }
      }
    }
  }
  return best ? { name: best.name, span: best.span } : null;
}

function matchPurpose(toks: Tok[], family: Family): { name: string; span: [number, number] } | null {
  for (const [purpose, words] of Object.entries(PURPOSE_WORDS)) {
    const med = family.medicines.find((m) => m.purpose === purpose);
    if (!med) continue;
    for (const w of words) {
      const parts = w.split(" ");
      const span = findPhrase(toks, parts.map((p) => [p]), 0);
      if (!span) continue;
      // swallow a following "tablet/goli" into the span so the fix reads well
      let end = span[1];
      if (end < toks.length && keyList(PILL_WORDS).some((p) => startsWithWord(toks[end].key, p))) end++;
      return { name: med.name, span: [span[0], end] };
    }
  }
  return null;
}

// ---------- contacts ----------

function matchContact(toks: Tok[], family: Family): { name: string; index: number } | null {
  const forms = family.contacts.flatMap((c) =>
    [c.name, ...c.nicknames].map(phoneticKey).filter((k) => k.length >= 3)
      .flatMap((nk) => NAME_SUFFIXES.map((s) => ({ name: c.name, nk, target: nk + phoneticKey(s) }))));
  // exact pass first: "ammayi" must never be pulled to "abbayi" by fuzziness
  for (let i = 0; i < toks.length; i++) {
    const hit = forms.find((f) => toks[i].key === f.target);
    if (hit) return { name: hit.name, index: i };
  }
  // fuzzy pass: one edit away, and only if a single contact is that close
  for (let i = 0; i < toks.length; i++) {
    const close = forms.filter((f) => f.nk.length >= 5 && levenshtein(toks[i].key, f.target) <= 1);
    const names = new Set(close.map((f) => f.name));
    if (names.size === 1) return { name: close[0].name, index: i };
  }
  return null;
}

// ---------- time ----------

const TE_NUM: Record<string, number> = {
  okati: 1, okka: 1, rendu: 2, moodu: 3, mudu: 3, naalugu: 4, nalugu: 4, aidu: 5, ayidu: 5,
  aaru: 6, aru: 6, edu: 7, yedu: 7, enimidi: 8, yenimidi: 8, enmidi: 8, tommidi: 9, thommidi: 9,
  padi: 10, padakondu: 11, pannendu: 12,
};
const HI_NUM: Record<string, number> = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, che: 6,
  saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, das: 10, gyarah: 11, gyara: 11, barah: 12, bara: 12,
};
const EN_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const NUM_KEYS: [string, number][] = Object.entries({ ...TE_NUM, ...HI_NUM, ...EN_NUM })
  .map(([w, n]) => [phoneticKey(w), n] as [string, number]);

type Period = "morning" | "afternoon" | "evening" | "night";
const PERIODS: Record<Period, string[]> = {
  morning: ["udayam", "udaya", "podduna", "poddhuna", "proddhuna", "subah", "subha", "morning", "pratah"],
  afternoon: ["madhyahnam", "madhyanam", "madhyaanam", "madhyahnam", "dopahar", "dupahar", "afternoon", "noon"],
  evening: ["saayantram", "sayantram", "saayankalam", "sayankalam", "saayantaram", "shaam", "sham", "evening"],
  night: ["raatri", "ratri", "rathri", "ratiri", "raat", "rat", "night", "tonight"],
};
const MARKERS = keyList(["ki", "ku", "ke", "ko", "baje", "bajey", "gantalaku", "gantaki", "ganta", "gantalu", "oclock", "o'clock", "pm", "am", "ka", "tak", "lopu"]);
const HALF_SUFFIX = keyList(["innara", "nnara", "nara", "arra", "ara", "nnar"]);

function periodOf(key: string): Period | null {
  for (const [p, words] of Object.entries(PERIODS) as [Period, string[]][]) {
    for (const w of keyList(words)) {
      if (w.length <= 3 ? key === w || key === w + "i" || key === w + "ki" || key === w + "ko" : key.startsWith(w)) return p;
    }
  }
  return null;
}

function numberOf(key: string): { n: number; half: boolean } | null {
  for (const [nk, n] of NUM_KEYS) {
    if (key === nk) return { n, half: false };
    if (nk.length >= 4 || ["ek", "do", "das", "nau"].includes(nk)) {
      for (const s of MARKERS) if (key === nk + s) return { n, half: false };
    }
    if (nk.length >= 3) for (const h of HALF_SUFFIX) if (key.startsWith(nk + h)) return { n, half: true };
  }
  return null;
}

export function normaliseTime(toks: Tok[]): { time: string; span: [number, number] } | null {
  let period: Period | null = null;
  let periodIdx = -1;
  let ampm: "am" | "pm" | null = null;
  toks.forEach((t, i) => {
    const p = periodOf(t.key);
    if (p && !period) { period = p; periodIdx = i; }
    if (t.raw.toLowerCase().replace(/\./g, "") === "pm") ampm = "pm";
    if (t.raw.toLowerCase().replace(/\./g, "") === "am") ampm = "am";
  });

  // digits first ("at 8:30 pm" must not read "at" as Hindi "aath")
  const order = [...toks.keys()].sort((a, b) => Number(!/\d/.test(toks[a].raw)) - Number(!/\d/.test(toks[b].raw)) || a - b);
  for (const i of order) {
    const raw = toks[i].raw.toLowerCase();
    let h: number | null = null;
    let m = 0;
    let explicitMinutes = false;
    let isWord = false;

    const clock = raw.match(/^(\d{1,2})[:.](\d{2})$/);
    if (clock) { h = +clock[1]; m = +clock[2]; explicitMinutes = true; }
    else if (/^\d{1,2}$/.test(raw)) h = +raw;
    else {
      const num = numberOf(toks[i].key);
      if (num) { h = num.n; isWord = true; if (num.half) { m = 30; explicitMinutes = true; } }
    }
    if (h === null || h > 24) continue;

    const next = toks[i + 1]?.key ?? "";
    const next2 = toks[i + 2]?.key ?? "";
    const prev = toks[i - 1]?.key ?? "";
    const hasMarker = MARKERS.includes(next) || MARKERS.includes(next2) || MARKERS.some((mk) => toks[i].key.endsWith(mk) && isWord);
    const nearPeriod = periodIdx >= 0 && Math.abs(periodIdx - i) <= 3;
    if (!(hasMarker || nearPeriod || explicitMinutes || ampm)) continue;
    if (isWord && !(hasMarker || nearPeriod)) continue;
    // short words that are also English/Telugu words (at, do, sat, che) need "baje" right after
    if (isWord && toks[i].key.length <= 3 && !["baje", "baj", "bje"].map(phoneticKey).includes(next)) continue;

    // Hindi fractions: sade 8 = 8:30, sava 8 = 8:15, paune 8 = 7:45, dedh = 1:30, dhai = 2:30
    if (["sade", "saade"].map(phoneticKey).includes(prev)) m = 30;
    if (["sava", "savaa"].map(phoneticKey).includes(prev)) m = 15;
    if (["paune", "pone"].map(phoneticKey).includes(prev)) { h = h - 1; m = 45; }
    if (["arra", "ara", "nnara"].map(phoneticKey).includes(next)) m = 30;

    if (h <= 12) {
      if (ampm === "pm" && h < 12) h += 12;
      else if (ampm === "am" && h === 12) h = 0;
      else if (!ampm) {
        if (period === "afternoon" && h < 12) h += h <= 6 ? 12 : 0;
        else if (period === "evening" && h < 12) h += 12;
        else if (period === "night") { if (h >= 6 && h < 12) h += 12; else if (h === 12) h = 0; }
        else if (!period && h >= 1 && h <= 5) h += 12; // "4 baje" with no period: afternoon
      }
    }
    const start = Math.min(i, periodIdx >= 0 && nearPeriod ? periodIdx : i);
    const end = Math.max(i + 1, periodIdx >= 0 && nearPeriod ? periodIdx + 1 : i + 1);
    return { time: `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`, span: [start, end] };
  }

  // Word-only fallback: "dedh baje", "dhai baje"
  for (let i = 0; i < toks.length; i++) {
    const k = toks[i].key;
    const hasMarker = MARKERS.includes(toks[i + 1]?.key ?? "");
    if (!hasMarker) continue;
    if (k === phoneticKey("dedh")) return { time: "13:30", span: [i, i + 1] };
    if (k === phoneticKey("dhai")) return { time: "14:30", span: [i, i + 1] };
  }
  return null;
}

// ---------- red flags and scams ----------

const SYMPTOM_PHRASES: [Symptom, string[][], number][] = [
  ["chest_pain", [["chest", "chaati", "chati", "gunde", "gunda", "seene", "seena", "sina", "heart", "chhati", "chhaati", "ఛాతీ"], ["noppi", "noppiga", "nopi", "dard", "pain", "baadha", "bhaari"]], 2],
  ["chest_pain", [["chest pain", "chestpain"]], 0],
  ["breathlessness", [["usuru", "uusuru", "swasa", "shwasa", "svasa", "saans", "sans", "breath", "breathing", "oopiri", "upiri"], ["aadatledu", "adatledu", "aadatla", "aadadam", "ravatledu", "raavatledu", "nahi", "nahin", "phool", "fool", "problem", "kashtam", "ledu", "difficult", "taklif", "takleef"]], 2],
  ["breathlessness", [["breathless", "breathlessness", "dum", "aayasam", "ayasam", "aayasamga"]], 0],
  ["dizziness", [["kallu", "kalu", "tala", "thala", "sir", "head"], ["tirugutunnayi", "tiruguthunnayi", "thiruguthunnayi", "tirugu", "thirugu", "ghoom", "ghum", "spinning", "chakkar"]], 2],
  ["dizziness", [["chakkar", "dizzy", "dizziness", "kallutirugu", "giddiness", "giddy", "behosh"]], 0],
];

const SCAM_PHRASES: string[][][] = [
  [["otp", "o t p", "ఓటీపీ", "ओटीपी"]],
  [["kyc", "k y c", "kayc"]],
  [["police", "polisu", "poleesu", "cbi", "customs", "court", "arrest", "digital"], ["dabbulu", "money", "paise", "paisa", "fine", "arrest", "case", "bayapedut", "dhamki", "darr"]],
  [["police", "polisu"], ["ani", "bolke", "bolkar"]],
  [["link", "lnk", "linku"]],
  [["lottery", "lotteri", "prize", "inaam", "bahumati", "gift", "parcel", "parsel"]],
  [["bank", "baank", "banku", "bank nundi"], ["call", "phone", "fon", "kaal", "message", "sms"]],
  [["account", "khata", "card", "atm"], ["block", "band", "close", "suspend", "expire"]],
  [["dabbulu", "dabbu", "paise", "paisa", "money", "amount"], ["adugutunnaru", "adigaru", "adugutunnadu", "maang", "maange", "mang", "ask", "pampamannaru", "bhejo"]],
  [["pin", "cvv", "password"]],
];

const MONEY_SENT_PHRASES: string[][][] = [
  [["dabbulu", "dabbu", "money", "paise", "paisa", "amount", "rupees", "rupaayalu", "rs"], ["pampesanu", "pampesa", "pampanu", "pampinchanu", "pampinchesanu", "bhej", "sent", "transfer", "kattesanu", "kattanu", "ichesanu", "icchesanu", "ichanu", "diye", "diya", "paid"]],
  [["pampesanu", "pampinchesanu", "transfer chesanu", "already paid", "bhej diye", "bhej diya", "de diye", "kat gaye", "cut ayyayi", "poyayi"]],
];

function hasAny(toks: Tok[], phrases: string[][][], gap = 3): boolean {
  return phrases.some((groups) => {
    // single-group entries may contain multi-word alternatives ("bhej diye")
    if (groups.length === 1) {
      return groups[0].some((alt) => findPhrase(toks, alt.split(" ").map((w) => [w]), 0) !== null);
    }
    return findPhrase(toks, groups, gap) !== null;
  });
}

// ---------- language ----------

const HI_MARKERS = keyList(["hai", "hain", "mein", "mujhe", "maine", "ko", "baje", "lagao", "dilana", "dilaao", "le", "li", "liya", "liye", "kar", "karo", "do", "nahi", "raha", "rahi", "shaam", "subah", "raat", "dawai", "goli", "ka", "ki", "se", "aur", "mera", "meri"]);
const TE_MARKERS = keyList(["cheyyi", "cheyandi", "lo", "undi", "nundi", "adigaru", "teesukunna", "vesukunna", "gurthu", "raatri", "saayantram", "naa", "ku", "anni", "ayipoyayi", "kalupu", "noppi", "ga", "ani", "cheppi", "ledu", "amma", "abbayi", "ammayi", "gantalaku", "pampincharu"]);

export function detectLanguage(text: string, toks: Tok[]): "te" | "hi" | "en" {
  if (/[ఀ-౿]/.test(text)) return "te";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  let hi = 0, te = 0;
  for (const t of toks) {
    if (HI_MARKERS.includes(t.key)) hi++;
    if (TE_MARKERS.includes(t.key)) te++;
  }
  if (hi === 0 && te === 0) return "te"; // Amma's default
  return hi > te ? "hi" : "te";
}

// ---------- main ----------

export function correct(transcript: string, family: Family): Correction {
  const toks: Tok[] = tokenize(transcript).map((raw) => ({ raw, key: phoneticKey(raw) }));
  const replaced: (string | null)[] = toks.map((t) => t.raw);
  const fixes: Fix[] = [];

  const applyFix = (kind: Fix["kind"], span: [number, number], fixed: string) => {
    const heard = toks.slice(span[0], span[1]).map((t) => t.raw).join(" ");
    if (phoneticKey(heard) !== phoneticKey(fixed)) fixes.push({ kind, heard, fixed });
    replaced[span[0]] = fixed;
    for (let k = span[0] + 1; k < span[1]; k++) replaced[k] = null;
  };

  // 1. medicines
  let medicine: string | null = null;
  const explicit = matchMedicine(toks, family);
  const allSpan = findPhrase(toks, [PILL_WORDS, ALL_WORDS], 2) ?? findPhrase(toks, [ALL_WORDS, PILL_WORDS], 2);
  if (explicit) {
    medicine = explicit.name;
    applyFix("medicine", explicit.span, explicit.name);
  } else if (allSpan) {
    medicine = "all";
  } else {
    const byPurpose = matchPurpose(toks, family);
    if (byPurpose) {
      medicine = byPurpose.name;
      const heard = toks.slice(byPurpose.span[0], byPurpose.span[1]).map((t) => t.raw).join(" ");
      fixes.push({ kind: "medicine", heard, fixed: byPurpose.name });
      replaced[byPurpose.span[0]] = `${heard} (${byPurpose.name})`;
      for (let k = byPurpose.span[0] + 1; k < byPurpose.span[1]; k++) replaced[k] = null;
    }
  }

  // 2. contacts
  let contact: string | null = null;
  const c = matchContact(toks, family);
  if (c) {
    contact = c.name;
    const rel = family.contacts.find((x) => x.name === c.name)?.relation;
    if (phoneticKey(toks[c.index].raw) !== phoneticKey(c.name)) {
      fixes.push({ kind: "contact", heard: toks[c.index].raw, fixed: c.name });
      replaced[c.index] = `${c.name}${rel ? ` (${rel})` : ""}`;
    }
  }

  // 3. time
  let time: string | null = null;
  const t = normaliseTime(toks);
  if (t) {
    time = t.time;
    const heard = toks.slice(t.span[0], t.span[1]).map((x) => x.raw).join(" ");
    fixes.push({ kind: "time", heard, fixed: t.time });
  }

  // 4. safety nets
  let symptom: Symptom | null = null;
  for (const [s, groups, gap] of SYMPTOM_PHRASES) {
    const hit = groups.length === 1
      ? groups[0].some((alt) => findPhrase(toks, alt.split(" ").map((w) => [w]), 0) !== null)
      : findPhrase(toks, groups, gap) !== null;
    if (hit) { symptom = s; break; }
  }
  const scam = hasAny(toks, SCAM_PHRASES);
  const moneySent = hasAny(toks, MONEY_SENT_PHRASES);

  const corrected = replaced.filter((x): x is string => x !== null).join(" ");
  const facts = [
    medicine && `medicine=${medicine}`,
    time && `time=${time}`,
    contact && `contact=${contact}`,
    symptom && `symptom=${symptom}`,
    scam && "possible_scam=true",
    moneySent && "money_sent=true",
  ].filter(Boolean);
  const text = facts.length ? `${corrected}\n[normalised: ${facts.join("; ")}]` : corrected;

  return { text, medicine, time, contact, symptom, scam, moneySent, language: detectLanguage(transcript, toks), fixes };
}
