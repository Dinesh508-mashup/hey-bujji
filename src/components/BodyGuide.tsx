// Animated "glass body" guide for the check screens: a translucent glowing figure
// on a coloured field, a frosted caption over the body, a big counter, and an
// orbit ring. Pure RN Views + Animated + expo-linear-gradient (works in Expo Go).
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { speak, stopSpeaking } from "../lib/speak";
import type { VoiceLang } from "../lib/language";

export type GuideMode = "breathing" | "chair" | "memory";

const FIELD: Record<GuideMode, readonly [string, string, string]> = {
  breathing: ["#FFD2B3", "#F58A4A", "#FFC29C"],
  chair: ["#6B2A0A", "#F26A1B", "#7E330C"],
  memory: ["#4A2410", "#D9541A", "#4A2410"],
};
const HOT: Record<GuideMode, string> = { breathing: "#FFE7A8", chair: "#FFE0C2", memory: "#FFD9B8" };

const loop = (v: Animated.Value, ms: number, ease = Easing.inOut(Easing.sin)) =>
  Animated.loop(Animated.sequence([
    Animated.timing(v, { toValue: 1, duration: ms, easing: ease, useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration: ms, easing: ease, useNativeDriver: true }),
  ]));

/**
 * caption: frosted label over the chest. cues: alternate captions in rhythm with the
 * animation (e.g. ["Breathe in", "Breathe out"]); they override caption while running.
 * big / bigOf / bigLabel: the large thin counter at the top left ("42 / 60  seconds").
 */
