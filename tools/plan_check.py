# 평면 기준판 점검기(2026-11-12): 원본 검정 굵은 선 대 집지니 벽 그림을 겹쳐 벗어남을 숫자로 잡는다
# 쓰는 법: python3 plan_check.py 원본그림폴더 data/plans  → 단지별 [놓침%, 군더더기%, 방-벽 엇갈림] 표
import json, os, re, sys, cv2, numpy as np
def path_mask(d, H, W):
    m = np.zeros((H, W), np.uint8)
    for seg in re.findall(r'M([^Z]+)Z', d or ''):
        n = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', seg)]
        pts = np.array([[n[i], n[i+1]] for i in range(0, len(n), 2)], np.int32)
        t = np.zeros((H, W), np.uint8); cv2.fillPoly(t, [pts], 1); m ^= t
    return m > 0
def check(img, p):
    a = cv2.imread(img); H, W = a.shape[:2]; hsv = cv2.cvtColor(a, cv2.COLOR_BGR2HSV); v = hsv[..., 2]
    house = np.zeros((H, W), np.uint8)
    for r in p['rooms']: cv2.fillPoly(house, [np.array(r['pts'], np.int32)], 1)
    ys, xs = np.where(house > 0); mm = p.get('mmpp') or 23.0; pad = int(1500 / mm)
    box = np.zeros((H, W), bool); X0, Y0, X1, Y1 = p['그림'].get('틀') or [xs.min()-pad, ys.min()-pad, xs.max()+pad, ys.max()+pad]
    box[max(0, Y0-6):Y1+7, max(0, X0-6):X1+7] = True   # 건물 네모 안만 본다(바깥 치수선은 원래 안 따는 것)
    orig = (cv2.morphologyEx((v < 100).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0) & box
    ours = path_mask(p['그림']['벽'], H, W)
    tol = lambda m: cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    miss = (orig & ~tol(ours)).sum() / max(1, orig.sum()); extra = (ours & ~tol(orig)).sum() / max(1, ours.sum())
    cross = []   # 방 다각형 안쪽(가장자리 0.3m 안)에 벽이 지나가면 방 테두리가 원본과 어긋난 것
    for r in p['rooms']:
        m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(r['pts'], np.int32)], 1)
        m = cv2.erode(m, np.ones((max(3, int(300/mm)),)*2, np.uint8)) > 0
        if m.sum() > 0 and (orig & m).sum() / m.sum() > 0.04: cross.append(r.get('name', '?'))
    return round(miss*100, 1), round(extra*100, 1), cross
if __name__ == '__main__':
    IMG, PL = sys.argv[1], sys.argv[2]
    for f in sorted(os.listdir(PL)):
        if not re.match(r'A\d+\.json$', f): continue
        code = f[:-5]; d = json.load(open(os.path.join(PL, f), encoding='utf-8'))
        for t in d['평형']:
            p = t['plan']
            if not p.get('그림'): continue
            c = [x for x in os.listdir(IMG) if x.startswith(code + '_')]
            o = [x for x in c if x[len(code)+1:-4] == str(t['이름'])] or c
            print(code, t['이름'], *check(os.path.join(IMG, o[0]), p), sep='\t')

