// Shared frame for the family web pages (dashboard, accuracy): grey canvas,
// rounded panel, brand, pill navigation. Matches the HomeCare-style reference.
import { type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SetupBanner } from "./ui";
import { D } from "./DashArt";
import { PetalBackdrop, S } from "./soft";

export type DashTab = "dashboard" | "tasks" | "activity" | "accuracy";

const NAV: { key: DashTab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "dashboard", icon: "grid-outline", label: "Dashboard" },
  { key: "tasks", icon: "calendar-outline", label: "Tasks" },
  { key: "activity", icon: "pulse-outline", label: "Activity" },
  { key: "accuracy", icon: "stats-chart-outline", label: "Accuracy" },
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
              <Text style={s.brand}>Hey<Text style={{ fontWeight: "800" }}>Bujji</Text></Text>
            </View>
            {familyNav ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.nav} style={{ flexGrow: 0 }}>
              {NAV.map((n) => {
                const on = n.key === active;
                return (
                  <Pressable key={n.key} onPress={() => onTab(n.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [s.navItem, on && s.navOn, { opacity: pressed ? 0.8 : 1 }]}>
                    <Ionicons name={n.icon} size={17} color={on ? "#fff" : D.blue} />
                    <Text style={[s.navText, on && { color: "#fff" }]}>{n.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            ) : null}
            <View style={s.right}>{right}</View>
          </View>
          <SetupBanner />
          {oneScreen ? <View style={{ flex: 1, minHeight: 0 }}>{children}</View> : children}
          <Text style={[s.disclaimer, oneScreen && { marginTop: 10 }]}>Hey Bujji is a wellness and family-alert assistant, not a medical device.</Text>
    </View>
  );

  return (
    <View style={s.canvas}>
      <PetalBackdrop colors={S.bloom} height={560} />
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

export const dashShadow = { shadowColor: "#5B4A7A", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 };

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: D.canvas },
  panel: { width: "100%", maxWidth: 1400, backgroundColor: D.panel, borderRadius: 36, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28, gap: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 180 },
  brand: { fontSize: 30, color: D.ink, fontWeight: "400", letterSpacing: -1 },
  nav: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 999, padding: 6, gap: 4, ...dashShadow },
  navItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999 },
  navOn: { backgroundColor: D.blue },
  navText: { fontSize: 14, color: D.blue, fontWeight: "500" },
  right: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end", minWidth: 180 },
  roundBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...dashShadow },
  disclaimer: { fontSize: 12, color: D.muted, textAlign: "center", marginTop: 26 },
});
