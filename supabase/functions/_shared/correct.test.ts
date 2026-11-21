// Run with: node --test supabase/functions/_shared/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { correct } from "./correct.ts";
import { DEMO_FAMILY } from "./lexicon.ts";
import { charErrorRate, phoneticKey, transliterate } from "./translit.ts";

const C = (s: string) => correct(s, DEMO_FAMILY);

test("transliteration folds scripts to one key", () => {
  assert.equal(phoneticKey("అబ్బాయికి"), phoneticKey("abbayiki"));
  assert.equal(phoneticKey("Abbaayiki"), phoneticKey("abbayiki"));
  assert.equal(transliterate("రాత్రి"), "raatri");
  assert.equal(phoneticKey("रवि"), phoneticKey("Ravi"));
});

test("took medicine: BP tablet -> Amlodipine", () => {
  const r = C("Naa BP tablet teesukunna");
  assert.equal(r.medicine, "Amlodipine");
  assert.equal(r.time, null);
  assert.equal(r.language, "te");
});

test("took medicine: misheard Amlodipine variants", () => {
  assert.equal(C("Amlodipine vesukunna ippude").medicine, "Amlodipine");
  assert.equal(C("amlo dipin vesukunna").medicine, "Amlodipine");
  assert.equal(C("Aam lo de pin vesukunna").medicine, "Amlodipine");
  assert.equal(C("అమ్లోడిపిన్ వేసుకున్నా").medicine, "Amlodipine");
  assert.equal(C("met for min teesukunna").medicine, "Metformin");
});

test("'tablet' alone is not a medicine name", () => {
  assert.equal(C("tablet teesukunna").medicine, null);
});

test("Hindi: sugar ki goli -> Metformin", () => {
  const r = C("Maine sugar ki goli le li");
  assert.equal(r.medicine, "Metformin");
  assert.equal(r.language, "hi");
});

test("all morning tablets", () => {
  assert.equal(C("Morning tablets anni ayipoyayi").medicine, "all");
  assert.equal(C("Morning tablets anni ayipoyayi").time, null);
});

test("reminder times", () => {
  assert.equal(C("Raatri 8 ki sugar tablet gurthu cheyyi").time, "20:00");
  assert.equal(C("Raatri 8 ki sugar tablet gurthu cheyyi").medicine, "Metformin");
  assert.equal(C("Saayantram 6 gantalaku BP tablet").time, "18:00");
  assert.equal(C("Shaam 7 baje dawai yaad dilana").time, "19:00");
  assert.equal(C("raatri enimidi ki sugar tablet gurthu cheyyi").time, "20:00");
  assert.equal(C("రాత్రి 8 కి షుగర్ టాబ్లెట్ గుర్తు చేయి").time, "20:00");
  assert.equal(C("రాత్రి 8 కి షుగర్ టాబ్లెట్ గుర్తు చేయి").medicine, "Metformin");
  assert.equal(C("udayam enimidinnara ki BP tablet").time, "08:30");
  assert.equal(C("subah sade aath baje BP ki goli").time, "08:30");
  assert.equal(C("रात 9 बजे शुगर की गोली याद दिलाना").time, "21:00");
  assert.equal(C("remind me at 8:30 pm").time, "20:30");
});

test("contacts", () => {
  assert.equal(C("Abbayiki call cheyyi").contact, "Ravi");
  assert.equal(C("Ammayi ki phone kalupu").contact, "Priya");
  assert.equal(C("Ravi ko phone lagao").contact, "Ravi");
  assert.equal(C("అబ్బాయికి కాల్ చేయి").contact, "Ravi");
  assert.equal(C("beti ko phone karo").contact, "Priya");
});

test("red flags", () => {
  assert.equal(C("Chest lo noppi ga undi").symptom, "chest_pain");
  assert.equal(C("Kallu tiruguthunnayi").symptom, "dizziness");
  assert.equal(C("Usuru aadatledu").symptom, "breathlessness");
  assert.equal(C("Seene mein dard hai").symptom, "chest_pain");
  assert.equal(C("ఛాతీ లో నొప్పి గా ఉంది").symptom, "chest_pain");
  assert.equal(C("Naa BP tablet teesukunna").symptom, null);
});

test("scams", () => {
  assert.equal(C("Bank nundi call, OTP adigaru").scam, true);
  assert.equal(C("Police ani cheppi dabbulu adugutunnaru").scam, true);
  assert.equal(C("KYC update cheyyamani link pampincharu").scam, true);
  assert.equal(C("KYC update cheyyamani link pampincharu").moneySent, false);
  assert.equal(C("OTP ichesanu, dabbulu pampesanu").moneySent, true);
  assert.equal(C("Abbayiki call cheyyi").scam, false);
});

test("character error rate ignores script differences", () => {
  assert.ok(charErrorRate("raatri", "రాత్రి") < 0.01);
  assert.equal(charErrorRate("abc", "abc"), 0);
});
