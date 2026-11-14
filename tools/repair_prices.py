# -*- coding: utf-8 -*-
"""누수 복구·경매 수리비·견적 비교가 함께 쓰는 단가 자료를 집지니 실견적(data/real-quotes.json)에서 뽑는다.

  python tools/repair_prices.py   → data/repair-prices.json

- items: 품목 단가. 실견적 줄에서 이름·단위가 맞는 줄의 단가 중위값과 건수(n). 실견적에 없으면 fallback 값(근거 「집지니 현장 기준」).
- trades: 공종별 「평당 금액」. 올수리(총액 1,500만 원 이상) 견적에서 공종 소계 ÷ 평 의 25%·50%·75% 값.
실견적이 늘면 이 파일만 다시 돌리면 된다(실견적 공개 자료는 tools/gen_real_quotes.py 가 만든다).
"""
import json, re, statistics, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'real-quotes.json')
OUT = os.path.join(ROOT, 'data', 'repair-prices.json')

# 키, 이름, 단위, 이름 무늬(정규식), 맞는 단위들, 실견적에 없을 때 값
ITEMS = [
    ('wall_silk',   '실크 도배(자재+시공)',        '㎡', r'실크',                         ['㎡'],        42000),
    ('wall_roll',   '실크 벽지(롤)',               '롤', r'실크|벽지',                    ['롤'],        45000),
    ('wallpaper_day','도배 기술자',                '품', r'도배.*(기술자|공\b|인건)',      ['품', '일'],  280000),
    ('carp_day',    '목수',                        '품', r'목수|목공.*인건비',             ['품', '일'],  320000),
    ('demo_day',    '철거공',                      '품', r'철거공|철거 인력|철거.*인건비', ['품', '일'],  200000),
    ('helper_day',  '조공(보조)',                  '품', r'조공|잡부|보조',               ['품', '일'],  170000),
    ('waste_ton',   '폐기물 운반·처리',            '톤', r'폐기물',                       ['톤'],        300000),
    ('floor_maru',  '강마루(자재+시공)',           '㎡', r'강마루',                       ['㎡'],        45000),
    ('floor_vinyl', '장판 2.2T(자재+시공)',        '㎡', r'장판',                         ['㎡'],        21000),
    ('maru_demo',   '기존 마루 철거',              '㎡', r'마루 철거',                    ['㎡'],        12000),
    ('baseboard',   '걸레받이',                    'm',  r'걸레받이',                     ['m'],         2500),
    ('molding',     '몰딩',                        'm',  r'몰딩',                         ['m'],         2800),
    ('bath_wp',     '욕실 방수(도급)',             '개소', r'욕실.*방수|방수.*욕실',       ['개소'],      200000),
    ('tile_day',    '타일 기술자',                 '품', r'타일.*(기술자|타일공)|타일공',  ['품', '일'],  350000),
    ('plumb_day',   '설비 기술자',                 '품', r'설비 기술자',                  ['품', '일'],  320000),
    ('paint_day',   '도장공',                      '품', r'도장공|도장 기술자',           ['품', '일'],  250000),
    ('mold_fix',    '곰팡이·결로 처리',            '식', r'곰팡이',                       ['식'],        100000),
    ('silicone',    '실리콘 재시공(욕실)',         '개소', r'실리콘',                     ['개소'],      50000),
    ('sash_ja',     '샷시 중급(자재+시공)',        '자²', r'샷시|이중창',                 ['자²'],       75000),
    # 실견적에 아직 줄로 없는 것 — 집지니 현장 기준(박혜리·답십리 정밀 견적 등)
    ('gypsum_m2',   '석고보드 교체·평탄화(자재+시공)', '㎡', r'석고보드.*(교체|평탄)',     ['㎡'],        22000),
    ('putty_m2',    '퍼티·면 정리',                '㎡', r'퍼티',                         ['㎡'],        8000),
    ('dry_day',     '제습·송풍 건조기 대여',        '일', r'건조기|제습기',                ['일'],        30000),
    ('leak_find',   '누수 탐지(장비)',             '회', r'누수 탐지',                    ['회'],        250000),
    ('protect',     '보양(세대·엘리베이터)',        '식', r'보양',                         ['식'],        80000),
    # 2026-11-14 재난 복구비(화재·침수·태풍) — 실견적에 줄이 생기면 그 중위값으로 바뀐다
    ('door_abs',    '방문 교체(ABS 문짝+부속)',     '짝', r'ABS.*도어|방문 교체',          ['짝'],        275000),
    ('soot_m2',     '그을음 세정(벽·천장)',         '㎡', r'그을음|분진 세정',             ['㎡'],        8000),
    ('ozone',       '탄내·악취 제거(오존 훈증)',    '식', r'오존|탈취',                    ['식'],        300000),
    ('elec_room',   '전기 배선·기구 교체 자재(방)',  '곳', r'배선 교체',                    ['곳', '식'],  150000),
    ('elec_day',    '전기 기술자',                  '품', r'전기 기술자',                  ['품', '일'],  320000),
    ('outlet',      '콘센트·스위치 교체',           '개', r'콘센트 교체',                  ['개'],        7000),
    ('pump',        '물 퍼내기·오물 제거',          '식', r'양수|물 퍼',                   ['식'],        250000),
    ('disinfect_m2','소독·방역(바닥)',              '㎡', r'소독|방역',                    ['㎡'],        5000),
    ('boiler',      '보일러·난방 분배기 점검·부품',  '식', r'보일러',                       ['식', '대'],  350000),
    ('kitchen_m',   '주방 하부장 교체',             'm',  r'하부장',                       ['m'],         450000),
    ('glass',       '창 유리 교체(복층, 장)',       '장', r'유리 교체',                    ['장'],        150000),
    ('win_sil',     '창 실리콘·빗물막이 재시공',     '창', r'창.*실리콘',                   ['창', '개소'], 50000),
    ('gyp_wall_m2', '벽 석고·단열 하부 교체',        '㎡', r'단열.*교체|벽 석고',           ['㎡'],        38000),
]

