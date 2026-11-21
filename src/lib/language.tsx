// App language for the parent screens: what is shown, spoken and replied.
// Default English (presentation audience); Telugu and Hindi are one tap away.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "en" | "te" | "hi";
export type VoiceLang = "en-IN" | "te-IN" | "hi-IN";
export type Tr = { en: string; te: string; hi: string };

// Telugu is switched off for now: add { code: "te", label: "Telugu", native: "తెలుగు" } back to re-enable it.
// The Telugu strings stay in the code (and the server still understands Telugu speech).
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];
const ENABLED = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

export const VOICE: Record<Lang, VoiceLang> = { en: "en-IN", te: "te-IN", hi: "hi-IN" };
const KEY = "heybujji.lang";

// Mirror for non-React code (notification text).
let current: Lang = "en";
export const currentLang = () => current;

type Ctx = { lang: Lang; voice: VoiceLang; setLang: (l: Lang) => void; t: (s: Tr) => string };
const LangContext = createContext<Ctx>({ lang: "en", voice: "en-IN", setLang: () => {}, t: (s) => s.en });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (ENABLED(v)) { current = v; setLangState(v); } })
      .catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    if (!ENABLED(l)) l = "en";
    current = l;
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({ lang, voice: VOICE[lang], setLang, t: (s: Tr) => s[lang] }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Pick the reply to show and speak. Every back-end reply carries an English gloss. */
export function replyIn(reply: { text: string; english: string; lang: string }, lang: Lang): { text: string; sub: string | null; voice: VoiceLang } {
  // Only show the local-language reply when that language is switched on; otherwise English.
  const replyLang = reply.lang === "hi-IN" ? "hi" : reply.lang === "te-IN" ? "te" : "en";
  if (lang === "en" || replyLang === "en" || !ENABLED(replyLang)) return { text: reply.english, sub: null, voice: "en-IN" };
  return { text: reply.text, sub: reply.english, voice: VOICE[replyLang] };
}
