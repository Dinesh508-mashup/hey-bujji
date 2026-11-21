import { useEffect, useState } from "react";
import { D } from "./DashArt";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Orb, S, softShadow, type IconName } from "./soft";
import { C } from "../lib/theme";
import { sendVoice } from "../lib/api";
import { useVoiceRecorder } from "../lib/audio";
import { voiceConfirms } from "../lib/confirm";
import { speak } from "../lib/speak";
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

/** Parent home: today's tasks from the family, live, with one-tap "done". */
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

/** One shared recorder for all task rows: "Say it's done" records up to 6 s, then Bujji checks what was said. */
function TaskList({ tasks }: { tasks: Task[] }) {
  const { t: tr, voice } = useLang();
  const rec = useVoiceRecorder(6);
  const [busy, setBusy] = useState<VoiceState>(null);
  const [heard, setHeard] = useState<Record<string, { text: string; ok: boolean }>>({});

  async function check(task: Task, uri: string | null) {
    if (!uri) { setBusy(null); return; }
    setBusy({ id: task.id, phase: "checking" });
    try {
      const r = await sendVoice(uri, { dryRun: true });
      const said = (r.transcript || "").trim();
      const ok = voiceConfirms({ kind: task.kind, transcript: said, intent: r.intent?.intent });
      setHeard((h) => ({ ...h, [task.id]: { text: said, ok } }));
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await markDone(task, said);
        speak(tr({ en: "Thank you. I have told Ravi.", te: "ధన్యవాదాలు. రవికి చెప్పాను.", hi: "धन्यवाद। रवि को बता दिया।" }), voice);
      } else {
        speak(tr({ en: "I didn't hear that it's done. Tap the mic and say: I have done it.", te: "పూర్తయిందని వినిపించలేదు. మైక్ నొక్కి, అయిపోయింది అని చెప్పండి.", hi: "मुझे नहीं सुनाई दिया कि हो गया। माइक दबाइए और कहिए: हो गया।" }), voice);
      }
    } catch (e) {
      setHeard((h) => ({ ...h, [task.id]: { text: e instanceof Error ? e.message : String(e), ok: false } }));
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
      setHeard((h) => ({ ...h, [task.id]: { text: e instanceof Error ? e.message : String(e), ok: false } }));
    }
  }

  return <View style={{ gap: 10 }}>{tasks.map((t) => <ParentTask key={t.id} t={t} voice={busy?.id === t.id ? busy.phase : null} heard={heard[t.id]} onSayDone={() => sayDone(t)} />)}</View>;
}

