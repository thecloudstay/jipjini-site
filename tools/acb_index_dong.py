# -*- coding: utf-8 -*-
"""관리비 단지 목록(data/acb/index.json)에 동 이름을 아홉째 칸으로 붙인다 — 「송파동 한양」처럼 동으로 찾을 수 있게 (2026-11-22).
동 이름은 단지 찾기 자료(data/apt/find.json)에서 단지코드로 가져온다. 여러 번 돌려도 같다."""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(R, 'data/acb/index.json'); I = json.load(open(p, encoding='utf-8'))
F = {r[0]: r[3] for r in json.load(open(os.path.join(R, 'data/apt/find.json'), encoding='utf-8'))}
n = 0
for c, e in I.items():
    d = F.get(c, '')
    if len(e) < 9: e.append(d)
    else: e[8] = d
    n += 1 if d else 0
json.dump(I, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), allow_nan=False)
print('관리비 단지', len(I), '· 동 이름 붙음', n)
