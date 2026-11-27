"""집지니 마케팅 팀 ① 소재 찾기 (2026-11-28 대표 「마케팅 자동화 팀 — 100% 자동, 자극적·누구나 눌러볼 만하게, 초간단」)
우리만 가진 자료에서 「눌러 볼 만한 숫자」를 뽑는다. 글쓴이·검수는 여기 숫자만 쓴다(지어낸 숫자 금지).
→ mk/facts.json : [{id, 주제, 한줄, 숫자:{...}, 링크}]"""
import json, glob, os, statistics, datetime, re, collections
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
J = lambda *p: json.load(open(os.path.join(ROOT, *p), encoding="utf-8"))
Y = datetime.date.today().year
F = []

def add(id_, 주제, 한줄, 숫자, 링크):
    F.append({"id": id_, "주제": 주제, "한줄": 한줄, "숫자": 숫자, "링크": 링크})

# 1) 공사비 — 집지니 실견적 기준 vs 턴키 추정
c = J("data", "apt-costs.json")["목록"]
by = collections.defaultdict(list)
for r in c:
    try:
        if 82 <= float(r["전용"]) <= 86: by["84"].append(r)
        elif 58 <= float(r["전용"]) <= 61: by["59"].append(r)
    except Exception: pass
for k, L in by.items():
    if len(L) < 30: continue
    base = statistics.median(x["올수리기본"] for x in L); tk = statistics.median(x["턴키추정"] for x in L)
    sv = tk - base
    add(f"cost{k}", "공사비", f"{k}㎡ 올수리, 턴키 추정보다 가운데값 {round(sv/1e4):,}만 원 덜", {
        "평형": f"{k}㎡", "단지수": len({x['url'].split('/')[4] for x in L}), "집지니_가운데값_만원": round(base / 1e4), "턴키추정_가운데값_만원": round(tk / 1e4),
        "차이_만원": round(sv / 1e4), "차이_퍼센트": round(sv / tk * 100)}, "https://jipjini.com/apt/")

# 2) 관리비 — 비슷한 10곳보다 많이 내는 단지 비율, 항목별 최대 차이
rows = []
for f in glob.glob(os.path.join(ROOT, "data", "acb", "*_*.json")):
    if "api_sample" in f: continue
    try: d = json.load(open(f, encoding="utf-8"))
    except Exception: continue
    if isinstance(d, list): rows += [x for x in d if isinstance(x, dict) and x.get("ix")]
if rows:
    hi = [x for x in rows if x["ix"] >= 115]
    add("fee_hi", "관리비", f"수도권 {len(rows):,}단지 중 {len(hi):,}곳은 비슷한 10곳보다 관리비 15% 넘게 더", {
        "단지수": len(rows), "15퍼센트넘게더": len(hi), "비율_퍼센트": round(len(hi) / len(rows) * 100)}, "https://jipjini.com/acb/")
    top = max(rows, key=lambda x: x["ix"])
    gaps = collections.Counter()
    for x in rows:
        b, pb = x.get("b") or {}, x.get("pb") or {}
        for k2, v in b.items():
            if pb.get(k2) and v > pb[k2] * 1.3: gaps[k2] += 1
    if gaps:
        k2, n2 = gaps.most_common(1)[0]
        add("fee_item", "관리비", f"관리비가 새는 1위 항목은 「{k2}」 — {n2:,}단지가 비슷한 곳보다 30% 넘게 더", {"항목": k2, "단지수": n2, "전체": len(rows)}, "https://jipjini.com/acb/")

# 3) 누수 위험
try:
    L = J("data", "acb", "leak.json"); st = L["통계"]; me = L["단지"]
    yrs = {x["c"]: x.get("y") for x in rows if x.get("y")}
    over = sum(1 for c_, y in yrs.items() if Y - int(y) >= st["roof"]["q3"] and "roof" not in me.get(c_, {}))
    add("leak_roof", "누수", f"옥상 방수 할 때 지났는데 3년간 공사 기록 없는 단지 {over:,}곳", {
        "단지수": over, "보통_준공후_년": st["roof"]["med"], "늦어도_년": st["roof"]["q3"], "전체": len(yrs)}, "https://jipjini.com/apt/")
    add("leak_pipe", "누수", f"배관 교체는 준공 {st['pipe']['med']}년째쯤 — 아래층 천장이 먼저 압니다", {"보통_준공후_년": st["pipe"]["med"], "범위": f"{st['pipe']['q1']}~{st['pipe']['q3']}년"}, "https://jipjini.com/apt/")
