import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen, SetupBanner, styles as ui } from "../components/ui";
import { supabase } from "../lib/supabase";
import { FAMILY_ID } from "../lib/config";
import { C } from "../lib/theme";

type Event = {
  id: string;
  type: string;
  summary: string;
  urgency: "normal" | "high" | "urgent";
  details: Record<string, unknown>;
  sample: boolean;
  created_at: string;
};
type Family = { parent_name: string; parent_age: number; parent_city: string; son_name: string; son_city: string };
type Medicine = { name: string; purpose: string | null; dose_times: string[] };

const ICON: Record<string, string> = {
  medicine_taken: "💊", reminder_set: "⏰", call: "📞", red_flag: "🚨", scam: "🛡️",
  breathing: "🫁", chair_stand: "🪑", memory: "🧠",
};

function ago(iso: string, now: number) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function flashTitle(text: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const original = "Hey Bujji";
  let n = 0;
  const id = setInterval(() => {
    document.title = n % 2 ? original : text;
    if (++n > 12) { clearInterval(id); document.title = original; }
  }, 700);
}

export default function FamilyDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [resetting, setResetting] = useState(false);

  const fetchAll = useCallback(() => Promise.all([
    supabase.from("events").select("*").eq("family_id", FAMILY_ID).order("created_at", { ascending: false }).limit(100),
    supabase.from("families").select("*").eq("id", FAMILY_ID).maybeSingle(),
    supabase.from("medicines").select("name, purpose, dose_times").eq("family_id", FAMILY_ID),
  ]).then(([ev, fam, md]) => {
    if (ev.data) setEvents(ev.data as Event[]);
    if (fam.data) setFamily(fam.data as Family);
    if (md.data) setMeds(md.data as Medicine[]);
  }), []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel(`family-${FAMILY_ID}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `family_id=eq.${FAMILY_ID}` }, (payload) => {
        const e = payload.new as Event;
        setEvents((prev) => (prev.some((p) => p.id === e.id) ? prev : [e, ...prev]));
        setNow(Date.now());
        if (e.urgency === "urgent") flashTitle("🚨 URGENT: Amma");
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "events" }, () => { fetchAll(); })
      .subscribe((status) => setLive(status === "SUBSCRIBED" ? "live" : status === "CLOSED" || status === "CHANNEL_ERROR" ? "offline" : "connecting"));
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [fetchAll]);

  const urgent = useMemo(
    () => events.find((e) => e.urgency === "urgent" && !e.sample && !acked.has(e.id) && now - new Date(e.created_at).getTime() < 6 * 3600 * 1000),
    [events, acked, now],
  );

  const today = new Date().toDateString();
  const takenToday = events.filter((e) => e.type === "medicine_taken" && new Date(e.created_at).toDateString() === today);
  const medStatus = meds.map((m) => ({
    ...m,
    taken: takenToday.some((e) => e.summary.includes(m.name) || e.summary.includes("all her")),
  }));

  async function resetDemo() {
    setResetting(true);
    const { error } = await supabase.from("events").delete().eq("family_id", FAMILY_ID).eq("sample", false);
    if (error) console.warn(error.message);
    setAcked(new Set());
    await fetchAll();
    setResetting(false);
  }

  return (
    <Screen maxWidth={900}>
      <SetupBanner />
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h1}>{family ? `${family.parent_name}, ${family.parent_age}` : "Amma"}</Text>
          <Text style={ui.muted}>{family ? `${family.parent_city} · watched by ${family.son_name} in ${family.son_city}` : "Loading…"}</Text>
        </View>
        <View style={[s.live, { backgroundColor: live === "live" ? C.greenSoft : live === "offline" ? C.redSoft : C.marigoldSoft }]}>
          <View style={[s.dot, { backgroundColor: live === "live" ? C.green : live === "offline" ? C.red : C.marigold }]} />
          <Text style={s.liveText}>{live === "live" ? "Live" : live === "offline" ? "Offline" : "Connecting"}</Text>
        </View>
      </View>

      {urgent ? (
        <View style={s.urgent}>
          <Text style={s.urgentTitle}>🚨 {urgent.summary}</Text>
          <Text style={s.urgentSub}>{ago(urgent.created_at, now)} · Amma was prompted to call 108. Call her now.</Text>
          {typeof urgent.details?.transcript === "string" ? <Text style={s.urgentSub}>She said: “{urgent.details.transcript as string}”</Text> : null}
          <Pressable onPress={() => setAcked((a) => new Set(a).add(urgent.id))} style={s.ackBtn}>
            <Text style={s.ackText}>I’m handling it</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.cols}>
        <View style={{ flex: 2, minWidth: 300 }}>
          <Text style={[ui.h2, { marginTop: 4 }]}>Family feed</Text>
          {events.length === 0 ? <Card><Text style={ui.muted}>No events yet. When Amma talks to Hey Bujji, it shows up here instantly.</Text></Card> : null}
          {events.map((e) => (
            <View key={e.id} style={[s.item, e.urgency === "urgent" ? s.itemUrgent : e.urgency === "high" ? s.itemHigh : null]}>
              <Text style={s.icon}>{ICON[e.type] ?? "•"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.summary, e.urgency === "urgent" ? { color: C.red } : null]}>{e.summary}</Text>
                <Text style={s.time}>{ago(e.created_at, now)}{e.sample ? " · sample" : ""}{typeof e.details?.transcript === "string" ? ` · “${e.details.transcript}”` : ""}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, minWidth: 260 }}>
          <Text style={[ui.h2, { marginTop: 4 }]}>Today</Text>
          <Card>
            {medStatus.length === 0 ? <Text style={ui.muted}>No medicines listed.</Text> : null}
            {medStatus.map((m) => (
              <View key={m.name} style={s.medRow}>
                <Text style={{ fontSize: 22 }}>{m.taken ? "✅" : "⬜️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={ui.h3}>{m.name}</Text>
                  <Text style={ui.muted}>{m.purpose === "bp" ? "BP" : m.purpose} · {m.dose_times.join(", ")}</Text>
                </View>
              </View>
            ))}
          </Card>
          <Card tone="teal">
            <Text style={ui.h3}>How alerts work</Text>
            <Text style={ui.muted}>Red = Amma reported chest pain, breathlessness or dizziness. Amber = a possible scam. Hey Bujji is a wellness and family-alert assistant, not a medical device.</Text>
          </Card>
          <Pressable onPress={resetDemo} disabled={resetting} style={s.reset}>
            <Text style={s.resetText}>{resetting ? "Resetting…" : "↺ Reset demo"}</Text>
          </Pressable>
          <Text style={[ui.muted, { fontSize: 12, textAlign: "center" }]}>Clears new events, keeps the sample ones.</Text>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  live: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  liveText: { fontWeight: "700", color: C.ink },
  urgent: { backgroundColor: C.red, borderRadius: 20, padding: 20, marginBottom: 18 },
  urgentTitle: { color: "#fff", fontSize: 26, fontWeight: "900" },
  urgentSub: { color: "#fff", fontSize: 16, marginTop: 6, opacity: 0.95 },
  ackBtn: { alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  ackText: { color: C.red, fontWeight: "800", fontSize: 16 },
  cols: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  item: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: C.line, alignItems: "flex-start" },
  itemUrgent: { backgroundColor: C.redSoft, borderColor: C.red },
  itemHigh: { backgroundColor: C.marigoldSoft, borderColor: C.marigold },
  icon: { fontSize: 24 },
  summary: { fontSize: 17, fontWeight: "700", color: C.ink },
  time: { fontSize: 13, color: C.muted, marginTop: 2 },
  medRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 10 },
  reset: { borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 14, alignItems: "center", backgroundColor: C.card, marginTop: 6, marginBottom: 6 },
  resetText: { fontWeight: "800", color: C.ink, fontSize: 16 },
});
