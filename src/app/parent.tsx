import { useEffect, useState } from "react";
import { Bujji } from "../components/Mascot";
import { Reveal } from "../components/Motion";
import { FoodOrderCard, RideCard } from "../components/Orders";
import { Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BigButton, Card, Disclaimer, SetupBanner, styles as ui } from "../components/ui";
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
    if (a.type === "video") {
      // WhatsApp has no public "start video call" link: open the chat with the number; Amma taps the video button.
      const n = a.phone.replace(/[^0-9]/g, "");
      Linking.openURL(`whatsapp://send?phone=${n}`).catch(() => Linking.openURL(`https://wa.me/${n}`)).catch(() => setNote("WhatsApp is not installed"));
    }
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

  const insets = useSafeAreaInsets();
  const stageLine = phase === "listening" ? t({ en: "I'm listening…", te: "వింటున్నాను…", hi: "सुन रही हूँ…" })
    : phase === "thinking" ? t({ en: "One moment…", te: "ఒక్క నిమిషం…", hi: "एक पल…" })
    : shown ? `“${shown.text}”`
    : error ? t({ en: "Sorry, please try again.", te: "క్షమించండి, మళ్ళీ ప్రయత్నించండి.", hi: "माफ़ कीजिए, फिर से कोशिश कीजिए।" })
    : t({ en: "Hi Amma, what can I do for you?", te: "నమస్తే అమ్మా, ఏం చేయమంటారు?", hi: "नमस्ते अम्मा, क्या करूँ?" });
  const stageColors: readonly [string, string, string] = result?.intent.urgency === "urgent" ? ["#FFB4B4", "#F05252", "#9B1C1C"]
    : phase === "listening" ? ["#FFB27E", "#F26A1B", "#B8410A"] : ["#FFC79F", "#F58340", "#D9520F"];

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 130, paddingHorizontal: 16, alignItems: "center" }} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <View style={s.top}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.roundSm} accessibilityLabel="Back"><Ionicons name="chevron-back" size={20} color={C.ink} /></Pressable>
            <View style={{ alignItems: "center" }}>
              <Text style={s.topTitle}>Hey Bujji</Text>
              <Text style={s.topSub}>{new Date().toLocaleDateString(DATE_LOCALE[lang], { weekday: "long", day: "numeric", month: "long" })}</Text>
            </View>
            <View style={s.roundSm}><Bujji size={40} float={false} listening={phase === "listening"} /></View>
          </View>
          <SetupBanner />

          {/* the stage: Bujji's words, big and centred, over a glowing orb */}
          <Reveal delay={80}>
          <Pressable onPress={onMic} accessibilityRole="button" accessibilityLabel="Hey Bujji microphone" style={s.stage}>
            <LinearGradient colors={stageColors} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={s.stageWho}>{phase === "listening" ? t({ en: "Listening", te: "వింటున్నాను", hi: "सुन रही हूँ" }) : phase === "thinking" ? t({ en: "Thinking", te: "ఆలోచిస్తున్నాను", hi: "सोच रही हूँ" }) : "Bujji"}</Text>
            <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 22 }}>
              <Text style={s.stageLine}>{stageLine}</Text>
              {shown?.sub ? <Text style={s.stageSub}>{shown.sub}</Text> : null}
            </View>
            <View style={s.orbWrap}>
              <Animated.View style={[s.orbGlow, { opacity: phase === "listening" ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.1] }) : 0.35, transform: [{ scale: phase === "listening" ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) : 1 }] }]} />
              <LinearGradient colors={["#FFF4EC", "#FFB27E", "#F2621A"]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={s.orb} />
            </View>
          </Pressable>
          </Reveal>

          {error ? <Card tone="amber"><Text style={ui.muted}>{error}</Text></Card> : null}

          {result ? (
            <Reveal><View style={s.details}>
              {note ? <Text style={[ui.body, { fontWeight: "700" }]}>{note}</Text> : null}
              {result.action.type === "call" ? <Text style={s.detailLine}>📞 {t({ en: "Calling", te: "కాల్ చేస్తున్నాను:", hi: "फ़ोन लगा रही हूँ:" })} {result.action.name} ({result.action.relation})</Text> : null}
              {result.action.type === "dial" ? (
                <BigButton style={{ marginTop: 12 }} color={C.red} label={t({ en: "Call 1930", te: "1930 కి కాల్ చేయండి", hi: "1930 पर कॉल करें" })} sub={t({ en: "Cyber fraud helpline · call now", te: "సైబర్ మోసం హెల్ప్‌లైన్", hi: "साइबर धोखाधड़ी हेल्पलाइन" })} onPress={() => Linking.openURL("tel:1930")} />
              ) : null}
              {result.action.type === "video" ? <Text style={s.detailLine}>📹 WhatsApp · {result.action.name} — {t({ en: "tap the video camera button at the top", te: "పైన వీడియో కెమెరా బటన్ నొక్కండి", hi: "ऊपर वीडियो कैमरा बटन दबाइए" })}</Text> : null}
              {result.action.type === "order" ? <FoodOrderCard orderId={result.action.order_id} items={result.action.items} /> : null}
              {result.action.type === "cab" && result.action.ride ? <RideCard ride={result.action.ride} destination={result.action.destination} orderId={result.action.order_id} /> : null}
              {result.action.type === "emergency" && !emergency ? (
                <BigButton style={{ marginTop: 12 }} color={C.red} label={t({ en: "Call 108", te: "108 కి కాల్", hi: "108 पर कॉल" })} onPress={() => setEmergency(true)} />
              ) : null}
              <View style={s.heard}>
                <Text style={s.heardLabel}>{t({ en: "Heard", te: "విన్నది", hi: "सुना" })}</Text>
                <Text style={s.heardText}>{result.transcript || "—"}</Text>
                {result.correction?.fixes.length ? (
                  <View style={s.chips}>
                    {result.correction.fixes.map((f, i) => <Text key={i} style={s.chip}>{f.heard} → {f.fixed}</Text>)}
                  </View>
                ) : null}
                <Text style={s.meta}>{result.stt?.provider ?? "typed"} · {result.llmSource} · {(result.ms / 1000).toFixed(1)}s</Text>
              </View>
            </View></Reveal>
          ) : null}

          {typing ? (
            <Card>
              <TextInput value={typed} onChangeText={setTyped} placeholder={`e.g. ${EXAMPLES[0]}`} style={s.input} onSubmitEditing={() => typed && run(() => sendText(typed))} />
              <BigButton label={t({ en: "Send", te: "పంపండి", hi: "भेजें" })} onPress={() => typed && run(() => sendText(typed))} disabled={!typed || phase === "thinking"} />
              <View style={s.chips}>
                {EXAMPLES.map((e) => (
                  <Pressable key={e} onPress={() => { setTyped(e); run(() => sendText(e)); }}><Text style={s.chip}>{e}</Text></Pressable>
                ))}
              </View>
            </Card>
          ) : null}
          <Disclaimer />
        </View>
      </ScrollView>

      {/* call-style controls */}
      <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable onPress={() => setTyping((v) => !v)} style={[s.side, typing && { backgroundColor: C.ink }]} accessibilityLabel={t({ en: "Type instead", te: "టైప్ చేయండి", hi: "टाइप करें" })}>
          <Ionicons name="keypad" size={24} color={typing ? "#fff" : C.ink} />
        </Pressable>
        <Pressable onPress={onMic} accessibilityRole="button" accessibilityLabel={micLabel} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
          <LinearGradient colors={phase === "listening" ? ["#FF8A80", "#E5484D"] : phase === "thinking" ? ["#3A3A3A", "#121212"] : ["#FF8A3D", "#F2621A"]} style={s.talk}>
            <Ionicons name={phase === "listening" ? "stop" : phase === "thinking" ? "ellipsis-horizontal" : "mic"} size={34} color="#fff" />
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => router.navigate("/")} style={s.side} accessibilityLabel="Home">
          <Ionicons name="home" size={22} color={C.ink} />
        </Pressable>
      </View>
      <Text style={[s.micSub, { bottom: insets.bottom + 2 }]}>{micSub}</Text>

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
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F3EF" },
  inner: { width: "100%", maxWidth: 520 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  roundSm: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden", ...shadow, shadowOpacity: 0.06 },
  topTitle: { fontSize: 17, fontWeight: "700", color: C.ink },
  topSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  stage: { height: 470, borderRadius: 38, overflow: "hidden", alignItems: "center", paddingTop: 22, borderWidth: 6, borderColor: "#fff", ...shadow, shadowOpacity: 0.12 },
  stageWho: { fontSize: 15, color: "rgba(255,255,255,0.85)", fontWeight: "600", letterSpacing: 0.3 },
  stageLine: { fontSize: 28, lineHeight: 36, color: "#fff", fontWeight: "700", textAlign: "center", letterSpacing: -0.3 },
  stageSub: { fontSize: 15, color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 10 },
  orbWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: 26 },
  orbGlow: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "#FFD2B0" },
  orb: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  details: { backgroundColor: "#fff", borderRadius: 26, padding: 18, marginTop: 14, ...shadow, shadowOpacity: 0.05 },
  detailLine: { fontSize: 16, color: C.ink, fontWeight: "700", marginTop: 4 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 44, paddingTop: 12, backgroundColor: "rgba(246,243,239,0.95)" },
  side: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.08 },
  talk: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#fff", ...shadow, shadowOpacity: 0.2 },
  micSub: { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 11, color: C.muted },
  replyText: { fontSize: 24, fontWeight: "600", color: C.ink, lineHeight: 36 },
  heard: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  heardLabel: { fontSize: 12, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  heardText: { fontSize: 17, color: C.ink, marginTop: 2 },
  meta: { fontSize: 12, color: C.muted, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: C.violetSoft, color: C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, overflow: "hidden" },
  input: { fontSize: 17, borderRadius: 16, padding: 15, marginBottom: 12, backgroundColor: C.field, color: C.ink },
  emergency: { flex: 1, backgroundColor: C.red, alignItems: "center", justifyContent: "center", padding: 24 },
  emTitle: { fontSize: 32, fontWeight: "700", color: "#fff", textAlign: "center" },
  emSub: { fontSize: 18, color: "#fff", textAlign: "center", marginTop: 8, marginBottom: 24, opacity: 0.95 },
});
