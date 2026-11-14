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
import plan_trace, plan_check, discover, pipeline, answer_key


def version():
    h = hashlib.sha1()
    for p in (os.path.join(TOOLS, "plan_trace.py"), os.path.join(TOOLS, "plan_check.py"), os.path.join(HERE, "pipeline.py"),
              os.path.join(HERE, "discover.py"), os.path.join(HERE, "알려진모양.json")):
        try:
            h.update(open(p, "rb").read())
        except OSError:
            pass
    return h.hexdigest()[:10]


def tool_version():
    """방 읽기 도구(코드/도구 폴더) 지문 — 이것이 그대로면 방을 다시 읽지 않고 저장해 둔 읽기를 쓴다"""
    h = hashlib.sha1()
    for n in TOOL_FILES + (os.path.join("models", "manifest.json"),):
        try:
            h.update(open(os.path.join(TOOL_DIR, n), "rb").read())
        except OSError:
            pass
    return h.hexdigest()[:10]


KEYS = os.path.join(CROLL, "학습", "집지니")     # 2026-11-13 새 정답지(세 의견 합의)
TEACHER = os.path.join(CROLL, "학습", "선생", "floorplan-segformer.onnx")
READ = os.path.join(OUT, "방읽기")      # 키마다 방 읽기 결과(도구 판과 함께) — 2026-11-13: 그리기 도구만 바뀐 회차에 브라우저 읽기(한 장 약 29초)를 되풀이하던 것 없앰


