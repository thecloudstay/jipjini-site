"""입찰결과공지 연결 — 승강기 2026 견본 (2026-11-21, 확인 뒤 지운다)"""
import os, urllib.request, urllib.parse, json
K = os.environ.get("DATA_GO_KR_KEY", "").strip()
B = "https://apis.data.go.kr/1613000/ApHusBidResultNoticeInfoOfferServiceV3"
def get(op, **p):
    p.update({"pageNo": p.get("pageNo", 1), "numOfRows": p.get("numOfRows", 100), "_type": "json"})
    u = f"{B}/{op}?serviceKey={urllib.parse.quote(K, safe='')}&{urllib.parse.urlencode(p)}"
    with urllib.request.urlopen(u, timeout=40) as r: return json.loads(r.read().decode("utf-8", "replace"))
d = get("getBidPblAncNmSearchV3", bidTitle="승강기", searchYear="2026")
b = d.get("response", {}).get("body", {})
items = b.get("items", {})
items = items.get("item", items) if isinstance(items, dict) else items
if isinstance(items, dict): items = [items]
print("총", b.get("totalCount"), "받은", len(items or []))
for it in (items or [])[:4]:
    print(json.dumps(it, ensure_ascii=False)[:700])
if items:
    n = items[0].get("bidNum")
    print("참여", json.dumps(get("getBidEntrpsInfoSearchV3", bidNum=n), ensure_ascii=False)[:900])
