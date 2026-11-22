// Welcome screen: Bujji in the middle, the things it helps with orbiting around, then "Get Started".
import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bujji } from "../components/Mascot";
import { CHECK_ART } from "../components/CheckArt";
import { BrandBadge } from "../components/BrandIcons";
import { markIntroSeen } from "../lib/intro";

type Orbiter = { ring: 0 | 1 | 2; angle: number; node: ReactNode; bg?: string };

const bubble = (emoji: string, bg: string) => (
  <View style={[s.bubble, { backgroundColor: bg }]}><Text style={{ fontSize: 26 }}>{emoji}</Text></View>
);
const art = (k: keyof typeof CHECK_ART) => <Image source={CHECK_ART[k].img} style={{ width: 54, height: 54 }} />;

// built on render (it uses the styles below)
const png = (src: number) => <Image source={src} style={{ width: 54, height: 54 }} />;
const orbit = (): Orbiter[] => [
  { ring: 2, angle: -125, node: <BrandBadge brand="uber" /> },
  { ring: 2, angle: -60, node: <BrandBadge brand="swiggy" /> },
  { ring: 2, angle: 0, node: <BrandBadge brand="whatsapp" /> },
  { ring: 2, angle: 60, node: <BrandBadge brand="blinkit" /> },
  { ring: 2, angle: 120, node: bubble("👵🏽", "#FFD9A8") },
  { ring: 2, angle: 180, node: png(require("../../assets/checks/footprints.png")) },
  { ring: 1, angle: -90, node: png(require("../../assets/checks/pill.png")) },
  { ring: 1, angle: -10, node: art("heart") },
  { ring: 1, angle: 70, node: png(require("../../assets/checks/stethoscope.png")) },
  { ring: 1, angle: 150, node: art("breathing") },
  { ring: 1, angle: 220, node: bubble("📞", "#FCE7A8") },
];

export default function Intro() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const R = Math.min(width, 430) * 0.45;
  const radii = [R * 0.36, R * 0.66, R * 0.98];
  const [spin] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    Animated.timing(rise, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    return () => loop.stop();
  }, [spin, rise]);

  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });

  function start() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    markIntroSeen();
    router.replace("/");
  }

  return (
    <View style={s.page}>
      <LinearGradient colors={["#DCEBF7", "#F6EFE9", "#FBEFE6", "#FFFFFF"]} locations={[0, 0.4, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.stage, { height: R * 2 + 60, marginTop: insets.top + 30 }]}>
        {radii.map((r) => <View key={r} style={[s.ring, { width: r * 2, height: r * 2, borderRadius: r }]} />)}
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", transform: [{ rotate: rot }] }]}>
          {orbit().map((o, i) => {
            const r = radii[o.ring], a = (o.angle * Math.PI) / 180;
            return (
              <Animated.View key={i} style={{ position: "absolute", transform: [{ translateX: r * Math.cos(a) }, { translateY: r * Math.sin(a) }, { rotate: counter }] }}>
                {o.node}
              </Animated.View>
            );
          })}
        </Animated.View>
        <View style={s.center}><Bujji size={R * 0.62} /></View>
      </View>

      <Animated.View style={{ alignItems: "center", opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <Text style={s.brand}>hey bujji ✦</Text>
        <Text style={s.title}>Your parents just talk.</Text>
        <Text style={s.title2}>
          <Text style={{ color: "#4F8BE8" }}>Bujji </Text>
          <Text style={{ color: "#9B6BDE" }}>takes </Text>
          <Text style={{ color: "#E5678A" }}>care</Text>
        </Text>
        <Text style={s.sub}>Medicines, calls, health checks and scam alerts, in Telugu, Hindi or English.</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />
      <Pressable onPress={start} accessibilityRole="button" accessibilityLabel="Get Started"
        style={({ pressed }) => [s.cta, { marginBottom: insets.bottom + 24, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <Text style={s.ctaText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, alignItems: "center", paddingHorizontal: 22 },
  stage: { width: "100%", alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  bubble: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff",
    shadowColor: "#5B4A7A", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  brand: { fontSize: 20, color: "#8A8A90", fontWeight: "600", letterSpacing: 0.5 },
  title: { fontSize: 30, fontWeight: "600", color: "#141414", marginTop: 8, textAlign: "center", letterSpacing: -0.5 },
  title2: { fontSize: 34, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 },
  sub: { fontSize: 15, color: "#7A7A80", textAlign: "center", marginTop: 10, lineHeight: 21, maxWidth: 320 },
  cta: { width: "100%", maxWidth: 480, backgroundColor: "#141414", borderRadius: 999, paddingVertical: 20, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
