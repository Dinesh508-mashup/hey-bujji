// Food carts and cab rides Amma asks for by voice (orders table, live via Supabase Realtime).
// Food: a demo cart waits for Ravi's approval on the dashboard; nothing is really ordered.
// Cab: a simulated driver + OTP (clearly labelled), plus buttons that open Uber / Ola / Rapido
// with the destination, where Amma confirms the real ride herself.
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";
import { FAMILY_ID } from "../lib/config";
import { logEvent } from "../lib/api";
import { speak } from "../lib/speak";
import { useLang } from "../lib/language";

export type Ride = { driver: string; phone: string; car: string; plate: string; otp: string; eta_min: number; rating: number; simulated: true };
export type Order = {
  id: string; kind: "food" | "cab"; status: "pending" | "approved" | "rejected" | "assigned" | "cancelled" | "completed";
  items: string[]; destination: string | null; details: Record<string, unknown>; said: string | null;
  decided_by: string | null; decided_at: string | null; created_at: string;
};

/** Today's orders for the family, newest first, kept live. */
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const load = () => supabase.from("orders").select("*").eq("family_id", FAMILY_ID).gte("created_at", since.toISOString())
      .order("created_at", { ascending: false }).then(({ data }) => setOrders((data as Order[]) ?? []));
    load();
    const ch = supabase.channel(`orders-${FAMILY_ID}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `family_id=eq.${FAMILY_ID}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return orders;
}

/** Ravi's decision on a food cart (dashboard). */
export async function decideOrder(o: Order, approve: boolean) {
  const { error } = await supabase.from("orders").update({ status: approve ? "approved" : "rejected", decided_by: "Ravi", decided_at: new Date().toISOString() }).eq("id", o.id);
  if (error) throw new Error(error.message);
  await logEvent(approve ? "order_approved" : "order_rejected",
    `Ravi ${approve ? "approved" : "rejected"} Amma's order: ${o.items.join(", ")}${approve ? " (demo cart, not placed)" : ""}`, "normal", { order_id: o.id });
}

const say = (otp: string) => otp.split("").join(" ");

// ---------------------------------------------------------------------------------- phone

/** Food cart on Amma's phone: shows the items and Ravi's decision, live. */
export function FoodOrderCard({ orderId, items }: { orderId?: string; items: string[] }) {
  const { t, voice } = useLang();
  const orders = useOrders();
  const o = orders.find((x) => x.id === orderId);
  const status = o?.status ?? "pending";
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (status === "pending" || spoken.current === status) return;
    spoken.current = status;
    speak(status === "approved"
      ? t({ en: `Ravi approved your order: ${items.join(", ")}.`, te: `రవి మీ ఆర్డర్ ఒప్పుకున్నారు: ${items.join(", ")}.`, hi: `रवि ने आपका ऑर्डर मंज़ूर किया: ${items.join(", ")}।` })
      : t({ en: "Ravi said not now for this order.", te: "రవి ఈ ఆర్డర్ వద్దన్నారు.", hi: "रवि ने अभी यह ऑर्डर मना किया।" }), voice);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={st.card}>
      <View style={st.head}><Ionicons name="basket" size={20} color="#E07A2E" /><Text style={st.headText}>{t({ en: "Your cart", te: "మీ కార్ట్", hi: "आपकी कार्ट" })}</Text><Text style={st.tag}>Demo cart</Text></View>
      {items.map((it) => <Text key={it} style={st.item}>• {it}</Text>)}
      <View style={[st.status, status === "approved" ? st.ok : status === "rejected" ? st.no : st.wait]}>
        <Ionicons name={status === "approved" ? "checkmark-circle" : status === "rejected" ? "close-circle" : "time"} size={18} color={status === "approved" ? "#2E7A50" : status === "rejected" ? "#B3261E" : "#8A5212"} />
        <Text style={st.statusText}>
          {status === "approved" ? t({ en: "Ravi approved ✓ (demo, not placed)", te: "రవి ఒప్పుకున్నారు ✓ (డెమో)", hi: "रवि ने मंज़ूर किया ✓ (डेमो)" })
            : status === "rejected" ? t({ en: "Ravi said not now", te: "రవి వద్దన్నారు", hi: "रवि ने मना किया" })
            : t({ en: "Waiting for Ravi to approve…", te: "రవి ఒప్పుకోవాలి…", hi: "रवि की मंज़ूरी का इंतज़ार…" })}
        </Text>
      </View>
    </View>
  );
}

