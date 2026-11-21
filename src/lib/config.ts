export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const FAMILY_ID = process.env.EXPO_PUBLIC_FAMILY_ID || "demo-1";
export const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1` : "";
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const DISCLAIMER = "Wellness and family-alert assistant, not a medical device.";
