# -*- coding: utf-8 -*-
"""관문을 통과한 판을 누리집 자료에 반영: data/plans 의 각 평형 그림(벽선·샷시·문·벽·벽채움·사선벽·사선창·점검)만 새 변환으로 바꾼다.
   python3 tools/harness/apply.py <원본그림폴더>   (그림 이름: <단지코드>_<평형>.jpg)  → 이어서 plan_cad.py · plan_dwg.js 를 돌린다"""
import json, glob, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import plan_trace
KEYS = ('벽선', '샷시', '문', '벽', '벽채움', '사선벽', '사선창', '벽윤곽', '점검')
img = sys.argv[1]; n = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'data/plans/A*.json'))):
    code = os.path.basename(f)[:-5]; d = json.load(open(f, encoding='utf-8')); ch = False
    for t in d['평형']:
        p = t.get('plan') or {}; src = os.path.join(img, '%s_%s.jpg' % (code, t['이름']))
        if not p.get('그림') or not p.get('rooms') or not os.path.exists(src): continue
        G = plan_trace.trace(src, p)
        for k in KEYS: p['그림'][k] = G.get(k, [])
        ch = True; n += 1
    if ch: open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
print('반영', n, '평형')
