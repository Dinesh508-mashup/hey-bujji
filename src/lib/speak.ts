// Spoken replies: the iPhone's own Telugu/Hindi voice when installed
// (Settings > Accessibility > Spoken Content > Voices), else Sarvam TTS via the back end.
import * as Speech from "expo-speech";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { authHeaders, ttsUrl } from "./api";
import { isConfigured, MOCK } from "./config";

const voiceCache: Record<string, string | null> = {};
let current: AudioPlayer | null = null;

async function deviceVoice(lang: string): Promise<string | null> {
  if (lang in voiceCache) return voiceCache[lang];
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const prefix = lang.slice(0, 2).toLowerCase();
    const match = voices
      .filter((v) => v.language?.toLowerCase().replace("_", "-").startsWith(prefix))
      .sort((a, b) => (b.quality === "Enhanced" ? 1 : 0) - (a.quality === "Enhanced" ? 1 : 0))[0];
    voiceCache[lang] = match?.identifier ?? null;
  } catch {
    voiceCache[lang] = null;
  }
  return voiceCache[lang];
}

export async function stopSpeaking() {
  Speech.stop();
  if (current) { current.remove(); current = null; }
}

/** Speak and resolve when finished (or after a safety timeout). */
export async function speak(text: string, lang: "te-IN" | "hi-IN" | "en-IN" = "te-IN"): Promise<"device" | "sarvam" | "none"> {
  await stopSpeaking();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
  const voice = await deviceVoice(lang);
  const timeout = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  if (voice || !isConfigured || MOCK) {
    await Promise.race([
      new Promise<void>((resolve) =>
        Speech.speak(text, { language: lang, voice: voice ?? undefined, rate: 0.9, volume: 1, onDone: resolve, onStopped: resolve, onError: () => resolve() })),
      timeout(20000),
    ]);
    return voice ? "device" : "none";
  }

  try {
    const player = createAudioPlayer({ uri: ttsUrl(text, lang), headers: authHeaders });
    current = player;
    await Promise.race([
      new Promise<void>((resolve) => {
        const sub = player.addListener("playbackStatusUpdate", (s) => {
          if (s.didJustFinish) { sub.remove(); resolve(); }
        });
        player.play();
      }),
      timeout(20000),
    ]);
    return "sarvam";
  } catch {
    Speech.speak(text, { language: lang, rate: 0.9 });
    return "device";
  }
}
