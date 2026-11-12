# -*- coding: utf-8 -*-
"""집지니 평면 자료(data/plans/<단지>.json) → 교환용 캐드 파일(층·기호 규격은 plan_cad_spec.md)

  python3 plan_cad.py <단지 json> <출력 폴더>          평형마다 한 파일: <단지코드>_<평형>.dxf
누리집·견적·캐드가 같은 자료 한 벌에서 나오게 하는 것이 목적(데이터 사업용 2026-11-12 대표 지시).
"""
import json, math, os, sys
import ezdxf
from ezdxf.enums import TextEntityAlignment

LAYERS = [('A-WALL-EXTR', 7, 50), ('A-WALL-STRC', 7, 50), ('A-WALL-PRTN', 8, 35), ('A-WALL-PATT', 8, 9),
          ('A-DOOR', 4, 25), ('A-GLAZ', 5, 25), ('A-AREA', 9, 13), ('A-AREA-IDEN', 7, 18), ('A-ANNO-DIMS', 3, 13),
          ('A-FLOR-STRS', 8, 18), ('A-FLOR-EVTR', 8, 18), ('A-AREA-PUBL', 9, 13)]
WALL_LAYER = {250: 'A-WALL-EXTR', 200: 'A-WALL-STRC', 120: 'A-WALL-PRTN'}
FONT = 'Malgun Gothic'
STD_DOOR = {'욕실': 750, '현관': 1000, '드레스룸': 800, '피트': 600, '발코니': 900, '다용도': 800}   # 집지니 표준 문 폭(mm)

def inpoly(x, y, pts):
    c = False; n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1: c = not c
    return c

def side_kind(plan, x, y):
    for r in plan.get('rooms', []):
        if len(r['pts']) >= 3 and inpoly(x, y, r['pts']): return r.get('kind') or '?'
    return None

def outer_sash(plan):
    """창은 한쪽이 바깥이거나 발코니일 때만 진짜다. 방과 방 사이 벽 틈(문·칸막이)이 창으로 잡힌 것을 걸러 낸다(2026-11-12 대표 지적: 안쪽 파란 줄 상자)."""
    G = plan.get('그림') or {}; off = 600.0 / (plan.get('mmpp') or 23.0); out = []
    for q in G.get('샷시', []):
        ax, x0, y0, x1, y1 = q; cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
        a, b = (side_kind(plan, cx, y0 - off), side_kind(plan, cx, y1 + off)) if ax == 'h' else (side_kind(plan, x0 - off, cy), side_kind(plan, x1 + off, cy))
        if a is None or b is None or '발코니' in (a, b): out.append(q)
    return out

def kor(t, b=False):
    return t   # 글꼴은 글자 양식(맑은 고딕)에 맡긴다 — 글 안 글꼴 지정은 웹 보기 도구 여럿이 못 읽어 한글이 빠졌다

def setup(doc):
    doc.units = ezdxf.units.MM
    doc.appids.new('JJ')
    for n, c, lw in LAYERS:
        doc.layers.add(n, color=c, lineweight=lw)
    st = doc.styles.get('Standard'); st.dxf.font = 'malgun.ttf'; st.set_extended_font_data(family=FONT)
    # 여닫이 문: 경첩이 원점, 닫힌 문짝이 +y 방향, 열리는 끝이 +x 방향(폭 1000)
    b = doc.blocks.new('JJ-DOOR-SWING', base_point=(0, 0))
    b.add_line((0, 0), (0, 1000), dxfattribs={'layer': '0'})
    b.add_arc((0, 0), 1000, 0, 90, dxfattribs={'layer': '0'})
    b.add_attdef('폭', (0, -150), dxfattribs={'height': 80, 'invisible': True})
    b.add_attdef('종류', (0, -250), dxfattribs={'height': 80, 'invisible': True})
    # 이중창: 길이 1000(x) × 벽 두께 1000(y, 중심선 기준 ±500)
    w = doc.blocks.new('JJ-WIN-DOUBLE', base_point=(0, 0))
    w.add_lwpolyline([(0, -500), (1000, -500), (1000, 500), (0, 500)], close=True, dxfattribs={'layer': '0'})
    w.add_line((0, -120), (1000, -120), dxfattribs={'layer': '0'}); w.add_line((0, 120), (1000, 120), dxfattribs={'layer': '0'})
    w.add_attdef('폭', (0, -700), dxfattribs={'height': 80, 'invisible': True})
    w.add_attdef('종류', (0, -800), dxfattribs={'height': 80, 'invisible': True})
    e = doc.blocks.new('JJ-EVTR', base_point=(0, 0))
    e.add_lwpolyline([(0, 0), (1000, 0), (1000, 1000), (0, 1000)], close=True, dxfattribs={'layer': '0'})
    e.add_line((0, 0), (1000, 1000), dxfattribs={'layer': '0'}); e.add_line((1000, 0), (0, 1000), dxfattribs={'layer': '0'})

