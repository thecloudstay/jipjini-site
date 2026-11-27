"""단지별 누수 위험 점검표 (2026-11-27, 대표 「누수 및 관리비 파트 업그레이드」 1단계)
근거: 공동주택관리정보시스템 공개 입찰 2024~2026(data/acb/bid/all_*.json.gz) 제목 + 준공연도(data/acb/<시도_시군구>.json).
① 단지마다 옥상 방수 · 외벽 · 배관 · 지하주차장 방수 · 누수 보수 공사를 최근 3년 안에 입찰에 올린 적이 있는지(가장 최근 것)
② 수도권 전체에서 그 공사를 준공 몇 년째에 하는지(가운데값·사분) — 법정 주기가 아니라 실제로 한 시점
→ data/acb/leak.json"""
import gzip, json, re, os, glob, statistics, collections

ROOT = os.path.join(os.path.dirname(__file__), "..")
CAT = [  # (키, 이름, 어디로 새는지)
    ("roof", "옥상 방수", "꼭대기 층 천장", r"옥상.{0,8}(방수|우레탄|시트|도막)|지붕.{0,6}방수|옥탑.{0,6}방수"),
    ("wall", "외벽 균열·방수", "창 둘레·바깥벽 쪽 벽", r"외벽.{0,10}(도장|방수|보수|균열|크랙|코킹|실링|발수)|외부.{0,4}(균열|도장)|재도장|발수"),
    ("pipe", "배관 교체·갱생", "욕실·주방 아래층 천장", r"(급수|급탕|온수|난방|배수|오수|세대|공용|수직|입상)\s*(배관|관|입상관|수직관).{0,10}(교체|갱생|라이닝|보수|공사|개량)|배관.{0,6}(교체|갱생|라이닝)"),
    ("park", "지하주차장 방수", "지하주차장 천장·벽", r"지하.{0,12}(방수|누수|우레탄|에폭시|트렌치)"),
    ("leak", "누수 보수", "", r"누수"),
]
SKIP = r"세정|준설|이물질|세척|펌프|인버터|판넬|보온|도색\s*없|청소|소독|점검\s*용역|보험"


def main():
    info = {}
    for f in glob.glob(os.path.join(ROOT, "data", "acb", "*_*.json")):
        if "api_sample" in f: continue
        try: d = json.load(open(f, encoding="utf-8"))
        except Exception: continue
        if isinstance(d, list):
            for x in d:
                if isinstance(x, dict) and x.get("c") and x.get("y"): info[x["c"]] = int(x["y"])
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "acb", "bid", "all_*.json.gz"))):
        rows += json.load(gzip.open(f))
    hit = collections.defaultdict(dict); ages = collections.defaultdict(list); seen = set()
    for r in rows:
        t = (r.get("bidTitle") or "").strip(); c = r.get("aptCode"); dt = (r.get("bidRegdate") or "")[:10]
        if not t or not c or not dt or re.search(SKIP, t): continue
        for k, _, _, p in CAT:
            if not re.search(p, t): continue
            old = hit[c].get(k)
            if not old or dt > old[0]: hit[c][k] = [dt, re.sub(r"\s+", " ", t)[:32]]
            if c in info and (c, k) not in seen:
                seen.add((c, k)); a = int(dt[:4]) - info[c]
                if 0 <= a <= 60: ages[k].append(a)
    st = {}
    for k, nm, _, _ in CAT:
        a = sorted(ages[k])
        if len(a) >= 30:
            q = statistics.quantiles(a, n=4)
            st[k] = {"n": len(a), "med": round(statistics.median(a)), "q1": round(q[0]), "q3": round(q[2])}
    out = {"기준": "공개 입찰 2024-01~2026-11", "분류": {k: [nm, wh] for k, nm, wh, _ in CAT}, "통계": st,
           "단지": {c: v for c, v in hit.items() if c in info}}
    json.dump(out, open(os.path.join(ROOT, "data", "acb", "leak.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("단지(준공연도 있음)", len(info), "· 기록 있는 단지", len(out["단지"]), "· 통계", st)


if __name__ == "__main__":
    main()
