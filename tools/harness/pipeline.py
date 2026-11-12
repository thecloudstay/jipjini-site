# -*- coding: utf-8 -*-
"""평면도 일괄 변환 흐름(2026-11-12 대표 구상) — 대표 컴퓨터에서 토큰 없이 돈다. 사람·클로드는 「예외함」만 본다.

  python3 tools/harness/pipeline.py <그림폴더> <방자료.json> <결과폴더> [원본_목록.csv(전용면적)]

 1) 일괄 변환   plan_trace.trace (지금 규칙 그대로, 빠르게)
 2) 검수 로봇   plan_check.rules (R1~) + discover.find(원본과 다른 곳)
 3) 자동 고침   FIXERS — 근거가 확실한 것만(벽 위 창 지우기, 창을 벽 두께·중심선에 맞추기, 창·벽 끝을 붙이기)
 4) 다시 검수   고친 뒤 규칙이 줄었을 때만 고친 판을 쓴다
 5) 가르기      출고보류(안전: 문 안전·현관문·외벽 터짐) / 예외(자동으로 못 고친 것·처음 보는 모양) / 통과
 6) 예외함      유형(규칙 번호·모양 표식)별로 묶어 대표 3~5곳만 → 클로드가 이것만 보고 규칙을 배운다
 7) 채점        검수 규칙과 따로 — 원본 굵은 선과 겹쳐 놓침%·군더더기%(plan_check.check)로 100점 만점
결과: <결과폴더>/검수표.csv, 예외함.json, 요약.txt, 도면/<키>.json
"""
import csv, json, os, sys, time, collections, copy
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools')); sys.path.insert(0, HERE)
import cv2, numpy as np
import plan_trace, plan_check, discover
SAFETY = ('R5', 'R10', 'R1', 'R11')      # 하나라도 남으면 고객에게 내보내지 않는다
WARN = ('R7', 'R8')               # 경고(출고는 막지 않음)

# ── 자동 고침: (규칙, 함수). 함수는 그림 자료 G 를 고쳐 돌려준다. 근거 없는 짐작은 넣지 않는다.
def fix_R9(G, mm, img):
    keep = []
    for q in G['샷시']:
        ax, x0, y0, x1, y1 = q; a, b, c = (x0, x1, (y0+y1)/2) if ax == 'h' else (y0, y1, (x0+x1)/2); h = ((y1-y0) if ax == 'h' else (x1-x0))/2
        cov = sum(max(0, min(b, w[2]) - max(a, w[1])) for w in G['벽선'] if w[0] == ax and abs(w[3]-c) <= w[4]/mm/2 + h + 6)
        if cov <= 0.3*max(1, b-a): keep.append(q)
    G['샷시'] = keep; return G
def fix_R2(G, mm, img):
    out = []
    for q in G['샷시']:
        ax, x0, y0, x1, y1 = q; a, b, c = (x0, x1, (y0+y1)/2) if ax == 'h' else (y0, y1, (x0+x1)/2)
        w = min((w for w in G['벽선'] if w[0] == ax and abs(w[3]-c) <= 12 and min(b, w[2])-max(a, w[1]) > -12), key=lambda w: abs(w[3]-c), default=None)
        if w: h = w[4]/mm/2; c = w[3]
        else: h = ((y1-y0) if ax == 'h' else (x1-x0))/2
        out.append(['h', int(a), int(round(c-h)), int(b), int(round(c+h))] if ax == 'h' else ['v', int(round(c-h)), int(a), int(round(c+h)), int(b)])
    G['샷시'] = out; return G
def fix_R3(G, mm, img):
    tol = 450.0/mm; out = []
    for q in G['샷시']:
        ax, x0, y0, x1, y1 = q; a, b, c = (x0, x1, (y0+y1)/2) if ax == 'h' else (y0, y1, (x0+x1)/2)
        def nearest(e, sg):
            best = None
            for w in G['벽선']:
                if w[0] == ax:
                    if abs(w[3]-c) > 4: continue
                    stop = w[2] if sg < 0 else w[1]
                else:
                    if not (w[1]-3 <= c <= w[2]+3): continue
                    stop = w[3] + w[4]/mm/2 if sg < 0 else w[3] - w[4]/mm/2
                g = (e-stop) if sg < 0 else (stop-e)
                if 0.5 < g <= tol and (best is None or g < best[0]): best = (g, stop)
            return best[1] if best else e
        a2, b2 = nearest(a, -1), nearest(b, 1)
        out.append(['h', int(round(a2)), y0, int(round(b2)), y1] if ax == 'h' else ['v', x0, int(round(a2)), x1, int(round(b2))])
    G['샷시'] = out; return G
def fix_R4(G, mm, img):
    G['벽선'] = plan_trace.snap_corners(G['벽선'], mm); return G
FIXERS = [('R9', fix_R9), ('R2', fix_R2), ('R3', fix_R3), ('R4', fix_R4)]

