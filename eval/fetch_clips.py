#!/usr/bin/env python3
"""Download clips recorded in the app (Supabase Storage bucket eval-clips) into eval/clips/.
   python3 eval/fetch_clips.py            # download new clips
   python3 eval/fetch_clips.py --delete   # delete them from storage after the event (privacy rule)
"""
import json, os, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from run_eval import load_env, ROOT  # noqa: E402

load_env()
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "").rstrip("/")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
if not url or not key:
    sys.exit("Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env")
H = {"authorization": f"Bearer {key}", "apikey": key, "content-type": "application/json"}

def req(method, path, body=None):
    r = urllib.request.Request(f"{url}/storage/v1/{path}", data=json.dumps(body).encode() if body is not None else None, method=method, headers=H)
    with urllib.request.urlopen(r, timeout=60) as resp:
        return resp.read()

objs = json.loads(req("POST", "object/list/eval-clips", {"prefix": "", "limit": 1000, "sortBy": {"column": "name", "order": "asc"}}))
names = [o["name"] for o in objs if o.get("id")]
if "--delete" in sys.argv:
    if names:
        req("DELETE", "object/eval-clips", {"prefixes": names})
    print(f"deleted {len(names)} clips from storage")
    sys.exit()
dest = ROOT / "eval" / "clips"
dest.mkdir(exist_ok=True)
new = 0
for n in names:
    f = dest / n
    if f.exists():
        continue
    f.write_bytes(req("GET", f"object/eval-clips/{n}"))
    new += 1
print(f"{len(names)} clips in storage, {new} downloaded to {dest}")
