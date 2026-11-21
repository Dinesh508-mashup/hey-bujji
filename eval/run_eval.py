#!/usr/bin/env python3
"""
Baseline vs Hey Bujji on the same recordings.

  python3 eval/run_eval.py                  # all clips in eval/clips, all pipelines
  python3 eval/run_eval.py --text-only      # sanity run on the true transcripts (no speech model!)
  python3 eval/run_eval.py --export-sentences   # write data/eval-sentences.json for the recorder screen

Clips are named <sentence_id>__<speaker>.m4a (e.g. s09__amma.m4a); the
recorder screen in the app uploads them in that format and
eval/fetch_clips.py downloads them.

Pipelines (same audio, same LLM prompt; only speech model + correction differ):
  baseline   OpenAI Whisper -> LLM
  indic_raw  Sarvam / IndicConformer -> LLM            (ablation)
  bujji      Sarvam / IndicConformer -> correction -> LLM

Needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (read from .env).
Standard library only.
"""
import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ["intent", "medicine", "time", "contact", "urgency"]
PIPELINES = ["baseline", "indic_raw", "bujji"]
LABELS = {"baseline": "Whisper", "indic_raw": "Indian ASR only", "bujji": "Hey Bujji"}


def load_env():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


def load_truth(path):
    with open(path, newline="", encoding="utf-8") as f:
        return {r["sentence_id"]: r for r in csv.DictReader(f)}


def multipart(fields, files):
    boundary = uuid.uuid4().hex
    body = bytearray()
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for k, (name, data, ctype) in files.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"; filename=\"{name}\"\r\nContent-Type: {ctype}\r\n\r\n".encode()
        body += data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def call(url, key, fields, files=None, retries=5):
    if files:
        body, ctype = multipart(fields, files)
    else:
        body, ctype = json.dumps(fields).encode(), "application/json"
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "content-type": ctype, "authorization": f"Bearer {key}", "apikey": key})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            transient = e.code in (429, 502, 503, 504) or any(x in msg for x in ("429", "RESOURCE_EXHAUSTED", "quota", "503", "overloaded"))
            if attempt < retries - 1 and transient:
                wait = 5 * (attempt + 1)
                print(f"    retry in {wait}s ({e.code}: {msg[:80]})", file=sys.stderr)
                time.sleep(wait)
                continue
            return {"error": f"{e.code}: {msg}"}
        except Exception as e:  # network
            if attempt < retries - 1:
                time.sleep(3)
                continue
            return {"error": str(e)}
    return {"error": "retries exhausted"}


