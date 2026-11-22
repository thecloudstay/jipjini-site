"""아관비 입찰 자료 모으기 — 국토교통부 공동주택 입찰결과공지 전체 (2026-11-21)
1단계: 연도별로 흔한 낱말(선정·공고·입찰·공사·용역·업체·계약·매각·모집)로 전국 전체 입찰을 받아 합친다.
       → data/acb/bid/all_YYYY.json.gz (필요한 칸만)
2단계: 낙찰 건 중 금액 큰 순서로 응찰 업체(회사 이름·낙찰 여부만)를 붙인다. 하루 한도 안에서 이어 받기.
       → data/acb/bid/bidders.json.gz  {입찰번호: [[회사, 낙찰Y/N], ...]}
담당자 이름·전화는 저장하지 않는다. 키: 깃허브 비밀값 DATA_GO_KR_KEY"""
import os, json, gzip, time, re, urllib.request, urllib.parse, datetime

K = os.environ.get("DATA_GO_KR_KEY", "").strip()
B = "https://apis.data.go.kr/1613000/ApHusBidResultNoticeInfoOfferServiceV3"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "acb", "bid")
KW = ["선정", "공고", "입찰", "공사", "용역", "업체", "계약", "매각", "모집", "교체", "보수"]
THIS = datetime.date.today().year
YEARS = [int(y) for y in os.environ.get("YEARS", f"{THIS-2},{THIS-1},{THIS}").split(",")]
MAXCALL = int(os.environ.get("MAXCALL", "9000"))
KEEP = ["bidNum", "aptCode", "bidArea", "bidTitle", "bidRegdate", "bidDeadline", "bidState", "bidKaptname", "codeAuth", "codeKind",
        "codeClassifyType1", "codeClassifyType2", "codeClassifyType3", "codeWay", "codeSucWay", "bidEmrgYn", "amount", "contractPeriodSdate", "contractPeriodEdate"]
calls = 0
FIN = re.compile(r"도장|페인트|방수|에폭시|우레탄|균열|크랙|코킹|누수")


def get(op, **p):
    global calls
    calls += 1
    p["_type"] = "json"
    u = f"{B}/{op}?serviceKey={urllib.parse.quote(K, safe='')}&{urllib.parse.urlencode(p)}"
    for t in range(4):
        try:
            with urllib.request.urlopen(u, timeout=90) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception:
            time.sleep(4 * (t + 1))
    return None


def items(d):
    if not d: return None, 0
    b = (d.get("response") or {}).get("body") or {}
    it = b.get("items") or []
    if isinstance(it, dict): it = it.get("item", [])
    if isinstance(it, dict): it = [it]
    return it, int(b.get("totalCount") or 0)


def rd(p, default):
    try:
        with gzip.open(p, "rt", encoding="utf-8") as f: return json.load(f)
    except Exception:
        return default


def wr(p, obj):
    with gzip.open(p, "wt", encoding="utf-8") as f: json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def slim(r):
    s = {k: r.get(k) for k in KEEP if r.get(k) not in (None, "")}
    m = re.findall(r"(\d{1,3})\s*대", r.get("bidContent") or "")
    if m: s["대수"] = max(int(x) for x in m)
    # 마감 공사(도장·방수·바닥·균열)는 사양·면적이 본문에 있어 앞 900자를 남긴다 (2026-11-21)
    if FIN.search(r.get("bidTitle") or ""):
        c = re.sub(r"\s+", " ", re.sub(r"<[^>]+>|&nbsp;", " ", r.get("bidContent") or "")).strip()
        if c: s["본문"] = c[:900]
    return s


def list_one(y, kw):
    """나눠 받기 한 조각: 한 해 × 한 낱말 → data/acb/bid/part/{y}_{kw}.json.gz"""
    out = {}
    page, got = 1, 0
    while True:
        it, tot = items(get("getBidPblAncNmSearchV3", bidTitle=kw, searchYear=str(y), pageNo=page, numOfRows=1000))
        if it is None: break
        for r in it: out[r["bidNum"]] = slim(r)
        got += len(it)
        print(y, kw, got, "/", tot, flush=True)
        if not it or got >= tot: break
        page += 1
    os.makedirs(os.path.join(OUT, "part"), exist_ok=True)
    wr(os.path.join(OUT, "part", f"{y}_{kw}.json.gz"), list(out.values()))


