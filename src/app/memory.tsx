import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { C } from "../lib/theme";

type Word = { te: string; en: string; icon: string };
const POOL: Word[] = [
  { te: "అరటిపండు", en: "banana", icon: "🍌" }, { te: "కుర్చీ", en: "chair", icon: "🪑" }, { te: "గులాబీ", en: "rose", icon: "🌹" },
  { te: "మామిడి", en: "mango", icon: "🥭" }, { te: "తలుపు", en: "door", icon: "🚪" }, { te: "ఆవు", en: "cow", icon: "🐄" },
  { te: "గడియారం", en: "clock", icon: "🕰️" }, { te: "కొబ్బరి", en: "coconut", icon: "🥥" }, { te: "గొడుగు", en: "umbrella", icon: "☂️" },
  { te: "సైకిల్", en: "bicycle", icon: "🚲" }, { te: "చేప", en: "fish", icon: "🐟" }, { te: "దీపం", en: "lamp", icon: "🪔" },
];
const WAIT = 120;

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function Memory() {
  const [phase, setPhase] = useState<"intro" | "learn" | "wait" | "recall" | "result">("intro");
  const [left, setLeft] = useState(WAIT);
  const [picked, setPicked] = useState<string[]>([]);
  const targets = useMemo(() => shuffle(POOL).slice(0, 3), []);
  const grid = useMemo(() => shuffle([...targets, ...shuffle(POOL.filter((w) => !targets.includes(w))).slice(0, 6)]), [targets]);

  useEffect(() => {
    if (phase !== "wait") return;
    const id = setInterval(() => setLeft((l) => {
      if (l <= 1) { clearInterval(id); setPhase("recall"); speak("ఇందాక చెప్పిన మూడు పదాలు ఏవి? వాటిని నొక్కండి.", "te-IN"); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function learn() {
    setPhase("learn");
    await speak(`ఈ మూడు పదాలు గుర్తుపెట్టుకోండి. ${targets.map((t) => t.te).join(", ")}. మళ్ళీ, ${targets.map((t) => t.te).join(", ")}.`, "te-IN");
  }

  const score = picked.filter((p) => targets.some((t) => t.en === p)).length;
  async function finish() {
    setPhase("result");
    speak(`మీరు మూడింటిలో ${score} గుర్తుపెట్టుకున్నారు.`, "te-IN");
    await logEvent("memory", `Memory check: recalled ${score} of 3 words after 2 minutes`, "normal", { score, targets: targets.map((t) => t.en), picked });
  }

  return (
    <Screen>
      {phase === "intro" ? (
        <>
          <Text style={ui.h2}>జ్ఞాపకశక్తి · Memory check</Text>
          <Card><Text style={ui.body}>Bujji says 3 words. Remember them. After 2 minutes, pick them from a list. A light daily exercise, not a test for any illness.</Text></Card>
          <BigButton label="Start" onPress={learn} />
        </>
      ) : null}
      {phase === "learn" ? (
        <>
          <Text style={ui.h2}>Remember these 3 · గుర్తుపెట్టుకోండి</Text>
          {targets.map((t) => (
            <Card key={t.en} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Text style={{ fontSize: 44 }}>{t.icon}</Text>
              <View><Text style={st.word}>{t.te}</Text><Text style={ui.muted}>{t.en}</Text></View>
            </Card>
          ))}
          <BigButton label="Say again" color={C.card} textColor={C.ink} onPress={learn} />
          <BigButton label="Got them" onPress={() => { setLeft(WAIT); setPhase("wait"); }} />
        </>
      ) : null}
      {phase === "wait" ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={st.big}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</Text>
          <Text style={[ui.body, { textAlign: "center" }]}>Talk about something else for 2 minutes. Bujji will ask for the words.</Text>
          <BigButton label="Skip wait (demo)" color={C.card} textColor={C.ink} onPress={() => setLeft(1)} style={{ marginTop: 30, width: "100%" }} />
        </View>
      ) : null}
      {phase === "recall" ? (
        <>
          <Text style={ui.h2}>Which 3 words? ఏ మూడు పదాలు?</Text>
          <View style={st.grid}>
            {grid.map((w) => {
              const on = picked.includes(w.en);
              return (
                <Pressable key={w.en} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== w.en) : p.length < 3 ? [...p, w.en] : p))}
                  style={[st.cell, on ? { borderColor: C.teal, backgroundColor: C.tealSoft } : null]}>
                  <Text style={{ fontSize: 36 }}>{w.icon}</Text>
                  <Text style={st.cellText}>{w.te}</Text>
                </Pressable>
              );
            })}
          </View>
          <BigButton label="Done" onPress={finish} disabled={picked.length !== 3} />
        </>
      ) : null}
      {phase === "result" ? (
        <Card tone={score === 3 ? "green" : "amber"}>
          <Text style={st.big}>{score}/3</Text>
          <Text style={[ui.body, { textAlign: "center" }]}>The words were {targets.map((t) => `${t.icon} ${t.te}`).join(", ")}.</Text>
          <Text style={[ui.muted, { textAlign: "center", marginTop: 8 }]}>One result means little on its own. Ravi sees the trend over weeks.</Text>
        </Card>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 80, fontWeight: "900", color: C.ink, textAlign: "center" },
  word: { fontSize: 28, fontWeight: "800", color: C.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  cell: { flexBasis: "30%", flexGrow: 1, alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 2, borderColor: C.line, backgroundColor: C.card },
  cellText: { fontSize: 16, fontWeight: "700", color: C.ink, marginTop: 4 },
});
