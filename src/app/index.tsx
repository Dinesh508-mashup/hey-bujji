// Amma's home: just two things. Talk to Bujji, and what Ravi asked her to do today.
// Everything else (health checks, scam check, results) is on the bottom bar.
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FromFamily } from "../components/TaskViews";
import { useLang, type Tr } from "../lib/language";
import { Disclaimer, SetupBanner } from "../components/ui";
import { FloatingTabBar, GlassButton, PetalBackdrop, S, softShadow } from "../components/soft";

function greeting(): Tr {
  const h = new Date().getHours();
  if (h < 12) return { en: "Good morning", te: "శుభోదయం", hi: "सुप्रभात" };
  if (h < 17) return { en: "Good afternoon", te: "నమస్కారం", hi: "नमस्ते" };
  return { en: "Good evening", te: "శుభ సాయంత్రం", hi: "शुभ संध्या" };
}

/** Big mic with two soft rings breathing out of it. */
function MicOrb() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const ring = (delay: number) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1 + delay, 1.7 + delay] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
  });
  return (
    <View style={s.orbWrap}>
      <Animated.View style={[s.ring, ring(0)]} />
      <Animated.View style={[s.ring, ring(0.25)]} />
      <LinearGradient colors={["#F7A35C", "#E5767A"]} style={s.orb}>
        <Ionicons name="mic" size={46} color="#fff" />
      </LinearGradient>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  // The web build is the family dashboard; the phone is Amma's app.
  if (Platform.OS === "web") return <Redirect href="/family" />;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <View style={s.page}>
      <PetalBackdrop colors={S.bloom} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }]}>
        <View style={s.inner}>
          <View style={s.topBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={s.avatar}><Text style={{ fontSize: 22 }}>👵🏽</Text></View>
              <View>
                <Text style={s.hello}>{t(greeting())}, Amma</Text>
                <Text style={s.date}>{today}</Text>
              </View>
            </View>
            <GlassButton icon="settings-sharp" label={t({ en: "Settings", te: "సెట్టింగ్‌లు", hi: "सेटिंग्स" })} onPress={() => router.push("/settings")} />
          </View>
          <SetupBanner />

          {/* Talk to Bujji */}
          <Pressable
            accessibilityRole="button" accessibilityLabel={t({ en: "Talk to Hey Bujji", te: "హే బుజ్జితో మాట్లాడండి", hi: "हे बुज्जी से बात करें" })}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); router.push("/parent"); }}
            style={({ pressed }) => [s.talkCard, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <LinearGradient colors={["#FFF4EA", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
            <MicOrb />
            <Text style={s.talkTitle}>{t({ en: "Tap and talk to Bujji", te: "నొక్కి బుజ్జితో మాట్లాడండి", hi: "दबाइए और बुज्जी से बात कीजिए" })}</Text>
            <Text style={s.talkSub}>{t({ en: "“I took my BP tablet” · “Call my son”", te: "“BP మాత్ర వేసుకున్నా” · “అబ్బాయికి కాల్ చెయ్యి”", hi: "“BP की गोली ले ली” · “बेटे को फ़ोन करो”" })}</Text>
          </Pressable>

          {/* From Ravi */}
          <View style={s.section}>
            <View style={s.sectionIcon}><Ionicons name="heart" size={16} color="#E5767A" /></View>
            <Text style={s.sectionTitle}>{t({ en: "Today from Ravi", te: "ఈ రోజు రవి నుండి", hi: "आज रवि की ओर से" })}</Text>
          </View>
          <FromFamily />

          <Disclaimer />
        </View>
      </ScrollView>
      <FloatingTabBar active="/" />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: S.page },
  scroll: { flexGrow: 1, alignItems: "center" },
  inner: { width: "100%", maxWidth: 520, paddingHorizontal: 18 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFD9A8", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff", ...softShadow,
  },
  hello: { fontSize: 20, fontWeight: "700", color: S.ink },
  date: { fontSize: 13, color: S.muted, marginTop: 1 },
  talkCard: { borderRadius: 30, overflow: "hidden", alignItems: "center", paddingTop: 30, paddingBottom: 24, paddingHorizontal: 20, ...softShadow },
  orbWrap: { width: 150, height: 150, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 104, height: 104, borderRadius: 52, backgroundColor: "#F7A35C" },
  orb: { width: 104, height: 104, borderRadius: 52, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#fff" },
  talkTitle: { fontSize: 22, fontWeight: "800", color: S.ink, marginTop: 6, textAlign: "center" },
  talkSub: { fontSize: 14, color: S.muted, marginTop: 6, textAlign: "center" },
  section: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 26, marginBottom: 12 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFE8EA", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: S.ink },
});
