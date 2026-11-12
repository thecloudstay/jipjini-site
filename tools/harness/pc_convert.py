# -*- coding: utf-8 -*-
r"""대표 컴퓨터 일괄 변환(2026-11-12 대표 지시 「내 컴퓨터로 바로 작업해」) — 통합 실행(run_all.py)이 매시간 부른다. 클로드 토큰을 쓰지 않는다.

받은 원본 평면도(D:\croll\자료\원본_목록.csv)를 회차마다 N장씩 집지니 캐드 도면으로 바꾸고 검수·자동 고침·가르기·채점까지 한다.
변환기 판(이 폴더 파일들의 지문)이 바뀌면 이미 바꾼 것도 다시 돌린다(판이 다른 것부터).

  python pc_convert.py [회차당 장수=400]

 1) 방 읽기   누리집 그림 읽기 도구(D:\croll\코드\도구 의 plan_tools.js 등)를 브라우저 없이 화면 밖에서 — 전용면적을 함께 넘겨 축척까지
 2) 변환·검수·자동 고침·가르기·채점   pipeline.py 와 같은 길
결과(이 컴퓨터에만): D:\croll\자료\변환\
  도면\<단지코드>_<평형>.json   집지니 캐드 도면 자료
  검수표.csv                     한 장 한 줄(판정·점수·남은 규칙)
  예외함.json · 요약.txt          클로드가 읽고 배울 것(유형별 묶음, 대표 5곳)
  상태.json                      장마다 어느 판으로 바꿨는지
"""
import csv, hashlib, json, os, sys, time, random, collections, base64

HERE = os.path.dirname(os.path.abspath(__file__))              # D:\croll\코드\변환\tools\harness
TOOLS = os.path.dirname(HERE)                                   # D:\croll\코드\변환\tools
CODE = os.path.dirname(os.path.dirname(TOOLS))                  # D:\croll\코드
CROLL = os.path.dirname(CODE)                                   # D:\croll
DATA = os.path.join(CROLL, "자료")
LIST = os.path.join(DATA, "원본_목록.csv")
OUT = os.path.join(DATA, "변환")
TOOL_DIR = os.path.join(CODE, "도구")
TOOL_FILES = ("plan_auto.js", "plan_tools.js", "plan_style.js")
PAGE = os.environ.get("CROLL_CONVERT_PAGE", "https://jipjini.com/404.html")   # 시험할 때만 바꾼다
sys.path.insert(0, TOOLS); sys.path.insert(0, HERE)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    import cv2, numpy as np
except ImportError:
    import subprocess
    subprocess.call([sys.executable, "-m", "pip", "install", "--user", "-q", "opencv-python-headless", "numpy"])
    import cv2, numpy as np
import plan_trace, plan_check, discover, pipeline


def version():
    h = hashlib.sha1()
    for p in (os.path.join(TOOLS, "plan_trace.py"), os.path.join(TOOLS, "plan_check.py"), os.path.join(HERE, "pipeline.py"),
              os.path.join(HERE, "discover.py"), os.path.join(HERE, "알려진모양.json")):
        try:
            h.update(open(p, "rb").read())
        except OSError:
            pass
    return h.hexdigest()[:10]


