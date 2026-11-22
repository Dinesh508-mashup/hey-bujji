// Drawings for the family dashboard: area chart, pulse line, glossy heart.
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";

// Family pages share the parent app's soft theme: near-black accents (like its black
// pill buttons), lilac/pink tints, white cards on a lavender-pink bloom.
// `blue*` keep their names so existing styles pick up the new colours.
export const D = {
  // Apple-style neutral system: near-black ink, system blue for data, system status colours.
  // `blue` is the primary accent (buttons, selected states); kept by name so all styles follow.
  blue: "#1D1D1F",
  blueSoft: "#F2F2F7",
  blueMid: "#F26A1B", // charts and data: orange
  orange: "#F26A1B",
  dark: "#161618",
  canvas: "#E7E7EA",
  panel: "#FFFFFF",
  card: "#FFFFFF",
  ink: "#1D1D1F",
  muted: "#6E6E73",
  line: "#E8E8ED",
  pill: "#F5F5F7",
  red: "#FF3B30",
  redSoft: "#FFF1F0",
  amber: "#FF9F0A",
  amberSoft: "#FFF6E5",
  green: "#34C759",
} as const;

type Pt = { x: number; y: number };

/** Catmull-Rom spline as cubic Bézier segments. */
function smooth(p: Pt[]) {
  if (p.length < 2) return "";
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i], b = p[i], c = p[i + 1], e = p[i + 2] ?? c;
    d += ` C${b.x + (c.x - a.x) / 6},${b.y + (c.y - a.y) / 6} ${c.x - (e.x - b.x) / 6},${c.y - (e.y - b.y) / 6} ${c.x},${c.y}`;
  }
  return d;
}

