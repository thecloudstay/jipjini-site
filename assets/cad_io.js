/* 집지니 캐드 입출력 (2026-11-12 대표 지시 「집지니 캐드 기능 전부를 캐드와 연동되는 구조로」)
   JJCadIO.dxf(state) → 교환용 캐드 파일 글(가장 널리 읽히는 판, 오토캐드·캐드 프로그램 모두 열림)
   층·기호 규격은 tools/plan_cad_spec.md 와 같다(서버 쪽 tools/plan_cad.py 와 같은 결과).
   한글은 캐드 표준 유니코드 표기(\U+XXXX)로 넣어 어느 판에서도 깨지지 않게 한다. */
(function (root) {
  'use strict';
  var LAYERS = [['A-WALL-EXTR', 7], ['A-WALL-STRC', 7], ['A-WALL-PRTN', 8], ['A-WALL-PATT', 8], ['A-DOOR', 4], ['A-GLAZ', 5], ['A-AREA', 9], ['A-AREA-IDEN', 7], ['A-ANNO-DIMS', 3], ['A-ANNO-TEXT', 7], ['A-FLOR-STRS', 8], ['A-FLOR-EVTR', 8], ['A-AREA-PUBL', 9]];
  var WALL_LAYER = { 250: 'A-WALL-EXTR', 200: 'A-WALL-STRC', 120: 'A-WALL-PRTN' };
  var STD_DOOR = { 욕실: 750, 현관: 1000, 드레스룸: 800, 피트: 600, 다용도: 800 };

  function u(s) { return String(s == null ? '' : s).replace(/[^\x20-\x7e]/g, function (c) { var h = c.charCodeAt(0).toString(16).toUpperCase(); return '\\U+' + ('0000' + h).slice(-4); }); }
  function W() { this.o = []; }
  W.prototype.g = function (code, val) { this.o.push(String(code), typeof val === 'number' ? (Math.round(val * 1000) / 1000).toString() : String(val)); return this; };
  W.prototype.text = function () { return this.o.join('\r\n') + '\r\n'; };

  function inpoly(x, y, pts) { var c = false; for (var i = 0, n = pts.length; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1e-9) + a[0]) c = !c; } return c; }
  function kindOf(nm) { nm = String(nm || ''); if (/욕실|화장실/.test(nm)) return '욕실'; if (/현관/.test(nm)) return '현관'; if (/드레스|옷방/.test(nm)) return '드레스룸'; if (/피트|PD/.test(nm)) return '피트'; if (/다용도|세탁/.test(nm)) return '다용도'; if (/발코니/.test(nm)) return '발코니'; if (/거실/.test(nm)) return '거실'; if (/주방|식당/.test(nm)) return '주방'; return '방'; }

  function dxf(state, opt) {
    opt = opt || {};
    var shapes = (state && state.shapes) || [], base = (state && state.base) || null;
    var sc = shapes.filter(function (q) { return q.t === 'scale'; })[0];
    var mm = sc ? sc.mm / (Math.hypot(sc.x2 - sc.x1, sc.y2 - sc.y1) || 1) : ((state && state.mmpp) || 0);
    if (!mm) return null;   // 척도를 모르면 실제 크기로 못 낸다
    var Hpx = (state && state.H) || 0;
    var P = function (x, y) { return [x * mm, (Hpx - y) * mm]; };
    var w = new W();
    // 머리
    w.g(0, 'SECTION').g(2, 'HEADER').g(9, '$ACADVER').g(1, 'AC1009').g(9, '$INSUNITS').g(70, 4).g(9, '$DWGCODEPAGE').g(3, 'ANSI_949').g(0, 'ENDSEC');
    // 표: 선 종류·층·글꼴
    w.g(0, 'SECTION').g(2, 'TABLES');
    w.g(0, 'TABLE').g(2, 'LTYPE').g(70, 1).g(0, 'LTYPE').g(2, 'CONTINUOUS').g(70, 0).g(3, 'Solid line').g(72, 65).g(73, 0).g(40, 0).g(0, 'ENDTAB');
    w.g(0, 'TABLE').g(2, 'LAYER').g(70, LAYERS.length);
    LAYERS.forEach(function (l) { w.g(0, 'LAYER').g(2, l[0]).g(70, 0).g(62, l[1]).g(6, 'CONTINUOUS'); });
    w.g(0, 'ENDTAB');
    w.g(0, 'TABLE').g(2, 'STYLE').g(70, 1).g(0, 'STYLE').g(2, 'STANDARD').g(70, 0).g(40, 0).g(41, 1).g(50, 0).g(71, 0).g(42, 200).g(3, 'malgun.ttf').g(4, '').g(0, 'ENDTAB');
    w.g(0, 'ENDSEC');
    // 기호(블록): 문·창·승강기 — 속성(WIDTH, TYPE)으로 캐드에서 개수표를 바로 뽑는다
    w.g(0, 'SECTION').g(2, 'BLOCKS');
    var blk = function (name, body) { w.g(0, 'BLOCK').g(8, '0').g(2, name).g(70, 2).g(10, 0).g(20, 0).g(30, 0).g(3, name); body(); w.g(0, 'ENDBLK').g(8, '0'); };
    var line = function (lay, a, b) { w.g(0, 'LINE').g(8, lay).g(10, a[0]).g(20, a[1]).g(30, 0).g(11, b[0]).g(21, b[1]).g(31, 0); };
    var attdef = function (tag, prompt, y) { w.g(0, 'ATTDEF').g(8, '0').g(10, 0).g(20, y).g(30, 0).g(40, 80).g(1, '').g(3, u(prompt)).g(2, tag).g(70, 1); };
    blk('JJ-DOOR-SWING', function () { line('0', [0, 0], [0, 1000]); w.g(0, 'ARC').g(8, '0').g(10, 0).g(20, 0).g(30, 0).g(40, 1000).g(50, 0).g(51, 90); attdef('WIDTH', '문 폭(mm)', -150); attdef('TYPE', '문 종류', -250); });
    blk('JJ-WIN-DOUBLE', function () { line('0', [0, -500], [1000, -500]); line('0', [1000, -500], [1000, 500]); line('0', [1000, 500], [0, 500]); line('0', [0, 500], [0, -500]); line('0', [0, -120], [1000, -120]); line('0', [0, 120], [1000, 120]); attdef('WIDTH', '창 폭(mm)', -700); attdef('TYPE', '창 종류', -800); });
    blk('JJ-EVTR', function () { line('0', [0, 0], [1000, 0]); line('0', [1000, 0], [1000, 1000]); line('0', [1000, 1000], [0, 1000]); line('0', [0, 1000], [0, 0]); line('0', [0, 0], [1000, 1000]); line('0', [1000, 0], [0, 1000]); });
    w.g(0, 'ENDSEC');
    // 그림
    w.g(0, 'SECTION').g(2, 'ENTITIES');
    var poly = function (lay, pts, closed) { w.g(0, 'POLYLINE').g(8, lay).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, closed ? 1 : 0); pts.forEach(function (p) { w.g(0, 'VERTEX').g(8, lay).g(10, p[0]).g(20, p[1]).g(30, 0); }); w.g(0, 'SEQEND').g(8, lay); };
    var txt = function (lay, s, p, h, center) { w.g(0, 'TEXT').g(8, lay).g(10, p[0]).g(20, p[1]).g(30, 0).g(40, h).g(1, u(s)); if (center) w.g(72, 1).g(73, 2).g(11, p[0]).g(21, p[1]).g(31, 0); };
    var ins = function (name, lay, p, sx, sy, rot, attrs) { w.g(0, 'INSERT').g(8, lay); if (attrs) w.g(66, 1); w.g(2, name).g(10, p[0]).g(20, p[1]).g(30, 0).g(41, sx).g(42, sy).g(50, rot); if (attrs) { Object.keys(attrs).forEach(function (k, i) { w.g(0, 'ATTRIB').g(8, lay).g(10, p[0]).g(20, p[1] - 150 - i * 100).g(30, 0).g(40, 80).g(1, u(attrs[k])).g(2, k).g(70, 1); }); w.g(0, 'SEQEND').g(8, lay); } };
    var cnt = { 벽: 0, 문: 0, 창: 0, 방: 0 };
    // 벽(집지니 표준 두께): 바탕 평면 자료의 벽선
    var G = base && base.그림, wthick = {};
    if (G && G.벽선) {
      var bm = mm;   // 편집기 도형과 바탕 자료는 같은 원본 화소 좌표를 쓴다
      G.벽선.forEach(function (s) { var ax = s[0], a = s[1], b = s[2], c = s[3], t = s[4], hT = t / bm / 2, pts;
        pts = ax === 'h' ? [[a, c - hT], [b, c - hT], [b, c + hT], [a, c + hT]] : [[c - hT, a], [c + hT, a], [c + hT, b], [c - hT, b]];
        var q = pts.map(function (p) { return P(p[0], p[1]); }), lay = WALL_LAYER[t] || 'A-WALL-PRTN';
        poly(lay, q, true);
        w.g(0, 'SOLID').g(8, 'A-WALL-PATT').g(62, 8).g(10, q[0][0]).g(20, q[0][1]).g(30, 0).g(11, q[1][0]).g(21, q[1][1]).g(31, 0).g(12, q[3][0]).g(22, q[3][1]).g(32, 0).g(13, q[2][0]).g(23, q[2][1]).g(33, 0);
        cnt.벽++; });
    }
    var rooms = shapes.filter(function (q) { return q.t === 'room' && q.pts && q.pts.length >= 3; });
    // 문: 경첩 자리에 기호, 방 종류별 표준 폭(네이버 문은 화소 고정이라 그림 폭을 쓰지 않는다 — naver_rules.md)
    shapes.filter(function (q) { return q.t === 'door'; }).forEach(function (q) {
      var L = Math.hypot(q.x2 - q.x1, q.y2 - q.y1) || 1, ux = (q.x2 - q.x1) / L, uy = (q.y2 - q.y1) / L, s = q.flip ? -1 : 1, nx = -uy * s, ny = ux * s;
      var mx = q.x1 + (ux + nx) * L * 0.35, my = q.y1 + (uy + ny) * L * 0.35, rm = rooms.filter(function (r) { return inpoly(mx, my, r.pts); })[0];
      var kind = rm ? (rm.kind || kindOf(rm.name)) : '', wid = q.wmm || STD_DOOR[kind] || 900;   // 그림 길이로 재지 않는다 — 원본 문은 화소 고정 크기(naver_rules.md)
      var H = P(q.x1, q.y1), O = P(q.x2, q.y2), Lf = P(q.x1 + nx * L, q.y1 + ny * L);
      var ang = Math.atan2(O[1] - H[1], O[0] - H[0]) * 180 / Math.PI, cr = (O[0] - H[0]) * (Lf[1] - H[1]) - (O[1] - H[1]) * (Lf[0] - H[0]);
      ins('JJ-DOOR-SWING', 'A-DOOR', H, wid / 1000, (cr >= 0 ? 1 : -1) * wid / 1000, ang, { WIDTH: String(wid), TYPE: kind === '현관' ? '현관문' : kind === '욕실' ? '욕실문' : '방문' });
      cnt.문++; });
    // 창: 바탕 자료가 있으면 그 샷시(바깥·발코니 쪽만)를 쓰고, 자동으로 놓인 창 도형은 겹치므로 뺀다
    var wins = shapes.filter(function (q) { return q.t === 'win' && !(G && G.샷시 && q.auto); });
    if (G && G.샷시) G.샷시.forEach(function (s) { var ax = s[0], x0 = s[1], y0 = s[2], x1 = s[3], y1 = s[4];
      wins.push(ax === 'h' ? { x1: x0, y1: (y0 + y1) / 2, x2: x1, y2: (y0 + y1) / 2, tmm: Math.max(120, Math.abs(y1 - y0) * mm) } : { x1: (x0 + x1) / 2, y1: y1, x2: (x0 + x1) / 2, y2: y0, tmm: Math.max(120, Math.abs(x1 - x0) * mm) }); });
    wins.forEach(function (q) {
      var A = P(q.x1, q.y1), B = P(q.x2, q.y2), Lm = Math.hypot(B[0] - A[0], B[1] - A[1]); if (Lm < 200) return;
      var ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI, th = q.tmm || 250;
      ins('JJ-WIN-DOUBLE', 'A-GLAZ', A, Lm / 1000, th / 1000, ang, { WIDTH: String(Math.round(Lm / 10) * 10), TYPE: q.kind || '이중창' });
      cnt.창++; });
    // 방
    rooms.forEach(function (r) { var q = r.pts.map(function (p) { return P(p[0], p[1]); }); poly('A-AREA', q, true);
      var cx = 0, cy = 0; q.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= q.length; cy /= q.length;
      var a = 0; for (var i = 0; i < q.length; i++) { var p1 = q[i], p2 = q[(i + 1) % q.length]; a += p1[0] * p2[1] - p2[0] * p1[1]; } a = Math.abs(a) / 2 / 1e6;
      txt('A-AREA-IDEN', r.name || '공간', [cx, cy + 120], 220, true); txt('A-AREA-IDEN', (Math.round(a * 100) / 100) + ' m2', [cx, cy - 200], 160, true); cnt.방++; });
    // 치수·글자
    shapes.filter(function (q) { return q.t === 'dim'; }).forEach(function (q) { var A = P(q.x1, q.y1), B = P(q.x2, q.y2); line('A-ANNO-DIMS', A, B); txt('A-ANNO-DIMS', String(Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]))), [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 80], 150, true); });
    shapes.filter(function (q) { return q.t === 'text' && q.text; }).forEach(function (q) { txt('A-ANNO-TEXT', q.text, P(q.x, q.y), 200, false); });
    if (G && G.EV) G.EV.forEach(function (e) { var a = P(e[0], e[3]), b = P(e[2], e[1]); ins('JJ-EVTR', 'A-FLOR-EVTR', a, (b[0] - a[0]) / 1000, (b[1] - a[1]) / 1000, 0); });
    if (opt.title) txt('A-ANNO-TEXT', opt.title, [0, -900], 300, false);
    w.g(0, 'ENDSEC').g(0, 'EOF');
    return { text: w.text(), count: cnt };
  }

  root.JJCadIO = { dxf: dxf, version: '2026-11-12' };
})(typeof window !== 'undefined' ? window : this);
