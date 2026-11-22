# -*- coding: utf-8 -*-
"""단지마다 「비슷한 단지 낙찰」이 몇 건 있는지 센다 → data/acb/bidref.json  {단지코드: [경비 건수, 청소 건수]}
2026-11-22 대표 「공개하되 모자이크 처리하여 궁금하게」: 관리비 화면의 대표회의 보고서 미리보기가 낙찰가 칸을 가려서 보여 주는데,
가린 칸 뒤에 실제 값이 있는 단지에만 그 칸을 내기 위한 건수표다. 금액은 여기에 넣지 않는다(화면 어디에도 실제 값이 실리지 않게).
기준은 콘솔 tools/council_report.py 와 같다: 같은 시·도, 세대수 0.6~1.6배, 낙찰, 세대당 5만~300만 원, 12건 이상."""
import json, gzip, glob, os, re, bisect
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = {}
for f in glob.glob(os.path.join(SITE, 'data/acb/*_*.json')):
    j = json.load(open(f, encoding='utf-8'))
    for x in (j if isinstance(j, list) else []):
        if isinstance(x, dict) and 'c' in x and x.get('h'): D[x['c']] = (os.path.basename(f).split('_')[0], x['h'])
def kind(t):
    if re.search('경비', t) and not re.search('청소|미화|위탁|주택관리', t): return 0
    if re.search('청소|미화', t) and not re.search('경비|위탁|주택관리|물탱크|저수조|정화조|외벽|카펫|덕트', t): return 1
    return None
pool, own = {}, {}
for f in glob.glob(os.path.join(SITE, 'data/acb/bid/all_*.json.gz')):
    for r in json.load(gzip.open(f)):
        if str(r.get('bidState')) != '5' or not r.get('amount'): continue
        k = kind(r.get('bidTitle') or ''); x = D.get(r.get('aptCode'))
        if k is None or not x: continue
        try: p = float(r['amount']) / x[1]
        except Exception: continue
        if not (5e4 < p < 3e6): continue
        pool.setdefault((x[0], k), []).append(x[1]); own[(r['aptCode'], k)] = own.get((r['aptCode'], k), 0) + 1
for v in pool.values(): v.sort()
out = {}
for c, (s, h) in D.items():
    n = []
    for k in (0, 1):
        v = pool.get((s, k), []); n.append(bisect.bisect_right(v, 1.6 * h) - bisect.bisect_left(v, 0.6 * h) - own.get((c, k), 0))
    n = [x if x >= 12 else 0 for x in n]
    if n[0] or n[1]: out[c] = n
json.dump(out, open(os.path.join(SITE, 'data/acb/bidref.json'), 'w'), separators=(',', ':'), allow_nan=False)
print('단지', len(D), '· 낙찰 참고값 있는 단지', len(out), '· 경비', sum(1 for v in out.values() if v[0]), '· 청소', sum(1 for v in out.values() if v[1]))