def norm(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("", "null", "none") else s.lower()


def score(pred, truth):
    """Per-field correctness. Fields that don't apply to the true intent must be empty in both."""
    out = {f: norm(pred.get(f)) == norm(truth[f]) for f in FIELDS}
    out["task"] = all(out[f] for f in FIELDS)
    return out


def summarise(rows):
    """rows: list of dicts with pipeline, truth, ok, cer."""
    summary = {}
    for p in PIPELINES:
        rs = [r for r in rows if r["pipeline"] == p and "error" not in r]
        if not rs:
            continue
        def rate(field, only=None):
            sel = [r for r in rs if (only is None or norm(r["truth"][only]))]
            if not sel:
                return None
            return round(100 * sum(1 for r in sel if r["ok"][field]) / len(sel), 1)
        cers = [r["cer"] for r in rs if r.get("cer") is not None]
        summary[p] = {
            "label": LABELS[p],
            "n": len(rs),
            "errors": sum(1 for r in rows if r["pipeline"] == p and "error" in r),
            "task_success": rate("task"),
            "intent_accuracy": rate("intent"),
            "medicine": rate("medicine", only="medicine"),
            "time": rate("time", only="time"),
            "contact": rate("contact", only="contact"),
            "cer": round(sum(cers) / len(cers), 3) if cers else None,
            "llm_only_task_success": (round(100 * sum(1 for r in rs if r.get("llm_ok")) / len(rs), 1) if p == "bujji" else None),
            "overridden": sum(1 for r in rs if r.get("overrides")) if p == "bujji" else None,
            "saved_by_overrides": sum(1 for r in rs if r["ok"]["task"] and not r.get("llm_ok")) if p == "bujji" else None,
        }
    return summary


def main():
    load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--clips", default=str(ROOT / "eval" / "clips"))
    ap.add_argument("--truth", default=str(ROOT / "eval" / "truth.csv"))
    ap.add_argument("--pipelines", default=",".join(PIPELINES))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--sleep", type=float, default=1.0, help="pause between calls (Gemini free tier is rate-limited)")
    ap.add_argument("--text-only", action="store_true", help="send true transcripts as text: checks LLM + correction only")
    ap.add_argument("--export-sentences", action="store_true")
    args = ap.parse_args()

    truth = load_truth(args.truth)

    if args.export_sentences:
        out = ROOT / "data" / "eval-sentences.json"
        out.write_text(json.dumps([{"id": k, "text": v["transcript"], "intent": v["intent"]} for k, v in truth.items()], ensure_ascii=False, indent=1))
        print(f"wrote {out}")
        return

    url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
    if not url or not key:
        sys.exit("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (in .env)")
    endpoint = f"{url}/functions/v1/bujji"
    pipelines = [p for p in args.pipelines.split(",") if p in PIPELINES]

    if args.text_only:
        items = [(sid, None, "truth-text") for sid in truth]
        pipelines = [p for p in pipelines if p != "indic_raw"]
    else:
        items = []
        for f in sorted(Path(args.clips).iterdir()):
            m = re.match(r"^(s\d+)__(.+)\.(m4a|wav|mp3|webm|ogg|aac|mp4)$", f.name, re.I)
            if m and m.group(1) in truth:
                items.append((m.group(1), f, m.group(2)))
        if not items:
            sys.exit(f"No clips like s01__amma.m4a in {args.clips}. Record them in the app (Record test clips) and run eval/fetch_clips.py.")
    if args.limit:
        items = items[: args.limit]

    print(f"{len(items)} items x {len(pipelines)} pipelines -> {endpoint}")
    rows = []
    for sid, path, speaker in items:
        t = truth[sid]
        for p in pipelines:
            fields = {"pipeline": p, "dry_run": "1", "strict": "1", "reference": t["transcript"]}
            if path:
                ext = path.suffix.lower().lstrip(".")
                ctype = {"m4a": "audio/m4a", "wav": "audio/wav", "mp3": "audio/mpeg", "webm": "audio/webm", "ogg": "audio/ogg", "aac": "audio/aac", "mp4": "audio/mp4"}[ext]
                res = call(endpoint, key, fields, {"audio": (path.name, path.read_bytes(), ctype)})
            else:
                res = call(endpoint, key, {**fields, "text": t["transcript"], "dry_run": True, "strict": True})
            row = {"sentence_id": sid, "speaker": speaker, "clip": path.name if path else "", "pipeline": p, "truth": t}
            if "error" in res:
                row["error"] = res["error"]
                print(f"  {sid} {speaker:10} {p:9} ERROR {res['error'][:100]}")
            else:
                pred = res["intent"]
                row.update({
                    "transcript": res.get("transcript", ""),
                    "corrected": res.get("corrected"),
                    "pred": pred,
                    "ok": score(pred, t),
                    "cer": res.get("cer"),
                    "overrides": res.get("overrides", []),
                    "fixes": (res.get("correction") or {}).get("fixes", []),
                    "provider": (res.get("stt") or {}).get("provider", "text"),
                })
                row["ok_field"] = row["ok"]["task"]
                if p == "bujji" and res.get("llm"):
                    row["llm_ok"] = score(res["llm"], t)["task"]
                mark = "✓" if row["ok"]["task"] else "✗"
                print(f"  {sid} {speaker:10} {p:9} {mark} {row['transcript'][:60]!r}")
            rows.append(row)
            time.sleep(args.sleep)

    summary = summarise(rows)

    # Examples: baseline failed, Hey Bujji succeeded, on the same clip
    by_clip = {}
    for r in rows:
        by_clip.setdefault((r["sentence_id"], r["speaker"]), {})[r["pipeline"]] = r
    examples, seen_intents = [], set()
    for (sid, spk), d in by_clip.items():
        b, h = d.get("baseline"), d.get("bujji")
        if b and h and "error" not in b and "error" not in h and not b["ok"]["task"] and h["ok"]["task"]:
            intent = h["truth"]["intent"]
            if intent in seen_intents and len(examples) < 3:
                continue
            seen_intents.add(intent)
            examples.append({
                "sentence_id": sid, "speaker": spk, "truth": h["truth"]["transcript"],
                "truth_json": {f: h["truth"][f] or None for f in FIELDS},
                "baseline_transcript": b["transcript"], "baseline_json": {f: b["pred"].get(f) for f in FIELDS},
                "bujji_transcript": h["transcript"], "bujji_json": {f: h["pred"].get(f) for f in FIELDS},
                "fixes": h["fixes"], "overrides": h["overrides"],
            })
        if len(examples) >= 6:
            break
    failures = [
        {"sentence_id": r["sentence_id"], "speaker": r["speaker"], "truth": r["truth"]["transcript"], "heard": r["transcript"],
         "pred": {f: r["pred"].get(f) for f in FIELDS}, "wrong": [f for f in FIELDS if not r["ok"][f]]}
        for r in rows if r["pipeline"] == "bujji" and "error" not in r and not r["ok"]["task"]
    ]

    out_dir = ROOT / "eval" / "out"
    out_dir.mkdir(exist_ok=True)
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(out_dir / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["sentence_id", "speaker", "pipeline", "task_ok", *[f"{x}_ok" for x in FIELDS], "cer", "transcript", "pred_json", "overrides", "error"])
        for r in rows:
            ok = r.get("ok", {})
            w.writerow([r["sentence_id"], r["speaker"], r["pipeline"], ok.get("task"), *[ok.get(x) for x in FIELDS], r.get("cer"),
                        r.get("transcript", ""), json.dumps(r.get("pred"), ensure_ascii=False), "; ".join(r.get("overrides", [])), r.get("error", "")])
    result = {
        "status": "text_only" if args.text_only else "measured",
        "run_at": stamp,
        "clips": len(items),
        "speakers": sorted({s for _, _, s in items}),
        "pipelines": summary,
        "examples": examples[:3],
        "bujji_failures": failures[:10],
        "note": ("Text-only sanity run on the true transcripts: no speech recognition involved. Do not present as the evaluation."
                 if args.text_only else "Same audio and same LLM prompt for every pipeline; only the speech model and the correction step differ."),
    }
    (out_dir / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
    if not args.text_only:
        (ROOT / "data" / "eval-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))

    print("\n" + "metric".ljust(22) + "".join(LABELS[p].rjust(18) for p in summary))
    for k, label in [("task_success", "Task success %"), ("intent_accuracy", "Intent %"), ("medicine", "Medicine %"),
                     ("time", "Time %"), ("contact", "Contact %"), ("cer", "CER")]:
        print(label.ljust(22) + "".join(str(summary[p][k]).rjust(18) for p in summary))
    if "bujji" in summary:
        b = summary["bujji"]
        print(f"\nHey Bujji: {b['saved_by_overrides']} clips correct only because of list overrides "
              f"(LLM-only task success {b['llm_only_task_success']}%).")
    print(f"\nwrote {out_dir / 'results.csv'} and summary.json" + ("" if args.text_only else " + data/eval-results.json"))


if __name__ == "__main__":
    main()
