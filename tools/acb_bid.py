"""아관비 입찰 자료 모으기 — 국토교통부 공동주택 입찰결과공지 (2026-11-21)
공종 낱말 × 연도로 결과를 받고, 낙찰 건은 응찰 업체(회사 이름·낙찰 여부만)를 붙인다.
담당자 이름·전화는 저장하지 않는다. 이미 받은 응찰은 다시 부르지 않는다(이어 받기).
키: 깃허브 비밀값 DATA_GO_KR_KEY"""
import os, sys, json, time, re, urllib.request, urllib.parse

K = os.environ.get("DATA_GO_KR_KEY", "").strip()
B = "https://apis.data.go.kr/1613000/ApHusBidResultNoticeInfoOfferServiceV3"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "acb", "bid")
KW = ["승강기", "도장", "방수", "배관", "급수", "옥상", "주차장", "창호", "LED", "변압기", "수배전", "소방", "보일러", "외벽", "지붕", "놀이터", "CCTV", "전기차"]
YEARS = [int(y) for y in os.environ.get("YEARS", "2024,2025,2026").split(",")]
MAXCALL = int(os.environ.get("MAXCALL", "8000"))
calls = 0
DROP = {"bidFileSeq", "bidFieldDesLoc", "bidReqDocs", "bidTermsOfPayment", "bidMngCertYn", "bidGuaranteeYn", "bidCreditConfYn"}


def get(op, **p):
    global calls
    calls += 1
    p["_type"] = "json"
    u = f"{B}/{op}?serviceKey={urllib.parse.quote(K, safe='')}&{urllib.parse.urlencode(p)}"
    for t in range(4):
        try:
            with urllib.request.urlopen(u, timeout=60) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception:
            time.sleep(3 * (t + 1))
    return None


def items(d):
    if not d: return None, 0
    b = (d.get("response") or {}).get("body") or {}
    it = b.get("items") or []
    if isinstance(it, dict): it = it.get("item", [])
    if isinstance(it, dict): it = [it]
    return it, int(b.get("totalCount") or 0)


def slim(r):
    r = {k: v for k, v in r.items() if k not in DROP}
    c = r.get("bidContent") or ""
    m = re.findall(r"(\d{1,3})\s*대", c)
    if m: r["대수"] = max(int(x) for x in m)
    r["bidContent"] = re.sub(r"\s+", " ", c)[:300]
    return r


def main():
    if not K: print("키 없음"); return
    os.makedirs(OUT, exist_ok=True)
    for y in YEARS:
        for kw in KW:
            f = os.path.join(OUT, f"{kw}_{y}.json")
            old = {r["bidNum"]: r for r in json.load(open(f, encoding="utf-8"))} if os.path.exists(f) else {}
            rows, page = [], 1
            while calls < MAXCALL:
                it, tot = items(get("getBidPblAncNmSearchV3", bidTitle=kw, searchYear=str(y), pageNo=page, numOfRows=1000))
                if it is None: break
                rows += it
                if not it or len(rows) >= tot: break
                page += 1
            new = {}
            for r in rows:
                s = slim(r); o = old.get(s["bidNum"])
                if o and "응찰" in o: s["응찰"] = o["응찰"]
                new[s["bidNum"]] = s
            for s in new.values():
                if str(s.get("bidState")) == "5" and "응찰" not in s and calls < MAXCALL:
                    it, _ = items(get("getBidEntrpsInfoSearchV3", bidNum=s["bidNum"]))
                    if it is not None:
                        s["응찰"] = [[p.get("companyName"), (p.get("bidSuccessfulYn") or "")[:1]] for p in it]
            L = list(new.values()) or list(old.values())
            json.dump(L, open(f, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            print(y, kw, "건", len(L), "응찰 붙음", sum(1 for s in L if s.get("응찰")), "부른 횟수", calls)
            if calls >= MAXCALL: print("오늘 한도"); return


if __name__ == "__main__":
    main()
