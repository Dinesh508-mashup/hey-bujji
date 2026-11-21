// Accuracy page, in the family dashboard style. Reads only what
// eval/run_eval.py and eval/sensor_accuracy.py measured; never invents numbers.
import { type ReactNode } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { DashShell, dashShadow, useDashSize } from "../components/DashShell";
import { D } from "../components/DashArt";
import evalJson from "../../data/eval-results.json";
import sensorJson from "../../data/sensor-results.json";

type PipelineSummary = {
  label: string; n: number; errors: number; task_success: number | null; intent_accuracy: number | null;
  medicine: number | null; time: number | null; contact: number | null; cer: number | null;
  llm_only_task_success: number | null; overridden: number | null; saved_by_overrides: number | null;
};
type Example = {
  sentence_id: string; speaker: string; truth: string;
  truth_json: Record<string, string | null>;
  baseline_transcript: string; baseline_json: Record<string, string | null>;
  bujji_transcript: string; bujji_json: Record<string, string | null>;
  fixes: { kind: string; heard: string; fixed: string }[];
};
type EvalResults = {
  status: "not_run" | "measured" | "text_only"; note?: string; run_at?: string; clips?: number; speakers?: string[]; synthetic?: boolean;
  pipelines?: Record<string, PipelineSummary>; examples?: Example[];
  bujji_failures?: { sentence_id: string; speaker: string; truth: string; heard: string; wrong: string[] }[];
};
type SensorStats = { sessions: number; mean_abs_error: number; within_tolerance_pct: number; tolerance: number } | null;

const R = evalJson as EvalResults;
const S = sensorJson as { breathing: SensorStats; chair_stand: SensorStats };

const METRICS: [keyof PipelineSummary, string, string][] = [
  ["task_success", "Task success", "Every field correct"],
  ["intent_accuracy", "Intent accuracy", "Right action chosen"],
  ["medicine", "Medicine names", "Exact medicine identified"],
  ["time", "Times", "Reminder at the right time"],
  ["contact", "Contacts", "Right person matched"],
  ["cer", "Character error rate", "Raw transcription, lower is better"],
];
const ORDER = ["baseline", "indic_raw", "bujji"];
const NAME: Record<string, string> = { baseline: "Whisper", indic_raw: "Indian ASR only", bujji: "Hey Bujji" };
const BAR: Record<string, string> = { baseline: "#B9C0CC", indic_raw: D.blueMid, bujji: D.blue };

function fmt(v: number | null | undefined, key: string) {
  if (v === null || v === undefined) return "—";
  return key === "cer" ? v.toFixed(2) : `${v}%`;
}

