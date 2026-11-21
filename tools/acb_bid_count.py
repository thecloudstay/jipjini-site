"""입찰결과 전체 건수 확인 (2026-11-21, 확인 뒤 지움)"""
import os, json, urllib.request, urllib.parse
K = os.environ["DATA_GO_KR_KEY"].strip()
B = "https://apis.data.go.kr/1613000/ApHusBidResultNoticeInfoOfferServiceV3/getBidPblAncNmSearchV3"
for kw in ["선정", "공고", "입찰", "공사", "용역", "업체", " ", "%"]:
    for y in ["2025"]:
        u = f"{B}?serviceKey={urllib.parse.quote(K, safe='')}&" + urllib.parse.urlencode({"bidTitle": kw, "searchYear": y, "pageNo": 1, "numOfRows": 1, "_type": "json"})
        try:
            d = json.loads(urllib.request.urlopen(u, timeout=60).read())
            print(repr(kw), y, d.get("response", {}).get("body", {}).get("totalCount"))
        except Exception as e:
            print(repr(kw), y, "오류", str(e)[:80])
