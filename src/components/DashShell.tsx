// Shared frame for the family web pages (dashboard, accuracy): grey canvas,
// rounded panel, brand, pill navigation. Matches the HomeCare-style reference.
import { type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SetupBanner } from "./ui";
import { D } from "./DashArt";
import { Bujji } from "./Mascot";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from "react-native-svg";

export type DashTab = "dashboard" | "insights" | "tasks" | "activity" | "accuracy";

const NAV: { key: DashTab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "dashboard", icon: "grid-outline", label: "Overview" },
  { key: "insights", icon: "sparkles-outline", label: "Care tips" },
  { key: "tasks", icon: "calendar-clear-outline", label: "Care plan" },
  { key: "activity", icon: "radio-outline", label: "Live feed" },
  { key: "accuracy", icon: "ribbon-outline", label: "Bujji score" },
];

/** Default navigation between the family pages. The dashboard passes its own handler for its in-page tabs. */
export function goTab(t: DashTab) {
  if (t === "accuracy") router.navigate("/results");
  else router.navigate({ pathname: "/family", params: { tab: t } });
}

export function useDashSize() {
  const { width, height } = useWindowDimensions();
  // fit: a laptop-sized window, where the page is laid out to fill exactly one screen.
  return { wide: width >= 1080, mid: width >= 760, fit: width >= 1080 && height >= 620 };
}

export function DashShell({ active, onTab = goTab, right, children, fit = false, familyNav = true }: {
  active: DashTab; onTab?: (t: DashTab) => void; right?: ReactNode; children: ReactNode;
  /** Fill exactly one screen (no page scroll). Only honoured on laptop-sized windows. */
  fit?: boolean;
  /** Show the family tabs (Dashboard, Tasks…). Off for pages opened from Amma's phone app, so they don't lead into the family dashboard. */
  familyNav?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const size = useDashSize();
  const { mid } = size;
  const oneScreen = fit && size.fit;

  const panel = (
    <View style={[s.panel, { padding: oneScreen ? 20 : mid ? 30 : 16 }, oneScreen && { flex: 1 }]}>
      <View style={[s.header, oneScreen && { marginBottom: 14 }, !mid && { flexDirection: "column", alignItems: "stretch", gap: 14 }]}>
            <View style={s.brandRow}>
              {Platform.OS !== "web" ? (
                <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.roundBtn} accessibilityLabel="Back">
                  <Ionicons name="chevron-back" size={20} color={D.ink} />
                </Pressable>
              ) : null}
              <View style={s.logo}><Bujji size={46} float={false} /></View>
              <View style={{ marginRight: 8 }}>
                <Text style={s.brand}><Text style={{ fontWeight: "400" }}>Hey </Text>Bujji</Text>
                <Text style={s.brandSub}>Family care</Text>
              </View>
              {/* reference layout: round chips sit right after the logo */}
              <View style={s.right}>{right}</View>
            </View>
            {familyNav ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.nav} style={{ flexGrow: 0 }}>
              {NAV.map((n) => {
                const on = n.key === active;
                return (
                  <Pressable key={n.key} onPress={() => onTab(n.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [s.navItem, on && s.navOn, { opacity: pressed ? 0.8 : 1 }]}>
                    <Ionicons name={n.icon} size={16} color={on ? "#fff" : D.muted} />
                    <Text style={[s.navText, on && { color: "#fff", fontWeight: "600" }]}>{n.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            ) : null}
          </View>
          <SetupBanner />
          {oneScreen ? <View style={{ flex: 1, minHeight: 0 }}>{children}</View> : children}
          <Text style={[s.disclaimer, oneScreen && { marginTop: 10 }]}>Hey Bujji is a wellness and family-alert assistant, not a medical device.</Text>
    </View>
  );

  return (
    <View style={s.canvas}>
      {oneScreen ? (
        <View style={{ flex: 1, padding: 18, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18, alignItems: "center" }}>{panel}</View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: mid ? 28 : 12, paddingTop: insets.top + (mid ? 28 : 12), paddingBottom: insets.bottom + 28, alignItems: "center" }}>
          {panel}
        </ScrollView>
      )}
    </View>
  );
}

/** The Hey Bujji mark: an orange speech bubble holding a heart (voice + care) on a dark squircle. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <SvgGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF9A55" />
          <Stop offset="1" stopColor="#F2621A" />
        </SvgGradient>
      </Defs>
      <Rect x="0" y="0" width="40" height="40" rx="12" fill="#161618" />
      <Path d="M11 10 H29 Q33 10 33 14 V24 Q33 28 29 28 H20 L14.5 32.5 L15.5 28 H11 Q7 28 7 24 V14 Q7 10 11 10 Z" fill="url(#lm)" />
      <Path d="M20 24.2 C14.6 20.6 13.6 18.4 14.4 16.6 C15.3 14.6 18 14.5 20 16.6 C22 14.5 24.7 14.6 25.6 16.6 C26.4 18.4 25.4 20.6 20 24.2 Z" fill="#fff" />
    </Svg>
  );
}

export const dashShadow = { shadowColor: "#5B4A7A", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 };

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: D.canvas },
  panel: { width: "100%", maxWidth: 1440, backgroundColor: D.panel, borderRadius: 34, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 30, shadowOffset: { width: 0, height: 12 } },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28, gap: 16 },
  logo: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, flexWrap: "wrap" },
  brand: { fontSize: 21, color: D.ink, fontWeight: "800", letterSpacing: -0.8, lineHeight: 24 },
  brandSub: { fontSize: 11, color: D.orange, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  // iOS-style segmented control
  nav: { flexDirection: "row", backgroundColor: "#F2F2F4", borderRadius: 999, padding: 4, gap: 2, borderWidth: 1, borderColor: "#E9E9EC" },
  navItem: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  navOn: { backgroundColor: "#161618" },
  navText: { fontSize: 14, color: D.muted, fontWeight: "500" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: D.line, ...dashShadow },
  disclaimer: { fontSize: 12, color: D.muted, textAlign: "center", marginTop: 26 },
});
