// Ravi's family dashboard (web). Layout follows the "HomeCare" reference:
// grey canvas, white rounded cards, one deep-blue accent. Every number here
// comes from Supabase rows; empty states say so instead of inventing values.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { FAMILY_ID } from "../lib/config";
import { DashShell, useDashSize } from "../components/DashShell";
import { KIND_ICON, TaskManager } from "../components/TaskViews";
import { OrdersStrip } from "../components/Orders";
import { InsightsPanel } from "../components/Insights";
import { Reveal } from "../components/Motion";
import { KIND_LABEL, clock, doneToday, taskStatus, useTasks, type Task } from "../lib/tasks";
import { AreaChart, D } from "../components/DashArt";

type Event = {
  id: string; type: string; summary: string; urgency: "normal" | "high" | "urgent";
  details: Record<string, unknown>; sample: boolean; created_at: string;
};
type Family = { parent_name: string; parent_age: number; parent_city: string; son_name: string; son_city: string };
type Medicine = { name: string; purpose: string | null; dose_times: string[] };
type Tab = "dashboard" | "insights" | "tasks" | "activity";

const FEED_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  medicine_taken: "medkit", reminder_set: "alarm", call: "call", red_flag: "warning", scam: "shield-checkmark",
  task_done: "checkmark-done", breathing: "leaf", chair_stand: "body", memory: "bulb", heart_rate: "heart", alarm_stopped: "alarm", task_started: "play", order_request: "basket", order_approved: "checkmark-circle", order_rejected: "close-circle", cab: "car", order_completed: "bag-check", cab_completed: "flag",
};

function ago(iso: string, now: number) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const PURPOSE: Record<string, string> = { bp: "Blood pressure", sugar: "Diabetes (sugar)", diabetes: "Diabetes (sugar)", thyroid: "Thyroid", cholesterol: "Cholesterol" };
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);

function flashTitle(text: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  let n = 0;
  const id = setInterval(() => {
    document.title = n % 2 ? "Hey Bujji" : text;
    if (++n > 12) { clearInterval(id); document.title = "Hey Bujji"; }
  }, 700);
}

