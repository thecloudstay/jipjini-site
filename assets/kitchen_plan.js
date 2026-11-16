/* 집지니 CAD — 싱크대 설계 (2026-11-14 대표 「싱크대 설계 기능 필요할 것 같던데」)
   CAD에 그린 싱크대 줄(한 줄 · ㄱ자 · ㄷ자)을 받아 모듈을 나누고, 평면·입면 그림과 발주 수량을 낸다.
   기준(국내 주방가구 보통 치수): 하부장 높이 850(상판 포함) · 깊이 600 · 걸레받이 100 · 상부장 높이 700 · 깊이 330 · 바닥에서 상부장 밑 1450
   모듈 폭 300·400·450·600·800·900 · 개수대 하부장 900 · 쿡탑 600 · 식기세척기 600 · 코너장 1000(앞 400만 쓰는 블라인드) · 키큰장 600 · 냉장고 자리 900
   계산만 한다(화면·저장은 cad_editor.js). 모든 길이는 mm. */
(function (root) {
  'use strict';
  var STD = [900, 800, 600, 450, 400, 300];
  var DEF = { fr: 'auto', frW: 900, tall: 0, sinkR: -1, sinkAt: 50, cookR: -1, cookAt: 75, dw: 1, up: 1, upSink: 1, grade: 'a', top: 'solid', demo: 1, depth: 600, baseH: 850, upH: 700, ceil: 2300 };
  function opt(o) { var r = {}; Object.keys(DEF).forEach(function (k) { var v = o && o[k] != null && o[k] !== '' ? o[k] : DEF[k]; r[k] = typeof DEF[k] === 'number' ? Number(v) : v; }); return r; }

  // 남은 길이 g를 표준 폭으로 채운다: 남는 것(필러)을 가장 적게, 같으면 모듈 수를 적게
  function fill(g) {
    var n = Math.floor(g / 50), best = [], bv = [0], i, j;
    for (i = 1; i <= n; i++) { best[i] = null; bv[i] = -1; }
    best[0] = [];
    for (i = 1; i <= n; i++) STD.forEach(function (w) { var s = w / 50; if (s <= i && best[i - s] && (bv[i] < 0 || best[i - s].length + 1 < best[i].length)) { best[i] = best[i - s].concat([w]); bv[i] = 1; } });
    for (j = n; j >= 0; j--) if (best[j]) { var a = best[j].slice().sort(function (x, y) { return y - x; }); return { mods: a, rest: g - j * 50 }; }
    return { mods: [], rest: g };
  }

  // runs: [{len}] 순서대로 이어진 벽 구간(ㄱ자면 2개, ㄷ자면 3개)
  function layout1(runs, o) {
    o = opt(o); var R = runs.map(function (r, i) { return { i: i, len: Math.round(r.len), s: i > 0 ? o.depth : 0, e: Math.round(r.len), fixed: [] }; }), last = R.length - 1, warn = [];
    if (!R.length) return null;
    // 코너: 앞 구간의 끝 1000이 코너장(블라인드). 다음 구간은 깊이 600 만큼 안에서 시작
    R.forEach(function (r, i) { if (i < last) { r.fixed.push({ t: 'corner', a: r.e - 1000, w: 1000 }); r.e -= 1000; } });
    // 50mm 단위가 안 맞는 나머지는 벽 끝 필러로 먼저 떼어 둔다(가운데 30·10mm 같은 필러가 생기지 않게)
    R.forEach(function (r) { var rem = (r.e - r.s) % 50; if (!rem) return; if (r.i === 0) { r.fixed.push({ t: 'filler', a: r.s, w: rem }); r.s += rem; } else { r.fixed.push({ t: 'filler', a: r.e - rem, w: rem }); r.e -= rem; } });
    // 개수대 벽: 고르지 않으면 가장 긴 벽. 냉장고: 고르지 않으면 개수대 벽이 아닌 쪽 끝(일자면 앞)
    var si = o.sinkR >= 0 ? Math.min(last, o.sinkR) : R.reduce(function (b, r) { return r.e - r.s > R[b].e - R[b].s ? r.i : b; }, 0);
    var frSide = o.fr === 'auto' ? (last > 0 && si === 0 ? 'end' : 'start') : o.fr;
    if (frSide !== 'none') { var fr = frSide === 'end' ? R[last] : R[0], tl = Math.max(0, Math.min(3, o.tall));
      while (tl > 0 && fr.e - fr.s < o.frW + 600 * tl + 1200) tl--;
      if (tl < o.tall) warn.push('키큰장 ' + o.tall + '개 중 ' + (o.tall - tl) + '개는 자리가 없어 뺐습니다.');
      if (fr.e - fr.s < o.frW + 600) { warn.push((frSide === 'end' ? R.length : 1) + '번 벽에 냉장고(' + o.frW + ')를 넣을 자리가 없습니다 — 다른 벽이나 다용도실을 고려하세요.'); }
      else { var need = o.frW + 600 * tl;
        if (frSide === 'end') { fr.fixed.push({ t: 'fridge', a: fr.e - o.frW, w: o.frW }); for (var k = 0; k < tl; k++) fr.fixed.push({ t: 'tall', a: fr.e - o.frW - 600 * (k + 1), w: 600 }); fr.e -= need; }
        else { fr.fixed.push({ t: 'fridge', a: fr.s, w: o.frW }); for (var k2 = 0; k2 < tl; k2++) fr.fixed.push({ t: 'tall', a: fr.s + o.frW + 600 * k2, w: 600 }); fr.s += need; } } }
    // 개수대(900) + 식기세척기(600): 고른 구간의 자리(%)에 놓는다
    // 자리 고르기: 고른 위치(%)에 가깝게, 양옆에 필러가 덜 생기게(50mm 단위로 훑음). 벽 끝에 붙은 필러는 덜 나쁘다
    function placeIn(r, w, at, avoid) { var span = r.e - r.s; if (span < w) return null; var c = r.s + span * Math.max(0, Math.min(100, at)) / 100, bx = null, bd = 1e18;
      gaps(r).forEach(function (f) { if (f.e - f.s < w) return; for (var x = f.s; x + w <= f.e; x += 50) { var lg = x - f.s, rg = f.e - x - w, pen = 0;
        [[lg, f.s === r.s && r.i === 0], [rg, f.e === r.e && r.i === last]].forEach(function (g) { var rest = fill(g[0]).rest; if (g[0] > 0 && g[0] < 300) rest = g[1] ? g[0] : 5000; pen += rest * (g[1] ? 2 : 8); });
        if (avoid) r.fixed.forEach(function (m) { if (avoid.indexOf(m.t) >= 0 && (m.a + m.w > x - 300 && m.a < x + w + 300)) pen += 3000; });
        var d = Math.abs(x + w / 2 - c) + pen; if (d < bd) { bd = d; bx = x; } } }); return bx; }
    function gaps(r) { var fx = r.fixed.filter(function (f) { return f.a + f.w > r.s && f.a < r.e; }).sort(function (a, b) { return a.a - b.a; }), out = [], p = r.s; fx.forEach(function (f) { if (f.a > p) out.push({ s: p, e: f.a }); p = Math.max(p, f.a + f.w); }); if (r.e > p) out.push({ s: p, e: r.e }); return out; }
    // 개수대 → 쿡탑 → 식기세척기(개수대 바로 옆에 600이 남을 때) 차례로 놓는다
    var sr = R[si], sx = null, bx = o.dw ? placeIn(sr, 1500, o.sinkAt) : null;
    if (bx != null) { var dwL = bx + 750 > sr.s + (sr.e - sr.s) / 2; sx = dwL ? bx + 600 : bx; sr.fixed.push({ t: 'sink', a: sx, w: 900 }, { t: 'dw', a: dwL ? bx : bx + 900, w: 600 }); }
    else { sx = placeIn(sr, 900, o.sinkAt); if (sx == null) warn.push('개수대(900) 자리가 모자랍니다.'); else sr.fixed.push({ t: 'sink', a: sx, w: 900 }); }
    var ci = o.cookR >= 0 ? Math.min(last, o.cookR) : (last > 0 ? (si === 0 ? 1 : 0) : si), cr = R[ci], cAt = o.cookR >= 0 ? o.cookAt : last === 0 ? (o.sinkAt < 50 ? 85 : 15) : (ci < si ? 70 : 30), cx = placeIn(cr, 600, cAt, ['fridge', 'tall', 'sink']);
    if (cx == null) warn.push('쿡탑(600) 자리가 모자랍니다.'); else cr.fixed.push({ t: 'cook', a: cx, w: 600 });
    if (o.dw && sx != null && bx == null) { var gs = gaps(sr), right = gs.filter(function (g) { return g.s === sx + 900 && g.e - g.s >= 600; })[0], left = gs.filter(function (g) { return g.e === sx && g.e - g.s >= 600; })[0];
      if (right) sr.fixed.push({ t: 'dw', a: sx + 900, w: 600 }); else if (left) sr.fixed.push({ t: 'dw', a: sx - 600, w: 600 }); else warn.push('개수대 바로 옆에 식기세척기(600) 자리가 없습니다.'); }
    if (sx != null && cx != null && sr === cr) { var gapSC = sx < cx ? cx - (sx + 900) : sx - (cx + 600); if (gapSC < 400) warn.push('개수대와 쿡탑 사이 작업대가 ' + Math.max(0, gapSC) + 'mm입니다 — 600 이상이면 쓰기 편합니다.'); }
    // 남은 자리를 표준 모듈로 채우고, 쿡탑 옆 한 칸은 서랍장으로
    var mods = [];
    R.forEach(function (r) { var list = r.fixed.slice();
      gaps(r).forEach(function (g) { var f = fill(g.e - g.s), x = g.s, atWall = (g.s === r.s && r.i === 0) || (g.e === r.e && r.i === last);
        var fillerFirst = f.rest > 0 && g.s === r.s; if (fillerFirst) { list.push({ t: 'filler', a: x, w: f.rest }); x += f.rest; }
        f.mods.forEach(function (w) { list.push({ t: 'base', a: x, w: w }); x += w; });
        if (f.rest > 0 && !fillerFirst) list.push({ t: 'filler', a: x, w: f.rest });
        if (f.rest > 0 && !atWall && f.rest >= 150) warn.push(r.i + 1 + '번 벽에 ' + f.rest + 'mm 필러가 생깁니다 — 모듈 폭을 주문 제작하면 없앨 수 있습니다.'); });
      list.sort(function (a, b) { return a.a - b.a; });
      var ck = list.filter(function (m) { return m.t === 'cook'; })[0];
      if (ck) { var nb = list.filter(function (m) { return m.t === 'base' && m.w >= 400 && m.w <= 600 && (m.a + m.w === ck.a || m.a === ck.a + ck.w); })[0]; if (nb) nb.t = 'drawer'; }
      list.forEach(function (m) { m.run = r.i; mods.push(m); }); });
    if (!mods.some(function (m) { return m.t === 'drawer'; })) { var b6 = mods.filter(function (m) { return m.t === 'base' && m.w >= 400 && m.w <= 600; })[0]; if (b6) b6.t = 'drawer'; }
    // 상부장: 하부장 위를 따라(냉장고·키큰장 제외), 쿡탑 위는 후드, 개수대 위는 창이 있으면 비움
    var ups = [];
    mods.forEach(function (m) { if (m.t === 'fridge') { ups.push({ t: 'frup', a: m.a, w: m.w, run: m.run }); return; } if (m.t === 'tall' || !o.up) return;
      if (m.t === 'cook') { ups.push({ t: 'hood', a: m.a, w: m.w, run: m.run }); return; } if (m.t === 'sink' && !o.upSink) return; if (m.t === 'filler') { ups.push({ t: 'ufill', a: m.a, w: m.w, run: m.run }); return; }
      ups.push({ t: m.t === 'corner' ? 'ucorner' : 'upper', a: m.a, w: m.t === 'corner' ? 1000 : m.w, run: m.run }); });
    var no = 0; mods.forEach(function (m) { m.no = m.t === 'filler' ? '' : ++no; }); var un = 0; ups.forEach(function (m) { m.no = m.t === 'ufill' ? '' : 'U' + (++un); });
    // 2026-11-16 쿡탑이 냉장고·키큰장에 바로 붙으면(사이 300 미만) 열·동선이 나쁘다 — 알리고, layout() 이 다른 자리를 찾아 본다
    var ckm = mods.filter(function (m) { return m.t === 'cook'; })[0], adj = !!ckm && mods.some(function (m) { return (m.t === 'fridge' || m.t === 'tall') && m.run === ckm.run && (Math.abs(m.a - (ckm.a + ckm.w)) < 300 || Math.abs(ckm.a - (m.a + m.w)) < 300); });
    if (adj) warn.push('쿡탑이 냉장고 바로 옆입니다 — 사이에 조리대를 300 이상 두면 열과 동선이 편합니다.');
    return { o: o, runs: R.map(function (r) { return { i: r.i, len: r.len }; }), base: mods, upper: ups, warn: warn, info: [], flag: { cookFridge: adj, cook: !!ckm }, bom: bom(mods, ups, o, R) };
  }
  // 손으로 고르지 않은 것(쿡탑 벽·개수대 자리)을 바꿔 가며 가장 나은 배치를 고른다: 쿡탑이 꼭 들어가게, 냉장고 옆은 피하게, 경고가 적게.
  // 그래도 쿡탑 자리가 없으면 식기세척기를 빼 본다(뺐다고 알린다).
  function layout(runs, o) {
    var raw = o || {}, r = layout1(runs, raw); if (!r) return r;
    var score = function (t, pen) { return (t.flag.cook ? 0 : 100) + (t.flag.cookFridge ? 10 : 0) + t.warn.length + pen; };
    if (!r.flag.cook || r.flag.cookFridge) {
      var pickedCook = raw.cookR != null && raw.cookR !== '' && Number(raw.cookR) >= 0, pickedAt = raw.sinkAt != null && raw.sinkAt !== '', dwOn = opt(raw).dw ? 1 : 0;
      var best = r, bs = score(r, 0), note = '', cooks = pickedCook ? [Number(raw.cookR)] : runs.map(function (_, i) { return i; }), ats = pickedAt ? [raw.sinkAt] : [20, 80, 50];
      (dwOn ? [1, 0] : [0]).forEach(function (dw) { cooks.forEach(function (ci) { ats.forEach(function (at) {
        var o2 = {}; Object.keys(raw).forEach(function (k) { o2[k] = raw[k]; }); o2.cookR = ci; o2.sinkAt = at; o2.dw = dw; if (!pickedCook) o2.cookAt = Number(at) < 50 ? 85 : 15;
        var t = layout1(runs, o2), sc = t ? score(t, dw === dwOn ? 0 : 3) : 1e9;
        if (sc < bs) { best = t; bs = sc; note = (!r.flag.cook ? '쿡탑 자리를 내려고 ' : '쿡탑이 냉장고 옆에 붙지 않게 ') + (dw === dwOn ? '개수대와 쿡탑 자리를 옮겼습니다.' : '식기세척기를 뺐습니다 — 벽이 600 더 길면 넣을 수 있습니다.'); } }); }); });
      if (best !== r) { best.info.push(note); r = best; } }
    return r;
  }

  // ── 어림 금액 (2026-11-16, 부가세 10% 별도) ──
  // 근거: 집지니 실견적 — 사제 싱크대(E0 몸통·PET 문짝·인조대리석 12T·설치) m당 80만 원(용인·수원), 30평대 ㄱ자 395만 원(안양·남동).
  //       m당 80만을 하부(상판·설치 포함) 55만 + 상부 25만으로 나눴다. 상판 올림은 업계 공개가(인조대리석 m당 40만·엔지니어드스톤 70만·세라믹 100만)의 차이.
  //       등급 배수는 공개 시세(브랜드 2.4~3m 100만~800만) 범위 안에서 잡은 어림값 — 실제 금액은 가구 업체 견적으로 확정.
  var PRICE = { base: 550000, upper: 250000, tallK: 1.3, hood: 250000, demo: 200000,
    grade: { a: [1, '실속', '사제 · PET 문짝 · E0 몸통'], b: [1.4, '중간', '브랜드 보급형 수준'], c: [2, '고급', '브랜드 상위 · 도장 문짝'] },
    top: { solid: [0, '인조대리석'], quartz: [300000, '엔지니어드스톤'], ceramic: [600000, '세라믹'] } };
  function cost(L, po) {
    po = po || {}; var g = PRICE.grade[po.grade || L.o.grade] ? (po.grade || L.o.grade) : 'a', tp = PRICE.top[po.top || L.o.top] ? (po.top || L.o.top) : 'solid', demo = po.demo != null ? Number(po.demo) : Number(L.o.demo), b = L.bom;
    var upM = L.upper.filter(function (u) { return u.t === 'upper' || u.t === 'ucorner' || u.t === 'frup'; }).reduce(function (a, u) { return a + u.w; }, 0) / 1000, tall = L.base.filter(function (m) { return m.t === 'tall'; }).length;
    function calc(gk) { var k = PRICE.grade[gk][0], rows = [], won = function (v) { return Math.round(v / 10000) * 10000; };
      rows.push(['하부장 · 상판(인조대리석) · 설치', b.하부장_m + ' m', won(b.하부장_m * PRICE.base * k)]);
      if (upM > 0) rows.push(['상부장', Math.round(upM * 100) / 100 + ' m', won(upM * PRICE.upper * k)]);
      if (tall) rows.push(['키큰장', tall + '개', won(tall * 0.6 * (PRICE.base + PRICE.upper) * PRICE.tallK * k)]);
      if (PRICE.top[tp][0]) rows.push(['상판을 ' + PRICE.top[tp][1] + '(으)로', b.상판_m + ' m', won(b.상판_m * PRICE.top[tp][0])]);
      if (b.후드) rows.push(['후드', b.후드 + '대', PRICE.hood * b.후드]);
      if (demo) rows.push(['기존 싱크대 철거 · 폐기', '1식', PRICE.demo]);
      return { rows: rows, total: rows.reduce(function (a, x) { return a + x[2]; }, 0) }; }
    var cur = calc(g);
    return { grade: g, top: tp, rows: cur.rows, total: cur.total, tiers: ['a', 'b', 'c'].map(function (k) { return { k: k, 이름: PRICE.grade[k][1], 설명: PRICE.grade[k][2], total: calc(k).total }; }), 상판이름: PRICE.top[tp][1],
      근거: '집지니 실견적(사제 싱크대 m당 80만 원 · 30평대 ㄱ자 395만 원)과 2026년 공개 시세로 잡은 어림값입니다. 부가세 10% 별도. 냉장고 · 식기세척기 · 쿡탑 본체는 들어 있지 않습니다.' };
  }

  var NAME = { base: '하부장', drawer: '서랍장(3단)', sink: '개수대 하부장', dw: '식기세척기 자리', cook: '쿡탑 하부장(서랍 2단)', corner: '코너장(블라인드)', fridge: '냉장고 자리', tall: '키큰장', filler: '필러', upper: '상부장', ucorner: '코너 상부장', hood: '후드 자리', frup: '냉장고 상부장', ufill: '상부 필러' };
  function doorsOf(m) { if (m.t === 'base' || m.t === 'upper' || m.t === 'sink') return m.w >= 600 ? 2 : 1; if (m.t === 'corner' || m.t === 'ucorner') return 1; if (m.t === 'tall') return 2; if (m.t === 'frup') return m.w >= 600 ? 2 : 1; return 0; }
  function drawersOf(m) { return m.t === 'drawer' ? 3 : m.t === 'cook' ? 2 : 0; }
  function bom(mods, ups, o, R) {
    var top = 0, kick = 0, d = 0, dr = 0, hinge = 0, by = {};
    mods.forEach(function (m) { if (m.t !== 'fridge' && m.t !== 'tall') { top += m.w; kick += m.w; } var n = doorsOf(m); d += n; hinge += n * (m.t === 'tall' ? 4 : 2); dr += drawersOf(m); });
    ups.forEach(function (m) { var n = doorsOf(m); d += n; hinge += n * 2; });
    function add(t, w) { var k = NAME[t] + (t === 'dw' || t === 'fridge' || t === 'hood' ? '' : ' ' + w); by[k] = by[k] || { 품목: NAME[t], 폭: w, 개수: 0, 구분: /^(upper|ucorner|frup|hood|ufill)$/.test(t) ? '상부' : t === 'tall' || t === 'fridge' ? '키큰' : '하부' }; by[k].개수++; }
    mods.forEach(function (m) { add(m.t, m.w); }); ups.forEach(function (m) { add(m.t, m.w); });
    var topM = top / 1000, seams = R.length - 1 + R.filter(function (r) { return r.len > 3000; }).length;
    return { 상판_m: Math.round(topM * 100) / 100, 상판_m2: Math.round(topM * o.depth / 1000 * 100) / 100, 상판_이음: seams, 걸레받이_m: Math.round(kick / 10) / 100, 하부장_m: Math.round(top / 10) / 100,
      상부장_m: Math.round(ups.filter(function (u) { return u.t === 'upper' || u.t === 'ucorner'; }).reduce(function (a, u) { return a + u.w; }, 0) / 10) / 100,
      문짝: d, 서랍: dr, 경첩: hinge, 서랍레일: dr, 손잡이: d + dr, 개수대볼: mods.some(function (m) { return m.t === 'sink'; }) ? 1 : 0, 수전: 1, 후드: ups.some(function (u) { return u.t === 'hood'; }) ? 1 : 0, 목록: Object.keys(by).map(function (k) { return by[k]; }) };
  }

  // ── 그림: 평면(위에서) · 입면(앞에서). geo: [{x,y,ux,uy,nx,ny}] 구간마다 시작점(mm)과 벽 방향·안쪽 방향 ──
  var INK = '#1C1F1B', PEN = '#6B7067', RULE = '#DCDFD8', GRN = '#1F5E2E';
  var FILL = { sink: '#E6EFE8', cook: '#F3E9DA', dw: '#EEF0F2', corner: '#F1F1EE', fridge: '#FFFFFF', tall: '#F6F6F3', filler: '#FAFAF8', drawer: '#FFFFFF', base: '#FFFFFF' };
  function planSvg(L, geo) {
    var pts = [], rects = [];
    L.base.forEach(function (m) { var g = geo[m.run]; if (!g) return; var d = m.t === 'fridge' || m.t === 'tall' ? 650 : L.o.depth, p = function (a, b) { return [g.x + g.ux * a + g.nx * b, g.y + g.uy * a + g.ny * b]; }, q = [p(m.a, 0), p(m.a + m.w, 0), p(m.a + m.w, d), p(m.a, d)]; q.forEach(function (x) { pts.push(x); }); rects.push({ m: m, q: q, c: p(m.a + m.w / 2, m.t === 'cook' ? d * 0.33 : d / 2), lc: m.t === 'cook' ? p(m.a + m.w / 2, d * 0.84) : null }); });
    geo.forEach(function (g, i) { var len = L.runs[i].len; pts.push([g.x, g.y], [g.x + g.ux * len, g.y + g.uy * len]); });
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), x0 = Math.min.apply(null, xs) - 1100, y0 = Math.min.apply(null, ys) - 500, w = Math.max.apply(null, xs) + 1100 - x0, h = Math.max.apply(null, ys) + 500 - y0, fs = Math.max(90, Math.min(w, h) / 22);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [x0, y0, w, h].map(Math.round).join(' ') + '" style="width:100%;max-height:420px;font-family:inherit">';
    geo.forEach(function (g, i) { var len = L.runs[i].len; s += '<line x1="' + g.x + '" y1="' + g.y + '" x2="' + (g.x + g.ux * len) + '" y2="' + (g.y + g.uy * len) + '" stroke="' + INK + '" stroke-width="' + fs * 0.9 + '" stroke-linecap="square"/>'; var mx = g.x + g.ux * len / 2 - g.nx * fs * 1.8, my = g.y + g.uy * len / 2 - g.ny * fs * 1.8, an = -g.nx > 0.5 ? 'start' : -g.nx < -0.5 ? 'end' : 'middle'; s += '<text x="' + mx + '" y="' + my + '" font-size="' + fs * 0.95 + '" fill="' + PEN + '" text-anchor="' + an + '" dominant-baseline="middle">' + (i + 1) + '번 벽 ' + len.toLocaleString('ko-KR') + '</text>'; });
    rects.forEach(function (r) { var m = r.m; s += '<polygon points="' + r.q.map(function (p) { return p.join(','); }).join(' ') + '" fill="' + (FILL[m.t] || '#fff') + '" stroke="' + INK + '" stroke-width="' + fs * 0.12 + '"' + (m.t === 'fridge' || m.t === 'dw' ? ' stroke-dasharray="' + fs * 0.5 + ' ' + fs * 0.3 + '"' : '') + '/>';
      if (m.t === 'sink') { var g = geo[m.run], c = r.c; s += '<rect x="' + (c[0] - 330) + '" y="' + (c[1] - 210) + '" width="660" height="420" rx="60" fill="none" stroke="' + GRN + '" stroke-width="' + fs * 0.14 + '" transform="rotate(' + (Math.atan2(g.uy, g.ux) * 180 / Math.PI) + ' ' + c[0] + ' ' + c[1] + ')"/>'; }
      if (m.t === 'cook') [[-95, -95], [95, -95], [-95, 95], [95, 95]].forEach(function (o) { s += '<circle cx="' + (r.c[0] + o[0]) + '" cy="' + (r.c[1] + o[1]) + '" r="65" fill="none" stroke="' + INK + '" stroke-width="' + fs * 0.1 + '"/>'; });
      if (m.t === 'corner') { var gc = geo[m.run], cp = function (a, b) { return (gc.x + gc.ux * a + gc.nx * b) + ',' + (gc.y + gc.uy * a + gc.ny * b); }; s += '<polyline points="' + cp(m.a + 400, 0) + ' ' + cp(m.a + 400, L.o.depth) + '" fill="none" stroke="' + PEN + '" stroke-width="' + fs * 0.08 + '" stroke-dasharray="' + fs * 0.4 + ' ' + fs * 0.3 + '"/>'; }
      if (m.t !== 'filler') s += '<text x="' + (r.lc || r.c)[0] + '" y="' + (r.lc || r.c)[1] + '" font-size="' + fs + '" font-weight="600" fill="' + INK + '" text-anchor="middle" dominant-baseline="middle">' + m.no + '</text>'; });
    return s + '</svg>';
  }
  function elevSvg(L, run) {
    var o = L.o, len = L.runs[run].len, B = L.base.filter(function (m) { return m.run === run; }), U = L.upper.filter(function (m) { return m.run === run; }), top = o.ceil, W = len + 500, fs = Math.max(110, W / 34), Y = function (v) { return top - v; };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + Math.round(-fs * 6.4) + ' -150 ' + Math.round(len + fs * 6.4 + 250) + ' ' + (top + 800) + '" style="width:100%;max-height:340px;font-family:inherit">';
    s += '<rect x="0" y="0" width="' + len + '" height="' + top + '" fill="#FBFBF9" stroke="' + RULE + '" stroke-width="' + fs * 0.1 + '"/>';
    var upY0 = 1450, upY1 = Math.min(top - 50, upY0 + o.upH);
    function door(x, y0, y1, w, n, col) { var o2 = ''; for (var i = 0; i < n; i++) { var dx = x + w * i / n; o2 += '<rect x="' + (dx + 6) + '" y="' + Y(y1) + '" width="' + (w / n - 12) + '" height="' + (y1 - y0) + '" fill="' + col + '" stroke="' + INK + '" stroke-width="' + fs * 0.08 + '"/>'; } return o2; }
    if (run > 0) { s += '<rect x="0" y="' + Y(o.baseH) + '" width="' + o.depth + '" height="' + o.baseH + '" fill="#EDEDE8" stroke="' + PEN + '" stroke-width="' + fs * 0.06 + '"/>' + (o.up ? '<rect x="0" y="' + Y(upY1) + '" width="330" height="' + (upY1 - upY0) + '" fill="#EDEDE8" stroke="' + PEN + '" stroke-width="' + fs * 0.06 + '"/>' : '') + '<text x="' + o.depth / 2 + '" y="' + Y(o.baseH / 2) + '" font-size="' + fs * 0.7 + '" fill="' + PEN + '" text-anchor="middle" dominant-baseline="middle">옆 벽</text>'; }
    B.forEach(function (m) { var x = m.a, w = m.w, c = FILL[m.t] || '#fff';
      if (m.t === 'fridge') { s += '<rect x="' + x + '" y="' + Y(Math.min(top - 400, 1850)) + '" width="' + w + '" height="' + Math.min(top - 400, 1850) + '" fill="#fff" stroke="' + PEN + '" stroke-dasharray="' + fs * 0.6 + ' ' + fs * 0.4 + '" stroke-width="' + fs * 0.08 + '"/><text x="' + (x + w / 2) + '" y="' + Y(1000) + '" font-size="' + fs + '" fill="' + PEN + '" text-anchor="middle">냉장고</text>'; return; }
      if (m.t === 'tall') { s += door(x, 100, top - 50, w, 1, c) + door(x, 100, 1250, w, 1, c); }
      else if (m.t === 'dw') { s += '<rect x="' + (x + 6) + '" y="' + Y(o.baseH - 30) + '" width="' + (w - 12) + '" height="' + (o.baseH - 130) + '" fill="#EEF0F2" stroke="' + INK + '" stroke-width="' + fs * 0.08 + '"/><text x="' + (x + w / 2) + '" y="' + Y(450) + '" font-size="' + fs * 0.85 + '" fill="' + PEN + '" text-anchor="middle">식세기</text>'; }
      else if (m.t === 'drawer' || m.t === 'cook') { var n = drawersOf(m), hh = (o.baseH - 130) / n; for (var i = 0; i < n; i++) s += '<rect x="' + (x + 6) + '" y="' + Y(o.baseH - 30 - hh * i) + '" width="' + (w - 12) + '" height="' + (hh - 8) + '" fill="#fff" stroke="' + INK + '" stroke-width="' + fs * 0.08 + '"/>'; }
      else if (m.t === 'filler') s += '<rect x="' + x + '" y="' + Y(o.baseH - 30) + '" width="' + w + '" height="' + (o.baseH - 130) + '" fill="#EDEDE8" stroke="' + PEN + '" stroke-width="' + fs * 0.06 + '"/>';
      else if (m.t === 'corner') { var cr0 = m.run < L.runs.length - 1; s += door(cr0 ? x : x + 600, 100, o.baseH - 30, 400, 1, '#fff') + '<rect x="' + (cr0 ? x + 400 : x) + '" y="' + Y(o.baseH - 30) + '" width="600" height="' + (o.baseH - 130) + '" fill="#EDEDE8" stroke="' + PEN + '" stroke-width="' + fs * 0.06 + '"/>'; }
      else s += door(x, 100, o.baseH - 30, w, doorsOf(m), c);
      if (m.t !== 'tall') s += '<rect x="' + x + '" y="' + Y(100) + '" width="' + w + '" height="100" fill="#D9DBD5"/>';
      if (m.t !== 'filler') s += '<text x="' + (x + w / 2) + '" y="' + (top + 160) + '" font-size="' + fs + '" font-weight="600" fill="' + INK + '" text-anchor="middle">' + m.no + '</text><text x="' + (x + w / 2) + '" y="' + (top + 160 + fs * 1.3) + '" font-size="' + fs * 0.85 + '" fill="' + PEN + '" text-anchor="middle">' + w + '</text>'; });
    var tops = B.filter(function (m) { return m.t !== 'fridge' && m.t !== 'tall' && m.t !== 'filler'; }); if (tops.length) { var tx0 = Math.min.apply(null, tops.map(function (m) { return m.a; })), tx1 = Math.max.apply(null, tops.map(function (m) { return m.a + m.w; })); s += '<rect x="' + tx0 + '" y="' + Y(o.baseH) + '" width="' + (tx1 - tx0) + '" height="30" fill="' + INK + '"/>'; }
    U.forEach(function (m) { var x = m.a, w = m.w;
      if (m.t === 'hood') { s += '<path d="M' + (x + 40) + ' ' + Y(upY0 + 120) + ' L' + (x + w - 40) + ' ' + Y(upY0 + 120) + ' L' + (x + w / 2 + 120) + ' ' + Y(upY1) + ' L' + (x + w / 2 - 120) + ' ' + Y(upY1) + ' Z" fill="#fff" stroke="' + INK + '" stroke-width="' + fs * 0.08 + '"/><text x="' + (x + w / 2) + '" y="' + Y((upY0 + 120 + upY1) / 2) + '" font-size="' + fs * 0.8 + '" fill="' + PEN + '" text-anchor="middle" dominant-baseline="middle">후드</text>'; return; }
      if (m.t === 'frup') { s += door(x, top - 400, top - 50, w, doorsOf(m), '#fff'); return; }
      if (m.t === 'ufill') { s += '<rect x="' + x + '" y="' + Y(upY1) + '" width="' + w + '" height="' + (upY1 - upY0) + '" fill="#EDEDE8" stroke="' + PEN + '" stroke-width="' + fs * 0.06 + '"/>'; return; }
      s += door(x, upY0, upY1, w, doorsOf(m), '#fff'); });
    s += '<line x1="0" y1="' + (top + 40) + '" x2="' + len + '" y2="' + (top + 40) + '" stroke="' + PEN + '" stroke-width="' + fs * 0.06 + '"/><text x="' + (len / 2) + '" y="' + (top + 160 + fs * 3) + '" font-size="' + fs + '" fill="' + PEN + '" text-anchor="middle">' + (run + 1) + '번 벽 전체 ' + len.toLocaleString('ko-KR') + '</text>';
    [[o.baseH, '상판 ' + o.baseH], [upY0, '상부장 밑 ' + upY0], [upY1, '상부장 위 ' + upY1]].forEach(function (h) { s += '<text x="-30" y="' + Y(h[0]) + '" font-size="' + fs * 0.8 + '" fill="' + PEN + '" text-anchor="end" dominant-baseline="middle">' + h[1] + '</text>'; });
    return s + '</svg>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function sheet(L, geo, meta) {
    meta = meta || {}; var b = L.bom, n = function (v) { return Number(v).toLocaleString('ko-KR'); };
    var css = '@page{size:A4;margin:14mm}body{font-family:"IBM Plex Sans KR",Pretendard,"Malgun Gothic",sans-serif;color:' + INK + ';background:#fff;margin:0;padding:28px;font-size:13.5px;line-height:1.6}h1{font-size:22px;margin:0 0 4px;font-weight:600}h2{font-size:15.5px;margin:28px 0 8px;padding-bottom:6px;border-bottom:1px solid ' + RULE + ';font-weight:600}.meta{color:' + PEN + ';font-size:12.5px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid ' + RULE + ';padding:6px 8px;text-align:left}th{color:' + PEN + ';font-weight:500}td.r,th.r{text-align:right}.w{color:#8a4b0f}.fig{border:1px solid ' + RULE + ';border-radius:4px;padding:10px;margin-top:6px}.cap{color:' + PEN + ';font-size:12px;margin-top:4px}.two{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:700px){.two{grid-template-columns:1fr}body{padding:16px}}@media print{.noprint{display:none}h2{break-after:avoid}.fig{break-inside:avoid}}';
    var h = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>싱크대 설계 · ' + esc(meta.name || '') + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap"><style>' + css + '</style></head><body>';
    h += '<h1>싱크대 설계 · ' + esc(meta.name || '우리 집') + '</h1><div class="meta">집지니 CAD · ' + (L.runs.length === 1 ? '일자형' : L.runs.length === 2 ? 'ㄱ자형' : 'ㄷ자형') + ' · 벽 ' + L.runs.map(function (r) { return n(r.len); }).join(' + ') + 'mm · 하부장 높이 ' + L.o.baseH + ' · 깊이 ' + L.o.depth + ' · 상부장 ' + (L.o.up ? L.o.upH : '없음') + (meta.date ? ' · ' + esc(meta.date) : '') + '</div>';
    h += '<p class="noprint" style="margin-top:12px"><button onclick="print()" style="font:inherit;padding:8px 16px;border:1px solid ' + INK + ';background:#fff;border-radius:4px;cursor:pointer">인쇄 · PDF 저장</button></p>';
    var c = cost(L, meta.price), won = function (v) { return n(Math.round(v / 10000)) + '만 원'; };
    h += '<h2>어림 금액 · 부가세 10% 별도</h2><div style="font-size:26px;font-weight:600;color:' + GRN + '">약 ' + won(c.total) + '</div><table style="margin-top:8px">' + c.rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="r">' + x[1] + '</td><td class="r">' + won(x[2]) + '</td></tr>'; }).join('') + '</table>';
    h += '<table style="margin-top:14px"><tr><th>등급</th><th>어떤 것</th><th class="r">같은 구성일 때</th></tr>' + c.tiers.map(function (t) { return '<tr><td>' + (t.k === c.grade ? '<b>' + t.이름 + '</b> (지금)' : t.이름) + '</td><td>' + t.설명 + '</td><td class="r">약 ' + won(t.total) + '</td></tr>'; }).join('') + '</table><div class="cap">' + c.근거 + '</div>';
    if (L.info && L.info.length) h += L.info.map(function (w) { return '<div class="cap">· ' + esc(w) + '</div>'; }).join('');
    if (L.warn.length) h += '<h2>먼저 볼 것</h2>' + L.warn.map(function (w) { return '<div class="w">· ' + esc(w) + '</div>'; }).join('');
    h += '<h2>평면 (위에서 본 그림)</h2><div class="fig">' + planSvg(L, geo) + '</div><div class="cap">그림 1. 칸 안 숫자는 아래 모듈 번호. 점선 칸은 가전 자리(냉장고·식기세척기), 코너장 안 점선 뒤쪽은 문이 없는 막힌 칸.</div>';
    L.runs.forEach(function (r, i) { h += '<h2>' + (i + 1) + '번 벽 입면 (앞에서 본 그림)</h2><div class="fig">' + elevSvg(L, i) + '</div><div class="cap">그림 ' + (i + 2) + '. 아래 숫자는 모듈 번호와 폭(mm). 바닥 걸레받이 100, 상판 30.</div>'; });
    h += '<h2>모듈 목록</h2><table><tr><th>번호</th><th>벽</th><th>모듈</th><th class="r">폭</th><th class="r">문짝</th><th class="r">서랍</th></tr>' + L.base.map(function (m) { return '<tr><td>' + m.no + '</td><td>' + (m.run + 1) + '</td><td>' + NAME[m.t] + '</td><td class="r">' + m.w + '</td><td class="r">' + (doorsOf(m) || '') + '</td><td class="r">' + (drawersOf(m) || '') + '</td></tr>'; }).join('') + L.upper.map(function (m) { return '<tr><td>' + m.no + '</td><td>' + (m.run + 1) + '</td><td>' + NAME[m.t] + '</td><td class="r">' + m.w + '</td><td class="r">' + (doorsOf(m) || '') + '</td><td></td></tr>'; }).join('') + '</table>';
    h += '<div class="two"><div><h2>발주 수량</h2><table>' + [['상판', b.상판_m + ' m (' + b.상판_m2 + '㎡ · 이음 ' + b.상판_이음 + '곳)'], ['하부장', b.하부장_m + ' m'], ['상부장', b.상부장_m + ' m'], ['문짝', b.문짝 + '짝'], ['서랍', b.서랍 + '개'], ['경첩', b.경첩 + '개'], ['서랍 레일', b.서랍레일 + '벌'], ['손잡이', b.손잡이 + '개'], ['걸레받이', b.걸레받이_m + ' m'], ['개수대 볼 · 수전', b.개수대볼 + ' · ' + b.수전], ['후드', b.후드 + '대']].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="r">' + x[1] + '</td></tr>'; }).join('') + '</table></div>';
    h += '<div><h2>같은 모듈끼리</h2><table><tr><th>구분</th><th>모듈</th><th class="r">폭</th><th class="r">개수</th></tr>' + b.목록.sort(function (a, c) { return a.구분 < c.구분 ? -1 : a.구분 > c.구분 ? 1 : c.폭 - a.폭; }).map(function (x) { return '<tr><td>' + x.구분 + '</td><td>' + x.품목 + '</td><td class="r">' + x.폭 + '</td><td class="r">' + x.개수 + '</td></tr>'; }).join('') + '</table></div></div>';
    h += '<p class="meta" style="margin-top:22px">치수는 도면 척도로 잰 값입니다. 가구 업체 실측으로 최종 확정합니다. 가스·급배수 위치에 따라 개수대·쿡탑 자리가 바뀔 수 있습니다.</p></body></html>';
    return h;
  }
  root.JJKitchen = { layout: layout, cost: cost, PRICE: PRICE, sheet: sheet, planSvg: planSvg, elevSvg: elevSvg, NAME: NAME, DEF: DEF };
})(typeof window !== 'undefined' ? window : globalThis);
