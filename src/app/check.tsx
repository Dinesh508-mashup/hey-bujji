import { useState } from "react";
import { Image, Linking, StyleSheet, Text, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { BigButton, Card, Disclaimer, Screen, styles as ui } from "../components/ui";
import { checkMessage, type CheckResult } from "../lib/api";
import { speak } from "../lib/speak";
import { C } from "../lib/theme";

export default function CheckThis() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(input: Parameters<typeof checkMessage>[0]) {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await checkMessage(input, "te");
      setResult(r);
      speak(r.reply.text, r.reply.lang);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Allow photo access to pick a screenshot."); return; }
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
    <Screen>
      <Text style={ui.h2}>ఇది మోసమా? · Is this a scam?</Text>
      <Text style={[ui.muted, { marginBottom: 14 }]}>Pick a screenshot or screen recording, or paste the message. Crop out personal numbers first. Screenshots are not stored.</Text>
      <BigButton icon="🖼️" label="Pick screenshot" sub="లేదా స్క్రీన్ రికార్డింగ్" onPress={pick} loading={busy && !text} />
      <Card>
        <Text style={ui.h3}>Or paste the message</Text>
        <TextInput multiline value={text} onChangeText={setText} placeholder="Paste SMS / WhatsApp text here" style={st.input} />
        <BigButton label="Check message" onPress={() => run({ text })} disabled={!text.trim()} loading={busy && !!text} />
      </Card>
      {preview ? <Image source={{ uri: preview }} style={st.preview} resizeMode="contain" /> : null}
      {error ? <Card tone="amber"><Text style={ui.body}>{error}</Text></Card> : null}
      {result ? (
        <Card tone={tone}>
          <Text style={st.verdict}>{result.verdict === "scam" ? "🚫 మోసం · Scam" : result.verdict === "suspicious" ? "⚠️ అనుమానం · Suspicious" : "✅ Looks safe"}</Text>
          <Text style={[ui.body, { fontSize: 22, fontWeight: "700", marginTop: 8, lineHeight: 32 }]}>{result.reply.text}</Text>
          <Text style={[ui.muted, { marginTop: 6 }]}>{result.reason}</Text>
          {result.signals.length ? <Text style={[ui.muted, { marginTop: 6 }]}>Signs: {result.signals.join(" · ")}</Text> : null}
          {result.verdict !== "safe" ? (
            <BigButton style={{ marginTop: 14 }} color={C.red} label="Money already sent? Call 1930" sub="వెంటనే 1930 కి కాల్ చేయండి" onPress={() => Linking.openURL("tel:1930")} />
          ) : null}
        </Card>
      ) : null}
      <Text style={[ui.muted, { fontSize: 12 }]}>Report fraud: 1930 or cybercrime.gov.in. During the hackathon, test with dummy messages only.</Text>
      <Disclaimer />
    </Screen>
  );
}

const st = StyleSheet.create({
  input: { fontSize: 17, minHeight: 110, textAlignVertical: "top", borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, marginVertical: 12, backgroundColor: "#fff", color: C.ink },
  preview: { width: "100%", height: 260, borderRadius: 16, marginBottom: 14, backgroundColor: C.card },
  verdict: { fontSize: 28, fontWeight: "900", color: C.ink },
});