def weight(chk):
    W = {'R5': 10, 'R10': 10, 'R9': 5, 'R1': 5, 'R12': 2, 'R6': 3, 'R2': 2, 'R3': 2, 'R4': 2}
    return sum(W.get(x[0], 1) for x in chk)

def score(img_path, p):
    """채점(검수 규칙과 따로): 원본 굵은 검정 줄(벽)을 우리가 얼마나 덮었나(놓침%), 우리 벽·창 중심선이 원본 선 위에 있나(군더더기%).
       점수 = 100 - 놓침% - 군더더기% - 2×(원본과 다른 곳)  (원본 그림만 기준 — 검수 규칙을 바꿔 점수를 올릴 수 없다)"""
    try:
        img = cv2.imread(img_path); H, W = img.shape[:2]; G = p['그림']; mm = p['mmpp']
        v = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 2].astype(int); s_ = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[..., 1].astype(int)
        X0, Y0, X1, Y1 = G.get('틀') or [0, 0, W, H]; box = np.zeros((H, W), bool); box[max(0, Y0-4):Y1+5, max(0, X0-4):X1+5] = True
        thick = (cv2.morphologyEx((v < 100).astype(np.uint8), cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)) > 0) & box
        L = max(8, int(450/mm))
        lines = (cv2.morphologyEx(thick.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, L), np.uint8)) | cv2.morphologyEx(thick.astype(np.uint8), cv2.MORPH_OPEN, np.ones((L, 1), np.uint8))) > 0
        ours = discover.struct_mask(G, mm, H, W)
        miss = (lines & ~(cv2.dilate(ours, np.ones((7, 7), np.uint8)) > 0)).sum() / max(1, lines.sum()) * 100
        ink = ((v < 110) | ((v < 205) & (s_ < 45))) & box
        cen = np.zeros((H, W), np.uint8)
        for ax, a, b, c, t in G['벽선']:
            if ax == 'h': cv2.line(cen, (int(a)+2, int(round(c))), (int(b)-2, int(round(c))), 1, 1)
            else: cv2.line(cen, (int(round(c)), int(a)+2), (int(round(c)), int(b)-2), 1, 1)
        extra = ((cen > 0) & ~(cv2.dilate(ink.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0)).sum() / max(1, (cen > 0).sum()) * 100
        return max(0, round(100 - miss - extra, 1)), round(miss, 1), round(extra, 1)
    except Exception as e:
        return None, None, None

AREA_K = 0.974   # 방(발코니·공용·피트 빼고) 넓이 합 ÷ 전용면적 — 축척을 아는 43장의 중간값(2026-11-12)
def area_table(csvf):
    t = {}
    if csvf and os.path.exists(csvf):
        for r in csv.DictReader(open(csvf, encoding='utf-8-sig')):
            try: t['%s_%s' % (r['단지코드'], r['평형'])] = float(r['전용면적'])
            except Exception: pass
    return t

def run(imgdir, roomsf, outdir, csvf=None):
    os.makedirs(os.path.join(outdir, '도면'), exist_ok=True)
    rooms = json.load(open(roomsf, encoding='utf-8')); area = area_table(csvf)
    for k, p in rooms.items():
        if k in area: p['전용'] = area[k]
        # 예외함 학습 1(2026-11-12 첫 시험 62장 중 18장): 치수선이 없거나 못 읽어 축척이 0 → 전용면적과 방 넓이 합으로 축척을 정한다
        if p.get('rooms') and not p.get('mmpp') and p.get('전용'):
            px = sum(abs(cv2.contourArea(np.array(r['pts'], np.float32))) for r in p['rooms'] if len(r['pts']) >= 3 and r.get('kind') not in ('발코니', '공용', '피트'))
            if px > 0: p['mmpp'] = (AREA_K * p['전용'] * 1e6 / px) ** 0.5; p['축척출처'] = '전용면적'
    known = json.load(open(os.path.join(HERE, '알려진모양.json'), encoding='utf-8'))
    rows = []; box = collections.defaultdict(list); t0 = time.time()
    for k, p in sorted(rooms.items()):
        f = os.path.join(imgdir, k + '.jpg')
        if not os.path.exists(f): continue
        if not p.get('rooms') or not p.get('mmpp'):   # 앞 단계(방·축척 읽기)에서 막힌 것도 예외함으로 — 변환 전에 걸러야 할 유형
            why = '축척 못 읽음' if p.get('rooms') else '방 못 읽음'
            rows.append({'키': k, '판정': '예외', '점수': None, '남은규칙': 'R0 ' + why}); box['R0'].append([k, why, 0, 0])
            print(k, '예외', why, flush=True); continue
        try:
            img = cv2.imread(f); G = plan_trace.trace(f, p); q = dict(p, 그림=G)
            chk0 = plan_check.rules(img, q); fixed = []
            for rule, fn in FIXERS:
                if not any(x[0] == rule for x in chk0): continue
                G2 = fn(copy.deepcopy(G), p['mmpp'], img); chk2 = plan_check.rules(img, dict(p, 그림=G2))
                if weight(chk2) < weight(chk0) and not any(sum(1 for x in chk2 if x[0] == s) > sum(1 for x in chk0 if x[0] == s) for s in SAFETY):
                    G, chk0 = G2, chk2; fixed.append(rule)
            G['점검'] = chk0; q = dict(p, 그림=G)
            diffs = [d for d in discover.find(img, q) if d['표식'] not in known or not str(known[d['표식']]).startswith('무시')]
            new = [d for d in diffs if d['표식'] not in known]
            left = collections.Counter(x[0] for x in chk0)
            if any(left[s] for s in SAFETY): state = '출고보류'
            elif any(v for r, v in left.items() if r not in WARN) or len(new) >= 3: state = '예외'
            else: state = '통과'
            sc, miss, extra = score(f, q)
            if sc is not None: sc = max(0, round(sc - 2*len(diffs), 1))   # 원본과 다른 곳(창·문틀·가는 선 놓침 등, 무시로 정한 모양 뺌) 한 곳마다 2점
            for x in chk0:
                if x[0] not in WARN: box[x[0]].append([k, x[1], x[2], x[3]])
            for d in new: box['모양:' + d['표식']].append([k, d['표식'].split('|')[0], d['x'], d['y']])
            json.dump(G, open(os.path.join(outdir, '도면', k + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
            rows.append({'키': k, '판정': state, '점수': sc, '놓침%': miss, '군더더기%': extra, '자동고침': '+'.join(fixed),
                         '남은규칙': ' '.join('%s%d' % (r, v) for r, v in sorted(left.items())), '처음보는모양': len(new)})
        except Exception as e:
            rows.append({'키': k, '판정': '오류', '점수': None, '남은규칙': str(e)[:80]})
        print(rows[-1]['키'], rows[-1]['판정'], rows[-1].get('점수'), rows[-1].get('자동고침', ''), flush=True)
    with open(os.path.join(outdir, '검수표.csv'), 'w', encoding='utf-8-sig', newline='') as fo:
        w = csv.DictWriter(fo, fieldnames=['키', '판정', '점수', '놓침%', '군더더기%', '자동고침', '남은규칙', '처음보는모양']); w.writeheader(); [w.writerow(r) for r in rows]
    # 예외함: 유형별로 평면 수가 많은 순, 대표 5곳(서로 다른 평면 우선)
    ex = []
    for t, v in box.items():
        plans = sorted({a[0] for a in v}); reps = []; seen = set()
        for a in v:
            if a[0] not in seen: reps.append(a); seen.add(a[0])
            if len(reps) >= 5: break
        if t.startswith('모양:') and (len(v) < 3 or len(plans) < 2): continue
        ex.append({'유형': t, '설명': ('변환 앞 단계(방 경계·축척 읽기)에서 막힘' if t == 'R0' else plan_check.RULES.get(t, '처음 보는 모양(규칙 없음)')), '곳': len(v), '평면': len(plans), '대표': reps})
    ex.sort(key=lambda e: (-e['평면'], -e['곳']))
    json.dump({'때': time.strftime('%Y-%m-%d %H:%M'), '예외함': ex}, open(os.path.join(outdir, '예외함.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    c = collections.Counter(r['판정'] for r in rows); scs = [r['점수'] for r in rows if r.get('점수') is not None]
    fx = collections.Counter(f for r in rows for f in (r.get('자동고침') or '').split('+') if f)
    L = ['평면도 일괄 변환 — %s · %d장 · %.0f초' % (time.strftime('%Y-%m-%d %H:%M'), len(rows), time.time()-t0),
         '판정: ' + ' · '.join('%s %d' % (k, c[k]) for k in ('통과', '예외', '출고보류', '오류')),
         '채점(원본 대조): 평균 %.1f점 · 80점 넘는 장 %d/%d' % (sum(scs)/max(1, len(scs)), sum(1 for s in scs if s >= 80), len(scs)),
         '자동 고침: ' + (' · '.join('%s %d장' % kv for kv in fx.most_common()) or '없음'), '', '예외함(클로드가 볼 것, 평면 수 많은 순)']
    for e in ex[:12]: L.append('  %-28s %3d평면 %4d곳  %s' % (e['유형'][:28], e['평면'], e['곳'], e['설명'][:40]))
    open(os.path.join(outdir, '요약.txt'), 'w', encoding='utf-8').write('\n'.join(L) + '\n'); print('\n'.join(L))

if __name__ == '__main__':
    run(*sys.argv[1:5])

def as_result(outdir):
    """파이프라인 결과 폴더 → run.py 관문이 읽는 결과 모양({키: {'점검': [...], '발견': []}})"""
    d = os.path.join(outdir, '도면'); res = {}
    for f in os.listdir(d):
        G = json.load(open(os.path.join(d, f), encoding='utf-8')); res[f[:-5]] = {'점검': G.get('점검') or [], '발견': [{'표식': '점수', 'x': 0, 'y': 0, 'mm': 0}]*0}
    return res
