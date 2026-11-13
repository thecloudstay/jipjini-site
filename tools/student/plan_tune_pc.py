# -*- coding: utf-8 -*-
r"""자동 조정기 (2026-11-11 대표 지시: 컴퓨터가 켜져 있는 동안 시험 → 고침 → 반영 → 다시 시험을 스스로 되풀이).

도구(plan_tools.js) 안의 기준 숫자(벽으로 보는 어둡기, 욕실·현관으로 보는 크기, 분석 해상도 등)를 하나씩 조금 바꿔
무작위 5장을 「지금 값」과 「바꾼 값」으로 나란히 채점한다. 10장 이상에서 평균 0.5점 넘게 오르고 오른 그림이
내린 그림의 1.5배 이상이면 그 값을 반영(도구\tune.json)하고, 아니면 버린다. 사람이나 클로드가 없어도 돈다.
새 규칙·새 모델 같은 큰 고침은 여전히 후보 도구(도구_후보)로 들어와 빠른 판(plan_quick.py)이 시험한다.

결과:  D:\croll\기록\채점\조정.txt (표) · 조정.json (기록)
  python plan_tune.py        한 번에 조정값 2개까지 시험"""
import json, os, random, sys, time
import plan_score as ps
import plan_quick as pq

LOG = os.path.join(ps.OUT_DIR, "조정.json")
TXT = os.path.join(ps.OUT_DIR, "조정.txt")
# 이름: (기본값, 아래 끝, 위 끝, 한 걸음, 설명)
PARAMS = {
    "res":       (640, 480, 960, 80,   "분석 해상도"),
    "wallDark":  (96, 70, 130, 8,      "벽으로 보는 어둡기"),
    "wallSat":   (60, 40, 90, 10,      "벽으로 보는 무채색 폭"),
    "rectFill":  (0.84, 0.70, 0.95, 0.03, "네모로 완성하는 기준"),
    "bathMin":   (0.30, 0.15, 0.60, 0.05, "묻힌 욕실 최소 넓이"),
    "bathSide":  (0.80, 0.50, 1.10, 0.10, "묻힌 욕실 최소 변"),
    "bathMax":   (12, 8, 16, 1,        "묻힌 욕실 최대 넓이"),
    "hallWin":   (0.30, 0.20, 0.45, 0.05, "현관 바둑판 살피는 창"),
    "hallLo":    (0.25, 0.15, 0.35, 0.03, "현관 바둑판 회색 비율"),
    "hallSum":   (0.80, 0.70, 0.90, 0.03, "현관 바둑판 무채색 합"),
    "hallMin":   (0.35, 0.20, 0.60, 0.05, "현관 최소 넓이"),
    "hallMax":   (9, 6, 14, 1,         "현관 최대 넓이"),
    "doorReach": (0.9, 0.5, 1.4, 0.1,  "문 틈 막기: 벽 찾는 거리"),
    "doorLen":   (1.6, 1.2, 2.2, 0.1,  "문 틈 막기: 줄 최대 길이"),
}
K, MIN_N, MAX_N, PER_RUN = 5, 10, 15, 2
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def has_tv():
    try:
        with open(os.path.join(ps.TOOL_DIR, "plan_tools.js"), "r", encoding="utf-8") as f:
            return "function tv(" in f.read()
    except Exception:
        return False


def pick(cur, log):
    """다음에 시험할 (이름, 새 값). 덜 시험한 것부터, 지난번에 오른 방향은 한 번 더."""
    tried = {}
    for t in log.get("시험", []):
        tried.setdefault(t["이름"], []).append(t)
    names = sorted(PARAMS, key=lambda n: (len(tried.get(n, [])), random.random()))
    for n in names:
        d, lo, hi, step, _ = PARAMS[n]
        now = cur.get(n, d)
        last = tried.get(n, [])[-1:] or [None]
        sign = random.choice((1, -1))
        if last[0]:
            went = 1 if last[0]["새값"] > last[0]["앞값"] else -1
            sign = went if last[0].get("판정") == "반영" else -went
        for sg in (sign, -sign):
            v = round(now + sg * step, 4)
            if lo <= v <= hi and not any(abs(t["앞값"] - now) < 1e-9 and abs(t["새값"] - v) < 1e-9 for t in tried.get(n, [])):
                return n, now, (int(v) if float(v).is_integer() else v)
    return None, None, None


