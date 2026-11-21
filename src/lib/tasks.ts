// Tasks and reminders set by the family on the web dashboard and done by the parent.
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import { FAMILY_ID } from "./config";
import { logEvent } from "./api";
import "./reminders"; // sets the notification handler
import { currentLang } from "./language";

export type TaskKind = "medicine" | "breathing" | "chair_stand" | "memory" | "walk" | "call" | "custom";
export type Task = {
  id: string;
  kind: TaskKind;
  title: string;
  note: string | null;
  time: string | null;
  active: boolean;
  last_done_at: string | null;
  created_by: string;
  created_at: string;
};
export type TaskInput = Pick<Task, "kind" | "title" | "note" | "time"> & { active?: boolean };

export const KIND_LABEL: Record<TaskKind, string> = {
  medicine: "Medicine", breathing: "Breathing check", chair_stand: "Chair stand", memory: "Memory check",
  walk: "Walk", call: "Call family", custom: "Other",
};
export const KIND_TE: Record<TaskKind, string> = {
  medicine: "మందులు", breathing: "ఊపిరి పరీక్ష", chair_stand: "కుర్చీ వ్యాయామం", memory: "జ్ఞాపకశక్తి",
  walk: "నడక", call: "ఫోన్ చేయండి", custom: "పని",
};
export const KIND_HI: Record<TaskKind, string> = {
  medicine: "दवाई", breathing: "साँस की जाँच", chair_stand: "कुर्सी व्यायाम", memory: "याददाश्त",
  walk: "सैर", call: "फ़ोन करें", custom: "काम",
};

/** Screens in the parent app that complete a task of this kind on their own. */
export const KIND_ROUTE: Partial<Record<TaskKind, "/breathing" | "/chairstand" | "/memory">> = {
  breathing: "/breathing", chair_stand: "/chairstand", memory: "/memory",
};

export function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function clock(hhmm: string | null) {
  if (!hhmm) return "Any time";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function doneToday(t: Task, now = new Date()) {
  return !!t.last_done_at && new Date(t.last_done_at).toDateString() === now.toDateString();
}

/** "done" | "due" (time passed, not done) | "upcoming" */
export function taskStatus(t: Task, now = new Date()): "done" | "due" | "upcoming" {
  if (doneToday(t, now)) return "done";
  if (!t.time) return "due";
  const [h, m] = t.time.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m ? "due" : "upcoming";
}

const byTime = (a: Task, b: Task) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99");

/** Live list of the family's tasks (Supabase Realtime). */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => supabase.from("tasks").select("*").eq("family_id", FAMILY_ID).then(({ data, error: e }) => {
    if (e) setError(e.message.includes("tasks") ? "The tasks table is missing. Run `npx supabase db push`." : e.message);
    else { setError(null); setTasks((data as Task[]).sort(byTime)); }
    setLoading(false);
  }), []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`tasks-${FAMILY_ID}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `family_id=eq.${FAMILY_ID}` }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { tasks, error, loading, refresh };
}

export async function addTask(t: TaskInput) {
  const { error } = await supabase.from("tasks").insert({ ...t, family_id: FAMILY_ID });
  if (error) throw new Error(error.message);
}

export async function updateTask(id: string, patch: Partial<TaskInput>) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Tick a task off. `heard` = what Amma said when she confirmed it by voice (text only; no audio is kept). */
export async function markDone(t: Task, heard?: string) {
  const { error } = await supabase.from("tasks").update({ last_done_at: new Date().toISOString() }).eq("id", t.id);
  if (error) throw new Error(error.message);
  const via = heard ? "voice" : "tap";
  const summary = heard ? `Amma confirmed by voice: ${t.title}` : `Amma did: ${t.title}`;
  await logEvent("task_done", summary, "normal", { task_id: t.id, kind: t.kind, via, heard: heard ?? null });
  // Medicines also count on the dashboard's medication list ("Taken today ✓").
  if (t.kind === "medicine") await logEvent("medicine_taken", `Amma took ${t.title}`, "normal", { task_id: t.id, via, heard: heard ?? null });
}

/** Called by the check screens after a result is saved: ticks off today's open tasks of that kind. */
export async function completeKind(kind: TaskKind) {
  const { data } = await supabase.from("tasks").select("*").eq("family_id", FAMILY_ID).eq("kind", kind).eq("active", true);
  const open = ((data as Task[] | null) ?? []).filter((t) => !doneToday(t));
  if (!open.length) return;
  await supabase.from("tasks").update({ last_done_at: new Date().toISOString() }).in("id", open.map((t) => t.id));
}

/** Re-schedule one daily local notification per active timed task (parent's phone only). */
export async function syncTaskNotifications(tasks: Task[]) {
  if (Platform.OS === "web") return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(await Notifications.requestPermissionsAsync()).granted) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith("task-")).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    const lang = currentLang();
    for (const t of tasks) {
      if (!t.active || !t.time) continue;
      const [hour, minute] = t.time.split(":").map(Number);
      await Notifications.scheduleNotificationAsync({
        identifier: `task-${t.id}`,
        content: {
          title: `Hey Bujji · ${lang === "en" ? KIND_LABEL[t.kind] : lang === "hi" ? KIND_HI[t.kind] : KIND_TE[t.kind]}`,
          body: `${lang === "en" ? "Amma, time for: " : lang === "hi" ? "अम्मा, अब: " : "అమ్మా, "}${t.title}${t.note ? ` · ${t.note}` : ""}`,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }
  } catch (e) {
    console.warn("syncTaskNotifications failed", e);
  }
}
