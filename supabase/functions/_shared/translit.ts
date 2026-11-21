// Telugu / Devanagari -> rough Latin transliteration, plus a phonetic key.
// Speech models return Telugu script, Devanagari or romanised text for the
// same sentence; everything is folded to one phonetic key before matching.

// Telugu (U+0C00) and Devanagari (U+0900) share the ISCII layout, so one
// table indexed by offset-from-block-start covers both.
const VOWELS: Record<number, string> = {
  0x05: "a", 0x06: "aa", 0x07: "i", 0x08: "ii", 0x09: "u", 0x0a: "uu",
  0x0b: "ru", 0x0c: "lu", 0x0d: "e", 0x0e: "e", 0x0f: "ee", 0x10: "ai",
  0x11: "o", 0x12: "o", 0x13: "oo", 0x14: "au",
};
const CONSONANTS: Record<number, string> = {
  0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng",
  0x1a: "ch", 0x1b: "chh", 0x1c: "j", 0x1d: "jh", 0x1e: "ny",
  0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n",
  0x24: "t", 0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n", 0x29: "n",
  0x2a: "p", 0x2b: "ph", 0x2c: "b", 0x2d: "bh", 0x2e: "m",
  0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "l",
  0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
  // Devanagari nukta letters (क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़)
  0x58: "k", 0x59: "kh", 0x5a: "g", 0x5b: "z", 0x5c: "r", 0x5d: "rh", 0x5e: "f", 0x5f: "y",
};
const MATRAS: Record<number, string> = {
  0x3e: "aa", 0x3f: "i", 0x40: "ii", 0x41: "u", 0x42: "uu", 0x43: "ru",
  0x44: "ruu", 0x45: "e", 0x46: "e", 0x47: "ee", 0x48: "ai",
  0x49: "o", 0x4a: "o", 0x4b: "oo", 0x4c: "au", 0x56: "ai",
};
const VIRAMA = 0x4d;

function blockOf(cp: number): number | null {
  if (cp >= 0x0900 && cp <= 0x097f) return 0x0900;
  if (cp >= 0x0c00 && cp <= 0x0c7f) return 0x0c00;
  return null;
}

/** Transliterate Telugu/Devanagari to lowercase Latin. Latin text passes through. */
export function transliterate(input: string): string {
  const chars = Array.from(input.normalize("NFC"));
  let out = "";
  let pendingSchwa = false; // consonant written, inherent "a" not yet emitted
  let pendingIsDeva = false;

  const flushSchwa = (atWordEnd: boolean) => {
    if (pendingSchwa) {
      // Hindi drops the final inherent vowel ("raam", not "raama").
      if (!(atWordEnd && pendingIsDeva)) out += "a";
      pendingSchwa = false;
    }
  };

  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    const block = blockOf(cp);
    if (block === null) {
      if (cp === 0x200c || cp === 0x200d) continue; // ZWNJ / ZWJ
      flushSchwa(!/[\p{L}\p{M}]/u.test(ch));
      out += ch === "।" || ch === "॥" ? "." : ch;
      continue;
    }
    const off = cp - block;
    const isDeva = block === 0x0900;
    if (off === 0x64 || off === 0x65) { flushSchwa(true); out += "."; continue; }
    if (off >= 0x66 && off <= 0x6f) { flushSchwa(true); out += String(off - 0x66); continue; }
    if (CONSONANTS[off] !== undefined) {
      flushSchwa(false);
      out += CONSONANTS[off];
      pendingSchwa = true;
      pendingIsDeva = isDeva;
      continue;
    }
    if (MATRAS[off] !== undefined) { pendingSchwa = false; out += MATRAS[off]; continue; }
    if (off === VIRAMA) { pendingSchwa = false; continue; }
    if (VOWELS[off] !== undefined) { flushSchwa(false); out += VOWELS[off]; continue; }
    if (off === 0x02 || off === 0x01) { flushSchwa(false); out += "m"; continue; } // anusvara / candrabindu
    if (off === 0x03) { flushSchwa(false); out += "h"; continue; } // visarga
    // nukta and anything else: ignore
  }
  flushSchwa(true);
  return out.toLowerCase();
}

/**
 * Phonetic key: folds spelling variation (aa/a, ee/i, th/t, sh/s, w/v,
 * doubled letters) so "Abbaayiki", "abbayiki" and "అబ్బాయికి" agree.
 */
export function phoneticKey(input: string): string {
  let s = transliterate(input).toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, "");
  s = s.replace(/ph/g, "f").replace(/([kgcjtdbs])h/g, "$1").replace(/z/g, "j")
    .replace(/w/g, "v").replace(/q/g, "k").replace(/x/g, "ks").replace(/ck/g, "k")
    .replace(/ee/g, "i").replace(/oo/g, "u").replace(/ou/g, "u")
    // anusvara written as "m" before a consonant sounds like "n"
    .replace(/m(?=[kgcjtdnpb])/g, "n");
  s = s.replace(/(.)\1+/g, "$1");
  return s;
}

/** Split text into word tokens, separating digits glued to script suffixes ("8కి" -> "8", "కి"). */
export function tokenize(input: string): string[] {
  return input
    .replace(/(\d)([^\d\s:.])/gu, "$1 $2")
    .replace(/([^\d\s:.])(\d)/gu, "$1 $2")
    .split(/[\s,!?;"'()।॥\-]+/u)
    .map((t) => t.replace(/^[.:]+|[.:]+$/g, ""))
    .filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Character error rate between two strings after transliteration (spaces ignored). */
export function charErrorRate(reference: string, hypothesis: string): number {
  const norm = (s: string) => transliterate(s).replace(/[^a-z0-9]/g, "");
  const r = norm(reference);
  const h = norm(hypothesis);
  if (!r.length) return h.length ? 1 : 0;
  return levenshtein(r, h) / r.length;
}
