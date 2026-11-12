# -*- coding: utf-8 -*-
"""변환 규칙 고리(하네스) — 2026-11-12 대표 지시 「스스로 규칙을 찾아내고 그 규칙을 계속 반영해 가면서 일하는 자가 개선 루프」

  python3 tools/harness/run.py 측정 <그림폴더> <방자료.json> <결과.json>
      표본마다 변환(plan_trace.trace) → 규칙 점검(plan_check.rules) → 다른 곳 찾기(discover.find). 결과는 숫자·좌표만.
  python3 tools/harness/run.py 발견 <결과.json>
      규칙별 개수, 「처음 보는 모양」 묶음(새 규칙 후보)을 표로. 후보는 tools/harness/후보.json 에도 남긴다.
  python3 tools/harness/run.py 관문 <앞결과.json> <뒤결과.json> [고친규칙]
      고친 판을 남길지 버릴지. 0 = 남김, 1 = 버림(이유 출력). 기준은 아래 GATE.
  python3 tools/harness/run.py 기준 <결과.json>
      관문을 통과해 남긴 판의 개수를 tools/harness/기준.json 으로(다음 판의 비교 대상).

결과.json: {표본키: {'점검': [[규칙,이름,x,y]...], '발견': [{표식,x,y,mm}...]}}
"""
import json, os, sys, glob, collections, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'tools')); sys.path.insert(0, HERE)
KNOWN = os.path.join(HERE, '알려진모양.json'); CAND = os.path.join(HERE, '후보.json'); BASE = os.path.join(HERE, '기준.json'); DIARY = os.path.join(HERE, '일지.md')
# 무게: 사람이 다칠 수 있는 것(문 안전)·외벽 터짐이 가장 무겁다
WEIGHT = {'R5': 10, 'R10': 10, 'R9': 5, 'R1': 5, 'R12': 2, 'R6': 3, 'R2': 2, 'R3': 2, 'R4': 2, 'R7': 1, 'R8': 1, 'R13': 2, 'R14': 2}
GATE = {'안전규칙': ['R5'], '규칙당_늘어남_허용': 1, '발견_늘어남_허용비': 0.05}

def rj(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def wj(p, o): json.dump(o, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

def measure(imgdir, roomsf, outf):
    import cv2, plan_trace, plan_check, discover
    rooms = rj(roomsf, {}); res = {}
    for k, p in sorted(rooms.items()):
        f = os.path.join(imgdir, k + '.jpg')
        if not os.path.exists(f) or not p.get('rooms'): continue
        try:
            G = plan_trace.trace(f, p); q = dict(p, 그림=G); img = plan_trace.imread_u(f)
            res[k] = {'점검': G.get('점검') or [], '발견': discover.find(img, q)}
        except Exception as e:
            res[k] = {'오류': str(e)[:120]}
        print(k, len(res[k].get('점검', [])), len(res[k].get('발견', [])), flush=True)
    wj(outf, res); return res

def tally(res):
    known = rj(KNOWN, {}); rule = collections.Counter(); sig = collections.defaultdict(list)
    for k, r in res.items():
        for x in r.get('점검', []): rule[x[0]] += 1
        for d in r.get('발견', []): sig[d['표식']].append((k, d['x'], d['y'], d['mm']))
    new = {s: v for s, v in sig.items() if s not in known and len(v) >= 3 and len({a[0] for a in v}) >= 2}
    return rule, sig, new, known

def report(resf):
    res = rj(resf, {}); rule, sig, new, known = tally(res)
    print('표본', len(res), '장 · 오류', sum(1 for r in res.values() if '오류' in r))
    print('규칙별:', ' · '.join('%s %d' % (k, rule[k]) for k in sorted(rule)), '· 무게 합', sum(WEIGHT.get(k, 1)*v for k, v in rule.items()))
    print('다른 곳 묶음', len(sig), '· 아는 모양', sum(1 for s in sig if s in known), '· 새 규칙 후보', len(new))
    for s, v in sorted(new.items(), key=lambda x: -len(x[1]))[:12]:
        print('  후보 %3d곳 %2d평면  %s   예: %s' % (len(v), len({a[0] for a in v}), s, ', '.join('%s(%d,%d)' % a[:3] for a in v[:3])))
    wj(CAND, {'때': time.strftime('%Y-%m-%d %H:%M'), '후보': {s: v[:8] for s, v in sorted(new.items(), key=lambda x: -len(x[1]))}})

def score(res):
    rule, sig, new, known = tally(res)
    return rule, sum(len(v) for v in sig.values())

def gate(af, bf, target=None):
    A, B = rj(af, {}), rj(bf, {}); keys = sorted(set(A) & set(B))
    A = {k: A[k] for k in keys}; B = {k: B[k] for k in keys}
    ra, da = score(A); rb, db = score(B); why = []
    for k in GATE['안전규칙']:
        if rb[k] > ra[k]: why.append('안전 규칙 %s 늘어남 %d→%d' % (k, ra[k], rb[k]))
    for k in set(ra) | set(rb):
        if rb[k] - ra[k] > GATE['규칙당_늘어남_허용'] and k != target: why.append('%s 늘어남 %d→%d' % (k, ra[k], rb[k]))
    wa = sum(WEIGHT.get(k, 1)*v for k, v in ra.items()); wb = sum(WEIGHT.get(k, 1)*v for k, v in rb.items())
    if wb > wa: why.append('무게 합 늘어남 %d→%d' % (wa, wb))
    if db > da*(1+GATE['발견_늘어남_허용비']) + 2: why.append('다른 곳 늘어남 %d→%d' % (da, db))
    if target and rb[target] >= ra[target]: why.append('고친 규칙 %s 가 줄지 않음 %d→%d' % (target, ra[target], rb[target]))
    if not target and wb == wa and db >= da: why.append('나아진 것이 없음')
    line = '%s · 표본 %d · 무게 %d→%d · 다른 곳 %d→%d · %s' % (time.strftime('%Y-%m-%d %H:%M'), len(keys), wa, wb, da, db, ('남김' if not why else '버림: ' + ' / '.join(why)))
    print(line); open(DIARY, 'a', encoding='utf-8').write('- ' + line + (' · 고친 규칙 ' + target if target else '') + '\n')
    return 0 if not why else 1

def base(resf):
    res = rj(resf, {}); rule, d = score(res)
    wj(BASE, {'때': time.strftime('%Y-%m-%d %H:%M'), '표본': len(res), '규칙': dict(rule), '다른곳': d,
              '무게': sum(WEIGHT.get(k, 1)*v for k, v in rule.items()), '평면별': {k: collections.Counter(x[0] for x in r.get('점검', [])) for k, r in res.items()}})

if __name__ == '__main__':
    c = sys.argv[1]
    if c == '측정': measure(*sys.argv[2:5])
    elif c == '발견': report(sys.argv[2])
    elif c == '관문': sys.exit(gate(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None))
    elif c == '기준': base(sys.argv[2])
