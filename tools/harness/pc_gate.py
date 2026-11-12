# -*- coding: utf-8 -*-
r"""대표 컴퓨터 관문(2026-11-13 대표 지시 「학습은 컴퓨터판에서」) — 일괄 변환(pc_convert.py)이 회차 처음에 부른다. 클로드 토큰을 쓰지 않는다.

그리기 도구(plan_trace·plan_check·pipeline·discover·알려진모양)가 지난번 남긴 판과 다르면:
  1) 이 컴퓨터가 학습한 방 읽기 도구·선생 모델로 읽어 둔 방(자료\변환\방읽기\)이 있는 평면에서 무작위 20장을 뽑는다(받아 둔 원본)
  2) 남긴 판(tools_남김)과 새 판(tools)으로 같은 방에서 각각 도면을 그린다
  3) 두 도면을 새 판의 검사 규칙 하나로 똑같이 점검하고, 남긴 판의 관문(run.py)으로 판정한다 — 관문 기준은 새 판이 바꿀 수 없다
  4) 통과면 새 판을 남긴 판으로 올리고, 떨어지면 새 판을 남긴 판으로 되돌린다
기록: D:\croll\기록\변환_관문.txt (판마다 한 줄)
  python pc_gate.py [장수=20]
"""
import hashlib, json, os, random, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))                 # ...\변환\tools\harness
TOOLS = os.path.dirname(HERE)                                      # ...\변환\tools
KEEP = os.path.join(os.path.dirname(TOOLS), "tools_남김")           # ...\변환\tools_남김 (같은 모양)
CROLL = os.path.dirname(os.path.dirname(os.path.dirname(TOOLS)))   # D:\croll
OUT = os.path.join(CROLL, "자료", "변환")
LIST = os.path.join(CROLL, "자료", "원본_목록.csv")
LOG = os.path.join(CROLL, "기록", "변환_관문.txt")
GATED = ["plan_trace.py", "plan_check.py", os.path.join("harness", "pipeline.py"), os.path.join("harness", "discover.py"),
         os.path.join("harness", "알려진모양.json")]
RUN_PY = os.path.join("harness", "run.py")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def fp(base):
    h = hashlib.sha1()
    for n in GATED:
        try:
            h.update(open(os.path.join(base, n), "rb").read())
        except OSError:
            pass
    return h.hexdigest()[:10]


def copy(src, dst, names):
    for n in names:
        s, d = os.path.join(src, n), os.path.join(dst, n)
        if os.path.exists(s):
            os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copy2(s, d)


def note(text):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M ") + text + "\n")
    print(text, flush=True)


# 한 판으로 도면을 그리는 작은 일(그 판 폴더를 맨 앞에 두고 따로 돌린다 — 두 판이 섞이지 않게)
DRAW = r'''
import json, sys, copy
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + "/harness")
import plan_trace
jobs = json.load(open(sys.argv[2], encoding="utf-8")); out = {}
for k, (f, plan) in jobs.items():
    p = copy.deepcopy(plan)
    try:
        if not p.get("mmpp") and p.get("전용"):   # 축척을 못 읽은 평면은 일괄 변환과 같은 길로(방 종류 바로잡기 → 전용면적)
            import cv2, numpy as np
            plan_trace.fix_kinds(plan_trace.imread_u(f), p["rooms"])
            px = sum(abs(cv2.contourArea(np.array(q["pts"], np.float32))) for q in p["rooms"] if len(q["pts"]) >= 3 and q.get("kind") not in ("발코니", "공용", "피트"))
            if px > 0: p["mmpp"] = (0.974 * p["전용"] * 1e6 / px) ** 0.5
        G = plan_trace.trace(f, p); G.pop("점검", None); out[k] = {"plan": p, "G": G}
    except Exception as e:
        out[k] = {"오류": str(e)[:120]}
json.dump(out, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False)
'''
CHECK = r'''
import json, sys
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + "/harness")
import plan_trace, plan_check
jobs = json.load(open(sys.argv[2], encoding="utf-8")); drawn = json.load(open(sys.argv[3], encoding="utf-8")); res = {}
for k, d in drawn.items():
    if "오류" in d: res[k] = {"점검": [["오류", d["오류"], 0, 0]], "발견": []}; continue
    img = plan_trace.imread_u(jobs[k][0]); res[k] = {"점검": plan_check.rules(img, dict(d["plan"], 그림=d["G"])), "발견": []}
json.dump(res, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False)
'''


