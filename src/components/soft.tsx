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
  ink: "#1A1A1A",
  muted: "#8A847D",
  faint: "#C4BDB5",
  card: "#FFFFFF",
  page: "#F6F3EF",
  black: "#121212",
  orange: "#F26A1B",
  // header gradients: one warm orange family (names kept so every screen follows)
  bloom: ["#F2621A", "#F58340", "#F9B588", "#F6F3EF"] as const,
  mint: ["#EE6A24", "#F38B4E", "#F8BC93", "#F6F3EF"] as const,
  dawn: ["#F46B17", "#F7903F", "#FBC08F", "#F6F3EF"] as const,
  sea: ["#EC6420", "#F2864A", "#F7B68E", "#F6F3EF"] as const,
  dusk: ["#F0621F", "#F48548", "#F9B791", "#F6F3EF"] as const,
  // icon tints (orange, olive, pink, blue)
  peach: ["#FFB27E", "#F26A1B"] as const,
  sage: ["#FFC08F", "#E0661F"] as const,
  lilac: ["#FFB98A", "#C9480F"] as const,
  sky: ["#FFD3A8", "#F28A1F"] as const,
};

export const softShadow: ViewStyle = {
  shadowColor: "#3A2A1A",
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

/** Orange header wash with two thin white arcs (the "energy" sweep) that fades into the page. */
export function PetalBackdrop({ colors, height = 420 }: { colors: readonly [string, string, ...string[]]; height?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: "hidden" }]}>
      <LinearGradient colors={colors} locations={[0, 0.5, 0.8, 1]} style={StyleSheet.absoluteFill} />
      <View style={[b.arc, { width: 520, height: 520, borderRadius: 260, right: -300, top: -180 }]} />
      <View style={[b.arc, { width: 380, height: 380, borderRadius: 190, right: -250, top: -40, opacity: 0.6 }]} />
      <LinearGradient colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} start={{ x: 1, y: 0 }} end={{ x: 0.4, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Frosted circular icon button (back, close, settings). */
export function GlassButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [b.glass, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

/** Small white circle with a dark glyph that sits above the hero title. */
export function HeroBadge({ icon }: { icon: IconName }) {
  return (
    <View style={b.badge}>
      <Ionicons name={icon} size={22} color={S.orange} />
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

type Tab = { icon: IconName; iconOn: IconName; label: string; href: string; center?: boolean };
const TABS: Tab[] = [
  { icon: "home-outline", iconOn: "home", label: "Home", href: "/" },
  { icon: "fitness-outline", iconOn: "fitness", label: "Health", href: "/health" },
  { icon: "mic-outline", iconOn: "mic", label: "Talk", href: "/parent", center: true },
  { icon: "shield-checkmark-outline", iconOn: "shield-checkmark", label: "Scam", href: "/check" },
  { icon: "trophy-outline", iconOn: "trophy", label: "Results", href: "/results" },
];

/** Floating black capsule tab bar; "Talk" is the glowing orange pill in the centre. */
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
              style={t.center ? b.talkTap : b.tab}>
              {t.center ? (
                <LinearGradient colors={["#FF8A3D", "#F2621A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={b.talk}>
                  <Ionicons name={t.iconOn} size={24} color="#fff" />
                </LinearGradient>
              ) : (
                <>
                  <Ionicons name={on ? t.iconOn : t.icon} size={22} color={on ? "#fff" : "#8C8C8C"} />
                  <Text style={[b.tabLabel, on ? { color: "#fff", fontWeight: "700" } : null]}>{t.label}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  arc: { position: "absolute", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.45)" },
  glass: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
  },
  badge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...softShadow,
  },
  eyebrow: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 16 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "600", color: "#fff", textAlign: "center", marginTop: 6, letterSpacing: -0.8 },
  card: { backgroundColor: S.card, borderRadius: 24, padding: 16, ...softShadow },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: S.ink, letterSpacing: -0.3 },
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
  pill: { backgroundColor: S.orange, borderRadius: 999, paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  pillText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  tabWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  tabBar: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#121212", borderRadius: 34, paddingHorizontal: 10, paddingVertical: 8,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  tab: { width: 58, height: 52, alignItems: "center", justifyContent: "center" },
  tabIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: S.black },
  talkTap: { paddingHorizontal: 4 },
  talk: { width: 74, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center",
    shadowColor: "#F26A1B", shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  tabLabel: { fontSize: 10, color: "#8C8C8C", marginTop: 3 },
});
