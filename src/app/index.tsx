// Amma's home: just two things. Talk to Bujji, and what Ravi asked her to do today.
// Everything else (health checks, scam check, results) is on the bottom bar.
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FromFamily } from "../components/TaskViews";
import { Bujji } from "../components/Mascot";
import { Reveal } from "../components/Motion";
import { introSeen } from "../lib/intro";
import { useLang, type Tr } from "../lib/language";
import { Disclaimer, SetupBanner } from "../components/ui";
import { FloatingTabBar, GlassButton, PetalBackdrop, S, softShadow } from "../components/soft";

function greeting(): Tr {
  const h = new Date().getHours();
  if (h < 12) return { en: "Good morning", te: "శుభోదయం", hi: "सुप्रभात" };
  if (h < 17) return { en: "Good afternoon", te: "నమస్కారం", hi: "नमस्ते" };
  return { en: "Good evening", te: "శుభ సాయంత్రం", hi: "शुभ संध्या" };
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  // The web build is the family dashboard; the phone is Amma's app.
  if (Platform.OS === "web") return <Redirect href="/family" />;
  if (!introSeen()) return <Redirect href="/intro" />;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <View style={s.page}>
      <PetalBackdrop colors={S.bloom} height={470} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }]}>
        <View style={s.inner}>
          {/* orange hero: date, title, big line, Bujji */}
          <View style={s.topBar}>
            <View>
              <Text style={s.date}>{today}</Text>
              <Text style={s.hello}>{t({ en: "Amma's Health", te: "అమ్మ ఆరోగ్యం", hi: "अम्मा का स्वास्थ्य" })}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={s.avatar}><Text style={{ fontSize: 20 }}>👵🏽</Text></View>
              <GlassButton icon="settings-sharp" label={t({ en: "Settings", te: "సెట్టింగ్‌లు", hi: "सेटिंग्स" })} onPress={() => router.push("/settings")} />
            </View>
          </View>
          <SetupBanner />

          <Reveal delay={60}>
          <Pressable
            accessibilityRole="button" accessibilityLabel={t({ en: "Talk to Hey Bujji", te: "హే బుజ్జితో మాట్లాడండి", hi: "हे बुज्जी से बात करें" })}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); router.push("/parent"); }}
            style={({ pressed }) => [s.hero, { opacity: pressed ? 0.9 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.big}>{t(greeting())},{"\n"}{t({ en: "talk to Bujji", te: "బుజ్జితో మాట్లాడండి", hi: "बुज्जी से बात कीजिए" })} <Text style={s.arrow}>↗</Text></Text>
              <Text style={s.heroSub}>{t({ en: "“Call my son” · “I took my tablet” · “Book a cab”", te: "“అబ్బాయికి కాల్” · “మాత్ర వేసుకున్నా” · “క్యాబ్ బుక్”", hi: "“बेटे को फ़ोन” · “गोली ले ली” · “कैब बुक”" })}</Text>
            </View>
            <Bujji size={118} />
          </Pressable>
          </Reveal>

          <Reveal delay={160}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); router.push("/parent"); }} accessibilityRole="button"
            style={({ pressed }) => [s.talkBtn, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <View style={s.talkIcon}><Ionicons name="mic" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.talkTitle}>{t({ en: "Tap and talk", te: "నొక్కి మాట్లాడండి", hi: "दबाइए और बोलिए" })}</Text>
              <Text style={s.talkSub}>{t({ en: "Bujji understands English, Telugu and Hindi", te: "బుజ్జికి తెలుగు, హిందీ, ఇంగ్లీష్ అర్థమవుతాయి", hi: "बुज्जी हिंदी, तेलुगु और अंग्रेज़ी समझती है" })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={S.ink} />
          </Pressable>
          </Reveal>

          {/* today's plan from Ravi */}
          <Reveal delay={240}><View style={s.section}>
            <Text style={s.sectionTitle}>{t({ en: "Today's plan", te: "ఈ రోజు ప్లాన్", hi: "आज का प्लान" })}</Text>
            <Text style={s.sectionSub}>{t({ en: "from Ravi", te: "రవి నుండి", hi: "रवि की ओर से" })}</Text>
          </View></Reveal>
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
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  date: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  hello: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 2, letterSpacing: -0.3 },
  hero: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  big: { fontSize: 38, lineHeight: 44, fontWeight: "600", color: "#fff", letterSpacing: -1.2 },
  arrow: { fontSize: 32, fontWeight: "400", color: "#fff" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 10 },
  talkBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 24, padding: 14, marginTop: 18, ...softShadow },
  talkIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: S.orange, alignItems: "center", justifyContent: "center" },
  talkTitle: { fontSize: 17, fontWeight: "700", color: S.ink },
  talkSub: { fontSize: 12, color: S.muted, marginTop: 2 },
  section: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: S.ink, letterSpacing: -0.4 },
  sectionSub: { fontSize: 13, color: S.muted },
});
