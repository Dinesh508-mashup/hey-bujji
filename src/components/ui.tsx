import { type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { C, shadow } from "../lib/theme";
import { isConfigured } from "../lib/config";
import { useLang } from "../lib/language";
import { FloatingTabBar, GlassButton, Hero, PetalBackdrop, S, type IconName } from "./soft";

export type Tint = "bloom" | "mint" | "dawn" | "sea" | "dusk";

/**
 * Page shell: pastel petal backdrop, frosted back button, centred hero title,
 * optional floating tab bar. The native stack header is hidden app-wide.
 */
export function Screen({ children, scroll = true, maxWidth = 640, title, eyebrow, icon = "heart", tint = "bloom", tab, back = true, nav = true }: {
  children: ReactNode; scroll?: boolean; maxWidth?: number;
  title?: string; eyebrow?: string; icon?: IconName; tint?: Tint; tab?: string; back?: boolean; nav?: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") tab = undefined; // the tab bar belongs to Amma's phone app
  const bottom = insets.bottom + (tab ? 110 : 24);
  const head = (
    <>
      {nav ? <View style={styles.topBar}>
        {back ? <GlassButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : <View />}
        <GlassButton icon="home-outline" label="Home" onPress={() => router.navigate("/")} />
      </View> : null}
      {title ? <Hero compact icon={icon} eyebrow={eyebrow} title={title} /> : null}
    </>
  );
  const inner = <View style={[styles.inner, { maxWidth }]}>{head}{children}</View>;
  return (
    <View style={styles.safe}>
      <PetalBackdrop colors={S[tint]} height={380} />
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: bottom }]} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1, paddingTop: insets.top + 8, paddingBottom: bottom }]}>{inner}</View>
      )}
      {tab ? <FloatingTabBar active={tab} /> : null}
    </View>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: "red" | "amber" | "green" | "teal" }) {
  const bg = tone === "red" ? C.redSoft : tone === "amber" ? C.marigoldSoft : tone === "green" ? C.greenSoft : tone === "teal" ? C.tealSoft : C.card;
  const border = tone === "red" ? "#F6C9CA" : tone === "amber" ? "#F9DCBC" : tone === "green" ? "#C8EAD6" : tone === "teal" ? "#CBE8DB" : "transparent";
  return <View style={[styles.card, { backgroundColor: bg, borderColor: border }, style]}>{children}</View>;
}

export function BigButton({ label, sub, onPress, color = C.teal, textColor = "#fff", disabled, loading, style, icon }: {
  label: string; sub?: string; onPress: () => void; color?: string; textColor?: string; disabled?: boolean; loading?: boolean; style?: ViewStyle; icon?: string;
}) {
  const light = color === C.card || color === "#fff" || color === "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      disabled={disabled || loading}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); }}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: color, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        light ? styles.bigLight : null,
        style,
      ]}
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
  const { t } = useLang();
  return <Text style={styles.disclaimer}>{t({ en: "Wellness and family-alert assistant, not a medical device.", te: "ఆరోగ్య, కుటుంబ అలర్ట్ సహాయకుడు, వైద్య పరికరం కాదు.", hi: "स्वास्थ्य और परिवार अलर्ट सहायक, चिकित्सा उपकरण नहीं।" })}</Text>;
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
  scroll: { flexGrow: 1, alignItems: "center" },
  inner: { width: "100%", paddingHorizontal: 18, flexGrow: 1 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  card: { borderRadius: 22, padding: 18, borderWidth: 1, marginBottom: 14, ...shadow },
  big: { borderRadius: 999, paddingVertical: 17, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", minHeight: 62, marginBottom: 12 },
  bigLight: { ...shadow, shadowOpacity: 0.06 },
  bigLabel: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  bigSub: { fontSize: 13, marginTop: 3, opacity: 0.75, textAlign: "center" },
  h1: { fontSize: 30, fontWeight: "600", color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: "700", color: C.ink, marginBottom: 10 },
  h3: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 4 },
  body: { fontSize: 16, color: C.ink, lineHeight: 24 },
  muted: { fontSize: 14, color: C.muted, lineHeight: 20 },
  input: { fontSize: 17, borderRadius: 16, padding: 15, marginVertical: 12, backgroundColor: C.field, color: C.ink },
  disclaimer: { fontSize: 12, color: C.muted, textAlign: "center", marginTop: 18, marginBottom: 8 },
});
