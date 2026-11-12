# -*- coding: utf-8 -*-
"""지도 자료(data/apt)에 「도면 열림」 상태만 다시 매긴다 — 대표 컴퓨터 원자료 없이 누리집 자료만으로(2026-11-12).
   data/plans/index.json 에 있는 단지 → s=2, r=열린 평형 수. 구역별 수·합계·판을 다시 센다.
   python3 tools/apt_ready.py"""
import json, os, glob, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); AP = os.path.join(ROOT, 'data', 'apt'); PL = os.path.join(ROOT, 'data', 'plans')
READY = {c: len(json.load(open(os.path.join(PL, c + '.json'), encoding='utf-8'))['평형']) for c in json.load(open(os.path.join(PL, 'index.json'), encoding='utf-8'))}
idx = json.load(open(os.path.join(AP, 'index.json'), encoding='utf-8')); tot = [0, 0, 0]
for r in idx['구역']:
    f = os.path.join(AP, r['id'] + '.json'); rows = json.load(open(f, encoding='utf-8'))
    for x in rows:
        if x['c'] in READY: x['s'] = 2; x['r'] = READY[x['c']]
        elif x['s'] == 2: x['s'] = 1; x.pop('r', None)
    rows.sort(key=lambda x: (-x['s'], -x.get('h', 0), x['n']))
    json.dump(rows, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    r['수'] = [sum(1 for x in rows if x['s'] == k) for k in (0, 1, 2)]
    for k in range(3): tot[k] += r['수'][k]
idx['합계'] = tot; idx['판'] = time.strftime('%m%d%H%M')
json.dump(idx, open(os.path.join(AP, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('합계(예정·평면 확보·도면 열림)', tot, '· 지도에 없는 열린 단지', sorted(set(READY) - {x['c'] for r in idx['구역'] for x in json.load(open(os.path.join(AP, r['id'] + '.json'), encoding='utf-8'))}))
