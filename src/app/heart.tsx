// Heart rate wellness check (not a medical test): 3 s of room sound with the phone in
// the hand, then 20 s with the phone pressed on the chest. Microphone samples are
// analysed in memory on the phone and thrown away; no audio file is ever written
// and nothing is sent to a server.
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream, type AudioStreamBuffer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { ChestGuide } from "../components/CheckArt";
import { analyseHeart, type HeartResult } from "../lib/heart";
import { HEART, type HeartFailReason } from "../lib/heartConfig";
import { motionAvailable, recordMotion } from "../lib/sensors";
import type { MotionSample } from "../lib/signal";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { C } from "../lib/theme";
import { useLang } from "../lib/language";

type Phase = "intro" | "baseline" | "place" | "chest" | "result";
const PLACE_SECONDS = 6;

const FAIL_LINE = {
  en: "The phone isn't touching your chest. Let's try again.",
  te: "Phone chest ki touch avvaledu. Malli try cheddam.",
  hi: "फ़ोन छाती से नहीं लगा है। फिर से कोशिश करते हैं।",
};
const REASON: Record<HeartFailReason, { en: string; te: string; hi: string }> = {
  not_on_chest: {
    en: "Not on the chest. Press the bottom edge of the phone (the microphone) firmly on the left side of the chest.",
    te: "ఛాతీ మీద లేదు. ఫోన్ కింది అంచు (మైక్) ఛాతీ ఎడమ వైపు గట్టిగా ఆనించండి.",
    hi: "छाती पर नहीं है। फ़ोन का निचला किनारा (माइक) छाती के बाएँ हिस्से पर दबाकर रखिए।",
  },
  no_rhythm: {
    en: "No steady heartbeat was heard. Lie still and quiet, and move the phone a little to the left of the breastbone.",
    te: "స్థిరమైన గుండె చప్పుడు వినిపించలేదు. కదలకుండా పడుకుని, ఫోన్‌ను కొంచెం ఎడమకు జరపండి.",
    hi: "स्थिर धड़कन नहीं सुनाई दी। शांत लेटिए और फ़ोन थोड़ा बाईं ओर कीजिए।",
  },
  too_much_movement: {
    en: "Too much movement. Lie down and keep still while it measures.",
    te: "ఎక్కువ కదలిక. పడుకుని కదలకుండా ఉండండి.",
    hi: "बहुत हलचल। लेटिए और शांत रहिए।",
  },
  noisy: {
    en: "Too noisy, or the beats were uneven. Don't talk, turn off the TV or fan, and try again.",
    te: "చాలా శబ్దం లేదా చప్పుడు సరిగా లేదు. మాట్లాడకండి, టీవీ/ఫ్యాన్ ఆపి మళ్ళీ ప్రయత్నించండి.",
    hi: "बहुत शोर, या धड़कन असमान थी। बात मत कीजिए, टीवी/पंखा बंद करके फिर कोशिश कीजिए।",
  },
};

