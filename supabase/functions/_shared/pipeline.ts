// One request through either pipeline.
//   baseline : Whisper -> LLM prompt
//   bujji    : Indian speech model -> correction step -> same LLM prompt -> merge
//   indic_raw: Indian speech model -> same LLM prompt (ablation: speech model alone)
import { correct, type Correction } from "./correct.ts";
import { charErrorRate } from "./translit.ts";
import { extractIntent, type Intent, type LlmConfig, llmProvider, mergeCorrection, rulesIntent } from "./intent.ts";
import type { Family } from "./lexicon.ts";
import { buildReply, type FeedLine, feedLine, type Reply } from "./reply.ts";
import { bujjiStt, type SttConfig, type SttResult, whisperStt } from "./stt.ts";

export type Pipeline = "bujji" | "baseline" | "indic_raw";

export type Action =
  | { type: "call"; name: string; relation: string; phone: string }
  | { type: "reminder"; time: string; medicine: string | null }
  | { type: "emergency"; number: "108" }
  | { type: "dial"; number: "1930"; reason: string }
  | { type: "none" };

export type PipelineResult = {
  pipeline: Pipeline;
  stt: Omit<SttResult, "transcript"> | null;
  transcript: string;
  corrected: string | null;
  correction: Correction | null;
  llm: Intent | null;
  llmSource: "openai" | "gemini" | "rules";
  llmError?: string;
  intent: Intent;
  overrides: string[];
  reply: Reply;
  feed: FeedLine | null;
  action: Action;
  cer: number | null;
  ms: number;
};

export async function runPipeline(opts: {
  pipeline: Pipeline;
  family: Family;
  stt: SttConfig;
  llm: LlmConfig;
  audio?: Blob;
  filename?: string;
  text?: string; // typed input skips speech-to-text
  strict?: boolean; // evaluation: never fall back to rules
  reference?: string; // evaluation: correct transcript, for character error rate
}): Promise<PipelineResult> {
  const t0 = Date.now();
  const { pipeline, family } = opts;

  let sttMeta: PipelineResult["stt"] = null;
  let transcript = opts.text ?? "";
  if (opts.audio) {
    const r = pipeline === "baseline"
      ? await whisperStt(opts.stt, opts.audio, opts.filename ?? "clip.m4a")
      : await bujjiStt(opts.stt, opts.audio, opts.filename ?? "clip.m4a");
    transcript = r.transcript;
    sttMeta = { language: r.language, provider: r.provider, ms: r.ms };
  }

  const correction = pipeline === "bujji" ? correct(transcript, family) : null;
  const llmInput = correction ? correction.text : transcript;

  let llm: Intent | null = null;
  let llmError: string | undefined;
  try {
    llm = await extractIntent(opts.llm, family, llmInput);
  } catch (e) {
    llmError = e instanceof Error ? e.message : String(e);
    if (opts.strict || !correction) throw e;
  }

  let intent: Intent;
  let overrides: string[] = [];
  if (correction) {
    const base = llm ?? rulesIntent(correction, transcript);
    ({ intent, overrides } = mergeCorrection(base, correction));
    if (!llm) intent.language = correction.language;
  } else {
    intent = llm!;
  }

  return {
    pipeline,
    stt: sttMeta,
    transcript,
    corrected: correction?.text ?? null,
    correction,
    llm,
    llmSource: llm ? llmProvider(opts.llm) : "rules",
    llmError,
    intent,
    overrides,
    reply: buildReply(intent, family),
    feed: feedLine(intent, family),
    action: actionFor(intent, family),
    cer: opts.reference ? Math.round(charErrorRate(opts.reference, transcript) * 1000) / 1000 : null,
    ms: Date.now() - t0,
  };
}

export function actionFor(i: Intent, family: Family): Action {
  if (i.intent === "call_family") {
    const c = family.contacts.find((x) => x.name === i.contact);
    if (c) return { type: "call", name: c.name, relation: c.relation, phone: c.phone };
  }
  if (i.intent === "set_reminder" && i.time) return { type: "reminder", time: i.time, medicine: i.medicine };
  if (i.intent === "red_flag") return { type: "emergency", number: "108" };
  if (i.intent === "scam_report" && i.money_sent) return { type: "dial", number: "1930", reason: "money already sent" };
  return { type: "none" };
}
