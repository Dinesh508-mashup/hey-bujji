// Bujji, the app's mascot: a chubby speech-bubble robot with big glossy eyes.
// Original drawing (react-native-svg). It floats gently, blinks, and can "listen" (eyes up, cheeks glow).
import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

export function Bujji({ size = 160, float = true, listening = false }: { size?: number; float?: boolean; listening?: boolean }) {
  const [blink, setBlink] = useState(false);
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setTimeout(() => { if (!alive) return; setBlink(true); setTimeout(() => { setBlink(false); loop(); }, 140); }, 2200 + Math.random() * 2200);
    };
    loop();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!float) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [bob, float]);

  const lookY = listening ? -4 : 0;
  const eye = (cx: number) => (
    <>
      <Ellipse cx={cx} cy={92} rx={27} ry={blink ? 3 : 27} fill="#fff" />
      {!blink ? (
        <>
          <Circle cx={cx} cy={93 + lookY} r={17} fill="url(#pupil)" />
          <Circle cx={cx - 6} cy={86 + lookY} r={6} fill="#fff" opacity={0.95} />
          <Circle cx={cx + 6} cy={99 + lookY} r={2.5} fill="#fff" opacity={0.7} />
        </>
      ) : null}
    </>
  );

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.05] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFB47A" />
            <Stop offset="1" stopColor="#F2621A" />
          </LinearGradient>
          <RadialGradient id="pupil" cx="0.45" cy="0.4" r="0.7">
            <Stop offset="0" stopColor="#3A3A44" />
            <Stop offset="1" stopColor="#0B0B10" />
          </RadialGradient>
          <RadialGradient id="shade" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#000" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* floor shadow */}
        <Ellipse cx={100} cy={188} rx={52} ry={7} fill="url(#shade)" />
        {/* antenna bobbles */}
        <Circle cx={52} cy={38} r={11} fill="#FF9A55" />
        <Circle cx={148} cy={38} r={11} fill="#FF9A55" />
        {/* speech-bubble body with a tail */}
        <Path d="M40 48 H160 Q186 48 186 76 V122 Q186 150 160 150 H112 L98 172 L90 150 H40 Q14 150 14 122 V76 Q14 48 40 48 Z" fill="url(#body)" />
        {/* top shine */}
        <Path d="M42 58 H128 Q140 58 136 66 Q90 72 34 74 Q30 60 42 58 Z" fill="#fff" opacity={0.35} />
        {eye(70)}
        {eye(130)}
        {/* cheeks */}
        <Ellipse cx={42} cy={124} rx={11} ry={6} fill="#FFE1CC" opacity={listening ? 0.95 : 0.7} />
        <Ellipse cx={158} cy={124} rx={11} ry={6} fill="#FFE1CC" opacity={listening ? 0.95 : 0.7} />
        {/* smile */}
        <Path d={listening ? "M90 128 Q100 140 110 128 Q100 134 90 128 Z" : "M88 128 Q100 138 112 128"} stroke="#5A2306" strokeWidth={4} strokeLinecap="round" fill={listening ? "#5A2306" : "none"} />
      </Svg>
    </Animated.View>
  );
}

/** Small round Bujji avatar for headers and buttons. */
export function BujjiBadge({ size = 44 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Bujji size={size * 1.05} float={false} />
    </View>
  );
}
