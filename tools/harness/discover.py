# -*- coding: utf-8 -*-
"""규칙 찾기(2026-11-12 대표 지시 「스스로 규칙을 찾아내고 그 규칙을 계속 반영해 가면서 일하는 자가 개선 고리」)

원본 그림과 우리 변환을 겹쳐 「다른 곳」을 모두 뽑고, 다른 곳마다 모양 표식(종류·방향·길이·자리·끝)을 붙여
여러 평면에서 되풀이되는 표식을 묶는다. 묶음 = 아직 이름 없는 불량 규칙 후보.
- 이미 아는 표식은 tools/harness/알려진모양.json(표식 → 규칙 번호 또는 「무시: 이유」)에 있다.
- 처음 보는 표식이 2개 평면 이상·3곳 이상이면 「새 규칙 후보」로 올린다 → 고리가 plan_check.py 에 규칙을 더하고 고친다.
원본 그림은 이 컴퓨터(작업 환경) 안에서만 읽고, 결과에는 좌표·숫자만 남긴다.
"""
import cv2, numpy as np

def _lenb(mm_len):
    return '0.3~0.6m' if mm_len < 600 else '0.6~1.5m' if mm_len < 1500 else '1.5~3m' if mm_len < 3000 else '3m+'

def struct_mask(G, mm, H, W):
    m = np.zeros((H, W), np.uint8)
    for ax, a, b, c, t in G['벽선']:
        h = max(1.5, t/mm/2)
        if ax == 'h': cv2.rectangle(m, (int(a)-1, int(c-h)), (int(b)+1, int(c+h)), 1, -1)
        else: cv2.rectangle(m, (int(c-h), int(a)-1), (int(c+h), int(b)+1), 1, -1)
    for ax, x0, y0, x1, y1 in G['샷시']: cv2.rectangle(m, (x0, y0), (x1, y1), 1, -1)
    for q in G['문']:
        cv2.line(m, (int(q['x1']), int(q['y1'])), (int(q['x2']), int(q['y2'])), 1, 5)
        cv2.line(m, (int(q['x1']), int(q['y1'])), (int(q.get('cx', q['x1'])), int(q.get('cy', q['y1']))), 1, 3)
    for x1, y1, x2, y2, t in G.get('사선벽') or []: cv2.line(m, (int(x1), int(y1)), (int(x2), int(y2)), 1, max(2, int(t/mm)))
    return m

