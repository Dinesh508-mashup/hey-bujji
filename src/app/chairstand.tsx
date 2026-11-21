import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { Trace } from "../components/Trace";
import { analyseChairStand, chairStandBelowAverage, type ChairStandResult } from "../lib/signal";
import { motionAvailable, recordMotion } from "../lib/sensors";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { completeKind } from "../lib/tasks";
import { C } from "../lib/theme";
import { useLang } from "../lib/language";
import { BodyGuide, GuideControls, controlLabels, countWords, useCountIn, useStepCycle } from "../components/BodyGuide";

const SECONDS = 30;
const AGE = 68; // demo family: Amma, 68

export default function ChairStand() {
  const { t, voice } = useLang();
  const [phase, setPhase] = useState<"intro" | "countdown" | "measuring" | "result">("intro");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ChairStandResult | null>(null);
  const [manual, setManual] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [showText, setShowText] = useState(false);
  const countIn = useCountIn();
  const STEPS = [
    t({ en: "Sit in the middle of a sturdy chair without arms, against a wall", te: "గోడకు ఆనించిన, చేతులు లేని గట్టి కుర్చీ మధ్యలో కూర్చోండి", hi: "दीवार से सटी, बिना हत्थे की मज़बूत कुर्सी के बीच में बैठिए" }),
    t({ en: "Hold the phone flat against your chest, arms crossed", te: "ఫోన్‌ను ఛాతీకి పట్టుకోండి, చేతులు అడ్డంగా", hi: "फ़ोन को छाती से लगाइए, हाथ क्रॉस करके" }),
    t({ en: "On “start”, stand up fully and sit down as many times as you can in 30 seconds", te: "“మొదలు” అనగానే, 30 సెకన్లలో వీలైనన్ని సార్లు పూర్తిగా లేచి కూర్చోండి", hi: "“शुरू” पर, 30 सेकंड में जितनी बार हो सके पूरा उठिए और बैठिए" }),
    t({ en: "Someone should stand nearby. Stop if you feel unwell", te: "దగ్గర ఎవరైనా ఉండాలి. బాగోలేకపోతే ఆపండి", hi: "पास में कोई खड़ा रहे। तबीयत ठीक न लगे तो रुकिए" }),
  ];
  const step = useStepCycle(STEPS.length, 3500, phase === "intro");

  async function begin() {
    setError(null); setSaved(false); setManual(""); setResult(null);
    if (!(await motionAvailable())) { setError(t({ en: "Motion sensor not available. Run this on the iPhone in Expo Go.", te: "మోషన్ సెన్సార్ లేదు. iPhone లో Expo Go లో ప్రయత్నించండి.", hi: "मोशन सेंसर उपलब्ध नहीं है। iPhone पर Expo Go में चलाइए।" })); return; }
    setPhase("countdown");
    await speak(t({ en: "Sit in the middle of the chair. Hold the phone to your chest with your arms crossed. When I say start, stand up and sit down as many times as you can for thirty seconds.", te: "కుర్చీ మధ్యలో కూర్చోండి. ఫోన్‌ను ఛాతీకి పట్టుకోండి, చేతులు అడ్డంగా పెట్టండి. నేను మొదలు అన్నప్పుడు, ముప్పై సెకన్లు వీలైనన్ని సార్లు లేచి కూర్చోండి.", hi: "कुर्सी के बीच में बैठिए। फ़ोन को छाती से लगाइए, हाथ क्रॉस कीजिए। जब मैं शुरू कहूँ, तीस सेकंड में जितनी बार हो सके उठिए और बैठिए।" }), voice);
    await countIn.run(countWords(t), voice);
    setPhase("measuring");
    const rec = recordMotion(SECONDS, 20, (sec) => setElapsed(sec));
    stopRef.current = rec.stop;
    const r = analyseChairStand(await rec.done);
    setResult(r);
    setPhase("result");
    speak(t({ en: `Stop. You stood up ${r.stands} times.`, te: `ఆపండి. ${r.stands} సార్లు లేచారు.`, hi: `रुकिए। आप ${r.stands} बार उठे।` }), voice);
  }

  async function save() {
    if (!result) return;
    const below = chairStandBelowAverage(result.stands, AGE, "female");
    await logEvent("chair_stand", `Chair stand: ${result.stands} in 30 s${below ? " (below average for age; consider a doctor's advice on leg strength)" : ""}`, "normal",
      { stands: result.stands, seconds: result.seconds, manual_count: manual ? Number(manual) : null, below_average: below });
    await completeKind("chair_stand");
    setSaved(true);
  }

  const below = result ? chairStandBelowAverage(result.stands, AGE, "female") : false;
  return (
    <Screen title={t({ en: "Chair stand", te: "కుర్చీ వ్యాయామం", hi: "कुर्सी व्यायाम" })} eyebrow={t({ en: "Leg strength · 30 seconds", te: "కాళ్ళ బలం · 30 సెకన్లు", hi: "पैरों की ताकत · 30 सेकंड" })} icon="body" tint="mint">
      {phase === "intro" ? (
        <>
          <BodyGuide
            mode="chair"
            caption={STEPS[step]}
            big={step + 1}
            bigOf={String(STEPS.length)}
            bigLabel={t({ en: "step", te: "దశ", hi: "चरण" })}
            tag={t({ en: "30 s", te: "30 సె", hi: "30 से" })}
          />
          <GuideControls text={STEPS.join(". ")} voice={voice} showText={showText} onToggleText={() => setShowText((v) => !v)} labels={controlLabels(t)} />
          {showText ? (
            <Card>{STEPS.map((s, i) => <Text key={i} style={ui.body}>{i + 1}. {s}</Text>)}</Card>
          ) : null}
          {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
          <BigButton label={t({ en: "Start", te: "మొదలుపెట్టండి", hi: "शुरू करें" })} onPress={begin} />
        </>
      ) : null}
      {phase === "countdown" || phase === "measuring" ? (
        <View style={{ alignItems: "stretch" }}>
          <BodyGuide
            mode="chair"
            running={phase === "measuring"}
            count={countIn.count}
            caption={t({ en: "Get ready", te: "సిద్ధంగా ఉండండి", hi: "तैयार हो जाइए" })}
            cues={[t({ en: "Stand up", te: "లేవండి", hi: "उठिए" }), t({ en: "Sit down", te: "కూర్చోండి", hi: "बैठिए" })]}
            big={phase === "measuring" ? Math.max(0, Math.ceil(SECONDS - elapsed)) : null}
            bigOf={String(SECONDS)}
            bigLabel={t({ en: "seconds left", te: "సెకన్లు మిగిలాయి", hi: "सेकंड बाकी" })}
          />
          <Text style={[ui.h3, { textAlign: "center" }]}>{t({ en: "Stand up, sit down", te: "లేవండి, కూర్చోండి", hi: "उठिए, बैठिए" })}</Text>
          <BigButton label={t({ en: "Stop", te: "ఆపండి", hi: "रोकें" })} color={C.card} textColor={C.ink} onPress={() => stopRef.current?.()} style={{ marginTop: 30, width: "100%" }} />
        </View>
      ) : null}
      {phase === "result" && result ? (
        <>
          <Card tone={below ? "amber" : "green"}>
            <Text style={st.big}>{result.stands}</Text>
            <Text style={[ui.h3, { textAlign: "center" }]}>{t({ en: `stands in ${Math.round(result.seconds)} seconds`, te: `${Math.round(result.seconds)} సెకన్లలో లేచిన సార్లు`, hi: `${Math.round(result.seconds)} सेकंड में उठना` })}</Text>
            <Text style={[ui.muted, { textAlign: "center", marginTop: 6 }]}>
              {below
                ? t({ en: "Below average for a woman aged 65–69 (CDC STEADI: fewer than 11). Worth asking a doctor about leg strength and fall risk.", te: "65–69 వయసు మహిళకు సగటు కంటే తక్కువ (CDC STEADI: 11 కంటే తక్కువ). కాళ్ళ బలం, పడిపోయే ప్రమాదం గురించి డాక్టర్‌ని అడగండి.", hi: "65–69 उम्र की महिला के औसत से कम (CDC STEADI: 11 से कम)। पैरों की ताकत और गिरने के खतरे के बारे में डॉक्टर से पूछिए।" })
                : t({ en: "At or above average for age (CDC STEADI reference).", te: "వయసుకు సగటు లేదా అంతకంటే ఎక్కువ (CDC STEADI).", hi: "उम्र के औसत के बराबर या ज़्यादा (CDC STEADI)।" })}
            </Text>
            <Trace data={result.trace} color={C.green} />
            <Text style={[ui.muted, { fontSize: 12, textAlign: "center" }]}>{t({ en: "App count not yet validated; compare with a manual count below.", te: "యాప్ లెక్క ఇంకా ధృవీకరించలేదు; కింద చేతి లెక్కతో పోల్చండి.", hi: "ऐप की गिनती अभी जाँची नहीं गई; नीचे हाथ की गिनती से मिलाइए।" })}</Text>
          </Card>
          <Card>
            <Text style={ui.h3}>{t({ en: "Manual count (for accuracy)", te: "చేతి లెక్క (ఖచ్చితత్వం కోసం)", hi: "हाथ की गिनती (सटीकता के लिए)" })}</Text>
            <TextInput keyboardType="number-pad" value={manual} onChangeText={setManual} placeholder={t({ en: "stands counted by a helper", te: "సహాయకుడు లెక్కించినవి", hi: "सहायक की गिनती" })} style={st.input} />
            <BigButton label={saved ? t({ en: "Saved ✓", te: "సేవ్ అయింది ✓", hi: "सेव हो गया ✓" }) : t({ en: "Save and tell Ravi", te: "సేవ్ చేసి రవికి చెప్పు", hi: "सेव करें और रवि को बताएँ" })} onPress={save} disabled={saved} />
          </Card>
          <BigButton label={t({ en: "Try again", te: "మళ్ళీ ప్రయత్నించండి", hi: "फिर से करें" })} color={C.card} textColor={C.ink} onPress={begin} />
        </>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 84, fontWeight: "300", color: C.ink, textAlign: "center", letterSpacing: -2 },
  input: { fontSize: 18, borderRadius: 16, padding: 15, marginVertical: 12, backgroundColor: C.field, color: C.ink },
});
