# -*- coding: utf-8 -*-
"""채점을 통과한 평면을 누리집에 올린다(2026-11-12 대표 지시 「85점 넘은 도면은 누리집에도」).
   올리는 기준: 원본 대조 점수 85점 이상 + 판정이 출고보류가 아님(안전 규칙 R5·R10·R1·R11 위반 없음).
   python3 tools/harness/publish.py <원본그림폴더> <방자료.json> <검수표.csv> <원본_목록.csv> <화면읽기.json> [기준점수]
     방자료.json   — 채점에 쓴 방 다각형(cad.html 그림 읽기 결과, rooms.js)
     화면읽기.json — 같은 길로 꺼낸 창·문·외곽·치수줄(pubui.js)
   결과: data/plans/<단지코드>.json 에 평형을 더하고 data/plans/index.json · data/plans/opened.json(날마다 열린 수)을 고친다.
   원본 그림은 싣지 않는다 — 집지니가 다시 그린 도면(방 다각형·벽·창·문)만."""
import csv, json, os, sys, time
import cv2, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import plan_trace
AREA_K = 0.974
PL = os.path.join(ROOT, 'data', 'plans')


def main(imgdir, roomsf, scoref, listf, uif, cut=85.0):
    R = json.load(open(roomsf, encoding='utf-8')); UI = json.load(open(uif, encoding='utf-8'))
    A = {'%s_%s' % (r['단지코드'], r['평형']): r for r in csv.DictReader(open(listf, encoding='utf-8-sig'))}
    rows = [r for r in csv.DictReader(open(scoref, encoding='utf-8-sig')) if r['점수'] and float(r['점수']) >= cut and r['판정'] != '출고보류']
    added = 0
    for r in rows:
        k = r['키']; code, name = k.split('_', 1); src = os.path.join(imgdir, k + '.jpg')
        if k not in R or k not in UI or k not in A or not os.path.exists(src): print(k, '건너뜀(자료 없음)'); continue
        a = A[k]; area = float(a['전용면적'] or 0); u = UI[k]; mm = R[k].get('mmpp') or 0
        rooms = [dict(q) for q in R[k]['rooms'] if len(q['pts']) >= 3]
        if not mm and area:
            px = sum(abs(cv2.contourArea(np.array(q['pts'], np.float32))) for q in rooms if q.get('kind') not in ('발코니', '공용', '피트'))
            mm = (AREA_K * area * 1e6 / px) ** 0.5 if px else 0
        if not mm: print(k, '건너뜀(축척 없음)'); continue
        for q in rooms:
            q['area'] = round(abs(cv2.contourArea(np.array(q['pts'], np.float32))) * mm * mm / 1e6, 2)
        cnt = lambda kk: sum(1 for q in rooms if q.get('kind') == kk)
        sm = {'방': cnt('방'), '욕실': cnt('욕실'), '발코니': cnt('발코니'),
              '전용합': round(sum(q['area'] for q in rooms if q.get('kind') not in ('발코니', '공용', '피트')), 1)}
        plan = {'W': R[k]['W'], 'H': R[k]['H'], 'mmpp': mm, 'sum': sm, '척도': {'방식': '치수' if R[k].get('mmpp') else '면적'},
                'rooms': rooms, '창': u.get('창') or [], '문': u.get('문') or [], '외곽': u.get('외곽'), '치수줄': u.get('치수줄')}
        G = plan_trace.trace(src, dict(plan, 전용=area))
        plan['기구'] = G.pop('기구', None) or u.get('기구'); plan['그림'] = G
        f = os.path.join(PL, code + '.json')
        d = json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {'단지': a['단지명'], '평형': []}
        if any(t['이름'] == name for t in d['평형']): continue      # 이미 열린 평형은 그대로(다시 그리기는 apply.py)
        d['평형'].append({'이름': name, '전용': area, '점수': round(float(r['점수'])), 'plan': plan})
        d['평형'].sort(key=lambda t: t.get('전용') or 0)
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); added += 1
        print(k, '올림', r['점수'])
    codes = sorted(os.path.basename(x)[:-5] for x in os.listdir(PL) if x.startswith('A') and x.endswith('.json'))
    json.dump(codes, open(os.path.join(PL, 'index.json'), 'w', encoding='utf-8'))
    nt = sum(len(json.load(open(os.path.join(PL, c + '.json'), encoding='utf-8'))['평형']) for c in codes)
    lf = os.path.join(PL, 'opened.json'); log = json.load(open(lf, encoding='utf-8')) if os.path.exists(lf) else []
    day = time.strftime('%Y-%m-%d'); log = [x for x in log if x['날'] != day] + [{'날': day, '단지': len(codes), '평형': nt}]
    json.dump(sorted(log, key=lambda x: x['날']), open(lf, 'w', encoding='utf-8'), ensure_ascii=False)
    print('새로 연 평형', added, '· 열린 단지', len(codes), '· 열린 평형', nt)


if __name__ == '__main__':
    main(*sys.argv[1:6], *([float(sys.argv[6])] if len(sys.argv) > 6 else []))