def find(img, p):
    """돌려줌: [{'표식':..., 'x':..., 'y':..., 'mm':...}, ...]"""
    G = p['그림']; mm = p.get('mmpp') or 23.0; R = p['rooms']; H, W = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); v = hsv[..., 2].astype(int); s = hsv[..., 1].astype(int)
    X0, Y0, X1, Y1 = G.get('틀') or [0, 0, W, H]
    box = np.zeros((H, W), bool); box[max(0, Y0-4):Y1+5, max(0, X0-4):X1+5] = True
    thick = (cv2.morphologyEx((v < 100).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0) & box
    ink = (((v < 110) | ((v < 205) & (s < 45))) & box)
    thin = ink & ~(cv2.dilate(thick.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    ours = struct_mask(G, mm, H, W)
    oursd = cv2.dilate(ours, np.ones((7, 7), np.uint8)) > 0
    # 자리 판단 도구
    ff = cv2.dilate(ours, np.ones((3, 3), np.uint8))*255; mk = np.zeros((H+2, W+2), np.uint8); cv2.floodFill(ff, mk, (0, 0), 128); outside = ff == 128
    polys = [(r, np.array(r['pts'], np.float32).reshape(-1, 1, 2)) for r in R if len(r['pts']) >= 3]
    def kind(x, y):
        if not (0 <= int(x) < W and 0 <= int(y) < H): return '밖'
        for r, P in polys:
            if cv2.pointPolygonTest(P, (float(x), float(y)), False) > 0:
                k = r.get('kind') or '?'
                return k if k in ('발코니', '욕실', '현관', '주방', '피트', '공용') else '실'
        if outside[int(y), int(x)]: return '밖'
        b = hsv[max(0, int(y)-2):int(y)+3, max(0, int(x)-2):int(x)+3].reshape(-1, 3)
        if ((b[:, 2] >= 195) & (b[:, 2] <= 238) & (b[:, 1] < 20)).mean() > 0.8: return '회색칸'
        return '빈곳'
    out = []
    def comps(mask, minpx, label, use_axis=True):
        n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
        for j in range(1, n):
            x, y, w, h, a = st[j]
            L = max(w, h)
            if L < minpx: continue
            ax = '가로' if w >= h*2.5 else '세로' if h >= w*2.5 else '덩어리'
            cx, cy = x + w/2.0, y + h/2.0; o = max(w, h if ax == '가로' else w)/2.0 if False else (min(w, h)/2.0 + 400.0/mm)
            if ax == '가로': A, B = kind(cx, cy-o), kind(cx, cy+o)
            elif ax == '세로': A, B = kind(cx-o, cy), kind(cx+o, cy)
            else: A, B = kind(cx, cy), kind(cx, cy)
            side = '-'.join(sorted([A, B]))
            # 끝 닿음: 길이 방향 양 끝 바로 너머가 우리 구조에 닿는가
            if ax == '가로': e = [ours[int(cy), max(0, x-4):x].any(), ours[int(cy), x+w:min(W, x+w+4)].any()]
            elif ax == '세로': e = [ours[max(0, y-4):y, int(cx)].any(), ours[y+h:min(H, y+h+4), int(cx)].any()]
            else: e = [False, False]
            end = '양끝구조' if all(e) else '한끝구조' if any(e) else '떠있음'
            out.append({'표식': '|'.join([label, ax, _lenb(L*mm), side, end]), 'x': int(cx), 'y': int(cy), 'mm': int(L*mm)})
    Lp = max(8, int(300/mm))
    # 1) 놓친 굵은 선: 원본 굵은 검정 줄(가로·세로 곧은 것)이 우리 구조에 없음
    hv = (cv2.morphologyEx(thick.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, Lp), np.uint8)) | cv2.morphologyEx(thick.astype(np.uint8), cv2.MORPH_OPEN, np.ones((Lp, 1), np.uint8))) > 0
    comps(hv & ~oursd, Lp, '놓친굵은선')
    # 2) 군더더기: 우리 벽인데 원본에 아무 선도 없음
    #    벽 두께는 표준(250·200·120)으로 고쳐 그리므로 면적이 아니라 「중심선」으로 견준다 — 중심선 ±3화소 안에 원본 선이 없으면 없는 벽
    cen = np.zeros((H, W), np.uint8)
    for ax, a, b, c, t in G['벽선']:
        if ax == 'h': cv2.line(cen, (int(a)+2, int(round(c))), (int(b)-2, int(round(c))), 1, 1)
        else: cv2.line(cen, (int(round(c)), int(a)+2), (int(round(c)), int(b)-2), 1, 1)
    for ax, x0, y0, x1, y1 in G['샷시']:
        if ax == 'h': cv2.line(cen, (x0+2, (y0+y1)//2), (x1-2, (y0+y1)//2), 1, 1)
        else: cv2.line(cen, ((x0+x1)//2, y0+2), ((x0+x1)//2, y1-2), 1, 1)
    inkd = cv2.dilate(ink.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    comps(cv2.dilate(((cen > 0) & ~inkd & box).astype(np.uint8), np.ones((1, 1), np.uint8)) > 0, Lp, '군더더기')
    # 3) 놓친 가는 선: 우리 구조 가까이(벽 띠 0.6m 안)의 곧은 가는 선(창틀·문틀·난간) 가운데 우리에 없는 것
    Lt = max(10, int(500/mm))
    tl = (cv2.morphologyEx(thin.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, Lt), np.uint8)) | cv2.morphologyEx(thin.astype(np.uint8), cv2.MORPH_OPEN, np.ones((Lt, 1), np.uint8))) > 0
    near = cv2.dilate(ours, np.ones((int(600/mm) | 1,)*2, np.uint8)) > 0
    comps(tl & near & ~oursd, Lt, '놓친가는선')
    return out
