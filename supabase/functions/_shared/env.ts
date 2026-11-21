// Reads secrets inside the Deno edge runtime. Keys never ship in the Expo app.
declare const Deno: { env: { get(k: string): string | undefined } };

export function env() {
  const g = (k: string) => Deno.env.get(k) || undefined;
  return {
    db: { url: g("SUPABASE_URL"), serviceKey: g("SUPABASE_SERVICE_ROLE_KEY") },
    stt: {
      sarvamKey: g("SARVAM_API_KEY"),
      sarvamModel: g("SARVAM_STT_MODEL"),
      openaiKey: g("OPENAI_API_KEY"),
      whisperModel: g("WHISPER_MODEL"),
      indicUrl: g("INDIC_ASR_URL"),
      indicToken: g("INDIC_ASR_TOKEN"),
      provider: g("BUJJI_STT_PROVIDER"),
    },
    llm: {
      provider: g("LLM_PROVIDER"),
      openaiKey: g("OPENAI_API_KEY"),
      openaiModel: g("OPENAI_MODEL"),
      geminiKey: g("GEMINI_API_KEY"),
      geminiModel: g("GEMINI_MODEL"),
    },
    sarvamTtsSpeaker: g("SARVAM_TTS_SPEAKER"),
    sarvamTtsModel: g("SARVAM_TTS_MODEL"),
  };
}
