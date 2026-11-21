// Press-to-talk recorder on expo-audio (iOS records .m4a).
import { useCallback, useRef, useState } from "react";
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder,
} from "expo-audio";

export function useVoiceRecorder(maxSeconds = 12) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutoStop = useRef<((uri: string | null) => void) | null>(null);

  const stop = useCallback(async (): Promise<string | null> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!recorder.isRecording && !recording) return null;
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    return recorder.uri;
  }, [recorder, recording]);

  const start = useCallback(async (autoStop?: (uri: string | null) => void) => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error("Microphone permission is needed. Settings > Expo Go > Microphone.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    onAutoStop.current = autoStop ?? null;
    timer.current = setTimeout(async () => {
      const uri = await stop();
      onAutoStop.current?.(uri);
    }, maxSeconds * 1000);
  }, [recorder, maxSeconds, stop]);

  return { recording, start, stop };
}
