// Speech-to-text adapters. Hey Bujji uses an Indian speech model (Sarvam, or a
// self-hosted AI4Bharat IndicConformer); the baseline is OpenAI Whisper as-is.

export type SttResult = { transcript: string; language: string | null; provider: string; ms: number };

export type SttConfig = {
  sarvamKey?: string;
  sarvamModel?: string;
  openaiKey?: string;
  whisperModel?: string;
  indicUrl?: string; // POST multipart {file, language} -> {transcript}
  indicToken?: string;
  provider?: string; // "sarvam" | "indicconformer"
};

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = Date.now();
  const v = await fn();
  return [v, Date.now() - t0];
}

export async function sarvamStt(cfg: SttConfig, audio: Blob, filename: string): Promise<SttResult> {
  if (!cfg.sarvamKey) throw new Error("SARVAM_API_KEY is not set");
  const [data, ms] = await timed(async () => {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", cfg.sarvamModel || "saarika:v2.5");
    form.append("language_code", "unknown"); // auto-detect Telugu / Hindi / English
    const res = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": cfg.sarvamKey! },
      body: form,
    });
    if (!res.ok) throw new Error(`Sarvam STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  });
  return { transcript: data.transcript ?? "", language: data.language_code ?? null, provider: `sarvam:${cfg.sarvamModel || "saarika:v2.5"}`, ms };
}

export async function indicConformerStt(cfg: SttConfig, audio: Blob, filename: string, language = "te"): Promise<SttResult> {
  if (!cfg.indicUrl) throw new Error("INDIC_ASR_URL is not set");
  const [data, ms] = await timed(async () => {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("language", language);
    const res = await fetch(cfg.indicUrl!, {
      method: "POST",
      headers: cfg.indicToken ? { authorization: `Bearer ${cfg.indicToken}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`IndicConformer ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  });
  return { transcript: data.transcript ?? data.text ?? "", language, provider: "ai4bharat:indicconformer", ms };
}

export async function whisperStt(cfg: SttConfig, audio: Blob, filename: string): Promise<SttResult> {
  if (!cfg.openaiKey) throw new Error("OPENAI_API_KEY is not set");
  const model = cfg.whisperModel || "whisper-1";
  const [data, ms] = await timed(async () => {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", model);
    form.append("response_format", "json");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.openaiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  });
  return { transcript: data.text ?? "", language: null, provider: `openai:${model}`, ms };
}

export function bujjiStt(cfg: SttConfig, audio: Blob, filename: string): Promise<SttResult> {
  return cfg.provider === "indicconformer" ? indicConformerStt(cfg, audio, filename) : sarvamStt(cfg, audio, filename);
}