# ── 규칙 점검(2026-11-12 대표 지시 「그리는 게 중요한 게 아니라 버그 규칙을 찾아서 앞으로 그렇게 안 되도록」)
#   변환할 때마다(plan_trace.trace 끝) 아래 규칙을 모두 돌려 어긴 곳을 '점검'에 남긴다. 규칙 번호별로 모아 세면 어디를 고칠지 바로 보인다.
#   규칙과 원인·고친 자리는 tools/naver_rules.md 「변환 규칙 점검표」에 같은 번호로 적는다. 새 불량을 찾으면 규칙을 먼저 더하고 고친다.
RULES = {
 'R1': '외벽 닫힘 — 벽·창·문만으로 바깥이 방 안까지 새면 안 된다',
 'R2': '창 두께 — 창은 붙은 벽과 같은 두께·같은 중심선',
 'R3': '창 끝 — 창 양 끝은 벽(또는 다른 창·문)에 붙는다',
 'R4': '모서리 — 벽 끝이 직각 벽 앞에서 멈춰 구멍이 나면 안 된다',
 'R5': '문 안전 — 양쪽이 건물 밖인 문 금지(현관 안쪽 문만 예외)',
 'R6': '놓친 벽 — 원본 굵은 검정선(450mm 넘게)이 우리 벽에 없으면 안 된다',
 'R7': '방 테두리 — 방 다각형 안쪽으로 원본 벽이 지나가면 방 읽기가 틀린 것',
 'R8': '창 없는 방(경고) — 바깥·발코니에 닿은 방·거실에 창이 하나도 없다',
 'R9': '벽 위 창 — 원본 굵은 벽선이 있는 줄에 창을 그리면 안 된다(창은 벽이 끊긴 자리에만, 2026-11-12 81평형 욕실·발코니 바깥벽)',
 'R11': '방 면적 정합성 — 방(발코니·공용·피트 빼고) 넓이 합이 전용면적의 0.8~1.25배를 벗어나면 방 경계나 축척을 잘못 읽은 것(2026-11-12)',
 'R12': '사선 가는 선 — 원본의 비스듬한 가는 선(창틀·난간, 600mm 넘고 한쪽 끝이 벽에 닿음)이 우리 구조에 없으면 안 된다(2026-11-12 검수 사각지대 메움)',
 'R10': '현관문 — 현관에는 문이 반드시 하나 있어야 하고, 현관 바깥쪽 경계에 창이 있으면 안 된다(2026-11-12 81평형)',
}
def _struct(G, mm, H, W, door_w=5):
    m = np.zeros((H, W), np.uint8)
    for ax, a, b, c, t in G['벽선']:
        h = max(1.5, t/mm/2)
        if ax == 'h': cv2.rectangle(m, (int(a)-1, int(c-h)), (int(b)+1, int(c+h)), 1, -1)
        else: cv2.rectangle(m, (int(c-h), int(a)-1), (int(c+h), int(b)+1), 1, -1)
    for ax, x0, y0, x1, y1 in G['샷시']: cv2.rectangle(m, (x0, y0), (x1, y1), 1, -1)
    for q in G['문']: cv2.line(m, (int(q['x1']), int(q['y1'])), (int(q['x2']), int(q['y2'])), 1, door_w)
    for x1, y1, x2, y2, t in G.get('사선벽') or []: cv2.line(m, (int(x1), int(y1)), (int(x2), int(y2)), 1, max(3, int(round(t / mm))))   # 2026-11-12 비스듬한 벽도 구조(빠뜨려 외벽 터짐으로 셌다)
    for x1, y1, x2, y2, t in G.get('사선창') or []: cv2.line(m, (int(x1), int(y1)), (int(x2), int(y2)), 1, max(3, int(round(t / mm))))
    for P_ in G.get('벽윤곽') or []: cv2.fillPoly(m, [np.array(P_, np.int32)], 1)   # 2026-11-12 남은 벽 외곽선(사선·계단·곡선)
    return m
