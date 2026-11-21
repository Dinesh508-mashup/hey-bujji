// Results page: the accuracy table and failure examples. Reads only what
// eval/run_eval.py and eval/sensor_accuracy.py measured; never invents numbers.
import { StyleSheet, Text, View } from "react-native";
import { Card, Screen, styles as ui } from "../components/ui";
import { C } from "../lib/theme";
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
  status: "not_run" | "measured" | "text_only"; note?: string; run_at?: string; clips?: number; speakers?: string[];
  pipelines?: Record<string, PipelineSummary>; examples?: Example[];
  bujji_failures?: { sentence_id: string; speaker: string; truth: string; heard: string; wrong: string[] }[];
};
type SensorStats = { sessions: number; mean_abs_error: number; within_tolerance_pct: number; tolerance: number } | null;

const R = evalJson as EvalResults;
const S = sensorJson as { breathing: SensorStats; chair_stand: SensorStats };

const METRICS: [keyof PipelineSummary, string, string][] = [
  ["task_success", "Task success", "Whole JSON correct"],
  ["intent_accuracy", "Intent accuracy", "Right action chosen"],
  ["medicine", "Medicine names", "Exact medicine identified"],
  ["time", "Times", "Reminder at the right time"],
  ["contact", "Contacts", "Right person matched"],
  ["cer", "Character error rate", "Raw transcription (lower is better)"],
];
const ORDER = ["baseline", "indic_raw", "bujji"];

function fmt(v: number | null | undefined, key: string) {
  if (v === null || v === undefined) return "__";
  return key === "cer" ? v.toFixed(2) : `${v}%`;
}

