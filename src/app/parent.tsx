import { useEffect, useState } from "react";
import { FoodOrderCard, RideCard } from "../components/Orders";
import { Animated, Easing, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Orb, S, SectionHeader, type IconName } from "../components/soft";
import * as Haptics from "expo-haptics";
import { BigButton, Card, Disclaimer, Screen, SetupBanner, styles as ui } from "../components/ui";
import { type BujjiResult, sendText, sendVoice } from "../lib/api";
import { useVoiceRecorder } from "../lib/audio";
import { speak, stopSpeaking } from "../lib/speak";
import { scheduleDailyReminder } from "../lib/reminders";
import { completeKind } from "../lib/tasks";
import { supabase } from "../lib/supabase";
import { FAMILY_ID } from "../lib/config";
import { C, shadow } from "../lib/theme";
import { replyIn, useLang, type Lang } from "../lib/language";

type Phase = "idle" | "listening" | "thinking" | "done" | "error";

const EXAMPLES_EN = [
  "I took my BP tablet",
  "Remind me to take my sugar tablet at 8 pm",
  "Call my son",
  "I have chest pain",
  "The bank called and asked for my OTP",
  "I feel dizzy",
];
const EXAMPLES_IN = [
  "Naa BP tablet teesukunna",
  "Raatri 8 ki sugar tablet gurthu cheyyi",
  "Abbayiki call cheyyi",
  "Chest lo noppi ga undi",
  "Bank nundi call, OTP adigaru",
  "Seene mein dard hai",
];

function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const DATE_LOCALE: Record<Lang, string> = { en: "en-IN", te: "te-IN", hi: "hi-IN" };