TRADE_MAP = [
    ('철거·준비', r'철거|사전준비'),
    ('샷시',      r'창호'),
    ('설비',      r'설비|수전|배관'),
    ('전기·조명', r'전기|조명'),
    ('목공',      r'목공'),
    ('욕실·타일', r'욕실|타일'),
    ('도장',      r'도장'),
    ('도배',      r'도배'),
    ('바닥',      r'바닥'),
    ('주방',      r'싱크|가구'),
    ('문·현관',   r'현관|도어'),
    ('베란다',    r'베란다|확장'),
    ('필름',      r'필름'),
]


def q(vals, p):
    v = sorted(vals)
    if not v: return 0
    k = (len(v) - 1) * p
    f = int(k); c = min(f + 1, len(v) - 1)
    return v[f] + (v[c] - v[f]) * (k - f)


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    lines = [l for c in d['cases'] for s in c['sections'] for l in s['lines']]
    items = {}
    for key, name, unit, pat, units, fb in ITEMS:
        got = [l['price'] for l in lines if l.get('price') and l.get('unit') in units and re.search(pat, l.get('item', ''))]
        if got:
            items[key] = {'name': name, 'unit': unit, 'price': int(round(statistics.median(got), -2)), 'n': len(got), 'basis': '집지니 실견적 %d줄 중위값' % len(got)}
        else:
            items[key] = {'name': name, 'unit': unit, 'price': fb, 'n': 0, 'basis': '집지니 현장 기준'}

    per = {t: [] for t, _ in TRADE_MAP}
    full = [c for c in d['cases'] if c.get('total', 0) >= 15000000 and c.get('py')]
    for c in full:
        acc = {}
        for s in c['sections']:
            for t, pat in TRADE_MAP:
                if re.search(pat, s['trade']):
                    acc[t] = acc.get(t, 0) + (s.get('subtotal') or 0); break
        for t, v in acc.items():
            if v > 0: per[t].append(v / c['py'])
    trades = {}
    for t, _ in TRADE_MAP:
        v = per[t]
        if v:
            trades[t] = {'p25': int(round(q(v, .25), -3)), 'p50': int(round(q(v, .5), -3)), 'p75': int(round(q(v, .75), -3)), 'n': len(v)}
    tot = [c['total'] / c['py'] for c in full]
    out = {
        'updated': datetime.date.today().isoformat(),
        'source': '집지니 실견적 %d건(올수리 %d건) · 금액은 부가세 10%% 별도' % (d.get('count', len(d['cases'])), len(full)),
        'items': items,
        'trades': trades,
        'full_per_py': {'p25': int(round(q(tot, .25), -3)), 'p50': int(round(q(tot, .5), -3)), 'p75': int(round(q(tot, .75), -3)), 'n': len(tot)},
    }
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1)[:3000])


if __name__ == '__main__':
    main()
