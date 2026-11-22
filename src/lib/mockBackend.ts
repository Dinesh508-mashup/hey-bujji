// OFFLINE DEMO MODE (EXPO_PUBLIC_MOCK=1, or no Supabase URL configured).
// Runs the whole product with zero accounts and zero API keys:
//  - a tiny in-browser database that mimics the Supabase calls the app makes
//    (from/select/insert/update/delete/eq/gte/in/order/limit/maybeSingle, realtime channels, storage)
//  - seeded with the same demo family as supabase/migrations
//  - shared live between browser tabs (localStorage + "storage" events), so the parent app in one tab
//    and the family dashboard in another update each other, just like Supabase Realtime
//  - the real Bujji pipeline (supabase/functions/_shared) runs locally with its keyword rules
//    (no OpenAI / Sarvam), plus a rule-based scam check
// Typed requests work fully; recorded voice needs the real back end (Sarvam speech-to-text).
import { Platform } from "react-native";
import { runPipeline } from "../../supabase/functions/_shared/pipeline.ts";
import type { Family } from "../../supabase/functions/_shared/lexicon.ts";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const STORE_KEY = "heybujji.mock.v1";
const TABLES = ["families", "medicines", "contacts", "tasks", "events", "orders"];

const uuid = () => "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const H = 3600_000;

function seed(): Tables {
  const f = "demo-1";
  return {
    families: [{ id: f, parent_name: "Amma", parent_age: 68, parent_city: "Vijayawada", son_name: "Ravi", son_city: "Bengaluru" }],
    medicines: [
      { family_id: f, name: "Amlodipine", purpose: "bp", variants: ["amlo", "amlong", "amlodipin", "BP tablet"], dose_times: ["08:00"] },
      { family_id: f, name: "Metformin", purpose: "sugar", variants: ["glycomet", "metformin", "sugar tablet"], dose_times: ["08:00", "20:00"] },
    ],
    contacts: [
      { family_id: f, name: "Ravi", relation: "son", phone: "+919000000001", nicknames: ["ravi", "abbayi", "abbai", "babu", "koduku", "beta", "bete", "son", "kumar", "sun", "my son"] },
      { family_id: f, name: "Priya", relation: "daughter", phone: "+919000000002", nicknames: ["priya", "ammayi", "ammai", "kuthuru", "beti", "bitiya", "daughter"] },
    ],
    tasks: [
      task(f, "medicine", "Amlodipine (BP tablet)", "After breakfast", "08:00"),
      task(f, "walk", "Evening walk, 15 minutes", "Around the colony with Lakshmi garu", "17:30"),
      task(f, "breathing", "Breathing check", null, "19:00"),
    ],
    events: [
      ev(f, "medicine_taken", "Amma took Amlodipine (BP) (sample)", true, 26 * H),
      ev(f, "reminder_set", "Amma set a reminder: Metformin at 8:00 PM (sample)", true, 25 * H),
      { ...ev(f, "breathing", "Breathing check: 16 breaths/min, steady (sample)", true, 20 * H), details: { source: "sample", bpm: 16 } },
    ],
    orders: [],
  };
}
function task(family_id: string, kind: string, title: string, note: string | null, time: string): Row {
  return { id: uuid(), family_id, kind, title, note, time, active: true, last_done_at: null, created_by: "Ravi", created_at: iso() };
}
function ev(family_id: string, type: string, summary: string, sample: boolean, msAgo: number): Row {
  return { id: uuid(), family_id, type, summary, urgency: "normal", sample, details: { source: "sample" }, created_at: iso(msAgo) };
}

// ------------------------------------------------------------------------------ store + realtime

const web = Platform.OS === "web" && typeof window !== "undefined";
function load(): Tables {
  if (web) {
    try { const raw = window.localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw) as Tables; } catch { /* private mode */ }
  }
  return seed();
}
let db: Tables = load();
function save() { if (web) { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* ignore */ } } }
save();

type Listener = { table: string; event: string; cb: (p: { eventType: string; new: Row; old: Row }) => void };
const listeners = new Set<Listener>();
function emit(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", row: Row, old: Row = {}) {
  for (const l of listeners) if (l.table === table && (l.event === "*" || l.event === eventType)) l.cb({ eventType, new: row, old });
}
// another tab changed the data: diff and replay as realtime events
if (web) {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORE_KEY || !e.newValue) return;
    const next = JSON.parse(e.newValue) as Tables;
    for (const t of TABLES) {
      const before = new Map((db[t] ?? []).map((r) => [String(r.id ?? JSON.stringify(r)), r]));
      const after = new Map((next[t] ?? []).map((r) => [String(r.id ?? JSON.stringify(r)), r]));
      db[t] = next[t] ?? [];
      for (const [k, r] of after) { const b = before.get(k); if (!b) emit(t, "INSERT", r); else if (JSON.stringify(b) !== JSON.stringify(r)) emit(t, "UPDATE", r, b); }
      for (const [k, r] of before) if (!after.has(k)) emit(t, "DELETE", {}, r);
    }
  });
}

