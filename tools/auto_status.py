# -*- coding: utf-8 -*-
"""자동화 실패 점검 (2026-11-22) — 사이트 자동화가 11-17부터 6일 동안 매일 실패했는데 아무 알림이 없었다.
이 저장소의 자동화마다 가장 최근에 끝난 실행을 보고, 실패면 며칠째인지 세어 data/auto_status.json 에 적는다.
콘솔(앱스 스크립트)이 아침 8시 넘어 이 파일을 읽어 실패가 있으면 텔레그램으로 알린다.
사용: GH_TOKEN=... python3 tools/auto_status.py [저장소]   (인증은 gh 명령이 맡는다)
"""
import json, os, subprocess, sys, datetime
REPO = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GITHUB_REPOSITORY", "thecloudstay/jipjini-site")
SKIP = ("pages-build-deployment", "pages build and deployment", "자동화 실패 점검")
def gh(path):
    return json.loads(subprocess.run(["gh", "api", path], capture_output=True, text=True, check=True).stdout)
fails = []
for w in gh(f"repos/{REPO}/actions/workflows?per_page=100").get("workflows", []):
    if w.get("state") != "active" or w["name"] in SKIP: continue
    runs = [r for r in gh(f"repos/{REPO}/actions/workflows/{w['id']}/runs?per_page=30&status=completed").get("workflow_runs", []) if r.get("conclusion") in ("success", "failure", "timed_out")]
    if not runs or runs[0]["conclusion"] == "success": continue
    n = 0
    for r in runs:
        if r["conclusion"] == "success": break
        n += 1
    first = runs[n - 1]["created_at"]; last = runs[0]["created_at"]
    if (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(last.replace("Z", "+00:00"))).days > 14: continue   # 오래 안 도는 것은 뺀다
    fails.append({"name": w["name"], "n": n, "since": first[:10], "last": last, "url": runs[0]["html_url"]})
out = {"repo": REPO, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "fails": fails}
if "--print" in sys.argv: print(json.dumps(out, ensure_ascii=False, indent=1))
else:
    json.dump(out, open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "auto_status.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("실패 중인 자동화", len(fails), [f["name"] for f in fails])