export default function Results() {
  const measured = R.status === "measured" && R.pipelines;
  const cols = measured ? ORDER.filter((p) => R.pipelines![p]) : ["baseline", "bujji"];
  const label = (p: string) => (measured ? R.pipelines![p].label : p === "baseline" ? "Whisper" : "Hey Bujji");

  return (
    <Screen maxWidth={980}>
      <Text style={ui.h1}>Whisper vs Hey Bujji</Text>
      <Text style={[ui.muted, { marginBottom: 14 }]}>
        Same recordings, same LLM prompt. Only the speech model and the correction step differ.
      </Text>

      {!measured ? (
        <Card tone="amber">
          <Text style={ui.h3}>Not measured yet</Text>
          <Text style={ui.body}>{R.note ?? "Run the evaluation to fill this table."}</Text>
          <Text style={[ui.muted, { marginTop: 6 }]}>No number appears here until it is measured.</Text>
        </Card>
      ) : (
        <Text style={[ui.muted, { marginBottom: 10 }]}>
          {R.clips} clips · {R.speakers?.length} speakers · run {R.run_at?.replace("T", " ")}
        </Text>
      )}

      <View style={st.table}>
        <View style={[st.tr, st.thead]}>
          <Text style={[st.th, { flex: 2 }]}>Metric</Text>
          {cols.map((p) => <Text key={p} style={[st.th, st.num, p === "bujji" ? { color: C.teal } : null]}>{label(p)}</Text>)}
        </View>
        {METRICS.map(([key, name, what]) => {
          const vals = cols.map((p) => (measured ? (R.pipelines![p][key] as number | null) : null));
          const nums = vals.filter((v): v is number => v !== null);
          const best = nums.length ? (key === "cer" ? Math.min(...nums) : Math.max(...nums)) : null;
          return (
            <View key={key} style={st.tr}>
              <View style={{ flex: 2 }}>
                <Text style={st.td}>{name}</Text>
                <Text style={st.what}>{what}</Text>
              </View>
              {vals.map((v, i) => (
                <Text key={i} style={[st.td, st.num, v !== null && v === best ? st.best : null]}>{fmt(v, key)}</Text>
              ))}
            </View>
          );
        })}
      </View>

      {measured && R.pipelines!.bujji ? (
        <Card tone="teal">
          <Text style={ui.h3}>Where the gain comes from</Text>
          <Text style={ui.body}>
            {R.pipelines!.indic_raw ? `The Indian speech model alone reaches ${fmt(R.pipelines!.indic_raw.task_success, "")} task success. ` : ""}
            Before the list overrides, the LLM on corrected text scores {fmt(R.pipelines!.bujji.llm_only_task_success, "")}.
            {" "}{R.pipelines!.bujji.saved_by_overrides} clip(s) are correct only because the medicine, contact and time lists overrode the LLM.
          </Text>
          <Text style={[ui.muted, { marginTop: 6 }]}>Gains from the correction lists are still real gains for this family’s medicines and names.</Text>
        </Card>
      ) : null}

      {measured && R.examples?.length ? (
        <>
          <Text style={[ui.h2, { marginTop: 10 }]}>Where Whisper failed and Hey Bujji didn’t</Text>
          {R.examples.map((e) => (
            <Card key={`${e.sentence_id}-${e.speaker}`}>
              <Text style={ui.muted}>{e.sentence_id} · speaker {e.speaker}</Text>
              <Text style={[ui.h3, { marginTop: 2 }]}>“{e.truth}”</Text>
              <View style={st.pair}>
                <View style={[st.side, { borderColor: C.red }]}>
                  <Text style={[st.sideTitle, { color: C.red }]}>Whisper ✗</Text>
                  <Text style={st.heard}>{e.baseline_transcript || "(empty)"}</Text>
                  <Text style={st.json}>{JSON.stringify(e.baseline_json)}</Text>
                </View>
                <View style={[st.side, { borderColor: C.green }]}>
                  <Text style={[st.sideTitle, { color: C.green }]}>Hey Bujji ✓</Text>
                  <Text style={st.heard}>{e.bujji_transcript}</Text>
                  {e.fixes.length ? <Text style={st.fix}>{e.fixes.map((f) => `${f.heard} → ${f.fixed}`).join(" · ")}</Text> : null}
                  <Text style={st.json}>{JSON.stringify(e.bujji_json)}</Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {measured && R.bujji_failures?.length ? (
        <>
          <Text style={[ui.h2, { marginTop: 10 }]}>Where Hey Bujji still fails</Text>
          {R.bujji_failures.map((f) => (
            <View key={`${f.sentence_id}-${f.speaker}`} style={st.failRow}>
              <Text style={ui.body}>“{f.truth}” → heard “{f.heard}”</Text>
              <Text style={ui.muted}>wrong: {f.wrong.join(", ")} · {f.sentence_id}/{f.speaker}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={[ui.h2, { marginTop: 14 }]}>Sensor checks vs manual counts</Text>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <SensorCard title="Breathing (phone on chest)" unit="breaths/min" s={S.breathing} />
        <SensorCard title="Chair stand (30 s)" unit="stands" s={S.chair_stand} />
      </View>
      <Text style={[ui.muted, { marginTop: 8 }]}>No accuracy claim is made until it is measured. Wellness checks only, not a medical device.</Text>
    </Screen>
  );
}

function SensorCard({ title, unit, s }: { title: string; unit: string; s: SensorStats }) {
  return (
    <Card style={{ flex: 1, minWidth: 260 }}>
      <Text style={ui.h3}>{title}</Text>
      {s ? (
        <>
          <Text style={ui.body}>Average error: {s.mean_abs_error} {unit}</Text>
          <Text style={ui.body}>Within ±{s.tolerance}: {s.within_tolerance_pct}%</Text>
          <Text style={ui.muted}>{s.sessions} sessions with a manual count</Text>
        </>
      ) : <Text style={ui.muted}>Not measured yet. Enter manual counts in the app, then run eval/sensor_accuracy.py.</Text>}
    </Card>
  );
}

const st = StyleSheet.create({
  table: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1.5, borderColor: C.line, overflow: "hidden", marginBottom: 16 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: C.line },
  thead: { backgroundColor: C.tealSoft, borderTopWidth: 0 },
  th: { fontWeight: "800", color: C.ink, fontSize: 15 },
  td: { fontSize: 17, color: C.ink, fontWeight: "600" },
  what: { fontSize: 13, color: C.muted },
  num: { flex: 1, textAlign: "right" },
  best: { color: C.teal, fontWeight: "900" },
  pair: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 },
  side: { flex: 1, minWidth: 240, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  sideTitle: { fontWeight: "900", fontSize: 16, marginBottom: 4 },
  heard: { fontSize: 16, color: C.ink },
  fix: { fontSize: 13, color: C.ink, backgroundColor: C.marigoldSoft, borderRadius: 8, padding: 6, marginTop: 6, overflow: "hidden" },
  json: { fontSize: 12, color: C.muted, marginTop: 6, fontFamily: "Courier" },
  failRow: { backgroundColor: C.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line },
});