/** Smooth area chart with dashed grid lines, like the reference "Cholesterol level" card. */
export function AreaChart({ data, height = 180, color = D.blue, warnAbove, unit = "" }: {
  data: { label: string; value: number }[]; height?: number; color?: string; warnAbove?: number; unit?: string;
}) {
  const [w, setW] = useState(0);
  const padL = 34, padR = 10, padT = 10, padB = 26;
  const vals = data.map((d) => d.value);
  const lo = Math.floor(Math.min(...vals, warnAbove ?? Infinity) - 2);
  const hi = Math.ceil(Math.max(...vals, warnAbove ?? -Infinity) + 2);
  const ticks = [0, 1, 2, 3].map((i) => Math.round(lo + ((hi - lo) * i) / 3));
  const X = (i: number) => padL + (data.length === 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (data.length - 1));
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (height - padT - padB);
  const pts = data.map((d, i) => ({ x: X(i), y: Y(d.value) }));
  const line = smooth(pts);
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].x},${height - padB} L${pts[0].x},${height - padB} Z` : "";
  const every = Math.max(1, Math.ceil(data.length / 8));

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke={warnAbove !== undefined && t > warnAbove ? "#F2B8BA" : "#D9DCE3"} strokeDasharray="5 5" strokeWidth={1} />
              <SvgText x={padL - 8} y={Y(t) + 4} fontSize={10} fill={D.muted} textAnchor="end">{t}</SvgText>
            </G>
          ))}
          {warnAbove !== undefined ? <Line x1={padL} x2={w - padR} y1={Y(warnAbove)} y2={Y(warnAbove)} stroke={D.red} strokeOpacity={0.55} strokeDasharray="6 5" strokeWidth={1.2} /> : null}
          <Line x1={padL} x2={padL} y1={padT} y2={height - padB} stroke="#C9CDD6" strokeWidth={1} />
          {area ? <Path d={area} fill="url(#fill)" /> : null}
          {line ? <Path d={line} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" /> : null}
          {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 2.5} fill={i === pts.length - 1 ? color : "#fff"} stroke={color} strokeWidth={1.6} />)}
          {data.map((d, i) => (i % every === 0 || i === data.length - 1 ? (
            <SvgText key={i} x={X(i)} y={height - 8} fontSize={10} fill={D.muted} textAnchor="middle">{d.label}</SvgText>
          ) : null))}
          {pts.length ? (
            <SvgText x={Math.min(pts[pts.length - 1].x, w - padR - 4)} y={Math.max(pts[pts.length - 1].y - 10, 10)} fontSize={11} fontWeight="600" fill={color} textAnchor="end">
              {`${data[data.length - 1].value}${unit}`}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** Small two-line sparkline used in the "Today" card. */
export function Spark({ values, color = D.blue, height = 46 }: { values: number[]; color?: string; height?: number }) {
  const [w, setW] = useState(0);
  const lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => ({ x: values.length === 1 ? w / 2 : (i * w) / (values.length - 1), y: 6 + (1 - (v - lo) / (hi - lo || 1)) * (height - 12) }));
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && values.length > 1 ? (
        <Svg width={w} height={height}>
          <Path d={smooth(pts)} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** Decorative heartbeat line for the overlay card (no numbers in it). */
export function PulseLine({ color = D.blue, height = 54 }: { color?: string; height?: number }) {
  const [w, setW] = useState(0);
  const mid = height / 2;
  const beat = [[0, 0], [10, 0], [13, -3], [16, 0], [20, 0], [22, 4], [25, -20], [28, 14], [31, 0], [37, 0], [41, -5], [45, 0], [52, 0]];
  let d = "";
  if (w > 0) {
    for (let x0 = 0; x0 < w; x0 += 52) {
      for (const [dx, dy] of beat) {
        const x = x0 + dx;
        if (x > w) break;
        d += `${d ? " L" : "M"}${x},${mid + dy}`;
      }
    }
  }
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

/** Glossy stylised heart with vessels, drawn in code. */
export function HeartArt({ size = 300 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 -46 200 230">
      <Defs>
        <RadialGradient id="hb" cx="38%" cy="35%" r="75%">
          <Stop offset="0" stopColor="#F7A29C" />
          <Stop offset="0.55" stopColor="#E0625B" />
          <Stop offset="1" stopColor="#B33A35" />
        </RadialGradient>
        <LinearGradient id="hv" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#C9443D" />
          <Stop offset="0.5" stopColor="#EE8580" />
          <Stop offset="1" stopColor="#C04039" />
        </LinearGradient>
        <RadialGradient id="hs" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#000" stopOpacity={0.18} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={104} cy={178} rx={70} ry={9} fill="url(#hs)" />
      {/* vessels */}
      <Path d="M86 30 C 84 0, 70 -18, 52 -26" stroke="url(#hv)" strokeWidth={17} strokeLinecap="round" fill="none" />
      <Path d="M104 26 L104 -30" stroke="#D65A53" strokeWidth={19} strokeLinecap="round" />
      <Path d="M100 22 L100 -28" stroke="#F09A94" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" />
      <Path d="M118 30 C 122 4, 138 -12, 156 -18" stroke="url(#hv)" strokeWidth={15} strokeLinecap="round" fill="none" />
      <Ellipse cx={104} cy={-31} rx={9.5} ry={4.5} fill="#F3B2AD" />
      <Ellipse cx={52} cy={-26} rx={8} ry={5} fill="#F3B2AD" transform="rotate(-30 52 -26)" />
      <Ellipse cx={156} cy={-18} rx={7} ry={4.5} fill="#F3B2AD" transform="rotate(20 156 -18)" />
      {/* body */}
      <Path d="M100 172 C 46 136, 10 104, 14 64 C 18 30, 46 12, 72 16 C 88 18, 97 30, 101 42 C 106 30, 116 18, 132 16 C 158 12, 186 30, 188 64 C 191 104, 156 138, 100 172 Z" fill="url(#hb)" />
      {/* groove and gloss */}
      <Path d="M101 46 C 96 80, 106 116, 96 160" stroke="#9E302C" strokeOpacity={0.35} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M46 40 C 30 52, 26 76, 34 96" stroke="#fff" strokeOpacity={0.45} strokeWidth={7} fill="none" strokeLinecap="round" />
      <Ellipse cx={142} cy={52} rx={16} ry={9} fill="#fff" opacity={0.22} transform="rotate(-25 142 52)" />
    </Svg>
  );
}
