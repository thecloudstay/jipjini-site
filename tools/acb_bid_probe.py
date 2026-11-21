"""입찰결과공지 연결 — 기능 이름 찾기 (2026-11-21, 한 번 쓰고 지운다)"""
import os, urllib.request, urllib.parse, json
K = os.environ.get("DATA_GO_KR_KEY", "").strip()
B = "https://apis.data.go.kr/1613000/ApHusBidResultNoticeInfoOfferServiceV3"
cands = ["", "?_wadl", "/openapi.json", "/swagger.json"]
names = ["getBidResultNoticeList", "getBidResultNoticeInfo", "getHsmpBidResultNoticeList", "getBidResultList", "getRsltNtcList", "getBidRsltNtcList",
         "getPblancRsltList", "getBidResultNoticeSearch", "getAptBidResultNoticeList", "getBidResultNoticeListV3", "getBidResultNoticeInfoV3",
         "getHsmpBidResultNoticeListV3", "getBidRsltList", "getBidRsltListV3", "getBidRsltDtlInfoV3", "getBidRsltInfoV3", "getBidResultInfoV3",
         "getBidResultNoticeDetailV3", "getBidRsltNtceListV3", "getBidRsltNtceInfoV3", "getBidSuccessList", "getBidSuccessListV3"]
out = []
def get(u):
    try:
        with urllib.request.urlopen(u, timeout=20) as r: return r.status, r.read().decode("utf-8", "replace")[:300]
    except urllib.error.HTTPError as e: return e.code, e.read().decode("utf-8", "replace")[:200]
    except Exception as e: return 0, str(e)[:120]
for c in cands:
    out.append((c, *get(B + c)))
for n in names:
    q = urllib.parse.urlencode({"pageNo": 1, "numOfRows": 2, "_type": "json", "kaptCode": "A10027118"})
    out.append((n, *get(f"{B}/{n}?serviceKey={urllib.parse.quote(K, safe='')}&{q}")))
s = "\n".join(f"{a} => {b} {c}" for a, b, c in out).replace(K, "***")
print(s)