export default function FamilyDashboard() {
  const { mid, fit: canFit } = useDashSize();
  // flex sizing only when cards sit side by side; stacked cards size to content
  const grow = (n: number, min: number): ViewStyle | undefined => (mid ? { flex: n, minWidth: min } : undefined);

  const params = useLocalSearchParams<{ tab?: string }>();
  // the tab lives in the URL (/family?tab=tasks) so other pages can link to it
  const tab: Tab = params.tab === "tasks" || params.tab === "activity" || params.tab === "insights" ? params.tab : "dashboard";
  const setTab = (t: Tab) => router.setParams({ tab: t });
  const [events, setEvents] = useState<Event[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [resetting, setResetting] = useState(false);
  const [openCheck, setOpenCheck] = useState<CheckKind | null>(null);
  const { tasks, error: taskError } = useTasks();

  const fetchAll = useCallback(() => Promise.all([
    supabase.from("events").select("*").eq("family_id", FAMILY_ID).order("created_at", { ascending: false }).limit(200),
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
      // Unique name per mount: reusing a fixed name returns the old, already-subscribed
      // channel on remount, and adding listeners to it throws.
      .channel(`family-${FAMILY_ID}-${Math.random().toString(36).slice(2)}`)
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

  const parent = family?.parent_name ?? "Amma";
  const urgent = useMemo(
    () => events.find((e) => e.urgency === "urgent" && !e.sample && !acked.has(e.id) && now - new Date(e.created_at).getTime() < 6 * 3600 * 1000),
    [events, acked, now],
  );

  // ----- derived, all from real rows -----
  const today = new Date(now).toDateString();
  const takenToday = events.filter((e) => e.type === "medicine_taken" && new Date(e.created_at).toDateString() === today);
  const medStatus = meds.map((m) => ({ ...m, taken: takenToday.some((e) => e.summary.includes(m.name) || e.summary.includes("all her")) }));
  const nextMed = medStatus.find((m) => !m.taken);

  const breathing = events.filter((e) => e.type === "breathing" && num(e.details?.bpm) !== null).slice(0, 10).reverse();
  const breathSeries = breathing.map((e) => ({ label: shortDate(e.created_at), value: Math.round(num(e.details.bpm)! * 10) / 10 }));
  const breathHasSample = breathing.some((e) => e.sample);

  const activeTasks = tasks.filter((t) => t.active).sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const tasksDone = activeTasks.filter((t) => doneToday(t)).length;
  const lastReal = events.find((e) => !e.sample);
  const alerts = events.filter((e) => e.urgency !== "normal" && now - new Date(e.created_at).getTime() < 24 * 3600 * 1000);
  const dailyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86400000).toDateString();
    return events.filter((e) => !e.sample && new Date(e.created_at).toDateString() === d).length;
  });

  async function resetDemo() {
    setResetting(true);
    const { error } = await supabase.from("events").delete().eq("family_id", FAMILY_ID).eq("sample", false);
    if (error) console.warn(error.message);
    setAcked(new Set());
    await fetchAll();
    setResetting(false);
  }

  // ----- pieces -----
  const headerRight = (
    <>
      <LinearGradient colors={["#FF8A3D", "#F2621A"]} style={s.avatar}>
        <Text style={s.avatarText}>{parent.slice(0, 1)}</Text>
      </LinearGradient>
      <View style={{ marginRight: 4 }}>
        <Text style={s.whoName}>{family ? `${parent}, ${family.parent_age}` : parent}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Ionicons name="location-outline" size={12} color={D.muted} />
          <Text style={s.whoCity}>{family?.parent_city ?? "—"}</Text>
        </View>
      </View>
      <Pressable style={s.roundBtn} accessibilityLabel={`Connection ${live}`} onPress={fetchAll}>
        <View style={[s.liveDot, { backgroundColor: live === "live" ? D.green : live === "offline" ? D.red : D.amber }]} />
        <Ionicons name="refresh" size={18} color={D.ink} />
      </Pressable>
      <Pressable style={s.roundBtn} accessibilityLabel="Alerts" onPress={() => setTab("activity")}>
        <Ionicons name="notifications-outline" size={19} color={D.ink} />
        {alerts.length ? <View style={s.bellDot} /> : null}
      </Pressable>
      <View style={s.dayPill}><Text style={s.dayPillText}>{new Date(now).toLocaleDateString("en-IN", { weekday: "short" })}</Text></View>
      <Text style={s.hiText} numberOfLines={1}>Hello, {family?.son_name ?? "Ravi"} · how is {parent} today?</Text>
    </>
  );

  const urgentBanner = urgent ? (
    <View style={s.urgent}>
      <Ionicons name="warning" size={26} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={s.urgentTitle}>{urgent.summary}</Text>
        <Text style={s.urgentSub}>{ago(urgent.created_at, now)} · {parent} was prompted to call 108. Call her now.</Text>
        {typeof urgent.details?.transcript === "string" ? <Text style={s.urgentSub}>She said: “{urgent.details.transcript as string}”</Text> : null}
      </View>
      <Pressable onPress={() => setAcked((a) => new Set(a).add(urgent.id))} style={s.ackBtn}>
        <Text style={s.ackText}>I’m handling it</Text>
      </Pressable>
    </View>
  ) : null;

  // One-screen dashboard on laptop-sized windows: every card fits, long lists scroll inside their card.
  // The dashboard scrolls (sections animate in as it loads); the one-screen squeeze is off.
  const oneScreen = false && canFit && tab === "dashboard";
  const fill: ViewStyle | undefined = oneScreen ? { minHeight: 0, overflow: "hidden" } : undefined;
  const detail = openCheck ? (
    <CheckDetail kind={openCheck} events={events} tasks={activeTasks} now={now} parent={parent} fill={oneScreen} onClose={() => setOpenCheck(null)} />
  ) : null;

  // Body health tracking (reference's right card): the three checks with today's status; tap a row for the detail.
  const focus = openCheck ?? "breathing";
  const focusDef = CHECKS.find((c) => c.kind === focus)!;
  const focusRows = checkRows(events, focus);
  const focusToday = focusRows.find((e) => new Date(e.created_at).toDateString() === today);
  const bodyCard = (
    <DashCard delay={550} style={{ ...grow(1, 300), ...fill }}>
      <View style={s.cardHead}>
        <CardTitle>Body health tracking</CardTitle>
        {openCheck ? (
          <Pressable onPress={() => setOpenCheck(null)} accessibilityLabel="Close detail" style={s.moreBtn}><Ionicons name="close" size={16} color={D.ink} /></Pressable>
        ) : <View style={s.moreBtn}><Ionicons name="ellipsis-horizontal" size={16} color={D.ink} /></View>}
      </View>
      <InnerScroll on={oneScreen}>
        {detail ? detail : (
          <View style={{ flexDirection: "row", alignItems: "center", minHeight: 120 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={s.miniLabel}>{focusDef.title}</Text>
                <Text style={s.tagOrange}>{focusToday ? "Today" : "Not today"}</Text>
              </View>
              <Text style={s.bigNum}>{focusRows[0] ? focusDef.value(focusRows[0]) : "—"}</Text>
              <DotMatrix filled={Math.min(12, focusRows.length * 2)} total={12} color={D.orange} />
            </View>
            <Image source={CHECK_IMG[focus]} style={{ width: 104, height: 104 }} />
          </View>
        )}
        <View style={{ gap: 8, marginTop: 10 }}>
          {CHECKS.map((c) => {
            const rows = checkRows(events, c.kind);
            const todayRow = rows.find((e) => new Date(e.created_at).toDateString() === today);
            const on = openCheck === c.kind;
            const text = `${c.title} · ${rows[0] ? c.value(rows[0]) : "—"} · ${todayRow ? `done ${timeOf(todayRow.created_at)}` : rows[0] ? `last ${shortDate(rows[0].created_at)}` : "not done yet"}`;
            return (
              <Pressable key={c.kind} onPress={() => setOpenCheck((o) => (o === c.kind ? null : c.kind))} accessibilityRole="button" accessibilityLabel={text}
                style={({ pressed }) => [s.checkRow, on && s.checkRowOn, pressed && { opacity: 0.85 }]}>
                {on ? <LinearGradient colors={["#2E3B33", "#C25A1E", "#F26A1B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 999 }]} /> : null}
                <View style={[s.checkPill, on && { backgroundColor: "#fff" }]}><Text style={s.checkPillText}>{on ? "Checking" : "Check"}</Text></View>
                <Text style={[s.checkRowText, on && { color: "#fff" }]} numberOfLines={1}>{text}</Text>
                <View style={[s.checkDot, { backgroundColor: todayRow ? D.green : "#D1D1D6" }]}>
                  <Ionicons name={todayRow ? "checkmark" : "time-outline"} size={13} color="#fff" />
                </View>
              </Pressable>
            );
          })}
        </View>
      </InnerScroll>
    </DashCard>
  );

  const chartCard = (
    <DashCard delay={0} style={{ ...grow(1.55, 300), ...fill, ...s.darkCard }}>
      <View style={s.cardHead}>
        <CardTitle light>Breathing rate</CardTitle>
        <View style={[s.selectPill, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
          <Text style={[s.selectText, { color: "#fff" }]}>Last {breathSeries.length || 0} checks</Text>
          <View style={[s.selectIcon, { backgroundColor: D.orange }]}><Ionicons name="chevron-down" size={12} color="#fff" /></View>
        </View>
      </View>
      <ActivityStrip values={dailyActivity} now={now} />
      {breathSeries.length >= 2 ? (
        <>
          <AreaChart data={breathSeries} warnAbove={24} unit="/min" height={oneScreen ? 130 : 180} />
          <Text style={s.foot}>Breaths per minute at rest · dashed red line = 24/min{breathHasSample ? " · includes sample data" : ""}</Text>
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", minHeight: oneScreen ? 0 : 150 }}><Empty dark icon="leaf-outline" text={breathSeries.length === 1 ? `One check so far: ${breathSeries[0].value} breaths/min. The trend appears after the second check.` : `No breathing checks yet. When ${parent} does one, it is plotted here.`} /></View>
      )}
    </DashCard>
  );

  const monthName = new Date(now).toLocaleDateString("en-IN", { month: "long" });
  const todayCard = (
    <DashCard delay={110} style={{ ...grow(1, 260), ...fill, ...s.orangeCard, overflow: "hidden" }}>
      <LinearGradient colors={["#FF8A3D", "#F2621A", "#C8470C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.cardHead}>
        <CardTitle light mark="#fff">Today</CardTitle>
        <Pressable onPress={() => setTab("activity")} style={s.arrowBtnLight} accessibilityLabel="Open activity">
          <Ionicons name="arrow-up" size={13} color={D.orange} style={{ transform: [{ rotate: "45deg" }] }} />
        </Pressable>
      </View>
      <Text style={s.orangeTitle}>{monthName} <Text style={{ color: "rgba(255,255,255,0.55)" }}>care</Text></Text>
      <View style={s.ticks}>{dailyActivity.map((n, i) => <View key={i} style={[s.tick, { opacity: n ? 1 : 0.35, height: 6 + Math.min(14, n * 3) }]} />)}</View>
      <View style={{ marginTop: 10, gap: 8 }}>
        {[
          `Tasks done · ${tasksDone} / ${activeTasks.length || 0}`,
          `Medicines taken · ${medStatus.filter((m) => m.taken).length} / ${medStatus.length}`,
          `Last active · ${lastReal ? ago(lastReal.created_at, now) : "—"}`,
        ].map((label, i) => (
          <View key={label} style={[s.timelineRow, { marginLeft: i * 14 }]}>
            <View style={s.timelineDot} />
            <View style={s.timelineLine} />
            <Text style={s.timelinePill}>{label}</Text>
          </View>
        ))}
      </View>
    </DashCard>
  );

  const medsCard = (
    <DashCard delay={330} style={{ ...(oneScreen ? { flex: 1, minHeight: 0 } : {}), paddingHorizontal: 0, paddingBottom: 12, ...s.darkCard, overflow: "hidden" }}>
      <LinearGradient colors={["#3B4A40", "#1E2420", "#161618"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      <CardTitle light style={{ paddingHorizontal: 18, marginBottom: 14 }}>Medication list</CardTitle>
      <InnerScroll on={oneScreen}>
      <View style={{ paddingHorizontal: 18, gap: 10 }}>
        {medStatus.length === 0 ? <Empty icon="medkit-outline" text="No medicines listed for this family." /> : null}
        {medStatus.map((m) => {
          const on = m === nextMed;
          return (
            <View key={m.name} style={[s.med, on && s.medOn]}>
              <View style={[s.medIcon, on && { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <MaterialCommunityIcons name={m.purpose === "bp" ? "heart-pulse" : "pill"} size={18} color={on ? "#fff" : D.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.medName, on && { color: "#fff" }]}>{m.name}</Text>
                <Text style={[s.medSub, on && { color: "rgba(255,255,255,0.8)" }]}>{PURPOSE[m.purpose ?? ""] ?? (m.purpose ? m.purpose[0].toUpperCase() + m.purpose.slice(1) : "—")}</Text>
              </View>
              <DotMatrix filled={m.taken ? m.dose_times.length * 3 : 2} total={Math.max(6, m.dose_times.length * 3)} color={on ? "#fff" : D.orange} small />
              <Text style={[s.medRight, on && { color: "#fff" }]}>
                {m.taken ? "Taken today ✓" : on ? `Next · ${m.dose_times.map(clock).join(", ")}` : m.dose_times.map(clock).join(", ")}
              </Text>
              <Ionicons name={m.taken ? "heart" : "sparkles"} size={16} color={on ? "#fff" : D.ink} />
            </View>
          );
        })}
      </View>
      </InnerScroll>
    </DashCard>
  );

  const alertsCard = (
    <DashCard delay={440} style={{ ...s.darkCard, padding: 16, overflow: "hidden", ...(oneScreen ? { flex: 0.9, minHeight: 0 } : {}) }}>
      <View style={{ flexDirection: "row", alignItems: "stretch", gap: 12, flex: 1, minHeight: 0 }}>
        <View style={{ flex: 1, minHeight: 0 }}>
          <CardTitle light style={{ marginBottom: 6 }}>Alerts</CardTitle>
          <InnerScroll on={oneScreen}>
            {alerts.length ? alerts.slice(0, 3).map((a) => (
              <Text key={a.id} style={[s.alertText, { color: a.urgency === "urgent" ? "#FF6B61" : "#FFB067" }]} numberOfLines={2}>{a.summary} · {ago(a.created_at, now)}</Text>
            )) : <Text style={s.alertText}>No alerts in the last 24 hours. Red = chest pain, breathlessness or dizziness; amber = possible scam.</Text>}
          </InnerScroll>
        </View>
        <View style={[s.heartRing, { alignSelf: "center" }]}><Image source={require("../../assets/checks/heart.png")} style={{ width: 62, height: 62 }} /></View>
      </View>
    </DashCard>
  );

  const scheduleCard = <ScheduleCard tasks={activeTasks} events={events} now={now} parent={parent} error={taskError} style={{ ...grow(1, 280), ...fill }} scroll={oneScreen} onManage={() => setTab("tasks")} delay={220} />;

  const feed = (
    <DashCard>
      <View style={s.cardHead}>
        <CardTitle>What {parent} is doing</CardTitle>
        <View style={[s.livePill, { backgroundColor: live === "live" ? "#E8F8EE" : live === "offline" ? D.redSoft : D.amberSoft }]}>
          <View style={[s.liveDotSm, { backgroundColor: live === "live" ? D.green : live === "offline" ? D.red : D.amber }]} />
          <Text style={s.livePillText}>{live === "live" ? "Live" : live === "offline" ? "Offline" : "Connecting"}</Text>
        </View>
      </View>
      {events.length === 0 ? <Empty icon="chatbubble-ellipses-outline" text={`No events yet. When ${parent} talks to Hey Bujji, it shows up here instantly.`} /> : null}
      {events.map((e) => (
        <View key={e.id} style={[s.feedRow, e.urgency === "urgent" ? { backgroundColor: D.redSoft } : e.urgency === "high" ? { backgroundColor: D.amberSoft } : null]}>
          <View style={[s.feedIcon, e.urgency === "urgent" ? { backgroundColor: D.red } : null]}>
            <Ionicons name={FEED_ICON[e.type] ?? "ellipse"} size={17} color={e.urgency === "urgent" ? "#fff" : D.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.feedText, e.urgency === "urgent" ? { color: D.red } : null]}>{e.summary}</Text>
            <Text style={s.feedTime}>{ago(e.created_at, now)}{e.sample ? " · sample" : ""}{typeof e.details?.transcript === "string" ? ` · “${e.details.transcript}”` : ""}</Text>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Pressable onPress={resetDemo} disabled={resetting} style={s.ghostBtn}>
          <Ionicons name="refresh" size={15} color={D.ink} />
          <Text style={s.ghostText}>{resetting ? "Resetting…" : "Reset demo"}</Text>
        </Pressable>
        <Text style={s.foot}>Clears new events, keeps the sample ones.</Text>
      </View>
    </DashCard>
  );

  // ----- layout -----
  let body: ReactNode;
  if (tab === "insights") {
    body = <InsightsPanel events={events} age={family?.parent_age ?? 68} parent={parent} tasks={tasks} />;
  } else if (tab === "tasks") {
    body = <DashCard><TaskManager tasks={tasks} error={taskError} /></DashCard>;
  } else if (tab === "activity") {
    body = feed;
  } else {
    const medsCol = (
      <View style={[{ gap: oneScreen ? 14 : 18 }, mid && { flex: 1, minWidth: 280 }, oneScreen && { minHeight: 0 }]}>
        <View style={oneScreen ? { flex: 1.1, minHeight: 0 } : undefined}>{medsCard}</View>
        {alertsCard}
      </View>
    );
    body = (
      <View style={[{ gap: oneScreen ? 14 : 18 }, oneScreen && { flex: 1, minHeight: 0 }]}>
        <View style={[s.row, oneScreen && { flex: 1, minHeight: 0, gap: 14 }, !mid && { flexDirection: "column" }]}>{chartCard}{todayCard}</View>
        <View style={[s.row, oneScreen && { flex: 1.3, minHeight: 0, gap: 14 }, !mid && { flexDirection: "column" }]}>{scheduleCard}{medsCol}{bodyCard}</View>
      </View>
    );
  }

  return (
    <DashShell fit={oneScreen} active={tab} onTab={(t) => (t === "accuracy" ? router.navigate("/results") : setTab(t))} right={headerRight}>
      {urgentBanner ? <Reveal from={-20}>{urgentBanner}</Reveal> : null}
      {tab === "dashboard" ? <Reveal from={-16} duration={500}><OrdersStrip parent={parent} /></Reveal> : null}
      {body}
    </DashShell>
  );
}

// ---------- small components ----------

/** A ScrollView that fills the rest of its card in one-screen mode; a plain View otherwise. */
function InnerScroll({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>{children}</ScrollView> : <>{children}</>;
}

/** Card heading with the small orange square marker. `light` for dark cards. */
function CardTitle({ children, light, mark, style }: { children: ReactNode; light?: boolean; mark?: string; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}>
      <View style={[s.mark, mark ? { backgroundColor: mark } : null]} />
      <Text style={[s.cardTitle, light && { color: "#fff" }]}>{children}</Text>
    </View>
  );
}

/** Reference-style dot matrix: a few columns of small dots, `filled` of them coloured. */
function DotMatrix({ filled, total, color, small }: { filled: number; total: number; color: string; small?: boolean }) {
  const d = small ? 4 : 6, rows = 3, cols = Math.ceil(total / rows);
  return (
    <View style={{ flexDirection: "row", gap: d * 0.6, marginTop: small ? 0 : 10 }}>
      {Array.from({ length: cols }, (_, c) => (
        <View key={c} style={{ gap: d * 0.6, justifyContent: "flex-end" }}>
          {Array.from({ length: rows }, (_, r) => {
            const i = c * rows + (rows - 1 - r);
            return <View key={r} style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: i < filled ? color : "rgba(142,142,147,0.25)" }} />;
          })}
        </View>
      ))}
    </View>
  );
}

/** Reference's coloured strip: one bar per day of the last 7, height = Amma's activity that day. */
function ActivityStrip({ values, now }: { values: number[]; now: number }) {
  const max = Math.max(1, ...values);
  const colors = ["#2E8B7A", "#3F9E6E", "#7DA83A", "#C99A2E", "#E07A2A", "#D8503A", "#8E5BD8"];
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 34 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 34 }}>
            <View style={{ width: "100%", height: 4 + (v / max) * 30, borderRadius: 4, backgroundColor: colors[i], opacity: v ? 0.95 : 0.25 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
        {values.map((_, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
            {new Date(now - (6 - i) * 86400000).toLocaleDateString("en-IN", { weekday: "short" })}
          </Text>
        ))}
      </View>
    </View>
  );
}

const CHECK_IMG: Record<"memory" | "chair_stand" | "breathing", number> = {
  memory: require("../../assets/checks/brain.png"),
  chair_stand: require("../../assets/checks/chair.png"),
  breathing: require("../../assets/checks/lungs.png"),
};

/** Card that rises in from below (staggered by `delay`). */
function DashCard({ children, style, delay = 0 }: { children: ReactNode; style?: ViewStyle; delay?: number }) {
  return <Reveal delay={delay} from={42} scale={0.94} duration={720} style={[s.card, style]}>{children}</Reveal>;
}

function Empty({ icon, text, dark }: { icon: keyof typeof Ionicons.glyphMap; text: string; dark?: boolean }) {
  return (
    <View style={[s.empty, dark && { backgroundColor: "rgba(255,255,255,0.06)" }]}>
      <Ionicons name={icon} size={22} color={D.blueMid} />
      <Text style={[s.emptyText, dark && { color: "rgba(255,255,255,0.65)" }]}>{text}</Text>
    </View>
  );
}


// ----- health checks: cards + "what happened today" panel (all from real event rows) -----
type CheckKind = "memory" | "chair_stand" | "breathing";
const CHECKS: {
  kind: CheckKind; title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: readonly [string, string]; color: string;
  value: (e: Event) => string; normal: string; flag: (e: Event) => string | null;
}[] = [
  {
    kind: "memory", title: "Memory", icon: "brain", tint: ["#CFE3F7", "#8DB6E6"], color: "#4F86C6",
    value: (e) => `${num(e.details.score)}/3 words`,
    normal: "Recalling 3 of 3 words is typical. A drop over several days is worth mentioning to a doctor.",
    flag: (e) => ((num(e.details.score) ?? 3) < 2 ? "Recalled fewer than 2 words" : null),
  },
  {
    kind: "chair_stand", title: "Chair stand", icon: "seat-recline-normal", tint: ["#F8D5D2", "#E58C86"], color: "#C9443D",
    value: (e) => `${num(e.details.stands)} in 30s`,
    normal: "Scored against CDC STEADI norms for her age and sex. Below average suggests weaker legs and a higher fall risk.",
    flag: (e) => (e.details.below_average === true ? "Below average for her age" : null),
  },
  {
    kind: "breathing", title: "Breathing", icon: "lungs", tint: ["#DCD8F2", "#9C95D6"], color: "#6B63B8",
    value: (e) => `${Math.round((num(e.details.bpm) ?? 0) * 10) / 10}/min`,
    normal: "A resting rate of about 12–20 breaths a minute is usual for adults. The app flags below 10 or above 24.",
    flag: (e) => { const b = num(e.details.bpm) ?? 16; return b > 24 || b < 10 ? "Outside the usual range" : null; },
  },
];
const CHECK_FIELD: Record<CheckKind, string> = { memory: "score", chair_stand: "stands", breathing: "bpm" };
const checkRows = (events: Event[], kind: CheckKind) =>
  events.filter((e) => e.type === kind && num(e.details?.[CHECK_FIELD[kind]]) !== null); // newest first
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });


function CheckDetail({ kind, events, tasks, now, parent, fill = false, onClose }: {
  kind: CheckKind; events: Event[]; tasks: Task[]; now: number; parent: string; fill?: boolean; onClose: () => void;
}) {
  const c = CHECKS.find((x) => x.kind === kind)!;
  const rows = checkRows(events, kind);
  const today = new Date(now).toDateString();
  const todayRows = rows.filter((e) => new Date(e.created_at).toDateString() === today);
  const scheduled = tasks.filter((t) => t.kind === kind);
  const manual = (e: Event) => num(e.details.manual_count);

  return (
    <View style={[s.detail, fill && { flex: 1, marginTop: 0, minHeight: 0 }]}>
      <View style={s.cardHead}>
        <CardTitle>{c.title} · today</CardTitle>
        <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}><Ionicons name="close" size={20} color={D.muted} /></Pressable>
      </View>
      <InnerScroll on={fill}>

      {todayRows.length ? (
        todayRows.map((e) => {
          const flag = c.flag(e);
          return (
            <View key={e.id} style={[s.detailToday, flag ? { backgroundColor: "#FDECEA" } : null]}>
              <Ionicons name={flag ? "alert-circle" : "checkmark-circle"} size={22} color={flag ? D.red : D.green} />
              <View style={{ flex: 1 }}>
                <Text style={s.detailBig}>{c.value(e)} <Text style={s.detailMuted}>at {timeOf(e.created_at)}</Text></Text>
                <Text style={s.detailMuted}>{flag ?? "Looks normal"}{manual(e) !== null ? ` · helper counted ${manual(e)}` : ""}{e.sample ? " · sample data" : ""}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={[s.detailToday, { backgroundColor: "#FFF4E5" }]}>
          <Ionicons name="time-outline" size={22} color="#B86A1E" />
          <Text style={[s.detailMuted, { flex: 1, color: "#8A5212" }]}>{parent} hasn’t done the {c.title.toLowerCase()} check today.</Text>
        </View>
      )}

      {scheduled.length ? (
        <Text style={s.detailLine}>
          Scheduled: {scheduled.map((t) => `${t.time ? clock(t.time) : "any time"} (${STATUS[taskStatus(t, new Date(now))].label.toLowerCase()})`).join(", ")}
        </Text>
      ) : (
        <Text style={s.detailLine}>Not on {parent}’s schedule. Add it under Tasks to get a daily reminder on her phone.</Text>
      )}

      <Text style={[s.detailLine, { marginTop: 10, fontWeight: "600", color: D.ink }]}>Recent results</Text>
      {rows.length ? (
        rows.slice(0, 5).map((e) => (
          <View key={e.id} style={s.detailRow}>
            <Text style={s.detailMuted}>{shortDate(e.created_at)}, {timeOf(e.created_at)}</Text>
            <Text style={[s.detailRowVal, c.flag(e) ? { color: D.red } : null]}>{c.value(e)}{manual(e) !== null ? `  (counted ${manual(e)})` : ""}</Text>
          </View>
        ))
      ) : (
        <Text style={s.detailMuted}>No results yet.</Text>
      )}
      <Text style={[s.detailMuted, { marginTop: 10 }]}>{c.normal} Not a medical diagnosis.</Text>
      </InnerScroll>
    </View>
  );
}

const STATUS = {
  done: { label: "Completed", bg: "#8E8E93" },
  due: { label: "Due now", bg: D.blue },
  upcoming: { label: "Upcoming", bg: "#0A84FF" },
} as const;

function ScheduleCard({ tasks, events, now, parent, error, style, scroll = false, onManage, delay = 0 }: { tasks: Task[]; events: Event[]; now: number; parent: string; error: string | null; style?: ViewStyle; scroll?: boolean; onManage: () => void; delay?: number }) {
  const days = Array.from({ length: 5 }, (_, i) => new Date(now + i * 86400000));
  const [sel, setSel] = useState(0);
  const isToday = sel === 0;
  const shown = scroll ? tasks : tasks.slice(0, 3);
  // How each task was ticked off today: tapped, or confirmed by voice (with what Amma said; no audio kept).
  const todayStr = new Date(now).toDateString();
  const confirmation = (t: Task) => events.find((e) => e.type === "task_done" && e.details?.task_id === t.id && new Date(e.created_at).toDateString() === todayStr);
  const started = (t: Task) => events.find((e) => e.type === "task_started" && e.details?.task_id === t.id && new Date(e.created_at).toDateString() === todayStr);
  const alarmStop = (t: Task) => events.find((e) => e.type === "alarm_stopped" && e.details?.task_id === t.id && new Date(e.created_at).toDateString() === todayStr);
  const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return (
    <DashCard delay={delay} style={style}>
      <View style={s.cardHead}>
        <CardTitle>{parent}’s schedule</CardTitle>
        <Pressable onPress={onManage} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={s.selectText}>{days[0].toLocaleDateString("en-IN", { month: "short" })}</Text>
          <Ionicons name="chevron-down" size={14} color={D.blue} />
        </Pressable>
      </View>
      <View style={s.days}>
        {days.map((d, i) => (
          <Pressable key={i} onPress={() => setSel(i)} style={[s.day, sel === i && s.dayOn]}>
            <Text style={[s.dayName, sel === i && { color: "#fff" }]}>{d.toLocaleDateString("en-IN", { weekday: "short" })}</Text>
            <Text style={[s.dayNum, sel === i && { color: "#fff" }]}>{d.getDate()}</Text>
          </Pressable>
        ))}
      </View>
      {tasks.length === 0 ? <Empty icon="calendar-outline" text={error ? `Tasks aren’t available yet (${error}).` : `No tasks yet. Add one in Tasks and it reaches ${parent}’s phone.`} /> : null}
      <InnerScroll on={scroll}>
      <View style={{ gap: 10 }}>
        {shown.map((t) => {
          const st = isToday ? STATUS[taskStatus(t, new Date(now))] : { label: "Scheduled", bg: "#E8E8ED" };
          return (
            <View key={t.id} style={s.task}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={s.taskIcon}><Ionicons name={KIND_ICON[t.kind][0]} size={18} color={D.blue} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.taskTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={s.taskSub}>{KIND_LABEL[t.kind]} · set by {t.created_by}</Text>
                </View>
                <Pressable onPress={onManage} hitSlop={8} accessibilityLabel={`Edit ${t.title}`}>
                  <Ionicons name="ellipsis-vertical" size={16} color={D.muted} />
                </Pressable>
              </View>
              <View style={s.taskFoot}>
                <Text style={s.taskTime}>{days[sel].toLocaleDateString("en-IN", { day: "numeric", month: "long" })}, {clock(t.time)}</Text>
                <View style={[s.status, { backgroundColor: st.bg }]}><Text style={s.statusText}>{st.label}</Text></View>
              </View>
              {isToday && alarmStop(t) ? (
                <View style={[s.confirm, { backgroundColor: "#F5F5F7" }]}>
                  <Ionicons name="alarm-outline" size={13} color={D.blue} />
                  <Text style={[s.confirmText, { color: D.ink }]}>Alarm rang · {parent} stopped it at {hm(alarmStop(t)!.created_at)}{doneToday(t, new Date(now)) ? "" : " · not confirmed yet"}</Text>
                </View>
              ) : null}
              {isToday && started(t) && !doneToday(t, new Date(now)) ? (
                <View style={[s.confirm, { backgroundColor: "#FFF4E5" }]}>
                  <Ionicons name="play" size={13} color="#B86A1E" />
                  <Text style={[s.confirmText, { color: "#8A5212" }]}>{parent} started at {hm(started(t)!.created_at)} · in progress</Text>
                </View>
              ) : null}
              {isToday && doneToday(t, new Date(now)) ? (() => {
                const ev = confirmation(t);
                const byVoice = ev?.details?.via === "voice";
                const steps = typeof ev?.details?.steps === "number" ? (ev.details.steps as number) : null;
                return (
                  <View style={s.confirm}>
                    <Ionicons name={byVoice ? "mic" : "hand-left-outline"} size={13} color={D.green} />
                    <Text style={s.confirmText} numberOfLines={3}>
                      {byVoice ? `Confirmed by voice${typeof ev?.details?.heard === "string" && ev.details.heard ? `: “${ev.details.heard}”` : ""}` : `${parent} ticked it off`}
                      {` · ${hm(t.last_done_at!)}`}
                      {steps !== null ? ` · 👣 ${steps.toLocaleString("en-IN")} steps` : ""}
                    </Text>
                  </View>
                );
              })() : null}
            </View>
          );
        })}
      </View>
      {tasks.length > shown.length ? (
        <Pressable onPress={onManage} style={{ marginTop: 12, alignSelf: "center" }}>
          <Text style={s.selectText}>View all {tasks.length} tasks</Text>
        </Pressable>
      ) : null}
      </InnerScroll>
    </DashCard>
  );
}

const cardShadow = { shadowColor: "#000000", shadowOpacity: 0.04, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 2 };

const s = StyleSheet.create({
  whoName: { fontSize: 16, fontWeight: "700", color: D.ink },
  whoCity: { fontSize: 14, color: D.ink },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  roundBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...cardShadow },
  liveDot: { position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: 4 },
  bellDot: { position: "absolute", top: 12, right: 14, width: 9, height: 9, borderRadius: 5, backgroundColor: D.red, borderWidth: 1.5, borderColor: "#fff" },

  urgent: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: D.red, borderRadius: 26, padding: 20, marginBottom: 22, flexWrap: "wrap" },
  urgentTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  urgentSub: { color: "#fff", fontSize: 14, marginTop: 4, opacity: 0.95 },
  ackBtn: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  ackText: { color: D.red, fontWeight: "700", fontSize: 14 },

  row: { flexDirection: "row", gap: 18 },
  hello: { fontSize: 44, fontWeight: "700", color: D.ink, letterSpacing: -1.6 },
  helloSub: { fontSize: 19, color: D.muted, marginTop: 4 },
  heroArt: { height: 330, marginTop: 6, marginBottom: 14, justifyContent: "flex-end" },
  glass: { width: 220, borderRadius: 22, padding: 8, backgroundColor: "rgba(225,226,230,0.72)", marginBottom: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)" },
  glassTitle: { textAlign: "center", fontSize: 13, color: D.ink, fontWeight: "500", marginVertical: 6 },
  glassInner: { backgroundColor: "#fff", borderRadius: 16, padding: 12 },
  glassVal: { fontSize: 11, color: D.muted },
  checks: { flexDirection: "row", gap: 12 },
  check: { flex: 1, height: 150, backgroundColor: "#fff", borderRadius: 22, padding: 14, overflow: "hidden" },
  checkBlob: { position: "absolute", right: -30, top: 44, width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  checkEyebrow: { fontSize: 13, color: D.muted },
  checkTitle: { fontSize: 14, fontWeight: "700", color: D.ink },
  checkVal: { fontSize: 15, color: D.ink, fontWeight: "600" },
  checkSub: { fontSize: 11, color: D.muted, marginTop: 1 },
  checkActive: { borderWidth: 2, borderColor: D.blue },
  detail: { marginTop: 12, backgroundColor: "#fff", borderRadius: 22, padding: 16, ...cardShadow },
  detailToday: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#E8F8EE", borderRadius: 14, padding: 12, marginBottom: 8 },
  detailBig: { fontSize: 17, fontWeight: "700", color: D.ink },
  detailMuted: { fontSize: 12, color: D.muted, fontWeight: "400" },
  detailLine: { fontSize: 13, color: D.muted, marginTop: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F1F4" },
  detailRowVal: { fontSize: 13, fontWeight: "600", color: D.ink },

  card: { backgroundColor: D.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: D.line, ...cardShadow },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: "500", color: D.ink, letterSpacing: -0.3 },
  mark: { width: 14, height: 14, borderRadius: 4, backgroundColor: D.orange },
  dayPill: { height: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: "#161618", alignItems: "center", justifyContent: "center" },
  dayPillText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  hiText: { fontSize: 13, color: D.muted, marginLeft: 6, maxWidth: 260 },
  moreBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: D.pill },
  tagOrange: { fontSize: 11, fontWeight: "700", color: "#fff", backgroundColor: D.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  bigNum: { fontSize: 40, fontWeight: "300", color: D.ink, letterSpacing: -1.5, marginTop: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, padding: 5, paddingRight: 8, borderWidth: 1, borderColor: D.line, backgroundColor: "#fff", overflow: "hidden" },
  checkRowOn: { borderColor: "transparent" },
  checkPill: { backgroundColor: D.pill, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: D.line },
  checkPillText: { fontSize: 12, color: D.ink, fontWeight: "500" },
  checkRowText: { flex: 1, fontSize: 12, color: D.ink },
  checkDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  orangeCard: { backgroundColor: D.orange, borderColor: D.orange },
  arrowBtnLight: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  orangeTitle: { fontSize: 34, fontWeight: "500", color: "#fff", letterSpacing: -1.2, marginTop: 2 },
  ticks: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6, height: 20 },
  tick: { width: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.8)" },
  timelineRow: { flexDirection: "row", alignItems: "center" },
  timelineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  timelineLine: { width: 16, height: 1, backgroundColor: "rgba(255,255,255,0.6)" },
  timelinePill: { fontSize: 12, color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: "hidden" },
  heartRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  darkCard: { backgroundColor: D.dark, borderColor: D.dark },
  selectPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: D.pill, borderRadius: 999, paddingLeft: 12, padding: 3 },
  selectText: { fontSize: 12, color: D.blue, fontWeight: "500" },
  selectIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: D.blue, alignItems: "center", justifyContent: "center" },
  arrowBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: D.blueMid, alignItems: "center", justifyContent: "center" },
  foot: { fontSize: 11, color: D.muted, marginTop: 6 },
  miniLabel: { fontSize: 12, color: D.muted },
  meterVal: { fontSize: 13, color: D.ink, fontWeight: "600" },
  track: { height: 8, borderRadius: 4, backgroundColor: D.blueSoft, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  divider: { height: 1, backgroundColor: D.line, marginVertical: 8 },
  empty: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: D.pill, borderRadius: 16, padding: 14, marginVertical: 6 },
  emptyText: { flex: 1, fontSize: 13, color: D.muted, lineHeight: 19 },

  med: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 8, paddingRight: 16, backgroundColor: "rgba(255,255,255,0.88)", borderWidth: 0 },
  medOn: { backgroundColor: D.orange, borderColor: D.orange },
  medIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  medName: { fontSize: 13, fontWeight: "600", color: D.ink },
  medSub: { fontSize: 11, color: D.muted, marginTop: 1 },
  medRight: { fontSize: 11, color: D.ink, textAlign: "right", maxWidth: 120 },
  alertBox: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)", marginTop: 18, padding: 18 },
  alertText: { fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 19, marginTop: 2 },

  days: { flexDirection: "row", gap: 8, marginBottom: 14 },
  day: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: D.pill },
  dayOn: { backgroundColor: D.blue },
  dayName: { fontSize: 13, color: D.ink },
  dayNum: { fontSize: 12, color: D.ink, marginTop: 4 },
  task: { backgroundColor: D.pill, borderRadius: 16, padding: 12 },
  taskIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 14, fontWeight: "500", color: D.ink },
  taskSub: { fontSize: 11, color: D.muted, marginTop: 1 },
  taskFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#E8E8ED", marginTop: 10, paddingTop: 8 },
  taskTime: { fontSize: 11, color: D.muted },
  confirm: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#E8F8EE", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  confirmText: { flex: 1, fontSize: 12, color: "#2E7A50", fontWeight: "600" },
  status: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 },
  statusText: { fontSize: 11, color: "#fff", fontWeight: "500" },

  livePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  liveDotSm: { width: 7, height: 7, borderRadius: 4 },
  livePillText: { fontSize: 12, fontWeight: "600", color: D.ink },
  feedRow: { flexDirection: "row", gap: 12, alignItems: "center", padding: 10, borderRadius: 16, marginBottom: 6 },
  feedIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.blueSoft, alignItems: "center", justifyContent: "center" },
  feedText: { fontSize: 14, fontWeight: "500", color: D.ink },
  feedTime: { fontSize: 12, color: D.muted, marginTop: 2 },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: D.pill },
  ghostText: { fontSize: 13, fontWeight: "600", color: D.ink },
});
