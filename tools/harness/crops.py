# -*- coding: utf-8 -*-
"""후보 묶음마다 예 4곳을 잘라 한 장으로(원본 | 우리 구조 겹침). 고리가 「이게 진짜 불량인가」를 눈으로 가릴 때 쓴다. 결과 그림은 작업 환경 안에만 둔다(저장소에 넣지 않음).
   python3 tools/harness/crops.py <그림폴더> <방자료.json> <결과.json> <출력.png> [후보 몇 개]"""
import json, sys, os, cv2, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import plan_trace, discover
imgdir, roomsf, resf, outp = sys.argv[1:5]; N = int(sys.argv[5]) if len(sys.argv) > 5 else 6
cand = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '후보.json'), encoding='utf-8'))['후보']
rooms = json.load(open(roomsf, encoding='utf-8')); cache = {}; rows = []
for s, ex in list(cand.items())[:N]:
    tiles = []
    for k, x, y, _ in ex[:4]:
        f = os.path.join(imgdir, k + '.jpg')
        if k not in cache: cache[k] = plan_trace.trace(f, rooms[k])
        img = cv2.imread(f); p = dict(rooms[k], 그림=cache[k]); m = discover.struct_mask(cache[k], p['mmpp'], *img.shape[:2])
        ov = img.copy(); ov[m > 0] = (0.45*ov[m > 0] + 0.55*np.array([255, 120, 0])).astype(np.uint8)
        P = lambda I: cv2.copyMakeBorder(I, 60, 60, 60, 60, cv2.BORDER_CONSTANT, value=(255, 255, 255))[y:y+120, x:x+120]
        a, b = P(img).copy(), P(ov).copy(); cv2.circle(b, (60, 60), 10, (0, 0, 255), 1)
        tiles.append(np.hstack([cv2.resize(a, (180, 180)), cv2.resize(b, (180, 180))]))
    while len(tiles) < 4: tiles.append(np.full((180, 360, 3), 255, np.uint8))
    row = np.hstack(tiles); bar = np.full((22, row.shape[1], 3), 255, np.uint8)
    rows.append(np.vstack([bar, row]))
cv2.imwrite(outp, np.vstack(rows))
print('\n'.join('%d. %s' % (i+1, s) for i, s in enumerate(list(cand)[:N])))
