# Hey Bujji — setup, launch and test guide (BUJJI.md)

**Hey Bujji** is a voice assistant for elderly parents in India (Telugu, Hindi, English) plus a live
dashboard for their children. The parent just talks ("I took my BP tablet", "Call my son",
"Chest pain", "Book a cab to the hospital"); the family sees everything and stays in control.

The product has **two separate front ends** and one back end. Test each one on its own:

| Part | Who uses it | How to test it | Code |
|---|---|---|---|
| **A. Parent app** ("Amma") | the elderly parent | **phone emulator** (iOS Simulator / Android emulator) or a real phone, in **Expo Go** | `src/app/` (index, intro, parent, health, check, results, breathing, heart, chairstand, memory, checkin, settings, record) |
| **B. Family dashboard** ("Ravi") | the son / daughter | **web browser**, `http://localhost:8081/family` | `src/app/family.tsx`, `src/app/results.tsx`, `src/components/` |
| Back end | both | Supabase (Postgres, Realtime, Storage, Edge Functions) — **or the built-in offline demo mode** | `supabase/`, `src/lib/mockBackend.ts` |
| Evaluation | the team | laptop, Python | `eval/` |

---

## 0. Quick start for reviewers (no accounts, no API keys)

The app has a built-in **offline demo mode**: a demo database seeded with Amma's family, and Bujji's
real understanding rules running locally. Typed requests work end to end.

```bash
git clone https://github.com/Dinesh508-mashup/hey-bujji.git
cd hey-bujji
npm install
cp .env.example .env          # already set to offline demo mode (EXPO_PUBLIC_MOCK=1)
```

### A. Parent app in a phone emulator
```bash
npx expo start --ios          # macOS + Xcode: boots the iOS Simulator and installs Expo Go automatically
# or
npx expo start --android      # with an Android emulator already running (Android Studio)
```
The app opens on **Amma's intro screen** → tap **Get Started**. To talk to Bujji in an emulator, open
**Talk** (orange centre button) → tap the **keyboard** button (bottom left) → either tap one of the
**example buttons** ("I took my BP tablet", "Remind me to take my sugar tablet at 8 pm", "Call my son",
"I have chest pain", "The bank called and asked for my OTP", "I feel dizzy") or type a request and tap **Send**.
Verified in the iOS Simulator (iPhone 17 Pro) in offline mode.

### B. Family dashboard in a browser
```bash
npx expo start --web          # Metro on http://localhost:8081
```
Open **http://localhost:8081/family** (the web root `/` also redirects there).
Tabs: `?tab=dashboard` (Overview), `?tab=insights` (Care tips), `?tab=tasks` (Care plan), `?tab=activity` (Live feed); accuracy page: `/results`.

One `npx expo start` serves both: press **i** (iOS Simulator), **a** (Android) or **w** (web) in its terminal.

**Offline mode notes**
- Each device keeps its **own copy** of the demo data: the emulator and the browser do not sync with each other
  offline. Two **browser tabs** do sync live (e.g. `/family` in two tabs). For live sync between the phone/emulator
  and the dashboard, use the Supabase back end (section 3).
- Spoken requests (microphone) and screenshot scam checks need the real back end; use typed text offline.
- Emulators have no motion sensor, pedometer or real call dialler: health checks show "sensor not available",
  calls/WhatsApp open nothing in a simulator. Use a real phone for those.
- Reset the offline data: Live feed → **Reset demo** (keeps sample rows), or clear the browser's site data.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20+** (tested on 24.11) | includes npm 10+ |
| Expo SDK | **58** | installed by `npm install` (no global CLI needed; use `npx expo`) |
| iOS Simulator | Xcode 16+ (macOS) | for the parent app; Expo Go is installed into the simulator automatically |
| Android emulator | Android Studio, API 34+ | alternative for the parent app |
| Expo Go | for SDK 58 | only for a **real** phone (App Store / Play Store) |
| Browser | Chrome / Safari / Edge | family dashboard |
| Supabase | free project | **only** for the full back end (section 3); CLI via `npx supabase` |
| Python | 3.9+ | only for `eval/` (standard library only) |
| Docker | optional | only for a local Supabase stack (section 3b) |

---

## 2. Environment variables

### 2a. App — `.env` (copy from `.env.example`)

