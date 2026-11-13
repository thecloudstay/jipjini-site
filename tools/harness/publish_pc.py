# -*- coding: utf-8 -*-
r"""대표 컴퓨터 일괄 변환 결과를 누리집에 올린다 (2026-11-13 대표 「도면 준비됨인데 왜 안 열리냐, 왜 자동이 아니냐」).
   컴퓨터는 받아 둔 원본을 집지니 도면으로 바꾸고(자료\변환\도면\<키>.json) 판정·점수를 상태.json 에 남긴다.
   그중 아래 기준을 넘은 평형만 data/plans 에 더한다. 원본 그림은 싣지 않는다 — 집지니가 다시 그린 도면만.
     · 원본 대조 점수 85점 이상(대표 기준) · 판정 통과 또는 예외(출고보류·오류 제외 — 안전 규칙 R1·R5·R10·R11·R16 위반 없음)
     · 주방 과대(R17)·창 없는 방(R8) 이 남은 평형도 뺀다(손님 눈에 바로 틀린 게 보이는 것)
   python3 tools/harness/publish_pc.py <변환폴더(상태.json·도면/)> <원본_목록.csv>
   결과: data/plans/<단지코드>.json · index.json · opened.json(날마다 열린 수)"""
import csv, json, os, sys, time
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PL = os.path.join(ROOT, 'data', 'plans')
CUT = 85.0
BLOCK = ('R16', 'R17', 'R8')


def ok(v):
    return (isinstance(v.get('점수'), (int, float)) and v['점수'] >= CUT and v.get('판정') in ('통과', '예외')
            and not any(x and x[0] in BLOCK for x in v.get('점검') or []))


def main(cdir, listf):
    st = json.load(open(os.path.join(cdir, '상태.json'), encoding='utf-8'))
    A = {'%s_%s' % (r['단지코드'], r['평형']): r for r in csv.DictReader(open(listf, encoding='utf-8-sig'))}
    added = skipped = 0
    for k, v in sorted(st.items()):
        if not ok(v):
            continue
        f = os.path.join(cdir, '도면', k + '.json')
        if not os.path.exists(f) or k not in A:
            skipped += 1; continue
        code, name = k.split('_', 1); a = A[k]
        d = json.load(open(f, encoding='utf-8')); mm = d.get('mmpp') or 0; G = d.get('그림') or {}
        if not mm or not G.get('벽선'):
            skipped += 1; continue
        rooms = []
        for q in d.get('rooms') or []:
            P = q.get('pts') or []
            if len(P) < 3: continue
            rooms.append({'name': q.get('name') or q.get('kind'), 'kind': q.get('kind'), 'pts': P,
                          'area': round(abs(cv2.contourArea(np.array(P, np.float32))) * mm * mm / 1e6, 2)})
        cnt = lambda kk: sum(1 for q in rooms if q.get('kind') == kk)
        area = float(a.get('전용면적') or d.get('전용') or 0)
        plan = {'W': d['W'], 'H': d['H'], 'mmpp': mm,
                'sum': {'방': cnt('방'), '욕실': cnt('욕실'), '발코니': cnt('발코니'),
                        '전용합': round(sum(q['area'] for q in rooms if q.get('kind') not in ('발코니', '공용', '피트')), 1)},
                '척도': {'방식': '면적'}, 'rooms': rooms,
                '창': [{'x1': s[1], 'y1': s[2], 'x2': s[3], 'y2': s[4]} for s in G.get('샷시') or []],
                '문': [q for q in G.get('문') or [] if isinstance(q, dict)],
                '외곽': None, '치수줄': None, '기구': G.pop('기구', None), '그림': {kk: vv for kk, vv in G.items() if kk not in ('점검',)}}
        pf = os.path.join(PL, code + '.json')
        P = json.load(open(pf, encoding='utf-8')) if os.path.exists(pf) else {'단지': a.get('단지명') or code, '평형': []}
        old_i = [i for i, t in enumerate(P['평형']) if t['이름'] == name]
        if old_i:   # 2026-11-13 하네스 약속 1: 이미 열린 평형도 새 판으로 다시 통과하면 바꿔 끼운다(같은 판이면 그대로)
            if str(v.get('판') or '') and str(v.get('판')) in str(P['평형'][old_i[0]].get('출처', '')):
                continue
            P['평형'].pop(old_i[0]); replaced = globals().setdefault('_REPL', [0]); replaced[0] += 1
        P['평형'].append({'이름': name, '전용': area, '점수': round(float(v['점수'])), 'plan': plan, '출처': '컴퓨터 일괄 변환 ' + str(v.get('판') or '')})
        P['평형'].sort(key=lambda t: t.get('전용') or 0)
        json.dump(P, open(pf, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); added += 1
        print(k, '올림', v['점수'], v.get('판정'))
    codes = sorted(os.path.basename(x)[:-5] for x in os.listdir(PL) if x.startswith('A') and x.endswith('.json'))
    json.dump(codes, open(os.path.join(PL, 'index.json'), 'w', encoding='utf-8'))
    nt = sum(len(json.load(open(os.path.join(PL, c + '.json'), encoding='utf-8'))['평형']) for c in codes)
    lf = os.path.join(PL, 'opened.json'); log = json.load(open(lf, encoding='utf-8')) if os.path.exists(lf) else []
    day = time.strftime('%Y-%m-%d'); log = [x for x in log if x['날'] != day] + [{'날': day, '단지': len(codes), '평형': nt}]
    json.dump(sorted(log, key=lambda x: x['날']), open(lf, 'w', encoding='utf-8'), ensure_ascii=False)
    print('새로 연·새 판으로 바꾼 평형', added, '(그중 바꿔 끼움 %d)' % globals().get('_REPL', [0])[0], '· 건너뜀', skipped, '· 열린 단지', len(codes), '· 열린 평형', nt)
    return added


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