def report(log, cur):
    L = [f"도면 인식 — 자동 조정   ({time.strftime('%Y-%m-%d %H:%M')})", "",
         "도구 안의 기준 숫자를 하나씩 바꿔 무작위 5장씩 나란히 채점한 기록입니다. 오른 것만 반영합니다.", "",
         "지금 반영된 조정값: " + (", ".join(f"{PARAMS[k][4] if k in PARAMS else k} {v}" for k, v in cur.items()) or "없음(기본값 그대로)"), "",
         "  때            조정값                      앞 → 뒤       짝   평균 차이   오름/내림   판정"]
    tot = 0.0
    for t in log.get("시험", [])[-40:]:
        if t.get("판정") == "반영":
            tot += t.get("차이", 0)
        L.append(f"  {t['때']}  {PARAMS[t['이름']][4][:20]:<22}  {t['앞값']} → {t['새값']:<8} {t.get('짝', 0):>3}   {t.get('차이', 0):+5.1f}      {t.get('오름', 0)}/{t.get('내림', 0)}       {t.get('판정', '')}")
    L += ["", f"반영된 조정의 오름 합계: {sum(t.get('차이', 0) for t in log.get('시험', []) if t.get('판정') == '반영'):+.1f}점 (시험마다 그림이 달라 어림입니다)"]
    with open(TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    return L


def main():
    # 2026-11-13: 시험할 값이 없으면 놀지 말고 합성 정답지·자체 모델 학습으로 (plan_learn.idle)
    try:
        import importlib, plan_learn as pl
        importlib.reload(pl)
        if not getattr(pl, "_IN_LOOP", False):
            pl.prep()
        if not pl.tune_left():
            return pl.idle()
    except Exception as e:
        import traceback
        print("이어 할 일 넘기기 실패:", str(e)[:120], flush=True)
        try:
            with open(os.path.join(ps.OUT_DIR, "이어돌리기.txt"), "a", encoding="utf-8") as f:
                f.write(time.strftime("%Y-%m-%d %H:%M ") + "넘기기 실패: " + traceback.format_exc()[-600:].replace("\n", " / ") + "\n")
        except Exception:
            pass
    if pq.busy():
        print("빠른 판이 돌고 있어 조정은 건너뜁니다.")
        return 0
    if not has_tv():
        print("지금 도구에는 조정값 자리가 없습니다(후보 도구가 반영된 뒤부터 조정합니다).")
        return 0
    os.makedirs(ps.OUT_DIR, exist_ok=True)
    with open(pq.RUNNING, "w", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S"))
    try:
        return _main()
    finally:
        try:
            os.remove(pq.RUNNING)
        except Exception:
            pass


def _main():
    log = ps.read_json(LOG, {}) or {}
    log.setdefault("시험", [])
    cur = ps.tune_now()
    pool = ps.targets({}, True)
    if len(pool) < K * 2:
        print("모아 둔 평면도가 모자라 건너뜁니다.")
        return 0
    lv = ps.level_now()
    L = ps.LEVELS[lv - 1]
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for _ in range(PER_RUN):
            name, now, val = pick(cur, log)
            if not name:
                print("시험할 조정값이 더 없습니다.")
                break
            trial = dict(cur)
            trial[name] = val
            print(f"=== 조정 「{PARAMS[name][4]}」 {now} → {val}")
            try:
                A, B = pq.open_page(browser, ps.TOOL_DIR, cur), pq.open_page(browser, ps.TOOL_DIR, trial)
            except Exception as e:
                print("   화면을 열지 못했습니다: " + str(e)[:160])
                break
            pairs, errs = [], 0
            while len(pairs) < MAX_N and errs < 3:
                for c in pq.sample(pool, K, {x["key"] for x in pairs}):
                    try:
                        data, _raw = pq.get_image(c)
                        arg = {"dataUrl": data, "area": c["area"], "truth": c["truth"], "lv": L}
                        ra, rb = A.evaluate(ps.RUN_JS, arg), B.evaluate(ps.RUN_JS, arg)
                        pq.touch()
                        pairs.append({"key": c["key"], "앞": ra["score"], "뒤": rb["score"]})
                        print(f"   {c['key']:<22} {ra['score']:>3} → {rb['score']:>3}  ({rb['score'] - ra['score']:+d})")
                    except Exception as e:
                        errs += 1
                        print(f"   {c['key']} 건너뜀: {str(e)[:120]}")
                d = [x["뒤"] - x["앞"] for x in pairs]
                n = len(d)
                mean = sum(d) / n if n else 0
                up, down = sum(1 for x in d if x > 0), sum(1 for x in d if x < 0)
                v = ""
                if n >= MIN_N and mean >= 0.5 and up >= 3 and up >= down * 1.5:
                    v = "반영"
                elif n >= MIN_N and (mean <= 0 or (up + down) == 0):
                    v = "버림" if (up + down) else "영향 없음"
                elif n >= MAX_N:
                    v = "효과 없음"
                elif n >= K and (up + down) == 0 and n >= MIN_N:
                    v = "영향 없음"
                if v:
                    break
            for pg in (A, B):
                try:
                    pg.close()
                except Exception:
                    pass
            if not pairs:
                break
            v = v or "효과 없음"
            log["시험"].append({"때": time.strftime("%m-%d %H:%M"), "이름": name, "앞값": now, "새값": val, "짝": len(pairs), "차이": round(mean, 2), "오름": up, "내림": down, "판정": v, "채점단계": lv})
            print(f"   짝 {len(pairs)} · 평균 차이 {mean:+.1f}점 · 오름 {up} 내림 {down} → {v}")
            if v == "반영":
                cur = trial
                with open(ps.TUNE_FILE, "w", encoding="utf-8") as f:
                    json.dump(cur, f, ensure_ascii=False, indent=1)
            with open(LOG, "w", encoding="utf-8") as f:
                json.dump(log, f, ensure_ascii=False, indent=1)
        browser.close()
    for line in report(log, cur):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
