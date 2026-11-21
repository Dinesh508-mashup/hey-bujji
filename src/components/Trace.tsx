import { View } from "react-native";
import { C } from "../lib/theme";

/** Tiny bar chart of a filtered sensor trace. */
export function Trace({ data, height = 80, color = C.teal }: { data: number[]; height?: number; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(Math.abs)) || 1;
  return (
    <View style={{ height, flexDirection: "row", alignItems: "center", gap: 1, marginVertical: 10 }}>
      {data.map((v, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(1, (Math.abs(v) / max) * (height / 2)), backgroundColor: color, opacity: 0.8, transform: [{ translateY: v > 0 ? -height / 4 : height / 4 }], borderRadius: 1 }} />
      ))}
    </View>
  );
}