def rj(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


READ_JS = r"""async (c) => {
  const im = new Image(); im.src = c.dataUrl; await new Promise((ok, no) => { im.onload = ok; im.onerror = no; });
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0);
  let a; try { a = await JJPlanTools.analyze(cv, { areaM2: c.area || 0 }); } catch (e) { a = { ok: false, why: String(e && e.message) }; }
  if (!a || !a.ok) return { ok: false, why: (a && a.why) || '' };
  return { ok: true, W: a.W || im.width, H: a.H || im.height, mmpp: a.mmpp || 0, 척도: a.척도 ? a.척도.방식 || '' : '', 회전: a.회전 || 0,
           rooms: (a.rooms || []).map(r => ({ name: r.name, kind: r.kind, pts: r.pts })) };
}"""


def main(n=400):
    os.makedirs(os.path.join(OUT, "도면"), exist_ok=True)
    ver = version(); st = rj(os.path.join(OUT, "상태.json"), {})
    rows = [r for r in csv.DictReader(open(LIST, encoding="utf-8-sig")) if str(r.get("순서")) == "1" and os.path.exists(r.get("파일") or "")]
    todo = [r for r in rows if (st.get("%s_%s" % (r["단지코드"], r["평형"])) or {}).get("판") != ver]
    random.seed(int(time.time())); random.shuffle(todo)
    never = [r for r in todo if "%s_%s" % (r["단지코드"], r["평형"]) not in st]
    todo = (never + [r for r in todo if r not in never])[:n]      # 처음 보는 것부터, 그다음 옛 판으로 바꾼 것
    print(f"=== 평면도 일괄 변환 · 판 {ver} · 원본 {len(rows)}장 중 이번 {len(todo)}장 (남은 {len([r for r in rows if (st.get('%s_%s' % (r['단지코드'], r['평형'])) or {}).get('판') != ver])}장) ===", flush=True)
    if not todo:
        return 0
    from playwright.sync_api import sync_playwright
    known = rj(os.path.join(HERE, "알려진모양.json"), {})
    t0 = time.time(); done = 0
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); page = b.new_page(viewport={"width": 1200, "height": 900})
        mdir = os.path.join(TOOL_DIR, "models")
        if os.path.isdir(mdir):
            def give(route):
                path = os.path.join(mdir, os.path.basename(route.request.url.split("/assets/models/")[-1].split("?")[0]))
                route.fulfill(path=path) if os.path.exists(path) else route.fulfill(status=404, body="")
            page.route("**/assets/models/**", give)
        page.goto(PAGE, wait_until="domcontentloaded")
        for name in TOOL_FILES:
            f = os.path.join(TOOL_DIR, name)
            if os.path.exists(f):
                page.add_script_tag(content=open(f, encoding="utf-8").read())
            else:
                page.add_script_tag(url="https://jipjini.com/assets/" + name)
        page.wait_for_function("() => window.JJPlanTools", timeout=60000)
        for i, r in enumerate(todo):
            k = "%s_%s" % (r["단지코드"], r["평형"]); f = r["파일"]
            try:
                area = float(r.get("전용면적") or 0)
            except ValueError:
                area = 0
            rec = {"판": ver, "때": time.strftime("%Y-%m-%d %H:%M")}
            try:
                raw = open(f, "rb").read(); mime = "image/png" if f.lower().endswith(".png") else "image/jpeg"
                a = page.evaluate(READ_JS, {"dataUrl": "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode()), "area": area})
                if not a.get("ok") or not a.get("rooms"):
                    rec.update(판정="예외", 남은규칙="R0 방 못 읽음 " + str(a.get("why", ""))[:40])
                elif a.get("회전"):
                    rec.update(판정="예외", 남은규칙="R0 돌린 그림(%s)" % a["회전"])   # 방 좌표가 돌린 그림 기준이라 원본 위 변환은 다음 판에서
                else:
                    plan = {"W": a["W"], "H": a["H"], "mmpp": a["mmpp"], "rooms": a["rooms"], "전용": area}
                    if not plan["mmpp"] and area:
                        px = sum(abs(cv2.contourArea(np.array(q["pts"], np.float32))) for q in plan["rooms"] if len(q["pts"]) >= 3 and q.get("kind") not in ("발코니", "공용", "피트"))
                        if px > 0:
                            plan["mmpp"] = (pipeline.AREA_K * area * 1e6 / px) ** 0.5
                    if not plan["mmpp"]:
                        rec.update(판정="예외", 남은규칙="R0 축척 못 읽음")
                    else:
                        res = one(f, k, plan, known)
                        rec.update(res)
            except Exception as e:
                rec.update(판정="오류", 남은규칙=str(e)[:80])
            st[k] = rec; done += 1
            print(f"[{i + 1}/{len(todo)}] {k} {rec.get('판정')} {rec.get('점수', '')} {rec.get('남은규칙', '')[:50]}", flush=True)
            if done % 20 == 0:
                json.dump(st, open(os.path.join(OUT, "상태.json"), "w", encoding="utf-8"), ensure_ascii=False)
        b.close()
    json.dump(st, open(os.path.join(OUT, "상태.json"), "w", encoding="utf-8"), ensure_ascii=False)
    report(st, ver, time.time() - t0, done)
    return 0


def one(f, k, plan, known):
    """한 장: 변환 → 검수 → 자동 고침 → 다시 검수 → 가르기 → 채점. 도면 자료는 결과 폴더에."""
    import copy
    img = plan_trace.imread_u(f); G = plan_trace.trace(f, plan); chk = plan_check.rules(img, dict(plan, 그림=G)); fixed = []
    for rule, fn in pipeline.FIXERS:
        if not any(x[0] == rule for x in chk):
            continue
        G2 = fn(copy.deepcopy(G), plan["mmpp"], img); chk2 = plan_check.rules(img, dict(plan, 그림=G2))
        if pipeline.weight(chk2) < pipeline.weight(chk) and not any(sum(1 for x in chk2 if x[0] == s) > sum(1 for x in chk if x[0] == s) for s in pipeline.SAFETY):
            G, chk = G2, chk2; fixed.append(rule)
    G["점검"] = chk; q = dict(plan, 그림=G)
    diffs = [d for d in discover.find(img, q) if d["표식"] not in known or not str(known[d["표식"]]).startswith("무시")]
    new = [d for d in diffs if d["표식"] not in known]
    left = collections.Counter(x[0] for x in chk)
    if any(left[s] for s in pipeline.SAFETY):
        state = "출고보류"
    elif any(v for r_, v in left.items() if r_ not in pipeline.WARN) or len(new) >= 3:
        state = "예외"
    else:
        state = "통과"
    sc, miss, extra = pipeline.score(f, q)
    if sc is not None:
        sc = max(0, round(sc - 2 * len(diffs), 1))
    json.dump(dict(plan, 그림=G), open(os.path.join(OUT, "도면", k + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    return {"판정": state, "점수": sc, "자동고침": "+".join(fixed), "남은규칙": " ".join("%s%d" % (r_, v) for r_, v in sorted(left.items())),
            "점검": chk, "모양": [[d["표식"], d["x"], d["y"]] for d in new][:20]}


def report(st, ver, sec, done):
    cur = {k: v for k, v in st.items() if v.get("판") == ver}
    with open(os.path.join(OUT, "검수표.csv"), "w", encoding="utf-8-sig", newline="") as fo:
        w = csv.writer(fo); w.writerow(["키", "판정", "점수", "자동고침", "남은규칙", "판", "때"])
        for k, v in sorted(st.items()):
            w.writerow([k, v.get("판정"), v.get("점수"), v.get("자동고침", ""), v.get("남은규칙", ""), v.get("판"), v.get("때")])
    box = collections.defaultdict(list)
    for k, v in cur.items():
        for x in v.get("점검") or []:
            if x[0] not in pipeline.WARN:
                box[x[0]].append([k, x[1], x[2], x[3]])
        for s, x, y in v.get("모양") or []:
            box["모양:" + s].append([k, s.split("|")[0], x, y])
        if str(v.get("남은규칙", "")).startswith("R0"):
            box["R0"].append([k, v["남은규칙"], 0, 0])
    ex = []
    for t, items in box.items():
        plans = sorted({a[0] for a in items}); reps = []; seen = set()
        for a in items:
            if a[0] not in seen:
                reps.append(a); seen.add(a[0])
            if len(reps) >= 5:
                break
        if t.startswith("모양:") and (len(items) < 3 or len(plans) < 2):
            continue
        ex.append({"유형": t, "설명": ("변환 앞 단계(방 경계·축척 읽기)에서 막힘" if t == "R0" else plan_check.RULES.get(t, "처음 보는 모양(규칙 없음)")), "곳": len(items), "평면": len(plans), "대표": reps})
    ex.sort(key=lambda e: (-e["평면"], -e["곳"]))
    json.dump({"때": time.strftime("%Y-%m-%d %H:%M"), "판": ver, "예외함": ex}, open(os.path.join(OUT, "예외함.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    c = collections.Counter(v.get("판정") for v in cur.values()); scs = [v["점수"] for v in cur.values() if isinstance(v.get("점수"), (int, float))]
    L = ["평면도 일괄 변환 — %s · 판 %s · 이번 %d장 %.0f초 · 이 판으로 바꾼 것 %d장 / 전체 %d장" % (time.strftime("%Y-%m-%d %H:%M"), ver, done, sec, len(cur), len(st)),
         "판정: " + " · ".join("%s %d" % (k, c[k]) for k in ("통과", "예외", "출고보류", "오류")),
         "채점(원본 대조): 평균 %.1f점 · 80점 넘는 장 %d/%d" % (sum(scs) / max(1, len(scs)), sum(1 for s in scs if s >= 80), len(scs)), "", "예외함(평면 수 많은 순)"]
    for e in ex[:15]:
        L.append("  %-30s %4d평면 %5d곳  %s" % (e["유형"][:30], e["평면"], e["곳"], e["설명"][:40]))
    open(os.path.join(OUT, "요약.txt"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 400))
