/* 집지니 캐드 입출력 (2026-11-12 대표 지시 「집지니 캐드 기능 전부를 캐드와 연동되는 구조로」)
   JJCadIO.dxf(state) → 교환용 캐드 파일 글(가장 널리 읽히는 판, 오토캐드·캐드 프로그램 모두 열림)
   층·기호 규격은 tools/plan_cad_spec.md 와 같다(서버 쪽 tools/plan_cad.py 와 같은 결과).
   한글은 캐드 표준 유니코드 표기(\U+XXXX)로 넣어 어느 판에서도 깨지지 않게 한다. */
(function (root) {
  'use strict';
  var LAYERS = [['A-WALL-EXTR', 7], ['A-WALL-STRC', 7], ['A-WALL-PRTN', 8], ['A-WALL-PATT', 8], ['A-DOOR', 4], ['A-GLAZ', 5], ['A-AREA', 9], ['A-AREA-IDEN', 7], ['A-ANNO-DIMS', 3], ['A-ANNO-TEXT', 7], ['A-FLOR-STRS', 8], ['A-FLOR-EVTR', 8], ['A-AREA-PUBL', 9]];
  // 공사 표시: 실내(I) 분야 층, 공종마다 한 층 — 공종별로 켜고 끄며 업체에 나눠 줄 수 있게
  var WORK = [['철거', 'DEMO', 1], ['창호', 'GLAZ', 5], ['설비', 'PLMB', 4], ['전기', 'ELEC', 30], ['목공', 'CARP', 34], ['타일', 'TILE', 3], ['도장', 'PNTG', 6], ['도배', 'WALP', 210], ['바닥', 'FLOR', 40], ['가구', 'FURN', 8]];
  WORK.forEach(function (w) { LAYERS.push(['I-WORK-' + w[1], w[2]]); });
  var WORK_LAY = {}; WORK.forEach(function (w) { WORK_LAY[w[0]] = 'I-WORK-' + w[1]; });
  var WALL_LAYER = { 250: 'A-WALL-EXTR', 200: 'A-WALL-STRC', 120: 'A-WALL-PRTN' };
  var STD_DOOR = { 욕실: 750, 현관: 1000, 드레스룸: 800, 피트: 600, 다용도: 800 };

  // 기호(블록): 문·창·승강기 — 속성(WIDTH, TYPE)으로 캐드에서 개수표를 바로 뽑는다(plan_cad_spec.md)
  var L0 = function (a, b) { return { k: 'line', lay: '0', a: a, b: b }; };
  var BLOCKS = {
    'JJ-DOOR-SWING': [L0([0, 0], [0, 1000]), { k: 'arc', lay: '0', c: [0, 0], r: 1000, a0: 0, a1: 90 }, { k: 'attdef', tag: 'WIDTH', prompt: '문 폭(mm)', p: [0, -150] }, { k: 'attdef', tag: 'TYPE', prompt: '문 종류', p: [0, -250] }],
    'JJ-WIN-DOUBLE': [L0([0, -500], [1000, -500]), L0([1000, -500], [1000, 500]), L0([1000, 500], [0, 500]), L0([0, 500], [0, -500]), L0([0, -120], [1000, -120]), L0([0, 120], [1000, 120]), { k: 'attdef', tag: 'WIDTH', prompt: '창 폭(mm)', p: [0, -700] }, { k: 'attdef', tag: 'TYPE', prompt: '창 종류', p: [0, -800] }],
    // 공사 표시 하나: 동그라미 + 속성(종류 이름·공종·쪽지, 편집기 기호 열쇠·모양·꼭짓점 — 다시 열 때 그대로 되살린다)
    'JJ-WORK': [{ k: 'arc', lay: '0', c: [0, 0], r: 150, a0: 0, a1: 360 }, { k: 'attdef', tag: 'NAME', prompt: '공사 이름', p: [200, 0] }, { k: 'attdef', tag: 'TRADE', prompt: '공종', p: [200, -100] }, { k: 'attdef', tag: 'NOTE', prompt: '쪽지', p: [200, -200] }, { k: 'attdef', tag: 'KEY', prompt: '집지니 기호', p: [200, -300] }, { k: 'attdef', tag: 'FORM', prompt: '모양', p: [200, -400] }, { k: 'attdef', tag: 'VTX', prompt: '꼭짓점(mm)', p: [200, -500] }, { k: 'attdef', tag: 'STATE', prompt: '상태', p: [200, -600] }],
    'JJ-EVTR': [L0([0, 0], [1000, 0]), L0([1000, 0], [1000, 1000]), L0([1000, 1000], [0, 1000]), L0([0, 1000], [0, 0]), L0([0, 0], [1000, 1000]), L0([1000, 0], [0, 1000])]
  };
  var VERSION = '20261112zo';
  function u(s) { return String(s == null ? '' : s).replace(/[^\x20-\x7e]/g, function (c) { var h = c.charCodeAt(0).toString(16).toUpperCase(); return '\\U+' + ('0000' + h).slice(-4); }); }
  function W() { this.o = []; }
  W.prototype.g = function (code, val) { this.o.push(String(code), typeof val === 'number' ? (Math.round(val * 1000) / 1000).toString() : String(val)); return this; };
  W.prototype.text = function () { return this.o.join('\r\n') + '\r\n'; };

  function inpoly(x, y, pts) { var c = false; for (var i = 0, n = pts.length; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1e-9) + a[0]) c = !c; } return c; }
  function kindOf(nm) { nm = String(nm || ''); if (/욕실|화장실/.test(nm)) return '욕실'; if (/현관/.test(nm)) return '현관'; if (/드레스|옷방/.test(nm)) return '드레스룸'; if (/피트|PD/.test(nm)) return '피트'; if (/다용도|세탁/.test(nm)) return '다용도'; if (/발코니/.test(nm)) return '발코니'; if (/거실|리빙/.test(nm)) return '거실'; if (/주방|식당/.test(nm)) return '주방'; return '방'; }

  // ── 1단계: 편집기 상태 → 중립 도면 목록(실제 mm, 캐드 좌표 y 위로). 교환용·고유 형식·다시 읽기가 모두 이것 하나를 쓴다
  function model(state, opt) {
    opt = opt || {};
    var shapes = (state && state.shapes) || [], base = (state && state.base) || null;
    var sc = shapes.filter(function (q) { return q.t === 'scale'; })[0];
    var mm = sc ? sc.mm / (Math.hypot(sc.x2 - sc.x1, sc.y2 - sc.y1) || 1) : ((state && state.mmpp) || 0);
    if (!mm) return null;   // 척도를 모르면 실제 크기로 못 낸다
    var Hpx = (state && state.H) || 0;
    var P = function (x, y) { return [x * mm, (Hpx - y) * mm]; };
    var E = [];
    var line = function (lay, a, b) { E.push({ k: 'line', lay: lay, a: a, b: b }); };
    var poly = function (lay, pts, closed) { E.push({ k: 'poly', lay: lay, pts: pts, closed: !!closed }); };
    var txt = function (lay, s, p, h, center) { E.push({ k: 'text', lay: lay, s: String(s), p: p, h: h, center: !!center }); };
    var ins = function (name, lay, p, sx, sy, rot, attrs) { E.push({ k: 'insert', name: name, lay: lay, p: p, sx: sx, sy: sy, rot: rot, attrs: attrs || null }); };
    var solid = function (lay, q) { E.push({ k: 'solid', lay: lay, q: q }); };
    var cnt = { 벽: 0, 문: 0, 창: 0, 방: 0 };
    // 벽(집지니 표준 두께): 바탕 평면 자료의 벽선
    var G = base && base.그림, wthick = {};
    if (G && G.벽선) {
      var bm = mm;   // 편집기 도형과 바탕 자료는 같은 원본 화소 좌표를 쓴다
      G.벽선.forEach(function (s) { var ax = s[0], a = s[1], b = s[2], c = s[3], t = s[4], hT = t / bm / 2, pts;
        pts = ax === 'h' ? [[a, c - hT], [b, c - hT], [b, c + hT], [a, c + hT]] : [[c - hT, a], [c + hT, a], [c + hT, b], [c - hT, b]];
        var q = pts.map(function (p) { return P(p[0], p[1]); }), lay = WALL_LAYER[t] || 'A-WALL-PRTN';
        poly(lay, q, true); solid('A-WALL-PATT', q);
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
    // 공사 표시(편집기 작업 기호): 점은 기호, 선·구역은 선 + 이름 기호. 기호 속성에 편집기 열쇠와 꼭짓점을 넣어 다시 열 때 그대로 돌아온다
    var SY = opt.syms || {}; cnt.공사 = 0;
    shapes.filter(function (q) { return q.t === 'wk' && q.k; }).forEach(function (q) { var sy = SY[q.k] || [], tr = sy[0] || '', lay = WORK_LAY[tr] || 'I-WORK-FURN', nm = sy[1] || q.k, at, pts = (q.pts || []).map(function (p) { return P(p[0], p[1]); });
      if (q.f === 'p' || !pts.length) at = P(q.x, q.y);
      else { poly(lay, pts, q.f === 'a'); if (q.f === 'a') { var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); at = [cx / pts.length, cy / pts.length]; } else at = [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2]; }
      var vtx = pts.map(function (p) { return Math.round(p[0]) + ',' + Math.round(p[1]); }).join(';');
      ins('JJ-WORK', lay, at, 1, 1, 0, { NAME: nm, TRADE: tr, NOTE: q.note || '', KEY: q.k, FORM: q.f || 'p', VTX: vtx.length < 250 ? vtx : '', STATE: q.st || '' });
      txt(lay, (sy[3] || nm), [at[0] + 200, at[1] + 80], 160, false); cnt.공사++; });
    if (opt.title) txt('A-ANNO-TEXT', opt.title, [0, -900], 300, false);
    return { ents: E, count: cnt, mm: mm, name: (state && state.name) || '' };
  }

  // ── 2단계 가: 교환용 캐드 파일 글(가장 오래된 판 — 어느 캐드에서도 열림)
  function writeDXF(M) {
    var w = new W();
    w.g(0, 'SECTION').g(2, 'HEADER').g(9, '$ACADVER').g(1, 'AC1009').g(9, '$INSUNITS').g(70, 4).g(9, '$DWGCODEPAGE').g(3, 'ANSI_949').g(0, 'ENDSEC');
    w.g(0, 'SECTION').g(2, 'TABLES');
    w.g(0, 'TABLE').g(2, 'LTYPE').g(70, 1).g(0, 'LTYPE').g(2, 'CONTINUOUS').g(70, 0).g(3, 'Solid line').g(72, 65).g(73, 0).g(40, 0).g(0, 'ENDTAB');
    w.g(0, 'TABLE').g(2, 'LAYER').g(70, LAYERS.length);
    LAYERS.forEach(function (l) { w.g(0, 'LAYER').g(2, l[0]).g(70, 0).g(62, l[1]).g(6, 'CONTINUOUS'); });
    w.g(0, 'ENDTAB');
    w.g(0, 'TABLE').g(2, 'STYLE').g(70, 1).g(0, 'STYLE').g(2, 'STANDARD').g(70, 0).g(40, 0).g(41, 1).g(50, 0).g(71, 0).g(42, 200).g(3, 'malgun.ttf').g(4, '').g(0, 'ENDTAB');
    w.g(0, 'ENDSEC');
    var put = function (e) {
      if (e.k === 'line') w.g(0, 'LINE').g(8, e.lay).g(10, e.a[0]).g(20, e.a[1]).g(30, 0).g(11, e.b[0]).g(21, e.b[1]).g(31, 0);
      else if (e.k === 'arc') w.g(0, 'ARC').g(8, e.lay).g(10, e.c[0]).g(20, e.c[1]).g(30, 0).g(40, e.r).g(50, e.a0).g(51, e.a1);
      else if (e.k === 'poly') { w.g(0, 'POLYLINE').g(8, e.lay).g(66, 1).g(10, 0).g(20, 0).g(30, 0).g(70, e.closed ? 1 : 0); e.pts.forEach(function (p) { w.g(0, 'VERTEX').g(8, e.lay).g(10, p[0]).g(20, p[1]).g(30, 0); }); w.g(0, 'SEQEND').g(8, e.lay); }
      else if (e.k === 'solid') { var q = e.q; w.g(0, 'SOLID').g(8, e.lay).g(62, 8).g(10, q[0][0]).g(20, q[0][1]).g(30, 0).g(11, q[1][0]).g(21, q[1][1]).g(31, 0).g(12, q[3][0]).g(22, q[3][1]).g(32, 0).g(13, q[2][0]).g(23, q[2][1]).g(33, 0); }
      else if (e.k === 'text') { w.g(0, 'TEXT').g(8, e.lay).g(10, e.p[0]).g(20, e.p[1]).g(30, 0).g(40, e.h).g(1, u(e.s)); if (e.center) w.g(72, 1).g(73, 2).g(11, e.p[0]).g(21, e.p[1]).g(31, 0); }
      else if (e.k === 'attdef') w.g(0, 'ATTDEF').g(8, '0').g(10, e.p[0]).g(20, e.p[1]).g(30, 0).g(40, 80).g(1, '').g(3, u(e.prompt)).g(2, e.tag).g(70, 1);
      else if (e.k === 'insert') { w.g(0, 'INSERT').g(8, e.lay); if (e.attrs) w.g(66, 1); w.g(2, e.name).g(10, e.p[0]).g(20, e.p[1]).g(30, 0).g(41, e.sx).g(42, e.sy).g(50, e.rot);
        if (e.attrs) { Object.keys(e.attrs).forEach(function (k, i) { w.g(0, 'ATTRIB').g(8, e.lay).g(10, e.p[0]).g(20, e.p[1] - 150 - i * 100).g(30, 0).g(40, 80).g(1, u(e.attrs[k])).g(2, k).g(70, 1); }); w.g(0, 'SEQEND').g(8, e.lay); } } };
    w.g(0, 'SECTION').g(2, 'BLOCKS');
    Object.keys(BLOCKS).forEach(function (nm) { w.g(0, 'BLOCK').g(8, '0').g(2, nm).g(70, 2).g(10, 0).g(20, 0).g(30, 0).g(3, nm); BLOCKS[nm].forEach(put); w.g(0, 'ENDBLK').g(8, '0'); });
    w.g(0, 'ENDSEC');
    w.g(0, 'SECTION').g(2, 'ENTITIES'); M.ents.forEach(put); w.g(0, 'ENDSEC').g(0, 'EOF');
    return w.text();
  }
  function dxf(state, opt) { var M = model(state, opt); return M ? { text: writeDXF(M), count: M.count } : null; }

  // ── 2단계 나: 오토캐드 고유 형식(acad-ts, 상업 이용 자유 공개 프로그램) — 덩치가 커서 누를 때만 불러온다(assets/cad_dwg.js)
  function lib(cb) { if (root.JJDwgLib) return cb(root.JJDwgLib); var d = root.document, sc = d.createElement('script'); sc.src = 'assets/cad_dwg.js?v=' + VERSION; sc.onload = function () { cb(root.JJDwgLib || null); }; sc.onerror = function () { cb(null); }; d.head.appendChild(sc); }
  function dwg(state, opt, cb) { var M = model(state, opt); if (!M) return cb(null, '척도'); lib(function (L) { if (!L) return cb(null, '불러오기'); try { cb({ bytes: L.write(M, LAYERS, BLOCKS), count: M.count }); } catch (e) { cb(null, e && e.message); } }); }



  // ── 거꾸로: 캐드 파일 읽기 ───────────────────────────────────────────
  // 교환용 파일 글 → 중립 목록. 기호(블록) 안 선은 넣은 자리로 옮겨 펼친다. 한글: \U+XXXX 와 글 안 글꼴 지정은 풀어 낸다.
  function decodeBytes(buf) { var u8 = new Uint8Array(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { try { return new TextDecoder('euc-kr').decode(u8); } catch (e2) { return new TextDecoder('latin1').decode(u8); } } }
  function cleanText(t) { return String(t || '').replace(/\\U\+([0-9A-Fa-f]{4})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); }).replace(/\\[PX]/g, ' ').replace(/\\[A-Za-z][^;\\{}]*;/g, '').replace(/[{}]/g, '').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/\s+/g, ' ').trim(); }
  function parseDXF(text) {
    var L = text.split(/\r?\n/), pairs = [];
    for (var i = 0; i + 1 < L.length; i += 2) pairs.push([parseInt(L[i], 10), L[i + 1]]);
    var units = 0, blocks = {}, ents = [], sec = '', i2 = 0, cur = null, curBlock = null, poly = null;
    var num = function (v) { return parseFloat(v) || 0; };
    var flush = function () { if (!cur) return; var dst = curBlock ? curBlock.ents : ents; if (cur.type === 'POLYLINE') { poly = cur; cur.pts = []; dst.push(cur); } else if (cur.type === 'VERTEX') { if (poly) poly.pts.push([cur.x, cur.y]); } else if (cur.type === 'SEQEND') { poly = null; } else if (cur.type === 'ATTRIB') { var last = dst[dst.length - 1]; if (last && last.type === 'INSERT') last.attrs[cur.tag] = cleanText(cur.text); } else dst.push(cur); cur = null; };
    for (; i2 < pairs.length; i2++) { var c = pairs[i2][0], v = pairs[i2][1], vt = v.trim();
      if (c === 0) { flush();
        if (vt === 'SECTION') { sec = ''; continue; } if (vt === 'ENDSEC') { sec = ''; continue; } if (vt === 'EOF') break;
        if (sec === 'BLOCKS' && vt === 'BLOCK') { curBlock = { name: '', bx: 0, by: 0, ents: [] }; cur = { type: 'BLOCKHEAD' }; continue; }
        if (sec === 'BLOCKS' && vt === 'ENDBLK') { if (curBlock) blocks[curBlock.name] = curBlock; curBlock = null; continue; }
        if (sec === 'ENTITIES' || (sec === 'BLOCKS' && curBlock)) cur = { type: vt, lay: '0', x: 0, y: 0, attrs: {}, pts: [], text: '' };
        continue; }
      if (c === 2 && !sec && pairs[i2 - 1] && pairs[i2 - 1][1].trim() === 'SECTION') { sec = vt; continue; }
      if (sec === 'HEADER' && c === 9 && vt === '$INSUNITS' && pairs[i2 + 1]) { units = parseInt(pairs[i2 + 1][1], 10) || 0; continue; }
      if (!cur) continue;
      if (cur.type === 'BLOCKHEAD') { if (c === 2) curBlock.name = vt; else if (c === 10) curBlock.bx = num(v); else if (c === 20) curBlock.by = num(v); continue; }
      switch (c) {
        case 8: cur.lay = vt; break; case 2: if (cur.type === 'INSERT') cur.name = vt; else cur.tag = vt; break;
        case 1: cur.text = (cur.type === 'MTEXT' ? cur.text : '') + v; break; case 3: if (cur.type === 'MTEXT') cur.text += v; break;
        case 10: if (cur.type === 'LWPOLYLINE') cur.pts.push([num(v), 0]); else cur.x = num(v); break;
        case 20: if (cur.type === 'LWPOLYLINE') { if (cur.pts.length) cur.pts[cur.pts.length - 1][1] = num(v); } else cur.y = num(v); break;
        case 11: cur.x2 = num(v); break; case 21: cur.y2 = num(v); break; case 12: cur.x3 = num(v); break; case 22: cur.y3 = num(v); break; case 13: cur.x4 = num(v); break; case 23: cur.y4 = num(v); break;
        case 40: cur.r = num(v); break; case 41: cur.sx = num(v); break; case 42: cur.sy = num(v); break; case 50: cur.a0 = num(v); break; case 51: cur.a1 = num(v); break;
        case 70: cur.flag = parseInt(v, 10) || 0; break; case 66: break; } }
    flush();
    // 중립 목록으로 + 기호 펼치기(우리 기호 JJ- 는 기호째로 둔다)
    var out = [], RADc = Math.PI / 180;
    var emit = function (e, T, depth) { var tp = function (x, y) { return T(x, y); }, lay = e.lay;
      if (e.type === 'LINE') out.push({ k: 'line', lay: lay, a: tp(e.x, e.y), b: tp(e.x2, e.y2) });
      else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') { if (e.pts.length >= 2) out.push({ k: 'poly', lay: lay, pts: e.pts.map(function (p) { return tp(p[0], p[1]); }), closed: !!(e.flag & 1) }); }
      else if (e.type === 'ARC' || e.type === 'CIRCLE') { var a0 = e.type === 'CIRCLE' ? 0 : (e.a0 || 0), a1 = e.type === 'CIRCLE' ? 360 : (e.a1 || 0); if (a1 < a0) a1 += 360; var pts = [], n = Math.max(6, Math.round((a1 - a0) / 10)); for (var s = 0; s <= n; s++) { var t = (a0 + (a1 - a0) * s / n) * RADc; pts.push(tp(e.x + e.r * Math.cos(t), e.y + e.r * Math.sin(t))); } out.push({ k: 'poly', lay: lay, pts: pts, closed: e.type === 'CIRCLE', arc: true }); }
      else if (e.type === 'SOLID' || e.type === 'TRACE') out.push({ k: 'solid', lay: lay, q: [tp(e.x, e.y), tp(e.x2, e.y2), tp(e.x4 == null ? e.x3 : e.x4, e.y4 == null ? e.y3 : e.y4), tp(e.x3, e.y3)] });
      else if (e.type === 'TEXT' || e.type === 'MTEXT') { var s2 = cleanText(e.text); if (s2) out.push({ k: 'text', lay: lay, s: s2, p: (e.type === 'TEXT' && e.x2 != null && (e.x2 || e.y2)) ? tp(e.x2, e.y2) : tp(e.x, e.y), h: e.r || 0 }); }
      else if (e.type === 'INSERT') { var B = blocks[e.name], sx = e.sx || 1, sy = e.sy == null ? sx : (e.sy || 1), ro = (e.a0 || 0) * RADc, cs = Math.cos(ro), sn = Math.sin(ro), bx = B ? B.bx : 0, by = B ? B.by : 0;
        var T2 = function (x, y) { var lx = (x - bx) * sx, ly = (y - by) * sy; return T(e.x + lx * cs - ly * sn, e.y + lx * sn + ly * cs); };
        if (/^JJ-/.test(e.name) || depth > 0 && false) out.push({ k: 'insert', name: e.name, lay: lay, p: T(e.x, e.y), sx: sx, sy: sy, rot: e.a0 || 0, attrs: e.attrs });
        else if (B && depth < 6) B.ents.forEach(function (b) { emit(b, T2, depth + 1); }); } };
    var I = function (x, y) { return [x, y]; };
    ents.forEach(function (e) { emit(e, I, 0); });
    return { ents: out, units: units };
  }
  function unitMM(units, ext) { var f = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 }[units]; if (f) return f; return ext < 80 ? 1000 : ext < 4000 ? 10 : 1; }   // 단위 표시가 없으면 크기로 짐작(집 한 채는 6~30m)
  function kindName(nm) { var k = kindOf(nm); return k; }

  // 중립 목록 → 편집기 평면. 우리가 낸 파일(층 이름·기호)이면 방·벽·문·창을 그대로 되살리고, 남의 도면이면 선 그림으로 넘긴다(그림 읽기 경로).
  function toPlan(N, name) {
    var all = []; N.ents.forEach(function (e) { (e.pts || (e.q) || (e.p ? [e.p] : []).concat(e.a ? [e.a, e.b] : [])).forEach(function (p) { if (p && isFinite(p[0]) && isFinite(p[1])) all.push(p); }); });
    if (!all.length) return { ok: false, why: '그림 요소가 없는 캐드 파일입니다.' };
    // 멀리 떨어진 표제·범례가 범위를 키우지 않게 가운데 98% 로 범위를 잡는다
    var xs = all.map(function (p) { return p[0]; }).sort(function (a, b) { return a - b; }), ys = all.map(function (p) { return p[1]; }).sort(function (a, b) { return a - b; }), q = function (a, t) { return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * t)))]; };
    var x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99), ext = Math.max(x1 - x0, y1 - y0) || 1, f = unitMM(N.units, ext);
    var ours = N.ents.some(function (e) { return e.lay === 'A-AREA'; }) && N.ents.some(function (e) { return /^A-WALL-/.test(e.lay); });
    var mmpp = ext * f / 900, pad = 90, W = Math.round((x1 - x0) * f / mmpp + pad * 2), H = Math.round((y1 - y0) * f / mmpp + pad * 2);
    var X = function (x) { return (x - x0) * f / mmpp + pad; }, Y = function (y) { return (y1 - y) * f / mmpp + pad; }, PX = function (p) { return [X(p[0]), Y(p[1])]; }, r1 = function (v) { return Math.round(v * 10) / 10; };
    if (!ours) return { ok: true, ours: false, raster: { ents: N.ents, W: W, H: H, X: X, Y: Y, mmpp: mmpp }, mmpp: mmpp, W: W, H: H };
    var G = { 벽선: [], 샷시: [], 문: [], EV: [], 공용칸: [], 공용: '', 벽: '', 벽채움: 'nonzero' }, path = [], rooms = [], texts = N.ents.filter(function (e) { return e.k === 'text' && e.lay === 'A-AREA-IDEN'; });
    var TH = { 'A-WALL-EXTR': 250, 'A-WALL-STRC': 200, 'A-WALL-PRTN': 120 }, WK = [];
    N.ents.forEach(function (e) {
      if (e.k === 'poly' && TH[e.lay] && e.closed && e.pts.length === 4) { var px = e.pts.map(PX), bx0 = Math.min.apply(null, px.map(function (p) { return p[0]; })), bx1 = Math.max.apply(null, px.map(function (p) { return p[0]; })), by0 = Math.min.apply(null, px.map(function (p) { return p[1]; })), by1 = Math.max.apply(null, px.map(function (p) { return p[1]; }));
        var hz = (bx1 - bx0) >= (by1 - by0); G.벽선.push(hz ? ['h', r1(bx0), r1(bx1), r1((by0 + by1) / 2), TH[e.lay]] : ['v', r1(by0), r1(by1), r1((bx0 + bx1) / 2), TH[e.lay]]);
        path.push('M' + r1(bx0) + ' ' + r1(by0) + 'L' + r1(bx1) + ' ' + r1(by0) + 'L' + r1(bx1) + ' ' + r1(by1) + 'L' + r1(bx0) + ' ' + r1(by1) + 'Z'); }
      else if (e.k === 'poly' && e.lay === 'A-AREA' && e.pts.length >= 3) {
        var pts = e.pts.map(function (p) { return [r1(X(p[0])), r1(Y(p[1]))]; }), a = 0; for (var i = 0; i < e.pts.length; i++) { var p1 = e.pts[i], p2 = e.pts[(i + 1) % e.pts.length]; a += p1[0] * p2[1] - p2[0] * p1[1]; } a = Math.abs(a) / 2 * f * f / 1e6;
        var cx = 0, cy = 0; e.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= e.pts.length; cy /= e.pts.length;
        var nm = '', best = 1e18; texts.forEach(function (t) { if (/m2|㎡|m²/.test(t.s) || !inpoly(t.p[0], t.p[1], e.pts)) return; var d = Math.hypot(t.p[0] - cx, t.p[1] - cy); if (d < best) { best = d; nm = t.s; } });
        var bxs = e.pts.map(function (p) { return p[0]; }), bys = e.pts.map(function (p) { return p[1]; });
        rooms.push({ name: nm || '공간', kind: kindName(nm), area: Math.round(a * 100) / 100, pts: pts, w: Math.round((Math.max.apply(null, bxs) - Math.min.apply(null, bxs)) * f), d: Math.round((Math.max.apply(null, bys) - Math.min.apply(null, bys)) * f) }); }
      else if (e.k === 'insert') { var ro = (e.rot || 0) * Math.PI / 180, cs = Math.cos(ro), sn = Math.sin(ro), R = function (lx, ly) { return [e.p[0] + lx * cs - ly * sn, e.p[1] + lx * sn + ly * cs]; };
        if (e.name === 'JJ-DOOR-SWING') { var Hh = PX(e.p), O = PX(R(e.sx * 1000, 0)), Lf = PX(R(0, e.sy * 1000)); G.문.push({ x1: r1(Hh[0]), y1: r1(Hh[1]), x2: r1(O[0]), y2: r1(O[1]), cx: r1(Lf[0]), cy: r1(Lf[1]), wmm: parseInt(e.attrs && e.attrs.WIDTH, 10) || 0 }); }
        else if (e.name === 'JJ-WIN-DOUBLE') { var A0 = PX(R(0, -e.sy * 500)), A1 = PX(R(e.sx * 1000, e.sy * 500)), hz2 = Math.abs(Math.cos(ro)) > 0.7; G.샷시.push([hz2 ? 'h' : 'v', Math.round(Math.min(A0[0], A1[0])), Math.round(Math.min(A0[1], A1[1])), Math.round(Math.max(A0[0], A1[0])), Math.round(Math.max(A0[1], A1[1]))]); }
        else if (e.name === 'JJ-WORK' && e.attrs && e.attrs.KEY) { var at2 = e.attrs, fm = at2.FORM || 'p', P0 = PX(e.p), vt = String(at2.VTX || '').split(';').filter(Boolean).map(function (t) { var a = t.split(','); return PX([parseFloat(a[0]) / f, parseFloat(a[1]) / f]); });
          var wk = { t: 'wk', k: at2.KEY, st: at2.STATE || (/철거/.test(at2.TRADE || '') ? 'remove' : 'new'), f: fm, note: at2.NOTE || '' };
          if (fm === 'p' || vt.length < 2) { wk.f = 'p'; wk.x = Math.round(P0[0]); wk.y = Math.round(P0[1]); } else wk.pts = vt.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; });
          WK.push(wk); }
        else if (e.name === 'JJ-EVTR') { var E0 = PX(e.p), E1 = PX([e.p[0] + e.sx * 1000, e.p[1] + e.sy * 1000]); G.EV.push([Math.round(Math.min(E0[0], E1[0])), Math.round(Math.min(E0[1], E1[1])), Math.round(Math.max(E0[0], E1[0])), Math.round(Math.max(E0[1], E1[1]))]); } } });
    G.벽 = path.join('');
    var wx = [], wy = []; G.벽선.forEach(function (s) { if (s[0] === 'h') { wx.push(s[1], s[2]); wy.push(s[3]); } else { wy.push(s[1], s[2]); wx.push(s[3]); } });
    G.틀 = wx.length ? [Math.round(Math.min.apply(null, wx)), Math.round(Math.min.apply(null, wy)), Math.round(Math.max.apply(null, wx)), Math.round(Math.max.apply(null, wy))] : [pad, pad, W - pad, H - pad];
    if (!rooms.length) return { ok: false, why: '방 경계(A-AREA 층)를 찾지 못했습니다.' };
    return { ok: true, ours: true, plan: { 작업: WK, W: W, H: H, mmpp: mmpp, rooms: rooms, 창: [], 문: [], 그림: G, name: name || '캐드 도면', 척도: { 방식: '캐드 파일' } } };
  }
  // 남의 도면: 선을 굵게 그린 그림으로(벽은 굵은 검정, 나머지는 가는 선) — 집지니 그림 읽기에 넘긴다
  function rasterize(R, canvas) { var c = canvas, g = c.getContext('2d'); c.width = R.W; c.height = R.H; g.fillStyle = '#fff'; g.fillRect(0, 0, R.W, R.H); g.strokeStyle = '#000'; g.fillStyle = '#000'; g.lineJoin = 'round'; g.lineCap = 'round';
    var wallish = function (lay) { return /wall|벽|a-wall|^wall|구조|콘크리트/i.test(lay || ''); }, P = function (p) { return [R.X(p[0]), R.Y(p[1])]; };
    R.ents.forEach(function (e) { g.lineWidth = wallish(e.lay) ? 3 : 1.6;
      if (e.k === 'line') { var a = P(e.a), b = P(e.b); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      else if (e.k === 'poly') { g.beginPath(); e.pts.forEach(function (p, i) { var q = P(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); if (e.closed) g.closePath(); g.stroke(); if (e.closed && !e.arc && wallish(e.lay)) g.fill(); }   /* 벽 층의 닫힌 테두리는 채운다 — 그림 읽기는 굵은 검정 벽을 찾는다 */
      else if (e.k === 'solid') { g.beginPath(); e.q.forEach(function (p, i) { var q = P(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.fill(); }
      else if (e.k === 'text' && e.s) { var hpx = Math.max(9, Math.min(28, (e.h || 0) / R.mmpp * 1)); g.font = Math.round(hpx || 12) + 'px sans-serif'; var q = P(e.p); g.fillText(e.s, q[0], q[1]); } });
    return c; }
  // 파일 하나 열기: 교환용(글)·고유 형식(바이트) 모두. cb({ok, ours, plan | raster, why})
  function open(file, cb) { var nm = String(file.name || '').replace(/\.(dxf|dwg)$/i, ''), isDwg = /\.dwg$/i.test(file.name || '');
    var fr = new FileReader(); fr.onerror = function () { cb({ ok: false, why: '파일을 읽지 못했습니다.' }); };
    fr.onload = function () { var buf = fr.result;
      if (!isDwg) { var r; try { r = toPlan(parseDXF(decodeBytes(buf)), nm); } catch (e) { r = { ok: false, why: '캐드 파일 글을 풀지 못했습니다.' }; } return cb(r); }
      lib(function (L) { if (!L) return cb({ ok: false, why: '오토캐드 파일 읽기 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.' }); var N; try { N = L.read(buf, false); } catch (e) { return cb({ ok: false, why: '오토캐드 파일을 풀지 못했습니다(판이 너무 오래되었거나 손상). 캐드에서 교환용 파일로 저장해 올려 주세요.' }); } var r2; try { r2 = toPlan(N, nm); } catch (e) { r2 = { ok: false, why: '도면으로 바꾸지 못했습니다.' }; } cb(r2); }); };
    fr.readAsArrayBuffer(file); }

  // 피디에프: 사진(jpg) 한 장을 A3 한 쪽(도면이 길면 세로)에 맞춰 넣은 문서를 직접 짠다(바깥 도구 없이). jpg 바이트·가로·세로 화소 → 바이트
  function pdf(jpg, w, h) {
    var land = w >= h, PW = land ? 1190.55 : 841.89, PH = land ? 841.89 : 1190.55, M = 28,   /* 도면 모양에 맞춰 A3 가로·세로 */ k = Math.min((PW - M * 2) / w, (PH - M * 2) / h), dw = w * k, dh = h * k, dx = (PW - dw) / 2, dy = (PH - dh) / 2;
    var enc = function (t) { var a = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) a[i] = t.charCodeAt(i) & 255; return a; };
    var parts = [], off = [], len = 0, add = function (b) { parts.push(b); len += b.length; };
    var content = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + dx.toFixed(2) + ' ' + dy.toFixed(2) + ' cm /Im0 Do Q';
    add(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    var obj = function (n, head, stream) { off[n] = len; add(enc(n + ' 0 obj\n' + head + (stream ? '\nstream\n' : '\nendobj\n'))); if (stream) { add(stream); add(enc('\nendstream\nendobj\n')); } };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    obj(4, '<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>', jpg);
    obj(5, '<< /Length ' + content.length + ' >>', enc(content));
    var xref = len, x = 'xref\n0 6\n0000000000 65535 f \n'; for (var i = 1; i <= 5; i++) x += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
    add(enc(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));
    var out = new Uint8Array(len), p = 0; parts.forEach(function (b) { out.set(b, p); p += b.length; }); return out;
  }

  root.JJCadIO = { kindOf: kindOf, pdf: pdf, model: model, dxf: dxf, dwg: dwg, parseDXF: parseDXF, toPlan: toPlan, rasterize: rasterize, open: open, writeDXF: writeDXF, LAYERS: LAYERS, BLOCKS: BLOCKS, version: VERSION };
})(typeof window !== 'undefined' ? window : this);