export function BodyGuide({ mode, caption, cues, big, bigOf, bigLabel, tag, running = true, count = null, style }: {
  mode: GuideMode; caption?: string; cues?: [string, string]; big?: string | number | null; bigOf?: string; bigLabel?: string;
  tag?: string; running?: boolean; count?: number | null; style?: ViewStyle;
}) {
  const [beat] = useState(() => new Animated.Value(0)); // 0..1 main rhythm
  const [glow] = useState(() => new Animated.Value(0)); // hotspot pulse
  const [ring] = useState(() => new Animated.Value(0)); // orbit shimmer
  const [phase, setPhase] = useState(0);
  const half = mode === "breathing" ? 4000 : mode === "chair" ? 1400 : 2200;

  useEffect(() => {
    const anims = [loop(glow, 1200), loop(ring, 2600)];
    if (running) anims.push(loop(beat, half));
    anims.forEach((a) => a.start());
    if (!running) beat.setValue(0);
    return () => anims.forEach((a) => a.stop());
  }, [running, half, beat, glow, ring]);

  useEffect(() => {
    if (!cues || !running) return;
    const id = setInterval(() => setPhase((p) => 1 - p), half);
    return () => clearInterval(id);
  }, [cues, running, half]);

  const label = cues && running ? cues[phase] : caption;
  const hot = HOT[mode];

  // breathing: chest swells; chair: whole body drops onto the chair; memory: head glows
  const torsoScale = mode === "breathing" ? beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) : 1;
  const bodyY = mode === "chair" ? beat.interpolate({ inputRange: [0, 1], outputRange: [0, 38] }) : 0;
  const legScale = mode === "chair" ? beat.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) : 1;
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const hotTop = mode === "memory" ? 38 : mode === "chair" ? 238 : 150;

  return (
    <View style={[g.card, style]}>
      <LinearGradient colors={FIELD[mode]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* soft vignette glow behind the figure */}
      <View style={[g.halo, { backgroundColor: mode === "breathing" ? "rgba(255,255,255,0.25)" : "rgba(255,214,180,0.18)" }]} />

      {mode === "chair" ? (
        <View style={g.chair}>
          <View style={g.chairBack} />
          <View style={g.chairSeat} />
          <View style={[g.chairLeg, { left: 8 }]} />
          <View style={[g.chairLeg, { right: 8 }]} />
        </View>
      ) : null}

      <Animated.View style={[g.figure, { transform: [{ translateY: bodyY }] }]}>
        <Glass style={g.head} />
        <Glass style={g.neck} />
        <Animated.View style={{ transform: [{ scaleX: torsoScale }, { scaleY: torsoScale }] }}>
          <Glass style={g.torso} fade />
        </Animated.View>
        <Glass style={[g.arm, { left: 22, transform: [{ rotate: "8deg" }] }]} fade />
        <Glass style={[g.arm, { right: 22, transform: [{ rotate: "-8deg" }] }]} fade />
        {mode === "chair" ? (
          <Animated.View style={[g.legs, { transform: [{ scaleY: legScale }] }]}>
            <Glass style={g.leg} fade />
            <Glass style={g.leg} fade />
          </Animated.View>
        ) : null}

        {/* glowing hotspot */}
        <Animated.View style={[g.hot, { top: hotTop, opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
          <View style={[g.hotOuter, { backgroundColor: hot }]} />
          <View style={[g.hotInner, { backgroundColor: hot }]} />
          <View style={g.hotDot} />
        </Animated.View>
      </Animated.View>

      {/* orbit ring around the waist */}
      <Animated.View style={[g.ring, { opacity: ringOpacity, transform: [{ scaleX: ringScale }] }]} />

      {big !== undefined && big !== null ? (
        <View style={g.counter} pointerEvents="none">
          <Text style={g.big}>{big}{bigOf ? <Text style={g.bigOf}>/{bigOf}</Text> : null}</Text>
          {bigLabel ? <Text style={g.bigLabel}>{bigLabel}</Text> : null}
          <View style={g.rule} />
        </View>
      ) : null}
      {tag ? <View style={g.tag}><Text style={g.tagText}>{tag}</Text></View> : null}

      {label ? (
        <View style={g.captionWrap} pointerEvents="none">
          <View style={g.caption}><Text style={g.captionText}>{label}</Text></View>
        </View>
      ) : null}
      <CountIn value={count} />
    </View>
  );
}

function Glass({ style, fade }: { style: ViewStyle | ViewStyle[]; fade?: boolean }) {
  return (
    <View style={[g.glass, style as ViewStyle]}>
      <LinearGradient
        colors={fade ? ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0)"] : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.55)"]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** Big centred 3-2-1 overlay for the count-in. */
export function CountIn({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <View style={g.countIn} pointerEvents="none">
      <Text style={g.countInText}>{value === 0 ? "Go" : value}</Text>
    </View>
  );
}

/** Speaks 3, 2, 1 (one per second) and exposes the current number for <CountIn>. */
export function useCountIn() {
  const [count, setCount] = useState<number | null>(null);
  async function run(words: [string, string, string, string], voice: VoiceLang) {
    for (let n = 3; n >= 0; n--) {
      setCount(n);
      Haptics.impactAsync(n === 0 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      speak(words[3 - n], voice).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCount(null);
  }
  return { count, run };
}

/** Frosted pill buttons under the figure: read the steps aloud, show/hide the text. */
export function GuideControls({ text, voice, showText, onToggleText, labels }: {
  text: string; voice: VoiceLang; showText: boolean; onToggleText: () => void;
  labels: { read: string; stop: string; show: string; hide: string };
}) {
  const [reading, setReading] = useState(false);
  async function read() {
    Haptics.selectionAsync().catch(() => {});
    if (reading) { await stopSpeaking(); setReading(false); return; }
    setReading(true);
    await speak(text, voice).catch(() => {});
    setReading(false);
  }
  useEffect(() => () => { stopSpeaking(); }, []);
  return (
    <View style={g.controls}>
      <Pressable accessibilityRole="button" onPress={read} style={({ pressed }) => [g.ctl, reading ? g.ctlOn : null, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name={reading ? "stop" : "volume-high"} size={18} color={reading ? "#fff" : "#141414"} />
        <Text style={[g.ctlText, reading ? { color: "#fff" } : null]}>{reading ? labels.stop : labels.read}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggleText(); }}
        style={({ pressed }) => [g.ctl, showText ? g.ctlOn : null, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name={showText ? "eye-off-outline" : "document-text-outline"} size={18} color={showText ? "#fff" : "#141414"} />
        <Text style={[g.ctlText, showText ? { color: "#fff" } : null]}>{showText ? labels.hide : labels.show}</Text>
      </Pressable>
    </View>
  );
}

/** Cycles through steps every few seconds, for the caption on the figure. */
export function useStepCycle(count: number, ms = 3500, active = true) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || count < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms, active]);
  return i % Math.max(1, count);
}

const FIG_W = 220;
const g = StyleSheet.create({
  card: { height: 380, borderRadius: 28, overflow: "hidden", marginBottom: 14, alignItems: "center" },
  halo: { position: "absolute", top: 40, width: 300, height: 300, borderRadius: 150 },
  figure: { position: "absolute", top: 34, width: FIG_W, height: 330, alignItems: "center" },
  glass: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  head: { width: 70, height: 86, borderRadius: 40 },
  neck: { width: 30, height: 18, marginTop: -2, borderRadius: 8, borderTopWidth: 0 },
  torso: { width: 170, height: 170, borderTopLeftRadius: 80, borderTopRightRadius: 80, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, borderBottomWidth: 0 },
  arm: { position: "absolute", top: 118, width: 34, height: 150, borderRadius: 20, borderBottomWidth: 0 },
  legs: { flexDirection: "row", gap: 10, marginTop: -4, height: 70 },
  leg: { width: 44, height: 70, borderRadius: 18, borderTopWidth: 0, borderBottomWidth: 0 },
  hot: { position: "absolute", width: 70, height: 70, alignItems: "center", justifyContent: "center" },
  hotOuter: { position: "absolute", width: 70, height: 70, borderRadius: 35, opacity: 0.35 },
  hotInner: { position: "absolute", width: 44, height: 44, borderRadius: 22, opacity: 0.8, borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" },
  hotDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  ring: { position: "absolute", top: 268, width: 320, height: 46, borderRadius: 160, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)" },
  chair: { position: "absolute", top: 230, width: 150, height: 130 },
  chairBack: { position: "absolute", left: 18, top: 0, width: 114, height: 70, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  chairSeat: { position: "absolute", left: 0, top: 70, width: 150, height: 14, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.3)" },
  chairLeg: { position: "absolute", top: 84, width: 4, height: 46, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  counter: { position: "absolute", left: 20, top: 20 },
  big: { fontSize: 60, fontWeight: "200", color: "#fff", letterSpacing: -2 },
  bigOf: { fontSize: 26, fontWeight: "200", color: "rgba(255,255,255,0.75)" },
  bigLabel: { fontSize: 16, color: "#fff", marginTop: -4 },
  rule: { width: 120, height: 1, backgroundColor: "rgba(255,255,255,0.6)", marginTop: 10 },
  tag: { position: "absolute", right: 16, top: 20, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  tagText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  captionWrap: { position: "absolute", left: 16, right: 16, top: 198, alignItems: "center" },
  caption: { maxWidth: "100%", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "rgba(255,255,255,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.95)" },
  captionText: { fontSize: 16, fontWeight: "600", color: "#141414", textAlign: "center" },
  countIn: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.18)" },
  countInText: { fontSize: 120, fontWeight: "200", color: "#fff" },
  controls: { flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 14 },
  ctl: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: "#fff", shadowColor: "#5B4A7A", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  ctlOn: { backgroundColor: "#140A0A" },
  ctlText: { fontSize: 15, fontWeight: "600", color: "#141414" },
});

/** "Three, two, one, start" in the app language, for useCountIn().run(). */
export function countWords(t: (s: { en: string; te: string; hi: string }) => string): [string, string, string, string] {
  return [
    t({ en: "Three", te: "మూడు", hi: "तीन" }),
    t({ en: "Two", te: "రెండు", hi: "दो" }),
    t({ en: "One", te: "ఒకటి", hi: "एक" }),
    t({ en: "Start", te: "మొదలు", hi: "शुरू" }),
  ];
}

export const controlLabels = (t: (s: { en: string; te: string; hi: string }) => string) => ({
  read: t({ en: "Read aloud", te: "చదివి వినిపించు", hi: "पढ़कर सुनाओ" }),
  stop: t({ en: "Stop", te: "ఆపు", hi: "रोको" }),
  show: t({ en: "Show text", te: "టెక్స్ట్ చూపించు", hi: "टेक्स्ट दिखाओ" }),
  hide: t({ en: "Hide text", te: "టెక్స్ట్ దాచు", hi: "टेक्स्ट छिपाओ" }),
});
