"""아관비 입찰 분석 — 승강기 교체 (2026-11-21)
입력: data/acb/bid/*_YYYY.json (tools/acb_bid.py), data/acb/units.json (단지 기본정보)
출력: data/acb/bid/out/ev.json
  기준표: 대당 낙찰가 분포(전체·지역·연식)
  계산: 단지별 승강기 대수 × 대당 가운데값
  신호: 응찰 1~2곳, 같은 업체 묶음 반복, 대당 단가 이탈
  지도: 시·구별 낙찰 업체 몫
  예측: 아직 교체 이력 없는 20년 넘은 단지 중 같은 구·비슷한 연식 단지가 교체한 곳
"""
import json, os, re, glob, statistics as st, collections, itertools, datetime

R = os.path.join(os.path.dirname(__file__), "..")
U = json.load(open(os.path.join(R, "data/acb/units.json"), encoding="utf-8"))
AREA = {"11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주", "30": "대전", "31": "울산", "36": "세종", "41": "경기", "42": "강원", "51": "강원", "43": "충북", "44": "충남", "45": "전북", "52": "전북", "46": "전남", "47": "경북", "48": "경남", "50": "제주"}
NOW = datetime.date.today().year

EV_ON = re.compile(r"(승강기|엘리베이터).*(교체|리모델링)|(교체|리모델링).*(승강기|엘리베이터)")
EV_OFF = re.compile(r"폐자재|매각|고철|로프|벨트|쉬브|시브|부품|도어|인버터|보드|브레이크|모터|베어링|롤러|감리|설계|용역|컨설팅|조명|LED|램프|CCTV|카메라|블랙박스|레일|권상|제어반|조속기|가버너|지적|펌프|분전반|루바|멀티빔|통화|홀|유지|안전장치|안전부품|비상|배터리|도장|바닥|내장|버튼|표시|음성|공기|청정|살균|에어컨|냉방|팬|전원|케이블|배선|와이어")


def load():
    rows = {}
    for f in glob.glob(os.path.join(R, "data/acb/bid/*_20*.json")):
        for r in json.load(open(f, encoding="utf-8")):
            rows[r["bidNum"]] = r
    return list(rows.values())


def is_ev_full(r):
    t = r.get("bidTitle") or ""
    return bool(EV_ON.search(t)) and not EV_OFF.search(t)


def amt(r):
    try:
        return float(r.get("amount") or 0)
    except Exception:
        return 0.0


def q(v, p):
    v = sorted(v)
    if not v: return None
    k = (len(v) - 1) * p
    i = int(k)
    return v[i] + (v[min(i + 1, len(v) - 1)] - v[i]) * (k - i)


def band(y):
    try:
        a = NOW - int(y)
    except Exception:
        return "모름"
    return "20년 미만" if a < 20 else "20~25년" if a < 25 else "25~30년" if a < 30 else "30년 이상"


