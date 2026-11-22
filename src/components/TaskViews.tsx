import { useEffect, useState } from "react";
import { D } from "./DashArt";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Orb, S, softShadow, type IconName } from "./soft";
import { C } from "../lib/theme";
import { sendVoice } from "../lib/api";
import { useVoiceRecorder } from "../lib/audio";
import { voiceConfirms } from "../lib/confirm";
import { speak } from "../lib/speak";
import { Reveal } from "./Motion";
import { AlarmModal, stepsSince, useNow, useStepsSince, useStoppedAlarms, useTaskStarts, walkStart } from "./TaskAlarm";
import { countdownLabel, doneToday, msUntil, shouldRing } from "../lib/alarm";
import { useLang } from "../lib/language";
import {
  KIND_HI, KIND_LABEL, KIND_ROUTE, KIND_TE, addTask, clock, deleteTask, isValidTime, markDone, syncTaskNotifications, taskStatus, updateTask, useTasks,
  type Task, type TaskKind,
} from "../lib/tasks";

export const KIND_ICON: Record<TaskKind, [IconName, readonly [string, string]]> = {
  medicine: ["medkit", S.peach],
  breathing: ["leaf", S.peach],
  chair_stand: ["body", S.sage],
  memory: ["moon", S.lilac],
  walk: ["walk", S.sage],
  call: ["call", S.sky],
  custom: ["sparkles", S.lilac],
};