function rideLinks(destination: string, from: { latitude: number; longitude: number } | null) {
  const d = encodeURIComponent(destination);
  const pick = from ? `pickup[latitude]=${from.latitude}&pickup[longitude]=${from.longitude}` : "pickup=my_location";
  return [
    { name: "Uber", url: `https://m.uber.com/ul/?action=setPickup&${pick}&dropoff[formatted_address]=${d}` },
    { name: "Ola", url: from ? `https://book.olacabs.com/?pickup_lat=${from.latitude}&pickup_lng=${from.longitude}&drop_name=${d}` : "https://book.olacabs.com/" },
    { name: "Rapido", url: "https://www.rapido.bike/" },
  ];
}

/** Ride card on Amma's phone: driver, car, OTP read aloud, pickup from GPS, buttons to the real apps. */
export function RideCard({ ride, destination }: { ride: Ride; destination: string }) {
  const { t, voice } = useLang();
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickup, setPickup] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!(await Location.requestForegroundPermissionsAsync()).granted) return;
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setHere(p.coords);
        const [a] = await Location.reverseGeocodeAsync(p.coords);
        if (a) setPickup([a.name ?? a.street, a.district ?? a.subregion, a.city].filter(Boolean).join(", "));
      } catch { /* location off: the ride apps use their own */ }
    })();
    const id = setTimeout(() => speak(t({
      en: `Your driver ${ride.driver} is coming in ${ride.eta_min} minutes. ${ride.car}, number ${ride.plate}. Your OTP is ${say(ride.otp)}. I repeat, ${say(ride.otp)}.`,
      te: `మీ డ్రైవర్ ${ride.driver} ${ride.eta_min} నిమిషాల్లో వస్తున్నారు. ${ride.car}, నంబర్ ${ride.plate}. మీ OTP ${say(ride.otp)}. మళ్ళీ, ${say(ride.otp)}.`,
      hi: `आपके ड्राइवर ${ride.driver} ${ride.eta_min} मिनट में आ रहे हैं। ${ride.car}, नंबर ${ride.plate}। आपका OTP ${say(ride.otp)}। फिर से, ${say(ride.otp)}।`,
    }), voice), 5500); // after Bujji's main reply
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={st.card}>
      <View style={st.head}><Ionicons name="car" size={20} color="#3B6FD8" /><Text style={st.headText}>{t({ en: "Cab to", te: "క్యాబ్", hi: "कैब" })} {destination}</Text><Text style={st.tag}>Simulated</Text></View>
      <View style={st.driverRow}>
        <View style={st.avatar}><Text style={{ fontSize: 26 }}>🧑🏽‍✈️</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={st.driver}>{ride.driver} · ⭐ {ride.rating}</Text>
          <Text style={st.car}>{ride.car}</Text>
          <Text style={st.plate}>{ride.plate}</Text>
        </View>
        <View style={{ alignItems: "center" }}><Text style={st.eta}>{ride.eta_min}</Text><Text style={st.etaLabel}>min</Text></View>
      </View>
      <Pressable onPress={() => speak(t({ en: `Your OTP is ${say(ride.otp)}`, te: `మీ OTP ${say(ride.otp)}`, hi: `आपका OTP ${say(ride.otp)}` }), voice)} style={st.otpBox} accessibilityLabel={`OTP ${say(ride.otp)}. Tap to hear it again`}>
        <Text style={st.otpLabel}>OTP · {t({ en: "tap to hear", te: "వినడానికి నొక్కండి", hi: "सुनने के लिए दबाइए" })} 🔊</Text>
        <Text style={st.otp}>{ride.otp.split("").join("  ")}</Text>
      </Pressable>
      <Text style={st.pickup}>📍 {t({ en: "Pickup", te: "పికప్", hi: "पिकअप" })}: {pickup ?? (here ? `${here.latitude.toFixed(4)}, ${here.longitude.toFixed(4)}` : t({ en: "your current location", te: "మీ ప్రస్తుత స్థలం", hi: "आपकी मौजूदा जगह" }))}</Text>
      <Text style={st.small}>{t({ en: "Book the real ride in your app:", te: "నిజమైన రైడ్ మీ యాప్‌లో బుక్ చేయండి:", hi: "असली राइड अपने ऐप में बुक कीजिए:" })}</Text>
      <View style={st.apps}>
        {rideLinks(destination, here).map((a) => (
          <Pressable key={a.name} onPress={() => Linking.openURL(a.url)} style={({ pressed }) => [st.appBtn, pressed && { opacity: 0.8 }]}>
            <Text style={st.appText}>{a.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------------------ dashboard

/** Top of Ravi's dashboard: carts waiting for approval and today's rides (with the driver). */
export function OrdersStrip({ parent }: { parent: string }) {
  const orders = useOrders();
  const [busy, setBusy] = useState<string | null>(null);
  const pending = orders.filter((o) => o.kind === "food" && o.status === "pending");
  const rides = orders.filter((o) => o.kind === "cab" && o.status === "assigned").slice(0, 1);
  const recent = orders.filter((o) => o.kind === "food" && o.status !== "pending").slice(0, 1);
  if (!pending.length && !rides.length && !recent.length) return null;
  const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

  async function decide(o: Order, ok: boolean) {
    setBusy(o.id);
    try { await decideOrder(o, ok); } catch (e) { console.warn(e); } finally { setBusy(null); }
  }

  return (
    <View style={ds.strip}>
      {pending.map((o) => (
        <View key={o.id} style={[ds.box, { borderColor: "#F6C48E", backgroundColor: "#FFF8F0" }]}>
          <Ionicons name="basket" size={22} color="#E07A2E" />
          <View style={{ flex: 1 }}>
            <Text style={ds.title}>{parent} wants to order: {o.items.join(", ")}</Text>
            <Text style={ds.sub}>{hm(o.created_at)}{o.said ? ` · said “${o.said}”` : ""} · demo cart, nothing is ordered</Text>
          </View>
          <Pressable disabled={busy === o.id} onPress={() => decide(o, false)} style={[ds.btn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E1EA" }]}><Text style={[ds.btnText, { color: "#141414" }]}>Reject</Text></Pressable>
          <Pressable disabled={busy === o.id} onPress={() => decide(o, true)} style={[ds.btn, { backgroundColor: "#141414" }]}><Text style={ds.btnText}>Approve</Text></Pressable>
        </View>
      ))}
      {rides.map((o) => {
        const r = o.details as unknown as Ride;
        return (
          <View key={o.id} style={[ds.box, { borderColor: "#C9D8F6", backgroundColor: "#F4F8FF" }]}>
            <Ionicons name="car" size={22} color="#3B6FD8" />
            <View style={{ flex: 1 }}>
              <Text style={ds.title}>{parent}’s cab to {o.destination} · {r.driver} ⭐ {r.rating} · {r.car} · {r.plate}</Text>
              <Text style={ds.sub}>Booked {hm(o.created_at)} · arriving in ~{r.eta_min} min · OTP {r.otp} · simulated booking</Text>
            </View>
          </View>
        );
      })}
      {recent.map((o) => (
        <View key={o.id} style={[ds.box, { borderColor: "#E5E1EA" }]}>
          <Ionicons name={o.status === "approved" ? "checkmark-circle" : "close-circle"} size={20} color={o.status === "approved" ? "#3FA36B" : "#B3261E"} />
          <Text style={[ds.sub, { flex: 1 }]}>You {o.status} {parent}’s order ({o.items.join(", ")}){o.decided_at ? ` at ${hm(o.decided_at)}` : ""}{o.status === "approved" ? " · demo cart, not placed" : ""}</Text>
        </View>
      ))}
    </View>
  );
}

const ds = StyleSheet.create({
  strip: { gap: 8, marginBottom: 12 },
  box: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1.5 },
  title: { fontSize: 15, fontWeight: "700", color: "#141414" },
  sub: { fontSize: 12, color: "#7A7A80", marginTop: 2 },
  btn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  btnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

const st = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 22, padding: 16, marginTop: 12, borderWidth: 1, borderColor: "#EFEAF5" },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  headText: { flex: 1, fontSize: 17, fontWeight: "800", color: "#141414" },
  tag: { fontSize: 11, fontWeight: "700", color: "#7A7A80", backgroundColor: "#F3F1F6", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  item: { fontSize: 17, color: "#141414", marginVertical: 2 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 10, marginTop: 10 },
  wait: { backgroundColor: "#FFF4E5" }, ok: { backgroundColor: "#EAF6EE" }, no: { backgroundColor: "#FDECEA" },
  statusText: { flex: 1, fontSize: 15, fontWeight: "700", color: "#141414" },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#E8EEFB", alignItems: "center", justifyContent: "center" },
  driver: { fontSize: 17, fontWeight: "800", color: "#141414" },
  car: { fontSize: 14, color: "#55555C" },
  plate: { fontSize: 15, fontWeight: "800", color: "#141414", marginTop: 2, letterSpacing: 1 },
  eta: { fontSize: 30, fontWeight: "800", color: "#3B6FD8" },
  etaLabel: { fontSize: 12, color: "#7A7A80" },
  otpBox: { marginTop: 12, backgroundColor: "#141414", borderRadius: 18, paddingVertical: 12, alignItems: "center" },
  otpLabel: { fontSize: 12, color: "#C9C9CF" },
  otp: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: 4, marginTop: 2 },
  pickup: { fontSize: 14, color: "#141414", marginTop: 10, fontWeight: "600" },
  small: { fontSize: 12, color: "#7A7A80", marginTop: 10 },
  apps: { flexDirection: "row", gap: 8, marginTop: 6 },
  appBtn: { flex: 1, backgroundColor: "#F3EEFB", borderRadius: 999, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#E3DAF5" },
  appText: { fontSize: 15, fontWeight: "800", color: "#141414" },
});