export default function HeartCheck() {
  const { t, voice } = useLang();
  const [phase, setPhase] = useState<Phase>("intro");
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<HeartResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [saved, setSaved] = useState(false);
  const [details, setDetails] = useState(false);

  // Live microphone samples go into whichever bucket is active; nothing touches the disk.
  const target = useRef<"baseline" | "chest" | null>(null);
  const chunks = useRef<{ baseline: Float32Array[]; chest: Float32Array[] }>({ baseline: [], chest: [] });
  const rate = useRef<number>(HEART.sampleRate);
  const { stream } = useAudioStream({
    sampleRate: HEART.sampleRate, channels: 1, encoding: "float32",
    onBuffer: (b: AudioStreamBuffer) => {
      const bucket = target.current;
      if (!bucket) return;
      rate.current = b.sampleRate;
      const all = new Float32Array(b.data);
      // keep the first channel if the phone delivers more than one
      chunks.current[bucket].push(b.channels > 1 ? all.filter((_, i) => i % b.channels === 0) : all.slice());
    },
  });

  const countdown = (sec: number) => new Promise<void>((done) => {
    let n = sec; setLeft(n);
    const id = setInterval(() => { n -= 1; setLeft(Math.max(0, n)); if (n <= 0) { clearInterval(id); done(); } }, 1000);
  });

  async function begin() {
    setError(null); setResult(null); setSaved(false); setManual(""); setDetails(false);
    chunks.current = { baseline: [], chest: [] };
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) { setError(t({ en: "Microphone permission is needed. Settings > Expo Go > Microphone.", te: "మైక్ అనుమతి కావాలి. Settings > Expo Go > Microphone.", hi: "माइक की अनुमति चाहिए। Settings > Expo Go > Microphone." })); return; }
    const hasMotion = await motionAvailable();

    // speak BEFORE recording: the speaker would otherwise leak into the microphone
    await speak(t({ en: "Hold the phone in your hand and stay quiet for 3 seconds.", te: "ఫోన్ చేతిలో పట్టుకుని 3 సెకన్లు నిశ్శబ్దంగా ఉండండి.", hi: "फ़ोन हाथ में पकड़िए और 3 सेकंड चुप रहिए।" }), voice);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    try {
      await stream.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); return;
    }

    setPhase("baseline");
    target.current = "baseline";
    await countdown(HEART.baselineSeconds);
    target.current = null;

    setPhase("place");
    await speak(t({ en: "Now lie down and press the bottom of the phone on the left side of your chest. Keep still and don't talk.", te: "ఇప్పుడు పడుకుని, ఫోన్ కింది భాగాన్ని ఛాతీ ఎడమ వైపు ఆనించండి. కదలకండి, మాట్లాడకండి.", hi: "अब लेटिए और फ़ोन का निचला हिस्सा छाती के बाईं ओर रखिए। शांत रहिए, बात मत कीजिए।" }), voice);
    await countdown(PLACE_SECONDS);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setPhase("chest");
    target.current = "chest";
    const rec = hasMotion ? recordMotion(HEART.chestSeconds, HEART.motionIntervalMs) : null;
    await countdown(HEART.chestSeconds);
    target.current = null;
    rec?.stop();
    const motion: MotionSample[] | null = rec ? await rec.done : null;
    stream.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const join = (xs: Float32Array[]) => { const out = new Float32Array(xs.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of xs) { out.set(x, o); o += x.length; } return out; };
    const r = analyseHeart({ baseline: join(chunks.current.baseline), chest: join(chunks.current.chest), sampleRate: rate.current, motion });
    chunks.current = { baseline: [], chest: [] }; // drop the audio
    setResult(r);
    setPhase("result");
    if (r.ok) speak(t({ en: `Done. Your heart rate is about ${r.bpm} beats a minute.`, te: `పూర్తయింది. మీ గుండె వేగం నిమిషానికి సుమారు ${r.bpm}.`, hi: `हो गया। आपकी धड़कन लगभग ${r.bpm} प्रति मिनट है।` }), voice);
    else speak(t(FAIL_LINE), voice);
  }

  async function save() {
    if (!result?.ok) return;
    const manualCount = manual ? Number(manual) : null;
    await logEvent("heart_rate", `Heart rate wellness check: ${result.bpm}/min`, "normal",
      { bpm: result.bpm, manual_count: manualCount, method: "phone_mic_on_chest", metrics: result.metrics });
    setSaved(true);
  }

  const busy = phase === "baseline" || phase === "place" || phase === "chest";
  const m = result?.metrics;
  const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : v.toFixed(d));

  return (
    <Screen title={t({ en: "Heart rate", te: "గుండె వేగం", hi: "धड़कन" })} eyebrow={t({ en: "Wellness check · not a medical test", te: "ఆరోగ్య పరీక్ష · వైద్య పరీక్ష కాదు", hi: "वेलनेस जाँच · मेडिकल टेस्ट नहीं" })} icon="heart" tint="bloom">
      {phase === "intro" ? (
        <>
          <ChestGuide spot="heart" caption={t({ en: "Press the phone here", te: "ఫోన్ ఇక్కడ ఆనించండి", hi: "फ़ोन यहाँ रखिए" })} />
          <Card>
            {[
              t({ en: "Sit in a quiet room. Turn off the TV and fan.", te: "నిశ్శబ్ద గదిలో కూర్చోండి. టీవీ, ఫ్యాన్ ఆపండి.", hi: "शांत कमरे में बैठिए। टीवी और पंखा बंद कीजिए।" }),
              t({ en: "First 3 seconds: hold the phone in your hand, stay quiet.", te: "ముందు 3 సెకన్లు: ఫోన్ చేతిలో, నిశ్శబ్దంగా.", hi: "पहले 3 सेकंड: फ़ोन हाथ में, चुप रहिए।" }),
              t({ en: "Then lie down and press the bottom of the phone on the left side of your chest for 20 seconds.", te: "తర్వాత పడుకుని, ఫోన్ కింది భాగం ఛాతీ ఎడమ వైపు 20 సెకన్లు ఆనించండి.", hi: "फिर लेटिए और 20 सेकंड फ़ोन का निचला हिस्सा छाती के बाईं ओर रखिए।" }),
              t({ en: "Keep still and don't talk.", te: "కదలకండి, మాట్లాడకండి.", hi: "शांत रहिए, बात मत कीजिए।" }),
            ].map((s, i) => <Text key={i} style={[ui.body, { marginBottom: 6 }]}>{i + 1}. {s}</Text>)}
          </Card>
          <Text style={[ui.muted, { marginBottom: 12 }]}>
            {t({ en: "The sound is checked on the phone and deleted right away. It is never saved or uploaded.", te: "శబ్దం ఫోన్‌లోనే చూసి వెంటనే తీసేస్తాం. సేవ్ చేయం, పంపం.", hi: "आवाज़ फ़ोन पर ही जाँची जाती है और तुरंत हटा दी जाती है। सेव या अपलोड नहीं होती।" })}
          </Text>
          {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
          <BigButton label={t({ en: "Start", te: "మొదలుపెట్టండి", hi: "शुरू करें" })} onPress={begin} />
        </>
      ) : null}

      {busy ? (
        <>
        {phase !== "baseline" ? <ChestGuide spot="heart" big={left} bigLabel={t({ en: "seconds", te: "సెకన్లు", hi: "सेकंड" })} /> : null}
        <Card style={{ alignItems: "center", paddingVertical: 30 }}>
          <Text style={ui.h3}>
            {phase === "baseline" ? t({ en: "Phone in your hand. Stay quiet.", te: "ఫోన్ చేతిలో. నిశ్శబ్దంగా ఉండండి.", hi: "फ़ोन हाथ में। चुप रहिए।" })
              : phase === "place" ? t({ en: "Lie down. Press the phone on the left of your chest.", te: "పడుకోండి. ఫోన్ ఛాతీ ఎడమ వైపు ఆనించండి.", hi: "लेटिए। फ़ोन छाती के बाईं ओर रखिए।" })
              : t({ en: "Listening… keep still, don't talk.", te: "వింటున్నాను… కదలకండి, మాట్లాడకండి.", hi: "सुन रही हूँ… शांत रहिए, बात मत कीजिए।" })}
          </Text>
          <Text style={st.big}>{left}</Text>
          <Text style={ui.muted}>{t({ en: "seconds", te: "సెకన్లు", hi: "सेकंड" })}</Text>
        </Card>
        </>
      ) : null}

      {phase === "result" && result ? (
        <>
          {result.ok ? (
            <Card tone="green">
              <Text style={st.big}>{result.bpm}</Text>
              <Text style={[ui.h3, { textAlign: "center" }]}>{t({ en: "beats per minute", te: "నిమిషానికి చప్పుళ్లు", hi: "धड़कन प्रति मिनट" })}</Text>
              <Text style={[ui.muted, { textAlign: "center", marginTop: 6 }]}>{t({ en: "Heart rate wellness check. Not a medical test.", te: "ఆరోగ్య పరీక్ష మాత్రమే. వైద్య పరీక్ష కాదు.", hi: "वेलनेस जाँच। मेडिकल टेस्ट नहीं।" })}</Text>
            </Card>
          ) : (
            <Card tone="amber">
              <Text style={ui.h3}>{t(FAIL_LINE)}</Text>
              <Text style={[ui.body, { marginTop: 6 }]}>{t(REASON[result.reason])}</Text>
            </Card>
          )}

          {result.ok ? (
            <Card>
              <Text style={ui.h3}>{t({ en: "Compare (optional)", te: "పోల్చండి (ఐచ్ఛికం)", hi: "तुलना (वैकल्पिक)" })}</Text>
              <Text style={ui.muted}>{t({ en: "Pulse oximeter reading, or pulse counted by hand for 60 s.", te: "పల్స్ ఆక్సిమీటర్ రీడింగ్, లేదా 60 సెకన్లు చేత్తో లెక్కించిన పల్స్.", hi: "पल्स ऑक्सीमीटर रीडिंग, या 60 सेकंड हाथ से गिनी नब्ज़।" })}</Text>
              <TextInput keyboardType="number-pad" value={manual} onChangeText={setManual} placeholder="e.g. 72" style={st.input} />
              <BigButton label={saved ? t({ en: "Saved ✓", te: "సేవ్ అయింది ✓", hi: "सेव हो गया ✓" }) : t({ en: "Save and tell Ravi", te: "సేవ్ చేసి రవికి చెప్పు", hi: "सेव करें और रवि को बताएँ" })} onPress={save} disabled={saved} />
            </Card>
          ) : null}

          <Pressable onPress={() => setDetails((v) => !v)} style={{ alignSelf: "center", padding: 8 }}>
            <Text style={ui.muted}>{details ? "Hide details" : "Details (for tuning)"}</Text>
          </Pressable>
          {details && m ? (
            <Card>
              {!result.ok ? <Text style={[ui.body, { marginBottom: 6 }]}>Reason: {result.reason} · {result.why}</Text> : null}
              {[
                [`Heart band gain (≥ ${HEART.minHeartBandGain}x)`, fmt(m.heartBandGain, 1)],
                [`Room band gain (≤ ${HEART.maxRoomBandGain}x)`, fmt(m.roomBandGain, 1)],
                [`Heart band share (≥ ${HEART.minHeartBandShare})`, fmt(m.heartBandShare)],
                [`Rhythm score (≥ ${HEART.minPeriodicity})`, fmt(m.periodicity)],
                [`Beats (≥ ${HEART.minBeats})`, m.beats ?? "—"],
                [`Beat variation (≤ ${HEART.maxIntervalCv})`, fmt(m.intervalCv)],
                [`Shaking, m/s² (≤ ${HEART.maxShake})`, fmt(m.shake, 3)],
                [`Breathing motion, g (≥ ${HEART.minBreathingMotion})`, fmt(m.breathingMotion, 4)],
                ["Recorded", `${m.seconds.toFixed(1)} s at ${Math.round(m.sampleRate)} Hz, ${m.motionSamples} motion samples`],
              ].map(([k, v]) => (
                <View key={String(k)} style={st.row}><Text style={ui.muted}>{k}</Text><Text style={st.val}>{String(v)}</Text></View>
              ))}
              <Text style={[ui.muted, { marginTop: 8 }]}>Limits live in src/lib/heartConfig.ts.</Text>
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
  big: { fontSize: 72, fontWeight: "800", color: C.ink, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#E5E1EA", borderRadius: 14, padding: 14, fontSize: 20, marginVertical: 12, backgroundColor: "#fff" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 10 },
  val: { fontSize: 14, fontWeight: "600", color: C.ink },
});
