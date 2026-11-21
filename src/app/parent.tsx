import { useEffect, useState } from "react";
import { Animated, Easing, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { BigButton, Card, Disclaimer, Screen, SetupBanner, styles as ui } from "../components/ui";
import { type BujjiResult, sendText, sendVoice } from "../lib/api";
import { useVoiceRecorder } from "../lib/audio";
import { speak, stopSpeaking } from "../lib/speak";
import { scheduleDailyReminder } from "../lib/reminders";
import { supabase } from "../lib/supabase";
import { FAMILY_ID } from "../lib/config";
import { C, shadow } from "../lib/theme";

type Phase = "idle" | "listening" | "thinking" | "done" | "error";

const EXAMPLES = [
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

export default function Parent() {
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
    if (a.type === "reminder") {
      const id = await scheduleDailyReminder(a.time, a.medicine).catch(() => null);
      setNote(id ? `⏰ Reminder set every day at ${clock(a.time)}` : `⏰ ${clock(a.time)} (allow notifications to get the alert)`);
    }
    await speak(r.reply.text, r.reply.lang);
    if (a.type === "call") Linking.openURL(`tel:${a.phone}`).catch(() => setNote(`Could not open the dialler for ${a.phone}`));
  }

  async function run(fn: () => Promise<BujjiResult>) {
    setPhase("thinking");
    setError(null);
    try {
      await handleResult(await fn());
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
      speak("క్షమించండి, మళ్ళీ ప్రయత్నించండి.", "te-IN");
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

  const micLabel = phase === "listening" ? "వింటున్నాను… (tap to stop)" : phase === "thinking" ? "ఆలోచిస్తున్నాను…" : "Hey Bujji";
  const micSub = phase === "listening" ? "Listening" : phase === "thinking" ? "Thinking" : "నొక్కి మాట్లాడండి · Tap and speak";
  const tone = result?.intent.urgency === "urgent" ? "red" : result?.intent.intent === "scam_report" ? "amber" : "teal";

  return (
    <Screen>
      <SetupBanner />
      <Text style={ui.h1}>నమస్తే అమ్మా 🙏</Text>
      <Text style={[ui.muted, { marginBottom: 18 }]}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>

      <View style={s.micWrap}>
        {phase === "listening" ? (
          <Animated.View style={[s.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] }]} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hey Bujji microphone"
          onPress={onMic}
          style={({ pressed }) => [s.mic, { backgroundColor: phase === "listening" ? C.red : C.teal, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <Text style={s.micIcon}>{phase === "listening" ? "■" : phase === "thinking" ? "…" : "🎙️"}</Text>
          <Text style={s.micLabel}>{micLabel}</Text>
        </Pressable>
      </View>
      <Text style={[ui.muted, { textAlign: "center", marginBottom: 18 }]}>{micSub}</Text>

      {error ? (
        <Card tone="amber"><Text style={ui.h3}>Something went wrong</Text><Text style={ui.muted}>{error}</Text></Card>
      ) : null}

      {result ? (
        <Card tone={tone}>
          <Text style={s.replyText}>{result.reply.text}</Text>
          <Text style={[ui.muted, { marginTop: 6 }]}>{result.reply.english}</Text>
          {note ? <Text style={[ui.body, { marginTop: 10, fontWeight: "700" }]}>{note}</Text> : null}
          {result.action.type === "call" ? <Text style={[ui.body, { marginTop: 10, fontWeight: "700" }]}>📞 Calling {result.action.name} ({result.action.relation})</Text> : null}
          {result.action.type === "dial" ? (
            <BigButton style={{ marginTop: 12 }} color={C.red} label="1930 కి కాల్ చేయండి" sub="Cyber fraud helpline · call now" onPress={() => Linking.openURL("tel:1930")} />
          ) : null}
          {result.action.type === "emergency" && !emergency ? (
            <BigButton style={{ marginTop: 12 }} color={C.red} label="Call 108" onPress={() => setEmergency(true)} />
          ) : null}
          <View style={s.heard}>
            <Text style={s.heardLabel}>Heard</Text>
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

      <View style={s.grid}>
        <Tile icon="🛡️" label="Bujji, check this" sub="Message / screenshot" onPress={() => router.push("/check")} />
        <Tile icon="🫁" label="Breathing" sub="Phone on chest" onPress={() => router.push("/breathing")} />
        <Tile icon="🪑" label="Chair stand" sub="30 seconds" onPress={() => router.push("/chairstand")} />
        <Tile icon="🧠" label="Memory" sub="3 words" onPress={() => router.push("/memory")} />
      </View>

      <Pressable onPress={() => setTyping((t) => !t)} style={{ alignSelf: "center", padding: 10 }}>
        <Text style={[ui.muted, { textDecorationLine: "underline" }]}>{typing ? "Hide typing" : "Type instead (for testing)"}</Text>
      </Pressable>
      {typing ? (
        <Card>
          <TextInput value={typed} onChangeText={setTyped} placeholder="e.g. Naa BP tablet teesukunna" style={s.input} onSubmitEditing={() => typed && run(() => sendText(typed))} />
          <BigButton label="Send" onPress={() => typed && run(() => sendText(typed))} disabled={!typed || phase === "thinking"} />
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
          <Text style={s.emTitle}>⚠️ 108 కి కాల్ చేయాలా?</Text>
          <Text style={s.emSub}>Call 108 ambulance? Ravi has been alerted.</Text>
          <BigButton color="#fff" textColor={C.red} label="📞 Call 108" sub="అంబులెన్స్ · Ambulance" onPress={() => Linking.openURL("tel:108")} style={{ width: "100%" }} />
          {sonPhone ? (
            <BigButton color="#fff" textColor={C.ink} label="📞 Call Ravi" sub="అబ్బాయికి కాల్" onPress={() => Linking.openURL(`tel:${sonPhone}`)} style={{ width: "100%" }} />
          ) : null}
          <BigButton color="transparent" textColor="#fff" label="I'm okay · నేను బాగున్నాను" onPress={() => setEmergency(false)} style={{ width: "100%", borderWidth: 2, borderColor: "#fff" }} />
          <Text style={[s.emSub, { fontSize: 13, marginTop: 18 }]}>Hey Bujji is not a medical device. In an emergency, call 108.</Text>
        </View>
      </Modal>
    </Screen>
  );
}

function Tile({ icon, label, sub, onPress }: { icon: string; label: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.tile, { opacity: pressed ? 0.85 : 1 }]}>
      <Text style={{ fontSize: 34 }}>{icon}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileSub}>{sub}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  micWrap: { alignItems: "center", justifyContent: "center", height: 250, marginBottom: 6 },
  ring: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: C.red },
  mic: { width: 220, height: 220, borderRadius: 110, alignItems: "center", justifyContent: "center", ...shadow, shadowOpacity: 0.2 },
  micIcon: { fontSize: 64, color: "#fff" },
  micLabel: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 6, textAlign: "center", paddingHorizontal: 16 },
  replyText: { fontSize: 26, fontWeight: "800", color: C.ink, lineHeight: 38 },
  heard: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  heardLabel: { fontSize: 12, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  heardText: { fontSize: 17, color: C.ink, marginTop: 2 },
  meta: { fontSize: 12, color: C.muted, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: C.marigoldSoft, color: C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: C.line, alignItems: "flex-start", ...shadow },
  tileLabel: { fontSize: 19, fontWeight: "800", color: C.ink, marginTop: 6 },
  tileSub: { fontSize: 14, color: C.muted },
  input: { fontSize: 18, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: "#fff", color: C.ink },
  emergency: { flex: 1, backgroundColor: C.red, alignItems: "center", justifyContent: "center", padding: 24 },
  emTitle: { fontSize: 34, fontWeight: "900", color: "#fff", textAlign: "center" },
  emSub: { fontSize: 18, color: "#fff", textAlign: "center", marginTop: 8, marginBottom: 24, opacity: 0.95 },
});
