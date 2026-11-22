// "Insights" tab on Ravi's dashboard: suggestions worked out from Amma's checks and age,
// each with the reason, tips, food ideas, and a one-tap "Assign to Amma" task.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { healthSuggestions, type Ev, type Level, type Suggestion } from "../lib/insights";
import { addTask, type Task } from "../lib/tasks";
import { D } from "./DashArt";
import { Reveal } from "./Motion";

const LEVEL: Record<Level, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  doctor: { label: "Talk to her doctor", bg: "#FDECEC", fg: "#B3261E", icon: "medkit" },
  watch: { label: "Worth acting on", bg: "#FFF3E4", fg: "#B86A1E", icon: "eye" },
  good: { label: "Looks good", bg: "#E7F5EC", fg: "#2E7A50", icon: "checkmark-circle" },
};

export function InsightsPanel({ events, age, parent, tasks }: { events: Ev[]; age: number; parent: string; tasks: Task[] }) {
  const list = healthSuggestions(events.filter((e) => !e.sample), age);
  const counts = { doctor: list.filter((s) => s.level === "doctor").length, watch: list.filter((s) => s.level === "watch").length };
  return (
    <View>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={st.h1}>Suggestions for {parent}</Text>
          <Text style={st.sub}>From her own check results in the last 30 days and her age ({age}). General wellness tips, not a diagnosis: check with her doctor before any vitamin or diet change.</Text>
        </View>
        <View style={st.counts}>
          {counts.doctor ? <Text style={[st.count, { backgroundColor: LEVEL.doctor.bg, color: LEVEL.doctor.fg }]}>{counts.doctor} for the doctor</Text> : null}
          {counts.watch ? <Text style={[st.count, { backgroundColor: LEVEL.watch.bg, color: LEVEL.watch.fg }]}>{counts.watch} to act on</Text> : null}
        </View>
      </View>
      <View style={st.grid}>{list.map((s, i) => <Reveal key={s.id} delay={i * 90} from={40} scale={0.95} duration={680} style={st.cell}><Card s={s} tasks={tasks} parent={parent} /></Reveal>)}</View>
    </View>
  );
}

function Card({ s, tasks, parent }: { s: Suggestion; tasks: Task[]; parent: string }) {
  const L = LEVEL[s.level];
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  const already = s.task && tasks.some((t) => t.active && t.title.toLowerCase() === s.task!.title.toLowerCase());

  async function assign() {
    if (!s.task) return;
    setState("busy");
    try { await addTask({ kind: s.task.kind, title: s.task.title, time: s.task.time, note: s.task.note }); setState("done"); }
    catch (e) { setState(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <View style={st.card}>
      <View style={st.cardTop}>
        <Text style={st.area}>{s.area}</Text>
        <View style={[st.badge, { backgroundColor: L.bg }]}><Ionicons name={L.icon} size={13} color={L.fg} /><Text style={[st.badgeText, { color: L.fg }]}>{L.label}</Text></View>
      </View>
      <Text style={st.title}>{s.title}</Text>
      <Text style={st.why}>{s.why}</Text>
      {s.tips.length ? <View style={{ marginTop: 8 }}>{s.tips.map((t) => <Text key={t} style={st.line}>• {t}</Text>)}</View> : null}
      {s.food.length ? (
        <View style={st.food}>
          <Text style={st.foodHead}>🥗 Food & vitamins to note</Text>
          {s.food.map((f) => <Text key={f} style={st.line}>• {f}</Text>)}
        </View>
      ) : null}
      {s.task ? (
        already || state === "done" ? (
          <View style={[st.assign, st.assigned]}><Ionicons name="checkmark" size={16} color="#2E7A50" /><Text style={[st.assignText, { color: "#2E7A50" }]}>On {parent}’s schedule: {s.task.title}</Text></View>
        ) : (
          <Pressable onPress={assign} disabled={state === "busy"} style={({ pressed }) => [st.assign, pressed && { opacity: 0.85 }]}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={st.assignText}>{state === "busy" ? "Assigning…" : `Assign to ${parent}: ${s.task.title}${s.task.time ? ` · ${s.task.time}` : ""}`}</Text>
          </Pressable>
        )
      ) : null}
      {state !== "idle" && state !== "busy" && state !== "done" ? <Text style={[st.why, { color: D.red }]}>{state}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: "row", gap: 16, alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" },
  h1: { fontSize: 24, fontWeight: "600", color: D.ink },
  sub: { fontSize: 13, color: D.muted, marginTop: 4, maxWidth: 720, lineHeight: 19 },
  counts: { flexDirection: "row", gap: 8 },
  count: { fontSize: 13, fontWeight: "700", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  cell: { flexGrow: 1, flexBasis: 340, maxWidth: 640 },
  card: { flexGrow: 1, backgroundColor: "#fff", borderRadius: 24, padding: 18, shadowColor: "#5B4A7A", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  area: { fontSize: 12, fontWeight: "700", color: D.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 17, fontWeight: "700", color: D.ink, marginTop: 8 },
  why: { fontSize: 13, color: D.muted, marginTop: 4, lineHeight: 19 },
  line: { fontSize: 13, color: D.ink, lineHeight: 20 },
  food: { marginTop: 10, backgroundColor: "#F7FBF2", borderRadius: 14, padding: 10 },
  foodHead: { fontSize: 13, fontWeight: "700", color: "#3F6A1C", marginBottom: 2 },
  assign: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: D.blue, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  assigned: { backgroundColor: "#E7F5EC" },
  assignText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
