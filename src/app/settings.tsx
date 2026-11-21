import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Disclaimer, Screen } from "../components/ui";
import { Orb, S, SectionHeader, softShadow } from "../components/soft";
import { LANGS, useLang } from "../lib/language";

export default function Settings() {
  const { lang, setLang, t } = useLang();

  return (
    <Screen title={t({ en: "Settings", te: "సెట్టింగ్‌లు", hi: "सेटिंग्स" })} icon="settings-sharp" tint="bloom">
      <SectionHeader title={t({ en: "Language", te: "భాష", hi: "भाषा" })} />
      <Text style={st.hint}>
        {t({
          en: "Bujji shows, speaks and replies in this language.",
          te: "బుజ్జి ఈ భాషలో చూపిస్తుంది, మాట్లాడుతుంది, జవాబిస్తుంది.",
          hi: "बुज्जी इसी भाषा में दिखाएगी, बोलेगी और जवाब देगी।",
        })}
      </Text>
      <View style={st.group}>
        {LANGS.map((l, i) => {
          const on = l.code === lang;
          return (
            <Pressable
              key={l.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.label}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setLang(l.code); }}
              style={({ pressed }) => [st.row, i > 0 ? st.divider : null, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle}>{l.native}</Text>
                {l.native !== l.label ? <Text style={st.rowSub}>{l.label}</Text> : null}
              </View>
              <View style={[st.radio, on ? st.radioOn : null]}>
                {on ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title={t({ en: "Evaluation", te: "మూల్యాంకనం", hi: "मूल्यांकन" })} />
      <View style={st.group}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/record")} style={({ pressed }) => [st.row, { opacity: pressed ? 0.7 : 1 }]}>
          <Orb icon="radio-button-on" tint={S.peach} size={36} />
          <Text style={[st.rowTitle, { flex: 1, marginLeft: 12 }]}>{t({ en: "Record test clips", te: "టెస్ట్ క్లిప్‌లు రికార్డ్ చేయండి", hi: "टेस्ट क्लिप रिकॉर्ड करें" })}</Text>
          <Ionicons name="chevron-forward" size={18} color={S.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/results")} style={({ pressed }) => [st.row, st.divider, { opacity: pressed ? 0.7 : 1 }]}>
          <Orb icon="stats-chart" tint={S.sky} size={36} />
          <Text style={[st.rowTitle, { flex: 1, marginLeft: 12 }]}>{t({ en: "Accuracy results", te: "ఖచ్చితత్వ ఫలితాలు", hi: "सटीकता के नतीजे" })}</Text>
          <Ionicons name="chevron-forward" size={18} color={S.ink} />
        </Pressable>
      </View>

      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  hint: { fontSize: 14, color: S.muted, marginTop: -4, marginBottom: 10 },
  group: { backgroundColor: "#fff", borderRadius: 22, paddingHorizontal: 16, ...softShadow },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 15 },
  divider: { borderTopWidth: 1, borderTopColor: "#F0F0F4" },
  rowTitle: { fontSize: 16, fontWeight: "600", color: S.ink },
  rowSub: { fontSize: 13, color: S.muted, marginTop: 2 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: S.ink, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: S.ink },
});
