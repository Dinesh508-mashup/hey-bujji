import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { speak } from "../lib/speak";
import { logEvent } from "../lib/api";
import { completeKind } from "../lib/tasks";
import { C, shadow } from "../lib/theme";
import { useLang } from "../lib/language";
import { BodyGuide, GuideControls, controlLabels, countWords, useCountIn, useStepCycle } from "../components/BodyGuide";

type Word = { te: string; en: string; hi: string; icon: string };
const POOL: Word[] = [
  { te: "అరటిపండు", en: "banana", hi: "केला", icon: "🍌" }, { te: "కుర్చీ", en: "chair", hi: "कुर्सी", icon: "🪑" }, { te: "గులాబీ", en: "rose", hi: "गुलाब", icon: "🌹" },
  { te: "మామిడి", en: "mango", hi: "आम", icon: "🥭" }, { te: "తలుపు", en: "door", hi: "दरवाज़ा", icon: "🚪" }, { te: "ఆవు", en: "cow", hi: "गाय", icon: "🐄" },
  { te: "గడియారం", en: "clock", hi: "घड़ी", icon: "🕰️" }, { te: "కొబ్బరి", en: "coconut", hi: "नारियल", icon: "🥥" }, { te: "గొడుగు", en: "umbrella", hi: "छाता", icon: "☂️" },
  { te: "సైకిల్", en: "bicycle", hi: "साइकिल", icon: "🚲" }, { te: "చేప", en: "fish", hi: "मछली", icon: "🐟" }, { te: "దీపం", en: "lamp", hi: "दीया", icon: "🪔" },
];
const WAIT = 120;

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function Memory() {
  const { lang, t, voice } = useLang();
  const w = (x: Word) => x[lang];
  const [showText, setShowText] = useState(false);
  const countIn = useCountIn();
  const STEPS = [
    t({ en: "Bujji says 3 words. Remember them", te: "బుజ్జి 3 పదాలు చెబుతుంది. గుర్తుపెట్టుకోండి", hi: "बुज्जी 3 शब्द बोलेगी। याद रखिए" }),
    t({ en: "Talk about something else for 2 minutes", te: "2 నిమిషాలు వేరే విషయం మాట్లాడండి", hi: "2 मिनट कुछ और बात कीजिए" }),
    t({ en: "Then pick the 3 words from a list", te: "తర్వాత జాబితా నుండి 3 పదాలు ఎంచుకోండి", hi: "फिर सूची से 3 शब्द चुनिए" }),
    t({ en: "A light daily exercise, not a test for any illness", te: "ఇది రోజువారీ చిన్న వ్యాయామం, ఏ వ్యాధి పరీక్ష కాదు", hi: "यह रोज़ का हल्का अभ्यास है, किसी बीमारी की जाँच नहीं" }),
  ];
  const [phase, setPhase] = useState<"intro" | "learn" | "wait" | "recall" | "result">("intro");
  const [left, setLeft] = useState(WAIT);
  const [picked, setPicked] = useState<string[]>([]);
  const targets = useMemo(() => shuffle(POOL).slice(0, 3), []);
  const grid = useMemo(() => shuffle([...targets, ...shuffle(POOL.filter((w) => !targets.includes(w))).slice(0, 6)]), [targets]);

  useEffect(() => {
    if (phase !== "wait") return;
    const id = setInterval(() => setLeft((l) => {
      if (l <= 1) { clearInterval(id); setPhase("recall"); speak(t({ en: "What were the three words I said earlier? Tap them.", te: "ఇందాక చెప్పిన మూడు పదాలు ఏవి? వాటిని నొక్కండి.", hi: "मैंने पहले जो तीन शब्द कहे थे, वे कौन से थे? उन्हें दबाइए।" }), voice); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    await countIn.run(countWords(t), voice);
    learn();
  }

  async function learn() {
    setPhase("learn");
    const words = targets.map(w).join(", ");
    await speak(t({ en: `Remember these three words. ${words}. Again, ${words}.`, te: `ఈ మూడు పదాలు గుర్తుపెట్టుకోండి. ${words}. మళ్ళీ, ${words}.`, hi: `ये तीन शब्द याद रखिए। ${words}। फिर से, ${words}।` }), voice);
  }

  const score = picked.filter((p) => targets.some((t) => t.en === p)).length;
  async function finish() {
    setPhase("result");
    speak(t({ en: `You remembered ${score} out of 3.`, te: `మీరు మూడింటిలో ${score} గుర్తుపెట్టుకున్నారు.`, hi: `आपको 3 में से ${score} याद रहे।` }), voice);
    await logEvent("memory", `Memory check: recalled ${score} of 3 words after 2 minutes`, "normal", { score, targets: targets.map((t) => t.en), picked });
    await completeKind("memory");
  }

  const step = useStepCycle(STEPS.length, 3500, phase === "intro");
  const learnStep = useStepCycle(3, 2500, phase === "learn");

  return (
    <Screen title={t({ en: "Memory check", te: "జ్ఞాపకశక్తి", hi: "याददाश्त की जाँच" })} eyebrow={t({ en: "3 words", te: "3 పదాలు", hi: "3 शब्द" })} icon="moon" tint="dusk">
      {phase === "intro" ? (
        <>
          <BodyGuide
            mode="memory"
            caption={STEPS[step]}
            big={step + 1}
            bigOf={String(STEPS.length)}
            bigLabel={t({ en: "step", te: "దశ", hi: "चरण" })}
            tag={t({ en: "3 words", te: "3 పదాలు", hi: "3 शब्द" })}
            count={countIn.count}
          />
          <GuideControls text={STEPS.join(". ")} voice={voice} showText={showText} onToggleText={() => setShowText((v) => !v)} labels={controlLabels(t)} />
          {showText ? (
            <Card>{STEPS.map((s, i) => <Text key={i} style={ui.body}>{i + 1}. {s}</Text>)}</Card>
          ) : null}
          <BigButton label={t({ en: "Start", te: "మొదలుపెట్టండి", hi: "शुरू करें" })} onPress={start} disabled={countIn.count !== null} />
        </>
      ) : null}
      {phase === "learn" ? (
        <>
          <BodyGuide
            mode="memory"
            caption={`${targets[learnStep].icon}  ${w(targets[learnStep])}`}
            big={learnStep + 1}
            bigOf="3"
            bigLabel={t({ en: "Remember these 3", te: "ఈ 3 గుర్తుపెట్టుకోండి", hi: "ये 3 याद रखिए" })}
          />
          {targets.map((t) => (
            <Card key={t.en} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Text style={{ fontSize: 44 }}>{t.icon}</Text>
              <View><Text style={st.word}>{w(t)}</Text>{lang !== "en" ? <Text style={ui.muted}>{t.en}</Text> : null}</View>
            </Card>
          ))}
          <BigButton label={t({ en: "Say again", te: "మళ్ళీ చెప్పు", hi: "फिर से बोलो" })} color={C.card} textColor={C.ink} onPress={learn} />
          <BigButton label={t({ en: "Got them", te: "గుర్తుపెట్టుకున్నాను", hi: "याद हो गए" })} onPress={() => { setLeft(WAIT); setPhase("wait"); }} />
        </>
      ) : null}
      {phase === "wait" ? (
        <View style={{ alignItems: "stretch" }}>
          <BodyGuide
            mode="memory"
            big={`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
            bigLabel={t({ en: "until Bujji asks", te: "బుజ్జి అడిగే వరకు", hi: "बुज्जी के पूछने तक" })}
            caption={t({ en: "Talk about something else", te: "వేరే విషయం మాట్లాడండి", hi: "कुछ और बात कीजिए" })}
          />
          <Text style={[ui.body, { textAlign: "center" }]}>{t({ en: "Talk about something else for 2 minutes. Bujji will ask for the words.", te: "2 నిమిషాలు వేరే విషయం మాట్లాడండి. బుజ్జి పదాలు అడుగుతుంది.", hi: "2 मिनट कुछ और बात कीजिए। बुज्जी शब्द पूछेगी।" })}</Text>
          <BigButton label={t({ en: "Skip wait (demo)", te: "వేచి ఉండకు (డెమో)", hi: "इंतज़ार छोड़ें (डेमो)" })} color={C.card} textColor={C.ink} onPress={() => setLeft(1)} style={{ marginTop: 30, width: "100%" }} />
        </View>
      ) : null}
      {phase === "recall" ? (
        <>
          <Text style={ui.h2}>{t({ en: "Which 3 words?", te: "ఏ మూడు పదాలు?", hi: "कौन से 3 शब्द?" })}</Text>
          <View style={st.grid}>
            {grid.map((g) => {
              const on = picked.includes(g.en);
              return (
                <Pressable key={g.en} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== g.en) : p.length < 3 ? [...p, g.en] : p))}
                  style={[st.cell, on ? { borderColor: C.violet, backgroundColor: C.violetSoft } : null]}>
                  <Text style={{ fontSize: 36 }}>{g.icon}</Text>
                  <Text style={st.cellText}>{w(g)}</Text>
                </Pressable>
              );
            })}
          </View>
          <BigButton label={t({ en: "Done", te: "అయిపోయింది", hi: "हो गया" })} onPress={finish} disabled={picked.length !== 3} />
        </>
      ) : null}
      {phase === "result" ? (
        <Card tone={score === 3 ? "green" : "amber"}>
          <Text style={st.big}>{score}/3</Text>
          <Text style={[ui.body, { textAlign: "center" }]}>{t({ en: "The words were", te: "పదాలు:", hi: "शब्द थे:" })} {targets.map((x) => `${x.icon} ${w(x)}`).join(", ")}.</Text>
          <Text style={[ui.muted, { textAlign: "center", marginTop: 8 }]}>{t({ en: "One result means little on its own. Ravi sees the trend over weeks.", te: "ఒక్క ఫలితం పెద్దగా చెప్పదు. రవి వారాల ట్రెండ్ చూస్తారు.", hi: "एक नतीजे से ज़्यादा पता नहीं चलता। रवि हफ़्तों का रुझान देखते हैं।" })}</Text>
        </Card>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  big: { fontSize: 76, fontWeight: "300", color: C.ink, textAlign: "center", letterSpacing: -2 },
  word: { fontSize: 26, fontWeight: "600", color: C.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  cell: { flexBasis: "30%", flexGrow: 1, alignItems: "center", padding: 12, borderRadius: 20, borderWidth: 2, borderColor: "transparent", backgroundColor: C.card, ...shadow },
  cellText: { fontSize: 15, fontWeight: "600", color: C.ink, marginTop: 4 },
});