| Variable | Value | Notes |
|---|---|---|
| `EXPO_PUBLIC_MOCK` | `1` = offline demo mode | remove or set `0` to use Supabase |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | offline mode is also used if this is empty or still the placeholder |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | public by design |
| `EXPO_PUBLIC_FAMILY_ID` | `demo-1` | the seeded demo family |

### 2b. Server — `supabase/.env` (copy from `supabase/.env.example`)
Uploaded with `npx supabase secrets set --env-file supabase/.env`. Never commit it (git-ignored).

| Variable | What it powers | Without it |
|---|---|---|
| `OPENAI_API_KEY` | understanding requests (gpt-4.1-mini), scam check text + screenshots, Whisper baseline in the evaluation | typed requests use keyword rules; scam check errors |
| `SARVAM_API_KEY` | speech-to-text for spoken requests (saarika:v2.5), Telugu/Hindi voice (bulbul:v3) | spoken requests fail; typed requests work |
| `GEMINI_API_KEY` | optional: scam check of screen recordings | text/screenshots still use OpenAI |
| optional | `LLM_PROVIDER`, `OPENAI_MODEL`, `GEMINI_MODEL`, `SARVAM_STT_MODEL`, `WHISPER_MODEL`, `SARVAM_TTS_SPEAKER`, `BUJJI_STT_PROVIDER`, `INDIC_ASR_URL` | defaults in code |

Small budget: OpenAI → Settings → Limits (e.g. $5/month). Sarvam is prepaid credits. A full demo costs a few rupees.

---

## 3. Full back end (Supabase) — live sync between phone and dashboard

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --remote                        # tables, realtime, RLS, storage bucket + demo seed data
cp supabase/.env.example supabase/.env               # add keys (or leave empty: keyword-rules mode)
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy bujji check-message tts --no-verify-jwt
```
Then in `.env`: set `EXPO_PUBLIC_MOCK=0`, the real `EXPO_PUBLIC_SUPABASE_URL` and anon key, and start as in section 0
(`npx expo start --tunnel` lets a real phone connect from any network; needs `npx expo login`).

| What | Where |
|---|---|
| Metro dev server | `http://localhost:8081` |
| Family dashboard | `http://localhost:8081/family` |
| Edge functions | `https://<ref>.supabase.co/functions/v1/{bujji,check-message,tts}` |

### 3b. Local Supabase (Docker)
```bash
npx supabase start            # API :54321, DB :54322, Studio :54323
npx supabase db reset         # migrations + seed
npx supabase functions serve --no-verify-jwt --env-file supabase/.env
npx supabase status           # local anon key
```
Use `EXPO_PUBLIC_SUPABASE_URL=http://<laptop-LAN-IP>:54321` so the emulator/phone can reach it.

---

## 4. Test users

There is **no login**: everything belongs to the seeded demo family `demo-1`.

| Role | Name | Opens | Seeded data |
|---|---|---|---|
| Parent | **Amma**, 68, Vijayawada | parent app (emulator / phone) | medicines Amlodipine (BP, 08:00), Metformin (sugar, 08:00 + 20:00); tasks: BP tablet 08:00, evening walk 17:30, breathing check 19:00 |
| Family | **Ravi**, son, Bengaluru | `/family` in a browser | live feed with sample rows, schedule, medication list |
| Contact | **Priya**, daughter | — | placeholder number |

---

## 5. Journeys to try

