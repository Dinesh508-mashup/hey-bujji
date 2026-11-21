import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { C, shadow } from "../lib/theme";
import { DISCLAIMER, isConfigured } from "../lib/config";

export function Screen({ children, scroll = true, maxWidth = 640 }: { children: ReactNode; scroll?: boolean; maxWidth?: number }) {
  const inner = <View style={[styles.inner, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: "red" | "amber" | "green" | "teal" }) {
  const bg = tone === "red" ? C.redSoft : tone === "amber" ? C.marigoldSoft : tone === "green" ? C.greenSoft : tone === "teal" ? C.tealSoft : C.card;
  const border = tone === "red" ? C.red : tone === "amber" ? C.marigold : tone === "green" ? C.green : tone === "teal" ? C.teal : C.line;
  return <View style={[styles.card, { backgroundColor: bg, borderColor: border }, style]}>{children}</View>;
}

export function BigButton({ label, sub, onPress, color = C.teal, textColor = "#fff", disabled, loading, style, icon }: {
  label: string; sub?: string; onPress: () => void; color?: string; textColor?: string; disabled?: boolean; loading?: boolean; style?: ViewStyle; icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      disabled={disabled || loading}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); }}
      style={({ pressed }) => [styles.big, { backgroundColor: color, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : (
        <>
          <Text style={[styles.bigLabel, { color: textColor }]}>{icon ? `${icon}  ` : ""}{label}</Text>
          {sub ? <Text style={[styles.bigSub, { color: textColor }]}>{sub}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

export function Disclaimer() {
  return <Text style={styles.disclaimer}>{DISCLAIMER}</Text>;
}

export function SetupBanner() {
  if (isConfigured) return null;
  return (
    <Card tone="amber" style={{ marginBottom: 16 }}>
      <Text style={styles.h3}>Back end not connected</Text>
      <Text style={styles.body}>
        Copy .env.example to .env, add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart `npx expo start`.
        Until then voice requests and the live feed won’t work.
      </Text>
    </Card>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, alignItems: "center", paddingVertical: 20 },
  inner: { width: "100%", paddingHorizontal: 16, flexGrow: 1 },
  card: { borderRadius: 20, padding: 18, borderWidth: 1.5, marginBottom: 14, ...shadow },
  big: { borderRadius: 22, paddingVertical: 20, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", minHeight: 76, marginBottom: 12, ...shadow },
  bigLabel: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  bigSub: { fontSize: 15, marginTop: 4, opacity: 0.9, textAlign: "center" },
  h1: { fontSize: 32, fontWeight: "800", color: C.ink },
  h2: { fontSize: 24, fontWeight: "800", color: C.ink, marginBottom: 6 },
  h3: { fontSize: 19, fontWeight: "700", color: C.ink, marginBottom: 4 },
  body: { fontSize: 17, color: C.ink, lineHeight: 24 },
  muted: { fontSize: 15, color: C.muted, lineHeight: 21 },
  disclaimer: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 18, marginBottom: 8 },
});