def rj(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


# 선생 모델 실행(plan_score.py 와 같은 것 — 512 화면에 맞춰 넣고 128 칸 분류: 바탕·방·벽·문·창)
TEACH_INIT_JS = r"""async (b64) => { const V = window.JJVendor; if (!V || !V.ort) return '추론 실행기가 아직 없습니다'; const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  window.__teach = await V.ort.InferenceSession.create(u, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }); return 'ok'; }"""
TEACH_JS = r"""async (dataUrl) => { const s = window.__teach, V = window.JJVendor; if (!s) return null; const im = new Image(); im.src = dataUrl; await new Promise(ok => im.onload = ok);
  const S = 512, k = S / Math.max(im.width, im.height), nw = Math.max(1, Math.round(im.width * k)), nh = Math.max(1, Math.round(im.height * k)), ox = (S - nw) >> 1, oy = (S - nh) >> 1;
  const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.drawImage(im, ox, oy, nw, nh);
  const d = g.getImageData(0, 0, S, S).data, N = S * S, x = new Float32Array(3 * N), M = [0.485, 0.456, 0.406], D = [0.229, 0.224, 0.225];
  for (let i = 0; i < N; i++) for (let ch = 0; ch < 3; ch++) x[ch * N + i] = (d[i * 4 + ch] / 255 - M[ch]) / D[ch];
  const f = {}; f[s.inputNames[0]] = new V.ort.Tensor('float32', x, [1, 3, S, S]); const o = (await s.run(f))[s.outputNames[0]], C = o.dims[1], h = o.dims[2], w = o.dims[3], L = o.data, P = h * w, cls = new Uint8Array(P);
  for (let p = 0; p < P; p++) { let b = 0, bv = L[p]; for (let q = 1; q < C; q++) { const v = L[q * P + p]; if (v > bv) { bv = v; b = q; } } cls[p] = b; }
  let t = ''; for (let i = 0; i < P; i++) t += String.fromCharCode(cls[i]);
  return { w: w, h: h, S: S, k: k, ox: ox, oy: oy, classes: ['바탕', '방', '벽', '문', '창'], b64: btoa(t) }; }"""


READ_JS = r"""async (c) => {
  const im = new Image(); im.src = c.dataUrl; await new Promise((ok, no) => { im.onload = ok; im.onerror = no; });
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0);
  let a; try { a = await JJPlanTools.analyze(cv, { areaM2: c.area || 0 }); } catch (e) { a = { ok: false, why: String(e && e.message) }; }
  if (!a || !a.ok) return { ok: false, why: (a && a.why) || '' };
  return { ok: true, W: a.W || im.width, H: a.H || im.height, mmpp: a.mmpp || 0, 척도: a.척도 ? a.척도.방식 || '' : '', 회전: a.회전 || 0,
           rooms: (a.rooms || []).map(r => ({ name: r.name, kind: r.kind, pts: r.pts })) };
}"""


def workers():
    """2026-11-13 대표 「원본 변환 왜 이렇게 느리냐」: 한 장씩 한 줄로만 돌던 것 → 처리기 수에 맞춰 여러 줄로.
       한 줄마다 화면 밖 브라우저 하나(메모리 약 0.3~0.5GB)를 띄우므로 많아야 4줄. 학습·받기가 같이 돌 몫은 남긴다."""
    try:
        v = int(os.environ.get("CROLL_CONVERT_WORKERS") or 0)
        if v > 0: return min(v, 6)
    except ValueError:
        pass
    c = os.cpu_count() or 2
    # 2026-11-14 대표 램 24GB로 교체 후 「램 풀로 돌려줘」: 처리기 3개당 한 줄(4코어 → 2줄)이던 것을
    #   남은 램 2.5GB마다 한 줄, 처리기 수까지(이 컴퓨터: 4줄). 게임을 켜면 아래 game_pause 가 잠깐 쉰다.
    free = 4.0
    try:
        import ctypes
        class M(ctypes.Structure):
            _fields_ = [("l", ctypes.c_ulong), ("load", ctypes.c_ulong), ("tot", ctypes.c_ulonglong), ("free", ctypes.c_ulonglong),
                        ("pt", ctypes.c_ulonglong), ("pf", ctypes.c_ulonglong), ("vt", ctypes.c_ulonglong), ("vf", ctypes.c_ulonglong), ("ve", ctypes.c_ulonglong)]
        m = M(); m.l = ctypes.sizeof(M); ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)); free = m.free / 2**30
    except Exception:
        pass
    return max(2, min(c, int(free // 2.5), 6))


GAMES = ("League of Legends.exe",)   # 2026-11-14 실제 대전 화면만 — 대기실(LeagueClient)은 켜 둔 채 잊기 쉬워 밤새 변환이 9시간 멈췄다


def game_pause(busy=None):
    """리그 오브 레전드가 켜져 있으면 변환을 쉬었다가 끄면 잇는다(2026-11-14 램 교체 때 대표 「롤 할 때도 좋아질까」)."""
    if os.name != "nt": return
    import subprocess
    said = False; t0 = time.time()
    while True:
        try:
            out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, errors="replace").stdout
        except Exception:
            return
        if not any(('"' + g.lower() + '"') in out.lower() for g in GAMES): return
        if time.time() - t0 > 3 * 3600: print("게임이 3시간 넘게 켜져 있어 변환을 다시 이어 갑니다.", flush=True); return
        if not said: print("게임이 켜져 있어 변환을 잠깐 쉽니다(끄면 바로 이어 갑니다).", flush=True); said = True
        if busy: open(busy, "w", encoding="utf-8").write(time.strftime("%Y-%m-%d %H:%M:%S"))
        time.sleep(30)


def shard_file(i):
    return os.path.join(OUT, "상태_조각%d.json" % i)


def merge_shards(st):
    for f in [os.path.join(OUT, x) for x in os.listdir(OUT) if x.startswith("상태_조각") and x.endswith(".json")]:
        st.update(rj(f, {}))
    return st


def low_priority():
    """2026-11-14: 변환이 처리 능력을 꽉 써서 대표 크롬(카카오 파트너센터)이 멈췄다 — 변환 쪽을 「보통 이하」 우선순위로 낮춘다.
    윈도에서는 이 프로세스가 띄우는 조각·크로미움도 같은 우선순위를 물려받는다. 남는 힘은 그대로 다 쓰고, 사람이 쓰는 창이 먼저 돈다."""
    if os.name != "nt":
        return
    try:
        import ctypes
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)   # 보통 이하
    except Exception:
        pass


def main(n=400):
    low_priority()
    os.makedirs(os.path.join(OUT, "도면"), exist_ok=True); os.makedirs(READ, exist_ok=True)
    shard = None
    if "--조각" in sys.argv:   # 여러 줄 가운데 한 줄(자식): 관문·재선별·잠금·보고·합성은 어미가 한다
        a = sys.argv[sys.argv.index("--조각") + 1].split("/"); shard = (int(a[0]), int(a[1]))
    busy = os.path.join(OUT, "변환_돌림.txt")      # 2026-11-13: 손으로 띄운 변환과 통합 실행의 변환이 겹쳐 상태.json 을 서로 덮던 것 막음
    if shard is None and os.path.exists(busy) and time.time() - os.path.getmtime(busy) < 15 * 60:
        print("다른 창에서 일괄 변환이 돌고 있어 이번에는 건너뜁니다.", flush=True); return 0
    if shard is None:
        open(busy, "w", encoding="utf-8").write(time.strftime("%Y-%m-%d %H:%M:%S"))
    if shard is not None:
        return run_items(n, shard, busy)
    return run_items(n, None, busy)


def run_items(n, shard, busy):
    # 2026-11-13 대표 지시 「학습은 컴퓨터판에서」: 그리기 도구가 바뀌었으면 먼저 이 컴퓨터에서 관문(옛 판과 무작위 20장 견줌) → 통과한 판만 남김
    import subprocess
    if shard is None:
        try:
            subprocess.call([sys.executable, "-u", os.path.join(HERE, "pc_gate.py")])
        except Exception as e:
            print("관문을 돌리지 못했습니다:", e, flush=True)
        try:
            rescreen(rj(os.path.join(HERE, "알려진모양.json"), {}))
        except Exception as e:
            print("옛 정답지 재선별을 못 했습니다:", str(e)[:100], flush=True)
    ver = version(); tver = tool_version(); st = merge_shards(rj(os.path.join(OUT, "상태.json"), {}))
    rows = [r for r in csv.DictReader(open(LIST, encoding="utf-8-sig")) if str(r.get("순서")) == "1" and os.path.exists(r.get("파일") or "")]
    todo = [r for r in rows if (st.get("%s_%s" % (r["단지코드"], r["평형"])) or {}).get("판") != ver]
    random.seed(int(time.time())); random.shuffle(todo)
    never = [r for r in todo if "%s_%s" % (r["단지코드"], r["평형"]) not in st]
    # 2026-11-13 대표 제안 「우선 벌크로 싹 다 변환한 다음 클로드가 직접 찾는 방식」:
    #  ① 한 번도 안 바꾼 것 전부 먼저(장수 0 = 끝까지)  ② 판이 바뀌면 떨어진 것(출고보류·예외·오류)만 다시  ③ 이미 통과한 것은 맨 뒤
    #  — 고칠 때마다 8천 장을 처음부터 다시 돌리던 것(70시간 남짓)을 떨어진 것만 다시 돌게
    # 2026-11-13 하네스 약속 1 「손님이 보는 도면이 가장 먼저 최신 판」: 홈페이지에 열린 평형(공개 기준을 넘은 것 + 공개목록.json)을 맨 앞에
    try: pubk = set(json.load(open(os.path.join(OUT, "공개목록.json"), encoding="utf-8")))
    except Exception: pubk = set()
    def _pub(r):
        v = st.get("%s_%s" % (r["단지코드"], r["평형"])) or {}
        return "%s_%s" % (r["단지코드"], r["평형"]) in pubk or (isinstance(v.get("점수"), (int, float)) and v["점수"] >= 85 and v.get("판정") in ("통과", "예외"))
    pub = [r for r in todo if r not in never and _pub(r)]
    fail = [r for r in todo if r not in never and r not in pub and (st.get("%s_%s" % (r["단지코드"], r["평형"])) or {}).get("판정") != "통과"]
    passed = [r for r in todo if r not in never and r not in pub and r not in fail]
    todo = pub + never + fail + passed
    if n > 0: todo = todo[:n]
    kids = []; mine = {}
    if shard is None:
        W = workers()
        if W > 1 and len(todo) > 40:
            for j in range(1, W):
                lf = open(os.path.join(CROLL, "기록", "변환_조각%d_log.txt" % j), "a", encoding="utf-8")
                kids.append(subprocess.Popen([sys.executable, "-u", os.path.abspath(__file__), str(n), "--조각", "%d/%d" % (j, W)], stdout=lf, stderr=subprocess.STDOUT))
            print("=== %d줄로 나눠 동시에 변환합니다 (이 창이 1줄, 나머지는 기록\\변환_조각N_log.txt) ===" % W, flush=True)
            todo = todo[0::W]
    else:
        todo = todo[shard[0]::shard[1]]
    print(f"=== 평면도 일괄 변환 · 판 {ver} · 원본 {len(rows)}장 중 이번 {len(todo)}장 (남은 {len([r for r in rows if (st.get('%s_%s' % (r['단지코드'], r['평형'])) or {}).get('판') != ver])}장) ===", flush=True)
    if not todo:
        try:
            os.remove(busy)
        except OSError:
            pass
        return 0
    from playwright.sync_api import sync_playwright
    known = rj(os.path.join(HERE, "알려진모양.json"), {})
    t0 = time.time(); done = 0
    pw = {"p": None, "b": None, "page": None}
    def page_get():
        if pw["page"]:
            return pw["page"]
        pw["p"] = sync_playwright().start(); pw["b"] = pw["p"].chromium.launch(headless=True); page = pw["b"].new_page(viewport={"width": 1200, "height": 900})
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
        pw["teach"] = False
        if os.path.exists(TEACHER):   # 2026-11-13 세 의견 합의: 선생 모델이 본 벽·문·창을 읽기마다 같이 남긴다(정답지 합의 심판)
            try:
                page.wait_for_function("() => window.JJVendor && window.JJVendor.ort", timeout=60000)
                pw["teach"] = page.evaluate(TEACH_INIT_JS, base64.b64encode(open(TEACHER, "rb").read()).decode()) == "ok"
            except Exception as e:
                print("선생 모델을 못 올렸습니다:", str(e)[:100], flush=True)
        pw["page"] = page; return page
    if True:
        for i, r in enumerate(todo):
            k = "%s_%s" % (r["단지코드"], r["평형"]); f = r["파일"]
            try:
                area = float(r.get("전용면적") or 0)
            except ValueError:
                area = 0
            game_pause(busy if shard is None else None)
            rec = {"판": ver, "때": time.strftime("%Y-%m-%d %H:%M")}
            _t0 = time.time(); _t1 = None   # 2026-11-13 어디서 시간이 드는지 재기(읽기 = 브라우저 방 읽기, 변환 = 파이썬 변환·검수·채점)
            try:
                cf = os.path.join(READ, k + ".json"); c = rj(cf, {})
                if c.get("도구판") == tver and c.get("읽기"):
                    a = c["읽기"]; rec["읽기"] = "저장분"; teach = c.get("선생")
                else:
                    raw = open(f, "rb").read(); mime = "image/png" if f.lower().endswith(".png") else "image/jpeg"
                    a = page_get().evaluate(READ_JS, {"dataUrl": "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode()), "area": area})
                    teach = None
                    if pw.get("teach"):
                        try:
                            teach = page_get().evaluate(TEACH_JS, "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode()))
                        except Exception:
                            teach = None
                    json.dump({"도구판": tver, "때": time.strftime("%Y-%m-%d %H:%M"), "읽기": a, "선생": teach}, open(cf, "w", encoding="utf-8"), ensure_ascii=False)
                _t1 = time.time()
                if not a.get("ok") or not a.get("rooms"):
                    rec.update(판정="예외", 남은규칙="R0 방 못 읽음 " + str(a.get("why", ""))[:40])
                elif a.get("회전"):
                    rec.update(판정="예외", 남은규칙="R0 돌린 그림(%s)" % a["회전"])   # 방 좌표가 돌린 그림 기준이라 원본 위 변환은 다음 판에서
                else:
                    plan = {"W": a["W"], "H": a["H"], "mmpp": a["mmpp"], "rooms": a["rooms"], "전용": area}
                    if not plan["mmpp"] and area:
                        plan_trace.fix_kinds(plan_trace.imread_u(f), plan["rooms"])   # 2026-11-12 방 종류 바로잡기를 축척 계산보다 먼저
                        px = sum(abs(cv2.contourArea(np.array(q["pts"], np.float32))) for q in plan["rooms"] if len(q["pts"]) >= 3 and q.get("kind") not in ("발코니", "공용", "피트"))
                        if px > 0:
                            plan["mmpp"] = (pipeline.AREA_K * area * 1e6 / px) ** 0.5
                    if not plan["mmpp"]:
                        rec.update(판정="예외", 남은규칙="R0 축척 못 읽음")
                    else:
                        res = one(f, k, plan, known, teach)
                        rec.update(res)
                        ok_, why_ = answer_key.passes(rec)
                        if ok_:
                            answer_key.save(KEYS, k, f, plan, res.pop("_G"), rec, teach); rec["정답지"] = True
                        else:
                            res.pop("_G", None); rec["정답지아님"] = why_[:3]
                        rec.pop("_G", None)
            except Exception as e:
                rec.update(판정="오류", 남은규칙=str(e)[:80])
            try: rec["초"] = [round((_t1 or time.time()) - _t0, 1), round(time.time() - (_t1 or time.time()), 1)]
            except Exception: pass
            st[k] = rec; done += 1; mine[k] = rec
            if shard is None: open(busy, "w", encoding="utf-8").write(time.strftime("%Y-%m-%d %H:%M:%S"))
            print(f"[{i + 1}/{len(todo)}] {k} {rec.get('판정')} {rec.get('점수', '')} {rec.get('남은규칙', '')[:50]} · 읽기 {rec.get('초', ['?'])[0]}초 변환 {rec.get('초', ['?', '?'])[1]}초", flush=True)
            if done % 20 == 0:
                if shard is not None:
                    json.dump(mine, open(shard_file(shard[0]), "w", encoding="utf-8"), ensure_ascii=False)
                else:
                    merge_shards(st); json.dump(st, open(os.path.join(OUT, "상태.json"), "w", encoding="utf-8"), ensure_ascii=False)
            if shard is None and done % 200 == 0:   # 끝까지 도는 동안에도 검수표·예외함을 새로 써서 클로드가 중간에 묶음으로 볼 수 있게
                try: report(st, ver, time.time() - t0, done)
                except Exception: pass
    if pw["b"]:
        pw["b"].close(); pw["p"].stop()
    if shard is not None:
        json.dump(mine, open(shard_file(shard[0]), "w", encoding="utf-8"), ensure_ascii=False); return 0
    for kp in kids:   # 나머지 줄이 끝나길 기다리는 동안에도 잠금은 살려 둔다
        while kp.poll() is None:
            open(busy, "w", encoding="utf-8").write(time.strftime("%Y-%m-%d %H:%M:%S")); time.sleep(30)
    merge_shards(st)
    json.dump(st, open(os.path.join(OUT, "상태.json"), "w", encoding="utf-8"), ensure_ascii=False)
    for f in [os.path.join(OUT, x) for x in os.listdir(OUT) if x.startswith("상태_조각") and x.endswith(".json")]:
        try: os.remove(f)
        except OSError: pass
    try:
        os.remove(busy)
    except OSError:
        pass
    report(st, ver, time.time() - t0, done)
    try:   # 합성 정답지: 바꾼 도면을 네이버 양식 그림으로 찍어 학습\합성\ 에 쌓는다(이미 만든 것은 건너뜀)
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "student"))
        import synth; synth.main(3)
    except Exception as e:
        print("합성 정답지 건너뜀:", str(e)[:80], flush=True)
    return 0


def one(f, k, plan, known, teach=None):
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
    elif any(v for r_, v in left.items() if r_ not in pipeline.WARN) or len(new) >= 3 or left["R8"] >= 2:   # 창 없는 방 둘 이상 = 예외(2026-11-13)
        state = "예외"
    else:
        state = "통과"
    sc, miss, extra = pipeline.score(f, q)
    if sc is not None:
        sc = max(0, round(sc - 2 * len(diffs) - pipeline.penalty(chk), 1))
    json.dump(dict(plan, 그림=G), open(os.path.join(OUT, "도면", k + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    try:   # 2026-11-13: 거꾸로 그려 맞추기(rerender — 우리 도면을 네이버 규칙대로 다시 그려 원본과 겹침)를 장마다 같이 잰다. 벽 쪽은 믿을 만하고, 가는 선(창·문) 쪽은 아직 기구·글자가 섞여 참고값
        import rerender
        rr, _ = rerender.compare(img, G, plan["mmpp"]); rr = {a: float(b) for a, b in rr.items()}
    except Exception:
        rr = {}
    try:
        agree = answer_key.agreement(G, plan, teach, discover.struct_mask(G, plan["mmpp"], img.shape[0], img.shape[1]))
    except Exception:
        agree = None
    return {"_G": G, "벽합의": agree, "겹침": rr, "판정": state, "점수": sc, "자동고침": "+".join(fixed), "남은규칙": " ".join("%s%d" % (r_, v) for r_, v in sorted(left.items())),
            "점검": chk, "모양": [[d["표식"], d["x"], d["y"]] for d in new][:20]}


def _has_tess():
    try:
        import pytesseract
        pytesseract.get_tesseract_version(); return True
    except Exception:
        return False


def rescreen(known):
    """옛 정답지(채점 93점, 학습\\네이버) 재선별 — 한 번만(2026-11-13 대표 지적 「93점 정답지도 미숙」). 새 기준을 넘은 것만 학습\\집지니 로 옮겨 적고, 옛 폴더는 그대로 둔다."""
    old = os.path.join(CROLL, "학습", "네이버"); mark = os.path.join(old, "_재선별.txt")
    if not os.path.isdir(old) or os.path.exists(mark):
        return
    area = {}
    for r in csv.DictReader(open(LIST, encoding="utf-8-sig")):
        try: area["%s_%s" % (r["단지코드"], r["평형"])] = float(r.get("전용면적") or 0)
        except ValueError: pass
    ok = bad = 0; why = collections.Counter()
    for n in sorted(os.listdir(old)):
        if not n.endswith(".json") or n.startswith("_"): continue
        k = n[:-5]; f = os.path.join(old, k + ".jpg")
        try:
            d = json.load(open(os.path.join(old, n), encoding="utf-8")); lab = d.get("lab") or {}
            plan = {"W": lab.get("W"), "H": lab.get("H"), "mmpp": 0, "전용": area.get(k, 0),
                    "rooms": [{"name": q.get("n"), "kind": q.get("k"), "pts": q.get("p")} for q in lab.get("rooms") or [] if q.get("p")]}
            if plan["전용"]:
                plan_trace.fix_kinds(plan_trace.imread_u(f), plan["rooms"])
                px = sum(abs(cv2.contourArea(np.array(q["pts"], np.float32))) for q in plan["rooms"] if len(q["pts"]) >= 3 and q.get("kind") not in ("발코니", "공용", "피트"))
                if px > 0: plan["mmpp"] = (pipeline.AREA_K * plan["전용"] * 1e6 / px) ** 0.5
            if not plan["mmpp"]:
                bad += 1; why["축척 없음"] += 1; continue
            res = one(f, k, plan, known, d.get("선생")); G = res.pop("_G")
            good, w = answer_key.passes(res)
            if good: answer_key.save(KEYS, k, f, plan, G, res, d.get("선생"), origin="옛 정답지 재선별"); ok += 1
            else: bad += 1; why[w[0].split(" ")[0]] += 1
        except Exception as e:
            bad += 1; why["오류"] += 1
    line = "%s 옛 정답지 재선별: 남김 %d · 뺌 %d (%s)" % (time.strftime("%Y-%m-%d %H:%M"), ok, bad, ", ".join("%s %d" % kv for kv in why.most_common(6)))
    open(mark, "w", encoding="utf-8").write(line + "\n"); print(line, flush=True)


def report(st, ver, sec, done):
    try:   # 2026-11-13 묶음 경향표(트렌드.txt) — 클로드가 이 파일 하나로 공통 분모를 본다
        import trend; trend.main(os.path.join(OUT, "상태.json"), LIST, os.path.join(OUT, "트렌드.txt"))
    except Exception as e:
        print("경향표 건너뜀:", str(e)[:80], flush=True)
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
         "채점(원본 대조): 평균 %.1f점 · 80점 넘는 장 %d/%d" % (sum(scs) / max(1, len(scs)), sum(1 for s in scs if s >= 80), len(scs)),
         "네이버 규칙으로 다시 그려 겹침: 벽 재현 %s · 벽 정밀 %s · 가는 선 재현 %s(참고값)" % tuple(
             ("%.1f%%" % (100 * sum(v["겹침"][m] for v in cur.values() if (v.get("겹침") or {}).get(m) is not None) / max(1, sum(1 for v in cur.values() if (v.get("겹침") or {}).get(m) is not None)))) for m in ("벽재현", "벽정밀", "선재현")),
         "글자 인식: 방 읽기 단계의 한국어 글자 인식(PaddleOCR) 사용 중" + (" · 테서랙트 보조 있음" if _has_tess() else ""), "", "예외함(평면 수 많은 순)"]
    for e in ex[:15]:
        L.append("  %-30s %4d평면 %5d곳  %s" % (e["유형"][:30], e["평면"], e["곳"], e["설명"][:40]))
    open(os.path.join(OUT, "요약.txt"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("\n".join(L), flush=True)


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 0))
