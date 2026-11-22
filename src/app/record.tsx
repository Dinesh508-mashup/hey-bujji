// Records the evaluation clips on the iPhone and uploads them to Supabase
// Storage as <sentence_id>__<speaker>.m4a. Record only with consent.
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { File } from "expo-file-system";
import { Card, Screen, styles as ui } from "../components/ui";
import { useVoiceRecorder } from "../lib/audio";
import { supabase } from "../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { C, shadow } from "../lib/theme";
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
    <Screen title="Record test clips" eyebrow="For the accuracy evaluation" icon="radio-button-on" tint="bloom">
      <Card>
        <Text style={[ui.body, { fontSize: 15, lineHeight: 22 }]}>
          Read each sentence naturally, in your own way. Mix in some TV or kitchen noise for a few. Aim for 4–6 speakers, 2+ aged 55 or older.
        </Text>
      </Card>
      <Card>
        <TextInput value={speaker} onChangeText={setSpeaker} placeholder="Speaker name or tag (e.g. amma, uncle62)" style={st.input} autoCapitalize="none" />
        <Pressable onPress={() => setConsent((c) => !c)} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={[st.box, consent ? st.boxOn : null]}>{consent ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}</View>
          <Text style={[ui.body, { flex: 1 }]}>The speaker agreed to be recorded for this test; clips are deleted after the event.</Text>
        </Pressable>
      </Card>
      {msg ? <Card tone="amber"><Text style={ui.body}>{msg}</Text></Card> : null}
      <Text style={[ui.muted, { marginBottom: 8 }]}>{done} uploaded this session · tap to record, tap again to stop</Text>
      {(sentences as { id: string; text: string; intent: string }[]).map((s) => {
        const st0 = status[s.id] ?? "idle";
        return (
          <Pressable key={s.id} onPress={() => toggle(s.id)} style={[st.row, st0 === "recording" ? { borderColor: C.red, backgroundColor: C.redSoft } : st0 === "done" ? { borderColor: C.green, backgroundColor: C.greenSoft } : null]}>
            <Text style={st.id}>{s.id}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.text}>{s.text}</Text>
              <Text style={ui.muted}>{s.intent.replace("_", " ")}</Text>
            </View>
            <View style={[st.recBtn, st0 === "recording" ? { backgroundColor: C.red } : st0 === "done" ? { backgroundColor: C.green } : null]}>
              <Ionicons size={18} color="#fff" name={st0 === "recording" ? "stop" : st0 === "uploading" ? "cloud-upload" : st0 === "done" ? "checkmark" : st0 === "error" ? "alert" : "mic"} />
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const st = StyleSheet.create({
  input: { fontSize: 17, borderRadius: 16, padding: 15, marginBottom: 14, backgroundColor: C.field, color: C.ink },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: C.ink, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: C.ink },
  recBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "transparent", ...shadow },
  id: { fontWeight: "600", color: C.muted, width: 34 },
  text: { fontSize: 16, fontWeight: "600", color: C.ink },
});
