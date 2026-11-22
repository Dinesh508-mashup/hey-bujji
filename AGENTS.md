# Hey Bujji — setup, launch and test guide

**Hey Bujji** is a voice assistant for elderly parents in India (Telugu, Hindi, English) plus a live
dashboard for their children. The parent just talks ("I took my BP tablet", "Call my son",
"Chest pain", "Book a cab to the hospital"); the family sees everything and stays in control.

Two front ends, one back end:

| Part | Who uses it | Runs on | Code |
|---|---|---|---|
| **Parent app** ("Amma") | the elderly parent | iPhone, in **Expo Go** | `src/app/` (index, parent, health, check, results, breathing, heart, chairstand, memory, checkin, settings, intro, record) |
| **Family dashboard** ("Ravi") | the son / daughter | laptop browser, `/family` | `src/app/family.tsx`, `src/app/results.tsx`, `src/components/` |
| **Back end** | both | Supabase (Postgres + Realtime + Storage + Edge Functions) | `supabase/migrations/`, `supabase/functions/` (`bujji`, `check-message`, `tts`) |
| **Evaluation** | the team | laptop, Python | `eval/` |

All API keys stay on the server (Supabase secrets). The app only ever holds the public Supabase URL and anon key.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20 or newer** (tested on 24.11) | includes npm |
| npm | 10+ | `npm install` installs everything, including Expo SDK **58** |
| Expo Go | latest, for **SDK 58** | install on the iPhone from the App Store |
| Supabase | free account + project | CLI runs through `npx supabase` (no global install) |
| Python | 3.9+ | only for `eval/` scripts (standard library only) |
| iPhone | iOS 17+ recommended | microphone, motion sensor, pedometer, location |
| Docker | optional | only for the fully local Supabase option (section 4b) |
| macOS `say` | optional | `eval/make_tts_clips.py` uses it to make test clips |

Accounts for real AI (optional, see mock mode below): **OpenAI** (intent + scam check), **Sarvam AI**
(Indian-language speech-to-text and voice), **Gemini** (optional, only for screen-recording scam checks).

---

## 2. Environment variables

### 2a. App — `.env` (copy from `.env.example`)
Public values only; safe to ship inside the app.

| Variable | Example | Required |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://abcd1234.supabase.co` | yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key from Supabase → Project Settings → API | yes |
| `EXPO_PUBLIC_FAMILY_ID` | `demo-1` | yes (the seeded demo family) |

### 2b. Server — `supabase/.env` (copy from `supabase/.env.example`)
Uploaded with `npx supabase secrets set --env-file supabase/.env`. **Never commit this file** (it is git-ignored).

| Variable | What it powers | Without it |
|---|---|---|
| `OPENAI_API_KEY` | understanding requests (gpt-4.1-mini), scam check text + screenshots, Whisper baseline in the evaluation | typed requests fall back to keyword rules (see mock mode); scam check returns an error |
| `SARVAM_API_KEY` | speech-to-text for spoken requests (saarika:v2.5), Telugu/Hindi voice replies (bulbul:v3) | spoken requests fail; typed requests still work; the iPhone's own voice speaks English |
| `GEMINI_API_KEY` | optional: scam check of **screen recordings** (video) | screenshots and text still work via OpenAI |
| optional overrides | `LLM_PROVIDER`, `OPENAI_MODEL`, `GEMINI_MODEL`, `SARVAM_STT_MODEL`, `WHISPER_MODEL`, `SARVAM_TTS_SPEAKER`, `BUJJI_STT_PROVIDER`, `INDIC_ASR_URL` | sensible defaults in code |

**Small-budget keys:** OpenAI → Settings → Limits → set a monthly budget (e.g. $5). Sarvam is prepaid credits
(new accounts get starter credits). A full demo uses a few rupees.

### 2c. Mock mode (no AI keys at all)
Leave all three keys empty. The `bujji` function then understands **typed** requests with built-in keyword
rules (verified: medicine taken, reminder at 8 PM, call son, chest pain → 108, OTP scam, book a cab,
order food, video call). Use **"Type instead"** (keyboard button) on the Talk screen. Spoken requests and
the scam check need keys. Supabase (free tier) is always required.

---

## 3. Install, seed and start (hosted Supabase — recommended)

```bash
git clone https://github.com/Dinesh508-mashup/hey-bujji.git
cd hey-bujji
npm install
```

