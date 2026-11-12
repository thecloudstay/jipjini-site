# -*- coding: utf-8 -*-
"""거꾸로 그려 맞추기(2026-11-12 대표 승인 「오케이 해 봐」): 우리 도면을 네이버 그리기 규칙대로 다시 그려 원본과 겹친다.
   네이버 평면은 캐드 자료를 정해진 규칙(벽 화소 두께 고정, 창 = 흰 띠 + 가는 선 두 줄, 문 = 문짝 선 + 4분의 1 호)으로 찍어 낸 그림이다
   → 우리 캐드 도면을 같은 규칙으로 그리면 원본과 같아야 한다. 다른 화소 = 틀린 자리(하나의 정답 기준).
   render(G, img) → (굵은 층, 가는 층)   compare(img, G) → {'벽재현','벽정밀','선재현','선정밀','일치'} + 차이 그림
   python3 tools/harness/rerender.py <그림폴더> <도면폴더(키.json)> [차이그림폴더]"""
import json, os, sys
import cv2, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); import plan_trace


def layers(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); v = hsv[..., 2].astype(int); s = hsv[..., 1].astype(int)
    thick = cv2.morphologyEx((v < 100).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0
    thin = (((v < 110) | ((v < 190) & (s < 40))) & ~(cv2.dilate(thick.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0))   # 굵은 벽 가장자리 번짐은 가는 선이 아니다
    return thick, thin, v


def _wall_px(v, ax, a, b, c, fb):
    """원본에서 벽 중심선을 가로질러 검정 길이(화소 두께)를 잰다 — 네이버 벽 두께는 화소 고정"""
    H, W = v.shape; runs = []
    for t in np.linspace(a + 2, b - 2, 7):
        n = 0
        for o in range(-12, 13):
            x, y = (int(round(t)), int(round(c + o))) if ax == 'h' else (int(round(c + o)), int(round(t)))
            if 0 <= x < W and 0 <= y < H and v[y, x] < 100: n += 1
        if 2 <= n <= 14: runs.append(n)
    return float(np.median(runs)) if runs else fb


def render(G, img, mm, fit=True):
    H, W = img.shape[:2]; _, thin0, v = layers(img); thd = cv2.dilate(thin0.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    TK = np.zeros((H, W), np.uint8); TN = np.zeros((H, W), np.uint8)
    for ax, a, b, c, t in G['벽선']:
        h = _wall_px(v, ax, a, b, c, max(3.0, t / mm * 0.5)) / 2.0
        if ax == 'h': cv2.rectangle(TK, (int(round(a)), int(round(c - h))), (int(round(b)), int(round(c + h - 1))), 1, -1)
        else: cv2.rectangle(TK, (int(round(c - h)), int(round(a))), (int(round(c + h - 1)), int(round(b))), 1, -1)
    for x1, y1, x2, y2, t in G.get('사선벽') or []: cv2.line(TK, (int(x1), int(y1)), (int(x2), int(y2)), 1, max(3, int(round(t / mm * 0.6))))
    for P in G.get('벽윤곽') or []: cv2.fillPoly(TK, [np.array(P, np.int32)], 1)
    def score_(ax, a, b, c):
        n = 0; m = 0
        for t in range(int(a), int(b) + 1, 2):
            for o in (-3, 3):
                x, y = (t, int(round(c + o))) if ax == 'h' else (int(round(c + o)), t)
                if 0 <= x < W and 0 <= y < H: m += 1; n += thd[y, x]
        return n / max(1, m)
    render.fit = []
    for ax, x0, y0, x1, y1 in G['샷시']:   # 창 = 띠의 두 긴 변 가는 선. 2단계: 띠 자리를 ±4화소 옮겨 원본과 가장 잘 맞는 곳(네이버는 두꺼운 외벽 창 띠를 한쪽 면에 붙인다)
        a, b, c = (x0, x1, (y0 + y1) / 2.0) if ax == 'h' else (y0, y1, (x0 + x1) / 2.0)
        best = max(((score_(ax, a, b, c + d), -abs(d), d) for d in range(-4, 5)) if fit else [(score_(ax, a, b, c), 0, 0)])
        render.fit.append((ax, x0, y0, x1, y1, best[2], round(best[0], 2))); c += best[2]
        if ax == 'h': cv2.line(TN, (x0, int(round(c - 3))), (x1, int(round(c - 3))), 1, 1); cv2.line(TN, (x0, int(round(c + 3))), (x1, int(round(c + 3))), 1, 1)
        else: cv2.line(TN, (int(round(c - 3)), y0), (int(round(c - 3)), y1), 1, 1); cv2.line(TN, (int(round(c + 3)), y0), (int(round(c + 3)), y1), 1, 1)
    for q in G['문']:   # 문짝 선 + 호(경첩 중심, 반지름 = 문짝 길이)
        hx, hy = q['x1'], q['y1']; lx, ly = q.get('cx', hx), q.get('cy', hy); sx, sy = q['x2'], q['y2']
        R = int(round(np.hypot(lx - hx, ly - hy)))
        if R < 3: continue
        cv2.line(TN, (int(hx), int(hy)), (int(lx), int(ly)), 1, 1)
        a1 = np.degrees(np.arctan2(ly - hy, lx - hx)); a2 = np.degrees(np.arctan2(sy - hy, sx - hx)); d = (a2 - a1 + 540) % 360 - 180
        cv2.ellipse(TN, (int(hx), int(hy)), (R, R), 0, a1, a1 + d, 1, 1)
    for x1, y1, x2, y2, t in G.get('사선창') or []:
        L = np.hypot(x2 - x1, y2 - y1) or 1; nx, ny = -(y2 - y1) / L * 3, (x2 - x1) / L * 3
        for sg in (-1, 1): cv2.line(TN, (int(x1 + sg * nx), int(y1 + sg * ny)), (int(x2 + sg * nx), int(y2 + sg * ny)), 1, 1)
    return TK > 0, TN > 0


def compare(img, G, mm):
    H, W = img.shape[:2]; thick, thin, _ = layers(img)
    X0, Y0, X1, Y1 = G.get('틀') or [0, 0, W, H]; box = np.zeros((H, W), bool); box[max(0, Y0 - 4):Y1 + 5, max(0, X0 - 4):X1 + 5] = True
    thick &= box; RK, RN = render(G, img, mm)
    d = lambda m, k: cv2.dilate(m.astype(np.uint8), np.ones((k, k), np.uint8)) > 0
    band = d(thick, 31) & box; thinb = thin & band   # 벽 근처 가는 선만(바닥 줄눈·글자 빼기)
    wr = (thick & d(RK, 3)).sum() / max(1, thick.sum()); wp = (RK & d(thick, 3)).sum() / max(1, RK.sum())
    lp = (RN & d(thin, 3)).sum() / max(1, RN.sum())
    # 가는 선 재현: 원본 벽 곁 가는 선 중 「띠·호처럼 길게 이어진 것」(벽에 붙은 가는 선 덩어리 20화소 넘게)
    n, lab, st, _ = cv2.connectedComponentsWithStats(thinb.astype(np.uint8), connectivity=8)
    tw = d(thick, 5); touch = np.bincount(lab[tw & (lab > 0)].ravel(), minlength=n) > 0   # 벽에 닿은 덩어리만(방 이름 글자는 벽에 안 닿는다)
    big = np.isin(lab, [j for j in range(1, n) if max(st[j, 2], st[j, 3]) >= 20 and touch[j]]); lr = (big & d(RN, 5)).sum() / max(1, big.sum())
    f = lambda p, r: 2 * p * r / max(1e-9, p + r)
    res = {'벽재현': round(wr, 3), '벽정밀': round(wp, 3), '선재현': round(lr, 3), '선정밀': round(lp, 3)}
    res['일치'] = round(100 * (0.6 * f(wp, wr) + 0.4 * f(lp, lr)), 1)
    diff = np.full((H, W, 3), 255, np.uint8)
    diff[thick & ~d(RK, 3)] = (0, 0, 255); diff[RK & ~d(thick, 3)] = (255, 0, 0)       # 빨강 = 원본 벽인데 없음, 파랑 = 원본에 없는 벽
    diff[big & ~d(RN, 5)] = (0, 140, 255); diff[RN & ~d(thin, 3)] = (255, 0, 255)     # 주황 = 원본 창·문 선인데 없음, 보라 = 원본에 없는 선
    diff[(thick & d(RK, 3))] = (200, 200, 200)
    return res, diff


if __name__ == '__main__':
    imgd, gd = sys.argv[1], sys.argv[2]; outd = sys.argv[3] if len(sys.argv) > 3 else None; rows = []
    if outd: os.makedirs(outd, exist_ok=True)
    for f in sorted(os.listdir(gd)):
        if not f.endswith('.json'): continue
        k = f[:-5]; G = json.load(open(os.path.join(gd, f), encoding='utf-8')); img = plan_trace.imread_u(os.path.join(imgd, k + '.jpg'))
        if img is None or not G.get('벽선'): continue
        mm = G.get('mmpp') or 23.0
        r, df = compare(img, G, mm); rows.append((k, r))
        if outd: cv2.imwrite(os.path.join(outd, k + '.png'), np.hstack([img, df]))
    for k, r in sorted(rows, key=lambda x: x[1]['일치']): print(k, r)
    a = lambda key: round(float(np.mean([r[key] for _, r in rows])), 3)
    print('평균', {k: a(k) for k in ('벽재현', '벽정밀', '선재현', '선정밀', '일치')}, len(rows), '장')
