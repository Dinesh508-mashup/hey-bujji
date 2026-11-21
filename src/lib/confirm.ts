// Does what Amma said ("I took my BP tablet", "done", "ho gaya") confirm a task?
// Pure function so it can be tested; the app sends her voice to the bujji function
// (dry run, nothing posted) and passes the transcript + intent here.

export type ConfirmInput = { kind: string; transcript: string; intent?: string | null };

const NEGATIVE = /\b(not|didn'?t|did not|haven'?t|have not|no|nahi|nahin|nehi|ledu|ledhu|cheyyaledu|later|forgot)\b/i;
const AFFIRM = /\b(done|did|do it|finished|complete|completed|took|taken|take it|had|ate|swallowed|walked|called|yes|yeah|ok|okay|ho gaya|ho gayi|kar liya|kar li|le li|le liya|kha li|haan|ha|ayipoyindi|aipoyindi|chesanu|chesa|vesukunna|teesukunna)\b/i;

export function voiceConfirms({ kind, transcript, intent }: ConfirmInput): boolean {
  const t = transcript.trim();
  if (!t) return false;
  if (NEGATIVE.test(t)) return false;
  if (kind === "medicine" && intent === "took_medicine") return true;
  return AFFIRM.test(t);
}
