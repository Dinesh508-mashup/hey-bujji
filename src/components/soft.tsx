// Soft, airy UI kit: pastel gradient header with a petal bloom, white rounded cards,
// pill chips and a floating tab bar. Pure RN views + expo-linear-gradient (works in Expo Go).
import { type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export const S = {
  ink: "#141414",
  muted: "#7A7A80",
  faint: "#B9B9C0",
  card: "#FFFFFF",
  page: "#FFFFFF",
  black: "#140A0A",
  // header gradients
  bloom: ["#D9C9F2", "#F2CFE3", "#FBE4EC", "#FFFFFF"] as const,
  mint: ["#BFE3D2", "#DCEFE6", "#F1F8F4", "#FFFFFF"] as const,
  dawn: ["#FBD3B0", "#FCE3D3", "#FFF3EA", "#FFFFFF"] as const,
  sea: ["#BFE0F5", "#D9EEF7", "#F0F8FB", "#FFFFFF"] as const,
  dusk: ["#CFC4F4", "#E3DAF8", "#F3EFFC", "#FFFFFF"] as const,
  // icon tints
  peach: ["#FFD3A8", "#F7A35C"] as const,
  sage: ["#D8EBDD", "#9CC8A8"] as const,
  lilac: ["#E4DCFA", "#B3A2F0"] as const,
  sky: ["#D4ECFA", "#86C3EC"] as const,
};

export const softShadow: ViewStyle = {
  shadowColor: "#5B4A7A",
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

/** Gradient wash + translucent petals behind the top of a screen. */
export function PetalBackdrop({ colors, height = 420 }: { colors: readonly [string, string, ...string[]]; height?: number }) {
  const petals = [-60, -30, 0, 30, 60];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <LinearGradient colors={colors} locations={[0, 0.45, 0.75, 1]} style={StyleSheet.absoluteFill} />
      <View style={b.bloom}>
        {petals.map((deg) => (
          <View key={deg} style={[b.petal, { transform: [{ rotate: `${deg}deg` }, { translateY: -70 }] }]} />
        ))}
        {[-90, 90].map((deg) => (
          <View key={deg} style={[b.petal, b.side, { transform: [{ rotate: `${deg}deg` }, { translateY: -90 }] }]} />
        ))}
      </View>
    </View>
  );
}

/** Frosted circular icon button (back, close, settings). */
export function GlassButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [b.glass, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={S.ink} />
    </Pressable>
  );
}

/** Small white circle with a dark glyph that sits above the hero title. */
export function HeroBadge({ icon }: { icon: IconName }) {
  return (
    <View style={b.badge}>
      <Ionicons name={icon} size={22} color={S.ink} />
    </View>
  );
}

export function Hero({ icon, eyebrow, title, compact }: { icon: IconName; eyebrow?: string; title: string; compact?: boolean }) {
  return (
    <View style={{ alignItems: "center", marginTop: compact ? 8 : 24, marginBottom: compact ? 22 : 28 }}>
      <HeroBadge icon={icon} />
      {eyebrow ? <Text style={b.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[b.title, compact ? { fontSize: 28, lineHeight: 34 } : null]}>{title}</Text>
    </View>
  );
}

/** Round gradient orb holding an icon (the peach/sage/lilac blobs). */
export function Orb({ icon, tint, size = 40 }: { icon: IconName; tint: readonly [string, string]; size?: number }) {
  return (
    <LinearGradient colors={tint} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={size * 0.5} color="#fff" />
    </LinearGradient>
  );
}

export function SoftCard({ children, style, onPress, label }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[b.card, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [b.card, style, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={b.section}>
      <Text style={b.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={b.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill with a tiny coloured glyph, used in the "Log today" grid. */
export function Chip({ icon, color, label, onPress }: { icon: IconName; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [b.chip, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={b.chipText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Selectable row card with orb, label and a check circle (check-in list). */
export function SelectRow({ icon, tint, label, sub, selected, onPress, style }: {
  icon: IconName; tint: readonly [string, string]; label: string; sub?: string; selected: boolean; onPress: () => void; style?: ViewStyle;
}) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={label}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [b.card, b.select, style, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Orb icon={icon} tint={tint} size={44} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={b.selectLabel}>{label}</Text>
        {sub ? <Text style={b.selectSub}>{sub}</Text> : null}
      </View>
      <View style={[b.check, selected ? b.checkOn : null]}>
        <Ionicons name="checkmark" size={14} color={selected ? "#fff" : S.ink} />
      </View>
    </Pressable>
  );
}

export function PillButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); }}
      style={({ pressed }) => [b.pill, { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }]}>
      <Text style={b.pillText}>{label}</Text>
    </Pressable>
  );
}

type Tab = { icon: IconName; label: string; href: string };
const TABS: Tab[] = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "document-text-outline", label: "Check a message", href: "/check" },
  { icon: "add-circle-outline", label: "Check-in", href: "/checkin" },
  { icon: "mic-outline", label: "Talk to Bujji", href: "/parent" },
  { icon: "stats-chart-outline", label: "Results", href: "/results" },
];

/** Floating white capsule tab bar; the active tab is a black circle. */
export function FloatingTabBar({ active }: { active: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[b.tabWrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={b.tabBar}>
        {TABS.map((t) => {
          const on = t.href === active;
          return (
            <Pressable key={t.href} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
              onPress={() => { tap(); if (!on) router.navigate(t.href as never); }}
              style={[b.tab, on ? b.tabOn : null]}>
              <Ionicons name={t.icon} size={20} color={on ? "#fff" : "#8A8A90"} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  bloom: { position: "absolute", top: 70, left: 0, right: 0, alignItems: "center" },
  petal: {
    position: "absolute", width: 110, height: 170, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)",
  },
  side: { width: 120, height: 150, backgroundColor: "rgba(255,255,255,0.18)" },
  glass: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)",
  },
  badge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...softShadow,
  },
  eyebrow: { fontSize: 13, color: "#55555C", marginTop: 16 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "500", color: S.ink, textAlign: "center", marginTop: 6, letterSpacing: -0.6 },
  card: { backgroundColor: S.card, borderRadius: 22, padding: 16, ...softShadow },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: S.ink },
  sectionAction: { fontSize: 13, color: S.muted },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: "45%",
    backgroundColor: "#fff", borderRadius: 999, paddingVertical: 11, paddingHorizontal: 14, ...softShadow, shadowOpacity: 0.05,
  },
  chipText: { fontSize: 14, color: "#3A3A40", flexShrink: 1 },
  select: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  selectLabel: { fontSize: 16, fontWeight: "600", color: S.ink },
  selectSub: { fontSize: 13, color: S.muted, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: S.ink, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: S.ink },
  pill: { backgroundColor: S.black, borderRadius: 999, paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  pillText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  tabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  tabBar: {
    flexDirection: "row", gap: 6, backgroundColor: "#fff", borderRadius: 999, padding: 6,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  tab: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: S.black },
});
