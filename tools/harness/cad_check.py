# -*- coding: utf-8 -*-
"""캐드 변환 교차 검증(2026-11-12 대표 제안 「교차 검측」): 내보낸 오토캐드 교환 파일(data/cad/*.dxf)을 다시 읽어
   벽 채움(A-WALL-PATT)을 화소로 되돌려 그린 것과, 같은 평면 자료의 벽 구조(그림)를 겹쳐 맞는 정도(겹침 비율)를 잰다 — 내보내기에서 벽이 빠지거나 어긋나면 드러난다.
   python3 tools/harness/cad_check.py   → 평면마다 겹침 비율, 0.9 아래는 「확인 필요」"""
import json, glob, os, sys
import cv2, numpy as np, ezdxf
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import plan_check
bad = 0; rows = []
for f in sorted(glob.glob(os.path.join(ROOT, 'data/plans/A*.json'))):
    code = os.path.basename(f)[:-5]
    for t in json.load(open(f, encoding='utf-8'))['평형']:
        p = t['plan']; G = p['그림']; mm = p['mmpp']; H, W = p['H'], p['W']; X0, Y0, X1, Y1 = G.get('틀') or [0, 0, W, H]
        dx = os.path.join(ROOT, 'data/cad', '%s_%s.dxf' % (code, t['이름']))
        if not os.path.exists(dx): rows.append((code, t['이름'], '파일 없음')); bad += 1; continue
        ours = np.zeros((H, W), np.uint8)
        for ax, a, b, c, th in G['벽선']:
            h = th / mm / 2
            if ax == 'h': cv2.rectangle(ours, (int(a), int(c-h)), (int(b), int(c+h)), 1, -1)
            else: cv2.rectangle(ours, (int(c-h), int(a)), (int(c+h), int(b)), 1, -1)
        for x1, y1, x2, y2, th in G.get('사선벽') or []: cv2.line(ours, (int(x1), int(y1)), (int(x2), int(y2)), 1, max(3, int(round(th/mm))))
        for P_ in G.get('벽윤곽') or []: cv2.fillPoly(ours, [np.array(P_, np.int32)], 1)
        back = np.zeros((H, W), np.uint8)
        for e in ezdxf.readfile(dx).modelspace().query('HATCH[layer=="A-WALL-PATT"]'):
            for path in e.paths:
                pts = [(v[0], v[1]) for v in getattr(path, 'vertices', [])]
                if len(pts) >= 3: cv2.fillPoly(back, [np.array([[x / mm + X0, Y1 - y / mm] for x, y in pts], np.int32)], 1)
        o = cv2.dilate(ours, np.ones((3, 3), np.uint8)) > 0; b_ = cv2.dilate(back, np.ones((3, 3), np.uint8)) > 0
        iou = (o & b_).sum() / max(1, (o | b_).sum())
        rows.append((code, t['이름'], round(float(iou), 3)))
        if iou < 0.9: bad += 1
for r in rows: print(*r)
print('확인 필요', bad, '/', len(rows))
