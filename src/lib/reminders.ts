// Local reminders with expo-notifications (works in Expo Go on iOS).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { currentLang } from "./language";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function scheduleDailyReminder(hhmm: string, medicine: string | null): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return null;
  const [hour, minute] = hhmm.split(":").map(Number);
  const lang = currentLang();
  const named = medicine && medicine !== "all" ? medicine : null;
  const body = lang === "en"
    ? `Amma, it's time to take ${named ?? "your medicine"}.`
    : lang === "hi"
      ? `अम्मा, ${named ?? "दवाई"} लेने का समय हो गया। (Time for ${named ?? "your medicine"})`
      : `అమ్మా, ${named ?? "మందులు"} వేసుకునే సమయం అయింది. (Time for ${named ?? "your medicine"})`;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Hey Bujji 💊",
      body,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}
