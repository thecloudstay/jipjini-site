/* 집지니 CAD 도면 편집기 (2026-11-11) — 콘솔 도면 편집기(2026-11-10 전면 개편)를 공개 쪽으로 옮긴 것
   화면 구성과 조작은 콘솔과 같다: 왼쪽 도구 띠 · 가운데 도면 · 오른쪽 작업지시/측정/도면. 공종 7개·기호 35가지·구분 4가지, 겹쳐 보기, 수량표, 작업지시서.
   2026-11-11 덧붙임(공개 쪽만): 기준선(t:'guide', o:'v'|'h' — 방 안 벽에서 벽까지, 기호·선이 붙는다) · 타공 기호(k:'core', dia 50~200, at 천장·벽·바닥) · 안내 줄을 도면 위가 아니라 위쪽 한 줄로.
   도형 자료(t·k·st·f·pts·x·y·x1…·note·name·h·mm·by)와 기호 정의는 콘솔과 같다 → 여기서 만든 도면을 콘솔에서 그대로 열 수 있다.
     덧붙인 칸(콘솔은 무시한다): grp = 한 줄로 놓은 기호 묶음, rot = 기호 방향(도), flip = 문 여는 쪽, kind·a0 = 분석이 준 공간 종류·넓이.
   뺀 것(콘솔 전용): 도면 보관함·여러 장 탭, 주소·단지명으로 도면 찾기, 그림 주소로 넣기, 의뢰 연결·실측 반영·고객 공개, 시공팀 링크·문자, 서버 호출 전부.
   바탕은 올린 원본이 아니라 JJPlanStyle 로 다시 그린 집지니 도면이다(원본 그림은 이 편집기에 들어오지 않는다).
   저장은 이 브라우저에만(localStorage). 바깥 꾸러미 없음. */