export default function Parent() {
  const { lang, voice, t } = useLang();
  const EXAMPLES = lang === "en" ? EXAMPLES_EN : EXAMPLES_IN;
  const { recording, start, stop } = useVoiceRecorder(12);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<BujjiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [sonPhone, setSonPhone] = useState<string | null>(null);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    supabase.from("contacts").select("phone, relation").eq("family_id", FAMILY_ID).eq("relation", "son").limit(1)
      .then(({ data }) => setSonPhone(data?.[0]?.phone ?? null));
  }, []);

  useEffect(() => {
    if (phase !== "listening") { pulse.stopAnimation(); pulse.setValue(0); return; }
    Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
  }, [phase, pulse]);

  async function handleResult(r: BujjiResult) {
    setResult(r);
    setPhase("done");
    setNote(null);
    const a = r.action;
    if (a.type === "emergency") {
      setEmergency(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (r.intent.intent === "scam_report") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (r.intent.intent === "took_medicine") completeKind("medicine").catch(() => {});
    if (a.type === "reminder") {
      const id = await scheduleDailyReminder(a.time, a.medicine).catch(() => null);
      setNote(id
        ? t({ en: `⏰ Reminder set every day at ${clock(a.time)}`, te: `⏰ ప్రతి రోజు ${clock(a.time)} కి గుర్తు చేస్తాను`, hi: `⏰ रोज़ ${clock(a.time)} बजे याद दिलाऊँगी` })
        : t({ en: `⏰ ${clock(a.time)} (allow notifications to get the alert)`, te: `⏰ ${clock(a.time)} (అలర్ట్ కోసం నోటిఫికేషన్లు అనుమతించండి)`, hi: `⏰ ${clock(a.time)} (अलर्ट के लिए सूचनाएँ चालू करें)` }));
    }
    const say = replyIn(r.reply, lang);
    await speak(say.text, say.voice);
    if (a.type === "call") Linking.openURL(`tel:${a.phone}`).catch(() => setNote(t({ en: `Could not open the dialler for ${a.phone}`, te: `${a.phone} కి డయల్ చేయలేకపోయాను`, hi: `${a.phone} पर डायल नहीं हो पाया` })));
  }

  async function run(fn: () => Promise<BujjiResult>) {
    setPhase("thinking");
    setError(null);
    try {
      await handleResult(await fn());
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
      speak(t({ en: "Sorry, please try again.", te: "క్షమించండి, మళ్ళీ ప్రయత్నించండి.", hi: "माफ़ कीजिए, फिर से कोशिश कीजिए।" }), voice);
    }
  }

  async function onMic() {
    if (phase === "thinking") return;
    if (recording) {
      const uri = await stop();
      if (uri) run(() => sendVoice(uri)); else setPhase("idle");
      return;
    }
    await stopSpeaking();
    setResult(null);
    setError(null);
    try {
      await start((uri) => { if (uri) run(() => sendVoice(uri)); });
      setPhase("listening");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const micLabel = phase === "listening"
    ? t({ en: "Listening… tap to stop", te: "వింటున్నాను… ఆపడానికి నొక్కండి", hi: "सुन रही हूँ… रोकने के लिए दबाइए" })
    : phase === "thinking" ? t({ en: "Thinking…", te: "ఆలోచిస్తున్నాను…", hi: "सोच रही हूँ…" }) : "Hey Bujji";
  const micSub = phase === "listening" ? t({ en: "Speak now", te: "ఇప్పుడు మాట్లాడండి", hi: "अब बोलिए" })
    : phase === "thinking" ? t({ en: "One moment", te: "ఒక్క నిమిషం", hi: "एक पल" })
    : t({ en: "Tap and speak in English, Telugu or Hindi", te: "నొక్కి మాట్లాడండి", hi: "दबाइए और बोलिए" });
  const shown = result ? replyIn(result.reply, lang) : null;
  const tone = result?.intent.urgency === "urgent" ? "red" : result?.intent.intent === "scam_report" ? "amber" : "teal";

  return (
    <Screen
      title={t({ en: "Hello Amma", te: "నమస్తే అమ్మా", hi: "नमस्ते अम्मा" })}
      eyebrow={new Date().toLocaleDateString(DATE_LOCALE[lang], { weekday: "long", day: "numeric", month: "long" })}
      icon="mic"
      tint="bloom"
    >
      <SetupBanner />

      <View style={s.micWrap}>
        {phase === "listening" ? (
          <Animated.View style={[s.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] }]} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hey Bujji microphone"
          onPress={onMic}
          style={({ pressed }) => [s.mic, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <LinearGradient
            colors={phase === "listening" ? ["#FF9A9E", "#E5484D"] : phase === "thinking" ? ["#E4DCFA", "#9B87E8"] : ["#FFD3A8", "#F7A35C"]}
            start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 1 }} style={s.micFill}>
            <Ionicons name={phase === "listening" ? "stop" : phase === "thinking" ? "ellipsis-horizontal" : "mic"} size={58} color="#fff" />
            <Text style={s.micLabel}>{micLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
      <Text style={[ui.muted, { textAlign: "center", marginBottom: 18 }]}>{micSub}</Text>

      {error ? (
        <Card tone="amber"><Text style={ui.h3}>{t({ en: "Something went wrong", te: "ఏదో తప్పు జరిగింది", hi: "कुछ गड़बड़ हो गई" })}</Text><Text style={ui.muted}>{error}</Text></Card>
      ) : null}

      {result ? (
        <Card tone={tone}>
          <Text style={s.replyText}>{shown?.text}</Text>
          {shown?.sub ? <Text style={[ui.muted, { marginTop: 6 }]}>{shown.sub}</Text> : null}
          {note ? <Text style={[ui.body, { marginTop: 10, fontWeight: "700" }]}>{note}</Text> : null}
          {result.action.type === "call" ? <Text style={[ui.body, { marginTop: 10, fontWeight: "700" }]}>📞 {t({ en: "Calling", te: "కాల్ చేస్తున్నాను:", hi: "फ़ोन लगा रही हूँ:" })} {result.action.name} ({result.action.relation})</Text> : null}
          {result.action.type === "dial" ? (
            <BigButton style={{ marginTop: 12 }} color={C.red} label={t({ en: "Call 1930", te: "1930 కి కాల్ చేయండి", hi: "1930 पर कॉल करें" })} sub={t({ en: "Cyber fraud helpline · call now", te: "సైబర్ మోసం హెల్ప్‌లైన్", hi: "साइबर धोखाधड़ी हेल्पलाइन" })} onPress={() => Linking.openURL("tel:1930")} />
          ) : null}
          {result.action.type === "order" ? <FoodOrderCard orderId={result.action.order_id} items={result.action.items} /> : null}
          {result.action.type === "cab" && result.action.ride ? <RideCard ride={result.action.ride} destination={result.action.destination} /> : null}
          {result.action.type === "emergency" && !emergency ? (
            <BigButton style={{ marginTop: 12 }} color={C.red} label={t({ en: "Call 108", te: "108 కి కాల్", hi: "108 पर कॉल" })} onPress={() => setEmergency(true)} />
          ) : null}
          <View style={s.heard}>
            <Text style={s.heardLabel}>{t({ en: "Heard", te: "విన్నది", hi: "सुना" })}</Text>
            <Text style={s.heardText}>{result.transcript || "—"}</Text>
            {result.correction?.fixes.length ? (
              <View style={s.chips}>
                {result.correction.fixes.map((f, i) => (
                  <Text key={i} style={s.chip}>{f.heard} → {f.fixed}</Text>
                ))}
              </View>
            ) : null}
            <Text style={s.meta}>{result.stt?.provider ?? "typed"} · {result.llmSource} · {(result.ms / 1000).toFixed(1)}s</Text>
          </View>
        </Card>
      ) : null}

      <SectionHeader title={t({ en: "Check today", te: "ఈ రోజు పరీక్షలు", hi: "आज की जाँच" })} />
      <View style={s.grid}>
        <Tile icon="shield-checkmark" tint={S.sky} label={t({ en: "Bujji, check this", te: "బుజ్జీ, ఇది చూడు", hi: "बुज्जी, यह देखो" })} sub={t({ en: "Message or screenshot", te: "మెసేజ్ / స్క్రీన్‌షాట్", hi: "मैसेज / स्क्रीनशॉट" })} onPress={() => router.push("/check")} />
        <Tile icon="leaf" tint={S.peach} label={t({ en: "Breathing", te: "ఊపిరి", hi: "साँस" })} sub={t({ en: "Phone on chest", te: "ఫోన్ ఛాతీ మీద", hi: "फ़ोन छाती पर" })} onPress={() => router.push("/breathing")} />
        <Tile icon="body" tint={S.sage} label={t({ en: "Chair stand", te: "కుర్చీ వ్యాయామం", hi: "कुर्सी व्यायाम" })} sub={t({ en: "30 seconds", te: "30 సెకన్లు", hi: "30 सेकंड" })} onPress={() => router.push("/chairstand")} />
        <Tile icon="moon" tint={S.lilac} label={t({ en: "Memory", te: "జ్ఞాపకశక్తి", hi: "याददाश्त" })} sub={t({ en: "3 words", te: "3 పదాలు", hi: "3 शब्द" })} onPress={() => router.push("/memory")} />
      </View>

      <Pressable onPress={() => setTyping((t) => !t)} style={{ alignSelf: "center", padding: 10 }}>
        <Text style={[ui.muted, { textDecorationLine: "underline" }]}>{typing ? t({ en: "Hide typing", te: "టైపింగ్ దాచు", hi: "टाइपिंग छिपाएँ" }) : t({ en: "Type instead (for testing)", te: "టైప్ చేయండి (టెస్టింగ్)", hi: "टाइप करें (टेस्टिंग)" })}</Text>
      </Pressable>
      {typing ? (
        <Card>
          <TextInput value={typed} onChangeText={setTyped} placeholder={`e.g. ${EXAMPLES[0]}`} style={s.input} onSubmitEditing={() => typed && run(() => sendText(typed))} />
          <BigButton label={t({ en: "Send", te: "పంపండి", hi: "भेजें" })} onPress={() => typed && run(() => sendText(typed))} disabled={!typed || phase === "thinking"} />
          <View style={s.chips}>
            {EXAMPLES.map((e) => (
              <Pressable key={e} onPress={() => { setTyped(e); run(() => sendText(e)); }}>
                <Text style={s.chip}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Disclaimer />

      <Modal visible={emergency} animationType="fade" onRequestClose={() => setEmergency(false)}>
        <View style={s.emergency}>
          <Text style={s.emTitle}>⚠️ {t({ en: "Call 108?", te: "108 కి కాల్ చేయాలా?", hi: "108 पर कॉल करें?" })}</Text>
          <Text style={s.emSub}>{t({ en: "Call the 108 ambulance? Ravi has been alerted.", te: "108 అంబులెన్స్‌కి కాల్ చేయాలా? రవికి చెప్పాను.", hi: "108 एम्बुलेंस बुलाएँ? रवि को बता दिया है।" })}</Text>
          <BigButton color="#fff" textColor={C.red} label={t({ en: "📞 Call 108", te: "📞 108 కి కాల్", hi: "📞 108 पर कॉल" })} sub={t({ en: "Ambulance", te: "అంబులెన్స్", hi: "एम्बुलेंस" })} onPress={() => Linking.openURL("tel:108")} style={{ width: "100%" }} />
          {sonPhone ? (
            <BigButton color="#fff" textColor={C.ink} label={t({ en: "📞 Call Ravi", te: "📞 రవికి కాల్", hi: "📞 रवि को कॉल" })} sub={t({ en: "Your son", te: "అబ్బాయి", hi: "बेटा" })} onPress={() => Linking.openURL(`tel:${sonPhone}`)} style={{ width: "100%" }} />
          ) : null}
          <BigButton color="transparent" textColor="#fff" label={t({ en: "I'm okay", te: "నేను బాగున్నాను", hi: "मैं ठीक हूँ" })} onPress={() => setEmergency(false)} style={{ width: "100%", borderWidth: 2, borderColor: "#fff" }} />
          <Text style={[s.emSub, { fontSize: 13, marginTop: 18 }]}>{t({ en: "Hey Bujji is not a medical device. In an emergency, call 108.", te: "హే బుజ్జి వైద్య పరికరం కాదు. అత్యవసరంలో 108 కి కాల్ చేయండి.", hi: "हे बुज्जी चिकित्सा उपकरण नहीं है। आपात स्थिति में 108 पर कॉल करें।" })}</Text>
        </View>
      </Modal>
    </Screen>
  );
}

function Tile({ icon, tint, label, sub, onPress }: { icon: IconName; tint: readonly [string, string]; label: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.tile, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <Orb icon={icon} tint={tint} size={44} />
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileSub}>{sub}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  micWrap: { alignItems: "center", justifyContent: "center", height: 250, marginBottom: 6 },
  ring: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: C.red },
  mic: { width: 220, height: 220, borderRadius: 110, borderWidth: 8, borderColor: "rgba(255,255,255,0.9)", ...shadow, shadowOpacity: 0.18 },
  micFill: { flex: 1, borderRadius: 110, alignItems: "center", justifyContent: "center" },
  micLabel: { fontSize: 20, fontWeight: "600", color: "#fff", marginTop: 6, textAlign: "center", paddingHorizontal: 16 },
  replyText: { fontSize: 24, fontWeight: "600", color: C.ink, lineHeight: 36 },
  heard: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  heardLabel: { fontSize: 12, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  heardText: { fontSize: 17, color: C.ink, marginTop: 2 },
  meta: { fontSize: 12, color: C.muted, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: C.violetSoft, color: C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: C.card, borderRadius: 22, padding: 16, alignItems: "flex-start", ...shadow },
  tileLabel: { fontSize: 16, fontWeight: "700", color: C.ink, marginTop: 10 },
  tileSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  input: { fontSize: 17, borderRadius: 16, padding: 15, marginBottom: 12, backgroundColor: C.field, color: C.ink },
  emergency: { flex: 1, backgroundColor: C.red, alignItems: "center", justifyContent: "center", padding: 24 },
  emTitle: { fontSize: 32, fontWeight: "700", color: "#fff", textAlign: "center" },
  emSub: { fontSize: 18, color: "#fff", textAlign: "center", marginTop: 8, marginBottom: 24, opacity: 0.95 },
});