### A. Parent app (emulator) — type these on **Talk** → keyboard button
1. **Intro → Get Started → Home**: greeting, Bujji mascot, "Today's plan" task cards (Listen / Start / Say it's done).
2. *"I took my BP tablet"* → reply *"Okay Amma, I noted that you took Amlodipine…"*, correction shown (BP tablet → Amlodipine).
3. *"Remind me to take my sugar tablet at 8 pm"* → daily reminder set for 8:00 PM.
4. *"I have chest pain"* / *"Chest lo noppi ga undi"* → full-screen **Call 108?** (tap **I'm okay**).
5. *"Call my son"* / *"Kumar ki call cheyyi"* → opens the dialler (real phone only). *"Video call my son"* → WhatsApp (real phone).
6. *"Order banana and bread"* → **Your cart · Waiting for Ravi to approve** (approval needs the dashboard on the same back end, section 3).
7. *"Book a cab to the hospital"* → ride card: driver, car, plate, ETA, **OTP read aloud**, Uber/Ola/Rapido buttons, **I've reached ✓**.
8. **Scam** tab → paste *"Dear customer your SBI KYC expired, click the link to verify or your account will be blocked"* → **Scam** + 1930 button.
9. **Health** tab → Breathing / Heart rate / Chair stand / Memory guides (sensor checks need a real phone; Memory works anywhere).
10. **Results** tab → accuracy page (shows "Not measured yet" until the evaluation runs).
11. Task alarm: a task whose time has come opens a full-screen alarm that speaks the task → **Stop alarm** / **Stop & say it's done**.

### B. Family dashboard (browser) — `http://localhost:8081/family`
1. **Overview**: header (Amma, live status, alerts bell, day), Breathing rate card with 7-day strip, orange **Today** card,
   **Amma's schedule**, **Medication list**, **Alerts**, **Body health tracking** (tap a **Check** row for today's detail).
2. **Care plan** (`?tab=tasks`): add a task (kind, time, note) → it appears in the schedule; edit / pause / delete.
3. **Care tips** (`?tab=insights`): suggestions from Amma's results and age → **Assign to Amma** adds a task.
4. **Live feed** (`?tab=activity`): every event; **Reset demo** clears test events.
5. **Bujji score**: `/results` accuracy page.
6. **Orders strip** (top of Overview, with the Supabase back end or two offline browser tabs): **Approve / Reject** a cart,
   **Mark delivered**, ride **Mark completed**; closed items show "Completed" for 30 minutes.

### C. Both together (Supabase back end, section 3)
Phone/emulator *"I took my BP tablet"* → dashboard feed + "Taken today ✓" within a second. Dashboard **Care plan** task →
appears on the phone with a countdown → alarm → *"done"* → dashboard "Confirmed by voice". Phone *"Order banana and bread"* →
dashboard **Approve** → phone "Ravi approved" → **Got it ✓** → dashboard "Completed".

---

## 6. Evaluation (measured accuracy)
```bash
python3 eval/make_tts_clips.py      # 80 test clips with macOS voices (or record real voices in the app: Settings → Record test clips)
python3 eval/fetch_clips.py         # only for clips recorded in the app
python3 eval/run_eval.py            # Whisper vs Indian ASR vs Hey Bujji, same audio, same AI prompt (needs the Supabase back end + keys)
python3 eval/sensor_accuracy.py     # breathing / chair-stand counts vs a helper's manual counts
```
Results go to `data/eval-results.json` / `data/sensor-results.json`; the Results pages read only these files.

## 7. Checks
```bash
npm test             # 84 unit tests
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # Expo config check
```

---

## 8. What is simulated, mocked or not finished

| Area | Status |
|---|---|
| Offline demo mode | Local demo data + keyword rules; typed requests only; scam check is a keyword check; no cross-device sync. |
| Food orders | Demo cart; Ravi approves; **nothing is ordered or paid**. Swiggy MCP needs the owner's OAuth login; not connected. |
| Cab booking | **Simulated** driver/plate/ETA/OTP; Uber/Ola/Rapido buttons open the real apps. |
| WhatsApp video call | Opens the chat; WhatsApp has no public "start video call" link. |
| Heart rate | Microphone method with safety gates; validated on synthetic signals only; often finds no beat on real chests. Planned: camera-fingertip method. Wellness, not medical. |
| Breathing / chair stand | Motion maths tested on synthetic signals; real accuracy not yet measured. |
| Accuracy numbers | Not measured yet (pages show dashes). |
| Care tips | Fixed rules; general wellness advice, not a diagnosis. |
| Telugu replies | Understood, but reply language is English/Hindi for the demo. |
| Task alarm | Repeating alarm only while the app is open (Expo Go limit); otherwise a normal notification. |
| Security | No login; functions run with `--no-verify-jwt` for the demo. |
| Platforms | iPhone (Expo Go, iOS Simulator) and desktop browsers tested; Android not tested. |

---

## 9. For coding agents (Expo rules)
Expo SDK 58 + Expo Router (routes in `src/app/`). Before touching an Expo/RN API, read the matching docs
(`https://docs.expo.dev/versions/v58.0.0/`, index `https://docs.expo.dev/llms.txt`). Install packages with
`npx expo install`. `ios/` and `android/` are generated. Expo Go only includes bundled native modules.
Edge-function code runs on Deno; shared logic is plain TypeScript tested with `node --test`.
Run `npm test`, `npx tsc --noEmit`, `npx expo lint` before finishing.
