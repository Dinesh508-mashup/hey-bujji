import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, type Tr } from "../lib/language";
import { GlassButton, Hero, PetalBackdrop, PillButton, S, SelectRow, type IconName } from "../components/soft";

type Check = { key: string; href: "/breathing" | "/chairstand" | "/memory"; label: Tr; sub: Tr; icon: IconName; tint: readonly [string, string] };

const CHECKS: Check[] = [
  { key: "breathing", href: "/breathing", label: { en: "Breathing", te: "ఊపిరి పరీక్ష", hi: "साँस की जाँच" }, sub: { en: "Phone on chest for 60 seconds", te: "60 సెకన్లు ఫోన్ ఛాతీ మీద", hi: "60 सेकंड फ़ोन छाती पर" }, icon: "leaf", tint: S.peach },
  { key: "chairstand", href: "/chairstand", label: { en: "Chair stand", te: "కుర్చీ వ్యాయామం", hi: "कुर्सी व्यायाम" }, sub: { en: "Stand up and sit down for 30 seconds", te: "30 సెకన్లు లేచి కూర్చోండి", hi: "30 सेकंड उठिए-बैठिए" }, icon: "body", tint: S.sage },
  { key: "memory", href: "/memory", label: { en: "Memory", te: "జ్ఞాపకశక్తి", hi: "याददाश्त" }, sub: { en: "Remember three words", te: "మూడు పదాలు గుర్తుపెట్టుకోండి", hi: "तीन शब्द याद रखिए" }, icon: "moon", tint: S.lilac },
];

export default function CheckIn() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [picked, setPicked] = useState<string[]>(["breathing"]);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const first = CHECKS.find((c) => picked.includes(c.key));

  return (
    <View style={s.page}>
      <PetalBackdrop colors={S.mint} height={520} />
      <View style={[s.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.topBar}>
          <GlassButton icon="chevron-back" label={t({ en: "Back", te: "వెనక్కి", hi: "वापस" })} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          <GlassButton icon="close" label={t({ en: "Close", te: "మూసివేయి", hi: "बंद करें" })} onPress={() => router.replace("/")} />
        </View>

        <Hero icon="pulse" eyebrow={t({ en: "Track daily health", te: "రోజువారీ ఆరోగ్యం", hi: "रोज़ का स्वास्थ्य" })} title={t({ en: "Start your\nfirst check-in", te: "మీ మొదటి\nచెక్-ఇన్ ప్రారంభించండి", hi: "अपना पहला\nचेक-इन शुरू करें" })} />

        <View style={s.list}>
          {CHECKS.map((c, i) => (
            <SelectRow
              key={c.key}
              icon={c.icon}
              tint={c.tint}
              label={t(c.label)}
              sub={t(c.sub)}
              selected={picked.includes(c.key)}
              onPress={() => toggle(c.key)}
              // the selected card pops out a little wider, like the reference
              style={{ marginHorizontal: picked.includes(c.key) ? 0 : 14, marginBottom: i === CHECKS.length - 1 ? 0 : 12 }}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <PillButton label={t({ en: "Start today's check-in", te: "ఈ రోజు చెక్-ఇన్ ప్రారంభించండి", hi: "आज का चेक-इन शुरू करें" })} disabled={!first} onPress={() => first && router.push(first.href)} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: S.page },
  inner: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 18 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  list: { paddingHorizontal: 12 },
});
