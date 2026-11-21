#!/usr/bin/env python3
"""
Screen-mirror scam test (TESTING ONLY, not part of the app).
Mirror the iPhone to this Mac (QuickTime > New Movie Recording > iPhone, or
AirPlay screen mirroring), then run:

    python3 tools/screen_mirror_check.py --interval 2

Every N seconds it screenshots the screen (macOS `screencapture`), sends it to
the check-message function and prints the verdict. Dummy messages only:
the Gemini free tier may be human-reviewed. Screenshots are deleted right away.

Score the four test cases: fake KYC link and fake parcel fee should warn;
a family message and a real bank balance SMS should stay silent.
"""
import argparse, json, os, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))
from run_eval import load_env, multipart  # noqa: E402

load_env()
ap = argparse.ArgumentParser()
ap.add_argument("--interval", type=float, default=2.0)
ap.add_argument("--region", help="x,y,w,h of the mirrored window (screencapture -R)")
args = ap.parse_args()
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "").rstrip("/") + "/functions/v1/check-message"
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
last = None
print("Watching the screen. Ctrl+C to stop.")
while True:
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        path = tmp.name
    cmd = ["screencapture", "-x", "-t", "jpg"] + (["-R", args.region] if args.region else []) + [path]
    subprocess.run(cmd, check=True)
    data = Path(path).read_bytes()
    os.unlink(path)
    body, ctype = multipart({"lang": "te", "dry_run": "1"}, {"file": ("screen.jpg", data, "image/jpeg")})
    req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": ctype, "authorization": f"Bearer {key}", "apikey": key})
    try:
        res = json.loads(urllib.request.urlopen(req, timeout=60).read())
        line = f"{time.strftime('%H:%M:%S')}  {res['verdict'].upper():10}  {res['reason']}"
        if line[10:] != last:
            print(("\a" if res["verdict"] == "scam" else "") + line)
            last = line[10:]
    except Exception as e:
        print("error:", e)
    time.sleep(args.interval)
