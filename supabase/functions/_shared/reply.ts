// Spoken replies in Telugu or Hindi, plus the line the son sees on the dashboard.
import type { Intent } from "./intent.ts";
import type { Family } from "./lexicon.ts";

export type Reply = {
  text: string; // what Hey Bujji says (Telugu / Devanagari script)
  english: string; // gloss shown under it
  lang: "te-IN" | "hi-IN";
};

export type FeedLine = { type: string; summary: string; urgency: Intent["urgency"] };

export function formatClock(hhmm: string | null): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

const SYMPTOM_EN: Record<string, string> = {
  chest_pain: "chest pain", breathlessness: "breathlessness", dizziness: "dizziness", other: "feeling unwell",
};

// Names written in the reply's script so the Telugu/Hindi voice says them naturally.
const NATIVE: Record<string, { te: string; hi: string }> = {
  Ravi: { te: "రవి", hi: "रवि" },
  Priya: { te: "ప్రియ", hi: "प्रिया" },
  Amlodipine: { te: "ఆమ్లోడిపిన్", hi: "एम्लोडिपिन" },
  Metformin: { te: "మెట్‌ఫార్మిన్", hi: "मेटफॉर्मिन" },
};
const nat = (name: string, hi: boolean) => NATIVE[name]?.[hi ? "hi" : "te"] ?? name;

/** replyLang forces the reply language (the app's language setting); otherwise follow the speaker. */
export function buildReply(i: Intent, family: Family, replyLang?: "te" | "hi"): Reply {
  const hi = replyLang ? replyLang === "hi" : i.language === "hi";
  const lang = hi ? "hi-IN" : "te-IN";
  const med = i.medicine === "all" ? (hi ? "सारी गोलियाँ" : "అన్ని మాత్రలు") : i.medicine ? nat(i.medicine, hi) : (hi ? "दवाई" : "మందు");
  const medEn = i.medicine === "all" ? "all your tablets" : i.medicine ?? "your medicine";
  const time = formatClock(i.time);
  const contact = family.contacts.find((c) => c.name === i.contact);
  const sonName = family.contacts.find((c) => c.relation === "son")?.name ?? "family";
  const son = nat(sonName, hi);

  switch (i.intent) {
    case "took_medicine":
      return hi
        ? { lang, text: `ठीक है, ${med} लेना दर्ज कर लिया। ${son} को बता दिया।`, english: `Okay, I noted that you took ${medEn}. I told ${sonName}.` }
        : { lang, text: `సరే అమ్మా, ${med} వేసుకున్నారని రాశాను. ${son} కి చెప్పాను.`, english: `Okay Amma, I noted that you took ${medEn}. I told ${sonName}.` };
    case "set_reminder":
      if (!i.time) {
        return hi
          ? { lang, text: `किस समय याद दिलाऊँ?`, english: "What time should I remind you?" }
          : { lang, text: `ఏ సమయానికి గుర్తు చేయాలి?`, english: "What time should I remind you?" };
      }
      return hi
        ? { lang, text: `ठीक है, ${time} पर ${med} याद दिला दूँगी।`, english: `Okay, I will remind you about ${medEn} at ${time}.` }
        : { lang, text: `సరే, ${time} కి ${med} గుర్తు చేస్తాను.`, english: `Okay, I will remind you about ${medEn} at ${time}.` };
    case "call_family":
      if (!contact) {
        return hi
          ? { lang, text: `किसको फ़ोन लगाऊँ?`, english: "Whom should I call?" }
          : { lang, text: `ఎవరికి కాల్ చేయాలి?`, english: "Whom should I call?" };
      }
      return hi
        ? { lang, text: `${nat(contact.name, true)} को फ़ोन लगा रही हूँ।`, english: `Calling ${contact.name} (${contact.relation}).` }
        : { lang, text: `${nat(contact.name, false)} కి కాల్ చేస్తున్నాను.`, english: `Calling ${contact.name} (${contact.relation}).` };
    case "red_flag":
      return hi
        ? { lang, text: `यह गंभीर हो सकता है। क्या 108 पर कॉल करूँ? ${son} को बता रही हूँ।`, english: `This could be serious. Call 108? I am alerting ${sonName}.` }
        : { lang, text: `అమ్మా, ఇది ప్రమాదం కావచ్చు. 108 కి కాల్ చేయాలా? ${son} కి చెబుతున్నాను.`, english: `Amma, this could be serious. Call 108? I am alerting ${sonName}.` };
    case "scam_report": {
      const base = hi
        ? { text: `OTP मत दीजिए! बैंक कभी OTP नहीं माँगता। ${son} को बता दिया।`, english: `Don't give the OTP. A bank never asks for it. I told ${sonName}.` }
        : { text: `OTP ఇవ్వకండి! బ్యాంక్ ఎప్పుడూ OTP అడగదు. ${son} కి చెప్పాను.`, english: `Don't give the OTP. A bank never asks for it. I told ${sonName}.` };
      if (i.money_sent) {
        base.text += hi ? " तुरंत 1930 पर कॉल कीजिए।" : " వెంటనే 1930 కి కాల్ చేయండి.";
        base.english += " Call 1930 now.";
      }
      return { lang, ...base };
    }
    case "video_call": {
      const who = contact ?? family.contacts.find((c) => c.relation === "son");
      const n = who?.name ?? sonName;
      return hi
        ? { lang, text: `${nat(n, true)} को व्हाट्सऐप वीडियो कॉल लगा रही हूँ।`, english: `Opening a WhatsApp video call with ${n}.` }
        : { lang, text: `${nat(n, false)} కి వాట్సాప్ వీడియో కాల్ చేస్తున్నాను.`, english: `Opening a WhatsApp video call with ${n}.` };
    }
    case "order_food": {
      const what = (i.items ?? []).join(", ");
      if (!what) {
        return hi
          ? { lang, text: `क्या मँगाना है?`, english: "What would you like me to order?" }
          : { lang, text: `ఏం ఆర్డర్ చేయాలి?`, english: "What would you like me to order?" };
      }
      return hi
        ? { lang, text: `${what} कार्ट में डाल दिया। ${son} के हाँ कहने पर ऑर्डर होगा।`, english: `I put ${what} in the cart and sent it to ${sonName} to approve.` }
        : { lang, text: `${what} కార్ట్‌లో పెట్టాను. ${son} ఒప్పుకున్నాక ఆర్డర్ అవుతుంది.`, english: `I put ${what} in the cart and sent it to ${sonName} to approve.` };
    }
    case "book_cab": {
      const to = i.destination ?? "your destination";
      return hi
        ? { lang, text: `${to} के लिए कैब बुक कर रही हूँ। ड्राइवर और OTP स्क्रीन पर है।`, english: `Booking a cab to ${to}. The driver and your OTP are on the screen.` }
        : { lang, text: `${to} కి క్యాబ్ బుక్ చేస్తున్నాను. డ్రైవర్, OTP స్క్రీన్ మీద ఉన్నాయి.`, english: `Booking a cab to ${to}. The driver and your OTP are on the screen.` };
    }
    default:
      return hi
        ? { lang, text: `माफ़ कीजिए, फिर से बोलिए?`, english: "Sorry, could you say that again?" }
        : { lang, text: `క్షమించండి, మళ్ళీ చెబుతారా?`, english: "Sorry, could you say that again?" };
  }
}