/** Parent home: today's open tasks from the family, live. Finished ones leave the list. */
export function FromFamily() {
  const { tasks, error, loading } = useTasks();
  const { t } = useLang();
  const active = tasks.filter((t) => t.active);

  useEffect(() => { if (!loading && !error) syncTaskNotifications(active); }, [tasks, loading, error]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <ActivityIndicator style={{ marginVertical: 16 }} />;
  if (error) return <Text style={st.empty}>{error}</Text>;
  if (!active.length) return <Text style={st.empty}>{t({ en: "Nothing from Ravi today.", te: "రవి నుండి ఈ రోజు పనులు లేవు.", hi: "आज रवि की ओर से कुछ नहीं।" })}</Text>;
  return <TaskList tasks={active} />;
}

type VoiceState = { id: string; phase: "listening" | "checking" } | null;
const NEEDS_START: TaskKind[] = ["walk", "call", "custom"]; // started by Amma, then closed by voice

/** One shared recorder for all task rows: "Say it's done" records up to 6 s, then Bujji checks what was said. */
function TaskList({ tasks }: { tasks: Task[] }) {
  const { t: tr, voice } = useLang();
  const rec = useVoiceRecorder(6);
  const now = useNow(1000);
  const alarms = useStoppedAlarms();
  const starts = useTaskStarts();
  const open = tasks.filter((t) => !doneToday(t, now));
  const doneCount = tasks.length - open.length;
  const ringing = open.find((t) => shouldRing(t, now, alarms.stoppedToday(t.id))) ?? null;
  const [busy, setBusy] = useState<VoiceState>(null);
  const [heard, setHeard] = useState<Record<string, string>>({});
  const [justDone, setJustDone] = useState<{ title: string; said: string; steps: number | null } | null>(null);

  async function check(task: Task, uri: string | null) {
    if (!uri) { setBusy(null); return; }
    setBusy({ id: task.id, phase: "checking" });
    try {
      const r = await sendVoice(uri, { dryRun: true });
      const said = (r.transcript || "").trim();
      if (voiceConfirms({ kind: task.kind, transcript: said, intent: r.intent?.intent })) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const start = task.kind === "walk" ? walkStart(task, starts.startedAt(task.id)) : null;
        const steps = start ? await stepsSince(start) : null;
        await markDone(task, said, { steps });
        setJustDone({ title: task.title, said, steps });
        setHeard((h) => { const n = { ...h }; delete n[task.id]; return n; });
        speak(tr({ en: "Thank you. I have told Ravi.", te: "ధన్యవాదాలు. రవికి చెప్పాను.", hi: "धन्यवाद। रवि को बता दिया।" }), voice);
      } else {
        setHeard((h) => ({ ...h, [task.id]: said }));
        speak(tr({ en: "I didn't hear that it's done. Tap the mic and say: I have done it.", te: "పూర్తయిందని వినిపించలేదు. మైక్ నొక్కి, అయిపోయింది అని చెప్పండి.", hi: "मुझे नहीं सुनाई दिया कि हो गया। माइक दबाइए और कहिए: हो गया।" }), voice);
      }
    } catch (e) {
      setHeard((h) => ({ ...h, [task.id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  }

  async function sayDone(task: Task) {
    if (busy?.id === task.id && busy.phase === "listening") { check(task, await rec.stop()); return; }
    if (busy) return;
    try {
      setBusy({ id: task.id, phase: "listening" });
      await rec.start((uri) => check(task, uri));
    } catch (e) {
      setBusy(null);
      setHeard((h) => ({ ...h, [task.id]: e instanceof Error ? e.message : String(e) }));
    }
  }

  function startTask(task: Task) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const route = KIND_ROUTE[task.kind];
    if (route) { router.push(route); return; } // breathing / chair stand / memory: the check itself finishes the task
    starts.start(task);
    speak(task.kind === "walk"
      ? tr({ en: "Walk started. I am counting your steps. When you finish, tap the mic and say: done.", te: "నడక మొదలైంది. అడుగులు లెక్కపెడుతున్నాను. అయిపోయాక మైక్ నొక్కి, అయిపోయింది అనండి.", hi: "सैर शुरू। मैं कदम गिन रही हूँ। हो जाने पर माइक दबाइए और कहिए: हो गया।" })
      : tr({ en: "Started. When you finish, tap the mic and say: done.", te: "మొదలైంది. అయిపోయాక మైక్ నొక్కి, అయిపోయింది అనండి.", hi: "शुरू हो गया। हो जाने पर माइक दबाइए और कहिए: हो गया।" }), voice);
  }

  return (
    <View style={{ gap: 12 }}>
      <AlarmModal task={ringing} onStop={alarms.stop} onSayDone={(t) => setTimeout(() => sayDone(t), 400)} />
      <View style={st.progressRow}>
        <View style={st.progressTrack}><View style={[st.progressFill, { width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }]} /></View>
        <Text style={st.progressText}>{doneCount}/{tasks.length} {tr({ en: "done", te: "అయ్యాయి", hi: "हो गए" })}</Text>
      </View>
      {justDone ? (
        <Pressable onPress={() => setJustDone(null)} style={st.doneBanner}>
          <Ionicons name="checkmark-circle" size={22} color={C.green} />
          <Text style={st.doneText} numberOfLines={2}>
            {justDone.title} · {tr({ en: "told Ravi", te: "రవికి చెప్పాను", hi: "रवि को बताया" })}{justDone.steps !== null ? ` · 👣 ${justDone.steps.toLocaleString("en-IN")}` : ""}
          </Text>
        </Pressable>
      ) : null}
      {open.length === 0 ? (
        <View style={st.allDone}>
          <Text style={{ fontSize: 34 }}>🎉</Text>
          <Text style={st.allDoneText}>{tr({ en: "All done for today. Ravi can see it.", te: "ఈ రోజు అన్నీ అయిపోయాయి. రవి చూడగలరు.", hi: "आज के सब काम हो गए। रवि देख सकते हैं।" })}</Text>
        </View>
      ) : null}
      {open.map((t, i) => (
        <Reveal key={t.id} delay={300 + i * 90}><ParentTask t={t} now={now} startedAt={starts.startedAt(t.id)} stoppedAt={alarms.stoppedAt(t.id)}
          voice={busy?.id === t.id ? busy.phase : null} heard={heard[t.id]} onSayDone={() => sayDone(t)} onStart={() => startTask(t)} /></Reveal>
      ))}
    </View>
  );
}

function ParentTask({ t, now, startedAt, stoppedAt, voice: vstate, heard, onSayDone, onStart }: {
  t: Task; now: Date; startedAt: string | null; stoppedAt: string | null; voice: "listening" | "checking" | null;
  heard?: string; onSayDone: () => void; onStart: () => void;
}) {
  const { lang, t: tr, voice } = useLang();
  const status = taskStatus(t);
  const [icon, tint] = KIND_ICON[t.kind];
  const kindLabel = lang === "en" ? KIND_LABEL[t.kind] : lang === "hi" ? KIND_HI[t.kind] : KIND_TE[t.kind];
  const ms = msUntil(t, now);
  const needsStart = NEEDS_START.includes(t.kind) || !!KIND_ROUTE[t.kind];
  const started = !!startedAt;
  const walkFrom = t.kind === "walk" && startedAt ? new Date(startedAt) : null;
  const steps = useStepsSince(walkFrom, !!walkFrom);
  const mins = startedAt ? Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60000)) : 0;
  const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

  function listen() {
    Haptics.selectionAsync().catch(() => {});
    const when = t.time ? clock(t.time) : tr({ en: "any time today", te: "ఈ రోజు ఎప్పుడైనా", hi: "आज कभी भी" });
    speak(tr({
      en: `Ravi asked you: ${t.title}, at ${when}.${t.note ? ` ${t.note}.` : ""} ${needsStart && !started ? "Tap start to begin." : "When you have done it, tap the mic and say: I have done it."}`,
      te: `రవి చెప్పారు: ${t.title}, ${when} కి.${t.note ? ` ${t.note}.` : ""} ${needsStart && !started ? "మొదలుపెట్టడానికి స్టార్ట్ నొక్కండి." : "అయిపోయాక, మైక్ నొక్కి అయిపోయింది అని చెప్పండి."}`,
      hi: `रवि ने कहा: ${t.title}, ${when} बजे।${t.note ? ` ${t.note}।` : ""} ${needsStart && !started ? "शुरू करने के लिए स्टार्ट दबाइए।" : "हो जाने पर माइक दबाइए और कहिए: हो गया।"}`,
    }), voice);
  }

  const showStart = needsStart && !started;
  const [open, setOpen] = useState(false);
  const route = KIND_ROUTE[t.kind];
  return (
    <View style={st.stack}>
      {/* stacked-cards look: two softer layers peeking out above */}
      <View style={[st.layer, st.layer2]} />
      <View style={[st.layer, st.layer1]} />
      <View style={[st.card, status === "due" && !started ? st.rowDue : null, started ? st.rowLive : null]}>
        <View style={st.cardTop}>
          <LinearGradient colors={tint} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 1 }} style={st.thumb}>
            <Ionicons name={icon} size={34} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={st.cTitle} numberOfLines={2}>{t.title}</Text>
            <Text style={st.cSub}>{kindLabel}</Text>
            <View style={st.whenRow}>
              <Ionicons name="calendar-outline" size={15} color={S.muted} />
              <Text style={st.whenText}>{tr({ en: "Today", te: "ఈ రోజు", hi: "आज" })}</Text>
              <Ionicons name="time-outline" size={15} color={S.muted} style={{ marginLeft: 10 }} />
              <Text style={st.whenText}>{t.time ? clock(t.time) : tr({ en: "Any time", te: "ఎప్పుడైనా", hi: "कभी भी" })}</Text>
            </View>
          </View>
          <Pressable onPress={() => (route && !started ? onStart() : listen())} accessibilityRole="button" accessibilityLabel={tr({ en: "Open", te: "తెరవండి", hi: "खोलें" })}
            style={({ pressed }) => [st.arrowBtn, pressed && { opacity: 0.7 }]}>
            <Ionicons name="arrow-up" size={18} color={S.ink} style={{ transform: [{ rotate: "45deg" }] }} />
          </Pressable>
        </View>

        <View style={st.metaRow}>
          {started ? (
            <View style={[st.pill, { backgroundColor: "#FFF0E6" }]}><View style={st.liveDot} /><Text style={[st.pillText, { color: "#C9480F" }]}>{tr({ en: "In progress", te: "జరుగుతోంది", hi: "चल रहा है" })} · {mins} min</Text></View>
          ) : status === "due" ? (
            <View style={[st.pill, { backgroundColor: "#FFF0E6" }]}><Ionicons name="alarm" size={14} color={C.marigold} /><Text style={[st.pillText, { color: C.marigold }]}>{tr({ en: "Time to do it now", te: "ఇప్పుడు చేయండి", hi: "अभी करने का समय" })}</Text></View>
          ) : ms !== null && ms > 0 ? (
            <View style={st.pill}><Ionicons name="alarm-outline" size={14} color={S.ink} /><Text style={st.pillText}>{tr({ en: "Alarm", te: "అలారం", hi: "अलार्म" })} {countdownLabel(ms)}</Text></View>
          ) : null}
          {stoppedAt ? <View style={st.pill}><Text style={st.pillText}>🔔 {tr({ en: "stopped", te: "ఆపారు", hi: "रोका" })} {hm(stoppedAt)}</Text></View> : null}
        </View>

        {t.kind === "walk" && started ? (
          <View style={st.stepsBox}>
            <Text style={st.stepsNum}>{steps === null ? "—" : steps.toLocaleString("en-IN")}</Text>
            <Text style={st.stepsLabel}>👣 {tr({ en: "steps since", te: "అడుగులు, మొదలు", hi: "कदम, शुरू" })} {hm(startedAt!)}</Text>
          </View>
        ) : null}
        {open && t.note ? <Text style={st.noteOpen}>{t.note}</Text> : null}

        <View style={st.divider} />
        <View style={st.actions}>
          <Pressable onPress={listen} accessibilityRole="button" accessibilityLabel={tr({ en: "Listen to this task", te: "ఈ పని వినండి", hi: "यह काम सुनिए" })}
            style={({ pressed }) => [st.actBtn, st.ghostBtn, pressed && { opacity: 0.8 }]}>
            <Ionicons name="volume-high" size={20} color={S.ink} />
            <Text style={[st.actText, { color: S.ink }]}>{tr({ en: "Listen", te: "వినండి", hi: "सुनिए" })}</Text>
          </Pressable>
          {showStart ? (
            <Pressable onPress={onStart} accessibilityRole="button" accessibilityLabel={tr({ en: "Start", te: "మొదలుపెట్టండి", hi: "शुरू करें" })}
              style={({ pressed }) => [st.actBtn, st.startBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name={t.kind === "walk" ? "walk" : "play"} size={20} color="#fff" />
              <Text style={st.actText}>{t.kind === "walk" ? tr({ en: "Start walk", te: "నడక మొదలు", hi: "सैर शुरू" }) : tr({ en: "Start", te: "మొదలుపెట్టండి", hi: "शुरू करें" })}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onSayDone} disabled={vstate === "checking"} accessibilityRole="button"
              accessibilityLabel={tr({ en: "Say it's done", te: "అయిపోయింది అని చెప్పండి", hi: "बोलिए हो गया" })}
              style={({ pressed }) => [st.actBtn, st.startBtn, vstate === "listening" && st.micOn, pressed && { opacity: 0.85 }]}>
              {vstate === "checking" ? <ActivityIndicator color="#fff" /> : <Ionicons name={vstate === "listening" ? "stop" : "mic"} size={20} color="#fff" />}
              <Text style={st.actText} numberOfLines={1}>
                {vstate === "listening" ? tr({ en: "Tap to stop", te: "ఆపడానికి నొక్కండి", hi: "रोकने को दबाइए" })
                  : vstate === "checking" ? tr({ en: "Checking…", te: "చూస్తున్నాను…", hi: "देख रही हूँ…" })
                  : started ? tr({ en: "Say “done”", te: "“అయిపోయింది”", hi: "“हो गया”" })
                  : tr({ en: "Say it's done", te: "అయిపోయింది అనండి", hi: "बोलिए हो गया" })}
              </Text>
            </Pressable>
          )}
        </View>
        {heard !== undefined ? (
          <Text style={[st.heard, { color: C.marigold }]}>{tr({ en: "Heard", te: "విన్నది", hi: "सुना" })}: “{heard || "…"}” · {tr({ en: "not done yet, try again", te: "ఇంకా కాలేదు, మళ్ళీ చెప్పండి", hi: "अभी नहीं, फिर बोलिए" })}</Text>
        ) : null}
      </View>
      {t.note ? (
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={open ? "Hide note" : "Show note"} style={st.chev}>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={S.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  row: { backgroundColor: "#fff", borderRadius: 22, padding: 14, ...softShadow, borderWidth: 1.5, borderColor: "transparent" },
  // reference card: stacked layers, square picture, title, date/time row, arrow, divider, two buttons, chevron
  stack: { paddingTop: 16, marginBottom: 18 },
  layer: { position: "absolute", left: 0, right: 0, height: 60, borderRadius: 28, backgroundColor: "#fff" },
  layer2: { top: 0, marginHorizontal: 34, opacity: 0.45 },
  layer1: { top: 8, marginHorizontal: 16, opacity: 0.75 },
  card: { backgroundColor: "#fff", borderRadius: 30, padding: 18, ...softShadow, shadowOpacity: 0.08, borderWidth: 1.5, borderColor: "#fff" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  thumb: { width: 80, height: 80, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cTitle: { fontSize: 22, fontWeight: "600", color: S.ink, letterSpacing: -0.4 },
  cSub: { fontSize: 15, color: S.muted, marginTop: 2 },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  whenText: { fontSize: 14, color: "#5C5751" },
  arrowBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEE8E1", ...softShadow, shadowOpacity: 0.08 },
  divider: { height: 1, backgroundColor: "#F0EAE3", marginTop: 14 },
  ghostBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E8E1D8", ...softShadow, shadowOpacity: 0.06 },
  noteOpen: { fontSize: 15, color: "#5C5751", marginTop: 10, lineHeight: 21 },
  chev: { alignSelf: "center", width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginTop: -20, borderWidth: 1, borderColor: "#EEE8E1", ...softShadow, shadowOpacity: 0.1 },
  tlRow: { flexDirection: "row", gap: 10 },
  tlLeft: { width: 50, alignItems: "center", paddingTop: 14 },
  tlTime: { fontSize: 13, fontWeight: "700", color: S.ink },
  tlDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 8, borderWidth: 3, borderColor: "#fff" },
  tlLine: { flex: 1, width: 2, backgroundColor: "#E7E0D8", marginTop: 4, marginBottom: -14, borderRadius: 1 },
  rowDue: { borderColor: "#F6C48E" },
  rowLive: { borderColor: "#FFC08F" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F6F1EB", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: "700", color: S.ink },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  stepsBox: { marginTop: 12, backgroundColor: "#FFF4EC", borderRadius: 18, paddingVertical: 12, alignItems: "center" },
  stepsNum: { fontSize: 40, fontWeight: "800", color: "#C9480F" },
  stepsLabel: { fontSize: 13, color: "#C9480F", fontWeight: "600" },
  iconBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#F6F1EB", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EEE6DC" },
  startBtn: { backgroundColor: S.orange },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#EDE6DE", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: S.orange },
  progressText: { fontSize: 13, fontWeight: "700", color: S.muted },
  doneBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF0E6", borderRadius: 18, padding: 12 },
  doneText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#C9480F" },
  allDone: { alignItems: "center", backgroundColor: "#fff", borderRadius: 24, padding: 22, ...softShadow },
  allDoneText: { fontSize: 16, fontWeight: "700", color: S.ink, textAlign: "center", marginTop: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 18, paddingVertical: 14, minHeight: 54 },
  listenBtn: { backgroundColor: S.black },
  micBtn: { backgroundColor: "#F6F1EB", borderWidth: 1, borderColor: "#EEE6DC" },
  micOn: { backgroundColor: C.red, borderColor: "transparent" },
  actText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  heard: { fontSize: 13, marginTop: 8, fontWeight: "600" },
  timer: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#F6F1EB", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  timerText: { fontSize: 13, fontWeight: "700", color: S.ink },
  steps: { fontSize: 15, fontWeight: "700", color: C.green, marginTop: 6 },
  rowDone: { backgroundColor: "#F7FBF8" },
  eyebrow: { fontSize: 13, color: S.muted },
  title: { fontSize: 16, fontWeight: "600", color: S.ink, marginTop: 2 },
  titleDone: { color: S.muted, textDecorationLine: "line-through" },
  note: { fontSize: 13, color: S.muted, marginTop: 2 },
  due: { fontSize: 13, color: C.marigold, fontWeight: "600", marginTop: 4 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: S.ink, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: C.green, borderColor: C.green },
  empty: { fontSize: 14, color: S.muted, paddingVertical: 8 },
});

// ---------------------------------------------------------------------------
// Family dashboard (web): create, edit, pause and delete Amma's tasks.

const KINDS: TaskKind[] = ["medicine", "breathing", "chair_stand", "memory", "walk", "call", "custom"];
const QUICK_TIMES = ["08:00", "13:00", "17:30", "20:00"];

type Draft = { kind: TaskKind; title: string; time: string; note: string };
const EMPTY: Draft = { kind: "medicine", title: "", time: "", note: "" };

function confirmDelete(title: string) {
  // RN Alert has no buttons on web; the dashboard is web-only, so use the browser dialog.
  return typeof window === "undefined" || typeof window.confirm !== "function" ? true : window.confirm(`Delete “${title}”?`);
}

function doneAt(t: Task) {
  return t.last_done_at ? new Date(t.last_done_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";
}

export function TaskManager({ tasks, error }: { tasks: Task[]; error: string | null }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function open(t?: Task) {
    setFormError(null);
    setEditing(t ? t.id : "new");
    setDraft(t ? { kind: t.kind, title: t.title, time: t.time ?? "", note: t.note ?? "" } : EMPTY);
  }

  async function save() {
    const time = draft.time.trim();
    if (time && !isValidTime(time)) { setFormError("Time must be HH:MM in 24-hour format, e.g. 08:00 or 20:30."); return; }
    const input = { kind: draft.kind, title: draft.title.trim() || KIND_LABEL[draft.kind], time: time || null, note: draft.note.trim() || null };
    setBusy(true);
    try {
      if (editing === "new") await addTask(input); else if (editing) await updateTask(editing, input);
      setEditing(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <View style={m.form}>
      <Text style={m.label}>Type</Text>
      <View style={m.kinds}>
        {KINDS.map((k) => {
          const on = draft.kind === k;
          return (
            <Pressable key={k} onPress={() => setDraft((d) => ({ ...d, kind: k }))} style={[m.kind, on ? m.kindOn : null]}>
              <Ionicons name={KIND_ICON[k][0]} size={14} color={on ? "#fff" : S.ink} />
              <Text style={[m.kindText, on ? { color: "#fff" } : null]}>{KIND_LABEL[k]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={m.label}>What should Amma do?</Text>
      <TextInput value={draft.title} onChangeText={(title) => setDraft((d) => ({ ...d, title }))} placeholder={KIND_LABEL[draft.kind]} style={m.input} />
      <Text style={m.label}>Every day at (24-hour, leave empty for any time)</Text>
      <View style={m.timeRow}>
        <TextInput value={draft.time} onChangeText={(time) => setDraft((d) => ({ ...d, time }))} placeholder="HH:MM" style={[m.input, { width: 110, marginBottom: 0 }]} maxLength={5} />
        {QUICK_TIMES.map((q) => (
          <Pressable key={q} onPress={() => setDraft((d) => ({ ...d, time: q }))} style={[m.kind, draft.time === q ? m.kindOn : null]}>
            <Text style={[m.kindText, draft.time === q ? { color: "#fff" } : null]}>{clock(q)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={m.label}>Note for Amma (optional)</Text>
      <TextInput value={draft.note} onChangeText={(note) => setDraft((d) => ({ ...d, note }))} placeholder="e.g. after breakfast" style={m.input} />
      {formError ? <Text style={m.error}>{formError}</Text> : null}
      <View style={m.formActions}>
        <Pressable onPress={() => setEditing(null)} style={[m.btn, m.btnGhost]}><Text style={m.btnGhostText}>Cancel</Text></Pressable>
        <Pressable onPress={save} disabled={busy} style={[m.btn, { opacity: busy ? 0.5 : 1 }]}>
          <Text style={m.btnText}>{busy ? "Saving…" : editing === "new" ? "Add for Amma" : "Save changes"}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View>
      <View style={m.head}>
        <Text style={m.h2}>Reminders & tasks for Amma</Text>
        {editing !== "new" ? (
          <Pressable onPress={() => open()} style={m.add} accessibilityRole="button">
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={m.btnText}>New</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={m.sub}>They appear on Amma’s phone under “From Ravi” with a daily alert at the time you set.</Text>
      {error ? <Text style={m.error}>{error}</Text> : null}
      {editing === "new" ? form : null}
      {!error && !tasks.length && editing !== "new" ? <Text style={m.sub}>No tasks yet. Add a medicine reminder, a walk or a breathing check.</Text> : null}
      {tasks.map((t) => (editing === t.id ? <View key={t.id}>{form}</View> : <ManagerRow key={t.id} t={t} onEdit={() => open(t)} />))}
    </View>
  );
}

function ManagerRow({ t, onEdit }: { t: Task; onEdit: () => void }) {
  const status = taskStatus(t);
  const [icon, tint] = KIND_ICON[t.kind];
  const pill = !t.active
    ? { text: "Paused", bg: "#F1F1F4", fg: S.muted }
    : status === "done" ? { text: `Done ${doneAt(t)}`, bg: C.greenSoft, fg: C.green }
    : status === "due" ? { text: t.time ? "Not done yet" : "Pending today", bg: C.marigoldSoft, fg: "#B86A1E" }
    : { text: "Upcoming", bg: C.skySoft, fg: "#2C7DB0" };
  const act = (fn: () => Promise<void>) => () => { fn().catch((e) => console.warn(e)); };

  return (
    <View style={[m.row, !t.active ? { opacity: 0.6 } : null]}>
      <Orb icon={icon} tint={tint} size={42} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={m.rowTitle}>{t.title}</Text>
        <Text style={m.rowMeta}>{clock(t.time)} · {KIND_LABEL[t.kind]}{t.note ? ` · ${t.note}` : ""}</Text>
      </View>
      <View style={[m.pill, { backgroundColor: pill.bg }]}><Text style={[m.pillText, { color: pill.fg }]}>{pill.text}</Text></View>
      <IconBtn icon="create-outline" label="Edit" onPress={onEdit} />
      <IconBtn icon={t.active ? "pause-outline" : "play-outline"} label={t.active ? "Pause" : "Resume"} onPress={act(() => updateTask(t.id, { active: !t.active }))} />
      <IconBtn icon="trash-outline" label="Delete" danger onPress={() => { if (confirmDelete(t.title)) act(() => deleteTask(t.id))(); }} />
    </View>
  );
}

function IconBtn({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [m.iconBtn, hovered ? { backgroundColor: "#F3F3F6" } : null, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={18} color={danger ? C.red : S.ink} />
    </Pressable>
  );
}

const m = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h2: { fontSize: 20, fontWeight: "700", color: S.ink },
  sub: { fontSize: 14, color: S.muted, marginTop: 4, marginBottom: 12 },
  add: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: D.blue, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff", borderRadius: 22, padding: 12, marginBottom: 10, ...softShadow },
  rowTitle: { fontSize: 15, fontWeight: "600", color: S.ink },
  rowMeta: { fontSize: 13, color: S.muted, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginHorizontal: 6 },
  pillText: { fontSize: 12, fontWeight: "600" },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  form: { backgroundColor: "#fff", borderRadius: 22, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#ECE8F6", ...softShadow },
  label: { fontSize: 13, fontWeight: "600", color: S.muted, marginBottom: 6, marginTop: 4 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  kind: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#F3F3F6" },
  kindOn: { backgroundColor: D.blue },
  kindText: { fontSize: 13, color: S.ink, fontWeight: "500" },
  input: { fontSize: 15, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: C.field, color: S.ink },
  timeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 },
  error: { fontSize: 13, color: C.red, marginBottom: 8 },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  btn: { backgroundColor: D.blue, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  btnGhost: { backgroundColor: "#F3F3F6" },
  btnGhostText: { color: S.ink, fontWeight: "600", fontSize: 14 },
});