**Back end (once):**
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>         # Project Settings → General → Project ID
npx supabase db push --remote                               # tables, realtime, RLS, storage bucket + DEMO SEED DATA
cp supabase/.env.example supabase/.env                      # add your keys (or leave empty for mock mode)
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy bujji check-message tts --no-verify-jwt
```
`db push --remote` is required: this CLI version otherwise targets a local Docker database.

**Front ends:**
```bash
cp .env.example .env                                        # fill in URL + anon key
npx expo start --tunnel                                     # or: npx expo start (same Wi-Fi only)
```
`--tunnel` needs an Expo account: `npx expo login` (free). Use the same account in Expo Go.

| What | Where |
|---|---|
| Metro dev server | `http://localhost:8081` |
| **Parent app** | scan the QR code in the terminal with the iPhone camera → opens in Expo Go |
| **Family dashboard** | `http://localhost:8081/family` (tabs: `?tab=dashboard`, `insights`, `tasks`, `activity`) |
| Accuracy page (laptop) | `http://localhost:8081/results` |
| Edge functions | `https://<project-ref>.supabase.co/functions/v1/{bujji,check-message,tts}` |
| Supabase studio | `https://supabase.com/dashboard/project/<project-ref>` |

On the web, `/` redirects to the family dashboard; the parent app is phone-only.

### 3b. Fully local back end (optional, needs Docker)
```bash
npx supabase start                                          # API :54321, DB :54322, Studio :54323
npx supabase db reset                                       # applies migrations + seed
npx supabase functions serve --no-verify-jwt --env-file supabase/.env
npx supabase status                                         # prints the local anon key
```
Set `EXPO_PUBLIC_SUPABASE_URL=http://<your-laptop-LAN-IP>:54321` (not `localhost`, the phone must reach it).

---

## 4. Test users

There is **no login** in the demo: everything belongs to the seeded family `demo-1`.

| Role | Name | How to "log in" | Seeded data |
|---|---|---|---|
| Parent | **Amma**, 68, Vijayawada | open the app in Expo Go | medicines Amlodipine (BP, 08:00), Metformin (sugar, 08:00 + 20:00); daily tasks from Ravi |
| Family | **Ravi** (son), Bengaluru | open `/family` in a browser | live feed, schedule, orders, insights |
| Contact | **Priya** (daughter) | — | placeholder phone number |

**Before demoing calls:** Supabase → Table editor → `contacts` → set real phone numbers. Calls open the
iPhone dialler; do **not** actually dial 108 or 1930 while testing.

---

## 5. End-to-end journeys to try

Keep the iPhone and the laptop dashboard side by side. Tip: dashboard → **Live feed → Reset demo** clears test events.

1. **First run (phone):** intro (Bujji mascot, orbiting icons) → **Get Started** → home.
2. **Medicine by voice:** home → tap Bujji or the orange **Talk** button → *"I took my BP tablet"* →
   spoken reply → dashboard: Live feed line + Medication list shows "Taken today ✓".
3. **Call / video call:** *"Call my son"* or *"Kumar ki call cheyyi"* → dialler opens with Ravi's number.
   *"Video call my son"* → WhatsApp chat opens (tap the video icon).
4. **Emergency:** *"Chest lo noppi ga undi"* / *"I have chest pain"* → full-screen **Call 108?** prompt →
   dashboard shows a red urgent banner. Tap **I'm okay** (don't call 108).
5. **Task from the family:** dashboard → **Care plan** → add a task 2 minutes from now → phone home shows it
   with a countdown → at the time a **loud alarm** rings and speaks it → **Stop & say it's done** → *"done"* →
   dashboard schedule shows "Alarm stopped" + "Confirmed by voice: 'done'". Walk tasks: **Start walk** →
   live step count → say *"done"* → steps reach the dashboard.
6. **Scam check:** **Scam** tab → paste *"Dear customer your SBI KYC expired, update at sbi-kyc-verify.in or account blocked"* →
   verdict **Scam** + 1930 button → dashboard alert.
7. **Food order with approval:** *"Order banana and bread"* → phone shows a cart "Waiting for Ravi" →
   dashboard **Approve** → phone says "Ravi approved" → **Got it ✓** (or dashboard **Mark delivered**) → completed.
