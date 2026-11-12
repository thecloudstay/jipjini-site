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
