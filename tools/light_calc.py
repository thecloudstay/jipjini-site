# -*- coding: utf-8 -*-
r"""조명 배치·조도·음영 계산 — 견적에 조명이 들어가면 항상 돌린다 (2026-11-13 대표 「이 음영구역 조도계산 기능도 항상 탑재」).
   대표 배치 기준: 기본은 전체 매입등 · 베란다(발코니·다용도)는 직부등 · 현관은 센서등
                   등 간격 약 1.5m · 작은 방 4개 이상 · 큰 방(안방) 6개 이상
   그 배치로 방마다 바닥 위 0.85m 작업면을 10cm 칸으로 나눠 등마다 거리·각도로 밝기를 더한다(점광원, 코사인 법칙).
   평균이 목표 이상이고 음영(목표의 절반 미만 칸)이 3% 이하가 될 때까지 등을 하나씩 더한다.
   입력: 집지니 도면 json(rooms[name,kind,pts], mmpp)   출력: 방별 개수·위치·평균·최소·균제도·음영%·칸별 값
   python3 tools/light_calc.py 도면.json [결과.json]"""
import json, math, sys
import numpy as np, cv2

CEIL, WP, LM, MF, REFL = 2.3, 0.85, 1200, 0.8, 1.25   # 천장고 m · 작업면 m · 4인치 15W 매입등 광속 · 보수율 · 천장·벽 반사 보정
TARGET = {'거실': 200, '주방': 300, '방': 150, '욕실': 200, '드레스룸': 200}   # 럭스 (한국산업표준 주택 조도 범위 안)
SP, MAXGAP, SHADOW = 1.5, 1.8, 0.03
NO_DL = ('발코니', '현관', '피트', '공용', '기타')     # 매입등 계산 대상 아님 (발코니·다용도 직부등 · 현관 센서등)


def _inside(P, x, y):
    return cv2.pointPolygonTest(np.array(P, np.float32), (float(x), float(y)), False) >= 0


def room_min(name, kind, area):
    if kind != '방':
        return 0
    return 6 if ('안방' in name or area >= 12) else 4        # 큰 방 6개 · 작은 방 4개 이상


def calc_room(P, mm, kind, name='', ceil=CEIL):
    h = ceil - WP; I0 = LM * MF / math.pi; step = 100 / mm
    xs = [p[0] for p in P]; ys = [p[1] for p in P]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cells = np.array([(gx, gy) for gx in np.arange(x0 + step / 2, x1, step) for gy in np.arange(y0 + step / 2, y1, step) if _inside(P, gx, gy)])
    if not len(cells):
        return None
    area = abs(cv2.contourArea(np.array(P, np.float32))) * mm * mm / 1e6
    E = TARGET.get(kind, 150); w = (x1 - x0) * mm / 1000; d = (y1 - y0) * mm / 1000

    def lux(pts):
        if not pts: return np.zeros(len(cells))
        F = np.array(pts); dxy = np.hypot(cells[:, None, 0] - F[None, :, 0], cells[:, None, 1] - F[None, :, 1]) * mm / 1000
        dist2 = dxy ** 2 + h * h; c = h / np.sqrt(dist2)
        return (I0 * c * c / dist2).sum(1) * REFL

    nx = max(1, round(w / SP)); ny = max(1, round(d / SP))
    if w / nx > MAXGAP: nx += 1
    if d / ny > MAXGAP: ny += 1
    if kind in ('욕실', '드레스룸'): nx, ny = (1, 2) if d >= w else (2, 1)
    grow = lambda: (nx + 1, ny) if w / nx >= d / ny else (nx, ny + 1)
    while nx * ny < room_min(name, kind, area): nx, ny = grow()
    for _ in range(8):
        pts = [(x0 + (i + .5) * (x1 - x0) / nx, y0 + (j + .5) * (y1 - y0) / ny) for i in range(nx) for j in range(ny)]
        pts = [p for p in pts if _inside(P, *p)]; v = lux(pts)
        if v.mean() >= E and (v < 0.5 * E).mean() <= SHADOW: break
        nx, ny = grow()
    return {'kind': kind, 'E': E, 'A': round(area, 1), '개수': len(pts), 'pts': [list(map(float, p)) for p in pts],
            '간격': '%.1f×%.1fm' % (w / nx, d / ny), '평균': round(float(v.mean())), '최소': round(float(v.min())),
            '균제도': round(float(v.min() / max(v.mean(), 1)), 2), '음영': round(float((v < 0.5 * E).mean()) * 100, 1),
            '방습': kind == '욕실', 'cells': [(float(a), float(b), float(e)) for (a, b), e in zip(cells, v)]}


def calc_plan(plan, ceil=CEIL):
    mm = plan['mmpp']; out = {}
    for r in plan.get('rooms') or []:
        kind = r.get('kind') or ''; name = r.get('name') or kind
        if kind in NO_DL or kind not in TARGET or len(r.get('pts') or []) < 3: continue
        o = calc_room(r['pts'], mm, kind, name, ceil)
        if o: out[name if name not in out else name + '_%d' % len(out)] = o
    rooms = plan.get('rooms') or []
    dl = sum(o['개수'] for o in out.values() if not o['방습']); wet = sum(o['개수'] for o in out.values() if o['방습'])
    bal = sum(1 for r in rooms if r.get('kind') == '발코니') ; ent = sum(1 for r in rooms if r.get('kind') == '현관')
    summary = {'매입등': dl, '방습형 매입등': wet, '현관 센서등': max(1, ent) if rooms else 0, '발코니·다용도 직부등(최소)': bal,
               '음영 남은 방': [k for k, o in out.items() if o['음영'] > SHADOW * 100], '기준': '간격 약 %.1fm · 작은 방 4개·큰 방 6개 이상 · 음영 %d%% 이하' % (SP, SHADOW * 100)}
    return {'방': out, '합계': summary}


if __name__ == '__main__':
    d = json.load(open(sys.argv[1], encoding='utf-8')); r = calc_plan(d)
    for k, o in r['방'].items():
        print(k, o['A'], '㎡', o['개수'], '개', o['간격'], '평균', o['평균'], '음영%', o['음영'])
    print(json.dumps(r['합계'], ensure_ascii=False))
    if len(sys.argv) > 2: json.dump(r, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