def merge_parts():
    import glob
    for y in YEARS:
        f = os.path.join(OUT, f"all_{y}.json.gz")
        allr = {r["bidNum"]: r for r in rd(f, [])}
        for pth in glob.glob(os.path.join(OUT, "part", "**", f"{y}_*.json.gz"), recursive=True):
            for r in rd(pth, []): allr[r["bidNum"]] = r
        wr(f, list(allr.values()))
        print("합침", y, len(allr), flush=True)


def main():
    if not K: print("키 없음"); return
    mode = os.environ.get("MODE", "")
    if mode == "list":
        return list_one(int(os.environ["YEAR"]), os.environ["KWD"])
    if mode == "merge":
        merge_parts()
        st = rd(os.path.join(OUT, "state.json.gz"), {})
        for y in YEARS: st[f"done_{y}"] = 1
        wr(os.path.join(OUT, "state.json.gz"), st)
        return
    os.makedirs(OUT, exist_ok=True)
    st = rd(os.path.join(OUT, "state.json.gz"), {})
    for y in ([] if mode == "bidders" else YEARS):
        f = os.path.join(OUT, f"all_{y}.json.gz")
        allr = {r["bidNum"]: r for r in rd(f, [])}
        # 지난해 이전은 한 번 다 받으면 다시 받지 않는다
        if y < THIS and st.get(f"done_{y}"): continue
        for kw in KW:
            page, got = 1, 0
            while calls < MAXCALL:
                it, tot = items(get("getBidPblAncNmSearchV3", bidTitle=kw, searchYear=str(y), pageNo=page, numOfRows=1000))
                if it is None: break
                for r in it: allr[r["bidNum"]] = slim(r)
                got += len(it)
                if not it or got >= tot: break
                page += 1
            print(y, kw, "누적", len(allr), "부른 횟수", calls, flush=True)
            wr(f, list(allr.values()))
        wr(f, list(allr.values()))
        if calls < MAXCALL: st[f"done_{y}"] = 1
    # 2단계: 응찰 업체 (낙찰 건, 금액 큰 순)
    bf = os.path.join(OUT, "bidders.json.gz")
    bd = rd(bf, {})
    won = []
    for y in YEARS:
        for r in rd(os.path.join(OUT, f"all_{y}.json.gz"), []):
            # 2026-11-22 kg2b_ 로 시작하는 번호(나라장터 연계 공고)는 응찰 조회가 답 없이 43초씩 끌다 끊긴다 — 금액 큰 순 맨 앞에 몰려 있어 40번 만에 멈추던 원인. 건너뛴다.
            if str(r.get("bidState")) == "5" and r["bidNum"] not in bd and not str(r["bidNum"]).startswith("kg2b"):
                try: a = float(r.get("amount") or 0)
                except Exception: a = 0
                won.append((a, r["bidNum"]))
    won.sort(reverse=True)
    bd = {k: v for k, v in bd.items() if v}   # 예전에 저장된 빈 답은 버린다
    n0 = len(bd); tried = got = miss = 0
    for a, num in won:
        if calls >= MAXCALL: break
        raw = get("getBidEntrpsInfoSearchV3", bidNum=num, pageNo=1, numOfRows=100)
        it, _ = items(raw)
        tried += 1
        if it:
            # 빈 답은 저장하지 않는다(다음에 다시 받게). 2026-11-22: 3,500건이 모두 빈 답으로 저장된 원인 추적
            bd[num] = [[p.get("companyName"), (p.get("bidSuccessfulYn") or "")[:1]] for p in it]
            got += 1; miss = 0
            if got == 1: print("응찰 첫 답 칸", sorted(it[0].keys()), flush=True)
            if len(bd) % 500 == 0:
                wr(bf, bd); print("응찰", len(bd), flush=True)
        else:
            miss += 1
            if tried <= 3: print("빈 답 원문", num, json.dumps(raw, ensure_ascii=False)[:600], flush=True)
        if miss >= 40:
            print("응찰 답이 40번 잇달아 비어 멈춤 — 한도 아끼기 · 받은 것", got, flush=True); break
    wr(bf, bd)
    wr(os.path.join(OUT, "state.json.gz"), st)
    print("응찰 붙임", len(bd) - n0, "남은 낙찰", max(0, len(won) - (len(bd) - n0)), "부른 횟수", calls)


if __name__ == "__main__":
    main()
