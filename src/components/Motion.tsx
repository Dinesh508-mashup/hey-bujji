// Entrance motion: content rises from below and fades in, one item after another.
// Replays every time a screen comes into focus (expo-router), so each visit feels alive.
import { Children, useCallback, useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";

const native = Platform.OS !== "web";

/** Increments each time the screen gains focus. */
export function useFocusCount() {
  const [n, setN] = useState(0);
  useFocusEffect(useCallback(() => { setN((x) => x + 1); }, []));
  return n;
}

export function Reveal({ children, delay = 0, from = 28, scale = 0.97, duration = 560, style }: {
  children: ReactNode; delay?: number; from?: number; scale?: number; duration?: number; style?: StyleProp<ViewStyle>;
}) {
  const [v] = useState(() => new Animated.Value(0));
  const focus = useFocusCount();
  useEffect(() => {
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [focus, v, delay, duration]);
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
      ],
    }]}>
      {children}
    </Animated.View>
  );
}

/** Wraps each child in a Reveal with a growing delay. */
export function Stagger({ children, step = 70, start = 0 }: { children: ReactNode; step?: number; start?: number }) {
  return <>{Children.toArray(children).filter(Boolean).map((c, i) => <Reveal key={i} delay={start + i * step}>{c}</Reveal>)}</>;
}