export default function Results() {
  const { mid } = useDashSize();
  const measured = R.status === "measured" && !!R.pipelines;
  const cols = measured ? ORDER.filter((p) => R.pipelines![p]) : ["baseline", "indic_raw", "bujji"];
  const P = (p: string) => (measured ? R.pipelines![p] : undefined);
  const row: ViewStyle = { flexDirection: mid ? "row" : "column", gap: 18 };

  return (
    <DashShell active="accuracy" familyNav={Platform.OS === "web"} right={measured ? <Badge icon="checkmark-circle" text={`Run ${R.run_at?.replace("T", " ").slice(0, 16)}`} /> : <Badge icon="time-outline" text="Not run yet" warn />}>
      <Text style={s.h1}>Measured accuracy</Text>
      <Text style={s.sub}>Whisper vs Hey Bujji on the same recordings and the same AI prompt. Only the speech model and the correction step differ.</Text>

      {measured ? (
        <View style={s.pills}>
          <Pill icon="musical-notes-outline" text={`${R.clips} clips`} />
          <Pill icon="people-outline" text={`${R.speakers?.length ?? 0} ${R.synthetic ? "computer voices" : "speakers"}`} />
          <Pill icon="document-text-outline" text="40 English test sentences" />
          {R.synthetic ? <Pill icon="information-circle-outline" text="Text-to-speech voices, not real people" warn /> : null}
        </View>
      ) : (
        <Card style={{ marginBottom: 18, flexDirection: mid ? "row" : "column", gap: 20, alignItems: mid ? "center" : "stretch" }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <View style={s.iconBlob}><Ionicons name="hourglass-outline" size={20} color={D.blue} /></View>
              <Text style={s.cardTitle}>Not measured yet</Text>
            </View>
            <Text style={s.body}>No number appears on this page until the evaluation script has measured it.{R.status === "text_only" && R.note ? ` ${R.note}` : ""}</Text>
          </View>
          <View style={{ flex: 1.3, gap: 8 }}>
            <Step n={1} title="Make the test clips" code="python3 eval/make_tts_clips.py" hint="or record real voices: Settings → Record test clips" />
            <Step n={2} title="Run the evaluation" code="python3 eval/run_eval.py" />
            <Step n={3} title="Reload this page" hint="the numbers fill in automatically" />
          </View>
        </Card>
      )}

      {/* headline: task success per pipeline */}
      <View style={[row, { marginBottom: 18 }]}>
        {cols.map((p) => {
          const hero = p === "bujji";
          const v = P(p);
          return (
            <View key={p} style={[s.stat, hero && { backgroundColor: D.blue }, mid && { flex: 1 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[s.statLabel, hero && { color: "rgba(255,255,255,0.8)" }]}>{NAME[p]}</Text>
                <View style={[s.statIcon, hero && { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                  <MaterialCommunityIcons name={p === "baseline" ? "microphone-outline" : p === "indic_raw" ? "translate" : "heart-pulse"} size={18} color={hero ? "#fff" : D.blue} />
                </View>
              </View>
              <Text style={[s.statVal, hero && { color: "#fff" }]}>{fmt(v?.task_success, "task_success")}</Text>
              <Text style={[s.statSub, hero && { color: "rgba(255,255,255,0.8)" }]}>
                {v ? `task success · intent ${fmt(v.intent_accuracy, "")} · ${v.n} clips${v.errors ? ` · ${v.errors} errors` : ""}` : "task success"}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[row, { alignItems: mid ? "flex-start" : "stretch" }]}>
        {/* metrics with bars */}
        <Card style={mid ? { flex: 1.6 } : undefined}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>All metrics</Text>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              {cols.map((p) => (
                <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[s.legend, { backgroundColor: BAR[p] }]} /><Text style={s.legendText}>{NAME[p]}</Text>
                </View>
              ))}
            </View>
          </View>
          {METRICS.map(([key, name, what]) => {
            const vals = cols.map((p) => (P(p)?.[key] as number | null | undefined) ?? null);
            const nums = vals.filter((v): v is number => v !== null);
            const best = nums.length ? (key === "cer" ? Math.min(...nums) : Math.max(...nums)) : null;
            return (
              <View key={key} style={s.metric}>
                <View style={{ width: mid ? 190 : "100%", marginBottom: mid ? 0 : 8 }}>
                  <Text style={s.metricName}>{name}</Text>
                  <Text style={s.metricWhat}>{what}</Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  {cols.map((p, i) => {
                    const v = vals[i];
                    const w = v === null ? 0 : key === "cer" ? Math.min(1, v) : v / 100;
                    return (
                      <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={s.track}><View style={[s.fill, { width: `${w * 100}%`, backgroundColor: BAR[p] }]} /></View>
                        <Text style={[s.metricVal, v !== null && v === best && { color: D.blue, fontWeight: "700" }]}>{fmt(v, key)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Card>

        {/* explanation */}
        <View style={[{ gap: 18 }, mid && { flex: 1 }]}>
          <Card>
            <Text style={[s.cardTitle, { marginBottom: 10 }]}>How it is measured</Text>
            {[
              ["document-text-outline", "40 English sentences with the right answer: action, medicine, time, contact, urgency."],
              ["mic-outline", "Each sentence is spoken and sent through all three versions in test mode."],
              ["checkmark-done-outline", "A clip counts only if every field matches exactly."],
              ["shield-checkmark-outline", "No fallback during the test: if the AI fails, the clip fails."],
            ].map(([icon, text]) => (
              <View key={text} style={s.how}>
                <View style={s.iconBlob}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={D.blue} /></View>
                <Text style={[s.body, { flex: 1 }]}>{text}</Text>
              </View>
            ))}
          </Card>
          {measured && R.pipelines!.bujji ? (
            <Card style={{ backgroundColor: D.blueSoft }}>
              <Text style={[s.cardTitle, { marginBottom: 6 }]}>Where the gain comes from</Text>
              <Text style={s.body}>
                {R.pipelines!.indic_raw ? `The Indian speech model alone reaches ${fmt(R.pipelines!.indic_raw.task_success, "")} task success. ` : ""}
                Before the safety lists, the AI on corrected text scores {fmt(R.pipelines!.bujji.llm_only_task_success, "")}.
                {" "}{R.pipelines!.bujji.saved_by_overrides} clip(s) are correct only because the medicine, contact and time lists overrode the AI.
              </Text>
            </Card>
          ) : null}
        </View>
      </View>

      {measured && R.examples?.length ? (
        <>
          <Text style={s.h2}>Where Whisper failed and Hey Bujji didn’t</Text>
          <View style={[row, { flexWrap: "wrap" }]}>
            {R.examples.map((e) => (
              <Card key={`${e.sentence_id}-${e.speaker}`} style={mid ? { flex: 1, minWidth: 320 } : undefined}>
                <Text style={s.metricWhat}>{e.sentence_id} · {e.speaker}</Text>
                <Text style={[s.metricName, { marginTop: 2, marginBottom: 10 }]}>“{e.truth}”</Text>
                <Compare ok={false} title="Whisper" heard={e.baseline_transcript} json={e.baseline_json} />
                <Compare ok title="Hey Bujji" heard={e.bujji_transcript} json={e.bujji_json} fixes={e.fixes} />
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {measured && R.bujji_failures?.length ? (
        <>
          <Text style={s.h2}>Where Hey Bujji still fails</Text>
          <Card>
            {R.bujji_failures.map((f, i) => (
              <View key={`${f.sentence_id}-${f.speaker}`} style={[s.fail, i > 0 && { borderTopWidth: 1, borderTopColor: D.line }]}>
                <Text style={s.body}>“{f.truth}” → heard “{f.heard}”</Text>
                <Text style={s.metricWhat}>wrong: {f.wrong.join(", ")} · {f.sentence_id}/{f.speaker}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Text style={s.h2}>Sensor checks vs manual counts</Text>
      <View style={row}>
        <SensorCard title="Breathing" sub="Phone on chest, 60 s" unit="breaths/min" icon="lungs" tint={["#DCD8F2", "#9C95D6"]} color="#6B63B8" st={S.breathing} />
        <SensorCard title="Chair stand" sub="Stands in 30 s" unit="stands" icon="seat-recline-normal" tint={["#F8D5D2", "#E58C86"]} color="#C9443D" st={S.chair_stand} />
      </View>
    </DashShell>
  );
}

function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function Badge({ icon, text, warn }: { icon: keyof typeof Ionicons.glyphMap; text: string; warn?: boolean }) {
  return (
    <View style={[s.badge, warn && { backgroundColor: D.amberSoft }]}>
      <Ionicons name={icon} size={15} color={warn ? "#B8741F" : D.green} />
      <Text style={s.badgeText}>{text}</Text>
    </View>
  );
}

function Pill({ icon, text, warn }: { icon: keyof typeof Ionicons.glyphMap; text: string; warn?: boolean }) {
  return (
    <View style={[s.pill, warn && { backgroundColor: D.amberSoft }]}>
      <Ionicons name={icon} size={14} color={warn ? "#B8741F" : D.blue} />
      <Text style={[s.pillText, warn && { color: "#8A5A17" }]}>{text}</Text>
    </View>
  );
}

function Step({ n, title, code, hint }: { n: number; title: string; code?: string; hint?: string }) {
  return (
    <View style={s.step}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.metricName}>{title}</Text>
        {code ? <Text style={s.code}>{code}</Text> : null}
        {hint ? <Text style={s.metricWhat}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function Compare({ ok, title, heard, json, fixes }: { ok: boolean; title: string; heard: string; json: Record<string, string | null>; fixes?: { heard: string; fixed: string }[] }) {
  return (
    <View style={[s.compare, { backgroundColor: ok ? "#EAF6EF" : D.redSoft }]}>
      <Text style={[s.compareTitle, { color: ok ? D.green : D.red }]}>{title} {ok ? "✓" : "✗"}</Text>
      <Text style={s.body}>{heard || "(empty)"}</Text>
      {fixes?.length ? <Text style={s.fix}>{fixes.map((f) => `${f.heard} → ${f.fixed}`).join(" · ")}</Text> : null}
      <Text style={s.json}>{JSON.stringify(json)}</Text>
    </View>
  );
}

function SensorCard({ title, sub, unit, icon, tint, color, st }: {
  title: string; sub: string; unit: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: readonly [string, string]; color: string; st: SensorStats;
}) {
  return (
    <View style={[s.card, { flex: 1, overflow: "hidden", minHeight: 150 }]}>
      <LinearGradient colors={tint} start={{ x: 0.2, y: 0.1 }} end={{ x: 1, y: 1 }} style={s.blob}>
        <MaterialCommunityIcons name={icon} size={56} color={color} style={{ opacity: 0.85 }} />
      </LinearGradient>
      <Text style={s.metricWhat}>{sub}</Text>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={{ flex: 1, minHeight: 16 }} />
      {st ? (
        <View style={{ maxWidth: "70%" }}>
          <Text style={s.sensorVal}>±{st.mean_abs_error} <Text style={s.metricWhat}>{unit} average error</Text></Text>
          <Text style={s.body}>{st.within_tolerance_pct}% within ±{st.tolerance} · {st.sessions} sessions</Text>
        </View>
      ) : (
        <Text style={[s.metricWhat, { maxWidth: "68%" }]}>Not measured yet. Enter the manual count after each check, then run eval/sensor_accuracy.py.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 40, fontWeight: "500", color: D.ink, letterSpacing: -1 },
  sub: { fontSize: 17, color: D.muted, marginTop: 4, marginBottom: 20, maxWidth: 760 },
  h2: { fontSize: 22, fontWeight: "500", color: D.ink, marginTop: 28, marginBottom: 14 },
  body: { fontSize: 14, color: D.ink, lineHeight: 21 },
  card: { backgroundColor: D.card, borderRadius: 26, padding: 20, ...dashShadow },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "500", color: D.ink },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E5F5EC", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  badgeText: { fontSize: 13, fontWeight: "600", color: D.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, ...dashShadow },
  pillText: { fontSize: 13, color: D.blue, fontWeight: "500" },
  iconBlob: { width: 34, height: 34, borderRadius: 17, backgroundColor: D.blueSoft, alignItems: "center", justifyContent: "center" },
  step: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: D.pill, borderRadius: 18, padding: 12 },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: D.blue, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#fff", fontWeight: "700" },
  code: { fontFamily: "Courier", fontSize: 13, color: D.blue, marginTop: 3 },
  stat: { backgroundColor: "#fff", borderRadius: 26, padding: 20, ...dashShadow },
  statLabel: { fontSize: 15, color: D.muted, fontWeight: "500" },
  statIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.blueSoft, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 44, fontWeight: "300", color: D.ink, marginTop: 10, letterSpacing: -1 },
  statSub: { fontSize: 12, color: D.muted, marginTop: 2 },
  legend: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: D.muted },
  metric: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderTopColor: D.line },
  metricName: { fontSize: 15, fontWeight: "500", color: D.ink },
  metricWhat: { fontSize: 12, color: D.muted, marginTop: 1 },
  metricVal: { width: 50, textAlign: "right", fontSize: 13, color: D.ink },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: D.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  how: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  compare: { borderRadius: 16, padding: 12, marginBottom: 8 },
  compareTitle: { fontWeight: "700", fontSize: 14, marginBottom: 4 },
  fix: { fontSize: 12, color: D.ink, backgroundColor: D.amberSoft, borderRadius: 8, padding: 6, marginTop: 6, overflow: "hidden" },
  json: { fontSize: 11, color: D.muted, marginTop: 6, fontFamily: "Courier" },
  fail: { paddingVertical: 10 },
  blob: { position: "absolute", right: -26, top: 26, width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center" },
  sensorVal: { fontSize: 26, fontWeight: "300", color: D.ink },
});
