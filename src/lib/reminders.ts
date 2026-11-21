// Local reminders with expo-notifications (works in Expo Go on iOS).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function scheduleDailyReminder(hhmm: string, medicine: string | null): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return null;
  const [hour, minute] = hhmm.split(":").map(Number);
  const what = medicine && medicine !== "all" ? medicine : "మందులు";
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "Hey Bujji 💊",
      body: `అమ్మా, ${what} వేసుకునే సమయం అయింది. (Time for ${medicine ?? "your medicine"})`,
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}
