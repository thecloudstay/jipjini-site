# -*- coding: utf-8 -*-
"""IndexNow 제출 (2026-10-09) — 바뀐 쪽 주소를 네이버·빙 등 참여 검색엔진에 바로 알린다.
네이버 서치어드바이저는 2023년 7월부터 IndexNow 를 받는다. 키는 비밀이 아니라 사이트에 공개로 올리는 확인 파일이다.
사용: python3 tools/indexnow.py            (직전 반영과 비교해 바뀐 쪽만)
      python3 tools/indexnow.py --all      (사이트 지도 전체, 최대 10,000)
"""
import os, re, sys, json, urllib.request, urllib.error, secrets, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://jipjini.com/"; HOST = "jipjini.com"
KEY_META = os.path.join(ROOT, "tools", "indexnow_key.json")
STATE = os.path.join(ROOT, "tools", "indexnow_state.json")

def key():
    if os.path.exists(KEY_META):
        k = json.load(open(KEY_META))["key"]
    else:
        k = secrets.token_hex(16)
        json.dump({"key": k, "made": datetime.date.today().isoformat()}, open(KEY_META, "w"))
    kf = os.path.join(ROOT, k + ".txt")
    if not os.path.exists(kf): open(kf, "w").write(k)
    return k

def sitemap_entries():
    s = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
    return dict(re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", s))

def main():
    k = key()
    cur = sitemap_entries()
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    sent = st.get("urls", {})
    urls = list(cur) if "--all" in sys.argv else [u for u, d in cur.items() if sent.get(u) != d]
    urls = urls[:10000]
    if not urls: print("바뀐 쪽 없음"); return
    body = json.dumps({"host": HOST, "key": k, "keyLocation": f"{SITE}{k}.txt", "urlList": urls}).encode()
    results = {}
    for ep in ("https://api.indexnow.org/indexnow", "https://searchadvisor.naver.com/indexnow"):
        try:
            req = urllib.request.Request(ep, data=body, headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "jipjini-site-bot"})
            with urllib.request.urlopen(req, timeout=60) as r: results[ep] = r.status
        except urllib.error.HTTPError as e: results[ep] = e.code
        except Exception as e: results[ep] = str(e)[:80]
    ok = any(isinstance(v, int) and v in (200, 202) for v in results.values())
    if ok:
        for u in urls: sent[u] = cur[u]
    json.dump({"at": datetime.datetime.now().isoformat(), "sent": len(urls), "results": results, "urls": sent}, open(STATE, "w"), ensure_ascii=False, indent=0)
    print(f"IndexNow 제출 {len(urls)}쪽 → {results}")

if __name__ == "__main__":
    main()
