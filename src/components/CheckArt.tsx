// Picture tiles for the health checks: a soft 3D image (Microsoft Fluent Emoji, MIT;
// see assets/checks/CREDITS.md) with a blinking point that marks where the phone goes
// or what to look at. Tapping the tile starts the check.
import { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { S, softShadow } from "./soft";

export const CHECK_ART = {
  breathing: { img: require("../../assets/checks/lungs.png"), point: { x: 0.5, y: 0.55 }, tint: ["#FFE9F0", "#FFF6F9"], dot: "#E5767A" },
  heart: { img: require("../../assets/checks/heart.png"), point: { x: 0.42, y: 0.58 }, tint: ["#FFE3E6", "#FFF5F6"], dot: "#E5484D" },
  chair_stand: { img: require("../../assets/checks/chair.png"), point: { x: 0.5, y: 0.5 }, tint: ["#FCEBDD", "#FFF7F0"], dot: "#E08A3C" },
  memory: { img: require("../../assets/checks/brain.png"), point: { x: 0.55, y: 0.4 }, tint: ["#EEE7FB", "#F8F5FE"], dot: "#8E78E0" },
  scam: { img: require("../../assets/checks/shield.png"), point: { x: 0.5, y: 0.48 }, tint: ["#E3F3EA", "#F4FBF7"], dot: "#3FA36B" },
} satisfies Record<string, { img: ImageSourcePropType; point: { x: number; y: number }; tint: readonly [string, string]; dot: string }>;

export type CheckArtKey = keyof typeof CHECK_ART;

/** A pulsing dot: a solid centre plus an expanding, fading ring. */
export function BlinkPoint({ color, size = 12 }: { color: string; size?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const ring = { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }], opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }) };
  const core = { opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.55, 1] }) };
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, ring]} />
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color, borderWidth: 2, borderColor: "#fff" }, core]} />
    </View>
  );
}

export function CheckTile({ art, label, sub, onPress }: { art: CheckArtKey; label: string; sub?: string; onPress: () => void }) {
  const a = CHECK_ART[art];
  const IMG = 64;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => [st.tile, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient colors={a.tint} style={st.art}>
        <View style={{ width: IMG, height: IMG }}>
          <Image source={a.img} style={{ width: IMG, height: IMG }} resizeMode="contain" />
          <View style={{ position: "absolute", left: a.point.x * IMG - 6, top: a.point.y * IMG - 6 }}><BlinkPoint color={a.dot} /></View>
        </View>
      </LinearGradient>
      <Text style={st.label} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={st.sub} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  tile: { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 22, padding: 10, alignItems: "center", ...softShadow, shadowOpacity: 0.06 },
  art: { width: "100%", borderRadius: 16, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  label: { fontSize: 14, fontWeight: "700", color: S.ink, marginTop: 8 },
  sub: { fontSize: 11, color: S.muted, marginTop: 1 },
});

// ---------------------------------------------------------------------------
// Real chest picture (Blausen Medical, CC BY 3.0; see assets/checks/CREDITS.md) with a
// big blinking circle where the phone goes: middle of the chest for breathing, over the
// heart (her left side, the right side of the picture) for heart rate.

const CHEST = require("../../assets/checks/chest.png");
const CHEST_POINT = { breathing: { x: 0.5, y: 0.55 }, heart: { x: 0.6, y: 0.68 } } as const;

export function ChestGuide({ spot, caption, big, bigLabel }: {
  spot: keyof typeof CHEST_POINT; caption?: string; big?: string | number | null; bigLabel?: string;
}) {
  const [w, setW] = useState(0);
  const p = CHEST_POINT[spot];
  const DOT = 26;
  return (
    <View style={cg.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Image source={CHEST} style={{ width: "100%", aspectRatio: 1 }} resizeMode="contain" accessibilityLabel="Chest picture showing where to place the phone" />
      {w ? (
        <View style={{ position: "absolute", left: p.x * w - DOT / 2, top: p.y * w - DOT / 2 }}>
          <BlinkPoint color={spot === "heart" ? "#E5484D" : "#7B61C9"} size={DOT} />
        </View>
      ) : null}
      {big !== undefined && big !== null ? (
        <View style={cg.big}><Text style={cg.bigNum}>{big}</Text>{bigLabel ? <Text style={cg.bigLabel}>{bigLabel}</Text> : null}</View>
      ) : null}
      {caption ? <View style={cg.caption}><Text style={cg.captionText}>{caption}</Text></View> : null}
      <Text style={cg.credit}>Image: Blausen Medical, CC BY 3.0</Text>
    </View>
  );
}

const cg = StyleSheet.create({
  wrap: { width: "100%", borderRadius: 24, overflow: "hidden", backgroundColor: "#fff", marginBottom: 14, ...softShadow },
  big: { position: "absolute", top: 12, left: 14, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  bigNum: { fontSize: 34, fontWeight: "800", color: S.ink },
  bigLabel: { fontSize: 11, color: S.muted },
  caption: { position: "absolute", bottom: 26, alignSelf: "center", backgroundColor: "rgba(20,10,10,0.82)", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, maxWidth: "90%" },
  captionText: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center" },
  credit: { position: "absolute", bottom: 4, right: 8, fontSize: 9, color: "#9A9AA0" },
});
