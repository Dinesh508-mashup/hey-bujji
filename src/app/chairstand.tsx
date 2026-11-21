import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { Trace } from "../components/Trace";
import { analyseChairStand, chairStandBelowAverage, type ChairStandResult } from "../lib/signal";
import { motionAvailable, recordMotion } from "../lib/sensors";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { C } from "../lib/theme";

const SECONDS = 30;
const AGE = 68; // demo family: Amma, 68

export default function ChairStand() {
  const [phase, setPhase] = useState<"intro" | "countdown" | "measuring" | "result">("intro");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ChairStandResult | null>(null);
  const [manual, setManual] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  async function begin() {
    setError(null); setSaved(false); setManual(""); setResult(null);
    if (!(await motionAvailable())) { setError("Motion sensor not available. Run this on the iPhone in Expo Go."); return; }
    setPhase("countdown");
    await speak("కుర్చీ మధ్యలో కూర్చోండి. ఫోన్‌ను ఛాతీకి పట్టుకోండి, చేతులు అడ్డంగా పెట్టండి. నేను మొదలు అన్నప్పుడు, ముప్పై సెకన్లు వీలైనన్ని సార్లు లేచి కూర్చోండి. మొదలు!", "te-IN");
    setPhase("measuring");
    const rec = recordMotion(SECONDS, 20, (t) => setElapsed(t));
    stopRef.current = rec.stop;
    const r = analyseChairStand(await rec.done);
    setResult(r);
    setPhase("result");
    speak(`ఆపండి. ${r.stands} సార్లు లేచారు.`, "te-IN");
  }

  async function save() {
    if (!result) return;
    const below = chairStandBelowAverage(result.stands, AGE, "female");
    await logEvent("chair_stand", `Chair stand: ${result.stands} in 30 s${below ? " (below average for age; consider a doctor's advice on leg strength)" : ""}`, "normal",
      { stands: result.stands, seconds: result.seconds, manual_count: manual ? Number(manual) : null, below_average: below });
    setSaved(true);
  }

  const below = result ? chairStandBelowAverage(result.stands, AGE, "female") : false;
  return (
    <Screen>
      {phase === "intro" ? (
        <>
          <Text style={ui.h2}>Chair stand test (30 s)</Text>
          <Card>
            <Text style={ui.body}>1. Sit in the middle of a sturdy chair without arms, against a wall.</Text>
            <Text style={ui.body}>2. Hold the phone flat against your chest, arms crossed.</Text>
            <Text style={ui.body}>3. On “start”, stand up fully and sit down as many times as you can in 30 seconds.</Text>
            <Text style={ui.body}>4. Someone should stand nearby. Stop if you feel unwell.</Text>
          </Card>
          {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
          <BigButton label="Start" onPress={begin} />
        </>
      ) : null}
      {phase === "countdown" || phase === "measuring" ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={st.big}>{phase === "countdown" ? "…" : Math.max(0, Math.ceil(SECONDS - elapsed))}</Text>
          <Text style={ui.h3}>{phase === "countdown" ? "Get ready" : "Stand up, sit down · లేవండి, కూర్చోండి"}</Text>
          <BigButton label="Stop" color={C.card} textColor={C.ink} onPress={() => stopRef.current?.()} style={{ marginTop: 30, width: "100%" }} />
        </View>
      ) : null}
      {phase === "result" && result ? (
        <>
          <Card tone={below ? "amber" : "green"}>
            <Text style={st.big}>{result.stands}</Text>
            <Text style={[ui.h3, { textAlign: "center" }]}>stands in {Math.round(result.seconds)} seconds</Text>
            <Text style={[ui.muted, { textAlign: "center", marginTop: 6 }]}>
              {below ? "Below average for a woman aged 65–69 (CDC STEADI: fewer than 11). Worth asking a doctor about leg strength and fall risk." : "At or above average for age (CDC STEADI reference)."}
            </Text>
            <Trace data={result.trace} color={C.marigold} />
            <Text style={[ui.muted, { fontSize: 12, textAlign: "center" }]}>App count not yet validated; compare with a manual count below.</Text>
          </Card>
          <Card>
            <Text style={ui.h3}>Manual count (for accuracy)</Text>
            <TextInput keyboardType="number-pad" value={manual} onChangeText={setManual} placeholder="stands counted by a helper" style={st.input} />
            <BigButton label={saved ? "Saved ✓" : "Save and tell Ravi"} onPress={save} disabled={saved} />
          </Card>
          <BigButton label="Try again" color={C.card} textColor={C.ink} onPress={begin} />
        </>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 88, fontWeight: "900", color: C.ink, textAlign: "center" },
  input: { fontSize: 20, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, marginVertical: 12, backgroundColor: "#fff", color: C.ink },
});