def rules(img, p):
    """img: BGR 그림(없으면 R6·R7 생략). 돌려줌: [[규칙, 이름, x, y], ...]"""
    G = p['그림']; mm = p.get('mmpp') or 23.0; R = p['rooms']
    H, W = (img.shape[:2] if img is not None else (p['H'], p['W'])); out = []
    poly = lambda r: np.array(r['pts'], np.int32)
    roomk = lambda x, y: next((r for r in R if len(r['pts']) >= 3 and cv2.pointPolygonTest(poly(r).reshape(-1, 1, 2).astype(np.float32), (float(x), float(y)), False) > 0), None)
    m = cv2.dilate(_struct(G, mm, H, W), np.ones((3, 3), np.uint8))
    ff = m*255; mk = np.zeros((H+2, W+2), np.uint8); cv2.floodFill(ff, mk, (0, 0), 128); outside = ff == 128
    # R1: 방 가장자리 바로 안쪽에 바깥이 들어온 자리
    for r in R:
        if len(r['pts']) < 3 or r.get('kind') == '공용': continue
        rm = np.zeros((H, W), np.uint8); cv2.fillPoly(rm, [poly(r)], 1)
        ring = (cv2.erode(rm, np.ones((3, 3), np.uint8)) > 0) & ~(cv2.erode(rm, np.ones((13, 13), np.uint8)) > 0) & outside
        core = cv2.erode(rm, np.ones((13, 13), np.uint8)) > 0
        if core.sum() and outside[core].mean() > 0.2:
            ys, xs = np.where(ring) if ring.any() else np.where(core)
            out.append(['R1', r.get('name'), int(np.median(xs)), int(np.median(ys))])
    # 벽 줄 찾기 도우미
    def near_wall(ax, c, a, b):
        best = None
        for w in G['벽선']:
            if w[0] == ax and abs(w[3]-c) <= 12 and min(b, w[2])-max(a, w[1]) > -12 and (best is None or abs(w[3]-c) < abs(best[3]-c)): best = w
        return best
    for q in G['샷시']:
        ax, x0, y0, x1, y1 = q
        a, b, c, th = (x0, x1, (y0+y1)/2, y1-y0) if ax == 'h' else (y0, y1, (x0+x1)/2, x1-x0)
        w = near_wall(ax, c, a, b)
        if w and (abs(th - w[4]/mm) > 2.5 or abs(c - w[3]) > 2.5): out.append(['R2', '창', int((x0+x1)/2), int((y0+y1)/2)])
        for e in (a, b):   # R3: 끝 바로 바깥(3화소)이 다른 구조에 닿는가
            px, py = (e + (-3 if e == a else 3), c) if ax == 'h' else (c, e + (-3 if e == a else 3))
            px, py = int(px), int(py)
            if 0 <= px < W and 0 <= py < H and not m[max(0, py-2):py+3, max(0, px-2):px+3].any(): out.append(['R3', '창 끝', px, py])
    _S = _struct(G, mm, H, W)
    opening = np.zeros((H, W), np.uint8)
    for ax_, x0, y0, x1, y1 in G['샷시']: cv2.rectangle(opening, (x0, y0), (x1, y1), 1, -1)
    for q in G['문']: cv2.line(opening, (int(q['x1']), int(q['y1'])), (int(q['x2']), int(q['y2'])), 1, 5)
    opening = cv2.dilate(opening, np.ones((5, 5), np.uint8))
    for w in G['벽선']:   # R4 (문·창에 닿은 벽 끝은 문틀 자리라 모서리 구멍이 아니다 — 2026-11-12 고침)
        ax, a, b, c, t = w
        for e, sgn in ((a, -1), (b, 1)):
            ex, ey = (int(e), int(c)) if ax == 'h' else (int(c), int(e))
            if 0 <= ex < W and 0 <= ey < H and opening[ey, ex]: continue
            # 끝 바로 너머(3화소)가 이미 다른 벽·창·문에 닿아 있으면 구멍이 아니다(2026-11-12 고침: 문틀 메움 조각 끝을 구멍으로 잘못 셌다)
            bx_, by_ = (int(e + sgn*3), int(c)) if ax == 'h' else (int(c), int(e + sgn*3))
            if 0 <= bx_ < W and 0 <= by_ < H and _S[by_, bx_]: continue
            # 끝이 이미 직각 벽의 두께 안(면에 닿음)에 있으면 구멍이 아니다
            if any(u[0] != ax and u[1]-t/mm/2-2 <= c <= u[2]+t/mm/2+2 and abs(u[3]-e) <= u[4]/mm/2+1.5 for u in G['벽선']): continue
            for u in G['벽선']:
                if u[0] == ax: continue
                hu = u[4]/mm/2; hw = t/mm/2
                if not (u[1]-hw-2 <= c <= u[2]+hw+2): continue
                gap = (u[3]-hu - e) if sgn > 0 else (e - (u[3]+hu))
                if 1.0 < gap <= 400.0/mm:
                    mid = e + sgn*gap/2.0   # 틈 한가운데가 이미 다른 구조로 덮였으면 구멍이 아니다(2026-11-12 고침)
                    mx_, my_ = (int(mid), int(c)) if ax == 'h' else (int(c), int(mid))
                    if 0 <= mx_ < W and 0 <= my_ < H and _S[my_, mx_]: continue
                    out.append(['R4', '모서리', int(e if ax == 'h' else c), int(c if ax == 'h' else e)])
    off = 600.0/mm   # R5
    for d in G['문']:
        L = ((d['x2']-d['x1'])**2+(d['y2']-d['y1'])**2)**.5 or 1; ux, uy = (d['x2']-d['x1'])/L, (d['y2']-d['y1'])/L; mx, my = (d['x1']+d['x2'])/2, (d['y1']+d['y2'])/2
        P = [(mx-uy*off, my+ux*off), (mx+uy*off, my-ux*off)]
        # 방 다각형 안(바닥이 있는 곳)은 바깥이 아니다 — 외벽이 터져 새는 것은 R1 이 따로 센다(2026-11-12 고침: 새는 현관의 현관문을 R5 로 겹쳐 셌다)
        o = [not (0 <= int(x) < W and 0 <= int(y) < H) or (bool(outside[int(y), int(x)]) and roomk(x, y) is None) for x, y in P]
        if img is not None:   # 회색으로 칠한 칸(실외기실)은 바깥이 아니다 — 발코니→실외기실 문은 정상(2026-11-12 107·89·100A 확인)
            hv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            for k, (x, y) in enumerate(P):
                if o[k] and 0 <= int(x) < W and 0 <= int(y) < H:
                    b = hv[max(0, int(y)-3):int(y)+4, max(0, int(x)-3):int(x)+4].reshape(-1, 3)
                    if ((b[:, 2] >= 195) & (b[:, 2] <= 238) & (b[:, 1] < 20)).mean() > 0.8: o[k] = False
        if o[0] and o[1]: out.append(['R5', '문', int(mx), int(my)])
        elif o[0] or o[1]:
            inner = roomk(*P[1] if o[0] else P[0])
            if not inner or inner.get('kind') != '현관': out.append(['R5', '문', int(mx), int(my)])
    if img is not None:
        v = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 2]
        X0, Y0, X1, Y1 = G.get('틀') or [0, 0, W, H]
        box = np.zeros((H, W), bool); box[max(0, Y0-6):Y1+7, max(0, X0-6):X1+7] = True
        orig = (cv2.morphologyEx((v < 100).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0) & box
        L = max(8, int(450/mm))
        lines = (cv2.morphologyEx(orig.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, L), np.uint8)) | cv2.morphologyEx(orig.astype(np.uint8), cv2.MORPH_OPEN, np.ones((L, 1), np.uint8))) > 0
        miss = lines & ~(cv2.dilate(m, np.ones((7, 7), np.uint8)) > 0)
        n, lab, st, _ = cv2.connectedComponentsWithStats(miss.astype(np.uint8))
        for j in range(1, n):
            if max(st[j, 2], st[j, 3]) >= L: out.append(['R6', '벽', int(st[j, 0]+st[j, 2]/2), int(st[j, 1]+st[j, 3]/2)])
        for r in R:   # R7
            rm = np.zeros((H, W), np.uint8); cv2.fillPoly(rm, [poly(r)], 1)
            rm = cv2.erode(rm, np.ones((max(3, int(300/mm)),)*2, np.uint8)) > 0
            if rm.sum() > 0 and (lines & rm).sum() / rm.sum() > 0.02:
                ys, xs = np.where(lines & rm); out.append(['R7', r.get('name'), int(np.median(xs)), int(np.median(ys))])
    for q in G['샷시']:   # R9: 같은 줄에 벽선이 겹치는 창
        ax, x0, y0, x1, y1 = q
        a, b, c = (x0, x1, (y0+y1)/2) if ax == 'h' else (y0, y1, (x0+x1)/2)
        cov = sum(max(0, min(b, w[2]) - max(a, w[1])) for w in G['벽선'] if w[0] == ax and abs(w[3]-c) <= w[4]/mm/2 + 3)
        if cov > 0.3*max(1, b-a): out.append(['R9', '창', int((x0+x1)/2), int((y0+y1)/2)])
    for r in R:   # R10: 현관문
        if r.get('kind') != '현관' or len(r['pts']) < 3: continue
        rm = np.zeros((H, W), np.uint8); cv2.fillPoly(rm, [poly(r)], 1); ring = cv2.dilate(rm, np.ones((int(500/mm) | 1,)*2, np.uint8)) > 0
        has = any(ring[min(H-1, max(0, int((q['y1']+q['y2'])/2))), min(W-1, max(0, int((q['x1']+q['x2'])/2)))] for q in G['문'])
        P = np.array(r['pts']); cx_, cy_ = P.mean(0)
        # 2026-11-12 규칙 바로잡음(130·178 눈으로 확인): 방 다각형이 벽 안쪽 면보다 안으로 들어가 제자리 현관문이 250mm 밖으로 밀린다
        #   → 현관 다각형에서 24화소 안이고 문짝 끝이 현관 밖으로 더 멀리 나가는(바깥여닫이) 문도 현관문이다 — 옆방 문(안으로 여는)은 안 셈
        Pf = P.reshape(-1, 1, 2).astype(np.float32); dist = lambda x, y: cv2.pointPolygonTest(Pf, (float(x), float(y)), True)
        has = has or any(-24 <= dist((q['x1']+q['x2'])/2, (q['y1']+q['y2'])/2) and dist(q.get('cx', 0), q.get('cy', 0)) < dist((q['x1']+q['x2'])/2, (q['y1']+q['y2'])/2) - 8 and dist((q['x1']+q['x2'])/2, (q['y1']+q['y2'])/2) <= 4 for q in G['문'])
        if not has: out.append(['R10', r.get('name'), int(cx_), int(cy_)])
        for ax, x0, y0, x1, y1 in G['샷시']:
            mx, my = int((x0+x1)/2), int((y0+y1)/2)
            if 0 <= mx < W and 0 <= my < H and ring[my, mx] and outside[max(0, my-12):my+13, max(0, mx-12):mx+13].any(): out.append(['R10', '현관 창', mx, my])
    if p.get('전용'):   # R11: 방 넓이 합 대 전용면적(43장에서 중간 0.97배, 열에 여덟이 0.89~1.14배)
        px = sum(abs(cv2.contourArea(np.array(r['pts'], np.float32))) for r in R if len(r['pts']) >= 3 and r.get('kind') not in ('발코니', '공용', '피트'))
        ratio = px * mm * mm / (float(p['전용']) * 1e6)
        if not (0.8 <= ratio <= 1.25): out.append(['R11', '면적 %.2f배' % ratio, W // 2, H // 2])
    if img is not None:   # R12: 비스듬한 가는 선 놓침(가로·세로만 보던 R6·발견의 사각지대)
        hv_ = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); vv = hv_[..., 2].astype(int); ss = hv_[..., 1].astype(int)
        thick_ = cv2.morphologyEx((vv < 100).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0
        thin_ = ((((vv < 110) | ((vv < 200) & (ss < 45))) & ~thick_)).astype(np.uint8) * 255
        X0_, Y0_, X1_, Y1_ = G.get('틀') or [0, 0, W, H]; thin_[:max(0, Y0_-4)] = 0; thin_[Y1_+5:] = 0; thin_[:, :max(0, X0_-4)] = 0; thin_[:, X1_+5:] = 0
        Ls = cv2.HoughLinesP(thin_, 1, np.pi/360, threshold=max(10, int(500/mm)), minLineLength=max(15, int(600/mm)), maxLineGap=4)
        sd = cv2.dilate(_S, np.ones((7, 7), np.uint8)) > 0; seen = []
        for x1, y1, x2, y2 in (Ls.reshape(-1, 4) if Ls is not None else []):
            a_ = np.degrees(np.arctan2(y2-y1, x2-x1)) % 180
            if min(a_, abs(a_-90), 180-a_) < 15: continue
            n_ = max(8, int(np.hypot(x2-x1, y2-y1)/3)); xs_ = np.linspace(x1, x2, n_).astype(int); ys_ = np.linspace(y1, y2, n_).astype(int)
            if sd[ys_, xs_].mean() > 0.3: continue
            if not (thick_[max(0, y1-6):y1+7, max(0, x1-6):x1+7].any() or thick_[max(0, y2-6):y2+7, max(0, x2-6):x2+7].any()): continue
            # 네이버 창 기호 = 가는 선 두 줄 나란히(수직 단면에 선 두 줄) — 설비 가위표·문 호·기구 선은 한 줄이라 뺀다
            Ln_ = np.hypot(x2-x1, y2-y1) or 1; ux_, uy_ = (x2-x1)/Ln_, (y2-y1)/Ln_; nx_, ny_ = -uy_, ux_; tb_ = thin_ > 0; two = 0; tot = 0
            for tt in np.linspace(2, Ln_-2, max(8, int(Ln_/3))):
                runs = 0; prev = False
                for o in range(-10, 11):
                    X_, Y_ = int(round(x1+ux_*tt+nx_*o)), int(round(y1+uy_*tt+ny_*o))
                    on = 0 <= X_ < W and 0 <= Y_ < H and tb_[Y_, X_]
                    if on and not prev: runs += 1
                    prev = on
                tot += 1; two += runs >= 2
            if two < 0.6*tot: continue
            # 설비 통로 가위표: 같은 가운데를 반대 기울기 선이 지나가면 뺀다
            # 2026-11-12 규칙 바로잡음(154·177B·110A·158C·200 눈으로 확인 — 피트 X 표시를 사선 선으로 셌다): 선 찾기가 대각선 일부만 잡아
            #   가운데가 X 교차점에서 벗어났다 → 선을 앞뒤로 반씩 늘린 범위 어디서든 반대 기울기 선이 지나가면 가위표다
            #   (45도 돌린 평면에서는 수직으로 만나는 굵은 벽 테두리 번짐이 반대 기울기 선으로 잡혀 진짜 사선 창을 빼 버렸다(162) → 굵은 벽 곁 화소는 안 센다)
            vx_, vy_ = ux_, -uy_; isx = False
            if 'tbx_' not in dir(): tbx_ = tb_ & ~(cv2.dilate(thick_.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
            for tt in np.linspace(-Ln_*0.5, Ln_*1.5, max(10, int(Ln_))):
                mx_, my_ = x1+ux_*tt, y1+uy_*tt; hits_ = 0
                for o in range(-12, 13, 2):
                    X_, Y_ = int(round(mx_+vx_*o)), int(round(my_+vy_*o))
                    if 0 <= X_ < W and 0 <= Y_ < H and tbx_[max(0, Y_-1):Y_+2, max(0, X_-1):X_+2].any(): hits_ += 1
                if hits_ >= 10: isx = True; break
            if isx: continue
            cx_, cy_ = int((x1+x2)/2), int((y1+y2)/2)
            if any(abs(cx_-a)+abs(cy_-b) < 15 for a, b in seen): continue
            seen.append((cx_, cy_)); out.append(['R12', '사선 선', cx_, cy_])
    for r in R:   # R8
        if r.get('kind') not in ('방', '거실'): continue
        P = np.array(r['pts']); x0, y0 = P.min(0); x1, y1 = P.max(0)
        rm = np.zeros((H, W), np.uint8); cv2.fillPoly(rm, [poly(r)], 1); ring = (cv2.dilate(rm, np.ones((int(900/mm)|1,)*2, np.uint8)) > 0) & ~(rm > 0)
        touch = (ring & outside).any() or any(rr.get('kind') == '발코니' and (ring & (cv2.fillPoly(np.zeros((H, W), np.uint8), [poly(rr)], 1) > 0)).any() for rr in R)
        has = any(a0 < x1+12 and a1 > x0-12 and b0 < y1+12 and b1 > y0-12 for _, a0, b0, a1, b1 in G['샷시'])
        if touch and not has: out.append(['R8', r.get('name'), int((x0+x1)/2), int((y0+y1)/2)])
    return out
