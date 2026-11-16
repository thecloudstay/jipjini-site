# -*- coding: utf-8 -*-
"""도면이 열린 단지 목록 → data/plans/open.json (첫 화면 「우리 집 공사비」 찾기가 읽는다, 2026-11-16)
   줄: [단지번호, 단지 이름, 시도 구, 동, 준공 연도, 세대수, 열린 평형 수] — 세대수 많은 순
   공개 도면(data/plans/A*.json)이 바뀔 때마다 plan-quality 작업이 함께 돌린다."""
import json, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'data', 'plans')
def main():
    try: find = {r[0]: r for r in json.load(open(os.path.join(ROOT, 'data', 'apt', 'find.json'), encoding='utf-8'))}
    except Exception: find = {}
    out, types = [], 0
    for fn in sorted(os.listdir(P)):
        if not (fn.startswith('A') and fn.endswith('.json')): continue
        try: d = json.load(open(os.path.join(P, fn), encoding='utf-8'))
        except Exception: continue
        n = len(d.get('평형') or [])
        if not n: continue
        c, r = fn[:-5], find.get(fn[:-5])
        types += n
        out.append([c, d.get('단지') or (r[1] if r else ''), r[2] if r else '', r[3] if r else '', r[4] if r else '', r[5] if r else 0, n])
    out.sort(key=lambda x: (-(x[5] or 0), x[1]))
    day = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).strftime('%Y-%m-%d')
    json.dump({'만든날': day, '단지': len(out), '평형': types, '목록': out}, open(os.path.join(P, 'open.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('열린 단지', len(out), '평형', types)
if __name__ == '__main__': main()