def main():
    rows = load()
    ev = [r for r in rows if is_ev_full(r)]
    won = [r for r in ev if str(r.get("bidState")) == "5" and amt(r) > 0]
    deals = []
    for r in won:
        u = U.get(r.get("aptCode"), {})
        n = r.get("대수") or 0
        if not n or n > 80 or (u.get("ev") and n > u["ev"] * 1.5):
            n = u.get("ev") or 0
        if not n: continue
        per = amt(r) / n
        if not (2.5e7 <= per <= 1.6e8): continue
        win = [c for c, y in (r.get("응찰") or []) if y == "Y"]
        deals.append({"b": r["bidNum"], "c": r.get("aptCode"), "n": r.get("bidKaptname"), "g": u.get("g", ""), "s": u.get("s") or AREA.get(str(r.get("bidArea")), "기타"),
                      "y": u.get("y", ""), "d": (r.get("bidRegdate") or "")[:10], "대수": n, "금액": int(amt(r)), "대당": int(per),
                      "응찰": len({c for c, _ in (r.get("응찰") or [])}), "낙찰": win[0] if win else "", "제목": r.get("bidTitle")})
    pers = [d["대당"] for d in deals]
    med = q(pers, .5) or 0

    def stat(v):
        return {"건": len(v), "하위25": int(q(v, .25) or 0), "가운데": int(q(v, .5) or 0), "상위25": int(q(v, .75) or 0)} if v else {"건": 0}
    by_s = {k: stat([d["대당"] for d in deals if d["s"] == k]) for k in sorted({d["s"] for d in deals})}
    by_b = {k: stat([d["대당"] for d in deals if band(d["y"]) == k]) for k in ["20년 미만", "20~25년", "25~30년", "30년 이상", "모름"]}

    # 신호: 응찰 업체 묶음 반복, 1~2곳 응찰, 단가 이탈
    sets = collections.Counter()
    for r in ev:
        cs = tuple(sorted({c for c, _ in (r.get("응찰") or []) if c}))
        if len(cs) >= 2: sets[cs] += 1
    sig = []
    for d in deals:
        r = next(x for x in won if x["bidNum"] == d["b"])
        cs = tuple(sorted({c for c, _ in (r.get("응찰") or []) if c}))
        why = []
        if 0 < d["응찰"] <= 2: why.append(f"응찰 {d['응찰']}곳")
        if cs and sets.get(cs, 0) >= 3: why.append(f"같은 업체 묶음 {sets[cs]}번 반복")
        if med and d["대당"] > med * 1.35: why.append(f"대당 단가 가운데값보다 {round((d['대당'] / med - 1) * 100)}% 높음")
        if why: sig.append({**{k: d[k] for k in ("c", "n", "g", "d", "대수", "금액", "대당", "응찰")}, "신호": why})
    fails = collections.Counter(r.get("aptCode") for r in ev if str(r.get("bidState")) == "4")

    # 지도: 시·구별 낙찰 업체 몫
    who = collections.defaultdict(collections.Counter)
    for d in deals:
        if d["낙찰"]: who[f"{d['s']} {d['g']}".strip()][re.sub(r"\(주\)|주식회사|㈜|\s+", "", d["낙찰"])[:20]] += 1
    whomap = {k: v.most_common(5) for k, v in sorted(who.items(), key=lambda x: -sum(x[1].values()))}

    # 예측: 교체 이력 없는 20년+ 단지, 같은 구에서 연식 ±3년 단지가 교체했으면 점수
    done = {d["c"] for d in deals} | {r.get("aptCode") for r in ev}
    near = collections.defaultdict(list)
    for d in deals:
        near[d["g"]].append(int(d["y"]) if str(d["y"]).isdigit() else None)
    fc = []
    for c, u in U.items():
        if c in done or not u.get("ev") or not str(u.get("y", "")).isdigit(): continue
        age = NOW - int(u["y"])
        if age < 18: continue
        peers = [y for y in near.get(u["g"], []) if y and abs(y - int(u["y"])) <= 3]
        score = min(age, 30) / 30 * 60 + min(len(peers), 4) * 10
        fc.append({"c": c, "n": u["n"], "g": u["g"], "s": u["s"], "y": u["y"], "대수": u["ev"], "세대": u["h"],
                   "예상": int(u["ev"] * med) if med else 0, "옆단지교체": len(peers), "점수": round(score)})
    fc.sort(key=lambda x: -x["점수"])

    est = {c: [u["ev"], int(u["ev"] * med)] for c, u in U.items() if u.get("ev") and med}
    out = {"갱신": datetime.date.today().isoformat(), "기간": "2024~2026", "전체 승강기 교체 공고": len(ev), "낙찰": len(won), "단가 계산된 건": len(deals),
           "대당 가운데값": int(med), "기준표": {"전체": stat(pers), "지역": by_s, "연식": by_b},
           "건": sorted(deals, key=lambda d: d["d"], reverse=True), "신호": sig, "유찰 많은 단지": [[c, U.get(c, {}).get("n", ""), k] for c, k in fails.most_common(30) if k >= 2],
           "지도": whomap, "예측": fc[:300]}
    os.makedirs(os.path.join(R, "data/acb/bid/out"), exist_ok=True)
    json.dump(out, open(os.path.join(R, "data/acb/bid/out/ev.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(est, open(os.path.join(R, "data/acb/bid/out/ev_est.json"), "w", encoding="utf-8"), separators=(",", ":"))
    print("승강기 교체 공고", len(ev), "낙찰", len(won), "단가", len(deals), "대당 가운데", int(med), "신호", len(sig), "예측", len(fc))


if __name__ == "__main__":
    main()