/** Wipe the demo data back to the seed (used by "Reset demo" too, via delete). */
export function resetMockData() { db = seed(); save(); for (const t of TABLES) emit(t, "DELETE", {}, {}); }

// ------------------------------------------------------------------------------ query builder

type Filter = (r: Row) => boolean;
class Query implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private sort: { col: string; asc: boolean } | null = null;
  private max: number | null = null;
  private one = false;
  constructor(private table: string) {}
  select() { return this; }
  insert(v: Row | Row[]) { this.op = "insert"; this.payload = v; return this; }
  update(v: Row) { this.op = "update"; this.payload = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  gte(c: string, v: string | number) { this.filters.push((r) => String(r[c]) >= String(v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.sort = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }

  private run(): { data: unknown; error: null } {
    const rows = (db[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    if (this.op === "insert") {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((v) => withDefaults(this.table, v));
      rows.push(...list); save(); list.forEach((r) => emit(this.table, "INSERT", r));
      return { data: list, error: null };
    }
    if (this.op === "update") {
      const changed: Row[] = [];
      for (let i = 0; i < rows.length; i++) if (match(rows[i])) { const old = rows[i]; rows[i] = { ...old, ...(this.payload as Row) }; changed.push(rows[i]); emit(this.table, "UPDATE", rows[i], old); }
      save(); return { data: changed, error: null };
    }
    if (this.op === "delete") {
      const gone = rows.filter(match); db[this.table] = rows.filter((r) => !match(r)); save();
      gone.forEach((r) => emit(this.table, "DELETE", {}, r));
      return { data: gone, error: null };
    }
    let out = rows.filter(match).map((r) => ({ ...r }));
    if (this.sort) { const { col, asc } = this.sort; out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1)); }
    if (this.max !== null) out = out.slice(0, this.max);
    return { data: this.one ? out[0] ?? null : out, error: null };
  }
  then<A = { data: unknown; error: null }, B = never>(ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }
}

function withDefaults(table: string, v: Row): Row {
  const base: Row = { id: uuid(), created_at: iso() };
  if (table === "events") Object.assign(base, { details: {}, urgency: "normal", sample: false });
  if (table === "tasks") Object.assign(base, { note: null, time: null, active: true, last_done_at: null, created_by: "Ravi" });
  if (table === "orders") Object.assign(base, { status: "pending", items: [], details: {}, said: null, destination: null, decided_by: null, decided_at: null });
  return { ...base, ...v };
}

class Channel {
  private mine: Listener[] = [];
  on(_kind: string, f: { event: string; table: string }, cb: Listener["cb"]) { const l = { table: f.table, event: f.event, cb }; this.mine.push(l); listeners.add(l); return this; }
  subscribe(status?: (s: string) => void) { setTimeout(() => status?.("SUBSCRIBED"), 0); return this; }
  _close() { this.mine.forEach((l) => listeners.delete(l)); }
}

export const mockClient = {
  from: (t: string) => new Query(t),
  channel: () => new Channel(),
  removeChannel: (c: Channel) => { c._close(); return Promise.resolve("ok"); },
  storage: { from: () => ({ upload: async () => ({ data: null, error: null }) }) },
};

// ------------------------------------------------------------------------------ edge functions

const DRIVERS = [["Suresh Kumar", "Maruti Swift Dzire", "AP 16 CK 4521"], ["Ramesh Babu", "Toyota Etios", "AP 39 TB 7788"], ["Venkat Rao", "Hyundai Aura", "AP 16 DE 1290"]];
function mockRide() {
  const [driver, car, plate] = DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
  return { driver, car, plate, phone: "+910000000000", otp: String(1000 + Math.floor(Math.random() * 9000)), eta_min: 3 + Math.floor(Math.random() * 6), rating: 4.7, simulated: true as const };
}

function family(): Family {
  const f = db.families[0] as Row;
  return {
    id: String(f.id), parentName: String(f.parent_name ?? "Amma"),
    medicines: db.medicines.map((m) => ({ name: String(m.name), purpose: (m.purpose as string) ?? undefined, variants: (m.variants as string[]) ?? [] })) as Family["medicines"],
    contacts: db.contacts.map((c) => ({ name: String(c.name), relation: String(c.relation), phone: String(c.phone), nicknames: (c.nicknames as string[]) ?? [] })) as Family["contacts"],
  };
}

type Part = { name: string; value: string } | { name: string; uri: string; filename: string; type: string };
function fields(body: Part[] | Row): Row {
  if (!Array.isArray(body)) return body;
  const o: Row = {};
  for (const p of body) o[p.name] = "value" in p ? p.value : "__file__";
  return o;
}

const SCAM = /(kyc|otp|pin\b|cvv|blocked|suspend|click|link|http|bit\.ly|lottery|prize|won|refund|customs|parcel|digital arrest|police|cbi|apk|upi collect|electricity.*(cut|disconnect)|urgent|verify)/gi;

async function bujji(body: Part[] | Row) {
  const f = fields(body);
  if (f.audio === "__file__") throw new Error("Offline demo mode understands typed requests only. Tap the keyboard button and type (e.g. “I took my BP tablet”). Voice needs the real back end (BUJJI.md section 3).");
  const result = await runPipeline({ pipeline: "bujji", family: family(), stt: {}, llm: {}, text: String(f.text ?? ""), replyLang: (f.reply_lang === "hi" || f.reply_lang === "te") ? f.reply_lang : undefined } as never);
  const dry = f.dry_run === true || f.dry_run === "1";
  const fid = String(f.family_id ?? "demo-1");
  if (!dry && result.action.type === "order") {
    const [o] = (await mockClient.from("orders").insert({ family_id: fid, kind: "food", status: "pending", items: result.action.items, said: result.transcript, details: { source: "demo_cart" } })).data as Row[];
    result.action.order_id = String(o.id);
  }
  if (!dry && result.action.type === "cab") {
    const ride = mockRide();
    result.action.ride = ride;
    const [o] = (await mockClient.from("orders").insert({ family_id: fid, kind: "cab", status: "assigned", destination: result.action.destination, said: result.transcript, details: ride })).data as Row[];
    result.action.order_id = String(o.id);
  }
  if (!dry && result.feed) {
    await mockClient.from("events").insert({ family_id: fid, type: result.feed.type, summary: result.feed.summary, urgency: result.feed.urgency, details: { transcript: result.transcript, intent: result.intent, source: "typed (offline demo)" } });
  }
  return result;
}

const REPLIES = {
  te: { scam: "అమ్మా, ఇది మోసం! ఏ లింక్ నొక్కకండి, OTP లేదా డబ్బులు ఇవ్వకండి. రవికి చెప్పాను.", suspicious: "ఇది అనుమానంగా ఉంది. ఏమీ నొక్కకండి, ముందు రవిని అడగండి.", safe: "ఇది మామూలు మెసేజ్ లాగా ఉంది. పర్వాలేదు." },
  hi: { scam: "यह धोखा है! कोई लिंक मत दबाइए, OTP या पैसे मत दीजिए। रवि को बता दिया।", suspicious: "यह संदिग्ध लग रहा है। कुछ मत दबाइए, पहले रवि से पूछिए।", safe: "यह सामान्य संदेश लग रहा है। कोई बात नहीं।" },
};
const ENGLISH = { scam: "This is a scam. Don't tap any link or share an OTP or money. I told Ravi.", suspicious: "This looks suspicious. Don't tap anything; ask Ravi first.", safe: "This looks like a normal message." };

async function checkMessage(body: Part[] | Row) {
  const f = fields(body);
  const text = String(f.text ?? "");
  if (!text && f.file === "__file__") throw new Error("Offline demo mode checks pasted text only. Paste the message instead of a screenshot.");
  const hits = Array.from(new Set((text.match(SCAM) ?? []).map((h) => h.toLowerCase())));
  const verdict = hits.length >= 2 ? "scam" : hits.length === 1 ? "suspicious" : "safe";
  const lang = f.lang === "hi" ? "hi" : "te";
  const result = {
    verdict, signals: hits.map((h) => `mentions “${h}”`), reason: verdict === "safe" ? "No common scam signs found (offline keyword check)." : "Contains common scam signs (offline keyword check).",
    sender: null, reply: { text: REPLIES[lang][verdict], english: ENGLISH[verdict], lang: lang === "hi" ? "hi-IN" : "te-IN" },
  };
  if (f.dry_run !== "1" && verdict !== "safe") {
    await mockClient.from("events").insert({ family_id: String(f.family_id ?? "demo-1"), type: "scam", summary: verdict === "scam" ? `Scam message blocked (text): ${result.reason}` : `Suspicious message checked (text): ${result.reason}`, urgency: verdict === "scam" ? "high" : "normal", details: { verdict, signals: result.signals, source: "offline demo" } });
  }
  return result;
}

/** Stand-in for POST /functions/v1/<fn>. */
export async function mockFunction(fn: string, body: Part[] | Row): Promise<unknown> {
  if (fn === "bujji") return bujji(body);
  if (fn === "check-message") return checkMessage(body);
  throw new Error(`Offline demo mode has no "${fn}" function`);
}
