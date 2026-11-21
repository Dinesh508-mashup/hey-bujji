// Health tab: all the wellness checks in one place (moved off the home screen).
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { CheckTile } from "../components/CheckArt";
import { BigButton, Disclaimer, Screen } from "../components/ui";
import { useLang } from "../lib/language";

export default function Health() {
  const { t } = useLang();
  return (
    <Screen title={t({ en: "Health checks", te: "ఆరోగ్య పరీక్షలు", hi: "स्वास्थ्य जाँच" })} eyebrow={t({ en: "Wellness checks · not medical tests", te: "ఆరోగ్య పరీక్షలు · వైద్య పరీక్షలు కాదు", hi: "वेलनेस जाँच · मेडिकल टेस्ट नहीं" })} icon="fitness" tint="mint" tab="/health" back={false}>
      <View style={s.grid}>
        <CheckTile art="breathing" label={t({ en: "Breathing", te: "ఊపిరి", hi: "साँस" })} sub={t({ en: "60 s · phone on chest", te: "60 సె · ఛాతీ మీద", hi: "60 से · छाती पर" })} onPress={() => router.push("/breathing")} />
        <CheckTile art="heart" label={t({ en: "Heart rate", te: "గుండె వేగం", hi: "धड़कन" })} sub={t({ en: "20 s · left of chest", te: "20 సె · ఎడమ వైపు", hi: "20 से · बाईं ओर" })} onPress={() => router.push("/heart")} />
        <CheckTile art="chair_stand" label={t({ en: "Chair stand", te: "కుర్చీ వ్యాయామం", hi: "कुर्सी व्यायाम" })} sub={t({ en: "30 s · stand & sit", te: "30 సె · లేచి కూర్చోండి", hi: "30 से · उठिए-बैठिए" })} onPress={() => router.push("/chairstand")} />
        <CheckTile art="memory" label={t({ en: "Memory", te: "జ్ఞాపకశక్తి", hi: "याददाश्त" })} sub={t({ en: "3 words", te: "3 పదాలు", hi: "3 शब्द" })} onPress={() => router.push("/memory")} />
      </View>
      <BigButton label={t({ en: "Do today's check-in", te: "ఈ రోజు చెక్-ఇన్", hi: "आज का चेक-इन करें" })} onPress={() => router.push("/checkin")} style={{ marginTop: 16 }} />
      <Disclaimer />
    </Screen>
  );
}

const s = StyleSheet.create({ grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } });
