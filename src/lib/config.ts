export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const FAMILY_ID = process.env.EXPO_PUBLIC_FAMILY_ID || "demo-1";
export const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1` : "";
/** Offline demo mode: no accounts or keys needed (see src/lib/mockBackend.ts, BUJJI.md). */
// Offline when asked to, when no Supabase URL is set, or when .env still has the .env.example placeholder.
export const MOCK = process.env.EXPO_PUBLIC_MOCK === "1" || !SUPABASE_URL || /YOUR-PROJECT/i.test(SUPABASE_URL);
export const isConfigured = MOCK || Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const DISCLAIMER = "Wellness and family-alert assistant, not a medical device.";
