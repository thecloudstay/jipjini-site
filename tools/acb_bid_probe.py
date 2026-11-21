"""입찰결과 견본 모으기 — 2026 승강기 (수도권), 견본 페이지용 (2026-11-21)
담당자 이름·전화는 남기지 않는다."""
import os, urllib.request, urllib.parse, json, time
K = os.environ.get("DATA_GO_KR_KEY", "").strip()
B = "https://apis.data.go.kr/1613000/ApHusBidResultNoticeInfoOfferServiceV3"
def get(op, **p):
    p.update({"_type": "json"})
    u = f"{B}/{op}?serviceKey={urllib.parse.quote(K, safe='')}&{urllib.parse.urlencode(p)}"
    for t in range(3):
        try:
            with urllib.request.urlopen(u, timeout=40) as r: return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e: time.sleep(2)
    return {}
def items(d):
    b = d.get("response", {}).get("body", {}) or {}
    it = b.get("items") or []
    if isinstance(it, dict): it = it.get("item", [])
    if isinstance(it, dict): it = [it]
    return it, b.get("totalCount", 0)
rows = []; page = 1
while True:
    it, tot = items(get("getBidPblAncNmSearchV3", bidTitle="승강기", searchYear="2026", pageNo=page, numOfRows=500))
    rows += it
    if not it or len(rows) >= int(tot or 0): break
    page += 1
print("전체", len(rows))
if rows: print("항목", sorted(rows[0].keys()))
keep = [r for r in rows if str(r.get("bidArea")) in ("11", "28", "41") and ("교체" in (r.get("bidTitle") or "") or "리모델링" in (r.get("bidTitle") or ""))]
print("수도권 교체", len(keep))
out = []
for r in keep:
    r = {k: v for k, v in r.items() if k not in ("bidFileSeq",)}
    if str(r.get("bidState")) == "5":
        ps, _ = items(get("getBidEntrpsInfoSearchV3", bidNum=r["bidNum"]))
        r["응찰"] = [[p.get("companyName"), p.get("bidSuccessfulYn")] for p in ps]
    out.append(r)
os.makedirs("data/acb/lab", exist_ok=True)
json.dump(out, open("data/acb/lab/ev2026.json", "w", encoding="utf-8"), ensure_ascii=False)
print("저장", len(out))
