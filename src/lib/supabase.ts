import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { MOCK, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { mockClient } from "./mockBackend";

const real = () => createClient(SUPABASE_URL || "http://localhost", SUPABASE_ANON_KEY || "missing", {
  auth: { persistSession: false, autoRefreshToken: false },
});
/** Real Supabase, or the in-browser offline demo database (EXPO_PUBLIC_MOCK=1 / no URL). */
export const supabase = (MOCK ? mockClient : real()) as unknown as ReturnType<typeof real>;