(function (root) {
  'use strict';
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  var FONT = "Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
  // ── 콘솔과 같은 정의
  var TRADES = [['철거', '#b4232a'], ['창호', '#1f6f8b'], ['설비', '#0e7490'], ['전기', '#b45309'], ['목공', '#7c4a1e'], ['타일', '#4d7c0f'], ['도장', '#6d28d9'], ['도배', '#9d3f7a'], ['바닥', '#8a6a12'], ['가구', '#334155']];   // 공사 순서대로
  // 기호: [공종, 이름, 모양(p 점 · l 선 · a 구역), 줄임 글자]
  var SYMS = {
    dmA: ['철거', '철거 구역', 'a', '철거'], dmL: ['철거', '벽·턱 철거', 'l', '철거'], dmP: ['철거', '철거 품목', 'p', '철'],
    sash: ['창호', '샷시 교체', 'p', '샷'],
    pipe: ['설비', '배관 이설', 'l', '배관'], wt: ['설비', '수전(급수)', 'p', '수'], dr: ['설비', '배수구', 'p', '배'], trn: ['설비', '트렌치 유가', 'l', '트렌치'], gas: ['설비', '가스·보일러', 'p', '가'], core: ['설비', '타공', 'p', '타공'], wc: ['설비', '양변기', 'p', '변'], bs: ['설비', '세면대', 'p', '세'], tub: ['설비', '욕조·샤워 구역', 'a', '욕조'],
    wire: ['전기', '배선', 'l', '배선'], db: ['전기', '분전반', 'p', '분'], sw: ['전기', '스위치', 'p', '스'], ol: ['전기', '콘센트', 'p', '콘'], od: ['전기', '전용 콘센트', 'p', '전'], nt: ['전기', '통신·방송', 'p', '통'], dl: ['전기', '매입등', 'p', '매'], cl: ['전기', '직부등(방등)', 'p', '직'], pd: ['전기', '펜던트', 'p', '펜'], ll: ['전기', '간접·줄조명', 'l', '간접'], fan: ['전기', '환풍기', 'p', '환'],
    ins: ['목공', '단열', 'l', '단열'], wallN: ['목공', '가벽 신설', 'l', '가벽'], ceil: ['목공', '천장 공사', 'a', '천장'], cbox: ['목공', '커튼박스', 'l', '커튼박스'], art: ['목공', '벽 마감·아트월', 'l', '벽 마감'], doorN: ['목공', '문·문틀', 'p', '문'], mold: ['목공', '몰딩', 'l', '몰딩'],
    wp: ['타일', '방수 구역', 'a', '방수'], zen: ['타일', '젠다이', 'l', '젠다이'], tileW: ['타일', '벽 타일', 'l', '벽 타일'], tileF: ['타일', '바닥 타일', 'a', '바닥 타일'], edge: ['타일', '모서리 마감', 'p', '모'],
    film: ['도장', '필름', 'p', '필'], paint: ['도장', '도장', 'l', '도장'],
    paper: ['도배', '도배 구역', 'a', '도배'],
    floor: ['바닥', '바닥재(장판·마루)', 'a', '바닥재'], base: ['바닥', '걸레받이', 'l', '걸레받이'],
    sink: ['가구', '싱크대·상판', 'l', '싱크대'], fur: ['가구', '붙박이·수납장', 'a', '수납장'], shoe: ['가구', '신발장', 'a', '신발장']
  };
  var ST = [['new', '신설'], ['keep', '유지'], ['move', '이설'], ['remove', '철거']];
  var RAIL = [['select', '선택', 'V', 'M5 3l13 8-6 1.6-2.4 6.4z'], ['hand', '화면 이동', 'H', 'M4 12h16M12 4v16M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5M8.5 7.5L12 4l3.5 3.5M8.5 16.5L12 20l3.5-3.5'], '재기',
    ['dim', '길이 재기', 'M', 'M3 12h18M3 7v10M21 7v10'], ['wall', '벽 사이', 'W', 'M4 4v16M20 4v16M7 12h10M9.5 9.5L7 12l2.5 2.5M14.5 9.5L17 12l-2.5 2.5'], ['scale', '척도', 'S', 'M3 16L16 3l5 5L8 21zM7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2'], '기준',
    ['guide', '기준선', 'B', 'M2 8h20M9 2v20M6.8 8a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0'], '공간',
    ['room', '공간 그리기', 'R', 'M4 4h16v16H4zM4 13h9v7'], ['win', '창', 'N', 'M3 9.5h18v5H3zM12 9.5v5'], ['door', '문', 'D', 'M5 20V4h8v16M13 20a8 8 0 0 0 7-8'], '지시',
    ['wk', '작업 기호', 'G', 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15zM4.5 12h15M12 4.5v15'], '표시',
    ['arrow', '화살표', 'A', 'M5 19L19 5M10 5h9v9'], ['rect', '사각형', 'Q', 'M4 6h16v12H4z'], ['poly', '다각형', 'Y', 'M12 3l8 6-3 10H7L4 9z'], ['circle', '원', 'C', 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z'], ['pen', '펜', 'P', 'M4 20l4-1L19.5 7.5l-3-3L5 16z'], ['text', '글자', 'T', 'M5 6h14M12 6v13'], ['erase', '지우개', 'E', 'M4 15.5L13 6.5l6 6-6.5 6.5H8zM12.5 19H20']];
  // 작업지시서·물량표 묶음 = 공사 순서. 넷째 칸은 정밀 의뢰서 공사 이름(대응표의 work) — 의뢰서와는 번호가 아니라 이 이름으로 맞춘다
  var CATS = [['1', '철거 · 사전준비', ['dmA', 'dmL', 'dmP'], ['preparation', 'demolition']], ['2', '창호', ['sash'], ['window']], ['3', '설비 · 전기', ['pipe', 'wt', 'dr', 'trn', 'gas', 'core', 'wire', 'db', 'sw', 'ol', 'od', 'nt', 'dl', 'cl', 'pd', 'll', 'fan'], ['plumbing', 'lighting', 'balcony']], ['4', '목공 · 단열', ['ins', 'wallN', 'ceil', 'cbox', 'art', 'doorN', 'mold'], ['carpentry']], ['5', '방수 · 타일', ['wp', 'zen', 'tileW', 'tileF', 'edge'], ['tile']], ['6', '욕실', ['wc', 'bs', 'tub'], ['bathroom']],
    ['7', '필름', ['film'], ['film']], ['8', '도장', ['paint'], ['painting']], ['9', '도배', ['paper'], ['wallpaper']], ['10', '바닥', ['floor', 'base'], ['flooring']], ['11', '가구 · 현관', ['sink', 'fur', 'shoe'], ['sink', 'entrance']], ['12', '기타', [], ['etc']]];
  var LOOPK = /^(mold|base|paint|tileW|art)$/;
  function catOf(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i][2].indexOf(k) >= 0) return i; return 11; }
  function tradeColor(tr) { var t = TRADES.filter(function (x) { return x[0] === tr; })[0]; return t ? t[1] : '#334155'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function R2(v) { return Math.round(v * 100) / 100; }
  function kindOf(nm) { nm = String(nm || ''); return /거실|가족실/.test(nm) ? '거실' : /욕실|화장실/.test(nm) ? '욕실' : /발코니|베란다|다용도/.test(nm) ? '발코니' : /실외기/.test(nm) ? '실외기실' : /주방|식당|부엌/.test(nm) ? '주방' : /현관/.test(nm) ? '현관' : /드레스|파우더|옷방/.test(nm) ? '드레스룸' : /방|침실|서재/.test(nm) ? '방' : '기타'; }

  // ── 상태
  var EL = null, OPT = {}, shapes = [], W = 1000, H = 700, PAD = 100, K = 2, D0 = 1000, SX = 0, SY = 0, SW = 1000, SH = 700, BG = null, base = {}, baseOk = true, planName = '우리 집';
  var tool = 'select', color = '#d8322e', draft = null, poly = null, scaleP1 = null, ptr = null, pts = {}, pinch = null, space = false;
  var V = { z: 1, x: 0, y: 0 }, sel = -1, hist = [], redoSt = [], pane = 'work', wk = { trade: '전기', k: 'dl', st: 'new', row: 6, whole: true, dia: 100, at: '천장' }, gd = { o: 'x', div: false, nv: 3, nh: 2, half: true, off: '', c: '#d11a2a' }, GCOL = [['#d11a2a', '빨강'], ['#1d5fd0', '파랑'], ['#15803d', '초록']];
  var MAP = null, mapState = '', ceilH = 2300, chk = {}, rqPick = {}, mdef = {};   // 물량: 의뢰서 대응표(data/takeoff-map.json) · 천장 높이(mm) · 도면에 찍지 않는 항목 표시 · 기호별로 고른 의뢰서 항목
  var allLen = false, focusOn = true, mute = false, hide = {}, nums = true, sheetMode = false, bgOn = false, bgT = 0, saveT = 0, LABELS = [], OBS = [], full = false, grpSeq = 1;
  try { var sv0 = JSON.parse(localStorage.getItem('jj_cad_layers') || 'null'); if (sv0) { hide = sv0.hide || {}; nums = sv0.nums !== false; } } catch (e) {}
  function laySave() { try { localStorage.setItem('jj_cad_layers', JSON.stringify({ hide: hide, nums: nums })); } catch (e) {} }
  function toast(m, type) { if (OPT.toast) OPT.toast(m, type); }
  function say(t) { var el = $('jjeSay'); if (el) el.textContent = t || '도구를 고른 뒤 도면을 누릅니다. 놓은 것은 「선택」으로 눌러 옮기거나 고칩니다.'; }
  function U() { return Math.max(8, D0 / 34); }

  // ── 자료 바꾸기: 분석 결과(방 다각형 목록) → 편집기 상태
  function fromPlan(p) {
    var sh = [], xs = [], ys = [];
    (p.rooms || []).forEach(function (m) { if (!m.pts || m.pts.length < 3) return; m.pts.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
      var o = { t: 'room', c: '#2f6b4f', name: m.name || '공간', pts: m.pts.map(function (q) { return [Math.round(q[0]), Math.round(q[1])]; }), auto: true, kind: m.kind || kindOf(m.name) }; if (m.area) o.a0 = { area: m.area, w: m.w || 0, d: m.d || 0 }; sh.push(o); });
    if (!xs.length) return null;
    var Wd = p.W || Math.max.apply(null, xs) + Math.min.apply(null, xs), Ht = p.H || Math.max.apply(null, ys) + Math.min.apply(null, ys);
    (p.창 || []).forEach(function (w) { sh.push({ t: 'win', c: '#1d5fd0', x1: Math.round(w.x1), y1: Math.round(w.y1), x2: Math.round(w.x2), y2: Math.round(w.y2), h: w.h_mm || 1200, name: (w.종류 || '창') + (w.안 ? ' ' + w.안 : ''), auto: true }); });
    (p.문 || []).forEach(function (w) { sh.push({ t: 'door', c: '#b06a00', x1: Math.round(w.x1), y1: Math.round(w.y1), x2: Math.round(w.x2), y2: Math.round(w.y2), h: 2100, name: '문', auto: true }); });
    if (p.mmpp > 0) { var L = Math.round(1000 / p.mmpp), x0 = Math.min.apply(null, xs), y1 = Math.max.apply(null, ys), Dm = Math.max(Math.max.apply(null, xs) - x0, y1 - Math.min.apply(null, ys));
      sh.push({ t: 'scale', c: '#1d5fd0', x1: Math.round(x0 - Dm * 0.07), y1: Math.round(y1 + Dm * 0.135), x2: Math.round(x0 - Dm * 0.07) + L, y2: Math.round(y1 + Dm * 0.135), mm: 1000, by: (p.척도 && p.척도.방식) || '치수' }); }
    return { v: 2, W: Math.round(Wd), H: Math.round(Ht), shapes: sh, base: { 외곽: p.외곽 || null, 치수줄: p.치수줄 || null }, baseOk: true, name: p.name || '우리 집', at: Date.now() };
  }
  // 옛 판(첫 집지니 CAD: 번호 스티커·방 빗금)으로 저장된 작업 → 지금 도형으로
  function fromV1(o) {
    var st = fromPlan(o.plan || {}); if (!st) return null; var rooms = (o.plan.rooms || []);
    (o.marks || []).forEach(function (m) { try {
      if (m.t === '철거' && m.a && m.b) { if (Math.hypot(m.a[0] - m.b[0], m.a[1] - m.b[1]) < 1) st.shapes.push({ t: 'wk', k: 'dmP', st: 'remove', f: 'p', x: m.a[0], y: m.a[1], note: m.text || '' }); else st.shapes.push({ t: 'wk', k: 'dmL', st: 'remove', f: 'l', pts: [m.a, m.b], note: m.text || '' }); }
      else if (m.t === '메모' && m.p) st.shapes.push({ t: 'text', c: '#111827', x: m.p[0], y: m.p[1], s: m.text || '작업 지시' });
      else if (m.t === '공사') { var p = m.box ? [[m.box[0], m.box[1]], [m.box[2], m.box[1]], [m.box[2], m.box[3]], [m.box[0], m.box[3]]] : (rooms[m.room] && rooms[m.room].pts); if (!p) return; var c = centroid(p); st.shapes.push({ t: 'poly', c: '#2f6b4f', pts: p.map(function (q) { return [q[0], q[1]]; }) }); st.shapes.push({ t: 'text', c: '#2f6b4f', x: c[0], y: c[1], s: m.text || '공사' }); }
    } catch (e) {} });
    return st;
  }
  function getState() { return { v: 2, W: W, H: H, shapes: shapes, base: base, baseOk: baseOk, name: planName, ceil: ceilH, chk: chk, meth: mdef, at: Date.now() }; }
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(function () { if (OPT.onChange) OPT.onChange(getState()); }, 350); }

  // ── 셈
  function mmpp() { var sc = shapes.filter(function (q) { return q.t === 'scale'; })[0]; if (!sc) return 0; var px = Math.hypot(sc.x2 - sc.x1, sc.y2 - sc.y1); return px > 0 ? sc.mm / px : 0; }
  function centroid(p) { var x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
  function sArea(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
  function pxArea(p) { return Math.abs(sArea(p)); }
  function lineLen(p) { var L = 0; for (var i = 0; i + 1 < p.length; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return L; }
  function inPoly(p, P) { var c = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-9) + a[0]) c = !c; } return c; }
  function segD(x, y, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], t = (dx || dy) ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); }
  function polyD(x, y, P, closed) { var d = 1e9; for (var i = 0; i + 1 < P.length; i++) d = Math.min(d, segD(x, y, P[i], P[i + 1])); if (closed && P.length > 2) d = Math.min(d, segD(x, y, P[P.length - 1], P[0])); return P.length === 1 ? Math.hypot(P[0][0] - x, P[0][1] - y) : d; }
  function polyMeasure(q, mm) { if (!mm || !q.pts || q.pts.length < 3) return null; var per = 0, n = q.pts.length; for (var i = 0; i < n; i++) { var p = q.pts[i], r = q.pts[(i + 1) % n]; per += Math.hypot(r[0] - p[0], r[1] - p[1]); } return { area: pxArea(q.pts) * mm * mm / 1e6, perim: per * mm / 1000 }; }
  function rooms() { return shapes.filter(function (q) { return q.t === 'room' && q.name && q.pts && q.pts.length >= 3; }); }
  function roomAt(x, y) { var best = null, ba = 1e18; rooms().forEach(function (q) { if (inPoly([x, y], q.pts)) { var a = pxArea(q.pts); if (a < ba) { ba = a; best = q; } } }); return best; }
  function straight(x0, y0, x, y) { var dx = Math.abs(x - x0), dy = Math.abs(y - y0); return dy < dx * 0.12 ? [x, y0] : dx < dy * 0.12 ? [x0, y] : [x, y]; }
  // ── 물량(적산) 2026-11-11: 도면에 놓은 기호를 「정밀 의뢰서 선택지」 키에 맞춰 물량을 낸다.
  //   키·재는 방법·자재 계수는 콘솔 물량 묶음표에서 내보낸 data/takeoff-map.json 하나만 본다(단가 없음). 표는 콘솔에서만 고친다.
  //   REQ: 기호 → 의뢰서 선택지 후보(첫째가 기본). 함수는 놓인 공간 종류로 고른다. 도형의 rq 칸에 고른 키를 적는다(없으면 기본).
  var REQ = { dl: ['lighting.downlightNew'], cl: ['lighting.lightReplace'], pd: ['lighting.lightReplace'], ll: ['lighting.lineLighting'], sw: ['lighting.fixtureChange'], ol: ['lighting.fixtureChange'], od: ['lighting.fixtureChange'], db: ['lighting.panelNew'],
    fan: function (kd) { return kd === '욕실' ? ['bathroom.ventilator', 'plumbing.ventSystem'] : ['plumbing.ventSystem', 'bathroom.ventilator']; },
    wt: ['plumbing.waterFall', 'plumbing.waterPurifier', 'plumbing.dishDrain'], dr: ['plumbing.washDrain'], wc: ['bathroom.porcelain'], bs: ['bathroom.porcelain'], tub: ['bathroom.tub', 'bathroom.showerBooth'], gas: ['plumbing.gasMove', 'balcony.boilerMove', 'plumbing.boilerDist'], pipe: ['plumbing.acPipe', 'balcony.pipeExtension'],
    dmA: ['demolition.general'], dmL: ['demolition.nonBearing'], wallN: ['carpentry.partitionNew'], mold: ['carpentry.molding', 'carpentry.minusMolding'], base: ['flooring.baseboard'], ceil: ['carpentry.wellCeiling'], art: ['carpentry.artWall', 'carpentry.wallInsulation'], doorN: ['entrance.roomDoor', 'carpentry.hiddenDoor', 'entrance.middleDoor'],
    tileF: function (kd) { return kd === '욕실' ? ['tile.tileBathroom'] : kd === '현관' ? ['tile.tileEntrance'] : kd === '발코니' || kd === '실외기실' ? ['tile.tileBalcony'] : ['flooring.floorTile', 'tile.tileEntrance', 'tile.tileBalcony']; },
    tileW: function (kd) { return kd === '욕실' ? ['tile.tileBathroom', 'tile.tileKitchen'] : ['tile.tileKitchen', 'tile.tileBathroom']; },
    paper: ['wallpaper.hapji.basic', 'wallpaper.silk.brandShinhan', 'wallpaper.silk.brandKenari', 'wallpaper.silk.brandLX'], floor: ['flooring.janpan22', 'flooring.janpan18', 'flooring.janpan28', 'flooring.janpan45', 'flooring.gangmaru'],
    paint: ['painting.interiorPaint', 'painting.antiMold', 'balcony.elasticCoat'], sash: ['window.fullBasic', 'window.fullMid', 'window.fullPremium', 'window.partial'], film: ['film.roomDoor', 'film.entryDoor'], ins: ['carpentry.wallInsulation'], cbox: ['carpentry.curtainBox'], zen: ['bathroom.zendai'], wp: ['bathroom.waterproof'], fur: ['sink.wardrobe'], sink: ['sink.brandNone', 'sink.brandHanssem'], shoe: ['sink.shoeCabinet'] };
  // ── 공법 (2026-11-11): 자재가 아니라 「어떻게 시공하나」를 고른다. 기호마다 시공 순서대로 [칸, 이름, [[값, 이름, 도면에 적는 짧은 글]…], 보이는 조건(의뢰서 키), 기본값 고르기]. 따로 없으면 첫째 값이 기본.
  //   기본 공법은 mdef['기호.칸'], 그 자리만 다른 공법은 도형의 m 칸. 치수는 도형의 hm(높이)·wm(폭)·tk(두께) mm.
  var P12 = [['1', '1겹(1P)', '1P'], ['2', '2겹(2P)', '2P']], PUT = [['line', '줄퍼티', ''], ['all', '올퍼티', '올퍼티'], ['none', '퍼티 없음', '']],
    JNT = ['joint', '줄눈', [['cement', '시멘트 줄눈', ''], ['epoxy', '에폭시 계열 줄눈', ''], ['urea', '폴리우레아 줄눈', '']]], PAT = ['pat', '붙임 무늬', [['grid', '정줄', ''], ['brick', '엇줄', '엇줄'], ['herr', '헤링본', '헤링본']]], OLDT = ['old', '기존 타일', [['strip', '철거 후 시공', ''], ['over', '덧방', '덧방']]], TSZ = ['size', '타일 크기', [['mid', '300×600 · 600각', ''], ['big', '600×1200 이상 큰 타일', '대형'], ['small', '소형 · 모자이크', '소형']]];
  var METH = {
    dmP: [['item', '품목', [['door', '문·문틀', '문·문틀'], ['closet', '붙박이장', '붙박이장'], ['sink', '싱크대', '싱크대'], ['shoe', '신발장', '신발장'], ['tub', '욕조', '욕조'], ['wc', '변기·세면대', '도기'], ['mold', '몰딩·걸레받이', '몰딩'], ['light', '등기구', '등'], ['etc', '그 밖(메모에 적기)', '']]]],
    dmL: [['kind', '벽 종류', [['dry', '가벽(석고·목재)', ''], ['brick', '조적벽', '조적'], ['conc', '콘크리트 비내력벽', '콘크리트']]]],
    sash: [['how', '방식', [['full', '틀째 교체', ''], ['glass', '유리만 교체', '유리만']]], ['seal', '틀 둘레', [['foam', '폼 채움 + 실리콘', ''], ['mortar', '폼 + 몰탈 사춤 + 실리콘', '']]]],
    pipe: [['how', '배관', [['chase', '홈파기 매립', '매립'], ['open', '노출', '노출']]]],
    wire: [['how', '배선', [['ceil', '천장 속', '천장 속'], ['chase', '벽 홈파기 매립', '매립'], ['mold', '노출 몰드', '몰드']]]],
    dl: [['size', '크기', [['3', '3인치 (타공 75mm)', ''], ['4', '4인치 (타공 100mm)', ''], ['5', '5인치 (타공 125mm)', ''], ['6', '6인치 (타공 150mm)', '']], null, function () { return '4'; }], ['kind', '종류', [['fix', '고정형', ''], ['tilt', '각도 조절형', ''], ['wet', '방습형(욕실·발코니)', ''], ['sensor', '센서형(현관)', '']]], ['ct', '빛 색', [['4000', '주백색 4000K', ''], ['3000', '전구색 3000K', ''], ['6500', '주광색 6500K', '']]]],
    cl: [['kind', '종류', [['room', '방등·거실등', ''], ['sensor', '센서등', ''], ['wet', '방습등(욕실·발코니)', '']]], ['shape', '모양', [['round', '원형', ''], ['square', '사각', '']]], ['size', '크기', [['s', '소형 (지름·한 변 200mm 안팎)', ''], ['m', '중형 (400~500mm)', ''], ['l', '대형 (600mm 이상)', '']]], ['ct', '빛 색', [['4000', '주백색 4000K', ''], ['3000', '전구색 3000K', ''], ['6500', '주광색 6500K', '']]]],
    pd: [['at', '자리', [['table', '식탁 위', ''], ['island', '아일랜드 위', ''], ['etc', '그 밖(메모에 적기)', '']]], ['ct', '빛 색', [['4000', '주백색 4000K', ''], ['3000', '전구색 3000K', ''], ['6500', '주광색 6500K', '']]]],
    ll: [['kind', '방식', [['t5', 'T5 간접등', 'T5'], ['strip', 'LED 줄조명', '줄조명'], ['line', '라인 조명(매입 틀)', '라인']]], ['at', '자리', [['cove', '천장 간접 박스', ''], ['sink', '싱크대 상부장 밑', '상부장 밑'], ['shelf', '선반·가구 안', '가구 안'], ['wall', '벽 간접', '벽']]], ['ct', '빛 색', [['4000', '주백색 4000K', ''], ['3000', '전구색 3000K', ''], ['6500', '주광색 6500K', '']]]],
    ins: [['kind', '방식', [['ebo', '이보드 본드 붙임', '이보드'], ['frame', '각재 틀 + 압출법 단열판 + 석고', '압출+석고'], ['foam', '우레탄 뿜칠', '우레탄']]]],
    wallN: [['frame', '틀', [['wood', '각재 틀', ''], ['steel', '경량 철골 틀', '경량']]], ['pitch', '세로 틀 간격', [['450', '간격 450', ''], ['300', '간격 300', ''], ['600', '간격 600', '']]], ['floor', '바닥 고정', [['foam', '본드·폼 고정(바닥 못 금지)', ''], ['anchor', '앙카 고정(난방 없는 바닥)', '']]], ['side', '붙이는 면', [['2', '양면', '양면'], ['1', '한 면', '한면']]], ['ply', '석고보드', P12], ['fill', '속 채움', [['no', '없음', ''], ['yes', '흡음재 채움', '흡음']]], ['back', '보강', [['no', '없음', ''], ['yes', '합판 보강', '합판']]]],
    ceil: [['frame', '틀', [['wood', '각재 틀', ''], ['steel', '경량 철골 틀', '경량'], ['keep', '기존 틀 유지', '기존 틀']]], ['pitch', '반자틀 간격', [['300', '간격 300', ''], ['450', '간격 450', '']]], ['ply', '석고보드', P12], ['board', '보드 종류', [['std', '일반 보드', ''], ['wet', '방수 보드', '방수'], ['fire', '방화 보드', '방화']]], ['edge', '가장자리', [['mold', '몰딩', ''], ['none', '무몰딩', '무몰딩'], ['minus', '마이너스 몰딩', '마이너스']]]],
    doorN: [['frame', '문틀', [['new', '문틀 교체', ''], ['film', '필름 덧씌움', '필름']]], ['trim', '문선', [['std', '일반 문선', ''], ['9', '9mm 문선', '9mm'], ['none', '무문선', '무문선']]]],
    wp: [['kind', '방수', [['liq', '액체방수', '액체'], ['coat1', '도막방수 1회', '도막 1회'], ['coat2', '도막방수 2회', '도막 2회'], ['both', '액체방수 + 도막방수', '액체+도막']]], ['corner', '모서리 보강', [['yes', '모서리 보강', ''], ['no', '안 함', '']]], ['test', '담수 시험', [['yes', '담수 시험 뒤 타일', ''], ['no', '안 함', '']]]],
    zen: [['top', '윗면', [['tile', '윗면 타일 마감', ''], ['stone', '인조대리석 상판', '상판']]]],
    tileW: [OLDT, TSZ, ['set', '붙임', [['press', '압착', '압착'], ['press2', '개량압착', '개량압착'], ['mortar', '떠발이', '떠발이'], ['bond', '본드', '본드'], ['epoxy', '에폭시', '에폭시']]], JNT, PAT],
    tileF: [OLDT, TSZ, ['set', '붙임', [['press', '압착', '압착'], ['press2', '개량압착', '개량압착'], ['sand', '사모래 물매 후 붙임', '사모래'], ['epoxy', '에폭시', '에폭시']]], JNT, PAT],
    edge: [['kind', '마감', [['sus', '코너비드 스테인리스', '비드 스텐'], ['al', '코너비드 알루미늄', '비드 알루'], ['pvc', '코너비드 플라스틱', '비드 플라'], ['jolly', '졸리컷 45도', '졸리컷'], ['butt', '맞댐', '맞댐']]]],
    paint: [['prep', '바탕', PUT], ['how', '칠', [['roll', '롤러·붓', ''], ['spray', '뿜칠', '뿜칠']]], ['coat', '횟수', [['2', '2회 칠', ''], ['3', '3회 칠', '3회']]]],
    paper: [['area', '범위', [['both', '벽 + 천장', ''], ['wall', '벽만', '벽만'], ['ceil', '천장만', '천장만']]], ['old', '기존 벽지', [['strip', '기존 벽지 제거', ''], ['over', '덧방', '덧방']]], ['prep', '바탕', PUT], ['fix', '바탕 보수', [['no', '없음', ''], ['mold', '곰팡이 제거·방지 처리', '곰팡이'], ['joint', '석고 이음 보강(망사테이프)', '']]], ['bead', '모서리', [['no', '각대 없음', ''], ['yes', '코너비드(각대)', '각대']]], ['lining', '초배', [['float', '부직포 띄움', '띄움'], ['tri', '삼중지', '삼중지'], ['neba', '네바리', '네바리'], ['none', '초배 없음(밀착)', '밀착']], null, function (key) { return /hapji/.test(key) ? 'none' : 'float'; }]],
    floor: [['sub', '바탕', [['asis', '그대로', ''], ['strip', '기존 철거·본드 갈아내기', '철거'], ['level', '수평 몰탈', '수평']]], ['lay', '장판 붙임', [['edge', '가장자리 본드', ''], ['full', '온통 접착', '온통']], /janpan/], ['weld', '장판 이음', [['no', '맞댐', ''], ['yes', '이음 용착', '용착']], /janpan/], ['skirt', '장판 가장자리', [['base', '걸레받이로 마감', ''], ['up', '굽도리 꺾어올림', '굽도리']], /janpan/], ['mk', '마루 종류', [['gang', '강마루', ''], ['won', '원목마루', '원목'], ['ganghwa', '강화마루', '강화'], ['spc', '돌마루(SPC)', '돌마루']], /maru/], ['pat', '마루 깔기 무늬', [['line', '일자 깔기', ''], ['herr', '헤링본', '헤링본'], ['chev', '쉐브론', '쉐브론'], ['diag', '사선 깔기', '사선'], ['block', '바둑판(파케이)', '바둑판']], /maru/], ['fix', '마루 시공', [['glue', '접착 시공', '접착'], ['click', '조립 시공(깔개 깔고)', '조립']], /maru/, function (key) { return 'glue'; }]],
    base: [['kind', '방식', [['std', '일반', ''], ['minus', '마이너스 걸레받이', '마이너스']]]]
  };
  function mOpts(k, key) { return (METH[k] || []).filter(function (o) { return !o[3] || o[3].test(key || ''); }); }
  function mVal(q, o, key) { var v = (q.m && q.m[o[0]]) || mdef[q.k + '.' + o[0]] || (o[4] ? o[4](key || '') : o[2][0][0]); return o[2].some(function (c) { return c[0] === v; }) ? v : o[2][0][0]; }
  function mGet(q, id) { var o = (METH[q.k] || []).filter(function (x) { return x[0] === id; })[0]; return o ? mVal(q, o, reqKey(q)) : ''; }
  function mThick(q) { var kd = mGet(q, 'kind'); return q.tk || (kd === 'frame' ? 50 : kd === 'foam' ? 30 : 23); }
  function mPick(q, i) { var key = reqKey(q); return mOpts(q.k, key).map(function (o) { var v = mVal(q, o, key), c = o[2].filter(function (x) { return x[0] === v; })[0]; return i === 1 && /^(no|asis|std)$/.test(v) ? '' : c[i]; }).filter(Boolean); }
  // 도면에 적는 짧은 글 · 지시서와 물량표에 적는 글
  function mTag(q) { if (iconMode || !METH[q.k]) return ''; var a = mPick(q, 2).slice(0, 3), k = q.k; if (k === 'wallN' || k === 'ceil') a = [a.join(' ')]; if (k === 'zen') a.push('높이 ' + (q.hm || 1000)); else if (k === 'wp') a.push('올림 ' + (q.hm || 1200)); else if (k === 'ins') a = [a[0] + ' ' + mThick(q) + 'T']; return a.length ? ' ' + a.join('·') : ''; }
  function mText(q) { if (!METH[q.k]) return ''; var a = mPick(q, 1), k = q.k; if (k === 'zen') a.unshift('높이 ' + (q.hm || 1000) + ' · 폭 ' + (q.wm || 150)); else if (k === 'wp') a.push('벽 올림 ' + (q.hm || 1200)); else if (k === 'ins') a.push('두께 ' + mThick(q) + 'T'); else if (k === 'edge' && q.hm) a.push('높이 ' + q.hm); return a.join(' · '); }
  function cornersOut(P) { var n = P.length, sg = sArea(P) > 0 ? 1 : -1, c = 0; for (var i = 0; i < n; i++) { var a = P[(i + n - 1) % n], b = P[i], d = P[(i + 1) % n], x1 = b[0] - a[0], y1 = b[1] - a[1], x2 = d[0] - b[0], y2 = d[1] - b[1], cr = (x1 * y2 - y1 * x2) / ((Math.hypot(x1, y1) || 1) * (Math.hypot(x2, y2) || 1)); if (cr * sg < -0.5) c++; } return c; }
  // 공법에 딸린 물량: [이름, 수량, 단위]. 도면에서 바로 나오는 것만 낸다(㎡당 소요량 같은 계수는 넣지 않는다).
  //   석고보드 한 장 900×1800 = 1.62㎡, 시멘트 벽돌 반 장 쌓기(0.5B) ㎡당 75장 · 한 장 쌓기(1.0B) 149장 — 건축 표준 수치
  function mExtra(q, c) { var k = q.k, o = [], g = function (id) { return mGet(q, id); }, n, v;
    if (k === 'paper') { if (g('old') === 'strip') o.push(['기존 벽지 제거', c.qty, '㎡']); if (g('prep') === 'all') o.push(['올퍼티', c.qty, '㎡']); if (g('bead') === 'yes') { n = cornersOut(q.pts); if (n) o.push(['코너비드(각대) · 볼록 모서리', n * c.Hm, 'm']); } v = g('lining'); if (v !== 'none' && c.wall > 0) o.push([(v === 'float' ? '부직포' : v === 'tri' ? '삼중지' : '네바리') + ' 초배 · 벽', c.wall, '㎡']); }
    else if (k === 'paint') { if (g('prep') === 'all') o.push(['올퍼티', c.qty, '㎡']); }
    else if (k === 'tileW' || k === 'tileF') { if (g('old') === 'strip') o.push(['기존 타일 철거', c.qty, '㎡']); if (g('set') === 'sand') o.push(['사모래 물매 바탕', c.qty, '㎡']); }
    else if (k === 'zen') { var w = (q.wm || 150) / 1000, B1 = (q.wm || 150) >= 180; o.push(['조적 ' + (B1 ? '한 장 쌓기' : '반 장 쌓기'), c.L * c.h, '㎡'], ['시멘트 벽돌', Math.ceil(c.L * c.h * (B1 ? 149 : 75)), '장']); if (g('top') === 'tile') o.push(['타일 붙임 · 앞면과 윗면', c.L * c.h + c.L * w, '㎡']); else o.push(['타일 붙임 · 앞면', c.L * c.h, '㎡'], ['상판', c.L, 'm']); }
    else if (k === 'wp') { o.push(['바닥 방수', c.A, '㎡'], ['벽 방수', c.per * c.h, '㎡']); if (g('corner') === 'yes') o.push(['모서리 보강', c.per + q.pts.length * c.h, 'm']); }
    else if (k === 'wallN') { o.push(['석고보드 900×1800 · 손실 전', c.L * c.h * Number(g('side')) * Number(g('ply')) / 1.62, '장']); if (g('fill') === 'yes') o.push(['흡음재', c.L * c.h, '㎡']); if (g('back') === 'yes') o.push(['합판 보강 · 벽 전체일 때', c.L * c.h, '㎡']); }
    else if (k === 'ceil') { o.push(['석고보드 900×1800 · 손실 전', c.A * Number(g('ply')) / 1.62, '장']); if (g('edge') === 'minus') o.push(['마이너스 몰딩', c.per, 'm']); }
    else if (k === 'floor') { v = g('sub'); if (v === 'strip') o.push(['기존 바닥 철거·본드 갈아내기', c.A, '㎡']); else if (v === 'level') o.push(['수평 몰탈', c.A, '㎡']); if (g('weld') === 'yes' && /janpan/.test(reqKey(q))) o.push(['이음 용착', 0, '']); if (/maru/.test(reqKey(q))) { var fp = g('pat'), ls = fp === 'herr' || fp === 'chev' ? 0.15 : fp === 'diag' || fp === 'block' ? 0.1 : 0.05; o.push(['마루 자투리 여유 ' + Math.round(ls * 100) + '%', c.A * ls, '㎡']); } }
    else if ((k === 'wire' || k === 'pipe') && g('how') === 'chase') o.push(['벽 홈파기·미장 보수', c.L, 'm']);
    return o.filter(function (e) { return e[2]; }); }
  // 공법에 따라 기준표 자재에서 빼는 것 (공법 물량으로 따로 내거나, 그 공법에서는 쓰지 않는 자재)
  function mDrop(q) { var k = q.k, a = [], v; if (k === 'wallN' || k === 'ceil') a.push('석고보드'); else if (k === 'zen') { a.push('벽돌'); if (mGet(q, 'top') === 'tile') a.push('상판'); }
    else if (k === 'tileW' || k === 'tileF') { v = mGet(q, 'set'); if (v !== 'bond') a.push('압착본드'); if (v === 'bond' || v === 'epoxy' || v === 'mortar' || v === 'sand') a.push('압착시멘트'); v = mGet(q, 'joint'); a.push(v === 'cement' ? '에폭시 줄눈' : '^줄눈'); if (shapes.some(function (x) { return x.t === 'wk' && x.k === 'edge'; })) a.push('코너비트'); }
    return a.length ? new RegExp(a.join('|')) : null; }
  // 실무에서 말이 안 되거나 빠뜨리기 쉬운 조합 알림 (2026-11-11). 막지는 않고 붉은 글로 알려 준다.
  function mWarn(q) { if (q.t !== 'wk' || !METH[q.k]) return []; var k = q.k, w = [], g = function (id) { return mGet(q, id); }, key = reqKey(q), rm = shapeRoom(q), kd = rm ? (rm.kind || kindOf(rm.name)) : '', has = function (kk) { return shapes.some(function (x) { return x.t === 'wk' && x.k === kk && (!rm || shapeRoom(x) === rm); }); };
    if (k === 'paper') { if (/silk/.test(key) && g('old') === 'over') w.push('실크 벽지는 덧방하지 않습니다. 기존 벽지를 제거해야 합니다.'); if (/hapji/.test(key) && g('lining') === 'float') w.push('합지에 부직포 띄움 초배는 드뭅니다. 맞는지 확인하세요.'); }
    else if (k === 'tileW' || k === 'tileF') { var st = g('set'); if (g('old') === 'over' && (st === 'mortar' || st === 'sand')) w.push('덧방에는 떠발이·사모래 붙임을 쓰지 않습니다. 압착·본드·에폭시 가운데 고르세요.'); if (st === 'bond' && (k === 'tileF' || kd === '욕실')) w.push('본드 붙임은 바닥과 물 닿는 곳에 쓰지 않습니다.'); if (g('size') === 'big' && st !== 'press2' && st !== 'epoxy') w.push('600×1200 이상 큰 타일은 개량압착이나 에폭시로 붙입니다.'); if (kd === '욕실' && g('old') === 'strip' && !has('wp')) w.push('철거 후 시공인데 이 욕실에 방수 구역이 없습니다.'); }
    else if (k === 'zen') { if (!has('wp')) w.push('젠다이를 쌓는 욕실에 방수 구역이 없습니다.'); }
    else if (k === 'dmL') { if (g('kind') === 'conc') w.push('콘크리트 벽 철거는 관리사무소와 구청에 먼저 확인해야 하는 공사입니다.'); }
    else if (k === 'floor') { if (/maru/.test(key) && g('sub') === 'asis') w.push('기존 바닥이 장판이나 마루면 걷어 내고 본드를 갈아내야 강마루를 붙일 수 있습니다. 바탕을 확인하세요.'); if (/maru/.test(key)) { var fpt = g('pat'), fmk = g('mk'), ffx = g('fix'); if ((fpt === 'herr' || fpt === 'chev') && ffx === 'click') w.push('헤링본·쉐브론은 조각이 짧아 접착 시공이 기본입니다. 조립 시공은 전용 제품일 때만 됩니다.'); if ((fpt === 'herr' || fpt === 'chev') && fmk !== 'spc') w.push('헤링본·쉐브론은 전용 규격 마루(짧은 쪽, 좌우 짝)를 따로 주문해야 합니다. 일자용 마루로는 못 깝니다.'); if (fmk === 'ganghwa' && ffx === 'glue') w.push('강화마루는 깔개를 깔고 조립하는 방식입니다. 난방 바닥에는 열이 늦게 올라옵니다.'); if (fmk === 'won') w.push('원목마루는 물과 찍힘에 약하고 난방에 틈이 벌어질 수 있습니다. 난방용 제품인지 확인하세요.'); } }
    return w; }
  function warnAll() { var o = [], seen = {}; shapes.forEach(function (q) { if (q.t !== 'wk') return; var rm = shapeRoom(q); mWarn(q).forEach(function (t) { var id = (rm ? rm.name : '') + t; if (seen[id]) return; seen[id] = 1; o.push((rm ? rm.name + ' ' : '') + SYMS[q.k][1] + ' — ' + t); }); }); return o; }
  function takeEx(r) { return r.exo.map(function (n) { var e = r.ex[n]; return n + ' ' + (e[1] === '장' ? Math.ceil(e[0] - 1e-6) : takeNum(R2(e[0]))) + e[1]; }).join(' · '); }
  function mSel(attr, id, o, v) { return '<div class="jje-row jje-mrow"><label>' + o[1] + '</label><select ' + attr + '="' + id + '">' + o[2].map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === v ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>'; }
  function methPane() { var k = wk.k, key = rqPick[k] || (Array.isArray(REQ[k]) ? REQ[k][0] : ''), os = mOpts(k, key), q = { k: k }; if (!os.length) return '';
    return '<div class="jje-h">공법 — 시공 순서대로</div>' + os.map(function (o) { return mSel('data-m', k + '.' + o[0], o, mVal(q, o, key)); }).join('') + '<p class="jje-p" style="margin-top:6px">여기서 고른 공법으로 다음부터 놓입니다. 이미 놓은 자리는 「선택」으로 눌러 바꿉니다.</p>'; }
  function mapLoad(cb) { if (MAP) return cb(); if (mapState === 'load') return; mapState = 'load'; var done = function (ok) { mapState = ok ? 'ok' : 'fail'; cb(); };
    try { fetch('data/takeoff-map.json?v=20261111').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.items) MAP = j; done(!!MAP); }, function () { done(false); }); } catch (e) { done(false); } }
  function shapeCenter(q) { if (q.f === 'p') return [q.x, q.y]; if (q.f === 'l') return q.loop ? centroid(q.pts.slice(0, -1)) : [(q.pts[0][0] + q.pts[q.pts.length - 1][0]) / 2, (q.pts[0][1] + q.pts[q.pts.length - 1][1]) / 2]; return centroid(q.pts); }
  // 선은 벽 위에 놓이는 일이 많아, 가운데가 방 밖이면 선의 양옆을 조금 들여다보고 방을 찾는다
  function shapeRoom(q) { var c = shapeCenter(q), r = roomAt(c[0], c[1]); if (r || q.f !== 'l' || q.loop || q.pts.length < 2) return r; var a = q.pts[0], b = q.pts[q.pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, d = U() * 0.7;
    return roomAt(c[0] + nx * d, c[1] + ny * d) || roomAt(c[0] - nx * d, c[1] - ny * d) || roomAt(c[0] + nx * d * 2.2, c[1] + ny * d * 2.2) || roomAt(c[0] - nx * d * 2.2, c[1] - ny * d * 2.2); }
  function reqCandsOf(q) { var c = REQ[q.k]; if (typeof c === 'function') { var r = shapeRoom(q); return c(r ? (r.kind || kindOf(r.name)) : ''); } return c || []; }
  function reqCands(k, x, y) { var c = REQ[k]; if (typeof c === 'function') { var r = roomAt(x, y); return c(r ? (r.kind || kindOf(r.name)) : ''); } return c || []; }
  function reqKey(q) { if (q.rq) return q.rq; var key = reqCandsOf(q)[0] || ''; if ((q.k === 'sw' || q.k === 'ol' || q.k === 'od') && q.st === 'move') key = 'lighting.outletMove'; return key; }
  function reqLabel(key) { var it = MAP && MAP.items[key]; return it ? it.label.replace(/\s*\(.*\)$/, '') : key; }
  function rqStamp(q) { if (q && q.t === 'wk' && rqPick[q.k] && reqCandsOf(q).indexOf(rqPick[q.k]) >= 0) q.rq = rqPick[q.k];
    // 놓는 순간의 공법을 도형에 적어 둔다 — 나중에 기본 공법을 바꿔도 이미 놓은 자리는 바뀌지 않는다
    if (q && q.t === 'wk' && METH[q.k]) { var mk = reqKey(q); q.m = q.m || {}; METH[q.k].forEach(function (o) { if (!q.m[o[0]]) q.m[o[0]] = mVal({ k: q.k }, o, mk); }); } return q; }
  function takeRows() {
    var mm = mmpp(), Hm = ceilH / 1000, M = measureAll(), by = {}, order = [], bathSeen = {};
    shapes.forEach(function (q) { if (q.t !== 'wk') return; var S = SYMS[q.k]; if (!S) return; var st = q.st || 'new'; if (st === 'keep' || (st === 'remove' && S[0] !== '철거')) return;
      var key = reqKey(q), c = shapeCenter(q), rm = shapeRoom(q), rname = rm ? rm.name : '', kd = rm ? (rm.kind || kindOf(rm.name)) : '', it = MAP && MAP.items[key], qty = 0, unit = '', how = '', L = 0, A = 0, per = 0, wall = 0, h = Hm;
      if (q.f === 'p') { qty = 1; unit = (it && it.unit) || '개'; if (key === 'bathroom.porcelain') { var bid = rname || ('x' + Math.round(c[0] / 50) + 'y' + Math.round(c[1] / 50)); if (bathSeen[bid]) return; bathSeen[bid] = 1; }
        if (q.k === 'core') { key = ''; }
        if (q.k === 'edge') { h = q.hm ? q.hm / 1000 : Hm; qty = h; unit = 'm'; how = '한 곳에 높이 ' + R2(h) + 'm'; } }
      else if (q.f === 'l') { L = mm ? lineLen(q.pts) * mm / 1000 : 0;
        if (q.k === 'zen') { h = (q.hm || 1000) / 1000; qty = 1; unit = '개소'; how = '길이 ' + R2(L) + 'm × 높이 ' + R2(h) + 'm × 폭 ' + (q.wm || 150) + 'mm'; }
        else if (it && it.measure === '면적') { h = q.hm ? q.hm / 1000 : (q.k === 'tileW' && kd === '주방' ? 0.8 : Hm); qty = L * h; unit = '㎡'; how = '길이 ' + R2(L) + 'm × 높이 ' + R2(h) + 'm'; } else { qty = L; unit = 'm'; } }
      else { A = mm ? pxArea(q.pts) * mm * mm / 1e6 : 0; unit = '㎡'; var pm = polyMeasure(q, mm); per = pm ? pm.perim : 0;
        if (q.k === 'wp') { h = (q.hm || 1200) / 1000; qty = 1; unit = '개소'; how = '바닥 ' + R2(A) + '㎡ + 벽 ' + R2(per * h) + '㎡ (둘레 ' + R2(per) + 'm × 올림 ' + R2(h) + 'm)'; }
        else if (q.k === 'paper' || q.k === 'paint') { var open = 0; if (rm && M && Math.abs(pxArea(rm.pts) - pxArea(q.pts)) < pxArea(rm.pts) * 0.1) { var mr = M.rooms.filter(function (r) { return r.name === rm.name; })[0]; if (mr) open = mr.openM2 || 0; }
          wall = Math.max(0, per * Hm - open); var ar = mGet(q, 'area') || 'both', hw = '벽 ' + R2(wall) + '㎡ (둘레 ' + R2(per) + 'm × ' + Hm + 'm − 창·문 ' + R2(open) + '㎡)', hc = '천장 ' + R2(A) + '㎡'; if (ar === 'wall') { qty = wall; how = hw; } else if (ar === 'ceil') { qty = A; how = hc; wall = 0; } else { qty = wall + A; how = hw + ' + ' + hc; } } else qty = A; }
      var mt = mText(q), id = (key || ('_' + q.k + (q.k === 'core' ? (q.dia || 100) + (q.at || '벽') : ''))) + '|' + mt, b = by[id];
      if (!b) { b = by[id] = { key: key, k: q.k, label: it ? (/^(sink\.brand|window\.full)/.test(key) ? (key.charAt(0) === 's' ? '싱크대 · ' : '샷시 · ') : '') + it.label : key ? key : (q.k === 'core' ? '타공 Ø' + (q.dia || 100) + ' ' + (q.at || '벽') : S[1]), work: it ? it.work : '', qty: 0, unit: unit, rooms: [], how: [], it: it || null, meth: mt, ex: {}, exo: [], drop: mDrop(q), noBom: q.k === 'ins' && mGet(q, 'kind') !== 'frame' }; order.push(id); }
      b.qty += qty; if (rname && b.rooms.indexOf(rname) < 0) b.rooms.push(rname); if (how) { how = (rname ? rname + ' — ' : '') + how; if (b.how.indexOf(how) < 0) b.how.push(how); }
      mExtra(q, { L: L, A: A, per: per, wall: wall, qty: qty, Hm: Hm, h: h }).forEach(function (e) { if (!b.ex[e[0]]) { b.ex[e[0]] = [0, e[2]]; b.exo.push(e[0]); } b.ex[e[0]][0] += e[1]; }); });
    Object.keys(chk).forEach(function (key) { if (!chk[key] || order.some(function (id) { return by[id].key === key; })) return; var it = MAP && MAP.items[key]; if (!it || areaSym(key)) return; by[key] = { key: key, label: it.label, work: it.work, qty: 1, unit: it.measure === '개수' && it.unit ? it.unit : '식', rooms: [], how: [], it: it, chk: true, meth: '', ex: {}, exo: [], noBom: it.measure === '면적' || it.measure === '길이' }; order.push(key); });
    return order.map(function (id) { by[id].qty = R2(by[id].qty); return by[id]; });
  }
  // 면적으로 세는 의뢰서 항목 → 그 항목을 넣는 구역 기호 (물량 칸에서 공간을 눌러 바로 넣는다)
  var AREA_SYM = null;
  function areaSym(key) { if (!AREA_SYM) { AREA_SYM = {}; ['floor', 'paper', 'paint', 'tileF', 'dmA'].forEach(function (k) { var c = REQ[k], L = typeof c === 'function' ? ['', '욕실', '현관', '발코니'].reduce(function (a, kd) { return a.concat(c(kd)); }, []) : (c || []); L.forEach(function (x) { if (!AREA_SYM[x]) AREA_SYM[x] = k; }); }); } var it = MAP && MAP.items[key]; return it && it.measure === '면적' ? (AREA_SYM[key] || '') : ''; }
  function areaAt(k, r) { for (var i = 0; i < shapes.length; i++) { var q = shapes[i]; if (q.t === 'wk' && q.k === k && q.f === 'a' && q.st !== 'keep' && q.pts.length === r.pts.length && Math.abs(pxArea(q.pts) - pxArea(r.pts)) < 2 && inPoly(centroid(q.pts), r.pts)) return i; } return -1; }
  function areaToggle(key, ri) { var k = areaSym(key), r = rooms()[ri]; if (!k || !r) return; var i = areaAt(k, r); snap(); sel = -1;
    if (i >= 0 && reqKey(shapes[i]) === key) { shapes.splice(i, 1); say(r.name + '에서 뺐습니다: ' + reqLabel(key)); }
    else if (i >= 0) { shapes[i].rq = key; delete shapes[i].m; rqStamp(shapes[i]); say(r.name + '에서 바꿨습니다: ' + reqLabel(key)); }
    else { var q = { t: 'wk', k: k, st: SYMS[k][0] === '철거' ? 'remove' : 'new', f: 'a', pts: r.pts.map(function (p) { return [p[0], p[1]]; }), rq: key }; rqStamp(q); shapes.push(q); var mm = mmpp(); say(r.name + ' 전체에 넣었습니다: ' + reqLabel(key) + (mm ? ' ' + R2(pxArea(r.pts) * mm * mm / 1e6) + '㎡' : '')); }
    if (hide[SYMS[k][0]]) { hide[SYMS[k][0]] = false; laySave(); layDraw(); } touch(); }
  function takeCat(r) { if (r.k && !r.chk) return catOf(r.k); for (var i = 0; i < CATS.length; i++) if (CATS[i][3].indexOf(r.work) >= 0) return i; return 11; }
  function takeNum(v) { return v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v >= 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100); }
  function takeMats(r) { if (!r.it || r.noBom || !r.qty) return ''; var one = r.it.mats.length === 1 && r.it.mats[0].q === 1 && r.it.mats[0].u === r.unit; if (one) return '';
    return r.it.mats.filter(function (m) { return !(r.drop && r.drop.test(m.n)); }).map(function (m) { return m.n.replace(/\s*[\(\[].*$/, '').replace(/\s+1(개|식|대|개소|짝|회|m|㎡)$/, '') + ' ' + takeNum(m.q * r.qty) + m.u; }).concat(r.it.labor.map(function (l) { return l.n + ' ' + takeNum(l.d * r.qty) + '일'; })).join(' · '); }
  function takeLabor(rows) { var t = {}, o = []; rows.forEach(function (r) { if (!r.it || r.noBom) return; r.it.labor.forEach(function (l) { if (!(l.n in t)) { t[l.n] = 0; o.push(l.n); } t[l.n] += l.d * r.qty; }); }); return o.map(function (n) { return n + ' ' + takeNum(t[n]) + '일'; }).join(' · '); }
  function takeText() { var rows = takeRows(), L = ['[집지니 CAD 물량] ' + planName + ' (천장 높이 ' + ceilH + 'mm 기준)']; CATS.forEach(function (c, i) { var R = rows.filter(function (r) { return takeCat(r) === i; }); if (!R.length) return; L.push(''); L.push('■ ' + c[0] + ' ' + c[1]); R.forEach(function (r) { L.push('- ' + r.label + ' ' + takeNum(r.qty) + r.unit + (r.rooms.length ? ' (' + r.rooms.join('·') + ')' : '')); if (r.meth) L.push('    공법: ' + r.meth); var x = takeEx(r), m = takeMats(r); if (x) L.push('    딸린 물량: ' + x); if (m) L.push('    ' + m); }); });
    var lb = takeLabor(rows); if (lb) { L.push(''); L.push('품 합계: ' + lb); } L.push(''); L.push('※ 도면 기준 어림 물량입니다. 자재 주문 전 실측으로 확정합니다. · 집지니 CAD jipjini.com/cad.html'); return L.join('\n'); }
  function takeDraw() {
    var el = $('jjePaneTake'); if (!el) return;
    if (!MAP) { el.innerHTML = '<p class="jje-p" style="margin:0">' + (mapState === 'fail' ? '물량 기준표를 불러오지 못했습니다. 인터넷 연결을 확인하고 「물량」을 다시 눌러 주세요.' : '물량 기준표를 불러오고 있습니다…') + '</p>'; if (mapState !== 'fail') mapLoad(function () { if (pane === 'take') takeDraw(); }); else mapState = ''; return; }
    var rows = takeRows(), mm = mmpp(), h = '<div class="jje-row" style="margin-top:0"><label style="width:auto">천장 높이</label><input type="number" id="jjeCeil" min="2000" max="3500" step="10" value="' + ceilH + '" style="width:104px"><span style="font-size:14.5px;color:#6B6B6B">mm · 벽 면적 계산에 씁니다</span></div>';
    if (!mm) h += '<p class="jje-p" style="color:#b4232a">척도가 없어 면적·길이 물량은 0으로 나옵니다. 「측정」에서 척도를 잡아 주세요.</p>';
    var wa = warnAll(); if (wa.length) h += '<div class="jje-h" style="color:#b4232a">확인할 것 ' + wa.length + '건</div>' + wa.map(function (t) { return '<p class="jje-p" style="color:#b4232a;margin:0 0 4px">' + esc(t) + '</p>'; }).join('');
    h += '<div class="jje-h">물량표 — 공사 순서</div>';
    if (!rows.length) h += '<p class="jje-p" style="margin:0">아직 놓은 기호가 없습니다. 「작업지시」에서 기호를 놓으면 의뢰서 항목별 물량이 여기에 모입니다.</p>';
    else { h += '<table class="jje-qty jje-take">'; CATS.forEach(function (c, i) { var R = rows.filter(function (r) { return takeCat(r) === i; }); if (!R.length) return; h += '<tr class="tr"><td colspan="2">' + c[0] + ' ' + esc(c[1]) + '</td></tr>';
        R.forEach(function (r) { var m = takeMats(r), sub = r.how.length ? r.how.join(' / ') : r.rooms.join('·'); h += '<tr><td>' + esc(r.label) + (r.key ? '' : ' <span style="color:#6B6B6B">의뢰서 항목 밖</span>') + '</td><td>' + takeNum(r.qty) + r.unit + '</td></tr>' + (function () { var x = takeEx(r), a = [sub ? esc(sub) : '', r.meth ? '<b>공법</b> ' + esc(r.meth) : '', x ? '<b>딸린 물량</b> ' + esc(x) : '', m ? '<b>자재·품</b> ' + esc(m) : ''].filter(Boolean); return a.length ? '<tr class="sub"><td colspan="2">' + a.join('<br>') + '</td></tr>' : ''; })(); }); });
      h += '</table>'; var lb = takeLabor(rows); if (lb) h += '<p class="jje-p">품 합계: ' + esc(lb) + '</p>'; }
    h += '<div class="jje-chips" style="margin-top:12px"><a class="jje-chip on" href="request.html" target="_blank" rel="noopener" data-a="tkQuote">이 물량으로 견적 받기</a><button type="button" class="jje-chip" data-a="tkCopy">물량표 글로 복사</button></div>';
    h += '<p class="jje-p">금액은 여기에 나오지 않고 견적에서 나옵니다. 물량은 도면 기준 어림이며, 자재 주문 전에는 실측으로 확정합니다. 자재·품은 집지니 견적과 같은 기준표로 계산합니다.</p>';
    (function () { var rs = rooms(), ks = Object.keys(MAP.items).filter(function (k) { return areaSym(k) && !MAP.items[k].extra; }); if (!rs.length || !ks.length) return;
      h += '<div class="jje-h">면적으로 넣는 항목 — 공간을 누르면 그 공간 면적이 들어갑니다</div><p class="jje-p" style="margin:0 0 6px">마루·장판·도배·도장·바닥 타일은 공간을 눌러 넣습니다. 한 번 더 누르면 빠집니다. 공간의 일부만이면 「작업지시」에서 기호를 골라 직접 그리세요.</p>';
      CATS.forEach(function (c) { var its = ks.filter(function (k) { return c[3].indexOf(MAP.items[k].work) >= 0; }); if (!its.length) return; var nOn = 0, body = its.map(function (k) { var sy = areaSym(k), on = rs.map(function (r) { var i = areaAt(sy, r); return i >= 0 && reqKey(shapes[i]) === k; }), sum = 0; rs.forEach(function (r, i) { if (on[i] && mm) sum += pxArea(r.pts) * mm * mm / 1e6; }); if (on.some(Boolean)) nOn++;
          return '<div style="padding:6px 0 8px;border-top:1px solid #EAE5D8"><div style="font-size:15px;margin-bottom:5px">' + esc(MAP.items[k].label) + (sum ? ' <b style="font-weight:700">' + takeNum(R2(sum)) + '㎡</b>' : '') + '</div><div class="jje-chips">' + rs.map(function (r, i) { return '<button type="button" class="jje-chip ' + (on[i] ? 'on' : '') + '" data-a="arRoom" data-v="' + k + '" data-r="' + i + '">' + esc(r.name) + '</button>'; }).join('') + '</div></div>'; }).join('');
        h += '<details class="jje-det"' + (nOn ? ' open' : '') + '><summary>' + c[0] + ' ' + esc(c[1]) + (nOn ? ' <b>' + nOn + '</b>' : '') + '</summary>' + body + '</details>'; }); })();
    h += '<div class="jje-h">도면에 찍지 않는 항목</div><p class="jje-p" style="margin:0 0 6px">보양·사다리차·도어락처럼 도면에 표시하지 않는 공사는 여기서 고르면 물량표에 들어갑니다.</p>';
    var have = {}; rows.forEach(function (r) { if (r.key && !r.chk) have[r.key] = 1; });
    CATS.forEach(function (c) { var its = []; c[3].forEach(function (w) { Object.keys(MAP.items).forEach(function (k) { var it = MAP.items[k]; if (it.work === w && !it.extra && !have[k] && !areaSym(k)) its.push(k); }); }); if (!its.length) return; var nOn = its.filter(function (k) { return chk[k]; }).length;
      h += '<details class="jje-det"' + (nOn ? ' open' : '') + '><summary>' + c[0] + ' ' + esc(c[1]) + (nOn ? ' <b>' + nOn + '</b>' : '') + '</summary>' + its.map(function (k) { return '<label class="jje-ck"><input type="checkbox" data-chk="' + k + '"' + (chk[k] ? ' checked' : '') + '><span>' + esc(MAP.items[k].label) + '</span></label>'; }).join('') + '</details>'; });
    el.innerHTML = h;
  }
  // ── 기준선(레이저 먹줄): 방 안의 벽에서 벽까지 가는 세로·가로 줄. 기호와 선이 이 줄에 붙는다 (2026-11-11)
  function spanAt(x, y) { var r = roomAt(x, y); if (!r) return null; var n = r.pts.length, L = -1e9, Rr = 1e9, T = -1e9, B = 1e9;
    for (var i = 0; i < n; i++) { var a = r.pts[i], b = r.pts[(i + 1) % n];
      if ((a[1] > y) !== (b[1] > y)) { var xx = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); if (xx < x && xx > L) L = xx; if (xx > x && xx < Rr) Rr = xx; }
      if ((a[0] > x) !== (b[0] > x)) { var yy = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); if (yy < y && yy > T) T = yy; if (yy > y && yy < B) B = yy; } }
    return { r: r, L: L > -1e8 ? L : null, R: Rr < 1e8 ? Rr : null, T: T > -1e8 ? T : null, B: B < 1e8 ? B : null }; }
  function gExt(q) { var s = spanAt(q.x, q.y), o = U() * 0.3; if (q.o === 'v') return s && s.T != null && s.B != null ? [s.T - o, s.B + o] : [SY, SY + SH]; return s && s.L != null && s.R != null ? [s.L - o, s.R + o] : [SX, SX + SW]; }
  function gsnap(x, y) { var tol = Math.max(U() * 0.4, 9 / V.z), bx = tol, by = tol, nx = x, ny = y; if (hide['기준선']) return [x, y];
    shapes.forEach(function (q) { if (q.t !== 'guide') return; var e = gExt(q), d; if (q.o === 'v') { d = Math.abs(q.x - x); if (d < bx && y > e[0] - tol && y < e[1] + tol) { bx = d; nx = q.x; } } else { d = Math.abs(q.y - y); if (d < by && x > e[0] - tol && x < e[1] + tol) { by = d; ny = q.y; } } }); return [nx, ny]; }
  function gN(v) { return Math.max(1, Math.min(12, Math.round(Number(v) || 1))); }
  function guideAt(x, y) {
    var s = spanAt(x, y), mm = mmpp(), out = [], gV = gd.o !== 'h', gH = gd.o !== 'v', i, n, f = function (i, n) { return gd.half ? (i + 0.5) / n : (i + 1) / (n + 1); };
    if (gd.div) { if (!s || s.L == null || s.R == null || s.T == null || s.B == null) { say('나눌 방 안쪽을 눌러 주세요.'); return null; }
      if (gV) { n = gN(gd.nv); for (i = 0; i < n; i++) out.push({ t: 'guide', o: 'v', c: gd.c, x: R2(s.L + (s.R - s.L) * f(i, n)), y: y }); }
      if (gH) { n = gN(gd.nh); for (i = 0; i < n; i++) out.push({ t: 'guide', o: 'h', c: gd.c, x: x, y: R2(s.T + (s.B - s.T) * f(i, n)) }); }
      say(s.r.name + '에 기준선 ' + out.length + '줄을 넣었습니다.' + (gV && gH ? ' 줄이 만나는 곳마다 기호를 한 번에 놓을 수 있습니다.' : '')); return out; }
    var off = Number(gd.off), px = x, py = y, sp;
    if (off > 0) { if (!mm) { say('척도가 없어 거리를 맞출 수 없습니다. 「측정」에서 척도를 잡아 주세요.'); return null; } if (!s) { say('방 안쪽에서, 기준으로 삼을 벽 가까이를 눌러 주세요.'); return null; }
      var d = off / mm; if (gV && s.L != null && s.R != null) px = R2((x - s.L) <= (s.R - x) ? s.L + d : s.R - d); if (gH && s.T != null && s.B != null) py = R2((y - s.T) <= (s.B - y) ? s.T + d : s.B - d); say('벽에서 ' + off.toLocaleString('ko-KR') + 'mm 띄운 자리에 기준선을 놓았습니다.'); }
    else { sp = snapPt(x, y); px = sp[0]; py = sp[1]; say('기준선을 놓았습니다. 「선택」으로 눌러 벽에서 띄울 거리를 숫자로 맞출 수 있습니다.'); }
    if (gV) out.push({ t: 'guide', o: 'v', c: gd.c, x: px, y: y }); if (gH) out.push({ t: 'guide', o: 'h', c: gd.c, x: x, y: py }); return out;
  }
  // 세로줄과 가로줄이 같은 방 안에서 만나는 점들
  function gCross() { var vs = [], hs = [], out = []; if (hide['기준선']) return out; shapes.forEach(function (q) { if (q.t === 'guide') (q.o === 'v' ? vs : hs).push(q); });
    vs.forEach(function (a) { var ra = roomAt(a.x, a.y); if (!ra) return; hs.forEach(function (b) { if (roomAt(b.x, b.y) === ra && roomAt(a.x, b.y) === ra) out.push([a.x, b.y, ra]); }); }); return out; }
  function gKind() { return SYMS[wk.k] && SYMS[wk.k][2] === 'p' ? wk.k : 'dl'; }
  function gFill() { var k = gKind(), tol = U() * 0.3, P = gCross().filter(function (p) { return !shapes.some(function (q) { return q.t === 'wk' && q.k === k && q.f === 'p' && Math.hypot(q.x - p[0], q.y - p[1]) < tol; }); });
    if (!P.length) { toast('놓을 자리가 없습니다. 세로 기준선과 가로 기준선이 같은 방 안에서 만나야 합니다.'); return; } snap(); var gr = [], gi = [];
    P.forEach(function (p) { var j = gr.indexOf(p[2]); if (j < 0) { gr.push(p[2]); gi.push(grpSeq++); j = gr.length - 1; } var o = { t: 'wk', k: k, st: wk.st === 'remove' ? 'new' : wk.st, f: 'p', x: p[0], y: p[1], grp: gi[j] }; if (k === 'core') { o.dia = wk.dia; o.at = wk.at; } shapes.push(rqStamp(o)); });
    sel = -1; touch(); sideDraw(); say(SYMS[k][1] + ' ' + P.length + '개를 기준선이 만나는 곳에 놓았습니다.'); }
  function gColChips(a, cur) { return GCOL.map(function (c) { return '<button type="button" class="jje-chip ' + (cur === c[0] ? 'on' : '') + '" data-a="' + a + '" data-v="' + c[0] + '"><i style="background:' + c[0] + '"></i>' + c[1] + '</button>'; }).join(''); }
  function chipB(a, v, on, tx) { return '<button type="button" class="jje-chip ' + (on ? 'on' : '') + '" data-a="' + a + '" data-v="' + v + '">' + tx + '</button>'; }
  function guidePane() { var nG = shapes.filter(function (q) { return q.t === 'guide'; }).length, nX = gCross().length, k = gKind(), num = function (id, v) { return '<input type="number" id="' + id + '" min="1" max="12" value="' + v + '" style="width:70px">'; }, sp = function (t) { return '<span style="font-size:14.5px;color:#6B6B6B">' + t + '</span>'; };
    return '<div class="jje-h">기준선 방향</div><div class="jje-chips">' + chipB('gO', 'v', gd.o === 'v', '세로') + chipB('gO', 'h', gd.o === 'h', '가로') + chipB('gO', 'x', gd.o === 'x', '십자') + '</div>' +
      '<div class="jje-h">줄 색</div><div class="jje-chips">' + gColChips('gC', gd.c) + '</div>' +
      '<div class="jje-h">놓는 방법</div><div class="jje-chips">' + chipB('gDiv', '0', !gd.div, '한 줄씩') + chipB('gDiv', '1', gd.div, '방을 고르게 나누기') + '</div>' +
      (gd.div ? '<div class="jje-row">' + (gd.o !== 'h' ? sp('세로') + num('jjeGNv', gd.nv) + sp('줄') : '') + (gd.o !== 'v' ? sp('가로') + num('jjeGNh', gd.nh) + sp('줄') : '') + '</div><div class="jje-chips" style="margin-top:8px">' + chipB('gHalf', '1', gd.half, '벽에서 반 간격') + chipB('gHalf', '0', !gd.half, '모두 같은 간격') + '</div><p class="jje-p">방 안쪽을 한 번 누르면 그 방에 줄이 들어갑니다. 매입등은 보통 「벽에서 반 간격」으로 놓습니다.</p>'
        : '<div class="jje-row">' + sp('벽에서') + '<input type="number" id="jjeGOff" min="0" step="10" value="' + esc(gd.off) + '" placeholder="비우면 누른 자리" style="width:150px">' + sp('mm') + '</div><p class="jje-p">숫자를 넣고 벽 가까이를 누르면, 가까운 쪽 벽에서 그만큼 띄운 자리에 줄이 놓입니다. 가벽 자리를 잡을 때 씁니다.' + (mmpp() ? '' : ' <span style="color:#b4232a">지금은 척도가 없어 숫자로는 못 놓습니다.</span>') + '</p>') +
      (nG ? '<div class="jje-h">놓은 기준선 ' + nG + '줄</div><div class="jje-chips">' + (nX ? '<button type="button" class="jje-chip on" data-a="gFill">만나는 곳마다 「' + SYMS[k][1] + '」 놓기 (' + nX + '곳)</button>' : '') + '<button type="button" class="jje-chip" data-a="gClear">기준선 모두 지우기</button></div>' : '') +
      '<p class="jje-p">기준선 가까이에 기호를 놓거나 선을 그으면 줄에 붙습니다. 숫자는 가까운 벽에서 띄운 거리(mm)이고, 작업지시서 도면에도 같이 찍힙니다. 필요 없으면 「겹쳐 보기」에서 끕니다.</p>'; }
  // 벽·모서리에 붙기: 모서리가 먼저, 다음이 벽선
  function snapPt(x, y) { var tol = Math.max(U() * 0.45, 9 / V.z), best = null, bd = tol; rooms().forEach(function (r) { r.pts.forEach(function (p) { var d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = [p[0], p[1]]; } }); }); if (best) return best;
    bd = tol * 0.8; rooms().forEach(function (r) { var n = r.pts.length; for (var i = 0; i < n; i++) { var a = r.pts[i], b = r.pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; if (!L) continue; var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)), q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = [Math.round(q[0]), Math.round(q[1])]; } } });
    return best || [x, y]; }
  // 다각형을 안쪽으로 d 만큼 들인다(직각 위주 방 모양에서 충분)
  function inset(P, d) { var n = P.length, s = sArea(P) > 0 ? 1 : -1, out = []; for (var i = 0; i < n; i++) { var a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
      var n1 = [-(b[1] - a[1]) / l1 * s, (b[0] - a[0]) / l1 * s], n2 = [-(c[1] - b[1]) / l2 * s, (c[0] - b[0]) / l2 * s], bx = n1[0] + n2[0], by = n1[1] + n2[1], bl = bx * bx + by * by; if (bl < 1e-6) { out.push([b[0] + n1[0] * d, b[1] + n1[1] * d]); continue; }
      var k = 2 / bl; out.push([b[0] + bx * d * Math.min(k, 3), b[1] + by * d * Math.min(k, 3)]); } return out; }
  // 벽에 붙는 기구(양변기·세면대)는 가까운 벽을 등지게 돌려 놓는다
  function autoRot(x, y) { var r = roomAt(x, y); if (!r) return 0; var bd = 1e9, bq = null, n = r.pts.length; for (var i = 0; i < n; i++) { var a = r.pts[i], b = r.pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; if (!L) continue; var t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)), q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; bq = q; } }
    if (!bq || bd < 0.5) return 0; var ang = Math.atan2(y - bq[1], x - bq[0]) * 180 / Math.PI - 90; return ((Math.round(ang / 90) * 90) % 360 + 360) % 360; }

  // ── 화면 틀
  function css() {
    if ($('jjeCss')) return; var st = doc.createElement('style'); st.id = 'jjeCss';
    st.textContent = '.jje{--ln:#C8C4BC;--ink:#2A2A2A;--sub:#6B6B6B;--gr:#1e4d3a;--soft:#e6efe9;position:relative;display:flex;flex-direction:column;height:max(640px,calc(100vh - 96px));border:1px solid var(--ln);background:#fff;color:var(--ink);font-size:15px;line-height:1.5;font-family:' + FONT.replace(/"/g, "'") + '}' +
      '.jje *{box-sizing:border-box}.jje button{font-family:inherit;cursor:pointer;color:inherit}.jje.full{position:fixed;inset:0;z-index:400;height:auto;border:0}' +
      '.jje-top{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--ln);min-height:54px;background:#FBF8F1}.jje-top h3{font-size:17px;font-weight:700;margin:0;white-space:nowrap}.jje-top .nm{color:var(--sub);font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}' +
      '.jje-b{min-height:40px;padding:0 13px;border:1px solid #9A9A9A;background:#fff;border-radius:2px;font-size:15px;font-weight:600;white-space:nowrap}.jje-b:hover{background:#F5F1E8}.jje-b{color:#2A2A2A;font-family:inherit;cursor:pointer}.jje-b.dark{background:#2A2A2A;border-color:#2A2A2A;color:#F5F1E8}.jje-b.dark:hover{background:#111}.jje-b:disabled{opacity:.4;cursor:default}' +
      '.jje-main{flex:1;display:flex;min-height:0}' +
      '.jje-rail{width:86px;border-right:1px solid var(--ln);overflow-y:auto;padding:6px 5px;display:flex;flex-direction:column;gap:2px;background:#FBF8F1;flex:none}' +
      '.jje-rail button{border:0;background:transparent;border-radius:2px;padding:7px 2px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:13px;color:#4a4a4a;line-height:1.2;min-height:52px;flex:none}.jje-rail button:hover{background:#EDE7D8}.jje-rail button.on{background:var(--ink);color:#F5F1E8;font-weight:700}' +
      '.jje-rail svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.jje-rail .sep{font-size:12px;color:#8a8478;padding:6px 0 1px;text-align:center;border-top:1px solid var(--ln);margin-top:4px;flex:none}.jje-rail .cols{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:6px 14px;justify-items:center;flex:none}.jje-rail .cols span{width:22px;height:22px;border-radius:50%;cursor:pointer}' +
      '.jje-view{flex:1;position:relative;overflow:hidden;background:#dcd8cd;touch-action:none;min-width:0;min-height:0;-webkit-user-select:none;user-select:none}' +
      '#jjeStage{position:absolute;left:0;top:0;transform-origin:0 0;background:#f7f4ee;box-shadow:0 0 0 1px #c4bfb2}#jjeStage img{position:absolute;left:0;top:0;display:none;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none}#jjeCv{position:absolute;left:0;top:0;width:100%;height:100%}' +
      '.jje-float{position:absolute;background:rgba(255,255,255,.96);border:1px solid #9A9A9A;border-radius:2px;font-size:14px;display:flex;align-items:center;gap:2px;padding:2px}.jje-float button{border:0;background:transparent;border-radius:0;min-width:40px;height:40px;padding:0 9px;font-size:15px;font-weight:600}.jje-float button:hover{background:#EDE7D8}' +
      '.jje-say{flex:none;display:flex;gap:14px;align-items:center;padding:6px 12px;border-bottom:1px solid var(--ln);background:#fff;font-size:14.5px;line-height:1.45;min-height:37px}.jje-say span{flex:1;min-width:0}.jje-say a{flex:none;color:var(--ink);font-weight:600;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}' +
      '#jjeLayers{position:absolute;left:10px;top:60px;z-index:6;width:262px;max-height:calc(100% - 76px);overflow:auto;background:#fff;border:1px solid var(--ln);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.16);padding:6px 4px;display:none;font-size:15px}' +
      '.jje-lay{display:flex;align-items:center;gap:9px;padding:0 9px;min-height:40px;border-radius:4px;cursor:pointer;user-select:none}.jje-lay:hover{background:#F5F1E8}.jje-lay i{width:10px;height:10px;border-radius:50%;flex:none}.jje-lay .n{flex:1}.jje-lay .ct{color:var(--sub);font-size:13.5px;font-variant-numeric:tabular-nums}' +
      '.jje-sw{width:34px;height:20px;border-radius:10px;background:#bdb8ab;position:relative;flex:none}.jje-sw:after{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .12s}.jje-lay.on .jje-sw{background:var(--gr)}.jje-lay.on .jje-sw:after{left:16px}.jje-lay.off .n{color:#9a958a}.jje-layh{font-size:13px;color:#8a8478;padding:8px 9px 2px}' +
      '#jjeAsk{position:absolute;left:50%;top:56px;transform:translateX(-50%);z-index:9;background:#fff;border:1.5px solid var(--ink);border-radius:6px;padding:12px;box-shadow:0 6px 22px rgba(0,0,0,.2);display:none;width:min(360px,calc(100% - 20px))}#jjeAsk input{width:100%;font:inherit;font-size:17px;height:46px;padding:0 10px;border:1.5px solid #6B6B6B;border-radius:6px}' +
      '.jje-side{width:344px;border-left:1px solid var(--ln);display:flex;flex-direction:column;min-height:0;flex:none;background:#fff}' +
      '.jje-tabs{display:flex;border-bottom:1px solid var(--ln);flex:none}.jje-tabs button{flex:1;border:0;background:transparent;min-height:46px;padding:0 4px;font-size:15.5px;color:var(--sub);border-bottom:3px solid transparent}.jje-tabs button.on{color:var(--ink);font-weight:700;border-bottom-color:var(--ink)}.jje-tabs .fold{display:none;flex:none;width:52px;border-left:1px solid var(--ln)}' +
      '.jje-pane{flex:1;overflow-y:auto;padding:12px 12px 20px;display:none}.jje-pane.on{display:block}' +
      '.jje-h{font-size:13.5px;font-weight:700;color:var(--sub);margin:16px 0 7px}.jje-h:first-child{margin-top:0}' +
      '.jje-chips{display:flex;flex-wrap:wrap;gap:6px}.jje-chip{border:1px solid #b9b4a8;background:#fff;border-radius:2px;padding:0 11px;min-height:40px;font-size:15px;display:inline-flex;align-items:center;gap:7px;line-height:1.25;text-align:left}.jje-chip:hover{background:#F5F1E8}.jje-chip.on{border-color:var(--ink);background:var(--ink);color:#F5F1E8;font-weight:700}.jje-chip.on i{box-shadow:0 0 0 1px #F5F1E8}.jje-chip.off{opacity:.45}.jje-chip i{width:4px;height:15px;display:inline-block;flex:none}' +
      '.jje-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:10px;border-top:1px solid var(--ink)}.jje-sym{border:0;border-bottom:1px solid #DDD7C8;background:#fff;border-radius:0;min-height:46px;padding:2px 4px 2px 0;font-size:14.5px;display:flex;align-items:center;gap:4px;line-height:1.25;text-align:left}.jje-sym:hover{background:#F5F1E8}.jje-sym.on{box-shadow:inset 3px 0 0 var(--ink);background:#EFE9DA;font-weight:700}.jje-sym canvas{width:40px;height:40px;flex:none}' +
      '.jje-card{border-left:3px solid var(--ink);padding:2px 0 6px 12px;margin-bottom:16px}.jje-card input,.jje-card select,.jje-pane input[type=text],.jje-pane input[type=number]{font:inherit;font-size:16px;height:42px;padding:0 9px;border:1px solid #8a8478;border-radius:2px;width:100%;background:#fff;color:var(--ink)}' +
      '.jje-row{display:flex;gap:8px;align-items:center;margin-top:8px}.jje-row label{font-size:14.5px;color:var(--sub);flex:none;width:44px}.jje-mrow{margin-top:6px}.jje-mrow label{width:78px}.jje-pane select{font:inherit;font-size:15.5px;height:42px;padding:0 6px;border:1px solid #8a8478;border-radius:2px;flex:1;min-width:0;width:auto;background:#fff;color:var(--ink)}.jje-take tr.sub b{font-weight:700;color:#4a463e;margin-right:2px}' +
      '.jje-qty{width:100%;border-collapse:collapse;font-size:15px}.jje-qty td{padding:6px 2px;border-bottom:1px solid #DDD7C8}.jje-qty td:last-child{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.jje-qty tr.tr td{text-align:left;font-weight:700;border-bottom:1.5px solid var(--ink);padding-top:12px}' +
      '.jje-p{font-size:14.5px;color:var(--sub);line-height:1.6;margin:10px 0 0}a.jje-chip{text-decoration:none}' +
      '.jje-take tr.sub td{font-size:13px;color:var(--sub);padding:0 2px 7px;text-align:left;white-space:normal;line-height:1.5}.jje-take tr:not(.sub):not(.tr) td{border-bottom:0;padding-bottom:2px}.jje-take tr.sub td,.jje-take tr:not(.tr):last-child td{border-bottom:1px solid #DDD7C8}' +
      '.jje-det{border-bottom:1px solid #DDD7C8}.jje-det summary{min-height:40px;display:flex;align-items:center;gap:8px;cursor:pointer;font-size:15px}.jje-det summary b{font-size:13px;background:var(--ink);color:#F5F1E8;padding:0 6px}.jje-ck{display:flex;gap:9px;align-items:flex-start;padding:6px 0 6px 4px;font-size:14.5px;line-height:1.45;cursor:pointer}.jje-ck input{width:18px;height:18px;margin:2px 0 0;flex:none}' +
      '#jjeSheet{position:fixed;inset:0;z-index:700;background:rgba(26,26,26,.66);overflow:auto;padding:14px}.jjs-bar{max-width:920px;margin:0 auto 10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.jjs-bar .sp{flex:1}' +
      '.jjsheet{background:#fff;max-width:920px;margin:0 auto;padding:30px 32px;color:#1c1c1c;font-size:14px;line-height:1.5;font-family:' + FONT.replace(/"/g, "'") + '}.jjsheet *{box-sizing:border-box}' +
      '.jjsheet .tb{display:grid;grid-template-columns:minmax(0,1fr) 250px;border:1.5px solid #1c1c1c}.jjsheet .tb .ti{padding:10px 14px;border-right:1.5px solid #1c1c1c}.jjsheet .tb h2{font-size:23px;margin:0;font-weight:800;letter-spacing:-.3px;text-align:left}.jjsheet .tb .s{color:#555;margin-top:2px}.jjsheet .tb dl{margin:0;display:grid;grid-template-columns:62px 1fr}.jjsheet .tb dt,.jjsheet .tb dd{margin:0;padding:4px 8px;border-bottom:1px solid #1c1c1c;font-size:13px}.jjsheet .tb dt{background:#f0eee8;border-right:1px solid #1c1c1c;font-weight:700}.jjsheet .tb dt:nth-last-of-type(1),.jjsheet .tb dd:last-child{border-bottom:0}' +
      '.jjsheet .dw{border:1.5px solid #1c1c1c;border-top:0;display:block;width:100%}.jjsheet .lg{border:1.5px solid #1c1c1c;border-top:0;padding:7px 10px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;align-items:center}.jjsheet .lg b{margin-right:2px}.jjsheet .lg span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.jjsheet .lg img{width:22px;height:22px}' +
      '.jjsheet h3{font-size:15.5px;margin:20px 0 0;padding:5px 8px;background:#1c1c1c;color:#fff;font-weight:700}.jjsheet h4{font-size:14.5px;margin:14px 0 0;padding:4px 0;border-bottom:1.5px solid #1c1c1c;font-weight:800}' +
      '.jjsheet table{width:100%;border-collapse:collapse;table-layout:fixed}.jjsheet .grp{break-inside:avoid}.jjsheet h4{break-after:avoid}.jjsheet th,.jjsheet td{border:1px solid #777;padding:5px 7px;text-align:left;vertical-align:top;font-size:13.5px}.jjsheet th{background:#f0eee8;font-size:12.5px;white-space:nowrap}.jjsheet td.r,.jjsheet th.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.jjsheet td.c,.jjsheet th.c{text-align:center;white-space:nowrap}.jjsheet tr{break-inside:avoid}' +
      '.jjsheet .no{display:inline-block;min-width:22px;height:22px;line-height:22px;border-radius:11px;color:#fff;font-weight:700;font-size:12.5px;text-align:center;padding:0 5px}.jjsheet .memo{border:1px solid #777;min-height:74px;padding:6px 8px;margin-top:16px}.jjsheet .memo div{min-height:44px;outline:none;margin-top:4px}.jjsheet .ft{margin-top:10px;color:#555;font-size:12.5px;line-height:1.6}' +
      '#jje3d{position:fixed;inset:0;z-index:710;background:rgba(26,26,26,.66);display:flex;align-items:center;justify-content:center;padding:14px}#jje3d .bx{background:#fff;width:min(980px,100%);max-height:96vh;overflow:auto;padding:12px;border-radius:6px}' +
      '@media (max-width:860px){.jje{height:calc(100vh - 20px);height:calc(100dvh - 20px);font-size:15px}.jje-top{padding:5px 8px;min-height:52px;gap:6px}.jje-top .nm{display:none}.jje-top h3{flex:1;font-size:16px}.jje-b{padding:0 10px;min-height:42px}' +
      '.jje-main{flex-direction:column}.jje-rail{width:auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid var(--ln);padding:4px;gap:2px}.jje-rail button{min-width:62px;min-height:54px;padding:6px 2px 4px}.jje-rail .sep{display:none}.jje-rail .cols{display:flex;padding:0 8px;align-items:center}' +
      '.jje-side{width:auto;border-left:0;border-top:1.5px solid var(--ink);height:48px;transition:height .15s}.jje.side-open .jje-side{height:54%}.jje-tabs .fold{display:block}.jje-pane{display:none!important}.jje.side-open .jje-pane.on{display:block!important}#jjeLayers{top:54px}}' +
      '@media (max-width:640px){#jjeSheet{padding:8px}.jjsheet{padding:14px 12px;font-size:13px}.jjsheet .tb{grid-template-columns:minmax(0,1fr)}.jjsheet .tb .ti{border-right:0;border-bottom:1.5px solid #1c1c1c}.jjsheet th,.jjsheet td{padding:4px 4px;font-size:12.5px}.jjsheet .wide{overflow-x:auto}.jjsheet .wide table{min-width:560px}}' +
      '@media print{#jjeSheet,#jje3d{display:none!important}}';
    doc.head.appendChild(st);
  }
  function mount(el, opt) {
    EL = el; OPT = opt || {}; css();
    el.innerHTML = '<div class="jje" id="jjeRoot"><div class="jje-top"><h3>집지니 CAD</h3><span class="nm" id="jjeNm"></span>' +
      '<button type="button" class="jje-b" data-a="undo" title="되돌리기">되돌리기</button><button type="button" class="jje-b" data-a="redo" title="다시 하기">다시</button><button type="button" class="jje-b dark" data-a="sheet">작업지시서</button><button type="button" class="jje-b" data-a="full" id="jjeFull">넓게</button></div>' +
      '<div class="jje-say"><span id="jjeSay"></span><a href="cad-guide.html" target="_blank" rel="noopener">사용법</a></div>' +
      '<div class="jje-main"><div class="jje-rail" id="jjeRail"></div>' +
      '<div class="jje-view" id="jjeWrap"><div id="jjeStage"><img id="jjeBg" alt=""><canvas id="jjeCv"></canvas></div>' +
      '<div class="jje-float" style="left:10px;top:10px;z-index:4"><button type="button" data-a="layers" title="공종별로 켜고 끄기">겹쳐 보기</button></div><div id="jjeLayers"></div>' +
      '<div class="jje-float" style="left:10px;bottom:10px;padding:6px 10px;max-width:calc(100% - 250px);font-size:13.5px"><span id="jjeScale"></span></div>' +
      '<div class="jje-float" style="right:10px;bottom:10px"><button type="button" data-a="zoomOut" title="작게" aria-label="작게">－</button><span id="jjeZoom" style="min-width:48px;text-align:center">100%</span><button type="button" data-a="zoomIn" title="크게" aria-label="크게">＋</button><button type="button" data-a="fit">맞춤</button></div><div id="jjeAsk"></div></div>' +
      '<div class="jje-side"><div class="jje-tabs" id="jjeTabs"></div><div class="jje-pane" id="jjePaneWork"></div><div class="jje-pane" id="jjePaneTake"></div><div class="jje-pane" id="jjePaneMeas"></div><div class="jje-pane" id="jjePaneInfo"></div></div></div></div>';
    var wrap = $('jjeWrap');
    wrap.addEventListener('pointerdown', onDown); wrap.addEventListener('pointermove', onMove); wrap.addEventListener('pointerup', onUp); wrap.addEventListener('pointercancel', onUp);
    wrap.addEventListener('wheel', function (ev) { if (ev.target.closest('#jjeAsk,#jjeLayers')) return; ev.preventDefault(); zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    wrap.addEventListener('dblclick', onDbl); wrap.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    $('jjeRoot').addEventListener('click', onClick); $('jjeRoot').addEventListener('input', onInput); $('jjeRoot').addEventListener('change', onInput); $('jjeRoot').addEventListener('focusin', function (ev) { if (ev.target.getAttribute && ev.target.getAttribute('data-p')) snap(); });
    doc.addEventListener('keydown', onKey); doc.addEventListener('keyup', function (ev) { if (ev.code === 'Space') space = false; });
    var rt = 0; root.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (active()) fit(); }, 160); });
  }
  function active() { return EL && EL.offsetParent !== null && shapes.length; }
  function open(st) {
    if (!st || !st.shapes || !st.W) return false;
    shapes = JSON.parse(JSON.stringify(st.shapes)); W = st.W; H = st.H; base = st.base || {}; baseOk = st.baseOk !== false; planName = st.name || '우리 집'; ceilH = st.ceil > 1800 && st.ceil < 4000 ? st.ceil : 2300; chk = st.chk || {}; mdef = st.meth || {}; allLen = false;
    // 척도가 없는 도면은 열자마자 전용면적을 물어 벽 길이를 거꾸로 셈한다 (2026-11-11)
    setTimeout(function () { try { if (!mmpp() && rooms().length && $('jjeAsk')) scaleByArea(true); } catch (e) {} }, 800);
    var xs = [], ys = [], ax = [], ay = []; shapes.forEach(function (q) { if (q.t === 'room' && q.pts) q.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); if (q.grp >= grpSeq) grpSeq = q.grp + 1; if (q.pts) q.pts.forEach(function (p) { ax.push(p[0]); ay.push(p[1]); }); if ('x1' in q) { ax.push(q.x1, q.x2); ay.push(q.y1, q.y2); } if ('x' in q) { ax.push(q.x); ay.push(q.y); } });
    if (base && base.외곽) base.외곽.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); if (!xs.length) { xs = [0, W]; ys = [0, H]; }
    var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys);
    D0 = Math.max(bx1 - bx0, by1 - by0) || Math.max(W, H); PAD = Math.round(D0 * 0.17);
    // 무대(그리는 판)는 올린 그림 전체가 아니라 집 둘레에 여백을 둔 네모다 — 도면이 화면에 꽉 차고, 둘레에 치수선 자리가 남는다
    SX = Math.min(bx0 - PAD, Math.min.apply(null, ax.concat([bx0])) - PAD * 0.3); SY = Math.min(by0 - PAD, Math.min.apply(null, ay.concat([by0])) - PAD * 0.3); SW = Math.max(bx1 + PAD, Math.max.apply(null, ax.concat([bx1])) + PAD * 0.3) - SX; SH = Math.max(by1 + PAD, Math.max.apply(null, ay.concat([by1])) + PAD * 0.3) - SY; SX = Math.round(SX); SY = Math.round(SY); SW = Math.round(SW); SH = Math.round(SH);
    K = Math.max(1, Math.min(4, 2800 / Math.max(SW, SH)));
    var cv = $('jjeCv'), stg = $('jjeStage'); cv.width = Math.round(SW * K); cv.height = Math.round(SH * K); stg.style.width = SW + 'px'; stg.style.height = SH + 'px';
    tool = 'select'; draft = null; poly = null; sel = -1; hist = []; redoSt = []; bgOn = false; pane = 'work'; $('jjeNm').textContent = planName; say('');
    full = root.innerWidth <= 860; applyFull(); railDraw(); sideDraw(); mapLoad(function () { if (active()) { sideDraw(); propDraw(); } }); fit(); redraw(); bgApply();
    if (!shapes.some(function (q) { return q.t === 'door'; })) say('문은 도면에 없습니다. 왼쪽 「문」 도구로 문 자리를 끌어 놓을 수 있습니다.');
    return true;
  }
  function applyFull() { var r = $('jjeRoot'); r.classList.toggle('full', full); $('jjeFull').textContent = full ? '닫기' : '넓게'; doc.body.style.overflow = full ? 'hidden' : ''; setTimeout(fit, 30); }

  // ── 도구 띠
  function railDraw() {
    var el = $('jjeRail'); if (!el) return;
    el.innerHTML = RAIL.map(function (t) { return typeof t === 'string' ? '<div class="sep">' + t + '</div>' : '<button type="button" class="' + (tool === t[0] ? 'on' : '') + '" data-a="tool" data-v="' + t[0] + '" title="' + t[1] + '"><svg viewBox="0 0 24 24"><path d="' + t[3] + '"/></svg>' + t[1] + '</button>'; }).join('') +
      '<div class="sep">색</div><div class="cols">' + [['#d8322e', '빨강'], ['#1d5fd0', '파랑'], ['#2f6b4f', '초록'], ['#111827', '검정']].map(function (c) { return '<span title="표시 색: ' + c[1] + '" data-a="color" data-v="' + c[0] + '" style="background:' + c[0] + ';box-shadow:0 0 0 2px #FBF8F1,0 0 0 ' + (color === c[0] ? '4px ' + c[0] : '3px transparent') + '"></span>'; }).join('') + '</div>';
    var w = $('jjeWrap'); if (w) w.style.cursor = tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'; scaleInfo();
  }
  var HINT = { select: '', guide: '기준선: 놓을 자리를 누르세요. 오른쪽에서 방향과 놓는 방법을 고릅니다.', hand: '도면을 끌어 옮깁니다.', scale: '척도: 길이를 아는 두 점을 차례로 누르세요.', room: '공간 그리기: 모서리를 차례로 누르고, 첫 점을 다시 누르면 닫힙니다.', poly: '다각형: 모서리를 차례로 누르고, 첫 점을 다시 누르면 닫힙니다.', rect: '사각형: 끌어서 그립니다.', win: '창: 벽을 따라 끌어 놓으세요.', door: '문: 문 폭만큼 벽을 따라 끌어 놓으세요.', dim: '길이 재기: 잴 곳의 두 점을 끌어 놓으세요.', wall: '벽 사이 재기: 방 안쪽을 누르면 좌우·위아래 벽 사이를 잽니다.', arrow: '화살표: 끌어서 그립니다.', circle: '원: 가운데에서 끌어 그립니다.', pen: '펜: 끌어서 자유롭게 그립니다.', text: '글자: 적을 자리를 누르세요.', erase: '지우개: 지울 것을 누르세요.' };
  function setTool(t) {
    tool = t; draft = null; poly = null; scaleP1 = null; if (t !== 'select') sel = -1; if (t === 'wk' || t === 'guide') pane = 'work';
    railDraw(); sideDraw(); redraw(); if (t === 'wk') wkHint(); else say(HINT[t] || '');
    if ((t === 'dim' || t === 'wall') && !mmpp()) say('척도가 없어 길이가 나오지 않습니다. 오른쪽 「측정」에서 전용면적으로 척도를 잡아 주세요.');
    if ((t === 'wk' || t === 'guide') && root.innerWidth <= 860 && !$('jjeRoot').classList.contains('side-open')) sideOpen(true);
  }
  function wkHint() { var S = SYMS[wk.k]; if (!S) return; say(S[1] + ' — ' + (S[2] === 'p' ? (wk.row > 1 ? '놓을 자리를 누르세요. 끌면 한 줄에 ' + wk.row + '개가 놓입니다.' : '놓을 자리를 누르세요.') : S[2] === 'l' ? (LOOPK.test(wk.k) ? '벽을 따라 끌어 긋거나, 방 안쪽을 눌러 둘레 전체에 넣으세요.' : '끌어서 그으세요.') : (wk.whole ? '공간 안쪽을 누르세요.' : '모서리를 차례로 누르고 첫 점을 다시 누르세요.'))); }
  function sideOpen(on) { var atFit = Math.abs(V.z - (V.fit || V.z)) < 1e-6; $('jjeRoot').classList.toggle('side-open', on); sideDraw(); if (atFit) setTimeout(fit, 180); }   /* 확대해 보던 중이면 화면을 그대로 둔다 */

  // ── 확대·이동
  function applyView() { var st = $('jjeStage'); if (!st) return; st.style.transform = 'translate(' + V.x.toFixed(1) + 'px,' + V.y.toFixed(1) + 'px) scale(' + V.z.toFixed(4) + ')'; var z = $('jjeZoom'); if (z) z.textContent = Math.round(V.z * 100 / (V.fit || 1)) + '%'; }
  function fit() { var w = $('jjeWrap'); if (!w || !w.clientWidth) return; var vw = w.clientWidth, vh = w.clientHeight, fx = BG ? BG.x : SX, fy = BG ? BG.y : SY, sw = BG ? BG.w : SW, sh = BG ? BG.h : SH; V.z = Math.min(vw / sw, vh / sh) * 0.99; V.fit = V.z; V.x = (vw - sw * V.z) / 2 - (fx - SX) * V.z; V.y = (vh - sh * V.z) / 2 - (fy - SY) * V.z; applyView(); }   /* 맞춤 = 집과 치수선이 화면에 꽉 차게 */
  function zoomAt(cx, cy, f) { var w = $('jjeWrap'), r = w.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, f0 = V.fit || 1, nz = Math.max(f0 * 0.4, Math.min(f0 * 12, V.z * f)); V.x = px - (px - V.x) * nz / V.z; V.y = py - (py - V.y) * nz / V.z; V.z = nz; applyView(); }
  function zoomBy(f) { var r = $('jjeWrap').getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); }

  // ── 되돌리기 (50단계)
  function snap() { hist.push(JSON.stringify(shapes)); if (hist.length > 50) hist.shift(); redoSt = []; }
  function touch(roomChanged) { if (roomChanged) baseOk = false; redraw(); qtyDraw(); if (pane === 'take') takeDraw(); bgSoon(); layDraw(); saveSoon(); }
  function undo() { if (poly) { poly.pts.pop(); if (!poly.pts.length) poly = null; redraw(); return; } if (!hist.length) { toast('되돌릴 것이 없습니다.'); return; } redoSt.push(JSON.stringify(shapes)); shapes = JSON.parse(hist.pop()); sel = -1; touch(); propDraw(); }
  function redo() { if (!redoSt.length) return; hist.push(JSON.stringify(shapes)); shapes = JSON.parse(redoSt.pop()); sel = -1; touch(); propDraw(); }

  // ── 겹쳐 보기(공종별 켜고 끄기)
  function layOpen(force) { var el = $('jjeLayers'); el.style.display = (force || el.style.display !== 'block') ? 'block' : 'none'; layDraw(); }
  function layDraw() {
    var el = $('jjeLayers'); if (!el || el.style.display !== 'block') return;
    var n = function (f) { return shapes.filter(f).length; }, row = function (key, name, col, cnt, on) { return '<div class="jje-lay ' + (on ? 'on' : 'off') + '" data-a="lay" data-v="' + key + '"><i style="background:' + col + '"></i><span class="n">' + name + '</span>' + (cnt === '' ? '' : '<span class="ct">' + cnt + '</span>') + '<span class="jje-sw"></span></div>'; };
    el.innerHTML = '<div style="display:flex;align-items:center;gap:6px;padding:2px 6px 4px 9px"><b style="flex:1">겹쳐 보기</b><button type="button" class="jje-chip" data-a="layAll">모두 켜기</button><button type="button" class="jje-chip" data-a="layers">닫기</button></div>' +
      '<div class="jje-layh">도면</div>' + row('바탕', '집지니 도면 바탕', '#26302c', '', !hide['바탕']) + row('공간', '공간 이름·면적', '#2f6b4f', n(function (q) { return q.t === 'room'; }), !hide['공간']) + row('창·문', '창·문', '#1d5fd0', n(function (q) { return q.t === 'win' || q.t === 'door'; }), !hide['창·문']) + row('치수', '치수·척도', '#111827', n(function (q) { return q.t === 'dim' || q.t === 'scale'; }), !hide['치수']) +
      '<div class="jje-layh">작업지시</div>' + TRADES.map(function (t) { return row(t[0], t[0], t[1], n(function (q) { return q.t === 'wk' && (SYMS[q.k] || [''])[0] === t[0]; }), !hide[t[0]]); }).join('') + row('번호', '기호 번호', '#64748b', '', nums) +
      '<div class="jje-layh">그 밖</div>' + row('기준선', '기준선', '#d11a2a', n(function (q) { return q.t === 'guide'; }), !hide['기준선']) + row('표시', '표시·글자', '#d8322e', n(function (q) { return /^(circle|arrow|pen|text|rect|poly)$/.test(q.t); }), !hide['표시']) + row('무늬', '집지니 비침 무늬', '#2f6b4f', '', hide['무늬'] === false);
  }
  function layToggle(key) { if (key === '번호') nums = !nums; else if (key === '무늬') hide[key] = hide[key] === false; else hide[key] = !hide[key]; sel = -1; laySave(); layDraw(); redraw(); propDraw(); sideDraw(); if (/^(바탕|공간|창·문|무늬|치수)$/.test(key)) bgApply(); }

  // ── 바탕: 지금의 공간·창으로 다시 그린 집지니 도면 (외곽선·원본 치수 줄은 공간을 손대기 전까지 분석 결과 그대로)
  function bgSoon() { clearTimeout(bgT); bgT = setTimeout(bgApply, 180); }
  function bgData() {
    var mm = mmpp(), rs = shapes.filter(function (q) { return q.t === 'room' && q.pts && q.pts.length >= 3; }).map(function (q) { var nm = String(q.name || '공간'), o = { name: nm, kind: kindOf(nm), pts: q.pts }, xs = q.pts.map(function (p) { return p[0]; }), ys = q.pts.map(function (p) { return p[1]; }), bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys), m = polyMeasure(q, mm);
      if (q.a0 && q.a0.area) { o.area = q.a0.area; o.w = q.a0.w; o.d = q.a0.d; } else if (m) { o.area = R2(m.area); o.w = Math.round(Math.sqrt(o.area * Math.max(bw, 1) / Math.max(bh, 1)) * 10) / 10; o.d = o.w ? Math.round(o.area / o.w * 10) / 10 : 0; } return o; });
    var cnt = function (k) { return rs.filter(function (r) { return r.kind === k; }).length; }, sum = { 방: cnt('방'), 욕실: cnt('욕실'), 발코니: cnt('발코니') }; if (mm) sum.전용합 = Math.round(rs.filter(function (r) { return r.kind !== '발코니' && r.kind !== '실외기실'; }).reduce(function (s, r) { return s + (r.area || 0); }, 0) * 10) / 10;
    var sc = shapes.filter(function (q) { return q.t === 'scale'; })[0], out = { rooms: rs, mmpp: mm, sum: sum, 척도: { 방식: sc ? (sc.by || '치수') : '없음' } };
    out.창 = hide['창·문'] ? [] : shapes.filter(function (q) { return q.t === 'win'; }).map(function (q) { return { x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2, 종류: String(q.name || '창').split(' ')[0], w_m: mm ? Math.round(Math.hypot(q.x2 - q.x1, q.y2 - q.y1) * mm / 10) / 100 : 0 }; });
    if (baseOk && base) { if (base.외곽) out.외곽 = base.외곽; if (base.치수줄) out.치수줄 = base.치수줄; }
    return out;
  }
  // 바탕 그림 만들기. 양식 도구의 「편집 바탕용」(bare)은 치수선을 그리지 않으므로, 치수선까지 든 온전한 도면을 받아 머리·발·틀을 잘라 내고 집 둘레만 쓴다.
  //   온전한 도면의 자리 옮김(여백·머리 높이)은 양식 도구와 같은 식으로 셈하고, 그림 크기가 셈과 다르면(양식이 바뀌었으면) 치수 없는 편집 바탕으로 물러난다.
  //   돌려주는 값: { svg, x, y, w, h } — 그림이 놓일 자리(원본 좌표)
  function bgSvg(opt) { if (!root.JJPlanStyle) return null; var d = bgData(), o = { noLabels: !!hide['공간'], noDims: !!hide['치수'], plain: hide['무늬'] !== false, noMark: hide['무늬'] !== false }; if (opt) Object.keys(opt).forEach(function (k) { o[k] = opt[k]; });
    var xs = [], ys = [], s = ''; d.rooms.forEach(function (r) { r.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); }); if (d.외곽 && d.외곽.length >= 4) d.외곽.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys), bw = bx1 - bx0, bh = by1 - by0, D = Math.max(bw, bh), pad = D * 0.11, head = D * 0.15, foot = D * 0.2;
    try { s = root.JJPlanStyle.svg(d, o); } catch (e) { s = ''; }
    var vb = /viewBox="0 0 (\d+) (\d+)"/.exec(s || '');
    if (vb && Math.abs(Number(vb[1]) - (bw + pad * 2)) <= 1.5 && Math.abs(Number(vb[2]) - (bh + pad * 2 + head + foot)) <= 1.5) {
      var s2 = s.replace(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="none" stroke="#26302c"[^>]*\/>/, ''), noFrame = s2 !== s; s = s2;   // 도면 틀(바깥 테두리)은 뺀다. 못 빼면 틀 안쪽까지만 쓴다
      var mx = D * (noFrame ? 0.104 : 0.076), mt = D * 0.102, mb = D * 0.104, cw = bw + mx * 2, ch = bh + mt + mb;
      return { svg: s.replace(/viewBox="[^"]*"/, 'viewBox="' + (pad - mx).toFixed(1) + ' ' + (pad + head - mt).toFixed(1) + ' ' + cw.toFixed(1) + ' ' + ch.toFixed(1) + '" width="' + Math.round(cw * 2) + '" height="' + Math.round(ch * 2) + '"'), x: bx0 - mx, y: by0 - mt, w: cw, h: ch }; }
    try { o.bare = { W: W, H: H }; s = root.JJPlanStyle.svg(d, o); } catch (e) { s = ''; } if (!s) return null;
    return { svg: s.replace(/viewBox="[^"]*"/, 'viewBox="0 0 ' + W + ' ' + H + '" width="' + W * 2 + '" height="' + H * 2 + '"'), x: 0, y: 0, w: W, h: H }; }
  function bgApply() {
    var bg = $('jjeBg'); if (!bg) return; var can = rooms().length >= 1, off = function () { bgOn = false; BG = null; bg.style.display = 'none'; LABELS = []; redraw(); };
    if (!can || hide['바탕']) { off(); return; } var B = bgSvg(); if (!B) { off(); return; }
    // 바탕에 적힌 글자(방 이름·넓이·창 이름) 자리를 읽어 둔다 — 번호·꼬리표가 그 글자를 가리지 않게 피하는 데 쓴다
    var L = []; try { var dd = new DOMParser().parseFromString(B.svg, 'image/svg+xml'), vbx = dd.documentElement.getAttribute('viewBox').split(/\s+/).map(Number), ox = B.x - vbx[0], oy = B.y - vbx[1]; Array.prototype.forEach.call(dd.querySelectorAll('text'), function (t) { if (t.getAttribute('transform') || t.closest('pattern')) return; var x = Number(t.getAttribute('x')), y = Number(t.getAttribute('y')), fs = Number(t.getAttribute('font-size')) || 0; if (!isFinite(x) || !isFinite(y) || !fs) return; var wd = 0; String(t.textContent).split('').forEach(function (ch) { wd += (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.58) * fs; }); var an = t.getAttribute('text-anchor'), x0 = (an === 'middle' ? x - wd / 2 : an === 'end' ? x - wd : x) + ox; L.push([x0 - fs * 0.15, y + oy - fs * 0.95, x0 + wd + fs * 0.15, y + oy + fs * 0.3]); }); } catch (e) { L = []; }
    bg.onload = function () { var first = !BG; bgOn = true; BG = B; if (first) fit(); LABELS = L; bg.style.left = (B.x - SX) + 'px'; bg.style.top = (B.y - SY) + 'px'; bg.style.width = B.w + 'px'; bg.style.height = B.h + 'px'; bg.style.display = 'block'; redraw(); }; bg.onerror = off; bg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(B.svg);
  }

  // ── 누르기·끌기
  function XY(ev) { var cv = $('jjeCv'), r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) * SW / r.width + SX), Math.round((ev.clientY - r.top) * SH / r.height + SY)]; }
  function dist(q, x, y) {
    if (q.t === 'guide') { var ge = gExt(q); return q.o === 'v' ? segD(x, y, [q.x, ge[0]], [q.x, ge[1]]) : segD(x, y, [ge[0], q.y], [ge[1], q.y]); }
    if (q.t === 'room' || q.t === 'poly') return polyD(x, y, q.pts, true); if (q.t === 'rect') return polyD(x, y, [[q.x1, q.y1], [q.x2, q.y1], [q.x2, q.y2], [q.x1, q.y2]], true); if (q.t === 'wk') return q.f === 'p' ? Math.hypot(q.x - x, q.y - y) : polyD(x, y, q.pts, q.f === 'a');
    if ('x1' in q) return segD(x, y, [q.x1, q.y1], [q.x2, q.y2]); if (q.t === 'pen') return polyD(x, y, q.pts, false); if (q.t === 'circle') return Math.abs(Math.hypot(q.x - x, q.y - y) - q.r); return Math.hypot(q.x - x, q.y - y);
  }
  function visible(q) { if (q.t === 'room') return !hide['공간']; if (q.t === 'dim' || q.t === 'scale') return !hide['치수']; if (q.t === 'win' || q.t === 'door') return !hide['창·문']; if (q.t === 'wk') return !hide[(SYMS[q.k] || [''])[0]]; if (q.t === 'guide') return !hide['기준선']; return !hide['표시']; }
  function hit(x, y) {   // 가까운 선·점이 먼저, 없으면 눌린 구역(작업 구역 → 공간)
    var u = U(), bi = -1, bd = Math.max(u * 1.0, 14 / V.z), i, q; shapes.forEach(function (q, i) { if (!visible(q)) return; var d = dist(q, x, y); if (q.t === 'wk' && q.f === 'p') d -= u * 0.5; if (q.t === 'room' || (q.t === 'wk' && (q.f === 'a' || q.loop))) d += u * 0.5; if (q.t === 'guide') d += u * 0.3; if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) return bi;
    for (i = shapes.length - 1; i >= 0; i--) { q = shapes[i]; if (q.t === 'wk' && q.f === 'a' && visible(q) && inPoly([x, y], q.pts)) return i; }
    for (i = shapes.length - 1; i >= 0; i--) { q = shapes[i]; if (q.t === 'room' && q.name && visible(q) && inPoly([x, y], q.pts)) return i; } return -1;
  }
  function shift(q, dx, dy) { if (!q) return; if (q.t === 'guide') { if (q.o === 'v') q.x += dx; else q.y += dy; return; } if (q.pts) q.pts = q.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; }); if ('x1' in q) { q.x1 += dx; q.y1 += dy; q.x2 += dx; q.y2 += dy; } if ('x' in q) { q.x += dx; q.y += dy; } if (q.t === 'room') delete q.a0; }
  function onDown(ev) {
    if (ev.target.closest && ev.target.closest('#jjeAsk,.jje-float,#jjeLayers')) return; if (!shapes.length) return;
    pts[ev.pointerId] = [ev.clientX, ev.clientY]; var ids = Object.keys(pts);
    if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; draft = null; ptr = null; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: V.z, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; return; }
    ev.preventDefault(); try { $('jjeWrap').setPointerCapture(ev.pointerId); } catch (e) {}
    var p = XY(ev), x = p[0], y = p[1], u = U(), grab = Math.max(u * 0.7, 14 / V.z), pan = tool === 'hand' || ev.button === 1 || ev.button === 2 || space;
    ptr = { id: ev.pointerId, x0: x, y0: y, cx: ev.clientX, cy: ev.clientY, moved: false, pan: pan, vx: V.x, vy: V.y, last: [x, y] }; if (pan) return;
    if (tool === 'select') { var s = shapes[sel];
      if (s && s.pts && (s.t === 'room' || s.t === 'wk' || s.t === 'poly')) { var vi = -1; s.pts.forEach(function (q, i) { if (vi < 0 && Math.hypot(q[0] - x, q[1] - y) < grab) vi = i; }); if (vi >= 0) { ptr.vi = vi; return; } }
      if (s && 'x1' in s) { if (Math.hypot(s.x1 - x, s.y1 - y) < grab) { ptr.ep = 1; return; } if (Math.hypot(s.x2 - x, s.y2 - y) < grab) { ptr.ep = 2; return; } }
      var h = hit(x, y), ch = h !== sel, hq = shapes[h], big = hq && (hq.t === 'room' || (hq.t === 'wk' && (hq.f === 'a' || hq.loop))); sel = h; ptr.drag = h >= 0 && !(big && ch); if (h < 0 || (big && ch)) { ptr.pan = true; ptr.blank = true; }   /* 빈 곳을 끌면 화면이 움직인다. 공간·구역은 먼저 눌러 고른 뒤에만 끌려 옮겨진다(실수로 방이 밀리지 않게) */ if (ch) { propDraw(); ptr.newSel = h >= 0; } redraw(); return; }
    var S = tool === 'wk' ? SYMS[wk.k] : null, sp = snapPt(x, y);
    if (tool === 'win' || tool === 'door') draft = { t: tool, c: tool === 'win' ? '#1d5fd0' : '#b06a00', x1: sp[0], y1: sp[1], x2: sp[0], y2: sp[1] };
    else if (tool === 'pen') draft = { t: 'pen', c: color, pts: [[x, y]] }; else if (tool === 'circle') draft = { t: 'circle', c: color, x: x, y: y, r: 0 }; else if (tool === 'arrow' || tool === 'rect') draft = { t: tool, c: color, x1: x, y1: y, x2: x, y2: y }; else if (tool === 'dim') draft = { t: 'dim', c: '#111827', x1: sp[0], y1: sp[1], x2: sp[0], y2: sp[1] };
    else if (S && S[2] === 'l') { sp = gsnap(sp[0], sp[1]); draft = { t: 'wk', k: wk.k, st: wk.st, f: 'l', pts: [[sp[0], sp[1]], [sp[0], sp[1]]] }; }
    else if (S && S[2] === 'p') { sp = gsnap(x, y); draft = { t: '_row', k: wk.k, st: wk.st, a: [sp[0], sp[1]], b: [sp[0], sp[1]] }; } else draft = null;
    if (draft) redraw();
  }
  function rowPts(d) { var n = Math.max(1, Math.min(40, Math.round(Number(wk.row) || 1))); if (n < 2 || Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) < U() * 1.2) return [d.a]; var out = []; for (var i = 0; i < n; i++) out.push([Math.round(d.a[0] + (d.b[0] - d.a[0]) * i / (n - 1)), Math.round(d.a[1] + (d.b[1] - d.a[1]) * i / (n - 1))]); return out; }
  function onMove(ev) {
    if (pts[ev.pointerId]) pts[ev.pointerId] = [ev.clientX, ev.clientY];
    if (pinch) { var ids = Object.keys(pts); if (ids.length < 2) return; var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; V.x += mx - pinch.mx; V.y += my - pinch.my; pinch.mx = mx; pinch.my = my; zoomAt(mx, my, (pinch.z * d / pinch.d) / V.z); return; }
    if (!ptr || ev.pointerId !== ptr.id) return; ev.preventDefault();
    if (ptr.pan) { if (Math.abs(ev.clientX - ptr.cx) + Math.abs(ev.clientY - ptr.cy) > 5) ptr.moved = true; V.x = ptr.vx + ev.clientX - ptr.cx; V.y = ptr.vy + ev.clientY - ptr.cy; applyView(); return; }
    var p = XY(ev), x = p[0], y = p[1]; if (Math.hypot(ev.clientX - ptr.cx, ev.clientY - ptr.cy) > 6) ptr.moved = true;
    if (tool === 'select') { var s = shapes[sel]; if (!s || !ptr.moved) return; if (!ptr.snap) { snap(); ptr.snap = true; }
      if (ptr.vi != null) { var q = s.t === 'wk' && s.f === 'l' ? snapPt(x, y) : [x, y]; s.pts[ptr.vi] = q; if (s.t === 'room') delete s.a0; if (s.loop) delete s.loop; } else if (ptr.ep) { var e = (s.t === 'dim' || s.t === 'win' || s.t === 'door') ? snapPt(x, y) : [x, y]; if (ptr.ep === 1) { s.x1 = e[0]; s.y1 = e[1]; } else { s.x2 = e[0]; s.y2 = e[1]; } } else if (ptr.drag) shift(s, x - ptr.last[0], y - ptr.last[1]);
      ptr.last = [x, y]; redraw(); return; }
    if (!draft) return; var sp;
    if (draft.t === 'win' || draft.t === 'door') { sp = snapPt(x, y); sp = straight(draft.x1, draft.y1, sp[0], sp[1]); draft.x2 = sp[0]; draft.y2 = sp[1]; } else if (draft.t === 'arrow' || draft.t === 'rect') { draft.x2 = x; draft.y2 = y; } else if (draft.t === 'pen') draft.pts.push([x, y]); else if (draft.t === 'circle') draft.r = Math.round(Math.hypot(x - draft.x, y - draft.y));
    else if (draft.t === 'dim') { sp = snapPt(x, y); sp = straight(draft.x1, draft.y1, sp[0], sp[1]); draft.x2 = sp[0]; draft.y2 = sp[1]; }
    else if (draft.t === 'wk') { sp = snapPt(x, y); sp = gsnap(sp[0], sp[1]); draft.pts[1] = straight(draft.pts[0][0], draft.pts[0][1], sp[0], sp[1]); } else if (draft.t === '_row') { sp = gsnap(x, y); draft.b = straight(draft.a[0], draft.a[1], sp[0], sp[1]); }
    redraw();
  }
  function polyClose() { if (!poly || poly.pts.length < 3) return; var sh = poly; poly = null; snap(); if (sh.t === 'room') sh.name = '방' + (shapes.filter(function (q) { return q.t === 'room'; }).length + 1); shapes.push(rqStamp(sh)); sel = shapes.length - 1; if (sh.t !== 'wk') { tool = 'select'; railDraw(); say(''); } touch(sh.t === 'room'); if (sh.t === 'room') { pane = 'work'; sideDraw(); propDraw(true); } else propDraw(); }
  function wallSpan(x, y) {   // 누른 점이 든 방의 좌우·위아래 벽 사이
    var r = roomAt(x, y); if (!r) return []; var n = r.pts.length, L = -1e9, Rr = 1e9, T = -1e9, B = 1e9;
    for (var i = 0; i < n; i++) { var a = r.pts[i], b = r.pts[(i + 1) % n];
      if ((a[1] > y) !== (b[1] > y)) { var xx = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); if (xx < x && xx > L) L = xx; if (xx > x && xx < Rr) Rr = xx; }
      if ((a[0] > x) !== (b[0] > x)) { var yy = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); if (yy < y && yy > T) T = yy; if (yy > y && yy < B) B = yy; } }
    var out = []; if (L > -1e8 && Rr < 1e8) out.push({ t: 'dim', c: '#111827', x1: Math.round(L), y1: y, x2: Math.round(Rr), y2: y, auto: true }); if (T > -1e8 && B < 1e8) out.push({ t: 'dim', c: '#111827', x1: x, y1: Math.round(T), x2: x, y2: Math.round(B), auto: true }); return out;
  }
  function onUp(ev) {
    delete pts[ev.pointerId]; if (pinch) { if (Object.keys(pts).length < 2) pinch = null; return; }
    if (!ptr || ev.pointerId !== ptr.id) return; var P = ptr; ptr = null; if (P.pan && !(P.newSel && !P.moved)) return;
    var u = U(), sh = null, many = null, roomCh = false;
    if (tool === 'select' && P.newSel && !P.moved && root.innerWidth <= 860) { pane = 'work'; sideOpen(true); return; }   // 좁은 화면: 눌러 고르면(끌지 않았을 때만) 아래 칸을 펴서 고칠 것을 보여 준다
    if (tool === 'select') { if (P.snap) { var sr = shapes[sel]; if (sr && sr.t === 'room') { roomCh = true; if (P.vi == null) magnet(sr); } if (sr && sr.t === 'wk' && sr.f === 'p') { var gq = gsnap(sr.x, sr.y); sr.x = gq[0]; sr.y = gq[1]; } touch(roomCh); propDraw(); } return; }
    if (draft && (draft.t === 'win' || draft.t === 'door')) { sh = draft; if (!P.moved || Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1) < u * 0.5) { sh = null; say((tool === 'win' ? '창' : '문') + '은 벽을 따라 끌어서 놓습니다.'); } else { sh.h = sh.t === 'win' ? 1200 : 2100; sh.name = sh.t === 'win' ? '창' : '문'; } }
    else if (draft && draft.t === '_row') { var rp = rowPts(draft), g = rp.length > 1 ? grpSeq++ : 0; many = rp.map(function (p) { var o = { t: 'wk', k: draft.k, st: draft.st, f: 'p', x: p[0], y: p[1] }; if (g) o.grp = g; if (draft.k === 'wc' || draft.k === 'bs') o.rot = autoRot(p[0], p[1]); if (draft.k === 'core') { o.dia = wk.dia; o.at = wk.at; } return o; }); }
    else if (draft && draft.t === 'wk') { sh = P.moved && Math.hypot(draft.pts[1][0] - draft.pts[0][0], draft.pts[1][1] - draft.pts[0][1]) > u * 0.6 ? draft : null;
      if (!sh) { var rm = LOOPK.test(draft.k) ? roomAt(P.x0, P.y0) : null; if (rm) { sh = { t: 'wk', k: draft.k, st: draft.st, f: 'l', pts: rm.pts.concat([rm.pts[0]]).map(function (p) { return [p[0], p[1]]; }), loop: true }; say(rm.name + ' 둘레 전체에 넣었습니다. (문 폭은 빼지 않은 길이)'); } else say('선 기호는 끌어서 긋습니다.' + (LOOPK.test(draft.k) ? ' 방 안쪽을 한 번 누르면 둘레 전체에 들어갑니다.' : '')); } }
    else if (draft) { sh = draft; if (sh.t === 'circle' && sh.r < 6) sh.r = u * 2; if ((sh.t === 'arrow' || sh.t === 'dim' || sh.t === 'rect') && (!P.moved || Math.hypot(sh.x2 - sh.x1, sh.y2 - sh.y1) < u * 0.3)) sh = null; if (sh && sh.t === 'pen' && sh.pts.length < 2) sh = null; }
    else if (tool === 'scale') { if (!scaleP1) { scaleP1 = snapPt(P.x0, P.y0); say('척도: 둘째 점을 누르세요.'); } else { var p1 = scaleP1, p2 = snapPt(P.x0, P.y0); scaleP1 = null; ask('두 점 사이 실제 길이(mm) — 예: 도면에 적힌 3600', '3600', function (v) { var mm = Number(String(v).replace(/[^0-9.]/g, '')); if (!(mm > 0)) return; snap(); shapes = shapes.filter(function (q) { return q.t !== 'scale'; }); shapes.forEach(function (q) { delete q.a0; }); shapes.push({ t: 'scale', c: '#1d5fd0', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], mm: mm }); baseOk = false; touch(); setTool('select'); }); } }
    else if (tool === 'room' || tool === 'poly' || (tool === 'wk' && SYMS[wk.k] && SYMS[wk.k][2] === 'a')) { var isWk = tool === 'wk', q0 = tool === 'poly' ? [P.x0, P.y0] : snapPt(P.x0, P.y0);
      if (isWk && wk.whole && !poly) { var r = roomAt(P.x0, P.y0); if (!r) say('공간 안쪽을 눌러 주세요. 공간의 일부만이면 오른쪽에서 「직접 그리기」를 고르세요.'); else if (shapes.some(function (q) { return q.t === 'wk' && q.k === wk.k && q.f === 'a' && q.pts.length === r.pts.length && Math.abs(pxArea(q.pts) - pxArea(r.pts)) < 2 && inPoly(centroid(q.pts), r.pts); })) say(r.name + '에는 이미 ' + SYMS[wk.k][1] + '이(가) 있습니다.'); else { sh = { t: 'wk', k: wk.k, st: wk.st, f: 'a', pts: r.pts.map(function (p) { return [p[0], p[1]]; }) }; say(r.name + ' 전체에 넣었습니다.'); } }
      else if (!poly) poly = isWk ? { t: 'wk', k: wk.k, st: wk.st, f: 'a', pts: [q0] } : tool === 'poly' ? { t: 'poly', c: color, pts: [q0] } : { t: 'room', c: '#2f6b4f', pts: [q0], name: '' };
      else { var f = poly.pts[0]; if (poly.pts.length >= 3 && Math.hypot(f[0] - P.x0, f[1] - P.y0) < Math.max(u * 1.1, 18 / V.z)) { draft = null; polyClose(); return; } poly.pts.push(q0); }
      if (poly) say('모서리 ' + poly.pts.length + '개 — 첫 점을 다시 누르면 닫힙니다.'); }
    else if (tool === 'guide') { many = guideAt(P.x0, P.y0); if (many && !many.length) many = null; }
    else if (tool === 'wall') { var ds = wallSpan(P.x0, P.y0); if (!ds.length) say('방 안쪽을 눌러 주세요.'); else many = ds; }
    else if (tool === 'text') { var px = P.x0, py = P.y0; ask('적을 글자', '', function (s) { if (!s.trim()) return; snap(); shapes.push({ t: 'text', c: color, x: px, y: py, s: s.trim().slice(0, 60) }); sel = -1; touch(); }); }
    else if (tool === 'erase') { var bi = hit(P.x0, P.y0); if (bi >= 0) { snap(); var rc = shapes[bi].t === 'room'; shapes.splice(bi, 1); sel = -1; touch(rc); } }
    draft = null;
    if (sh || many) { snap(); if (sh) shapes.push(rqStamp(sh)); else many.forEach(function (q) { shapes.push(rqStamp(q)); }); sel = -1; touch(); if (tool === 'guide') sideDraw(); } else redraw();
  }
  function onDbl(ev) {   // 선택한 공간·구역의 변을 두 번 누르면 꼭짓점 추가, 꼭짓점을 두 번 누르면 빼기
    if (tool !== 'select') return; var s = shapes[sel]; if (!s || !s.pts || !(s.t === 'room' || s.t === 'poly' || (s.t === 'wk' && s.f === 'a'))) return; var p = XY(ev), x = p[0], y = p[1], u = U(), vi = -1;
    s.pts.forEach(function (q, i) { if (vi < 0 && Math.hypot(q[0] - x, q[1] - y) < u * 0.75) vi = i; }); if (vi >= 0) { if (s.pts.length > 3) { snap(); s.pts.splice(vi, 1); touch(s.t === 'room'); } return; }
    var bi = -1, bd = u; for (var i = 0; i < s.pts.length; i++) { var d = segD(x, y, s.pts[i], s.pts[(i + 1) % s.pts.length]); if (d < bd) { bd = d; bi = i; } } if (bi >= 0) { snap(); s.pts.splice(bi + 1, 0, [x, y]); touch(s.t === 'room'); }
  }
  function magnet(s) { var u = U(), tol = u * 0.7, xs = [], ys = []; shapes.forEach(function (q) { if (q.t === 'room' && q !== s && q.pts) q.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); }); if (!xs.length) return;
    var near = function (v, L) { var b = v, bd = tol; L.forEach(function (t) { var d = Math.abs(t - v); if (d < bd) { bd = d; b = t; } }); return b; }, dx = 0, dy = 0, bx = tol, by = tol;
    s.pts.forEach(function (p) { var nx = near(p[0], xs), ny = near(p[1], ys); if (nx !== p[0] && Math.abs(nx - p[0]) < bx) { bx = Math.abs(nx - p[0]); dx = nx - p[0]; } if (ny !== p[1] && Math.abs(ny - p[1]) < by) { by = Math.abs(ny - p[1]); dy = ny - p[1]; } }); if (dx || dy) shift(s, dx, dy); }
  function delSel() { if (sel < 0) return; snap(); var rc = shapes[sel].t === 'room'; shapes.splice(sel, 1); sel = -1; touch(rc); propDraw(); }
  function dup() { var s = shapes[sel]; if (!s) return; snap(); var c = JSON.parse(JSON.stringify(s)); delete c.grp; shift(c, U() * 1.5, U() * 1.5); shapes.push(c); sel = shapes.length - 1; touch(c.t === 'room'); propDraw(); }
  function onKey(ev) {
    if (!active() || $('jjeSheet') || $('jje3d')) return; var typing = /INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || ''), inMe = !typing || (ev.target.closest && ev.target.closest('#jjeRoot'));
    if (!inMe || (ev.target.isContentEditable)) return;
    if (ev.key === 'Escape') { if (typing) { ev.target.blur(); return; } if (draft || poly || scaleP1) { draft = null; poly = null; scaleP1 = null; redraw(); return; } if ($('jjeLayers').style.display === 'block') { layOpen(); return; } if (sel >= 0) { sel = -1; redraw(); propDraw(); return; } if (tool !== 'select') { setTool('select'); return; } if (full && root.innerWidth > 860) { full = false; applyFull(); } return; }
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) { var k = /^Key[A-Z]$/.test(ev.code || '') ? ev.code.slice(3).toLowerCase() : String(ev.key || '').toLowerCase(); if (!typing && k === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); } else if (!typing && k === 'y') { ev.preventDefault(); redo(); } else if (!typing && k === 'd' && sel >= 0) { ev.preventDefault(); dup(); } return; }
    if (typing || ev.altKey) return;
    if (ev.code === 'Space') { space = true; ev.preventDefault(); return; }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel >= 0) { ev.preventDefault(); delSel(); return; }
    if (ev.key === 'Enter' && poly && poly.pts.length >= 3) { polyClose(); return; }
    if (/^Arrow/.test(ev.key) && sel >= 0) { ev.preventDefault(); var d = ev.shiftKey ? 10 : 1, dx = ev.key === 'ArrowLeft' ? -d : ev.key === 'ArrowRight' ? d : 0, dy = ev.key === 'ArrowUp' ? -d : ev.key === 'ArrowDown' ? d : 0; snap(); shift(shapes[sel], dx, dy); touch(shapes[sel].t === 'room'); return; }
    if (ev.key === '+' || ev.key === '=') { zoomBy(1.25); return; } if (ev.key === '-') { zoomBy(0.8); return; } if (ev.key === '0') { fit(); return; }
    var kc = /^Key[A-Z]$/.test(ev.code || '') ? ev.code.slice(3) : String(ev.key || '').toUpperCase(); if (kc === 'L') { layOpen(); return; }
    var t = RAIL.filter(function (x) { return Array.isArray(x) && x[2] === kc; })[0]; if (t) setTool(t[0]);
  }
  function ask(label, def, cb) {
    var b = $('jjeAsk'); b.innerHTML = '<div style="font-size:15px;margin-bottom:8px">' + esc(label) + '</div><input id="jjeAskIn" autocomplete="off"><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px"><button type="button" class="jje-b" id="jjeAskNo">취소</button><button type="button" class="jje-b dark" id="jjeAskOk">확인</button></div>';
    b.style.display = 'block'; var inp = $('jjeAskIn'); inp.value = def == null ? '' : String(def); var done = function (v) { b.style.display = 'none'; b.innerHTML = ''; if (v !== null) cb(v); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); done(inp.value); } else if (e.key === 'Escape') { e.stopPropagation(); done(null); } }; $('jjeAskOk').onclick = function () { done(inp.value); }; $('jjeAskNo').onclick = function () { done(null); };
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 30);
  }
  function scaleInfo() { var el = $('jjeScale'); if (!el) return; var sc = shapes.filter(function (q) { return q.t === 'scale'; })[0], mm = mmpp();
    el.innerHTML = mm ? '척도: ' + (sc && sc.by === '면적' ? '전용면적 기준' : sc && /치수/.test(sc.by || '') ? '도면에 적힌 치수 기준' : sc && sc.by === '방 면적' ? '도면에 적힌 방 면적 기준' : sc && sc.by ? esc(sc.by) + ' 기준' : '직접 지정') : '<span style="color:#b4232a">척도 없음</span> — 「측정」에서 잡아 주세요'; }

  // ── 그리기
  // 번호: 작업지시서 묶음 순서로 1번부터. 한 줄로 놓은 같은 기호(grp)는 번호 하나를 같이 쓴다.
  function numbering() { var idx = []; shapes.forEach(function (q, i) { if (q.t === 'wk') idx.push(i); }); idx.sort(function (a, b) { return catOf(shapes[a].k) - catOf(shapes[b].k) || a - b; }); var nos = {}, show = {}, g = {}, n = 0; idx.forEach(function (i) { var q = shapes[i]; if (q.grp && g[q.grp + q.k]) { nos[i] = g[q.grp + q.k]; return; } n++; nos[i] = n; show[i] = true; if (q.grp) g[q.grp + q.k] = n; }); return { nos: nos, show: show }; }
  function hitObs(r) { for (var i = 0; i < OBS.length; i++) { var b = OBS[i]; if (r[0] < b[2] && r[2] > b[0] && r[1] < b[3] && r[3] > b[1]) return true; } return false; }
  function place(cands, w, h) { for (var i = 0; i < cands.length; i++) { var c = cands[i], r = [c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2]; if (!hitObs(r)) { OBS.push(r); return c; } } var c0 = cands[0]; OBS.push([c0[0] - w / 2, c0[1] - h / 2, c0[0] + w / 2, c0[1] + h / 2]); return c0; }
  function tag(g, tx, x, y, u, col) { g.save(); g.setLineDash([]); g.font = '700 ' + (u * 0.44).toFixed(1) + 'px ' + FONT; var r = u * 0.33, w = Math.max(r * 2, g.measureText(tx).width + u * 0.3); g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2 + r, y - r); g.arcTo(x + w / 2, y - r, x + w / 2, y + r, r); g.arcTo(x + w / 2, y + r, x - w / 2, y + r, r); g.arcTo(x - w / 2, y + r, x - w / 2, y - r, r); g.arcTo(x - w / 2, y - r, x + w / 2, y - r, r); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, x, y + u * 0.02); g.restore(); }
  function tagW(g, tx, u) { g.save(); g.font = '700 ' + (u * 0.44).toFixed(1) + 'px ' + FONT; var w = Math.max(u * 0.66, g.measureText(tx).width + u * 0.3); g.restore(); return w; }
  // 꼬리표: [번호] 글자 — 흰 바탕 작은 판. cands 가운데 다른 글자와 겹치지 않는 자리에 놓는다
  function label(g, tx, cands, u, col, no, sz) { sz = sz || 0.5; g.save(); g.setLineDash([]); g.font = '600 ' + (u * sz).toFixed(1) + 'px ' + FONT; var tw = g.measureText(tx).width, nw = no ? tagW(g, no, u) + u * 0.14 : 0, w = tw + nw + u * 0.36, h = u * Math.max(sz * 1.5, no ? 0.78 : 0), c = place(cands, w, h), x0 = c[0] - w / 2;
    g.fillStyle = 'rgba(255,255,255,.94)'; g.fillRect(x0, c[1] - h / 2, w, h); g.strokeStyle = col; g.lineWidth = Math.max(0.6, u / 34); g.strokeRect(x0, c[1] - h / 2, w, h); if (no) tag(g, no, x0 + u * 0.12 + (nw - u * 0.14) / 2, c[1], u, col);
    g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(tx, x0 + u * 0.18 + nw, c[1] + u * 0.02); g.restore(); return c; }
  // 기호 그림 — 실제 전기·설비 도면에서 쓰는 모양에 가깝게 선으로 그린다. (x,y) 가운데, r 반지름. 색·선 굵기는 부르는 쪽에서 정한다.
  function symDraw(g, k, x, y, r, rot, paper) {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot * Math.PI / 180); g.setLineDash(g._dash || []); g.lineCap = 'round'; g.lineJoin = 'round';
    var col = g.strokeStyle, C = function (cx, cy, rr, fill) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); if (fill) g.fill(); else g.stroke(); }, Ln = function () { g.beginPath(); for (var i = 0; i < arguments.length; i += 4) { g.moveTo(arguments[i], arguments[i + 1]); g.lineTo(arguments[i + 2], arguments[i + 3]); } g.stroke(); },
      bk = function (fn) { g.save(); g.fillStyle = paper || 'rgba(255,255,255,.95)'; g.beginPath(); fn(); g.fill(); g.restore(); }, bC = function (rr) { bk(function () { g.arc(0, 0, rr, 0, Math.PI * 2); }); }, bR = function (x0, y0, w, h) { bk(function () { g.rect(x0, y0, w, h); }); }, Rc = function (x0, y0, w, h) { g.beginPath(); g.rect(x0, y0, w, h); g.stroke(); },
      El = function (cx, cy, rx, ry) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); }, d;
    if (k === 'dl') { bC(r * 0.72); C(0, 0, r * 0.72); Ln(-r * 0.72, 0, r * 0.72, 0, 0, -r * 0.72, 0, r * 0.72); }
    else if (k === 'cl') { bC(r); C(0, 0, r); d = r * 0.707; Ln(-d, -d, d, d, d, -d, -d, d); }
    else if (k === 'pd') { bC(r * 0.86); C(0, 0, r * 0.86); C(0, 0, r * 0.46); C(0, 0, r * 0.14, 1); }
    else if (k === 'sw') { bC(r * 0.5); C(0, 0, r * 0.32, 1); Ln(r * 0.22, -r * 0.22, r * 0.95, -r * 0.95, r * 0.95, -r * 0.95, r * 1.32, -r * 0.58); }
    else if (k === 'ol' || k === 'od') { bC(r * (k === 'od' ? 1.04 : 0.8)); C(0, 0, r * 0.8); Ln(-r * 0.27, -r * 0.42, -r * 0.27, r * 0.42, r * 0.27, -r * 0.42, r * 0.27, r * 0.42); if (k === 'od') C(0, 0, r * 1.04); }
    else if (k === 'db') { bR(-r * 1.15, -r * 0.7, r * 2.3, r * 1.4); Rc(-r * 1.15, -r * 0.7, r * 2.3, r * 1.4); g.beginPath(); g.moveTo(-r * 1.15, r * 0.7); g.lineTo(r * 1.15, -r * 0.7); g.lineTo(r * 1.15, r * 0.7); g.closePath(); g.fill(); }
    else if (k === 'nt') { bR(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); Rc(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); g.beginPath(); g.moveTo(0, -r * 0.5); g.lineTo(r * 0.52, r * 0.42); g.lineTo(-r * 0.52, r * 0.42); g.closePath(); g.fill(); }
    else if (k === 'fan') { bR(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8); Rc(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8); C(0, 0, r * 0.66); for (d = 0; d < 3; d++) { var a = d * Math.PI * 2 / 3 - Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.7) * r * 0.5, Math.sin(a + 0.7) * r * 0.5, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); g.stroke(); } C(0, 0, r * 0.1, 1); }
    else if (k === 'wt') { bC(r * 0.58); C(0, 0, r * 0.58); Ln(-r * 0.58, 0, r * 0.58, 0, 0, -r * 0.58, 0, -r * 1.12, -r * 0.42, -r * 1.12, r * 0.42, -r * 1.12); C(0, r * 0.02, r * 0.15, 1); }
    else if (k === 'dr') { bC(r * 0.72); C(0, 0, r * 0.72); d = r * 0.26; var c1 = Math.sqrt(0.72 * 0.72 * r * r - d * d); Ln(-d, -c1, -d, c1, d, -c1, d, c1, -c1, -d, c1, -d, -c1, d, c1, d); }
    else if (k === 'wc') { bR(-r * 0.78, -r * 1.2, r * 1.56, r * 0.56); bk(function () { g.ellipse(0, r * 0.22, r * 0.64, r * 0.9, 0, 0, Math.PI * 2); }); Rc(-r * 0.78, -r * 1.2, r * 1.56, r * 0.56); El(0, r * 0.22, r * 0.64, r * 0.9); El(0, r * 0.32, r * 0.4, r * 0.6); }
    else if (k === 'bs') { bk(function () { g.rect(-r * 1.1, -r * 0.78, r * 2.2, r * 1.56); }); g.beginPath(); var rw = r * 1.1, rh = r * 0.78, rr = r * 0.28; g.moveTo(-rw, -rh); g.lineTo(rw, -rh); g.lineTo(rw, rh - rr); g.arcTo(rw, rh, rw - rr, rh, rr); g.lineTo(-rw + rr, rh); g.arcTo(-rw, rh, -rw, rh - rr, rr); g.closePath(); g.stroke(); El(0, r * 0.1, r * 0.74, r * 0.46); C(0, -r * 0.52, r * 0.1, 1); }
    else if (k === 'gas') { bR(-r * 0.8, -r * 1.0, r * 1.6, r * 1.8); Rc(-r * 0.8, -r * 1.0, r * 1.6, r * 1.8); C(0, -r * 0.2, r * 0.42); Ln(-r * 0.4, r * 0.8, -r * 0.4, r * 1.25, r * 0.4, r * 0.8, r * 0.4, r * 1.25); g.beginPath(); g.moveTo(0, -r * 0.45); g.quadraticCurveTo(r * 0.3, -r * 0.1, 0, r * 0.05); g.quadraticCurveTo(-r * 0.3, -r * 0.1, 0, -r * 0.45); g.fill(); }
    else if (k === 'core') { bC(r); C(0, 0, r); Ln(-r * 1.4, 0, r * 1.4, 0, 0, -r * 1.4, 0, r * 1.4); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, -Math.PI / 2, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, Math.PI / 2, Math.PI); g.closePath(); g.fill(); }
    else if (k === 'dmP') { bR(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); g.save(); g.setLineDash([r * 0.3, r * 0.2]); Rc(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); g.restore(); Ln(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5, r * 0.5, -r * 0.5, -r * 0.5, r * 0.5); }
    else if (k === 'doorN') { bk(function () { g.moveTo(-r * 0.9, r * 0.8); g.lineTo(-r * 0.9, -r * 0.9); g.arc(-r * 0.9, r * 0.8, r * 1.7, -Math.PI / 2, 0); g.closePath(); }); Ln(-r * 0.9, r * 0.8, -r * 0.9, -r * 0.9, -r * 1.05, r * 0.8, r * 0.95, r * 0.8); g.save(); g.lineWidth = g.lineWidth * 0.6; g.beginPath(); g.arc(-r * 0.9, r * 0.8, r * 1.7, -Math.PI / 2, 0); g.stroke(); g.restore(); }
    else if (k === 'sash') { bR(-r * 1.15, -r * 0.5, r * 2.3, r); Rc(-r * 1.15, -r * 0.5, r * 2.3, r); Ln(0, -r * 0.5, 0, r * 0.5, -r * 1.15, 0, r * 1.15, 0); }
    else if (k === 'edge') { bC(r * 0.95); Ln(-r * 0.62, -r * 0.7, -r * 0.62, r * 0.62, -r * 0.62, r * 0.62, r * 0.7, r * 0.62); g.beginPath(); g.moveTo(-r * 0.62, r * 0.62); g.lineTo(-r * 0.62, -r * 0.08); g.lineTo(r * 0.08, r * 0.62); g.closePath(); g.fill(); }
    else { var S = SYMS[k] || ['', '', '', '?']; bC(r * 0.8); C(0, 0, r * 0.8); g.font = '700 ' + (r * 0.9).toFixed(1) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(S[3], 0, r * 0.05); }
    g.restore();
  }
  function arrowHead(g, x, y, ang, h) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - h * Math.cos(ang - 0.45), y - h * Math.sin(ang - 0.45)); g.lineTo(x - h * Math.cos(ang + 0.45), y - h * Math.sin(ang + 0.45)); g.closePath(); g.fill(); }
  function pathOf(g, P, close) { g.beginPath(); P.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); if (close) g.closePath(); }
  function drawWk(g, q, u, no, ord) {
    var S = SYMS[q.k] || ['표시', '표시', q.f || 'p', '?'], bc = tradeColor(S[0]), col = q.st === 'keep' ? '#7b7f86' : q.st === 'remove' ? '#b4232a' : bc, mm = mmpp(), stTx = q.st && q.st !== 'new' && !(q.st === 'remove' && S[0] === '철거') ? ST.filter(function (s) { return s[0] === q.st; })[0][1] + ' ' : '', showNo = no && (nums || sheetMode), k = q.k, x, y, r, c0;
    g.strokeStyle = col; g.fillStyle = col;
    if (q.f === 'p') { r = k === 'core' ? u * (0.3 + 0.0022 * Math.max(50, Math.min(200, q.dia || 100))) : u * 0.56; x = q.x; y = q.y; g.lineWidth = Math.max(1.1, u / 13); g._dash = q.st === 'move' ? [u * 0.16, u * 0.12] : null; symDraw(g, k, x, y, r, q.rot || 0); g._dash = null;
      if (q.st === 'remove' && k !== 'dmP') { g.save(); g.strokeStyle = '#b4232a'; g.lineWidth = Math.max(1.6, u / 8); g.lineCap = 'round'; g.beginPath(); g.moveTo(x - r * 1.15, y - r * 1.15); g.lineTo(x + r * 1.15, y + r * 1.15); g.moveTo(x + r * 1.15, y - r * 1.15); g.lineTo(x - r * 1.15, y + r * 1.15); g.stroke(); g.restore(); }
      else if (q.st === 'move') { g.save(); g.setLineDash([]); g.lineWidth = Math.max(1.1, u / 13); var ax = x + r * 1.15, ay = y + r * 1.15; g.beginPath(); g.moveTo(ax - r * 0.2, ay - r * 0.2); g.lineTo(ax + r * 0.75, ay + r * 0.75); g.stroke(); arrowHead(g, ax + r * 0.95, ay + r * 0.95, Math.PI / 4, r * 0.6); g.restore(); }
      if (showNo) { var w = tagW(g, String(no), u), o = r * 1.05 + u * 0.2, c = place([[x + o, y - o], [x - o, y - o], [x + o, y + o * (q.st === 'move' ? 1.9 : 1)], [x - o, y + o], [x, y - o * 1.45], [x, y + o * 1.45]], w, u * 0.66); tag(g, String(no), c[0], c[1], u, bc); }
      var nt = k === 'core' ? 'Ø' + (q.dia || 100) + ' ' + (q.at || '벽') + (q.note ? ' · ' + q.note : '') : [mTag(q).trim(), String(q.note || '')].filter(Boolean).join(' · '); if (nt) label(g, nt.length > 18 ? nt.slice(0, 17) + '…' : nt, [[x, y + r * 2.0], [x, y - r * 2.0], [x + r * 3, y], [x - r * 3, y], [x, y + r * 3]], u, k === 'core' ? bc : '#374151', '', k === 'core' ? 0.46 : 0.42);
      return; }
    if (q.f === 'l') { var P = q.pts; if (q.loop && P.length > 3) { P = inset(P.slice(0, -1), u * (0.2 + 0.2 * (ord || 0))); P = P.concat([P[0]]); }
      var a = P[0], b = P[P.length - 1]; g.lineCap = 'butt'; g.lineJoin = 'miter'; g.setLineDash([]);
      if (k === 'wallN') { g.lineWidth = Math.max(4, u / 3); pathOf(g, P); g.stroke(); g.save(); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.6, u / 7); pathOf(g, P); g.stroke(); g.restore(); }
      else if (k === 'dmL') { g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(5, u / 2.4); pathOf(g, P); g.stroke(); g.restore(); g.strokeStyle = '#b4232a'; g.lineWidth = Math.max(2, u / 6); g.setLineDash([u * 0.42, u * 0.24]); pathOf(g, P); g.stroke(); }
      else if (k === 'ins') { g.lineWidth = Math.max(3, u / 3.4); g.setLineDash([u * 0.09, u * 0.09]); pathOf(g, P); g.stroke(); g.setLineDash([]); }
      else if (k === 'sink' || k === 'zen') { g.lineWidth = Math.max(4, u / 2.6); g.globalAlpha = 0.85; pathOf(g, P); g.stroke(); g.globalAlpha = 1; }
      else { g.lineWidth = Math.max(1.6, u / 9); g.setLineDash(k === 'mold' ? [u * 0.5, u * 0.14, u * 0.1, u * 0.14] : k === 'base' ? [u * 0.42, u * 0.2] : k === 'paint' ? [u * 0.12, u * 0.16] : k === 'll' ? [u * 0.05, u * 0.24] : k === 'pipe' ? [u * 0.5, u * 0.2] : k === 'wire' ? [u * 0.3, u * 0.12, u * 0.06, u * 0.12] : k === 'cbox' ? [u * 0.3, u * 0.16] : []); if (k === 'll') { g.lineCap = 'round'; g.lineWidth = Math.max(2.4, u / 5.5); } pathOf(g, P); g.stroke(); g.setLineDash([]);
        if (k === 'art' || k === 'trn') { g.save(); g.lineWidth = Math.max(0.8, u / 22); for (var i = 0; i + 1 < P.length; i++) { var L1 = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) || 1, nx = -(P[i + 1][1] - P[i][1]) / L1 * u * 0.16, ny = (P[i + 1][0] - P[i][0]) / L1 * u * 0.16; g.beginPath(); g.moveTo(P[i][0] + nx, P[i][1] + ny); g.lineTo(P[i + 1][0] + nx, P[i + 1][1] + ny); g.moveTo(P[i][0] - nx, P[i][1] - ny); g.lineTo(P[i + 1][0] - nx, P[i + 1][1] - ny); g.stroke(); } g.restore(); }
        if (k === 'tileW') { g.save(); g.lineWidth = Math.max(0.8, u / 22); for (var j = 0; j + 1 < P.length; j++) { var L2 = Math.hypot(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]) || 1, n2 = Math.max(1, Math.round(L2 / (u * 0.6))), tx0 = -(P[j + 1][1] - P[j][1]) / L2 * u * 0.2, ty0 = (P[j + 1][0] - P[j][0]) / L2 * u * 0.2; g.beginPath(); for (var t = 0; t <= n2; t++) { var px = P[j][0] + (P[j + 1][0] - P[j][0]) * t / n2, py = P[j][1] + (P[j + 1][1] - P[j][1]) * t / n2; g.moveTo(px - tx0, py - ty0); g.lineTo(px + tx0, py + ty0); } g.stroke(); } g.restore(); }
        if (k === 'pipe' || q.st === 'move') { var pa = P[P.length - 2]; arrowHead(g, b[0], b[1], Math.atan2(b[1] - pa[1], b[0] - pa[0]), u * 0.5); g.beginPath(); g.arc(a[0], a[1], u * 0.13, 0, Math.PI * 2); g.fill(); } }
      if (q.st === 'remove' || k === 'dmL') { g.save(); g.setLineDash([]); g.strokeStyle = '#b4232a'; g.lineWidth = Math.max(1.2, u / 11); g.lineCap = 'round'; for (var s2 = 0; s2 + 1 < P.length; s2++) { var A = P[s2], B = P[s2 + 1], L0 = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, n = Math.max(1, Math.round(L0 / (u * 1.5))), d = u * 0.22; g.beginPath(); for (var m = 0; m < n; m++) { var cx = A[0] + (B[0] - A[0]) * (m + 0.5) / n, cy = A[1] + (B[1] - A[1]) * (m + 0.5) / n; g.moveTo(cx - d, cy - d); g.lineTo(cx + d, cy + d); g.moveTo(cx + d, cy - d); g.lineTo(cx - d, cy + d); } g.stroke(); } g.restore(); }
      var la = a, lb = b, ll = -1; for (var z = 0; z + 1 < P.length; z++) { var dd = Math.hypot(P[z + 1][0] - P[z][0], P[z + 1][1] - P[z][1]); if (dd > ll) { ll = dd; la = P[z]; lb = P[z + 1]; } }
      var Lx = Math.hypot(lb[0] - la[0], lb[1] - la[1]) || 1, ux = (lb[0] - la[0]) / Lx, uy = (lb[1] - la[1]) / Lx, vx = -uy, vy = ux, cs = []; c0 = q.loop ? centroid(P.slice(0, -1)) : null; var sgn = c0 && ((c0[0] - la[0]) * vx + (c0[1] - la[1]) * vy) < 0 ? -1 : 1;
      [0.5, 0.28, 0.72, 0.14, 0.86].forEach(function (t) { var mx = la[0] + (lb[0] - la[0]) * t, my = la[1] + (lb[1] - la[1]) * t; cs.push([mx + vx * sgn * u * 0.62, my + vy * sgn * u * 0.62]); if (!q.loop) cs.push([mx - vx * sgn * u * 0.62, my - vy * sgn * u * 0.62]); }); if (!q.loop) [0.5, 0.25, 0.75].forEach(function (t) { var mx = la[0] + (lb[0] - la[0]) * t, my = la[1] + (lb[1] - la[1]) * t; cs.push([mx + vx * u * 1.35, my + vy * u * 1.35], [mx - vx * u * 1.35, my - vy * u * 1.35]); }); if (q.loop) [1.3, 2.0, 2.7].forEach(function (o) { cs.push([(la[0] + lb[0]) / 2 + vx * sgn * u * o, (la[1] + lb[1]) / 2 + vy * sgn * u * o]); });
      label(g, stTx + S[3] + mTag(q) + (mm ? ' ' + (lineLen(q.pts) * mm / 1000).toFixed(1) + 'm' : '') + (q.note ? ' · ' + String(q.note).slice(0, 12) : ''), cs, u, col, showNo ? String(no) : '', 0.44); return; }
    // 구역: 옅은 무늬 + 작은 꼬리표 (방 이름을 덮는 진한 빗금은 쓰지 않는다)
    if (q.pts.length < 3) { pathOf(g, q.pts); g.lineWidth = Math.max(1.4, u / 10); g.stroke(); return; }
    var Pz = inset(q.pts, u * (0.14 + 0.16 * (ord || 0))), xs = q.pts.map(function (p) { return p[0]; }), ys = q.pts.map(function (p) { return p[1]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), cross = k === 'dmA' || q.st === 'remove', gap, tt;
    g.save(); pathOf(g, Pz, true); g.globalAlpha = 0.03; g.fill(); g.globalAlpha = cross ? 0.3 : 0.17; g.clip(); g.setLineDash([]); g.lineWidth = Math.max(0.7, u / 26); g.beginPath();
    if (cross) { gap = u * 1.5; for (tt = x0 - (y1 - y0); tt < x1; tt += gap) { g.moveTo(tt, y1); g.lineTo(tt + (y1 - y0), y0); g.moveTo(tt, y0); g.lineTo(tt + (y1 - y0), y1); } }
    else if (k === 'floor') { gap = u * 0.75; for (tt = y0 + gap * 0.5; tt < y1; tt += gap) { g.moveTo(x0, tt); g.lineTo(x1, tt); } }
    else if (k === 'tileF') { gap = u * 0.95; for (tt = x0 + gap; tt < x1; tt += gap) { g.moveTo(tt, y0); g.lineTo(tt, y1); } for (tt = y0 + gap; tt < y1; tt += gap) { g.moveTo(x0, tt); g.lineTo(x1, tt); } }
    else if (k === 'fur' || k === 'shoe') { g.moveTo(x0, y0); g.lineTo(x1, y1); g.moveTo(x1, y0); g.lineTo(x0, y1); }
    else if (k === 'ceil') { gap = u * 1.7; g.setLineDash([u * 0.3, u * 0.3]); for (tt = x0; tt < x1 + (y1 - y0); tt += gap) { g.moveTo(tt, y0); g.lineTo(tt - (y1 - y0), y1); } }
    else if (k === 'wp') { gap = u * 0.62; for (tt = x0 - (y1 - y0); tt < x1; tt += gap) { g.moveTo(tt, y1); g.lineTo(tt + (y1 - y0), y0); } }
    else if (k === 'tub') { var Pi = inset(Pz, u * 0.3); pathOf(g, Pi, true); }
    else { gap = u * 1.9; for (tt = x0 - (y1 - y0); tt < x1; tt += gap) { g.moveTo(tt, y1); g.lineTo(tt + (y1 - y0), y0); } }
    g.stroke(); g.restore();
    g.save(); pathOf(g, Pz, true); g.lineWidth = Math.max(1.1, u / 13); g.lineJoin = 'miter'; if (k !== 'fur' && k !== 'shoe' && k !== 'tub') g.setLineDash(q.st === 'keep' || q.st === 'move' ? [u * 0.14, u * 0.14] : [u * 0.44, u * 0.2]); g.stroke(); g.restore();
    var txz = stTx + S[3] + mTag(q) + (mm ? ' ' + (pxArea(q.pts) * mm * mm / 1e6).toFixed(1) + '㎡' : '') + (q.note ? ' · ' + String(q.note).slice(0, 12) : ''); g.save(); g.font = '600 ' + (u * 0.46).toFixed(1) + 'px ' + FONT; var lw = g.measureText(txz).width + u * 1.2; g.restore();
    var ix = u * 0.45 + lw / 2, iy = u * 0.62, zc = []; c0 = centroid(q.pts);
    [[x0 + ix, y0 + iy], [x1 - ix, y0 + iy], [x0 + ix, y1 - iy], [x1 - ix, y1 - iy], [x0 + ix, y0 + iy + u * 0.85], [x1 - ix, y0 + iy + u * 0.85], [x0 + ix, y1 - iy - u * 0.85], [x1 - ix, y1 - iy - u * 0.85], [c0[0], y0 + iy], [c0[0], y1 - iy]].forEach(function (c) { if (x1 - x0 > lw + u * 0.4 && inPoly(c, q.pts)) zc.push(c); }); zc.push([c0[0], c0[1] + u * 1.3], [c0[0], c0[1] - u * 1.3], c0);
    label(g, txz, zc, u, col, showNo ? String(no) : '', 0.46);
  }
  function drawDoor(g, q, u) { var L = Math.hypot(q.x2 - q.x1, q.y2 - q.y1) || 1, ux = (q.x2 - q.x1) / L, uy = (q.y2 - q.y1) / L, s = q.flip ? -1 : 1, nx = -uy * s, ny = ux * s, a0 = Math.atan2(ny, nx), a1 = Math.atan2(uy, ux);
    g.save(); g.strokeStyle = sheetMode ? '#ffffff' : '#f7f4ee'; g.lineCap = 'butt'; var mmD = mmpp(); g.lineWidth = Math.max(4, u / 1.7, mmD ? 250 / mmD : 0); g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2); g.stroke();   // 문 자리의 벽선을 지운다
    g.strokeStyle = '#26302c'; g.lineWidth = Math.max(1.3, u / 11); g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x1 + nx * L, q.y1 + ny * L); g.stroke(); g.lineWidth = Math.max(0.7, u / 24); g.beginPath(); var dlt = a1 - a0; while (dlt > Math.PI) dlt -= Math.PI * 2; while (dlt < -Math.PI) dlt += Math.PI * 2; g.arc(q.x1, q.y1, L, a0, a0 + dlt, dlt < 0); g.stroke();
    g.lineWidth = Math.max(1.3, u / 11); var tk = u * 0.18; g.beginPath(); g.moveTo(q.x1 - ny * tk * s, q.y1 + nx * tk * s); g.lineTo(q.x1 + ny * tk * s, q.y1 - nx * tk * s); g.moveTo(q.x2 - nx * tk, q.y2 - ny * tk); g.lineTo(q.x2 + nx * tk, q.y2 + ny * tk); g.stroke(); g.restore(); }
  function drawOne(g, q, u, no, ord) {
    g.save(); g.strokeStyle = q.c || '#d8322e'; g.fillStyle = q.c || '#d8322e'; g.lineWidth = Math.max(1.6, u / 8); g.lineCap = 'round'; g.lineJoin = 'round';
    var mm = mmpp(), lab = function (tx, x, y, sz) { g.font = '700 ' + (u * (sz || 0.6)).toFixed(1) + 'px ' + FONT; g.lineWidth = Math.max(3, u / 4); g.strokeStyle = '#fff'; g.strokeText(tx, x, y); g.fillText(tx, x, y); };
    if (q.t === 'wk') drawWk(g, q, u, no, ord);
    else if (q.t === 'room') { var rc = q.c || '#2f6b4f'; pathOf(g, q.pts, !!q.name); g.strokeStyle = rc; g.lineWidth = Math.max(1.6, u / 9); g.stroke();
      if (q.name) { g.globalAlpha = 0.06; g.fillStyle = rc; g.fill(); g.globalAlpha = 1; var m = polyMeasure(q, mm), c0 = centroid(q.pts); g.fillStyle = rc; g.textAlign = 'center'; if (!bgOn) lab(q.name + (m ? ' ' + m.area.toFixed(1) + '㎡' : ''), c0[0], c0[1], 0.62); g.textAlign = 'start';
        if (mm && !sheetMode && (shapes[sel] === q || allLen)) { var n = q.pts.length; for (var i = 0; i < n; i++) { var a = q.pts[i], b = q.pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < u * 2.2) continue; var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L, inw = (c0[0] - mx) * nx + (c0[1] - my) * ny > 0 ? 1 : -1; g.fillStyle = '#444'; g.textAlign = 'center'; lab((L * mm / 1000).toFixed(2), mx + nx * inw * u * 0.7, my + ny * inw * u * 0.7 + u * 0.18, 0.46); } } } }
    else if (q.t === 'scale') { var sx = Math.hypot(q.x2 - q.x1, q.y2 - q.y1) || 1, kx = (q.x2 - q.x1) / sx, ky = (q.y2 - q.y1) / sx, tk = u * 0.2; g.strokeStyle = '#26302c'; g.fillStyle = '#26302c'; g.lineCap = 'butt'; g.lineWidth = Math.max(1, u / 14); g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2); g.moveTo(q.x1 + ky * tk, q.y1 - kx * tk); g.lineTo(q.x1 - ky * tk, q.y1 + kx * tk); g.moveTo(q.x2 + ky * tk, q.y2 - kx * tk); g.lineTo(q.x2 - ky * tk, q.y2 + kx * tk); g.stroke(); g.font = '600 ' + (u * 0.44).toFixed(1) + 'px ' + FONT; g.textAlign = 'center'; g.fillText(q.mm >= 1000 ? R2(q.mm / 1000) + 'm' : q.mm + 'mm', (q.x1 + q.x2) / 2, (q.y1 + q.y2) / 2 - u * 0.3); }
    else if (q.t === 'dim') { var Ld = Math.hypot(q.x2 - q.x1, q.y2 - q.y1) || 1, dx = (q.x2 - q.x1) / Ld, dy = (q.y2 - q.y1) / Ld, t2 = u * 0.26; g.strokeStyle = '#111827'; g.fillStyle = '#111827'; g.lineCap = 'butt'; g.lineWidth = Math.max(1, u / 14);
      g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2); g.moveTo(q.x1 - dy * t2, q.y1 + dx * t2); g.lineTo(q.x1 + dy * t2, q.y1 - dx * t2); g.moveTo(q.x2 - dy * t2, q.y2 + dx * t2); g.lineTo(q.x2 + dy * t2, q.y2 - dx * t2); g.stroke(); g.lineWidth = Math.max(1.2, u / 11); g.beginPath(); [[q.x1, q.y1], [q.x2, q.y2]].forEach(function (p) { g.moveTo(p[0] - (dx - dy) * t2 * 0.6, p[1] - (dy + dx) * t2 * 0.6); g.lineTo(p[0] + (dx - dy) * t2 * 0.6, p[1] + (dy + dx) * t2 * 0.6); }); g.stroke();
      var r10 = Math.round(Ld * mm / 10) * 10, txd = mm ? r10.toLocaleString('ko-KR') : '척도 없음', mxd = (q.x1 + q.x2) / 2, myd = (q.y1 + q.y2) / 2; var dc = []; [0.5, 0.25, 0.75, 0.12, 0.88].forEach(function (t) { var ax = q.x1 + (q.x2 - q.x1) * t, ay = q.y1 + (q.y2 - q.y1) * t; dc.push([ax - dy * u * 0.55, ay + dx * u * 0.55], [ax + dy * u * 0.55, ay - dx * u * 0.55]); }); label(g, txd, dc, u, mm ? '#111827' : '#b4232a', '', 0.5); }
    else if (q.t === 'win') { g.strokeStyle = '#1d5fd0'; g.lineWidth = Math.max(3, u / 3); g.lineCap = 'butt'; g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, u / 9); g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2); g.stroke(); }
    else if (q.t === 'door') drawDoor(g, q, u);
    else if (q.t === 'guide') { var ge = gExt(q), gv = q.o === 'v', sg = spanAt(q.x, q.y), gc = q.c || '#d11a2a'; g.strokeStyle = gc; g.lineCap = 'butt'; g.lineWidth = Math.max(0.9, u / 18); g.setLineDash([u * 0.55, u * 0.12, u * 0.07, u * 0.12]); g.beginPath(); if (gv) { g.moveTo(q.x, ge[0]); g.lineTo(q.x, ge[1]); } else { g.moveTo(ge[0], q.y); g.lineTo(ge[1], q.y); } g.stroke(); g.setLineDash([]);
      if (mm && sg) { var a1 = gv ? sg.L : sg.T, b1 = gv ? sg.R : sg.B, pv = gv ? q.x : q.y, both = !sheetMode && shapes[sel] === q, gtx = function (px) { return (Math.round(px * mm / 10) * 10).toLocaleString('ko-KR'); }, gl = function (m0, tx) { label(g, tx, gv ? [[m0, q.y], [m0, q.y - u * 0.9], [m0, q.y + u * 0.9], [m0, q.y - u * 1.8], [m0, q.y + u * 1.8]] : [[q.x, m0], [q.x - u * 1.5, m0], [q.x + u * 1.5, m0], [q.x - u * 3, m0], [q.x + u * 3, m0]], u, gc, '', 0.4); };
        if (a1 != null && b1 != null) { var nearA = pv - a1 <= b1 - pv; if ((nearA || both) && pv - a1 > u * 0.5) gl((a1 + pv) / 2, gtx(pv - a1)); if ((!nearA || both) && b1 - pv > u * 0.5) gl((pv + b1) / 2, gtx(b1 - pv)); } } }
    else if (q.t === 'circle') { g.beginPath(); g.arc(q.x, q.y, Math.max(1, q.r), 0, Math.PI * 2); g.stroke(); }
    else if (q.t === 'rect') { g.lineJoin = 'miter'; g.globalAlpha = 0.06; g.fillRect(Math.min(q.x1, q.x2), Math.min(q.y1, q.y2), Math.abs(q.x2 - q.x1), Math.abs(q.y2 - q.y1)); g.globalAlpha = 1; g.strokeRect(Math.min(q.x1, q.x2), Math.min(q.y1, q.y2), Math.abs(q.x2 - q.x1), Math.abs(q.y2 - q.y1)); }
    else if (q.t === 'poly') { pathOf(g, q.pts, q.pts.length > 2); if (q.pts.length > 2) { g.globalAlpha = 0.06; g.fill(); g.globalAlpha = 1; } g.stroke(); }
    else if (q.t === 'arrow') { g.beginPath(); g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2); g.stroke(); arrowHead(g, q.x2, q.y2, Math.atan2(q.y2 - q.y1, q.x2 - q.x1), u * 0.7); }
    else if (q.t === 'pen') { pathOf(g, q.pts); g.stroke(); }
    else if (q.t === 'text') { g.font = '700 ' + (u * 0.6).toFixed(1) + 'px ' + FONT; g.lineWidth = Math.max(3, u / 4); g.strokeStyle = '#fff'; g.strokeText(q.s, q.x, q.y); g.fillText(q.s, q.x, q.y); }
    g.restore();
  }
  // 같은 방에 겹쳐 놓인 구역·둘레 선은 차례로 조금씩 안쪽에 그려 서로 겹치지 않게 한다
  function orders(only) { var ord = {}, seen = []; shapes.forEach(function (q, i) { if (q.t !== 'wk' || !(q.f === 'a' || q.loop) || !visible(q) || (only && !only(q))) return; var P = q.loop ? q.pts.slice(0, -1) : q.pts, c = centroid(P), a = pxArea(P), n = 0; seen.forEach(function (s) { if (Math.abs(s.a - a) < a * 0.04 + 4 && Math.hypot(s.c[0] - c[0], s.c[1] - c[1]) < U()) n++; }); ord[i] = n; seen.push({ a: a, c: c }); }); return ord; }
  function paint(g, only, noSel) {
    var u = U(), N = numbering(), ord = orders(only), ok0 = function (q) { return visible(q) && (!only || only(q)); }; OBS = LABELS.slice();
    // 기호를 놓는 동안에는 고른 공종만 진하게, 다른 공종은 흐리게(글자 없이) 그린다 — 좁은 욕실에 여러 공종이 겹쳐도 지금 일이 보이게 (2026-11-11)
    var dim = function (q) { return focusOn && !only && !sheetMode && tool === 'wk' && q.t === 'wk' && SYMS[q.k] && SYMS[q.k][0] !== wk.trade; }, ok = function (q) { return ok0(q) && !dim(q); };
    if (shapes.some(function (q) { return ok0(q) && dim(q); })) { g.save(); g.globalAlpha = 0.25; mute = true; try { ['a', 'l', 'p'].forEach(function (f) { shapes.forEach(function (q, i) { if (q.t === 'wk' && q.f === f && ok0(q) && dim(q)) drawOne(g, q, u, 0, ord[i]); }); }); } finally { mute = false; } g.restore(); }
    shapes.forEach(function (q) { if (q.t === 'wk' && q.f === 'p' && ok(q)) { var r = u * 0.62; OBS.push([q.x - r, q.y - r, q.x + r, q.y + r]); } });
    shapes.forEach(function (q, i) { if (q.t === 'wk' && q.f === 'a' && ok(q)) drawOne(g, q, u, N.show[i] ? N.nos[i] : 0, ord[i]); });
    shapes.forEach(function (q, i) { if (q.t === 'wk' || !ok(q)) return; if (bgOn && (q.t === 'room' || q.t === 'win') && (noSel || i !== sel)) return; if (sheetMode && (q.t === 'scale')) return; drawOne(g, q, u); });
    shapes.forEach(function (q, i) { if (q.t === 'wk' && q.f === 'l' && ok(q)) drawOne(g, q, u, N.show[i] ? N.nos[i] : 0, ord[i]); });
    shapes.forEach(function (q, i) { if (q.t === 'wk' && q.f === 'p' && ok(q)) drawOne(g, q, u, N.show[i] ? N.nos[i] : 0); });
  }
  function redraw() {
    var cv = $('jjeCv'); if (!cv || !cv.width) return; var g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(K, 0, 0, K, -SX * K, -SY * K);
    var u = U(); paint(g);
    if (draft && draft.t === '_row') rowPts(draft).forEach(function (p) { drawOne(g, { t: 'wk', k: draft.k, st: draft.st, f: 'p', x: p[0], y: p[1], dia: wk.dia, at: wk.at, rot: (draft.k === 'wc' || draft.k === 'bs') ? autoRot(p[0], p[1]) : 0 }, u); }); else if (draft) drawOne(g, draft, u);
    if (poly) { drawOne(g, poly, u); g.save(); g.fillStyle = '#fff'; g.strokeStyle = '#1d5fd0'; g.lineWidth = Math.max(1.5, u / 9); poly.pts.forEach(function (p, i) { g.beginPath(); g.arc(p[0], p[1], u * (i ? 0.2 : 0.34), 0, Math.PI * 2); g.fill(); g.stroke(); }); g.restore(); }
    if (scaleP1) { g.save(); g.fillStyle = '#1d5fd0'; g.beginPath(); g.arc(scaleP1[0], scaleP1[1], u * 0.26, 0, Math.PI * 2); g.fill(); g.restore(); }
    var s = shapes[sel]; if (s && tool === 'select') { g.save(); g.strokeStyle = '#1d5fd0'; g.fillStyle = '#fff'; g.lineWidth = Math.max(1.2, u / 12); var hs = Math.max(u * 0.2, 5 / V.z), box = function (p) { g.beginPath(); g.rect(p[0] - hs, p[1] - hs, hs * 2, hs * 2); g.fill(); g.stroke(); };
      if (s.pts && s.t !== 'pen') { g.setLineDash([u * 0.3, u * 0.2]); pathOf(g, s.pts, s.t === 'room' || s.t === 'poly' || s.f === 'a'); g.stroke(); g.setLineDash([]); (s.loop ? [] : s.pts).forEach(box); }
      else if ('x1' in s) { box([s.x1, s.y1]); box([s.x2, s.y2]); } else if (s.pts) { var xs = s.pts.map(function (p) { return p[0]; }), ys = s.pts.map(function (p) { return p[1]; }); g.setLineDash([u * 0.3, u * 0.2]); g.strokeRect(Math.min.apply(null, xs) - hs, Math.min.apply(null, ys) - hs, Math.max.apply(null, xs) - Math.min.apply(null, xs) + hs * 2, Math.max.apply(null, ys) - Math.min.apply(null, ys) + hs * 2); }
      else { g.setLineDash([u * 0.3, u * 0.2]); g.beginPath(); g.arc(s.x, s.y, (s.r || u * 0.62) + u * 0.5, 0, Math.PI * 2); g.stroke(); } g.restore(); }
    scaleInfo();
  }

  // ── 오른쪽 판: 작업지시 · 측정 · 도면
  function sideDraw() {
    var tb = $('jjeTabs'); if (!tb) return; var opened = $('jjeRoot').classList.contains('side-open');
    tb.innerHTML = [['work', '작업지시'], ['take', '물량'], ['meas', '측정'], ['info', '도면']].map(function (p) { return '<button type="button" class="' + (pane === p[0] ? 'on' : '') + '" data-a="pane" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '<button type="button" class="fold" data-a="fold" aria-label="' + (opened ? '접기' : '펴기') + '">' + (opened ? '접기' : '펴기') + '</button>';
    $('jjePaneWork').classList.toggle('on', pane === 'work'); $('jjePaneTake').classList.toggle('on', pane === 'take'); $('jjePaneMeas').classList.toggle('on', pane === 'meas'); $('jjePaneInfo').classList.toggle('on', pane === 'info');
    if (pane === 'take') { takeDraw(); return; }
    if (pane === 'meas') { $('jjePaneMeas').innerHTML = '<div class="jje-h">척도</div><div class="jje-chips"><button type="button" class="jje-chip" data-a="scaleArea">전용면적으로 척도 맞추기</button><button type="button" class="jje-chip" data-a="tool" data-v="scale">두 점으로 척도 잡기</button></div><div class="jje-h">재기</div><div class="jje-chips"><button type="button" class="jje-chip" data-a="tool" data-v="dim">길이 재기</button><button type="button" class="jje-chip" data-a="tool" data-v="wall">벽 사이 재기</button><button type="button" class="jje-chip" data-a="measShow">공간별 넓이·수량 보기</button><button type="button" class="jje-chip ' + (allLen ? 'on' : '') + '" data-a="allLen">모든 방 벽 길이 보기</button></div><div id="jjeMeas" style="margin-top:12px;font-size:15px;line-height:1.7"></div>' +
      '<p class="jje-p">길이 재기는 두 점을 끌면 길이(mm)가 적힙니다. 벽 모서리 가까이에서는 모서리에 붙습니다. 벽 사이 재기는 방 안쪽을 누르면 좌우·위아래 벽 사이를 한 번에 잽니다. 도면의 치수는 어림값이며 현장 실측으로 확정합니다.</p>'; return; }
    if (pane === 'info') { $('jjePaneInfo').innerHTML = '<div class="jje-h">도면 이름</div><input type="text" id="jjeName" maxlength="30" value="' + esc(planName) + '" placeholder="예: 우리 집 84㎡">' +
      '<div class="jje-h">내보내기</div><div class="jje-chips"><button type="button" class="jje-chip" data-a="sheet">작업지시서</button><button type="button" class="jje-chip" data-a="styled">집지니 도면 그림 저장</button><button type="button" class="jje-chip" data-a="png">지금 화면 그대로 그림 저장</button><button type="button" class="jje-chip" data-a="v3d">입체로 보기</button></div>' +
      '<div class="jje-h">정리</div><div class="jje-chips"><button type="button" class="jje-chip" data-a="clear">작업 기호·표시 모두 지우기</button><button type="button" class="jje-chip" data-a="restart" style="color:#b4232a">다른 도면으로 처음부터</button></div>' +
      '<p class="jje-p">도면과 표시는 이 기기(브라우저)에만 저장됩니다. 서버로 보내지 않습니다.</p>'; return; }
    if (tool === 'guide') { $('jjePaneWork').innerHTML = '<div id="jjeProp"></div>' + guidePane(); propDraw(); return; }
    var syms = Object.keys(SYMS).filter(function (k) { return SYMS[k][0] === wk.trade; }), cur = SYMS[wk.k] || [], on = tool === 'wk', nX = on && cur[2] === 'p' ? gCross().length : 0;
    $('jjePaneWork').innerHTML = '<div id="jjeProp"></div>' +
      '<div class="jje-h">공종 — 공사 순서</div><div class="jje-chips">' + TRADES.map(function (t, i) { return '<button type="button" class="jje-chip ' + (wk.trade === t[0] ? 'on' : '') + (hide[t[0]] ? ' off' : '') + '" data-a="trade" data-v="' + t[0] + '"><i style="background:' + t[1] + '"></i>' + (i + 1) + ' ' + t[0] + '</button>'; }).join('') + '</div>' +
      '<label class="jje-ck" style="margin-top:6px"><input type="checkbox" id="jjeFocus"' + (focusOn ? ' checked' : '') + '><span>놓는 동안 고른 공종만 진하게 보기</span></label>' +
      '<div class="jje-h">기호 — 고른 뒤 도면에 놓습니다</div><div class="jje-grid">' + syms.map(function (k) { return '<button type="button" class="jje-sym ' + (on && wk.k === k ? 'on' : '') + '" data-a="sym" data-v="' + k + '"><canvas width="80" height="80" data-ic="' + k + '"></canvas><span>' + SYMS[k][1] + '</span></button>'; }).join('') + '</div>' +
      '<div class="jje-h">구분</div><div class="jje-chips">' + ST.map(function (s) { return '<button type="button" class="jje-chip ' + (wk.st === s[0] ? 'on' : '') + '" data-a="st" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      (on && cur[2] === 'p' ? '<div class="jje-row"><label style="width:auto">끌어서 한 줄에</label><input type="number" id="jjeRow" min="1" max="40" value="' + wk.row + '" style="width:76px"><span style="font-size:14.5px;color:#6B6B6B">개 고르게 놓기</span></div>' : '') +
      (on && wk.k === 'core' ? '<div class="jje-h">타공 지름 (mm)</div><div class="jje-chips">' + [50, 65, 75, 100, 125, 150, 200].map(function (d) { return chipB('cdia', d, wk.dia === d, 'Ø' + d); }).join('') + '</div><div class="jje-row"><label style="width:auto">직접 넣기</label><input type="number" id="jjeDia" min="50" max="200" step="5" value="' + wk.dia + '" style="width:90px"><span style="font-size:14.5px;color:#6B6B6B">50~200</span></div><div class="jje-h">타공할 곳</div><div class="jje-chips">' + ['천장', '벽', '바닥'].map(function (t) { return chipB('cat', t, wk.at === t, t); }).join('') + '</div>' : '') +
      (on && MAP && Array.isArray(REQ[wk.k]) && REQ[wk.k].length > 1 ? '<div class="jje-h">의뢰서 항목</div><div class="jje-chips">' + REQ[wk.k].map(function (key, i) { return chipB('rq', key, (rqPick[wk.k] || REQ[wk.k][0]) === key, reqLabel(key)); }).join('') + '</div>' : '') +
      (on ? methPane() : '') +
      (nX ? '<div class="jje-chips" style="margin-top:8px"><button type="button" class="jje-chip" data-a="gFill">기준선이 만나는 곳마다 놓기 (' + nX + '곳)</button></div>' : '') +
      (on && cur[2] === 'a' ? '<div class="jje-chips" style="margin-top:8px"><button type="button" class="jje-chip ' + (wk.whole ? 'on' : '') + '" data-a="whole" data-v="1">공간 통째로</button><button type="button" class="jje-chip ' + (!wk.whole ? 'on' : '') + '" data-a="whole" data-v="0">직접 그리기</button></div>' : '') +
      (on && cur[2] === 'l' ? '<p class="jje-p">벽을 따라 끌어서 긋습니다. 거의 가로·세로이면 반듯하게 맞춥니다.' + (LOOPK.test(wk.k) ? ' 방 안쪽을 한 번 누르면 그 방 둘레 전체에 들어갑니다.' : '') + '</p>' : '') +
      '<div class="jje-h">수량표</div><div id="jjeQty"></div>' +
      '<div class="jje-chips" style="margin-top:12px"><button type="button" class="jje-chip on" data-a="sheet">작업지시서 보기</button><button type="button" class="jje-chip" data-a="copy">글로 복사</button><button type="button" class="jje-chip" data-a="layers">겹쳐 보기</button></div>' +
      '<p class="jje-p">「선택」으로 누르면 옮기기·고치기·지우기를 할 수 있습니다. 방을 누르면 방 이름을 바로 고칩니다. 두 손가락을 벌리거나 마우스 바퀴로 확대합니다.</p>';
    Array.prototype.forEach.call($('jjePaneWork').querySelectorAll('canvas[data-ic]'), function (c) { icon(c, c.getAttribute('data-ic'), wk.st); });
    propDraw(); qtyDraw();
  }
  // 기호 단추·범례에 넣는 작은 그림
  function icon(c, k, st) { var g = c.getContext('2d'), S = SYMS[k], col = st === 'keep' ? '#7b7f86' : st === 'remove' ? '#b4232a' : tradeColor(S[0]), s = c.width; g.clearRect(0, 0, s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s / 26; g.lineCap = 'round';
    if (S[2] === 'p') { g._dash = st === 'move' ? [s * 0.06, s * 0.05] : null; symDraw(g, k, s / 2, s / 2 + (k === 'sw' ? s * 0.08 : k === 'wt' ? s * 0.08 : 0), s * 0.25, 0, 'rgba(255,255,255,0)'); g._dash = null; if (st === 'remove' && k !== 'dmP') { g.lineWidth = s / 18; g.beginPath(); g.moveTo(s * 0.2, s * 0.2); g.lineTo(s * 0.8, s * 0.8); g.moveTo(s * 0.8, s * 0.2); g.lineTo(s * 0.2, s * 0.8); g.stroke(); } }
    else { var u = s / 2.6, q = S[2] === 'l' ? { t: 'wk', k: k, st: st === 'remove' ? 'remove' : 'new', f: 'l', pts: [[s * 0.12, s * 0.5], [s * 0.88, s * 0.5]] } : { t: 'wk', k: k, st: st === 'remove' ? 'remove' : 'new', f: 'a', pts: [[s * 0.16, s * 0.2], [s * 0.84, s * 0.2], [s * 0.84, s * 0.8], [s * 0.16, s * 0.8]] }, keep = [OBS]; OBS = []; iconMode = true; try { drawWk(g, q, u, 0, 0); } finally { iconMode = false; } OBS = keep[0]; } }
  var iconMode = false, label0 = label; label = function () { if (iconMode || mute) return [0, 0]; return label0.apply(null, arguments); };
  function propDraw(focusName) {
    var el = $('jjeProp'); if (!el) return; var s = shapes[sel]; if (!s) { el.innerHTML = ''; return; }
    var row = function (lb, html) { return '<div class="jje-row"><label>' + lb + '</label>' + html + '</div>'; }, inp = function (key, v, ph, type) { return '<input ' + (type ? 'type="' + type + '" ' : 'type="text" ') + 'data-p="' + key + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + (ph || '') + '">'; }, title = '', body = '';
    if (s.t === 'room') { title = '공간 이름 고치기'; body = row('이름', inp('name', s.name)) + '<div class="jje-chips" style="margin-top:8px">' + ['거실', '안방', '방2', '방3', '주방', '욕실1', '욕실2', '현관', '발코니', '드레스룸', '다용도실'].map(function (n) { return '<button type="button" class="jje-chip" data-a="rname" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div>'; }
    else if (s.t === 'win' || s.t === 'door') { title = s.t === 'win' ? '창' : '문'; body = row('이름', inp('name', s.name, s.t === 'win' ? '거실 큰 창' : '안방문')) + row('높이', inp('h', s.h, 'mm', 'number')) + (s.t === 'door' ? '<div class="jje-chips" style="margin-top:8px"><button type="button" class="jje-chip" data-a="flip">여는 쪽 바꾸기</button><button type="button" class="jje-chip" data-a="swap">경첩 쪽 바꾸기</button></div>' : ''); }
    else if (s.t === 'wk') { var S = SYMS[s.k] || ['', '표시']; title = S[0] + ' · ' + S[1]; body = '<div class="jje-chips" style="margin-top:8px">' + ST.map(function (x) { return '<button type="button" class="jje-chip ' + ((s.st || 'new') === x[0] ? 'on' : '') + '" data-a="pst" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' + row('메모', inp('note', s.note, '예: 3구 · 바닥에서 300')) + (s.f === 'p' && (s.k === 'wc' || s.k === 'bs' || s.k === 'doorN' || s.k === 'sw' || s.k === 'wt' || s.k === 'edge' || s.k === 'sash') ? '<div class="jje-chips" style="margin-top:8px"><button type="button" class="jje-chip" data-a="rot">방향 돌리기</button></div>' : '') +
      (function () { if (!MAP) return ''; var cs = reqCandsOf(s), cur = reqKey(s), it = MAP.items[cur], o = ''; if (cs.length > 1) o += '<div class="jje-h" style="margin-top:12px">의뢰서 항목</div><div class="jje-chips">' + cs.map(function (key) { return chipB('prq', key, cur === key, reqLabel(key)); }).join('') + '</div>'; else if (cur) o += '<p class="jje-p">의뢰서 항목: ' + esc(reqLabel(cur)) + '</p>';
        if (s.f === 'l' && it && it.measure === '면적') o += row('높이', inp('hm', s.hm || '', '비우면 ' + (s.k === 'tileW' ? '주방 800 · 그 밖 천장 높이' : '천장 높이'), 'number')); return o; })() +
      (function () { var key = reqKey(s), os = mOpts(s.k, key), o = '', row2 = function (lb, html) { return '<div class="jje-row jje-mrow"><label>' + lb + '</label>' + html + '</div>'; };
        if (os.length) o += '<div class="jje-h" style="margin-top:12px">공법 — 이 자리만</div>' + os.map(function (x) { return mSel('data-pm', x[0], x, mVal(s, x, key)); }).join('');
        if (s.k === 'zen') o += row2('높이 mm', inp('hm', s.hm || '', '비우면 1000', 'number')) + row2('폭 mm', inp('wm', s.wm || '', '비우면 150', 'number'));
        else if (s.k === 'wp') o += row2('벽 올림 mm', inp('hm', s.hm || '', '비우면 1200', 'number'));
        else if (s.k === 'edge') o += row2('높이 mm', inp('hm', s.hm || '', '비우면 천장 높이', 'number'));
        else if (s.k === 'ins') o += row2('두께 T', inp('tk', s.tk || '', '비우면 이보드 23 · 압출 50', 'number'));
        mWarn(s).forEach(function (t) { o += '<p class="jje-p" style="color:#b4232a;margin-top:8px">확인: ' + esc(t) + '</p>'; });
        return o; })() +
      (s.k === 'core' ? row('지름', inp('dia', s.dia || 100, '50~200', 'number')) + '<div class="jje-chips" style="margin-top:8px">' + [50, 75, 100, 125, 150, 200].map(function (d) { return chipB('pdia', d, (s.dia || 100) === d, 'Ø' + d); }).join('') + '</div><div class="jje-chips" style="margin-top:8px">' + ['천장', '벽', '바닥'].map(function (t) { return chipB('pat', t, (s.at || '벽') === t, t); }).join('') + '</div>' : ''); }
    else if (s.t === 'guide') { var gv = s.o === 'v', sg = spanAt(s.x, s.y), gm = mmpp(), gA = sg ? (gv ? sg.L : sg.T) : null, gB = sg ? (gv ? sg.R : sg.B) : null, pv = gv ? s.x : s.y, grow = function (lb, key, px) { return '<div class="jje-row"><label style="width:104px">' + lb + '</label>' + inp(key, Math.round(px * gm / 10) * 10, 'mm', 'number') + '</div>'; }; title = '기준선 · ' + (gv ? '세로' : '가로');
      body = '<div class="jje-chips" style="margin-top:8px">' + gColChips('pgC', s.c || '#d11a2a') + '</div>' + (gm && gA != null && gB != null ? grow(gv ? '왼쪽 벽에서' : '위쪽 벽에서', 'gA', pv - gA) + grow(gv ? '오른쪽 벽에서' : '아래쪽 벽에서', 'gB', gB - pv) + '<p class="jje-p">숫자(mm)를 고치면 줄이 그 자리로 옮겨집니다.</p>' : '<p class="jje-p">' + (gm ? '방 안에 놓인 기준선만 벽에서 띄운 거리를 맞출 수 있습니다.' : '척도가 없어 거리를 맞출 수 없습니다. 「측정」에서 척도를 잡아 주세요.') + '</p>'); }
    else if (s.t === 'text') { title = '글자'; body = row('글자', inp('s', s.s)); }
    else if (s.t === 'dim') { title = '치수'; var mm = mmpp(); body = '<div style="font-size:16px;margin-top:6px">' + (mm ? Math.round(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * mm).toLocaleString('ko-KR') + ' mm' : '척도 없음') + '</div>'; }
    else if (s.t === 'scale') { title = '척도'; body = row('길이', inp('mm', s.mm, 'mm', 'number')); }
    else title = '표시';
    el.innerHTML = '<div class="jje-card"><div style="display:flex;align-items:center;gap:6px"><b style="flex:1;font-size:15.5px">' + esc(title) + '</b><button type="button" class="jje-chip" data-a="dup">복제</button><button type="button" class="jje-chip" data-a="del" style="color:#b4232a">지우기</button></div>' + body + '</div>';
    if (focusName && root.innerWidth > 860) setTimeout(function () { var i = el.querySelector('[data-p=name]'); if (i) { try { i.focus(); i.select(); } catch (e) {} } }, 40);
  }
  function propSet(key, v) { var s = shapes[sel]; if (!s) return;
    if (key === 'gA' || key === 'gB') { var sg = spanAt(s.x, s.y), gm = mmpp(), n0 = Number(v), gv = s.o === 'v'; if (!sg || !gm || v === '' || !(n0 >= 0)) return; var A = gv ? sg.L : sg.T, B = gv ? sg.R : sg.B; if (A == null || B == null) return; var np = key === 'gA' ? A + n0 / gm : B - n0 / gm; if (np <= A || np >= B) return; if (gv) s.x = R2(np); else s.y = R2(np); var ot = EL.querySelector('[data-p=' + (key === 'gA' ? 'gB' : 'gA') + ']'); if (ot) ot.value = Math.round((key === 'gA' ? B - np : np - A) * gm / 10) * 10; redraw(); saveSoon(); return; }
    if (key === 'dia') { var dn = Math.round(Number(v)); if (dn >= 50 && dn <= 200) { s.dia = dn; redraw(); qtyDraw(); saveSoon(); } return; }
    if (key === 'hm' || key === 'wm' || key === 'tk') { var hv = Number(v); if (hv > 0) s[key] = hv; else delete s[key]; redraw(); qtyDraw(); if (pane === 'take') takeDraw(); saveSoon(); return; }
    if (key === 'h' || key === 'mm') { var n = Number(v); if (n > 0) s[key] = n; if (key === 'mm') { baseOk = false; shapes.forEach(function (q) { delete q.a0; }); } } else if (key === 'name') { s.name = String(v).trim().slice(0, 16) || s.name; if (s.t === 'room') s.kind = kindOf(s.name); } else s[key] = String(v).slice(0, 60); redraw(); qtyDraw(); if (s.t === 'room' || s.t === 'win' || key === 'mm') bgSoon(); saveSoon(); }

  // ── 수량표·작업지시서
  function workRows() {
    var mm = mmpp(), N = numbering(), out = [], byNo = {};
    shapes.forEach(function (q, i) { if (q.t !== 'wk') return; var S = SYMS[q.k] || ['표시', '표시', q.f, '?'], cx, cy, qty = 1, unit = '개', c0;
      if (q.f === 'p') { cx = q.x; cy = q.y; } else if (q.f === 'l') { cx = (q.pts[0][0] + q.pts[q.pts.length - 1][0]) / 2; cy = (q.pts[0][1] + q.pts[q.pts.length - 1][1]) / 2; if (q.loop) { c0 = centroid(q.pts.slice(0, -1)); cx = c0[0]; cy = c0[1]; } qty = mm ? R2(lineLen(q.pts) * mm / 1000) : 0; unit = 'm'; }
      else { c0 = centroid(q.pts); cx = c0[0]; cy = c0[1]; qty = mm ? R2(pxArea(q.pts) * mm * mm / 1e6) : 0; unit = '㎡'; }
      var room = roomAt(cx, cy); if (!room) { var bd = U() * 3; rooms().forEach(function (r) { var d = polyD(cx, cy, r.pts, true); if (d < bd) { bd = d; room = r; } }); }
      var st = q.st || 'new', row = { i: i, no: N.nos[i], trade: S[0], cat: catOf(q.k), k: q.k, f: q.f, label: q.k === 'core' ? '타공 Ø' + (q.dia || 100) + ' ' + (q.at || '벽') : S[1], st: st, stLabel: ST.filter(function (x) { return x[0] === st; })[0][1], room: room ? room.name : '', qty: qty, unit: unit, n: 1, note: [mText(q), (function () { if (!mm) return ''; var hh; if (q.f === 'l' && /^(tileW|wallN|art|ins)$/.test(q.k)) { hh = q.hm || (q.k === 'tileW' && room && (room.kind || kindOf(room.name)) === '주방' ? 800 : ceilH); return '높이 ' + hh.toLocaleString('ko-KR') + ' · ' + R2(qty * hh / 1000) + '㎡'; } if (q.k === 'edge') return '높이 ' + (q.hm || ceilH).toLocaleString('ko-KR'); return ''; })(), q.note || ''].filter(Boolean).join(' — '), P: q.f === 'p' ? [[q.x, q.y]] : null };
      if (byNo[row.no]) { var b = byNo[row.no]; b.qty = R2(b.qty + qty); b.n++; if (b.P && row.P) b.P.push(row.P[0]); if (row.note && b.note.indexOf(row.note) < 0) b.note += (b.note ? ', ' : '') + row.note; if (row.room && b.room.split('·').indexOf(row.room) < 0) b.room += (b.room ? '·' : '') + row.room; return; }
      byNo[row.no] = row; out.push(row); });
    out.forEach(function (r) { if (!mm || !r.P || r.P.length < 2) return; var a = r.P[0], z = r.P[r.P.length - 1], d = Math.hypot(z[0] - a[0], z[1] - a[1]) / (r.P.length - 1) * mm; if (d > 50) r.note = [r.note, '간격 ' + (Math.round(d / 10) * 10).toLocaleString('ko-KR') + 'mm'].filter(Boolean).join(' — '); });
    out.sort(function (a, b) { return a.no - b.no; }); return out;
  }
  function workSum(rows) { var m = {}, order = []; rows.forEach(function (r) { var key = r.trade + '|' + r.label + '|' + r.stLabel + '|' + r.unit; if (!m[key]) { m[key] = { trade: r.trade, cat: r.cat, k: r.k, label: r.label, st: r.st, stLabel: r.stLabel, unit: r.unit, qty: 0, n: 0 }; order.push(key); } m[key].qty += r.qty; m[key].n += r.n; }); return order.map(function (k) { m[k].qty = R2(m[k].qty); return m[k]; }); }
  function qtyTx(s) { return s.unit === '개' ? s.qty + '개' : (s.qty ? s.qty + s.unit : s.n + '곳'); }
  function qtyDraw() {
    var el = $('jjeQty'); if (!el) return; var sum = workSum(workRows());
    if (!sum.length) { el.innerHTML = '<p class="jje-p" style="margin:0">아직 놓은 기호가 없습니다. 위에서 공종과 기호를 골라 도면에 놓으면 여기에 개수·길이·면적이 모입니다.</p>'; return; }
    var h = '<table class="jje-qty">'; TRADES.forEach(function (t) { var L = sum.filter(function (s) { return s.trade === t[0]; }); if (!L.length) return; h += '<tr class="tr"><td colspan="2"><i style="display:inline-block;width:4px;height:13px;vertical-align:-2px;margin-right:7px;background:' + t[1] + '"></i>' + t[0] + '</td></tr>'; L.forEach(function (s) { h += '<tr><td>' + esc(s.label) + (s.stLabel !== '신설' ? ' <span style="color:#6B6B6B">' + s.stLabel + '</span>' : '') + '</td><td>' + qtyTx(s) + '</td></tr>'; }); });
    el.innerHTML = h + '</table>' + (mmpp() ? '' : '<p class="jje-p" style="color:#b4232a">척도가 없어 길이·면적은 비어 있습니다. 「측정」에서 척도를 잡아 주세요.</p>');
  }
  function today() { var d = new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function rowQty(r) { return r.unit === '개' ? r.n + '개' : (r.qty ? r.qty + r.unit : ''); }
  // 지시서에 넣을 공종: null = 전체 · 숫자 = 한 공종 · 배열 = 고른 공종들 (2026-11-11 켜고 끄는 단추)
  function ciHas(ci, c) { return ci == null || (Array.isArray(ci) ? ci.indexOf(c) >= 0 : ci === c); }
  function ciName(ci, sep) { return ci == null ? '전체 공종' : (Array.isArray(ci) ? ci : [ci]).map(function (i) { return CATS[i][0] + ' ' + CATS[i][1]; }).join(sep || ' · '); }
  function workText(ci) {
    var rows = workRows().filter(function (r) { return ciHas(ci, r.cat); }), L = ['[집지니 CAD 작업지시] ' + ciName(ci) + ' — ' + planName], last = -1;
    rows.forEach(function (r) { if (r.cat !== last) { last = r.cat; L.push(''); L.push('■ ' + CATS[r.cat][0] + ' ' + CATS[r.cat][1]); } L.push(r.no + '. ' + (r.room ? r.room + ' ' : '') + r.label + ' ' + r.stLabel + ' ' + rowQty(r) + (r.note ? ' — ' + r.note : '')); });
    L.push(''); L.push('합계: ' + workSum(rows).map(function (s) { return s.label + (s.stLabel !== '신설' ? '(' + s.stLabel + ')' : '') + ' ' + qtyTx(s); }).join(' · ')); L.push('※ 번호는 도면의 번호와 같습니다. 치수·위치가 현장과 다르면 현장 기준으로 하되, 바꾸기 전에 먼저 알려 주세요.'); return L.join('\n');
  }
  function copyText(tx) { var done = function () { toast('글로 복사했습니다. 문자나 카카오톡에 붙여 넣으세요.'); }, fb = function () { var ta = doc.createElement('textarea'); ta.value = tx; ta.style.cssText = 'position:fixed;left:-9999px;top:0'; doc.body.appendChild(ta); ta.select(); try { doc.execCommand('copy'); done(); } catch (e) { toast('복사하지 못했습니다.'); } ta.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tx).then(done, fb); else fb(); }
  // 지시서에 넣는 도면 그림: 집지니 도면 바탕 + 그 묶음의 기호(번호). 원본 그림은 쓰지 않는다.
  function sheetImage(ci, cb) {
    var only = function (q) { return q.t !== 'wk' || ciHas(ci, catOf(q.k)); }, xs = [], ys = [], u = U();
    shapes.forEach(function (q) { if (!visible(q) && q.t !== 'room') return; if (q.t === 'wk' && !only(q)) return; if (q.t === 'scale') return; if (q.pts) q.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); if ('x1' in q) { xs.push(q.x1, q.x2); ys.push(q.y1, q.y2); } if ('x' in q && q.t !== 'circle') { xs.push(q.x); ys.push(q.y); } });
    if (baseOk && base.외곽) base.외곽.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    var B = bgSvg({ plain: true, noMark: true, noLabels: false, noDims: false });
    if (B) { xs.push(B.x, B.x + B.w); ys.push(B.y, B.y + B.h); } var m = B ? 0 : D0 * 0.1, x0 = Math.min.apply(null, xs) - m, y0 = Math.min.apply(null, ys) - m, x1 = Math.max.apply(null, xs) + m, y1 = Math.max.apply(null, ys) + m, cw = 1900;
    // 공종 한 가지만 뽑을 때는 그 공종 기호가 놓인 방들만 크게 잡는다 — 욕실처럼 좁은 곳의 번호와 글자가 겹치지 않게 (2026-11-11)
    if (ci != null) { var fx = [], fy = [], add = function (P) { P.forEach(function (p) { fx.push(p[0]); fy.push(p[1]); }); }; shapes.forEach(function (q) { if (q.t !== 'wk' || !ciHas(ci, catOf(q.k)) || !visible(q)) return; if (q.pts) add(q.pts); else add([[q.x, q.y]]); var rm = shapeRoom(q); if (rm) add(rm.pts); });
      if (fx.length) { var pd = D0 * 0.09, a0 = Math.max(x0, Math.min.apply(null, fx) - pd), b0 = Math.max(y0, Math.min.apply(null, fy) - pd), a1 = Math.min(x1, Math.max.apply(null, fx) + pd), b1 = Math.min(y1, Math.max.apply(null, fy) + pd); if ((a1 - a0) * (b1 - b0) < (x1 - x0) * (y1 - y0) * 0.6 && a1 - a0 > D0 * 0.15 && b1 - b0 > D0 * 0.12) { if ((a1 - a0) < (b1 - b0) * 1.2) { var need = (b1 - b0) * 1.2 - (a1 - a0); a0 = Math.max(x0, a0 - need / 2); a1 = Math.min(x1, a1 + need / 2); } x0 = a0; y0 = b0; x1 = a1; y1 = b1; } } }
    var k = cw / (x1 - x0), c = doc.createElement('canvas'); c.width = cw; c.height = Math.round((y1 - y0) * k);
    var g = c.getContext('2d'), fin = function (img) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k); if (img) { try { g.drawImage(img, B.x, B.y, B.w, B.h); } catch (e) {} } var keepSel = sel, keepBg = bgOn; sheetMode = true; sel = -1; bgOn = !!img; try { paint(g, only, true); } finally { sheetMode = false; sel = keepSel; bgOn = keepBg; } var url = ''; try { url = c.toDataURL('image/png'); } catch (e) { url = ''; } cb(url, c.width, c.height); };
    if (!B) { fin(null); return; } var s = B.svg.replace('fill="#f7f4ee"/>', 'fill="#ffffff"/>').replace('background:#f7f4ee', 'background:#ffffff');
    var im = new Image(); im.onload = function () { fin(im); }; im.onerror = function () { fin(null); }; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function legendIcons(rows) { var seen = {}, out = []; rows.forEach(function (r) { if (seen[r.k]) return; seen[r.k] = 1; var c = doc.createElement('canvas'); c.width = 66; c.height = 66; icon(c, r.k, 'new'); var u = ''; try { u = c.toDataURL('image/png'); } catch (e) {} out.push({ k: r.k, label: (SYMS[r.k] || [0, r.label])[1], url: u }); }); return out; }
  var SH = null;
  function sheet(ci, done) {
    var all = workRows(); if (!all.length) { toast('놓은 작업 기호가 없습니다. 「작업지시」에서 기호를 골라 도면에 놓아 주세요.'); return; }
    if (Array.isArray(ci)) { ci = ci.filter(function (i) { return all.some(function (r) { return r.cat === i; }); }).sort(function (a, b) { return a - b; }); if (!ci.length) ci = null; } else if (ci != null && !all.some(function (r) { return r.cat === ci; })) ci = null;
    var cats = CATS.map(function (c, i) { return i; }).filter(function (i) { return all.some(function (r) { return r.cat === i; }); }), rows = all.filter(function (r) { return ciHas(ci, r.cat); }), sum = workSum(rows), mm = mmpp(), notes = shapes.filter(function (q) { return q.t === 'text' && q.s; });
    var box = $('jjeSheet'); if (!box) { box = doc.createElement('div'); box.id = 'jjeSheet'; doc.body.appendChild(box); box.addEventListener('click', function (ev) { var b = ev.target.closest('[data-s]'); if (!b) return; var a = b.getAttribute('data-s'), v = b.getAttribute('data-v'); if (a === 'tab') { if (v === '') { sheet(null); return; } var now = SH && SH.ci != null ? (Array.isArray(SH.ci) ? SH.ci.slice() : [SH.ci]) : [], n = Number(v), at = now.indexOf(n); if (at >= 0) now.splice(at, 1); else now.push(n); sheet(now.length ? now : null); } else if (a === 'close') { box.remove(); SH = null; } else if (a === 'print') sheetPrint(); else if (a === 'printAll') sheetPrintAll(); else if (a === 'png') sheetPng(); else if (a === 'copy') copyText(workText(SH ? SH.ci : null)); }); }
    var ttl = ciName(ci); if (Array.isArray(ci) && ci.length === cats.length) { ci = null; ttl = ciName(null); }
    box.innerHTML = '<div class="jjs-bar"><button type="button" class="jje-b ' + (ci == null ? 'dark' : '') + '" data-s="tab" data-v="">전체</button>' + cats.map(function (i) { return '<button type="button" class="jje-b ' + (ci != null && ciHas(ci, i) ? 'dark' : '') + '" data-s="tab" data-v="' + i + '">' + CATS[i][1] + '</button>'; }).join('') + '<span class="sp"></span><button type="button" class="jje-b dark" data-s="print">인쇄</button>' + (cats.length > 1 ? '<button type="button" class="jje-b" data-s="printAll">공종별로 나눠 인쇄</button>' : '') + '<button type="button" class="jje-b" data-s="png">그림으로 저장</button><button type="button" class="jje-b" data-s="copy">글로 복사</button><button type="button" class="jje-b" data-s="close">닫기</button></div><div class="jjsheet" id="jjeSheetIn"><p style="padding:30px 0;text-align:center">집지니가 작업지시서를 만들고 있습니다…</p></div>';
    sheetImage(ci, function (url, iw, ih) {
      var lg = legendIcons(rows), h = '';
      if (ci == null && rows.length > 20 && cats.length > 1) h += '<p class="nop" style="margin:0 0 10px;font-size:14.5px;color:#b4232a">지시가 ' + rows.length + '건이라 한 장에서는 그림이 겹칩니다. 위의 공종 단추를 눌러 필요한 공종만 켜거나, 「공종별로 나눠 인쇄」로 공종마다 한 장씩 뽑으세요.</p>';
      h += '<div class="tb"><div class="ti"><h2>작업지시서</h2><div class="s">' + esc(planName) + ' · ' + esc(ttl) + '</div></div><dl><dt>작성일</dt><dd>' + today() + '</dd><dt>공종</dt><dd>' + esc(ttl) + '</dd><dt>지시</dt><dd>' + rows.length + '건</dd><dt>도면</dt><dd>집지니 CAD · 축척 없음' + (mm ? ' (치수 단위 mm)' : '') + '</dd></dl></div>';
      if (url) h += '<img class="dw" src="' + url + '" alt="공사 계획 도면">';
      h += '<div class="lg"><b>범례</b>' + lg.map(function (x) { return '<span>' + (x.url ? '<img src="' + x.url + '" alt="">' : '') + esc(x.label) + '</span>'; }).join('') + '<span style="color:#555">회색 = 유지 · 점선과 화살표 = 이설 · 붉은 가위표 = 철거 · 번호 = 아래 지시 목록의 번호' + (shapes.some(function (q) { return q.t === 'guide' && visible(q); }) ? ' · 일점쇄선 = 기준선(숫자는 가까운 벽에서 띄운 거리 mm)' : '') + '</span></div>';
      h += '<h3>수량표</h3><table><tr><th style="width:120px">공종</th><th>항목</th><th class="c" style="width:60px">구분</th><th class="r" style="width:90px">수량</th><th class="c" style="width:50px">단위</th></tr>';
      CATS.forEach(function (c, i) { var L = sum.filter(function (s) { return s.cat === i; }); L.forEach(function (s, j) { h += '<tr>' + (j ? '' : '<td rowspan="' + L.length + '"><b>' + c[0] + ' ' + c[1] + '</b></td>') + '<td>' + esc(s.label) + '</td><td class="c">' + s.stLabel + '</td><td class="r">' + (s.unit === '개' ? s.qty : (s.qty || '—')) + '</td><td class="c">' + s.unit + '</td></tr>'; }); });
      h += '</table>' + (mm ? '' : '<div class="ft">척도가 없어 길이·면적 수량은 비어 있습니다.</div>');
      h += '<h3>공종별 지시 목록</h3>';
      CATS.forEach(function (c, i) { var L = rows.filter(function (r) { return r.cat === i; }); if (!L.length) return;
        h += '<div class="grp"><h4>' + c[0] + ' ' + c[1] + '</h4><div class="wide"><table><tr><th class="c" style="width:44px">번호</th><th style="width:96px">위치</th><th>항목</th><th class="c" style="width:52px">구분</th><th class="r" style="width:78px">수량</th><th>공법 · 지시 내용</th><th class="c" style="width:44px">확인</th></tr>' + L.map(function (r) { return '<tr><td class="c"><span class="no" style="background:' + tradeColor(r.trade) + '">' + r.no + '</span></td><td>' + esc(r.room) + '</td><td>' + esc(r.label) + '</td><td class="c">' + r.stLabel + '</td><td class="r">' + rowQty(r) + '</td><td>' + esc(r.note) + '</td><td></td></tr>'; }).join('') + '</table></div></div>'; });
      if (ci == null && notes.length) h += '<h4>12 기타 — 도면에 적은 글</h4><table>' + notes.map(function (q) { var rm = roomAt(q.x, q.y); return '<tr><td style="width:96px">' + esc(rm ? rm.name : '') + '</td><td>' + esc(q.s) + '</td></tr>'; }).join('') + '</table>';
      h += '<div class="memo"><b>특이사항</b><div contenteditable="true" id="jjeSheetNote"></div></div>';
      h += '<div class="ft">번호는 도면의 번호와 같습니다. 원본 평면도를 집지니가 읽어 다시 그린 참고용 도면이며, 수량은 도면 기준 어림입니다. 치수·위치가 현장과 다르면 현장 기준으로 하되 바꾸기 전에 먼저 알려 주세요. 자재 주문 전에는 실측으로 확정합니다. · 집지니 CAD jipjini.com/cad.html</div>';
      var inn = $('jjeSheetIn'); if (!inn) return; inn.innerHTML = h; SH = { ci: ci, ttl: ttl, url: url, iw: iw, ih: ih, rows: rows, sum: sum, lg: lg, notes: ci == null ? notes : [] }; if (done) done(h);
    });
  }
  // 공종마다 한 장씩: 공종별 지시서를 차례로 만들어 한 번에 인쇄한다 (2026-11-11)
  function sheetPrintAll() { var all = workRows(), cats = CATS.map(function (c, i) { return i; }).filter(function (i) { return all.some(function (r) { return r.cat === i; }); }), out = [], k = 0, pr = $('cadPrint'); if (!pr) { pr = doc.createElement('div'); pr.id = 'cadPrint'; doc.body.appendChild(pr); }
    var next = function () { if (k >= cats.length) { pr.innerHTML = out.map(function (h, i) { return '<div class="jjsheet"' + (i < out.length - 1 ? ' style="page-break-after:always;break-after:page"' : '') + '>' + h + '</div>'; }).join(''); if (OPT.onEvent) OPT.onEvent('cad_print'); toast('공종 ' + out.length + '장을 인쇄합니다.'); setTimeout(function () { root.print(); }, 200); return; } sheet(cats[k++], function (h) { out.push(h); next(); }); }; next(); }
  function sheetPrint() { var inn = $('jjeSheetIn'), pr = $('cadPrint'); if (!inn) return; if (!pr) { pr = doc.createElement('div'); pr.id = 'cadPrint'; doc.body.appendChild(pr); } pr.innerHTML = '<div class="jjsheet">' + inn.innerHTML + '</div>'; if (OPT.onEvent) OPT.onEvent('cad_print'); setTimeout(function () { root.print(); }, 120); }
  // 지시서 한 장을 그림으로: 화면의 지시서와 같은 내용을 선과 표로 다시 그린다
  function sheetPng() {
    if (!SH) return; var S0 = SH, im = new Image(), noteEl = $('jjeSheetNote'), memo = noteEl ? noteEl.innerText.trim() : '';
    var go = function (img) {
      var Wd = 1600, mg = 56, cw = Wd - mg * 2, c = doc.createElement('canvas'), g, y = 0, pass, LH = 40;
      var cell = function (tx, x, w, yy, al, bold, col) { g.font = (bold ? '700 ' : '400 ') + '22px ' + FONT; g.fillStyle = col || '#1c1c1c'; g.textBaseline = 'middle'; var t = String(tx == null ? '' : tx); while (t.length > 1 && g.measureText(t).width > w - 16) t = t.slice(0, -2) + '…'; g.textAlign = al || 'left'; g.fillText(t, al === 'right' ? x + w - 8 : al === 'center' ? x + w / 2 : x + 8, yy + LH / 2 + 1); },
        tbl = function (cols, head, rws) { var x, draw = function (r, hd) { x = mg; if (hd) { g.fillStyle = '#f0eee8'; g.fillRect(mg, y, cw, LH); } cols.forEach(function (cl, i) { var w = cl[0] * cw; if (pass) { g.strokeStyle = '#777'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, LH); if (r[i] && r[i].no) { g.fillStyle = r[i].col; g.beginPath(); g.arc(x + w / 2, y + LH / 2, 15, 0, Math.PI * 2); g.fill(); g.font = '700 19px ' + FONT; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r[i].no, x + w / 2, y + LH / 2 + 1); } else cell(r[i], x, w, y, hd ? 'center' : cl[1], hd); } x += w; }); y += LH; }; draw(head, true); rws.forEach(function (r) { draw(r); }); },
        bar = function (tx) { y += 26; if (pass) { g.fillStyle = '#1c1c1c'; g.fillRect(mg, y, cw, 42); g.font = '700 23px ' + FONT; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(tx, mg + 12, y + 22); } y += 42; },
        sub = function (tx) { y += 20; if (pass) { g.font = '800 23px ' + FONT; g.fillStyle = '#1c1c1c'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(tx, mg, y + 16); g.fillRect(mg, y + 34, cw, 2); } y += 36; };
      var lay = function () { y = mg;
        if (pass) { g.strokeStyle = '#1c1c1c'; g.lineWidth = 2.5; g.strokeRect(mg, y, cw, 132); g.beginPath(); g.moveTo(mg + cw - 420, y); g.lineTo(mg + cw - 420, y + 132); g.stroke(); g.fillStyle = '#1c1c1c'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '800 44px ' + FONT; g.fillText('작업지시서', mg + 22, y + 66); g.font = '400 24px ' + FONT; g.fillStyle = '#555'; g.fillText(planName + ' · ' + S0.ttl, mg + 22, y + 106);
          [['작성일', today()], ['공종', S0.ttl], ['지시', S0.rows.length + '건'], ['도면', '집지니 CAD · 축척 없음']].forEach(function (r, i) { var yy = y + i * 33, x = mg + cw - 420; g.fillStyle = '#f0eee8'; g.fillRect(x + 1.5, yy + 1, 100, 32); g.strokeStyle = '#1c1c1c'; g.lineWidth = 1; g.beginPath(); if (i) { g.moveTo(x, yy); g.lineTo(x + 420, yy); } g.moveTo(x + 101, yy); g.lineTo(x + 101, yy + 33); g.stroke(); g.textBaseline = 'middle'; g.font = '700 20px ' + FONT; g.fillStyle = '#1c1c1c'; g.textAlign = 'left'; g.fillText(r[0], x + 12, yy + 18); g.font = '400 20px ' + FONT; g.fillText(r[1], x + 114, yy + 18); }); }
        y += 132; if (img) { var ih = Math.round(cw * S0.ih / S0.iw); if (pass) { g.drawImage(img, mg, y, cw, ih); g.strokeStyle = '#1c1c1c'; g.lineWidth = 2.5; g.strokeRect(mg, y, cw, ih); } y += ih; }
        if (pass) { g.strokeStyle = '#1c1c1c'; g.lineWidth = 2.5; g.strokeRect(mg, y, cw, 46); g.font = '400 20px ' + FONT; g.fillStyle = '#555'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('회색 = 유지 · 점선과 화살표 = 이설 · 붉은 가위표 = 철거 · 번호 = 아래 지시 목록의 번호', mg + 14, y + 24); } y += 46;
        bar('수량표'); var qr = []; CATS.forEach(function (ct, i) { S0.sum.filter(function (s) { return s.cat === i; }).forEach(function (s, j) { qr.push([j ? '' : ct[0] + ' ' + ct[1], s.label, s.stLabel, s.unit === '개' ? s.qty : (s.qty || '—'), s.unit]); }); }); tbl([[0.22, 'left'], [0.42, 'left'], [0.12, 'center'], [0.14, 'right'], [0.1, 'center']], ['공종', '항목', '구분', '수량', '단위'], qr);
        bar('공종별 지시 목록'); CATS.forEach(function (ct, i) { var L = S0.rows.filter(function (r) { return r.cat === i; }); if (!L.length) return; sub(ct[0] + ' ' + ct[1]); tbl([[0.06, 'center'], [0.11, 'left'], [0.16, 'left'], [0.08, 'center'], [0.11, 'right'], [0.42, 'left'], [0.06, 'center']], ['번호', '위치', '항목', '구분', '수량', '공법 · 지시 내용', '확인'], L.map(function (r) { return [{ no: String(r.no), col: tradeColor(r.trade) }, r.room, r.label, r.stLabel, rowQty(r), r.note, '']; })); });
        if (S0.notes.length) { sub('12 기타 — 도면에 적은 글'); tbl([[0.2, 'left'], [0.8, 'left']], ['위치', '내용'], S0.notes.map(function (q) { var rm = roomAt(q.x, q.y); return [rm ? rm.name : '', q.s]; })); }
        y += 26; var ml = memo ? memo.split(/\n/).slice(0, 6) : [], mh = Math.max(110, 52 + ml.length * 32); if (pass) { g.strokeStyle = '#777'; g.lineWidth = 1; g.strokeRect(mg + 0.5, y + 0.5, cw, mh); g.font = '700 22px ' + FONT; g.fillStyle = '#1c1c1c'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('특이사항', mg + 12, y + 24); g.font = '400 22px ' + FONT; ml.forEach(function (t, i) { g.fillText(t.slice(0, 70), mg + 12, y + 58 + i * 32); }); } y += mh;
        y += 34; if (pass) { g.font = '400 19px ' + FONT; g.fillStyle = '#555'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('번호는 도면의 번호와 같습니다. 다시 그린 참고용 도면이며 수량은 어림입니다. 현장과 다르면 현장 기준, 자재 주문 전 실측으로 확정합니다.', mg, y); g.fillText('집지니 CAD · jipjini.com/cad.html', mg, y + 30); } y += 30 + mg; };
      pass = 0; g = c.getContext('2d'); lay(); c.width = Wd; c.height = Math.ceil(y); g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); pass = 1; lay();
      var d = new Date(), name = '집지니CAD_작업지시서_' + (S0.ci == null ? '전체' : (Array.isArray(S0.ci) ? S0.ci : [S0.ci]).map(function (i) { return CATS[i][1].replace(/\s*·\s*/g, ''); }).join('+').slice(0, 40)) + '_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.png';
      download(c, name); if (OPT.onEvent) OPT.onEvent('cad_save_png');
    };
    if (S0.url) { im.onload = function () { go(im); }; im.onerror = function () { go(null); }; im.src = S0.url; } else go(null);
  }
  function download(c, name) { var done = function (url) { var a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); if (/^blob:/.test(url)) URL.revokeObjectURL(url); }, 1500); toast('그림으로 저장했습니다. 내려받은 파일을 확인하세요.'); };
    try { if (c.toBlob) c.toBlob(function (b) { b ? done(URL.createObjectURL(b)) : done(c.toDataURL('image/png')); }, 'image/png'); else done(c.toDataURL('image/png')); } catch (e) { toast('그림으로 바꾸지 못했습니다. 「인쇄」를 써 주세요.'); } }
  function pngNow() { sheetImage(null, function (url) { if (!url) { toast('그림으로 만들지 못했습니다.'); return; } var a = doc.createElement('a'); a.href = url; a.download = '집지니CAD_도면_' + planName.replace(/[\\/:*?"<>|\s]+/g, '_') + '.png'; doc.body.appendChild(a); a.click(); a.remove(); toast('그림으로 저장했습니다.'); }); }
  function styledSave() { if (!root.JJPlanStyle) return; var d = bgData(); root.JJPlanStyle.png(d, { title: planName || '평면 구성도', date: today() }, 2200).then(function (u) { var a = doc.createElement('a'); a.href = u; a.download = '집지니_도면_' + planName.replace(/[\\/:*?"<>|\s]+/g, '_') + '.png'; doc.body.appendChild(a); a.click(); a.remove(); toast('집지니 도면을 그림으로 저장했습니다.'); }, function () { toast('저장하지 못했습니다.'); }); }

  // ── 측정
  function measureAll() {
    var mm = mmpp(); if (!mm) return null;
    var rs = rooms().map(function (q) { var m = polyMeasure(q, mm); return { name: q.name, area: R2(m.area), perim: R2(m.perim), height: 2.4, openM2: 0, doorW: 0 }; }), by = {}; rs.forEach(function (r) { by[r.name] = r; });
    var tol = Math.max(6, 400 / mm), wins = [], doors = [];
    shapes.forEach(function (q) { if (q.t !== 'win' && q.t !== 'door') return; var o = { name: q.name || (q.t === 'win' ? '창' : '문'), w_m: Math.round(Math.hypot(q.x2 - q.x1, q.y2 - q.y1) * mm) / 1000, h_m: Math.round(q.h || 0) / 1000 }, mx = (q.x1 + q.x2) / 2, my = (q.y1 + q.y2) / 2, best = null; rooms().forEach(function (r) { var d = polyD(mx, my, r.pts, true); if (!best || d < best.d) best = { d: d, r: r }; });
      if (best && best.d <= tol && by[best.r.name]) { o.room = best.r.name; by[o.room].openM2 += o.w_m * o.h_m; if (q.t === 'door') by[o.room].doorW += o.w_m; } (q.t === 'win' ? wins : doors).push(o); });
    var wallM2 = 0, ceilM2 = 0, baseM = 0, moldM = 0, bathWallM2 = 0, floor = 0;
    rs.forEach(function (r) { floor += r.area; var wall = Math.max(0, r.perim * r.height - r.openM2); if (/욕실|화장실/.test(r.name)) { bathWallM2 += wall; return; } if (/베란다|발코니|다용도|실외기/.test(r.name)) return; wallM2 += wall; ceilM2 += r.area; baseM += Math.max(0, r.perim - r.doorW); moldM += r.perim; });
    return { rooms: rs, windows: wins, doors: doors, floor: R2(floor), wallM2: R2(wallM2), ceilM2: R2(ceilM2), baseM: R2(baseM), moldM: R2(moldM), bathWallM2: R2(bathWallM2) };
  }
  function measShow() { var el = $('jjeMeas'); if (!el) return; var m = measureAll();
    if (!m) { el.innerHTML = '<b>척도가 없습니다.</b> 위의 「전용면적으로 척도 맞추기」를 누르거나, 「두 점으로 척도 잡기」로 길이를 아는 두 점을 눌러 주세요.'; return; }
    el.innerHTML = '<table class="jje-qty"><tr class="tr"><td colspan="2">공간 ' + m.rooms.length + '곳 · 바닥 합 ' + m.floor + '㎡</td></tr>' + m.rooms.map(function (r) { return '<tr><td>' + esc(r.name) + ' <span style="color:#6B6B6B">둘레 ' + r.perim + 'm</span></td><td>' + r.area + '㎡</td></tr>'; }).join('') +
      (m.windows.length ? '<tr class="tr"><td colspan="2">창 ' + m.windows.length + '곳</td></tr>' + m.windows.map(function (w) { return '<tr><td>' + esc(w.name) + (w.room ? ' <span style="color:#6B6B6B">' + esc(w.room) + '</span>' : '') + '</td><td>폭 ' + w.w_m + 'm</td></tr>'; }).join('') : '') + (m.doors.length ? '<tr class="tr"><td colspan="2">문 ' + m.doors.length + '곳</td></tr>' + m.doors.map(function (w) { return '<tr><td>' + esc(w.name) + (w.room ? ' <span style="color:#6B6B6B">' + esc(w.room) + '</span>' : '') + '</td><td>폭 ' + w.w_m + 'm</td></tr>'; }).join('') : '') +
      '<tr class="tr"><td colspan="2">어림 수량 (천장 높이 2.4m 가정)</td></tr><tr><td>도배 벽</td><td>' + m.wallM2 + '㎡</td></tr><tr><td>도배 천장</td><td>' + m.ceilM2 + '㎡</td></tr><tr><td>걸레받이</td><td>' + m.baseM + 'm</td></tr><tr><td>몰딩</td><td>' + m.moldM + 'm</td></tr>' + (m.bathWallM2 ? '<tr><td>욕실 벽 타일</td><td>' + m.bathWallM2 + '㎡</td></tr>' : '') + '</table>'; }
  function scaleByArea(first) { var rs = rooms(); if (!rs.length) { toast('공간이 없습니다.'); return; }
    ask((first ? '이 도면에는 크기 기준이 없습니다. 전용면적을 넣으면 벽 길이를 거꾸로 셈해 넣습니다. ' : '') + '전용면적(㎡) — 등기부등본이나 부동산 앱의 「전용」 숫자. 발코니·다용도실은 합계에서 뺍니다.', '', function (v) { var m2 = Number(String(v).replace(/[^0-9.]/g, '')); if (!(m2 > 0)) { toast('면적 숫자를 넣어 주세요.'); return; }
      var inner = rs.filter(function (q) { return !/베란다|발코니|다용도|실외기/.test(q.name); }), px = inner.reduce(function (s, q) { return s + pxArea(q.pts); }, 0); if (!(px > 0)) { toast('전용 공간(방·거실·욕실 등)이 없습니다.'); return; }
      var mm = Math.sqrt(m2 * 1e6 / px), L = Math.round(1000 / mm), old = shapes.filter(function (q) { return q.t === 'scale'; })[0], xs = [], ys = []; rs.forEach(function (q) { q.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); }); var x0 = old ? old.x1 : Math.min.apply(null, xs), y0 = old ? old.y1 : Math.max.apply(null, ys) + D0 * 0.1;
      snap(); sel = -1; shapes = shapes.filter(function (q) { return q.t !== 'scale'; }); shapes.forEach(function (q) { delete q.a0; }); shapes.push({ t: 'scale', c: '#1d5fd0', x1: Math.round(x0), y1: Math.round(y0), x2: Math.round(x0) + L, y2: Math.round(y0), mm: 1000, by: '면적' }); baseOk = false; allLen = true; touch(); measShow(); var bw = Math.round((Math.max.apply(null, xs) - Math.min.apply(null, xs)) * mm / 10) * 10, bh = Math.round((Math.max.apply(null, ys) - Math.min.apply(null, ys)) * mm / 10) * 10; say('전용면적 ' + m2 + '㎡에서 거꾸로 셈해 벽 길이를 넣었습니다. 집 전체 가로 ' + bw.toLocaleString('ko-KR') + ' × 세로 ' + bh.toLocaleString('ko-KR') + 'mm (어림). 아는 치수가 있으면 「두 점으로 척도 잡기」로 바로잡으세요.'); if (OPT.onEvent) OPT.onEvent('cad_scale_area'); }); }
  // ── 견적 의뢰서로 넘길 묶음 (공간·면적·고른 공사·작업 목록. 그림은 넘기지 않는다)
  function quotePack() {
    var mm = mmpp(), rs = rooms(), inner = 0, R = rs.map(function (q) { var xs = q.pts.map(function (p) { return p[0]; }), ys = q.pts.map(function (p) { return p[1]; }), kd = q.kind || kindOf(q.name), w = 0, d = 0, a = 0;
      if (mm) { w = Math.round((Math.max.apply(null, xs) - Math.min.apply(null, xs)) * mm / 100) / 10; d = Math.round((Math.max.apply(null, ys) - Math.min.apply(null, ys)) * mm / 100) / 10; a = R2(pxArea(q.pts) * mm * mm / 1e6); if (!/베란다|발코니|다용도|실외기/.test(q.name)) inner += a; }
      return [String(q.name).slice(0, 12), kd, w, d, a]; }).slice(0, 24);
    var rows = workRows(), sums = workSum(rows), works = [], lines = [];
    var TW = { '철거': 'demolition', '창호': 'window', '설비': 'plumbing', '전기': 'lighting', '목공': 'carpentry', '타일': 'tile', '도장': 'painting', '도배': 'wallpaper', '바닥': 'flooring', '가구': 'sink' }, addW = function (w) { if (w && works.indexOf(w) < 0) works.push(w); };
    shapes.forEach(function (q) { if (q.t !== 'wk' || q.st === 'keep') return; var S = SYMS[q.k]; if (!S) return; var key = reqKey(q); addW(key ? key.split('.')[0] : TW[S[0]]); });
    Object.keys(chk).forEach(function (key) { if (chk[key]) addW(key.split('.')[0]); });
    TRADES.forEach(function (tt) { var t = tt[0], S = sums.filter(function (s) { return s.trade === t && s.st !== 'keep'; }); if (!S.length) return; lines.push(t + ': ' + S.map(function (s) { return s.label + (s.st !== 'new' ? '(' + s.stLabel + ')' : '') + ' ' + qtyTx(s); }).join(', ')); });
    var text = lines.join('\n'); if (text.length > 700) text = text.slice(0, 690) + ' …(이하 줄임)';
    return { v: 1, n: String(planName).slice(0, 30), a: mm ? Math.round(inner * 10) / 10 : 0, h: ceilH, r: R, w: works, c: rows.length, t: text };
  }
  // ── 입체로 보기 (사이트에 이미 있는 공용 입체 보기 도구를 불러 쓴다)
  var v3 = null;
  function view3d() { if (!rooms().length) return; var m = doc.createElement('div'); m.id = 'jje3d'; m.innerHTML = '<div class="bx"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><b style="font-size:17px;flex:1">입체로 보기</b><button type="button" class="jje-b" data-m="orbit">둘러보기</button><button type="button" class="jje-b" data-m="walk">걸어 보기</button><button type="button" class="jje-b" data-m="top">위에서</button><button type="button" class="jje-b dark" data-m="close">닫기</button></div><div id="jje3dBox" style="min-height:340px;border:1px solid #C8C4BC;background:#f4f1ea"></div></div>'; doc.body.appendChild(m);
    var close = function () { if (v3) { try { v3.destroy(); } catch (e) {} v3 = null; } m.remove(); }; m.addEventListener('click', function (ev) { if (ev.target === m) return close(); var b = ev.target.closest('[data-m]'); if (!b) return; var a = b.getAttribute('data-m'); if (a === 'close') close(); else if (v3) { if (a === 'top') v3.top(); else v3.setMode(a); } });
    var box = $('jje3dBox'), go = function () { try { v3 = root.JJPlan3D.mount(box, { shapes: shapes, mmpp: mmpp() || 0, wallH: 2400 }); } catch (e) { box.innerHTML = '<p style="padding:24px">입체로 보여 주지 못했습니다.</p>'; } };
    if (root.JJPlan3D) go(); else { box.innerHTML = '<p style="padding:24px;color:#6B6B6B">집지니가 입체 보기를 준비하고 있습니다…</p>'; var sc = doc.createElement('script'); sc.src = 'assets/plan3d.js'; sc.onload = function () { box.innerHTML = ''; go(); }; sc.onerror = function () { box.innerHTML = '<p style="padding:24px;color:#b4232a">입체 보기를 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>'; }; doc.head.appendChild(sc); } }

  // ── 단추 눌림 한곳에서 받기
  function onClick(ev) {
    var b = ev.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a'), v = b.getAttribute('data-v'), s = shapes[sel];
    if (a === 'tool') setTool(v);
    else if (a === 'color') { color = v; if (s && /^(circle|arrow|pen|text|rect|poly)$/.test(s.t)) { snap(); s.c = v; touch(); } railDraw(); }
    else if (a === 'undo') undo(); else if (a === 'redo') redo(); else if (a === 'sheet') sheet(null); else if (a === 'copy') { if (!workRows().length) toast('놓은 작업 기호가 없습니다.'); else copyText(workText(null)); }
    else if (a === 'full') { full = !full; applyFull(); if (!full) { try { EL.scrollIntoView({ block: 'start' }); } catch (e) {} } }
    else if (a === 'zoomIn') zoomBy(1.25); else if (a === 'zoomOut') zoomBy(0.8); else if (a === 'fit') fit();
    else if (a === 'layers') layOpen(); else if (a === 'lay') layToggle(v); else if (a === 'layAll') { hide = { 무늬: hide['무늬'] }; nums = true; laySave(); layDraw(); redraw(); sideDraw(); bgApply(); }
    else if (a === 'pane') { pane = v; if (v === 'take' && OPT.onEvent) OPT.onEvent('cad_takeoff_open'); if (root.innerWidth <= 860 && !$('jjeRoot').classList.contains('side-open')) sideOpen(true); else sideDraw(); if (v === 'meas' && mmpp()) measShow(); }
    else if (a === 'fold') sideOpen(!$('jjeRoot').classList.contains('side-open'));
    else if (a === 'trade') { if (hide[v]) { hide[v] = false; laySave(); layDraw(); } wk.trade = v; if ((SYMS[wk.k] || [])[0] !== v) wk.k = Object.keys(SYMS).filter(function (k) { return SYMS[k][0] === v; })[0]; if (v === '철거') wk.st = 'remove'; else if (wk.st === 'remove') wk.st = 'new'; if (tool === 'wk') { tool = 'select'; railDraw(); say(''); } sideDraw(); redraw(); }
    else if (a === 'sym') { wk.k = v; wk.trade = SYMS[v][0]; if (hide[wk.trade]) { hide[wk.trade] = false; laySave(); layDraw(); } if (SYMS[v][0] === '철거') wk.st = 'remove'; setTool('wk'); if (root.innerWidth <= 860) sideOpen(false); }
    else if (a === 'st') { wk.st = v; sideDraw(); }
    else if (a === 'rq') { rqPick[wk.k] = v; sideDraw(); } else if (a === 'prq' && s) { snap(); s.rq = v; touch(); propDraw(); }
    else if (a === 'tkCopy') { if (!takeRows().length) toast('놓은 작업 기호가 없습니다.'); else copyText(takeText()); } else if (a === 'tkQuote') { if (OPT.onEvent) OPT.onEvent('cad_quote_takeoff'); var cq = document.getElementById('cadQuote'); if (cq) { ev.preventDefault(); cq.click(); } }
    else if (a === 'arRoom') { var keepOpen = {}; Array.prototype.forEach.call($('jjePaneTake').querySelectorAll('details'), function (d, i) { keepOpen[i] = d.open; }); var stp = $('jjePaneTake').scrollTop; areaToggle(v, Number(b.getAttribute('data-r'))); Array.prototype.forEach.call($('jjePaneTake').querySelectorAll('details'), function (d, i) { if (keepOpen[i]) d.open = true; }); $('jjePaneTake').scrollTop = stp; }
    else if (a === 'gO') { gd.o = v; sideDraw(); } else if (a === 'gDiv') { gd.div = v === '1'; sideDraw(); say(gd.div ? '기준선: 나눌 방 안쪽을 누르세요.' : HINT.guide); } else if (a === 'gHalf') { gd.half = v === '1'; sideDraw(); } else if (a === 'gC') { gd.c = v; sideDraw(); } else if (a === 'pgC' && s) { snap(); s.c = v; gd.c = v; touch(); propDraw(); }
    else if (a === 'gFill') gFill(); else if (a === 'gClear') { snap(); shapes = shapes.filter(function (q) { return q.t !== 'guide'; }); sel = -1; touch(); sideDraw(); }
    else if (a === 'cdia') { wk.dia = Number(v); sideDraw(); } else if (a === 'cat') { wk.at = v; sideDraw(); }
    else if (a === 'pdia' && s) { snap(); s.dia = Number(v); touch(); propDraw(); } else if (a === 'pat' && s) { snap(); s.at = v; touch(); propDraw(); }
    else if (a === 'whole') { wk.whole = v === '1'; poly = null; sideDraw(); wkHint(); }
    else if (a === 'rname' && s) { snap(); propSet('name', v); propDraw(); }
    else if (a === 'pst' && s) { snap(); s.st = v; touch(); propDraw(); }
    else if (a === 'rot' && s) { snap(); s.rot = ((s.rot || 0) + 90) % 360; touch(); }
    else if (a === 'flip' && s) { snap(); s.flip = !s.flip; touch(); }
    else if (a === 'swap' && s) { snap(); var t = [s.x1, s.y1]; s.x1 = s.x2; s.y1 = s.y2; s.x2 = t[0]; s.y2 = t[1]; s.flip = !s.flip; touch(); }
    else if (a === 'dup') dup(); else if (a === 'del') delSel();
    else if (a === 'scaleArea') scaleByArea(); else if (a === 'allLen') { allLen = !allLen; sideDraw(); redraw(); } else if (a === 'measShow') measShow();
    else if (a === 'styled') styledSave(); else if (a === 'png') pngNow(); else if (a === 'v3d') view3d();
    else if (a === 'clear') { if (!shapes.some(function (q) { return !/^(room|win|door|scale)$/.test(q.t); })) return; if (!root.confirm('작업 기호와 표시를 모두 지울까요? (「되돌리기」로 되살릴 수 있습니다)')) return; snap(); shapes = shapes.filter(function (q) { return /^(room|win|door|scale)$/.test(q.t); }); sel = -1; touch(); propDraw(); }
    else if (a === 'restart') { if (OPT.onRestart) OPT.onRestart(); }
  }
  function onInput(ev) { if (ev.target.id === 'jjeFocus') { focusOn = ev.target.checked; redraw(); return; } var t = ev.target, ma = t.getAttribute && t.getAttribute('data-m'), mp = t.getAttribute && t.getAttribute('data-pm'), ms = shapes[sel];
    if (ma) { if (mdef[ma] !== t.value) { mdef[ma] = t.value; redraw(); qtyDraw(); saveSoon(); } return; }
    if (mp) { if (ms) { if (!(ms.m && ms.m[mp] === t.value)) { snap(); ms.m = ms.m || {}; ms.m[mp] = t.value; touch(); } if (ev.type === 'change') propDraw(); } return; }
    if (t.id === 'jjeCeil') { var cv = Math.round(Number(t.value)); if (cv >= 2000 && cv <= 3500) { ceilH = cv; if (ev.type === 'change') takeDraw(); saveSoon(); } return; } if (t.getAttribute && t.getAttribute('data-chk')) { var ck = t.getAttribute('data-chk'); if (t.checked) chk[ck] = true; else delete chk[ck]; takeDraw(); saveSoon(); return; } if (t.id === 'jjeGNv') gd.nv = gN(t.value); else if (t.id === 'jjeGNh') gd.nh = gN(t.value); else if (t.id === 'jjeGOff') gd.off = t.value; else if (t.id === 'jjeDia') { var dv = Math.round(Number(t.value)); if (dv >= 50 && dv <= 200) wk.dia = dv; } else if (t.id === 'jjeRow') { wk.row = Math.max(1, Math.min(40, Number(t.value) || 1)); if (tool === 'wk') wkHint(); } else if (t.id === 'jjeName') { planName = t.value.trim().slice(0, 30) || '우리 집'; $('jjeNm').textContent = planName; saveSoon(); } else if (t.getAttribute && t.getAttribute('data-p')) propSet(t.getAttribute('data-p'), t.value); }
  function leave() { if (full) { full = false; applyFull(); } var s = $('jjeSheet'); if (s) s.remove(); }

  root.JJCadEditor = { mount: mount, open: open, fromPlan: fromPlan, fromV1: fromV1, getState: getState, quote: quotePack, leave: leave, SYMS: SYMS, TRADES: TRADES, CATS: CATS,
    _test: { shapes: function () { return shapes; }, warn: warnAll, take: takeRows, takeText: takeText, rows: workRows, sum: function () { return workSum(workRows()); }, toClient: function (x, y) { var r = $('jjeCv').getBoundingClientRect(); return [r.left + (x - SX) * r.width / SW, r.top + (y - SY) * r.height / SH]; }, mmpp: mmpp, view: function () { return V; } } };
})(window);
