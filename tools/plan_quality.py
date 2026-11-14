# -*- coding: utf-8 -*-
"""공개 도면 공간 구성 검사 — 2026-11-15 대표 「벌크 변환 완료 도면 분석·보고를 안 하는 것 같다」
점수(선·모양이 원본과 맞는지)와 따로, 집으로서 말이 되는지를 전수로 센다 → data/plans/quality.json
(콘솔 아침 보고가 이 파일을 읽어 텔레그램에 싣는다. 도면 자동 공개가 올라올 때마다 사이트 작업 흐름이 다시 돌린다.)
  python tools/plan_quality.py
"""
import json, glob, os, collections, statistics, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    rows = []
    for f in glob.glob(os.path.join(ROOT, 'data', 'plans', 'A*.json')):
        d = json.load(open(f, encoding='utf-8')); code = os.path.basename(f)[:-5]
        for t in d.get('평형', []):
            p = t.get('plan') or {}; rs = p.get('rooms', [])
            try: A = float(t.get('전용') or 0)
            except ValueError: A = 0
            c = collections.Counter(r.get('kind') for r in rs)
            inside = sum(r.get('area', 0) for r in rs if r.get('kind') not in ('발코니', '실외기실', '피트'))
            rows.append(dict(code=code, nm=t.get('이름'), A=A, c=c, ratio=inside / A if A else 1, score=t.get('점수') or 0,
                             gita=[r.get('area', 0) for r in rs if r.get('kind') == '기타']))
    N = len(rows) or 1
    checks = [
        ('둘째 욕실 놓침 의심(75㎡ 이상 · 욕실 1개 · 욕실 크기 「기타」)', lambda r: r['A'] >= 75 and r['c']['욕실'] <= 1 and any(2 <= g <= 6.5 for g in r['gita'])),
        ('주방 없음', lambda r: r['c']['주방'] == 0),
        ('거실 없음', lambda r: r['c']['거실'] == 0),
        ('현관 없음', lambda r: r['c']['현관'] == 0),
        ('방 넓이 합이 전용면적과 15% 넘게 다름', lambda r: r['ratio'] < .85 or r['ratio'] > 1.15),
        ('이름 못 붙인 「기타」 5㎡ 넘음', lambda r: sum(r['gita']) >= 5),
        ('59~75㎡ 욕실 1개(원본 확인 필요)', lambda r: 59 <= r['A'] < 75 and r['c']['욕실'] <= 1),
    ]
    out = {'때': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d %H:%M'),
           '평형': len(rows), '단지': len({r['code'] for r in rows}),
           '점수_가운데': statistics.median([r['score'] for r in rows]) if rows else 0, '걸림': []}
    for name, fn in checks:
        hit = [r for r in rows if fn(r)]
        out['걸림'].append({'이름': name, '수': len(hit), '비율': round(len(hit) / N * 100, 1), '보기': ['%s %s' % (r['code'], r['nm']) for r in hit[:12]]})
    json.dump(out, open(os.path.join(ROOT, 'data', 'plans', 'quality.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in out.items() if k != '걸림'}, ensure_ascii=False)); [print(' ', x['이름'], x['수'], x['비율']) for x in out['걸림']]


if __name__ == '__main__':
    main()