8. **Cab:** *"Hospital ki cab book cheyyi"* → ride card: driver, car, plate, ETA, **OTP read aloud**, pickup from GPS,
   buttons to open Uber/Ola/Rapido → **I've reached ✓** → dashboard ride closes.
9. **Health checks (phone, Health tab):** Breathing (phone flat on chest, 60 s), Chair stand (30 s),
   Memory (3 words), Heart rate (wellness check) → **Save and tell Ravi** → breathing, chair stand and
   memory appear in the dashboard's "Body health tracking" card (tap a row for today's detail);
   heart rate appears in the Live feed.
10. **Care tips (dashboard):** **Care tips** tab → suggestions from Amma's results and age (e.g. leg strength
    → calcium/vitamin D, walk) → **Assign to Amma** → task appears on the phone.
11. **Accuracy:** phone **Results** tab / laptop `/results` show "Not measured yet" until the evaluation runs (section 6).

---

## 6. Evaluation (measured accuracy)

```bash
python3 eval/make_tts_clips.py            # 80 clips with macOS voices (or record real voices: phone Settings → Record test clips)
python3 eval/fetch_clips.py               # only if clips were recorded in the app
python3 eval/run_eval.py                  # Whisper vs Indian ASR vs Hey Bujji, same audio, same AI prompt
python3 eval/sensor_accuracy.py           # breathing / chair-stand counts vs the helper's manual counts
```
Results are written to `data/eval-results.json` and `data/sensor-results.json`; the Results pages read only
these files, so **no number is ever typed in by hand**. A full run makes ~240 paid calls (a few rupees).

---

## 7. Checks

```bash
npm test                 # 84 unit tests (correction step, pipeline, breathing/chair maths, heart rate gates, alarms, insights)
npx tsc --noEmit         # typecheck
npx expo lint            # lint
npx expo-doctor          # Expo dependency/config check
```

---

## 8. What is simulated, mocked or not finished

| Area | Status |
|---|---|
| **Food orders** | Demo cart only. Bujji builds the cart and Ravi approves, but **nothing is ordered or paid**. Swiggy's MCP server is real but needs the owner's OAuth login; not connected yet. |
| **Cab booking** | **Simulated** driver, car, plate, ETA and OTP. The Uber/Ola/Rapido buttons open the real apps (Uber gets the destination); the parent confirms the real ride there. |
| **WhatsApp video call** | Opens the chat with the son's number; WhatsApp has no public link that starts a video call directly. |
| **Heart rate** | Phone-microphone method with strict safety gates; tested only on synthetic signals. On real chests it often finds no steady beat (iPhone mics filter low sounds). Planned: camera-fingertip (PPG) in a custom build. Wellness check, not medical. |
| **Breathing / chair stand** | Motion-sensor maths tested on synthetic signals; real accuracy not yet measured (helper counts are collected). |
| **Accuracy numbers** | **Not measured yet**; pages show dashes until `eval/run_eval.py` runs. |
| **Care tips** | Fixed rules, general wellness advice, not a diagnosis. |
| **Telugu replies** | Telugu is understood, but the Telugu reply option is switched off for the demo (English/Hindi replies). |
| **Task alarm** | Loud repeating alarm works while the app is open; when closed, iOS shows a normal notification (Expo Go limit). |
| **Security** | No login; edge functions deployed with `--no-verify-jwt` for the demo. Before real use: require auth, tighten RLS, rotate keys. |
| **Platforms** | Tested on iPhone (Expo Go) and desktop Chrome. Android not tested. |

---

## 9. For coding agents working on this repo (Expo rules)

This is an Expo/React Native app (Expo SDK 58, Expo Router, routes in `src/app/`). Expo ships breaking
changes every SDK release: before touching an Expo/RN API, read the installed version and the matching docs
(`https://docs.expo.dev/versions/v58.0.0/`, index at `https://docs.expo.dev/llms.txt`).

- Install packages with `npx expo install <package>` (never plain npm add).
- Keep non-route code out of `src/app/`. Use `expo-router` for navigation.
- `ios/` and `android/` are generated; configure native behaviour in `app.json`.
- Expo Go only includes bundled native modules; anything else needs a development build.
- Edge-function code (`supabase/functions/`) runs on Deno; shared logic is plain TypeScript so `node --test` can test it.
- Run `npm test`, `npx tsc --noEmit` and `npx expo lint` before declaring work done.
