import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { C } from "../lib/theme";
import { LanguageProvider } from "../lib/language";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.teal,
          headerTitleStyle: { fontWeight: "800", color: C.ink },
          headerShadowVisible: false,
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Hey Bujji" }} />
        <Stack.Screen name="checkin" options={{ title: "Check-in" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="parent" options={{ title: "Hey Bujji" }} />
        <Stack.Screen name="breathing" options={{ title: "Breathing check" }} />
        <Stack.Screen name="chairstand" options={{ title: "Chair stand" }} />
        <Stack.Screen name="memory" options={{ title: "Memory check" }} />
        <Stack.Screen name="heart" options={{ title: "Heart rate" }} />
        <Stack.Screen name="check" options={{ title: "Bujji, check this" }} />
        <Stack.Screen name="family" options={{ title: "Ravi's dashboard" }} />
        <Stack.Screen name="results" options={{ title: "Results" }} />
        <Stack.Screen name="record" options={{ title: "Record test clips" }} />
      </Stack>
    </LanguageProvider>
  );
}
