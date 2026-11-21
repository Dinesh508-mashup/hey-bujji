# Hey Bujji

A voice assistant for elderly parents that understands Telugu, Hindi and Telugu-English, and measures how much better it does than a base speech model on the same recordings.

- **Parent (Amma):** Expo app in Expo Go on the iPhone. Big mic, spoken replies, call family, reminders, red-flag alert with a 108 prompt, scam warnings, "Bujji, check this", breathing / chair-stand / memory checks.
- **Son (Ravi):** the same Expo project on the web (`/family`), with a live feed over Supabase Realtime.
- **Back end:** Supabase edge functions. All API keys stay in Supabase secrets.

## Layout

```
src/app/            index · parent · family (dashboard) · results · check · breathing · chairstand · memory · record
src/lib/            api · audio · speak · sensors · signal (breathing/chair-stand maths) · reminders · supabase
supabase/functions/ bujji (voice → intent → action) · check-message (Gemini scam check) · tts (Sarvam voice)
  _shared/          correct.ts (correction step) · intent.ts (shared LLM prompt) · stt.ts · reply.ts · pipeline.ts
supabase/migrations demo schema + seed (Amma 68 Vijayawada, Ravi, Amlodipine, Metformin, contacts)
eval/               truth.csv (40 sentences + correct JSON) · run_eval.py · fetch_clips.py · sensor_accuracy.py
tools/              screen_mirror_check.py (laptop-only test, not part of the app)
data/               eval-results.json / sensor-results.json, written only by the eval scripts
```

## Setup (about 15 minutes)

1. **Supabase project** (free tier) at supabase.com. Then:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push                                  # schema, realtime, RLS, seed, eval-clips bucket
   cp supabase/.env.example supabase/.env                # add SARVAM_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
   npx supabase secrets set --env-file supabase/.env
   npx supabase functions deploy bujji check-message tts --no-verify-jwt
   ```
   Edit the placeholder phone numbers in `contacts` (Table editor) so "Abbayiki call cheyyi" dials a real phone.
2. **App:**
   ```bash
   cp .env.example .env        # EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (public values)
   npm install
   npx expo start              # scan the QR with the iPhone camera → Expo Go → "Amma (parent)"
   ```
   Press `w` (or open `http://localhost:8081/family` on the laptop) for Ravi's dashboard.
3. **Telugu voice on the iPhone (optional):** Settings → Accessibility → Spoken Content → Voices → Telugu / Hindi. Without one, replies use Sarvam TTS through the `tts` function.

## How a request flows

`audio → speech-to-text → correction step → LLM intent JSON → merge → reply + action + family feed`

- **Baseline:** OpenAI Whisper → the same LLM prompt.
- **Hey Bujji:** Sarvam `saarika` (or a self-hosted IndicConformer via `BUJJI_STT_PROVIDER=indicconformer`) → correction step → the same prompt → high-confidence list matches override the LLM.
- **Correction step** (`supabase/functions/_shared/correct.ts`): transliterates Telugu and Devanagari to one phonetic key, then fuzzy-matches about 50 medicines with brand and spoken variants ("BP tablet" → the parent's BP medicine), contact nicknames (abbayi, babu, beta → Ravi), and times (raatri 8 → 20:00, shaam 7 baje → 19:00, sade aath → 8:30, enimidinnara → 8:30). Red-flag and scam phrases act as a safety net.
- If Gemini is down, the live app falls back to rules so the demo still answers. The evaluation never falls back (`strict=1`).

## Evaluation (the deliverable)

The 40 test sentences in `eval/truth.csv` are in English (presentation audience).

**No recording needed:** `python3 eval/make_tts_clips.py` speaks all 40 sentences with two macOS voices into `eval/clips/` (`s09__tts-grandma.m4a`, ...), then skip to step 3. A run made only from these clips is labelled "computer voices, not real people" on `/results`.

**Real speakers (stronger evidence):**

1. In the app: **Record test clips** → enter speaker tag, tick consent, read the sentences (4–6 speakers, 2+ aged 55 or older, some with TV or kitchen noise). Clips upload as `s09__amma.m4a`.
2. `python3 eval/fetch_clips.py`
3. `python3 eval/run_eval.py` runs every clip through **Whisper**, **Indian ASR only** (ablation) and **Hey Bujji**, then prints the table and writes `eval/out/results.csv` plus `data/eval-results.json`. The `/results` page reads that file.
4. Rebuild or reload the app so `/results` shows the numbers. The page also reports how many clips were rescued only by the list overrides.
5. Sensor accuracy: enter the helper's manual count after each breathing or chair-stand session, then run `python3 eval/sensor_accuracy.py`.

`python3 eval/run_eval.py --text-only` sends the true transcripts as text. It only checks the LLM and correction wiring, never speech recognition, so don't present it as the result.

## Demo script

| # | Say / do | Phone | Dashboard |
|---|---|---|---|
| 1 | "I took my BP tablet" | Amlodipine logged | Amma took Amlodipine (BP) |
| 2 | "Remind me to take my sugar tablet at 8 pm" | Metformin at 8:00 PM, daily notification | reminder line |
| 3 | "Call my son" | "Calling Ravi…" then the dialler | call line |
| 4 | Breathing check | breaths/min + suggestion | breathing line |
| 5 | "I have chest pain" | red full-screen "Call 108?" | **red urgent banner** |
| 6 | "The bank called and asked for my OTP" | "Don't share the OTP!" | amber possible-scam line |

Press **Reset demo** on the dashboard before each run. A "Type instead" box on the parent screen is the fallback if the venue is noisy.

## Tests

```bash
npm test            # correction step, pipeline wiring (stubbed LLM), sensor maths, truth-set coverage
npm run typecheck && npx expo lint
```

## Safety and privacy rules

- Wellness and family-alert assistant, **not a medical device**. Every screen says so. No diagnosis claims, and no accuracy claim until measured.
- Demo only: no sign-in, and the anon key can read and write family `demo-1`. **After the event:** delete the clips (`python3 eval/fetch_clips.py --delete`), then drop or lock the tables and set `verify_jwt = true`.
- Scam checks: use dummy messages (the Gemini free tier may be human-reviewed). Crop out personal numbers. Screenshots are never stored. Hey Bujji never asks for an OTP or PIN. Fraud reports go to 1930 or cybercrime.gov.in.
