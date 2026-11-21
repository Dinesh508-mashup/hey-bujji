import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { C } from "../lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.teal,
          headerTitleStyle: { fontWeight: "800", color: C.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Hey Bujji", headerShown: false }} />
        <Stack.Screen name="checkin" options={{ title: "Check-in", headerShown: false }} />
        <Stack.Screen name="parent" options={{ title: "Hey Bujji" }} />
        <Stack.Screen name="breathing" options={{ title: "Breathing check" }} />
        <Stack.Screen name="chairstand" options={{ title: "Chair stand" }} />
        <Stack.Screen name="memory" options={{ title: "Memory check" }} />
        <Stack.Screen name="check" options={{ title: "Bujji, check this" }} />
        <Stack.Screen name="family" options={{ title: "Ravi's dashboard" }} />
        <Stack.Screen name="results" options={{ title: "Results" }} />
        <Stack.Screen name="record" options={{ title: "Record test clips" }} />
      </Stack>
    </>
  );
}
