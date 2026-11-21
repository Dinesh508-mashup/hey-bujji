#!/usr/bin/env python3
"""Breathing and chair-stand accuracy against manual counts entered in the app.
Reads events with details.manual_count and writes data/sensor-results.json.
   python3 eval/sensor_accuracy.py
"""
import json, os, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from run_eval import load_env, ROOT  # noqa: E402

load_env()
url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "").rstrip("/")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
fam = os.environ.get("EXPO_PUBLIC_FAMILY_ID", "demo-1")
if not url or not key:
    sys.exit("Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env")
q = f"{url}/rest/v1/events?family_id=eq.{fam}&sample=eq.false&type=in.(breathing,chair_stand)&select=type,details,created_at"
r = urllib.request.Request(q, headers={"authorization": f"Bearer {key}", "apikey": key})
events = json.loads(urllib.request.urlopen(r, timeout=60).read())

def stats(pairs, tol):
    if not pairs:
        return None
    errs = [abs(a - m) for a, m in pairs]
    return {"sessions": len(pairs), "mean_abs_error": round(sum(errs) / len(errs), 2),
            "within_tolerance_pct": round(100 * sum(1 for e in errs if e <= tol) / len(errs), 1), "tolerance": tol,
            "pairs": [{"app": a, "manual": m} for a, m in pairs]}

breath = [(round(e["details"]["bpm"], 1), float(e["details"]["manual_count"])) for e in events
          if e["type"] == "breathing" and e["details"].get("manual_count") is not None and e["details"].get("bpm") is not None]
chair = [(e["details"]["stands"], float(e["details"]["manual_count"])) for e in events
         if e["type"] == "chair_stand" and e["details"].get("manual_count") is not None]
out = {"breathing": stats(breath, 2), "chair_stand": stats(chair, 1)}
(ROOT / "data" / "sensor-results.json").write_text(json.dumps(out, indent=1))
print(json.dumps({k: (v and {kk: vv for kk, vv in v.items() if kk != "pairs"}) for k, v in out.items()}, indent=1))
print("wrote data/sensor-results.json")