def main(n=20):
    new, old = fp(TOOLS), fp(KEEP)
    if not os.path.isdir(KEEP) or old == fp(os.path.join(tempfile.gettempdir(), "_없음_")):
        copy(TOOLS, KEEP, GATED + [RUN_PY]); note("첫 기준: 지금 판(%s)을 남긴 판으로 둡니다" % new); return 2
    if new == old:
        print("그리기 도구가 남긴 판(%s)과 같아 관문을 건너뜁니다." % new, flush=True); return 2
    import csv
    files, area = {}, {}
    for r in csv.DictReader(open(LIST, encoding="utf-8-sig")):
        if str(r.get("순서")) == "1":
            k = "%s_%s" % (r["단지코드"], r["평형"]); files[k] = r["파일"]
            try: area[k] = float(r.get("전용면적") or 0)
            except ValueError: area[k] = 0
    rd = os.path.join(OUT, "방읽기"); jobs = {}
    keys = [f[:-5] for f in os.listdir(rd) if f.endswith(".json")] if os.path.isdir(rd) else []
    random.seed(int(time.time())); random.shuffle(keys)
    for k in keys:
        try:
            a = json.load(open(os.path.join(rd, k + ".json"), encoding="utf-8")).get("읽기") or {}
        except Exception:
            continue
        f = files.get(k)
        if not (a.get("ok") and a.get("rooms") and (a.get("mmpp") or area.get(k)) and not a.get("회전") and f and os.path.exists(f)):
            continue
        jobs[k] = [f, {"W": a["W"], "H": a["H"], "mmpp": a.get("mmpp") or 0, "rooms": a["rooms"], "전용": area.get(k) or 0}]
        if len(jobs) >= n:
            break
    if len(jobs) < 5:
        print("관문에 쓸 읽어 둔 평면이 %d장뿐이라 이번에는 건너뜁니다(새 판 그대로)." % len(jobs), flush=True); return 2
    tmp = tempfile.mkdtemp(prefix="관문_"); jf = os.path.join(tmp, "jobs.json"); json.dump(jobs, open(jf, "w", encoding="utf-8"), ensure_ascii=False)
    dr, cr = os.path.join(tmp, "draw.py"), os.path.join(tmp, "check.py")
    open(dr, "w", encoding="utf-8").write(DRAW); open(cr, "w", encoding="utf-8").write(CHECK)
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    for tag, base in (("앞", KEEP), ("뒤", TOOLS)):
        subprocess.call([sys.executable, dr, base, jf, os.path.join(tmp, tag + "_그림.json")], env=env)
        subprocess.call([sys.executable, cr, TOOLS, jf, os.path.join(tmp, tag + "_그림.json"), os.path.join(tmp, tag + ".json")], env=env)   # 점검은 새 판 규칙 하나로
    rc = subprocess.call([sys.executable, os.path.join(KEEP, RUN_PY), "관문", os.path.join(tmp, "앞.json"), os.path.join(tmp, "뒤.json")], env=env)   # 관문 기준은 남긴 판의 것
    if rc == 0:
        copy(TOOLS, KEEP, GATED + [RUN_PY]); note("통과 · 표본 %d장 · 판 %s → %s 남김" % (len(jobs), old, new)); return 0
    copy(KEEP, TOOLS, GATED); note("떨어짐 · 표본 %d장 · 판 %s 버리고 %s 로 되돌림" % (len(jobs), new, old)); return 1


if __name__ == "__main__":
    sys.exit(main(*(int(a) for a in sys.argv[1:2])))
