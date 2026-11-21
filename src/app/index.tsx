import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { FromFamily } from "../components/TaskViews";
import { CheckTile } from "../components/CheckArt";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, type Tr } from "../lib/language";
import { Disclaimer, SetupBanner } from "../components/ui";
import { FloatingTabBar, GlassButton, Hero, Orb, PetalBackdrop, S, SectionHeader, SoftCard, softShadow } from "../components/soft";

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
  return (
    <View style={s.page}>
      <PetalBackdrop colors={S.bloom} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}>
        <View style={s.inner}>
          <View style={s.topBar}>
            <View style={s.avatar}><Text style={{ fontSize: 22 }}>👵🏽</Text></View>
            <GlassButton icon="settings-sharp" label={t({ en: "Settings", te: "సెట్టింగ్‌లు", hi: "सेटिंग्स" })} onPress={() => router.push("/settings")} />
          </View>

          <Hero icon="heart" eyebrow={t({ en: "Enjoy your day today", te: "ఈ రోజు ఆనందంగా గడపండి", hi: "आज का दिन अच्छा बिताइए" })} title={t(greeting())} />
          <SetupBanner />

          <SectionHeader title={t({ en: "Your Assistant", te: "మీ సహాయకుడు", hi: "आपका सहायक" })} action={t({ en: "Open", te: "తెరవండి", hi: "खोलें" })} onAction={() => router.push("/parent")} />
          <SoftCard style={s.task} onPress={() => router.push("/parent")} label={t({ en: "Talk to Hey Bujji", te: "హే బుజ్జితో మాట్లాడండి", hi: "हे बुज्जी से बात करें" })}>
            <Orb icon="mic" tint={S.peach} size={44} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.taskEyebrow}>Hey Bujji</Text>
              <Text style={s.taskTitle}>{t({ en: "Tap and speak", te: "నొక్కి మాట్లాడండి", hi: "दबाइए और बोलिए" })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={S.ink} />
          </SoftCard>

          <SectionHeader title={t({ en: "From Ravi", te: "రవి నుండి", hi: "रवि की ओर से" })} />
          <FromFamily />

          <SectionHeader title={t({ en: "Check today", te: "ఈ రోజు పరీక్షలు", hi: "आज की जाँच" })} action={t({ en: "Show more", te: "మరిన్ని", hi: "और देखें" })} onAction={() => router.push("/checkin")} />
          <View style={s.checkGrid}>
            <CheckTile art="breathing" label={t({ en: "Breathing", te: "ఊపిరి", hi: "साँस" })} sub={t({ en: "60 s · phone on chest", te: "60 సె · ఛాతీ మీద", hi: "60 से · छाती पर" })} onPress={() => router.push("/breathing")} />
            <CheckTile art="heart" label={t({ en: "Heart rate", te: "గుండె వేగం", hi: "धड़कन" })} sub={t({ en: "20 s · left of chest", te: "20 సె · ఎడమ వైపు", hi: "20 से · बाईं ओर" })} onPress={() => router.push("/heart")} />
            <CheckTile art="chair_stand" label={t({ en: "Chair stand", te: "కుర్చీ వ్యాయామం", hi: "कुर्सी व्यायाम" })} sub={t({ en: "30 s · stand & sit", te: "30 సె · లేచి కూర్చోండి", hi: "30 से · उठिए-बैठिए" })} onPress={() => router.push("/chairstand")} />
            <CheckTile art="memory" label={t({ en: "Memory", te: "జ్ఞాపకశక్తి", hi: "याददाश्त" })} sub={t({ en: "3 words", te: "3 పదాలు", hi: "3 शब्द" })} onPress={() => router.push("/memory")} />
            <CheckTile art="scam" label={t({ en: "Scam check", te: "మోసం తనిఖీ", hi: "धोखा जाँच" })} sub={t({ en: "Message or screenshot", te: "మెసేజ్ / స్క్రీన్‌షాట్", hi: "मैसेज / स्क्रीनशॉट" })} onPress={() => router.push("/check")} />
          </View>

          <SectionHeader title={t({ en: "For You", te: "మీ కోసం", hi: "आपके लिए" })} />
          <View style={s.forYou}>
            <SoftCard style={s.tile} onPress={() => router.push("/checkin")} label={t({ en: "Today's check-in", te: "ఈ రోజు చెక్-ఇన్", hi: "आज का चेक-इन" })}>
              <LinearGradient colors={["#FBD9B8", "#F8E6DA", "#FFF4EC"]} style={StyleSheet.absoluteFill} />
              <Text style={s.tileEyebrow}>{t({ en: "Daily health", te: "రోజువారీ ఆరోగ్యం", hi: "रोज़ का स्वास्थ्य" })}</Text>
              <Text style={s.tileTitle}>{t({ en: "Today's check-in", te: "ఈ రోజు చెక్-ఇన్", hi: "आज का चेक-इन" })}</Text>
            </SoftCard>
            <SoftCard style={s.tile} onPress={() => router.push("/results")} label="Accuracy results">
              <LinearGradient colors={["#BFE2F7", "#D7EEF2", "#F1F8F2"]} style={StyleSheet.absoluteFill} />
              <Text style={s.tileEyebrow}>Whisper vs Bujji</Text>
              <Text style={s.tileTitle}>Accuracy results</Text>
            </SoftCard>
          </View>

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
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFD9A8", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff", ...softShadow,
  },
  task: { flexDirection: "row", alignItems: "center" },
  taskEyebrow: { fontSize: 13, color: S.muted },
  taskTitle: { fontSize: 15, fontWeight: "600", color: S.ink, marginTop: 2 },
  logBox: { backgroundColor: "#FAFAFC", borderRadius: 22, padding: 10, gap: 10, borderWidth: 1, borderColor: "#F0F0F4" },
  chipRow: { flexDirection: "row", gap: 10 },
  checkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  forYou: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, height: 150, overflow: "hidden", justifyContent: "flex-end", padding: 14 },
  tileEyebrow: { fontSize: 12, color: "#6A6A70" },
  tileTitle: { fontSize: 15, fontWeight: "700", color: S.ink, marginTop: 2 },
});