def export(plan, out_path, title=''):
    G = plan.get('그림') or {}; mm = plan.get('mmpp') or 23.0
    X0, Y0, X1, Y1 = G.get('틀') or [0, 0, 1000, 1000]
    P = lambda x, y: (round((x - X0) * mm, 1), round((Y1 - y) * mm, 1))     # 화소 → mm, 위아래 뒤집기, 원점 = 건물 왼쪽 아래
    doc = ezdxf.new('R2010', setup=True); setup(doc); msp = doc.modelspace()
    cnt = {'벽': 0, '문': 0, '창': 0, '방': 0}
    # 벽: 선분마다 닫힌 네모 + 채움
    for ax, a, b, c, t in G.get('벽선', []):
        hT = t / mm / 2.0
        if ax == 'h': pts = [P(a, c - hT), P(b, c - hT), P(b, c + hT), P(a, c + hT)]
        else: pts = [P(c - hT, a), P(c + hT, a), P(c + hT, b), P(c - hT, b)]
        lay = WALL_LAYER.get(int(t), 'A-WALL-PRTN')
        msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': lay})
        h = msp.add_hatch(color=256, dxfattribs={'layer': 'A-WALL-PATT'}); h.set_solid_fill(color=8); h.paths.add_polyline_path(pts, is_closed=True)
        cnt['벽'] += 1
    for x1, y1, x2, y2, t in G.get('사선벽', []):   # 2026-11-12 비스듬한 벽
        L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 or 1; hT = t / mm / 2.0; nx, ny = -(y2 - y1) / L * hT, (x2 - x1) / L * hT
        pts = [P(x1 + nx, y1 + ny), P(x2 + nx, y2 + ny), P(x2 - nx, y2 - ny), P(x1 - nx, y1 - ny)]
        lay = WALL_LAYER.get(int(t), 'A-WALL-PRTN'); msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': lay})
        h = msp.add_hatch(color=256, dxfattribs={'layer': 'A-WALL-PATT'}); h.set_solid_fill(color=8); h.paths.add_polyline_path(pts, is_closed=True); cnt['벽'] += 1
    for x1, y1, x2, y2, t in G.get('사선창', []):   # 2026-11-12 비스듬한 창: 틀 + 가운데 두 줄
        L = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 or 1; hT = max(2.0, t / mm / 2.0); nx, ny = -(y2 - y1) / L, (x2 - x1) / L
        at = lambda x, y, o: P(x + nx * o, y + ny * o)
        msp.add_lwpolyline([at(x1, y1, hT), at(x2, y2, hT), at(x2, y2, -hT), at(x1, y1, -hT)], close=True, dxfattribs={'layer': 'A-GLAZ'})
        for o in (-hT * 0.24, hT * 0.24): msp.add_line(at(x1, y1, o), at(x2, y2, o), dxfattribs={'layer': 'A-GLAZ'})
        cnt['창'] += 1
    # 문: 경첩 자리에 기호, 문 폭 배율, 여는 방향은 회전·뒤집기
    for d in G.get('문', []):
        hx, hy = P(d['x1'], d['y1']); ox, oy = P(d['x2'], d['y2']); lx, ly = P(d['cx'], d['cy'])
        width = math.hypot(ox - hx, oy - hy)
        if width < 300: continue
        # 네이버는 문을 화소 고정 크기로 그린다(naver_rules.md) → 그림 폭이 아니라 들어가는 방 종류로 표준 폭을 정한다
        mx, my = (d['x1'] + d['x2'] + d['cx']) / 3.0, (d['y1'] + d['y2'] + d['cy']) / 3.0
        kind = next((r.get('kind') for r in plan.get('rooms', []) if inpoly(mx, my, r['pts'])), '')
        width = STD_DOOR.get(kind, 900)
        ang = math.degrees(math.atan2(oy - hy, ox - hx))            # 기호의 +x(열리는 끝) 방향
        cross = (ox - hx) * (ly - hy) - (oy - hy) * (lx - hx)          # 문짝이 +x 의 왼쪽(+)이면 그대로, 오른쪽이면 뒤집기
        sy = 1 if cross >= 0 else -1
        ref = msp.add_blockref('JJ-DOOR-SWING', (hx, hy), dxfattribs={'layer': 'A-DOOR', 'xscale': width / 1000, 'yscale': sy * width / 1000, 'rotation': ang})
        ref.add_auto_attribs({'폭': str(int(round(width / 10) * 10)), '종류': '여닫이'})
        cnt['문'] += 1
    # 창·샷시: 벽 두께 안에 이중창 기호
    for q in outer_sash(plan):
        ax, x0, y0, x1, y1 = q
        if ax == 'h':
            (sx, sy0), (ex, _) = P(x0, (y0 + y1) / 2), P(x1, (y0 + y1) / 2); L = ex - sx; T = abs(y1 - y0) * mm; ins, rot = (sx, sy0), 0
        else:
            (sx, sy0), (_, ey) = P((x0 + x1) / 2, y1), P((x0 + x1) / 2, y0); L = ey - sy0; T = abs(x1 - x0) * mm; ins, rot = (sx, sy0), 90
        if L < 300: continue
        ref = msp.add_blockref('JJ-WIN-DOUBLE', ins, dxfattribs={'layer': 'A-GLAZ', 'xscale': L / 1000, 'yscale': max(T, 120) / 1000, 'rotation': rot})
        ref.add_auto_attribs({'폭': str(int(round(L / 10) * 10)), '종류': '이중창'})
        cnt['창'] += 1
    # 방: 경계 + 이름·면적
    for r in plan.get('rooms', []):
        pts = [P(x, y) for x, y in r['pts']]
        if len(pts) < 3: continue
        pl = msp.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'A-AREA'})
        pl.set_xdata('JJ', [(1000, str(r.get('name', ''))), (1000, str(r.get('kind', ''))), (1040, float(r.get('area') or 0))])   # 방 이름·종류·면적을 경계선에 붙여 둔다(데이터 추출용)
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        msp.add_mtext(kor(r.get('name', ''), True), dxfattribs={'layer': 'A-AREA-IDEN', 'char_height': 220, 'attachment_point': 5, 'insert': (cx, cy + 150)})
        if r.get('area'): msp.add_mtext(kor('%s m²' % r['area']), dxfattribs={'layer': 'A-AREA-IDEN', 'char_height': 160, 'attachment_point': 5, 'insert': (cx, cy - 150)})
        cnt['방'] += 1
    for e in G.get('EV', []):
        a, b = P(e[0], e[3]), P(e[2], e[1])
        msp.add_blockref('JJ-EVTR', a, dxfattribs={'layer': 'A-FLOR-EVTR', 'xscale': (b[0] - a[0]) / 1000, 'yscale': (b[1] - a[1]) / 1000})
    for c in G.get('공용칸', []):
        x, y = P(c[0], c[1]); msp.add_mtext(kor('공용부', True), dxfattribs={'layer': 'A-AREA-PUBL', 'char_height': 220, 'attachment_point': 5, 'insert': (x, y)})
    # 전체 치수(가로·세로)
    W, H = (X1 - X0) * mm, (Y1 - Y0) * mm
    msp.add_linear_dim(base=(0, H + 900), p1=(0, H), p2=(W, H), dimstyle='EZDXF', dxfattribs={'layer': 'A-ANNO-DIMS'}).render()
    msp.add_linear_dim(base=(-900, 0), p1=(0, 0), p2=(0, H), angle=90, dimstyle='EZDXF', dxfattribs={'layer': 'A-ANNO-DIMS'}).render()
    if title: msp.add_mtext(kor(title, True), dxfattribs={'layer': 'A-AREA-IDEN', 'char_height': 300, 'insert': (0, -900)})
    doc.saveas(out_path)
    return cnt

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    d = json.load(open(src, encoding='utf-8')); code = os.path.basename(src)[:-5]
    for t in d.get('평형', []):
        p = t.get('plan')
        if not p or not p.get('그림'): continue
        fn = os.path.join(out, '%s_%s.dxf' % (code, t['이름']))
        print(fn, export(p, fn, '%s %s' % (d.get('단지명', code), t['이름'])))
