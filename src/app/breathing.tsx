import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { Trace } from "../components/Trace";
import { analyseBreathing, type BreathingResult } from "../lib/signal";
import { motionAvailable, recordMotion } from "../lib/sensors";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { C } from "../lib/theme";

const SECONDS = 60;
type Phase = "intro" | "settle" | "measuring" | "result";

export default function Breathing() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<BreathingResult | null>(null);
  const [manual, setManual] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const halfSpoken = useRef(false);

  async function begin() {
    setError(null);
    setResult(null);
    setSaved(false);
    setManual("");
    if (!(await motionAvailable())) { setError("Motion sensor not available. Run this on the iPhone in Expo Go."); return; }
    setPhase("settle");
    await speak("ఫోన్ ఛాతీ మీద పెట్టి, కదలకుండా పడుకోండి. మాట్లాడకండి. మామూలుగా ఊపిరి తీసుకోండి. ఇప్పుడు మొదలుపెడుతున్నాను.", "te-IN");
    setPhase("measuring");
    halfSpoken.current = false;
    const rec = recordMotion(SECONDS, 50, (t) => {
      setElapsed(t);
      if (t > SECONDS / 2 && !halfSpoken.current) { halfSpoken.current = true; speak("సగం అయింది. అలాగే ఉండండి.", "te-IN"); }
    });
    stopRef.current = rec.stop;
    const samples = await rec.done;
    const r = analyseBreathing(samples);
    setResult(r);
    setPhase("result");
    if (r.quality === "good") {
      const msg = r.breathsPerMinute > 24 || r.breathsPerMinute < 10
        ? `నిమిషానికి ${Math.round(r.breathsPerMinute)} ఊపిరి. ఇది మామూలు కంటే వేరుగా ఉంది. డాక్టర్‌ని సంప్రదించండి. రవికి చెబుతున్నాను.`
        : `పూర్తయింది. నిమిషానికి ${Math.round(r.breathsPerMinute)} ఊపిరి. బాగుంది.`;
      speak(msg, "te-IN");
    } else {
      speak("కొంచెం కదలిక వచ్చింది. కదలకుండా, మాట్లాడకుండా మళ్ళీ చేద్దాం.", "te-IN");
    }
  }

  async function save() {
    if (!result) return;
    const bpm = Math.round(result.breathsPerMinute);
    const abnormal = bpm > 24 || bpm < 10;
    const manualCount = manual ? Number(manual) : null;
    await logEvent(
      "breathing",
      abnormal ? `Breathing check: ${bpm} breaths/min, outside the usual range. Suggest a doctor visit.` : `Breathing check: ${bpm} breaths/min, steady`,
      abnormal ? "high" : "normal",
      { bpm: result.breathsPerMinute, breaths: result.breaths, seconds: result.seconds, axis: result.axis, quality: result.quality, manual_count: manualCount, method: "phone_on_chest" },
    );
    setSaved(true);
  }

  const bpm = result ? Math.round(result.breathsPerMinute) : 0;
  return (
    <Screen>
      {phase === "intro" ? (
        <>
          <Text style={ui.h2}>ఊపిరి పరీక్ష · Breathing check</Text>
          <Card>
            <Text style={ui.body}>1. Lie down or recline. పడుకోండి.</Text>
            <Text style={ui.body}>2. Put the phone flat on your chest, screen up.</Text>
            <Text style={ui.body}>3. Earphones in. Bujji will guide you.</Text>
            <Text style={ui.body}>4. Stay still and don’t talk for 60 seconds.</Text>
          </Card>
          <Text style={[ui.muted, { marginBottom: 12 }]}>For the accuracy study, a helper counts breaths for the same 60 seconds and enters the count afterwards.</Text>
          {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
          <BigButton label="మొదలుపెట్టండి · Start" onPress={begin} />
        </>
      ) : null}

      {phase === "settle" || phase === "measuring" ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={st.big}>{phase === "settle" ? "…" : Math.max(0, Math.ceil(SECONDS - elapsed))}</Text>
          <Text style={ui.h3}>{phase === "settle" ? "Get comfortable" : "Breathe normally · మామూలుగా ఊపిరి"}</Text>
          <View style={st.bar}><View style={[st.fill, { width: `${Math.min(100, (elapsed / SECONDS) * 100)}%` }]} /></View>
          <BigButton label="Stop" color={C.card} textColor={C.ink} onPress={() => stopRef.current?.()} style={{ marginTop: 30, width: "100%" }} />
        </View>
      ) : null}

      {phase === "result" && result ? (
        <>
          {result.quality === "good" ? (
            <Card tone={bpm > 24 || bpm < 10 ? "amber" : "green"}>
              <Text style={st.big}>{bpm}</Text>
              <Text style={[ui.h3, { textAlign: "center" }]}>breaths per minute</Text>
              <Text style={[ui.muted, { textAlign: "center", marginTop: 6 }]}>
                {bpm > 24 || bpm < 10 ? "Outside the usual resting range (about 12–20). Consider seeing a doctor." : "Steady. Hey Bujji tracks this against your own normal over time."}
              </Text>
              <Trace data={result.trace} />
            </Card>
          ) : (
            <Card tone="amber">
              <Text style={ui.h3}>{result.quality === "too_short" ? "Too short" : "Too much movement"}</Text>
              <Text style={ui.body}>Stay still and don’t talk, then try again. కదలకుండా మళ్ళీ చేద్దాం.</Text>
            </Card>
          )}
          {result.quality === "good" ? (
            <Card>
              <Text style={ui.h3}>Helper’s manual count (optional)</Text>
              <TextInput keyboardType="number-pad" value={manual} onChangeText={setManual} placeholder="breaths counted in 60 s" style={st.input} />
              <BigButton label={saved ? "Saved ✓" : "Save and tell Ravi"} onPress={save} disabled={saved} />
            </Card>
          ) : null}
          <BigButton label="Try again" color={C.card} textColor={C.ink} onPress={begin} />
        </>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 88, fontWeight: "900", color: C.ink, textAlign: "center" },
  bar: { width: "100%", height: 14, backgroundColor: C.line, borderRadius: 7, marginTop: 20, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: C.teal },
  input: { fontSize: 20, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, marginVertical: 12, backgroundColor: "#fff", color: C.ink },
});
