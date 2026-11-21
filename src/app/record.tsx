// Records the evaluation clips on the iPhone and uploads them to Supabase
// Storage as <sentence_id>__<speaker>.m4a. Record only with consent.
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { File } from "expo-file-system";
import { Card, Screen, styles as ui } from "../components/ui";
import { useVoiceRecorder } from "../lib/audio";
import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";
import sentences from "../../data/eval-sentences.json";

type Status = "idle" | "recording" | "uploading" | "done" | "error";

export default function RecordClips() {
  const { start, stop } = useVoiceRecorder(15);
  const [speaker, setSpeaker] = useState("");
  const [consent, setConsent] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const tag = speaker.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  async function upload(id: string, uri: string | null) {
    if (!uri) return;
    setStatus((s) => ({ ...s, [id]: "uploading" }));
    try {
      const bytes = await new File(uri).arrayBuffer();
      const { error } = await supabase.storage.from("eval-clips").upload(`${id}__${tag}.m4a`, bytes, { contentType: "audio/m4a", upsert: true });
      if (error) throw error;
      setStatus((s) => ({ ...s, [id]: "done" }));
    } catch (e) {
      setStatus((s) => ({ ...s, [id]: "error" }));
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggle(id: string) {
    if (!tag || !consent) { setMsg("Enter the speaker's name and tick consent first."); return; }
    setMsg(null);
    if (active === id) {
      const uri = await stop();
      setActive(null);
      upload(id, uri);
      return;
    }
    if (active) return;
    setActive(id);
    setStatus((s) => ({ ...s, [id]: "recording" }));
    await start((uri) => { setActive(null); upload(id, uri); });
  }

  const done = Object.values(status).filter((s) => s === "done").length;
  return (
    <Screen>
      <Text style={ui.h2}>Record test clips</Text>
      <Text style={[ui.muted, { marginBottom: 12 }]}>
        Read each sentence naturally, in your own way. Mix in some TV or kitchen noise for a few. Aim for 4–6 speakers, 2+ aged 55 or older.
      </Text>
      <Card>
        <TextInput value={speaker} onChangeText={setSpeaker} placeholder="Speaker name or tag (e.g. amma, uncle62)" style={st.input} autoCapitalize="none" />
        <Pressable onPress={() => setConsent((c) => !c)} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Text style={{ fontSize: 24 }}>{consent ? "☑️" : "⬜️"}</Text>
          <Text style={[ui.body, { flex: 1 }]}>The speaker agreed to be recorded for this test; clips are deleted after the event.</Text>
        </Pressable>
      </Card>
      {msg ? <Card tone="amber"><Text style={ui.body}>{msg}</Text></Card> : null}
      <Text style={[ui.muted, { marginBottom: 8 }]}>{done} uploaded this session · tap to record, tap again to stop</Text>
      {(sentences as { id: string; text: string; intent: string }[]).map((s) => {
        const st0 = status[s.id] ?? "idle";
        return (
          <Pressable key={s.id} onPress={() => toggle(s.id)} style={[st.row, st0 === "recording" ? { borderColor: C.red, backgroundColor: C.redSoft } : st0 === "done" ? { borderColor: C.green } : null]}>
            <Text style={st.id}>{s.id}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.text}>{s.text}</Text>
              <Text style={ui.muted}>{s.intent.replace("_", " ")}</Text>
            </View>
            <Text style={{ fontSize: 22 }}>{st0 === "recording" ? "⏺" : st0 === "uploading" ? "⏳" : st0 === "done" ? "✅" : st0 === "error" ? "⚠️" : "🎙️"}</Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const st = StyleSheet.create({
  input: { fontSize: 18, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: "#fff", color: C.ink },
  row: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: C.line },
  id: { fontWeight: "800", color: C.muted, width: 34 },
  text: { fontSize: 18, fontWeight: "700", color: C.ink },
});
