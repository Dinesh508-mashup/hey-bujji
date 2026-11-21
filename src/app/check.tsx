import { useState } from "react";
import { Image, Linking, StyleSheet, Text, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { checkMessage, type CheckResult } from "../lib/api";
import { speak } from "../lib/speak";
import { C } from "../lib/theme";
import { replyIn, useLang } from "../lib/language";

export default function CheckThis() {
  const { lang, t } = useLang();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(input: Parameters<typeof checkMessage>[0]) {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await checkMessage(input, lang === "hi" ? "hi" : "te");
      setResult(r);
      const say = replyIn(r.reply, lang);
      speak(say.text, say.voice);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t({ en: "Allow photo access to pick a screenshot.", te: "స్క్రీన్‌షాట్ ఎంచుకోవడానికి ఫోటోల అనుమతి ఇవ్వండి.", hi: "स्क्रीनशॉट चुनने के लिए फ़ोटो की अनुमति दीजिए।" })); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true, // crop out personal numbers before sending
      quality: 0.7,
      videoMaxDuration: 30,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === "video";
    setPreview(isVideo ? null : a.uri);
    run({ file: { uri: a.uri, mime: a.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"), name: a.fileName ?? (isVideo ? "recording.mp4" : "screenshot.jpg") } });
  }

  const tone = result?.verdict === "scam" ? "red" : result?.verdict === "suspicious" ? "amber" : "green";
  return (
    <Screen title={t({ en: "Is this a scam?", te: "ఇది మోసమా?", hi: "क्या यह धोखा है?" })} eyebrow={t({ en: "Bujji, check this", te: "బుజ్జీ, ఇది చూడు", hi: "बुज्जी, यह देखो" })} icon="shield-checkmark" tint="sea" tab="/check">
      <Text style={[ui.muted, { marginBottom: 14 }]}>{t({ en: "Pick a screenshot or screen recording, or paste the message. Crop out personal numbers first. Screenshots are not stored.", te: "స్క్రీన్‌షాట్ లేదా స్క్రీన్ రికార్డింగ్ ఎంచుకోండి, లేదా మెసేజ్ పేస్ట్ చేయండి. ముందుగా వ్యక్తిగత నంబర్లు కత్తిరించండి. స్క్రీన్‌షాట్లు దాచబడవు.", hi: "स्क्रीनशॉट या स्क्रीन रिकॉर्डिंग चुनिए, या मैसेज पेस्ट कीजिए। पहले निजी नंबर काट दीजिए। स्क्रीनशॉट सहेजे नहीं जाते।" })}</Text>
      <BigButton color={C.card} textColor={C.ink} label={t({ en: "Pick screenshot", te: "స్క్రీన్‌షాట్ ఎంచుకోండి", hi: "स्क्रीनशॉट चुनें" })} sub={t({ en: "or a screen recording", te: "లేదా స్క్రీన్ రికార్డింగ్", hi: "या स्क्रीन रिकॉर्डिंग" })} onPress={pick} loading={busy && !text} />
      <Card>
        <Text style={ui.h3}>{t({ en: "Or paste the message", te: "లేదా మెసేజ్ పేస్ట్ చేయండి", hi: "या मैसेज पेस्ट करें" })}</Text>
        <TextInput multiline value={text} onChangeText={setText} placeholder={t({ en: "Paste SMS / WhatsApp text here", te: "SMS / WhatsApp మెసేజ్ ఇక్కడ పేస్ట్ చేయండి", hi: "SMS / WhatsApp मैसेज यहाँ पेस्ट करें" })} style={st.input} />
        <BigButton label={t({ en: "Check message", te: "మెసేజ్ చూడు", hi: "मैसेज जाँचें" })} onPress={() => run({ text })} disabled={!text.trim()} loading={busy && !!text} />
      </Card>
      {preview ? <Image source={{ uri: preview }} style={st.preview} resizeMode="contain" /> : null}
      {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
      {result ? (
        <Card tone={tone}>
          <Text style={st.verdict}>{result.verdict === "scam" ? t({ en: "🚫 Scam", te: "🚫 మోసం", hi: "🚫 धोखा" }) : result.verdict === "suspicious" ? t({ en: "⚠️ Suspicious", te: "⚠️ అనుమానం", hi: "⚠️ संदिग्ध" }) : t({ en: "✅ Looks safe", te: "✅ సురక్షితంగా ఉంది", hi: "✅ सुरक्षित लगता है" })}</Text>
          <Text style={[ui.body, { fontSize: 22, fontWeight: "700", marginTop: 8, lineHeight: 32 }]}>{replyIn(result.reply, lang).text}</Text>
          <Text style={[ui.muted, { marginTop: 6 }]}>{result.reason}</Text>
          {result.signals.length ? <Text style={[ui.muted, { marginTop: 6 }]}>{t({ en: "Signs:", te: "సూచనలు:", hi: "संकेत:" })} {result.signals.join(" · ")}</Text> : null}
          {result.verdict !== "safe" ? (
            <BigButton style={{ marginTop: 14 }} color={C.red} label={t({ en: "Money already sent? Call 1930", te: "డబ్బు పంపేశారా? 1930 కి కాల్ చేయండి", hi: "पैसे भेज दिए? 1930 पर कॉल करें" })} sub={t({ en: "Cyber fraud helpline", te: "సైబర్ మోసం హెల్ప్‌లైన్", hi: "साइबर धोखाधड़ी हेल्पलाइन" })} onPress={() => Linking.openURL("tel:1930")} />
          ) : null}
        </Card>
      ) : null}
      <Text style={[ui.muted, { fontSize: 12 }]}>{t({ en: "Report fraud: 1930 or cybercrime.gov.in. During the hackathon, test with dummy messages only.", te: "మోసం రిపోర్ట్: 1930 లేదా cybercrime.gov.in. హ్యాకథాన్‌లో డమ్మీ మెసేజ్‌లతో మాత్రమే టెస్ట్ చేయండి.", hi: "धोखा रिपोर्ट करें: 1930 या cybercrime.gov.in। हैकाथॉन में सिर्फ़ डमी मैसेज से टेस्ट करें।" })}</Text>
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  input: { fontSize: 17, minHeight: 110, textAlignVertical: "top", borderRadius: 16, padding: 15, marginVertical: 12, backgroundColor: C.field, color: C.ink },
  preview: { width: "100%", height: 260, borderRadius: 22, marginBottom: 14, backgroundColor: C.card },
  verdict: { fontSize: 26, fontWeight: "700", color: C.ink },
});