except Exception as e:
    print("누수 자료 건너뜀", e)

# 4) 지원금
S = J("data", "apt", "support.json")["사업"]
jan = [p for p in S if 1 in p.get("월", []) and len(p.get("월", [])) < 12]
mx = max((int(m) for p in S for m in re.findall(r"(\d+)%", p.get("비율", ""))), default=0)
add("support", "지원금", f"아파트 지원금 최대 {mx}% — {len(jan)}개 사업이 1월에 엽니다", {"사업수": len(S), "1월접수": len(jan), "최대_퍼센트": mx}, "https://jipjini.com/support/")

# 5) 견적 편차(눈탱이) · 샷시 · 코디비 · 누수 복구비(보험 청구) — 84㎡
L84 = by.get("84", [])
if L84:
    lo = statistics.median(x["낮게"] for x in L84); hi_ = statistics.median(x["높게"] for x in L84)
    add("quote_gap", "눈탱이", f"같은 84㎡ 올수리, 낮게 {round(lo/1e4):,}만 원 ~ 높게 {round(hi_/1e4):,}만 원", {
        "낮게_만원": round(lo / 1e4), "높게_만원": round(hi_ / 1e4), "차이_만원": round((hi_ - lo) / 1e4)}, "https://jipjini.com/compare/")
    sh = statistics.median(x["샷시포함"] for x in L84); bs = statistics.median(x["올수리기본"] for x in L84)
    add("sash", "공사비", f"84㎡ 올수리에 샷시까지 넣으면 가운데값 {round(sh/1e4):,}만 원", {"기본_만원": round(bs / 1e4), "샷시포함_만원": round(sh / 1e4), "샷시몫_만원": round((sh - bs) / 1e4)}, "https://jipjini.com/apt/")
    cd = statistics.median(x["코디비"] for x in L84)
    add("coordi", "셀인", f"84㎡ 셀인대행 코디비 가운데값 {round(cd/1e4):,}만 원", {"코디비_만원": round(cd / 1e4)}, "https://jipjini.com/apt/")
    lk = [v for x in L84 for _, v in x.get("누수", [])]
    if lk:
        add("leak_cost", "보험", f"84㎡ 누수 복구비 {round(min(lk)/1e4):,}만 ~ {round(max(lk)/1e4):,}만 원, 가운데값 {round(statistics.median(lk)/1e4):,}만 원", {
            "최소_만원": round(min(lk) / 1e4), "최대_만원": round(max(lk) / 1e4), "가운데값_만원": round(statistics.median(lk) / 1e4)}, "https://jipjini.com/leak/")

# 6) 도면 — 단지 이름만 넣으면 우리 집 도면
try:
    fd = J("data", "apt", "find.json")
    add("plans", "도면", f"수도권 {len(fd):,}단지 중 {sum(1 for r in fd if r[6]):,}단지는 도면이 이미 준비", {"단지수": len(fd), "도면단지": sum(1 for r in fd if r[6]), "평형쪽": len(c)}, "https://jipjini.com/genie-plan/")
except Exception as e:
    print("도면 자료 건너뜀", e)

# 7) 장기수선충당금이 쓰이는 곳 — 최근 3년 공개 입찰(수도권 단지)
try:
    import gzip
    codes = {x["c"] for x in rows}; bids = []
    for f in glob.glob(os.path.join(ROOT, "data", "acb", "bid", "all_*.json.gz")):
        bids += [b for b in json.load(gzip.open(f)) if b.get("aptCode") in codes]
    KW = [("도장", r"도장"), ("방수", r"방수"), ("승강기", r"승강기|엘리베이터"), ("배관", r"배관|급수관|급탕관"), ("주차장", r"주차장")]
    cnt = {k: sum(1 for b in bids if re.search(p, b.get("bidTitle", ""))) for k, p in KW}
    top = sorted(cnt.items(), key=lambda z: -z[1])
    add("ltsm_use", "장충금", f"수도권 단지 3년 공개 입찰 {len(bids):,}건 — 공사 1위는 {top[0][0]}", dict({"입찰건수": len(bids), "단지수": len({b['aptCode'] for b in bids})}, **{k + "_건": v for k, v in top}), "https://jipjini.com/apt/")
except Exception as e:
    print("입찰 자료 건너뜀", e)

json.dump({"만든날": str(datetime.date.today()), "소재": F}, open(os.path.join(ROOT, "mk", "facts.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for x in F: print(x["id"], "|", x["한줄"])
