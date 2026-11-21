// Alarm for tasks from Ravi: at the set time the phone rings loudly and Bujji speaks
// the task, over and over, until Amma taps "Stop alarm" (that tap is logged so Ravi
// sees she heard it). Works while Hey Bujji is open; when it is closed, the scheduled
// notification is what reminds her (Expo Go can't play a custom alarm in the background).
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Pedometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { logEvent } from "../lib/api";
import { speak, stopSpeaking } from "../lib/speak";
import { clock, type Task } from "../lib/tasks";
import { useLang } from "../lib/language";
import { S } from "./soft";
import { C } from "../lib/theme";

const ALARM = require("../../assets/sounds/alarm.wav");
const KEY = "heybujji.alarmStopped"; // { [taskId]: ISO time stopped }

/** Re-renders every `ms` so countdowns tick and alarms start on time. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/** Which tasks Amma has already stopped today (kept across app reloads). */
export function useStoppedAlarms() {
  const [stopped, setStopped] = useState<Record<string, string>>({});
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => v && setStopped(JSON.parse(v))).catch(() => {}); }, []);
  const stoppedToday = useCallback((id: string) => !!stopped[id] && new Date(stopped[id]).toDateString() === new Date().toDateString(), [stopped]);
  const stop = useCallback((t: Task) => {
    const at = new Date().toISOString();
    setStopped((s) => { const n = { ...s, [t.id]: at }; AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {}); return n; });
    logEvent("alarm_stopped", `Amma stopped the alarm: ${t.title}`, "normal", { task_id: t.id, kind: t.kind }).catch(() => {});
  }, []);
  return { stoppedToday, stoppedAt: (id: string) => (stoppedToday(id) ? stopped[id] : null), stop };
}

/** Full-screen ringing alarm. Loops: alarm sound ~4 s, then Bujji says the task, until stopped. */
export function AlarmModal({ task, onStop, onSayDone }: { task: Task | null; onStop: (t: Task) => void; onSayDone: (t: Task) => void }) {
  const { t: tr, voice } = useLang();
  const alive = useRef(false);

  useEffect(() => {
    if (!task) return;
    alive.current = true;
    const player = createAudioPlayer(ALARM);
    player.loop = true;
    player.volume = 1;
    const line = tr({
      en: `Amma, it's time. Ravi says: ${task.title}.${task.note ? ` ${task.note}.` : ""} Tap stop, then tell me when it's done.`,
      te: `అమ్మా, సమయం అయింది. రవి చెప్పారు: ${task.title}.${task.note ? ` ${task.note}.` : ""} ఆపు నొక్కి, అయిపోయాక చెప్పండి.`,
      hi: `अम्मा, समय हो गया। रवि ने कहा: ${task.title}।${task.note ? ` ${task.note}।` : ""} रोकें दबाइए, फिर हो जाने पर बताइए।`,
    });
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (alive.current) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
        player.seekTo(0).catch(() => {});
        player.play();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        await wait(4200);
        player.pause();
        if (!alive.current) break;
        await speak(line, voice);
        await wait(800);
      }
    })();
    return () => { alive.current = false; player.pause(); player.remove(); stopSpeaking(); };
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen">
      <View style={st.wrap}>
        <View style={st.bell}><Ionicons name="alarm" size={64} color="#fff" /></View>
        <Text style={st.time}>{clock(task.time)}</Text>
        <Text style={st.from}>{tr({ en: "From Ravi", te: "రవి నుండి", hi: "रवि की ओर से" })}</Text>
        <Text style={st.title}>{task.title}</Text>
        {task.note ? <Text style={st.note}>{task.note}</Text> : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onStop(task); }}
          accessibilityRole="button" accessibilityLabel={tr({ en: "Stop alarm", te: "అలారం ఆపు", hi: "अलार्म रोकें" })}
          style={({ pressed }) => [st.stop, pressed && { opacity: 0.85 }]}>
          <Ionicons name="stop-circle" size={34} color="#fff" />
          <Text style={st.stopText}>{tr({ en: "Stop alarm", te: "అలారం ఆపు", hi: "अलार्म रोकें" })}</Text>
        </Pressable>
        <Pressable onPress={() => { onStop(task); onSayDone(task); }} accessibilityRole="button"
          style={({ pressed }) => [st.say, pressed && { opacity: 0.85 }]}>
          <Ionicons name="mic" size={26} color={S.ink} />
          <Text style={st.sayText}>{tr({ en: "Stop & say it's done", te: "ఆపి, అయిపోయింది అనండి", hi: "रोकें और बोलिए हो गया" })}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** One-off step count between `since` and now; null if the pedometer isn't available. */
export async function stepsSince(since: Date): Promise<number | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    if (!(await Pedometer.requestPermissionsAsync()).granted) return null;
    return (await Pedometer.getStepCountAsync(since, new Date())).steps;
  } catch { return null; }
}

/** When a walk "starts" for step counting: when Amma stopped the alarm, else the task's set time today. */
export function walkStart(t: Task, stoppedAt: string | null): Date | null {
  if (stoppedAt) return new Date(stoppedAt);
  if (!t.time) return null;
  const [h, m] = t.time.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d;
}

/** Live step count since `since` (iOS pedometer). Null when not available or not allowed. */
export function useStepsSince(since: Date | null, active: boolean) {
  const [steps, setSteps] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !since) return;
    let stop = false;
    (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return;
        const p = await Pedometer.requestPermissionsAsync();
        if (!p.granted) return;
        while (!stop) {
          const r = await Pedometer.getStepCountAsync(since, new Date());
          if (!stop) setSteps(r.steps);
          await new Promise((res) => setTimeout(res, 5000));
        }
      } catch { /* pedometer not available (web / simulator) */ }
    })();
    return () => { stop = true; };
  }, [since?.getTime(), active]); // eslint-disable-line react-hooks/exhaustive-deps
  return steps;
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFF1F2", alignItems: "center", padding: 28, paddingTop: 90, paddingBottom: 50 },
  bell: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.red, alignItems: "center", justifyContent: "center" },
  time: { fontSize: 56, fontWeight: "800", color: S.ink, marginTop: 20 },
  from: { fontSize: 16, color: S.muted, marginTop: 6 },
  title: { fontSize: 30, fontWeight: "800", color: S.ink, textAlign: "center", marginTop: 6 },
  note: { fontSize: 18, color: S.muted, textAlign: "center", marginTop: 6 },
  stop: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.red, borderRadius: 999, paddingVertical: 22 },
  stopText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  say: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#fff", borderRadius: 999, paddingVertical: 18, marginTop: 14, borderWidth: 1, borderColor: "#F3D4D6" },
  sayText: { fontSize: 18, fontWeight: "700", color: S.ink },
});