function ParentTask({ t, voice: vstate, heard, onSayDone }: {
  t: Task; voice: "listening" | "checking" | null; heard?: { text: string; ok: boolean }; onSayDone: () => void;
}) {
  const { lang, t: tr, voice } = useLang();
  const status = taskStatus(t);
  const done = status === "done";
  const route = KIND_ROUTE[t.kind];
  const [icon, tint] = KIND_ICON[t.kind];
  const kindLabel = lang === "en" ? KIND_LABEL[t.kind] : lang === "hi" ? KIND_HI[t.kind] : KIND_TE[t.kind];

  function finish() {
    if (done) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    markDone(t).catch((e) => console.warn(e));
  }

  function listen() {
    Haptics.selectionAsync().catch(() => {});
    const when = t.time ? clock(t.time) : tr({ en: "any time today", te: "ఈ రోజు ఎప్పుడైనా", hi: "आज कभी भी" });
    const text = done
      ? tr({ en: `${t.title}. Already done today. Well done.`, te: `${t.title}. ఈ రోజు అయిపోయింది. బాగుంది.`, hi: `${t.title}। आज हो गया। बहुत अच्छा।` })
      : tr({
        en: `Ravi asked you: ${t.title}, at ${when}.${t.note ? ` ${t.note}.` : ""} When you have done it, tap the mic and say: I have done it.`,
        te: `రవి చెప్పారు: ${t.title}, ${when} కి.${t.note ? ` ${t.note}.` : ""} అయిపోయాక, మైక్ నొక్కి అయిపోయింది అని చెప్పండి.`,
        hi: `रवि ने कहा: ${t.title}, ${when} बजे।${t.note ? ` ${t.note}।` : ""} हो जाने पर माइक दबाइए और कहिए: हो गया।`,
      });
    speak(text, voice);
  }

  return (
    <View style={[st.row, done ? st.rowDone : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.title}, ${clock(t.time)}, ${done ? "done" : "not done"}`}
        onPress={() => (route && !done ? router.push(route) : listen())}
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <Orb icon={icon} tint={tint} size={44} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={st.eyebrow}>{t.time ? clock(t.time) : tr({ en: "Any time", te: "ఎప్పుడైనా", hi: "कभी भी" })} · {kindLabel}</Text>
          <Text style={[st.title, done ? st.titleDone : null]}>{t.title}</Text>
          {t.note ? <Text style={st.note}>{t.note}</Text> : null}
          {status === "due" ? <Text style={st.due}>{tr({ en: "Time to do it now", te: "ఇప్పుడు చేయండి", hi: "अभी करने का समय" })}</Text> : null}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={tr({ en: "Mark done", te: "పూర్తయింది", hi: "हो गया" })} hitSlop={10} onPress={finish}
          style={[st.check, done ? st.checkOn : null]}>
          <Ionicons name="checkmark" size={18} color={done ? "#fff" : S.ink} />
        </Pressable>
      </Pressable>

      <View style={st.actions}>
        <Pressable onPress={listen} accessibilityRole="button" accessibilityLabel={tr({ en: "Listen to this task", te: "ఈ పని వినండి", hi: "यह काम सुनिए" })}
          style={({ pressed }) => [st.actBtn, st.listenBtn, pressed && { opacity: 0.8 }]}>
          <Ionicons name="volume-high" size={22} color="#fff" />
          <Text style={st.actText}>{tr({ en: "Listen", te: "వినండి", hi: "सुनिए" })}</Text>
        </Pressable>
        {!done ? (
          <Pressable onPress={onSayDone} disabled={vstate === "checking"} accessibilityRole="button"
            accessibilityLabel={tr({ en: "Say it's done", te: "అయిపోయింది అని చెప్పండి", hi: "बोलिए हो गया" })}
            style={({ pressed }) => [st.actBtn, st.micBtn, vstate === "listening" && st.micOn, pressed && { opacity: 0.8 }]}>
            {vstate === "checking" ? <ActivityIndicator color={S.ink} /> : <Ionicons name={vstate === "listening" ? "stop" : "mic"} size={22} color={vstate === "listening" ? "#fff" : S.ink} />}
            <Text style={[st.actText, { color: vstate === "listening" ? "#fff" : S.ink }]}>
              {vstate === "listening" ? tr({ en: "Listening… tap to stop", te: "వింటున్నాను… ఆపడానికి నొక్కండి", hi: "सुन रही हूँ… रोकने को दबाइए" })
                : vstate === "checking" ? tr({ en: "Checking…", te: "చూస్తున్నాను…", hi: "देख रही हूँ…" })
                : tr({ en: "Say it's done", te: "అయిపోయింది అనండి", hi: "बोलिए हो गया" })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {heard ? (
        <Text style={[st.heard, { color: heard.ok ? C.green : C.marigold }]}>
          {heard.ok ? "✓ " : ""}{tr({ en: "Heard", te: "విన్నది", hi: "सुना" })}: “{heard.text || "…"}”{heard.ok ? "" : tr({ en: " · not marked done", te: " · పూర్తి కాలేదు", hi: " · पूरा नहीं माना" })}
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  row: { backgroundColor: "#fff", borderRadius: 22, padding: 14, ...softShadow },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 14, minHeight: 52 },
  listenBtn: { backgroundColor: S.black },
  micBtn: { backgroundColor: "#F3EEFB", borderWidth: 1, borderColor: "#E3DAF5" },
  micOn: { backgroundColor: C.red, borderColor: "transparent" },
  actText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  heard: { fontSize: 13, marginTop: 8, fontWeight: "600" },
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
