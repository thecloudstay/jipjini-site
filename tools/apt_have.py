# -*- coding: utf-8 -*-
"""지도 자료(data/apt)에 「평면 확보」(s=1) 상태를 대장 기준으로 다시 매긴다 (2026-11-16).
   그동안 s=1 은 지도 전체를 새로 만들 때(build_apt_map.py)만 바뀌어, 대장은 3,283곳인데 지도는 1,205곳에 멈춰 있었다.
   python3 tools/apt_have.py <plan_ledger.csv 또는 .json>   → 끝나면 apt_ready.py 가 도면 열림(s=2)과 합계를 다시 센다.
   단지 코드와 평형 수만 쓴다(네이버 번호·그림 주소는 싣지 않는다)."""
import csv, json, os, sys, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); AP = os.path.join(ROOT, 'data', 'apt')
src = sys.argv[1]
rows = json.load(open(src, encoding='utf-8')) if src.endswith('.json') else list(csv.DictReader(open(src, encoding='utf-8-sig')))
def n(v):
    try: return int(float(v or 0))
    except Exception: return 0
GOT = {str(r.get('단지코드')): n(r.get('평형수')) for r in rows if r.get('상태') == '받음' and r.get('단지코드')}
idx = json.load(open(os.path.join(AP, 'index.json'), encoding='utf-8')); up = 0
for r in idx['구역']:
    f = os.path.join(AP, r['id'] + '.json'); L = json.load(open(f, encoding='utf-8')); ch = False
    for x in L:
        if x['s'] == 0 and x['c'] in GOT:
            x['s'] = 1; ch = True; up += 1
            if GOT[x['c']]: x['p'] = GOT[x['c']]
    if ch: json.dump(L, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('대장 받음', len(GOT), '· 새로 평면 확보로 올림', up)
subprocess.call([sys.executable, os.path.join(ROOT, 'tools', 'apt_ready.py')])