/** What the son's dashboard shows for an intent. null = nothing to post. */
export function feedLine(i: Intent, family: Family): FeedLine | null {
  const p = family.parentName;
  const contact = family.contacts.find((c) => c.name === i.contact);
  switch (i.intent) {
    case "took_medicine": {
      const what = i.medicine === "all" ? "all her morning tablets"
        : i.medicine ? `${i.medicine}${purposeOf(i.medicine, family)}` : "a medicine";
      return { type: "medicine_taken", summary: `${p} took ${what}`, urgency: "normal" };
    }
    case "set_reminder":
      return { type: "reminder_set", summary: `${p} set a reminder: ${i.medicine ?? "medicine"} at ${formatClock(i.time) || "(time not heard)"}`, urgency: "normal" };
    case "call_family":
      return { type: "call", summary: `${p} is calling ${contact ? `${contact.name} (${contact.relation})` : "family"}`, urgency: "normal" };
    case "red_flag":
      return { type: "red_flag", summary: `Urgent: ${SYMPTOM_EN[i.symptom ?? "other"] ?? "symptom"} reported`, urgency: "urgent" };
    case "scam_report":
      return {
        type: "scam",
        summary: i.money_sent ? `Possible scam: ${p} says money was already sent. Call 1930.` : `Possible scam call to ${p}`,
        urgency: i.money_sent ? "urgent" : "high",
      };
    case "video_call":
      return { type: "call", summary: `${p} is video calling ${contact ? contact.name : family.contacts.find((c) => c.relation === "son")?.name ?? "family"} on WhatsApp`, urgency: "normal" };
    case "order_food":
      return (i.items ?? []).length
        ? { type: "order_request", summary: `${p} wants to order: ${(i.items ?? []).join(", ")}. Approve or reject below.`, urgency: "high" }
        : null;
    case "book_cab":
      return { type: "cab", summary: `${p} booked a cab to ${i.destination ?? "somewhere"} (simulated)`, urgency: "normal" };
    default:
      return null;
  }
}

function purposeOf(name: string, family: Family): string {
  const m = family.medicines.find((x) => x.name === name);
  if (!m?.purpose) return "";
  return m.purpose === "bp" ? " (BP)" : ` (${m.purpose})`;
}
