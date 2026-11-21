#!/usr/bin/env python3
"""
Make eval clips without recording: speak every sentence in eval/truth.csv with
macOS text-to-speech voices and save them as eval/clips/<id>__tts-<voice>.m4a.

  python3 eval/make_tts_clips.py                       # default voices
  python3 eval/make_tts_clips.py --voices "Daniel,Flo (English (UK))"

These are synthetic voices, not real speakers. run_eval.py marks a run made only
from tts-* clips as synthetic and the Results page says so. Real recordings
(Settings -> Record test clips) are still the stronger evidence.
macOS only (uses `say`). Standard library only.
"""
import argparse
import csv
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VOICES = ["Grandma (English (US))", "Grandpa (English (UK))"]


def slug(voice):
    return re.sub(r"[^a-z0-9]+", "-", voice.split("(")[0].strip().lower()).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", default=",".join(DEFAULT_VOICES), help="comma-separated `say -v` voice names")
    ap.add_argument("--truth", default=str(ROOT / "eval" / "truth.csv"))
    ap.add_argument("--out", default=str(ROOT / "eval" / "clips"))
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with open(args.truth, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    voices = [v.strip() for v in args.voices.split(",") if v.strip()]
    for v in voices:
        tag = f"tts-{slug(v)}"
        for r in rows:
            path = out / f"{r['sentence_id']}__{tag}.m4a"
            subprocess.run(["say", "-v", v, "-o", str(path), "--file-format=m4af", "--data-format=aac", r["transcript"]], check=True)
        print(f"{tag}: {len(rows)} clips")
    print(f"wrote to {out}")


if __name__ == "__main__":
    main()
