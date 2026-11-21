import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton, Hero, PetalBackdrop, PillButton, S, SelectRow, type IconName } from "../components/soft";

type Check = { key: string; href: "/breathing" | "/chairstand" | "/memory"; label: string; sub: string; icon: IconName; tint: readonly [string, string] };

const CHECKS: Check[] = [
  { key: "breathing", href: "/breathing", label: "Breathing", sub: "Count breaths for 30 seconds", icon: "leaf", tint: S.peach },
  { key: "chairstand", href: "/chairstand", label: "Chair stand", sub: "Stand up and sit down", icon: "body", tint: S.sage },
  { key: "memory", href: "/memory", label: "Memory", sub: "Remember three words", icon: "moon", tint: S.lilac },
];

export default function CheckIn() {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<string[]>(["breathing"]);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const first = CHECKS.find((c) => picked.includes(c.key));

  return (
    <View style={s.page}>
      <PetalBackdrop colors={S.mint} height={520} />
      <View style={[s.inner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.topBar}>
          <GlassButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          <GlassButton icon="close" label="Close" onPress={() => router.replace("/")} />
        </View>

        <Hero icon="pulse" eyebrow="Track daily health" title={"Start your\nfirst check-in"} />

        <View style={s.list}>
          {CHECKS.map((c, i) => (
            <SelectRow
              key={c.key}
              icon={c.icon}
              tint={c.tint}
              label={c.label}
              sub={c.sub}
              selected={picked.includes(c.key)}
              onPress={() => toggle(c.key)}
              // the selected card pops out a little wider, like the reference
              style={{ marginHorizontal: picked.includes(c.key) ? 0 : 14, marginBottom: i === CHECKS.length - 1 ? 0 : 12 }}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <PillButton label="Start today's check-in" disabled={!first} onPress={() => first && router.push(first.href)} />
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
