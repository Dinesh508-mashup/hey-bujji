import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Disclaimer, SetupBanner } from "../components/ui";
import { Chip, FloatingTabBar, GlassButton, Hero, Orb, PetalBackdrop, S, SectionHeader, SoftCard, softShadow } from "../components/soft";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.page}>
      <PetalBackdrop colors={S.bloom} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}>
        <View style={s.inner}>
          <View style={s.topBar}>
            <View style={s.avatar}><Text style={{ fontSize: 22 }}>👵🏽</Text></View>
            {Platform.OS !== "web"
              ? <GlassButton icon="settings-sharp" label="Record test clips" onPress={() => router.push("/record")} />
              : <View />}
          </View>

          <Hero icon="heart" eyebrow="Telugu, Hindi or both" title={greeting()} />
          <SetupBanner />

          <SectionHeader title="Your Assistant" action="Show more" onAction={() => router.push("/parent")} />
          <SoftCard style={s.task} onPress={() => router.push("/parent")} label="Talk to Hey Bujji">
            <Orb icon="mic" tint={S.peach} size={44} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.taskEyebrow}>Hey Bujji</Text>
              <Text style={s.taskTitle}>Tap and speak · నొక్కి మాట్లాడండి</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={S.ink} />
          </SoftCard>

          <SectionHeader title="Check today" action="Show more" onAction={() => router.push("/checkin")} />
          <View style={s.logBox}>
            <View style={s.chipRow}>
              <Chip icon="leaf" color="#F2A65A" label="Breathing" onPress={() => router.push("/breathing")} />
              <Chip icon="water" color="#5FB3E6" label="Chair stand" onPress={() => router.push("/chairstand")} />
            </View>
            <View style={s.chipRow}>
              <Chip icon="moon" color="#9B87E8" label="Memory" onPress={() => router.push("/memory")} />
              <Chip icon="shield-checkmark" color="#6FBF8A" label="Scam check" onPress={() => router.push("/check")} />
            </View>
          </View>

          <SectionHeader title="For You" action="Show more" onAction={() => router.push("/family")} />
          <View style={s.forYou}>
            <SoftCard style={s.tile} onPress={() => router.push("/family")} label="Family dashboard">
              <LinearGradient colors={["#FBD9B8", "#F8E6DA", "#FFF4EC"]} style={StyleSheet.absoluteFill} />
              <Text style={s.tileEyebrow}>Ravi</Text>
              <Text style={s.tileTitle}>Family dashboard</Text>
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
  forYou: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, height: 150, overflow: "hidden", justifyContent: "flex-end", padding: 14 },
  tileEyebrow: { fontSize: 12, color: "#6A6A70" },
  tileTitle: { fontSize: 15, fontWeight: "700", color: S.ink, marginTop: 2 },
});
