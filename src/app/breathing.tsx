import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { Trace } from "../components/Trace";
import { analyseBreathing, type BreathingResult } from "../lib/signal";
import { motionAvailable, recordMotion } from "../lib/sensors";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { completeKind } from "../lib/tasks";
import { C } from "../lib/theme";
import { useLang } from "../lib/language";
import { ChestGuide } from "../components/CheckArt";
import { GuideControls, controlLabels, countWords, useCountIn, useStepCycle } from "../components/BodyGuide";

const SECONDS = 60;
type Phase = "intro" | "settle" | "measuring" | "result";

export default function Breathing() {
  const { t, voice } = useLang();
  const [phase, setPhase] = useState<Phase>("intro");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<BreathingResult | null>(null);
  const [manual, setManual] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [showText, setShowText] = useState(false);
  const countIn = useCountIn();
  const STEPS = [
    t({ en: "Lie down or recline", te: "పడుకోండి లేదా వెనక్కి వాలండి", hi: "लेट जाइए या टेक लगाइए" }),
    t({ en: "Put the phone flat on your chest, screen up", te: "ఫోన్‌ను ఛాతీ మీద, స్క్రీన్ పైకి పెట్టండి", hi: "फ़ोन को छाती पर सीधा रखिए, स्क्रीन ऊपर" }),
    t({ en: "Earphones in. Bujji will guide you", te: "ఇయర్‌ఫోన్లు పెట్టుకోండి. బుజ్జి చెబుతుంది", hi: "ईयरफ़ोन लगाइए। बुज्जी बताएगी" }),
    t({ en: "Stay still and don’t talk for 60 seconds", te: "60 సెకన్లు కదలకుండా, మాట్లాడకుండా ఉండండి", hi: "60 सेकंड शांत रहिए, बात मत कीजिए" }),
  ];
  const step = useStepCycle(STEPS.length, 3500, phase === "intro");
  const halfSpoken = useRef(false);

  async function begin() {
    setError(null);
    setResult(null);
    setSaved(false);
    setManual("");
    if (!(await motionAvailable())) { setError(t({ en: "Motion sensor not available. Run this on the iPhone in Expo Go.", te: "మోషన్ సెన్సార్ లేదు. iPhone లో Expo Go లో ప్రయత్నించండి.", hi: "मोशन सेंसर उपलब्ध नहीं है। iPhone पर Expo Go में चलाइए।" })); return; }
    setPhase("settle");
    await speak(t({ en: "Put the phone on your chest and lie still. Don't talk. Breathe normally. Starting now.", te: "ఫోన్ ఛాతీ మీద పెట్టి, కదలకుండా పడుకోండి. మాట్లాడకండి. మామూలుగా ఊపిరి తీసుకోండి. ఇప్పుడు మొదలుపెడుతున్నాను.", hi: "फ़ोन छाती पर रखिए और शांत लेटिए। बात मत कीजिए। सामान्य साँस लीजिए। अब शुरू कर रही हूँ।" }), voice);
    await countIn.run(countWords(t), voice);
    setPhase("measuring");
    halfSpoken.current = false;
    const rec = recordMotion(SECONDS, 50, (sec) => {
      setElapsed(sec);
      if (sec > SECONDS / 2 && !halfSpoken.current) { halfSpoken.current = true; speak(t({ en: "Halfway there. Stay still.", te: "సగం అయింది. అలాగే ఉండండి.", hi: "आधा हो गया। ऐसे ही रहिए।" }), voice); }
    });
    stopRef.current = rec.stop;
    const samples = await rec.done;
    const r = analyseBreathing(samples);
    setResult(r);
    setPhase("result");
    if (r.quality === "good") {
      const msg = r.breathsPerMinute > 24 || r.breathsPerMinute < 10
        ? t({ en: `${Math.round(r.breathsPerMinute)} breaths a minute. That is outside the usual range. Please see a doctor. I am telling Ravi.`, te: `నిమిషానికి ${Math.round(r.breathsPerMinute)} ఊపిరి. ఇది మామూలు కంటే వేరుగా ఉంది. డాక్టర్‌ని సంప్రదించండి. రవికి చెబుతున్నాను.`, hi: `एक मिनट में ${Math.round(r.breathsPerMinute)} साँसें। यह सामान्य से अलग है। डॉक्टर से मिलिए। रवि को बता रही हूँ।` })
        : t({ en: `Done. ${Math.round(r.breathsPerMinute)} breaths a minute. That's good.`, te: `పూర్తయింది. నిమిషానికి ${Math.round(r.breathsPerMinute)} ఊపిరి. బాగుంది.`, hi: `हो गया। एक मिनट में ${Math.round(r.breathsPerMinute)} साँसें। अच्छा है।` });
      speak(msg, voice);
    } else {
      speak(t({ en: "There was some movement. Let's try again, staying still and quiet.", te: "కొంచెం కదలిక వచ్చింది. కదలకుండా, మాట్లాడకుండా మళ్ళీ చేద్దాం.", hi: "थोड़ी हलचल हुई। शांत और चुप रहकर फिर से करते हैं।" }), voice);
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
    await completeKind("breathing");
    setSaved(true);
  }

  const bpm = result ? Math.round(result.breathsPerMinute) : 0;
  return (
    <Screen title={t({ en: "Breathing check", te: "ఊపిరి పరీక్ష", hi: "साँस की जाँच" })} eyebrow={t({ en: "60 seconds", te: "60 సెకన్లు", hi: "60 सेकंड" })} icon="leaf" tint="dawn">
      {phase === "intro" ? (
        <>
          <ChestGuide spot="breathing" caption={STEPS[step]} big={`${step + 1}/${STEPS.length}`} bigLabel={t({ en: "step", te: "దశ", hi: "चरण" })} />
          <GuideControls text={STEPS.join(". ")} voice={voice} showText={showText} onToggleText={() => setShowText((v) => !v)} labels={controlLabels(t)} />
          {showText ? (
            <Card>{STEPS.map((s, i) => <Text key={i} style={ui.body}>{i + 1}. {s}</Text>)}</Card>
          ) : null}
          <Text style={[ui.muted, { marginBottom: 12 }]}>{t({ en: "For the accuracy study, a helper counts breaths for the same 60 seconds and enters the count afterwards.", te: "ఖచ్చితత్వ పరీక్ష కోసం, సహాయకుడు అదే 60 సెకన్లు ఊపిరి లెక్కపెట్టి తర్వాత నమోదు చేస్తారు.", hi: "सटीकता जाँच के लिए, सहायक उन्हीं 60 सेकंड में साँसें गिनकर बाद में दर्ज करता है।" })}</Text>
          {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
          <BigButton label={t({ en: "Start", te: "మొదలుపెట్టండి", hi: "शुरू करें" })} onPress={begin} />
        </>
      ) : null}

      {phase === "settle" || phase === "measuring" ? (
        <View style={{ alignItems: "stretch" }}>
          <ChestGuide
            spot="breathing"
            caption={phase === "measuring" ? t({ en: "Breathe in… breathe out", te: "ఊపిరి పీల్చండి… వదలండి", hi: "साँस लीजिए… छोड़िए" }) : countIn.count !== null ? String(countIn.count) : t({ en: "Get comfortable", te: "సౌకర్యంగా ఉండండి", hi: "आराम से हो जाइए" })}
            big={phase === "measuring" ? Math.max(0, Math.ceil(SECONDS - elapsed)) : null}
            bigLabel={t({ en: "seconds left", te: "సెకన్లు మిగిలాయి", hi: "सेकंड बाकी" })}
          />
          <Text style={[ui.h3, { textAlign: "center" }]}>{t({ en: "Breathe normally", te: "మామూలుగా ఊపిరి తీసుకోండి", hi: "सामान्य साँस लीजिए" })}</Text>
          <View style={st.bar}><View style={[st.fill, { width: `${Math.min(100, (elapsed / SECONDS) * 100)}%` }]} /></View>
          <BigButton label={t({ en: "Stop", te: "ఆపండి", hi: "रोकें" })} color={C.card} textColor={C.ink} onPress={() => stopRef.current?.()} style={{ marginTop: 30, width: "100%" }} />
        </View>
      ) : null}

      {phase === "result" && result ? (
        <>
          {result.quality === "good" ? (
            <Card tone={bpm > 24 || bpm < 10 ? "amber" : "green"}>
              <Text style={st.big}>{bpm}</Text>
              <Text style={[ui.h3, { textAlign: "center" }]}>{t({ en: "breaths per minute", te: "నిమిషానికి ఊపిరి", hi: "साँसें प्रति मिनट" })}</Text>
              <Text style={[ui.muted, { textAlign: "center", marginTop: 6 }]}>
                {bpm > 24 || bpm < 10
                  ? t({ en: "Outside the usual resting range (about 12–20). Consider seeing a doctor.", te: "సాధారణ పరిధి (సుమారు 12–20) బయట ఉంది. డాక్టర్‌ని సంప్రదించండి.", hi: "सामान्य सीमा (लगभग 12–20) से बाहर। डॉक्टर से मिलिए।" })
                  : t({ en: "Steady. Hey Bujji tracks this against your own normal over time.", te: "స్థిరంగా ఉంది. హే బుజ్జి దీన్ని మీ సాధారణంతో పోల్చి చూస్తుంది.", hi: "स्थिर है। हे बुज्जी इसे आपके सामान्य से मिलाती रहेगी।" })}
              </Text>
              <Trace data={result.trace} />
            </Card>
          ) : (
            <Card tone="amber">
              <Text style={ui.h3}>{result.quality === "too_short" ? t({ en: "Too short", te: "చాలా తక్కువ సమయం", hi: "बहुत छोटा" }) : t({ en: "Too much movement", te: "ఎక్కువ కదలిక", hi: "बहुत ज़्यादा हलचल" })}</Text>
              <Text style={ui.body}>{t({ en: "Stay still and don’t talk, then try again.", te: "కదలకుండా, మాట్లాడకుండా మళ్ళీ చేద్దాం.", hi: "शांत रहिए, बात मत कीजिए, फिर से कोशिश कीजिए।" })}</Text>
            </Card>
          )}
          {result.quality === "good" ? (
            <Card>
              <Text style={ui.h3}>{t({ en: "Helper’s manual count (optional)", te: "సహాయకుడి లెక్క (ఐచ్ఛికం)", hi: "सहायक की गिनती (वैकल्पिक)" })}</Text>
              <TextInput keyboardType="number-pad" value={manual} onChangeText={setManual} placeholder={t({ en: "breaths counted in 60 s", te: "60 సెకన్లలో ఊపిరి లెక్క", hi: "60 सेकंड में गिनी साँसें" })} style={st.input} />
              <BigButton label={saved ? t({ en: "Saved ✓", te: "సేవ్ అయింది ✓", hi: "सेव हो गया ✓" }) : t({ en: "Save and tell Ravi", te: "సేవ్ చేసి రవికి చెప్పు", hi: "सेव करें और रवि को बताएँ" })} onPress={save} disabled={saved} />
            </Card>
          ) : null}
          <BigButton label={t({ en: "Try again", te: "మళ్ళీ ప్రయత్నించండి", hi: "फिर से करें" })} color={C.card} textColor={C.ink} onPress={begin} />
        </>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 84, fontWeight: "300", color: C.ink, textAlign: "center", letterSpacing: -2 },
  bar: { width: "100%", height: 10, backgroundColor: C.marigoldSoft, borderRadius: 5, marginTop: 20, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: C.marigold, borderRadius: 5 },
  input: { fontSize: 18, borderRadius: 16, padding: 15, marginVertical: 12, backgroundColor: C.field, color: C.ink },
});
