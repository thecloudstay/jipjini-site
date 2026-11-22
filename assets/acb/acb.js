/* 아관비 — 아파트 관리비 비교 (2026-11-21)
   쓰는 법: <section class="acb" data-c="단지번호" data-f="시도_시군구" data-root="../../"></section>
   자료: data/acb/<시도_시군구>.json (국토교통부 공동주택 관리비, 2026년 1~9월 평균) */
(function () {
  var C = { 1: '#14532D', 2: '#1F5E2E', 3: '#6B7067', 4: '#C2410C', 5: '#B3261E' };
  var NAME = { 1: '신나는 집', 2: '웃는 집', 3: '보통 집', 4: '우는 집', 5: '화난 집' };
  var RANGE = { 1: '85 미만', 2: '85~95', 3: '95~105', 4: '105~115', 5: '115 이상' };
  var NS = 'http://www.w3.org/2000/svg';
  function el(p, t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; }
  function face(svg, t, cx, cy, r) {
    var c = C[t], sw = Math.max(1.6, r / 9);
    el(svg, 'circle', { cx: cx, cy: cy, r: r, fill: t == 5 ? '#FBEAEA' : '#fff', stroke: c, 'stroke-width': sw });
    var ex = r * .35, ey = cy - r * .18, e = r * .11, cap = { fill: 'none', stroke: c, 'stroke-width': sw, 'stroke-linecap': 'round' };
    if (t == 1) [-1, 1].forEach(function (k) { el(svg, 'path', Object.assign({ d: 'M' + (cx + k * ex - r * .13) + ',' + (ey + r * .04) + ' Q' + (cx + k * ex) + ',' + (ey - r * .14) + ' ' + (cx + k * ex + r * .13) + ',' + (ey + r * .04) }, cap)); });
    else { el(svg, 'circle', { cx: cx - ex, cy: ey, r: e, fill: c }); el(svg, 'circle', { cx: cx + ex, cy: ey, r: e, fill: c }); }
    if (t == 5) { el(svg, 'line', Object.assign({ x1: cx - ex - r * .17, y1: ey - r * .26, x2: cx - ex + r * .12, y2: ey - r * .12 }, cap)); el(svg, 'line', Object.assign({ x1: cx + ex + r * .17, y1: ey - r * .26, x2: cx + ex - r * .12, y2: ey - r * .12 }, cap)); }
    var y = cy + r * .32, w = r * .42;
    if (t == 1) el(svg, 'path', { d: 'M' + (cx - w) + ',' + (y - r * .12) + ' Q' + cx + ',' + (y + r * .42) + ' ' + (cx + w) + ',' + (y - r * .12) + ' Z', fill: c, stroke: c, 'stroke-width': sw, 'stroke-linejoin': 'round' });
    if (t == 2) el(svg, 'path', Object.assign({ d: 'M' + (cx - w) + ',' + (y - r * .08) + ' Q' + cx + ',' + (y + r * .32) + ' ' + (cx + w) + ',' + (y - r * .08) }, cap));
    if (t == 3) el(svg, 'line', Object.assign({ x1: cx - w, x2: cx + w, y1: y, y2: y }, cap));
    if (t == 4) { el(svg, 'path', Object.assign({ d: 'M' + (cx - w) + ',' + (y + r * .14) + ' Q' + cx + ',' + (y - r * .26) + ' ' + (cx + w) + ',' + (y + r * .14) }, cap)); el(svg, 'path', { d: 'M' + (cx + ex) + ',' + (cy - r * .02) + ' q ' + (-r * .08) + ',' + (r * .18) + ' 0,' + (r * .22) + ' q ' + (r * .08) + ',' + (-r * .04) + ' 0,' + (-r * .22), fill: '#7FA7C9', class: 'tear' }); }
    if (t == 5) el(svg, 'path', Object.assign({ d: 'M' + (cx - w) + ',' + (y + r * .12) + ' L' + (cx - w * .5) + ',' + (y - r * .02) + ' L' + cx + ',' + (y + r * .12) + ' L' + (cx + w * .5) + ',' + (y - r * .02) + ' L' + (cx + w) + ',' + (y + r * .12), 'stroke-linejoin': 'round' }, cap));
    return svg;
  }
  function faceSvg(t, size) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 ' + size + ' ' + size); s.setAttribute('role', 'img'); s.setAttribute('aria-label', NAME[t]); s.setAttribute('class', 'jf jf' + t); return face(s, t, size / 2, size / 2, size / 2 - 3); }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function man(n) { n = Math.abs(n); if (n >= 1e8) return (Math.round(n / 1e7) / 10) + '억 원'; n = Math.round(n / 1000) * 1000; if (n >= 10000) { var m = Math.floor(n / 10000), r = (n % 10000) / 1000; return m + '만' + (r ? ' ' + r + '천' : '') + ' 원'; } return (n / 1000) + '천 원'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lvOf(ix) { return ix < 85 ? 1 : ix < 95 ? 2 : ix < 105 ? 3 : ix < 115 ? 4 : 5; }

  function chart(o, W) {
    W = Math.max(320, Math.min(900, W || 720)); var H = W < 500 ? 200 : 230, L = 52, R = 14, T = 14, B = 30, s = o.s, pm = o.pm, n = s.length;
    var vals = s.map(function (x) { return x[1]; }).concat(pm.filter(function (v) { return v; }));
    var lo = Math.min.apply(null, vals) * .9, hi = Math.max.apply(null, vals) * 1.06;
    var X = function (i) { return L + (W - L - R) * (n == 1 ? .5 : i / (n - 1)); }, Y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    for (var g = 0; g < 4; g++) { var v = lo + (hi - lo) * g / 3, y = Y(v); el(svg, 'line', { x1: L, x2: W - R, y1: y, y2: y, stroke: '#EEF0EB' }); el(svg, 'text', { x: L - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#8E9389' }).textContent = Math.round(v / 10) * 10; }
    s.forEach(function (x, i) { el(svg, 'text', { x: X(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 12, fill: '#8E9389' }).textContent = (+x[0].slice(2)) + '월'; });
    var band = '', d1 = '', d2 = '';
    s.forEach(function (x, i) { var p = pm[i]; if (!p) return; d2 += (d2 ? 'L' : 'M') + X(i) + ',' + Y(p); });
    // 차이 칠하기: 비싼 달은 붉게, 싼 달은 초록으로
    for (var i = 0; i < n - 1; i++) {
      var a = s[i][1], b = s[i + 1][1], pa = pm[i], pb = pm[i + 1]; if (!pa || !pb) continue;
      var up = (a + b) / 2 > (pa + pb) / 2;
      el(svg, 'path', { d: 'M' + X(i) + ',' + Y(a) + 'L' + X(i + 1) + ',' + Y(b) + 'L' + X(i + 1) + ',' + Y(pb) + 'L' + X(i) + ',' + Y(pa) + 'Z', fill: up ? '#B3261E' : '#1F5E2E', opacity: .12, class: 'band' });
    }
    s.forEach(function (x, i) { d1 += (i ? 'L' : 'M') + X(i) + ',' + Y(x[1]); });
    el(svg, 'path', { d: d2, fill: 'none', stroke: '#6B7067', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    el(svg, 'path', { d: d1, fill: 'none', stroke: C[o.lv], 'stroke-width': 3, 'stroke-linejoin': 'round', pathLength: 1, class: 'draw' });
    var li = n - 1; el(svg, 'circle', { cx: X(li), cy: Y(s[li][1]), r: 4.5, fill: C[o.lv] });
    return svg;
  }

  function render(box, o, root) {
    var diff = o.m2 - o.pmed, pct = Math.round(diff / o.pmed * 1000) / 10;
    var main = (o.pf || []).slice().sort(function (a, b) { return b[1] - a[1]; })[0];
    var ex = main ? main[0] : 84, sup = ex * (o.k || 1.3), mon = diff * sup;
    var big = o.lv >= 4, same = o.lv == 3;
    var say = same
      ? '㎡당 <b>' + won(o.m2) + '</b> · 비슷한 10곳 가운데값 ' + won(o.pmed) + ' · 차이 거의 없음'
      : '비슷한 10곳보다 ㎡당 <b class="' + (diff > 0 ? 'up' : 'dn') + '">' + won(Math.abs(diff)) + ' ' + (diff > 0 ? '더' : '덜') + '</b> (' + (pct > 0 ? '+' : '') + pct + '%)<br>전용 ' + Math.round(ex) + '㎡ 기준 월 <b class="' + (diff > 0 ? 'up' : 'dn') + '">' + man(mon) + '</b> · 연 ' + man(mon * 12);
    var h = '<h2>' + esc(o.n) + ' 관리비 <small>집지니 아관비 지수</small></h2>';
    h += '<div class="ahead"><div class="fbig"></div><div><p class="lvn" style="color:' + C[o.lv] + '">' + NAME[o.lv] + '<small>지수 ' + o.ix + '</small></p><p class="say">' + say + '</p></div></div>';
    h += '<div class="scale5">' + [1, 2, 3, 4, 5].map(function (t) { return '<span' + (t == o.lv ? ' class="on" style="border-color:' + C[t] + '"' : ' style="border-color:' + C[t] + '55"') + '>' + NAME[t] + '<br>' + RANGE[t] + '</span>'; }).join('') + '</div>';
    // 2026-11-22 줄일 수 있는 돈 — 「나가는 돈을 줄여 주는 지니」: 관리 방식으로 바꿀 수 있는 다섯 항목을 비슷한 10곳 가운데값까지 낮췄을 때
    //   항목 나누는 법이 단지마다 달라(경비를 일반관리에 넣는 단지 등) 다섯을 합쳐서 본다. 쓰는 만큼 내는 난방·전기·수도와, 쌓아 두는 장충금은 뺀다.
    var MG = ['경비', '청소', '일반관리', '승강기', '수선유지'], gsum = 0, gme = 0, gpe = 0;
    MG.forEach(function (k) { gme += (o.b && o.b[k]) || 0; gpe += (o.pb && o.pb[k]) || 0; }); gsum = gme - gpe;
    if (o.b && o.pb && gpe > 0) {
      var tot = 0; (o.pf || []).forEach(function (q) { tot += q[0] * q[1] * (o.k || 1.3); });
      var gmx = Math.max(gme, gpe), gbar = '<div class="cutbar"><p><span>' + esc(o.n) + '</span><i style="width:' + (gme / gmx * 100) + '%;background:' + C[o.lv] + '"></i><b>㎡당 ' + won(gme) + '</b></p><p><span>비슷한 10곳</span><i style="width:' + (gpe / gmx * 100) + '%;background:#C9CDC4"></i><b>㎡당 ' + won(gpe) + '</b></p></div>';
      if (gsum > 30) h += '<div class="cutbox"><h3>줄일 수 있는 돈<small>비슷한 10곳 수준까지 낮추면</small></h3><p class="cutn">세대당 연 <b>' + man(gsum * sup * 12) + '</b>' + (tot ? '<span>단지 전체 연 <b>' + man(Math.round(gsum * tot * 12 / 1e5) * 1e5) + '</b></span>' : '') + '</p>' + gbar + '<p class="anote" style="margin-top:10px">경비·청소·일반관리·승강기 유지·수선유지 다섯 항목 합계 기준, 전용 ' + Math.round(ex) + '㎡ 어림. 난방·전기·수도와 장기수선충당금은 뺐습니다.</p></div>';
      else if (gsum < -30) h += '<div class="cutbox ok"><h3>관리 항목은 이미 덜 씁니다<small>비슷한 10곳과 견주어</small></h3><p class="cutn">세대당 연 <b>' + man(-gsum * sup * 12) + '</b> 적게 냅니다</p>' + gbar + '<p class="anote" style="margin-top:10px">경비·청소·일반관리·승강기 유지·수선유지 다섯 항목 합계 기준, 전용 ' + Math.round(ex) + '㎡ 어림.</p></div>';
    }
    if (o.ga && o.pf && o.pf.length) {
      var hiM = o.s.reduce(function (a, x) { return x[1] > a[1] ? x : a; }), loM = o.s.reduce(function (a, x) { return x[1] < a[1] ? x : a; });
      h += '<h3>평형별 한 달 관리비<small>2026년 1~9월 평균 · 세대 몫 어림</small></h3><table class="br ptype"><thead><tr><th>전용</th><th class="hide">세대</th><th>면적대로 나뉘는 몫</th><th>쓰는 만큼 (평균)</th><th>합계</th><th class="hide">가장 싼 달 ~ 비싼 달</th></tr></thead><tbody>' +
        o.pf.slice().sort(function (a, b) { return a[0] - b[0]; }).map(function (p) {
          var sp = p[0] * (o.k || 1.3);
          return '<tr><td>' + Math.round(p[0]) + '㎡ <small>약 ' + Math.round(sp / 3.3058) + '평</small></td><td class="hide">' + p[1].toLocaleString('ko-KR') + '</td><td>' + man(o.ga * sp) + '</td><td>' + man(o.iu * sp) + '</td><td><b>' + man((o.ga + o.iu) * sp) + '</b></td><td class="hide">' + man(o.lo * sp) + ' ~ ' + man(o.hi * sp) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="anote" style="margin-top:8px">사용료는 단지 평균 · 최고 ' + (+hiM[0].slice(2)) + '월 · 최저 ' + (+loM[0].slice(2)) + '월</p>';
    }
    h += '<h3>달마다 ㎡당 관리비<small>우리 단지와 비슷한 집 가운데값</small></h3><div class="achart"></div><div class="lg"><span><i style="border-color:' + C[o.lv] + '"></i>' + esc(o.n) + '</span><span><i class="p"></i>비슷한 집 10곳 가운데값</span></div>';
    var keys = Object.keys(o.b).filter(function (k) { return o.b[k] || o.pb[k]; }), mx = 1;
    keys.forEach(function (k) { mx = Math.max(mx, o.b[k], o.pb[k]); });
    h += '<h3>어디서 차이가 나나<small>㎡당 한 달</small></h3><table class="br"><thead><tr><th>항목</th><th>우리 단지</th><th>비슷한 집</th><th>차이</th><th class="bar"></th></tr></thead><tbody>' + keys.map(function (k) {
      var d = o.b[k] - o.pb[k], cls = d > 15 ? 'up' : d < -15 ? 'dn' : '';
      return '<tr><td>' + k + '</td><td>' + won(o.b[k]) + '</td><td>' + won(o.pb[k]) + '</td><td class="' + cls + '">' + (d > 0 ? '+' : '') + Math.round(d).toLocaleString('ko-KR') + '</td><td class="bar"><i style="width:' + (o.b[k] / mx * 100) + '%;background:' + C[o.lv] + '"></i><i style="width:' + (o.pb[k] / mx * 100) + '%;background:#C9CDC4;margin-top:3px"></i></td></tr>';
    }).join('') + '</tbody></table>';
    var rows = o.pl.map(function (p) { return { c: p[0], n: p[1], g: p[2], y: p[3], h: p[4], m2: p[5], lv: p[6], ix: p[7] }; });
    rows.push({ c: o.c, n: o.n, g: o.g, y: o.y, h: o.h, m2: o.m2, lv: o.lv, ix: o.ix, me: 1 });
    rows.sort(function (a, b) { return a.m2 - b.m2; });
    var rank = rows.findIndex(function (r) { return r.me; }) + 1;
    h += '<h3>비슷한 집 10곳<small>' + esc(o.n) + '은 11곳 가운데 싼 순서로 ' + rank + '번째</small></h3><table class="br peer"><thead><tr><th></th><th style="text-align:left">단지</th><th class="hide">준공</th><th class="hide">세대</th><th>㎡당</th><th>지수</th></tr></thead><tbody>' + rows.map(function (r) {
      return '<tr' + (r.me ? ' class="me"' : '') + '><td data-f="' + r.lv + '" style="width:40px"></td><td class="nm">' + (r.me ? esc(r.n) : '<a href="' + root + 'acb/?c=' + r.c + '">' + esc(r.n) + '</a>') + '<small>' + esc(r.g) + '</small></td><td class="hide">' + r.y + '</td><td class="hide">' + r.h.toLocaleString('ko-KR') + '</td><td>' + won(r.m2) + '</td><td style="color:' + C[r.lv] + '">' + r.ix + '</td></tr>';
    }).join('') + '</tbody></table>';
    h += '<div data-d3wrap><h3>단지 입체도<small>동별 실제 높이</small></h3><div class="a3d"></div><p class="a3dsrc">자료: 국토교통부 건물통합정보</p></div>';
    h += '<h3>주변 단지 관리비<small>반경 1km</small></h3><div class="amap"></div>';
    h += '<details class="how"><summary>계산 방법과 자료</summary><ul>' +
      '<li>비슷한 집: 같은 시·도에서 난방 방식(' + esc(o.heat || '') + ')·분양 형태가 같고, 준공 연도·세대수·평균 전용면적이 가장 가까운 10곳</li>' +
      '<li>개별난방 단지는 가스 난방비가 관리비에 안 들어가서 개별난방끼리만 비교</li>' +
      '<li>지수 = 우리 단지 ㎡당 관리비 ÷ 비슷한 집 가운데값 × 100 (2026년 1~9월 평균)</li>' +
      (o.ltsm ? '<li>장기수선충당금 쌓인 돈 ' + man(o.ltsm) + '</li>' : '') +
      (o.chk ? '<li>비슷한 집과 차이가 매우 커서 공개 자료 확인이 필요한 단지</li>' : '') +
      '<li>자료: 국토교통부 공동주택관리정보시스템 (2026년 11월 20일)</li></ul></details>';
    box.innerHTML = h;
    box.querySelector('.fbig').appendChild(faceSvg(o.lv, box.clientWidth < 500 ? 72 : 92));
    box.querySelector('.achart').appendChild(chart(o, box.querySelector('.achart').clientWidth));
    box.querySelectorAll('[data-f]').forEach(function (td) { td.appendChild(faceSvg(+td.getAttribute('data-f'), 30)); });
    draw3d(box, o, root);
    drawMap(box, o, root);
    watch(box);
  }

  var IDXP = null;
  function getIdx(root) { return IDXP || (IDXP = fetch(root + 'data/acb/index.json').then(function (r) { return r.json(); })); }
  function getKakao(root) {
    return new Promise(function (ok, no) {
      if (window.kakao && window.kakao.maps && window.kakao.maps.LatLng) return ok(window.kakao.maps);
      function go() {
        if (!window.JJ_KAKAO_KEY) return no('열쇠 없음');
        var s = document.createElement('script'); s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(window.JJ_KAKAO_KEY);
        s.onload = function () { window.kakao.maps.load(function () { ok(window.kakao.maps); }); }; s.onerror = no; document.head.appendChild(s);
      }
      if (window.JJ_KAKAO_KEY) go(); else { var c = document.createElement('script'); c.src = root + 'assets/site_config.js'; c.onload = go; c.onerror = no; document.head.appendChild(c); }
    });
  }
  function dist(a, b, c, d) { var x = (d - b) * Math.cos((a + c) / 2 * Math.PI / 180) * 111.32, y = (c - a) * 110.57; return Math.sqrt(x * x + y * y); }
  function draw3d(box, o, root) {
    var el = box.querySelector('.a3d'); if (!el) return;
    function go() { window.JJd3.mount(el, o.c, root, {}); }
    if (window.JJd3) return go();
    var sc = document.createElement('script'); sc.src = root + 'assets/acb/d3.js?v=20261122d'; sc.onload = go; sc.onerror = function () { el.parentNode.hidden = true; }; document.head.appendChild(sc);
  }
  function drawMap(box, o, root) {
    var m = box.querySelector('.amap'); if (!m) return;
    getIdx(root).then(function (I) {
      var me = I[o.c]; if (!me || me.length < 8) { m.previousElementSibling.remove(); m.remove(); return; }
      var peer = {}; o.pl.forEach(function (p) { peer[p[0]] = 1; });
      m.style.height = (box.clientWidth < 600 ? 320 : 420) + 'px';
      ownMap(m, I, root, { center: [me[6], me[7]], me: o.c, peer: peer });
    }).catch(function () { var h = m.previousElementSibling; if (h) h.remove(); m.remove(); });
  }

  function load(box) {
    var c = box.getAttribute('data-c'), f = box.getAttribute('data-f'), root = box.getAttribute('data-root') || '/';
    if (!c || !f) return;
    fetch(root + 'data/acb/' + encodeURIComponent(f) + '.json?v=20261122a').then(function (r) { return r.ok ? r.json() : []; }).then(function (L) {
      var o = L.filter(function (x) { return x.c === c; })[0];
      if (o) render(box, o, root); else box.remove();
    }).catch(function (e) {
      // 2026-11-22 자료 파일이 깨져 있으면 화면이 통째로 비던 것(24개 구) — 비우지 않고 까닭을 적는다
      if (window.console) console.warn('아관비', e);
      if (box.hasAttribute('data-keep')) { box.innerHTML = '<p class="anote">이 단지의 관리비 자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>'; } else box.remove();
    });
  }
  // 화면에 들어올 때 한 번만 움직임 (움직임 줄이기 설정이면 안 함)
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .25 }) : null;
  function watch(root) { (root || document).querySelectorAll('.acb .ahead, .acb .achart, .acb .br, .acbhf, .acbm').forEach(function (n) { if (io) io.observe(n); else n.classList.add('in'); }); }
  // 집지니 지도 (2026-11-22 대표 「우리식 지도로, 아이덴티티」): 남의 지도 그림을 쓰지 않고 단지 점·눈금선·구 이름만으로 그린다.
  //   opt.center=[위도,경도] 이면 그 둘레 약 1km, 없으면 수도권 전체. opt.me=내 단지 번호, opt.peer={번호:1}, opt.pick=단지 고르면 부를 함수
  function ownMap(m, I, root, opt) {
    opt = opt || {};
    var KX = 0.7934, pts = [], lab = {}, c, e;
    for (c in I) { e = I[c]; if (e.length < 8 || !e[6]) continue; pts.push({ c: c, e: e }); var L = lab[e[5]] || (lab[e[5]] = { n: e[1], x: 0, y: 0, k: 0 }); L.x += e[7]; L.y += e[6]; L.k++; }
    var labs = Object.keys(lab).map(function (k) { var l = lab[k]; return { n: l.n, x: l.x / l.k, y: l.y / l.k, k: l.k }; }).sort(function (a, b) { return b.k - a.k; });
    m.textContent = ''; m.classList.add('omap');
    var cv = document.createElement('canvas'), lay = document.createElement('div'), oz = document.createElement('div'), g = cv.getContext('2d');
    lay.className = 'olay'; oz.className = 'oz'; oz.innerHTML = '<button type="button" aria-label="크게">+</button><button type="button" aria-label="작게">−</button>';
    m.appendChild(cv); m.appendChild(lay); m.appendChild(oz);
    var bar = document.createElement('div'), leg = document.createElement('p'); bar.className = 'omapbar'; leg.className = 'omapleg';
    [1, 2, 3, 4, 5].forEach(function (t) { var s = document.createElement('i'); s.style.background = C[t]; bar.appendChild(s); });
    m.parentNode.insertBefore(bar, m.nextSibling); m.parentNode.insertBefore(leg, bar.nextSibling);
    var W = 0, H = 0, dpr = 1, cx, cy, z, zmin, face = {}, tip = null, tipP = null;
    var base = ownMap.base || null;   // 2026-11-22 바탕(땅·시도·시군구 경계) — 점만 떠 있어 지도로 안 보인다는 지적
    if (!base && !ownMap.wait) ownMap.wait = fetch(root + 'data/acb/basemap.json?v=20261122b').then(function (r) { return r.json(); }).then(function (j) { ownMap.base = j; return j; }).catch(function () { return null; });
    if (!base && ownMap.wait) ownMap.wait.then(function (j) { if (j) { base = j; if (W) draw(); } });
    function ring(f) { g.moveTo(X(f[0]), Y(f[1])); for (var i = 2; i < f.length; i += 2) g.lineTo(X(f[i]), Y(f[i + 1])); g.closePath(); }
    function X(lng) { return (lng - cx) * z * KX + W / 2; } function Y(lat) { return (cy - lat) * z + H / 2; }
    function fit() {
      if (opt.center) { cy = opt.center[0]; cx = opt.center[1]; z = (H / 2) / 0.0105; zmin = z / 40; return; }
      var xs = pts.map(function (p) { return p.e[7]; }).sort(function (u, v) { return u - v; }), ys = pts.map(function (p) { return p.e[6]; }).sort(function (u, v) { return u - v; }), q = function (v, t) { return v[Math.min(v.length - 1, Math.floor(v.length * t))]; };
      var a = q(xs, .02), b = q(xs, .98), d = q(ys, .02), f = q(ys, .98);
      cx = (a + b) / 2; cy = (d + f) / 2; z = Math.min(W / ((b - a) * KX), H / (f - d)) * 0.9; zmin = z * 0.55;
    }
    function size() { var r = m.getBoundingClientRect(); if (!r.width) return false; dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; return true; }
    function card(p) {
      if (tip) tip.remove(); tip = document.createElement('div'); tip.className = 'acbtip'; tipP = p;
      tip.innerHTML = '<b></b><span></span>' + (p.c === opt.me ? '' : '<a>관리비 보기</a>');
      tip.querySelector('b').textContent = p.e[0]; tip.querySelector('span').textContent = '㎡당 ' + p.e[2].toLocaleString('ko-KR') + '원 · ' + NAME[p.e[4]] + ' ' + p.e[3];
      var a = tip.querySelector('a'); if (a) { a.href = root + 'acb/?c=' + p.c; a.onclick = function (ev) { if (opt.pick) { ev.preventDefault(); opt.pick(p.c); } }; }
      lay.appendChild(tip); place();
    }
    function place() { if (tip && tipP) { tip.style.left = X(tipP.e[7]) + 'px'; tip.style.top = Y(tipP.e[6]) + 'px'; } }
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      var la0 = cy - H / 2 / z, la1 = cy + H / 2 / z, lo0 = cx - W / 2 / z / KX, lo1 = cx + W / 2 / z / KX;
      if (base) {
        g.fillStyle = '#E6ECEE'; g.fillRect(0, 0, W, H);                                   // 바다
        g.beginPath(); base.land.forEach(ring); g.fillStyle = '#FBFBF8'; g.fill('evenodd');   // 땅
        g.beginPath(); base.sgg.forEach(function (s) { s.r.forEach(ring); }); g.strokeStyle = '#D3D8CE'; g.lineWidth = z < 900 ? .6 : 1; g.lineJoin = 'round'; g.stroke();   // 시군구 경계
        g.beginPath(); base.sido.forEach(ring); g.strokeStyle = '#8E9489'; g.lineWidth = z < 900 ? 1.1 : 1.6; g.stroke();   // 시도 경계
        g.beginPath(); base.land.forEach(ring); g.strokeStyle = '#B9C4C8'; g.lineWidth = .8; g.stroke();   // 바닷가 선
        if (base.han) { g.beginPath(); base.han.forEach(function (f) { g.moveTo(X(f[0]), Y(f[1])); for (var i = 2; i < f.length; i += 2) g.lineTo(X(f[i]), Y(f[i + 1])); }); g.strokeStyle = '#C9D9DF'; g.lineCap = 'round'; g.lineWidth = Math.max(2.5, Math.min(60, 0.009 * z)); g.stroke(); g.lineCap = 'butt';
          if (z > 1500 && z < 9000) { var hm = base.han.reduce(function (u, v) { return v.length > u.length ? v : u; }, []), hi = (hm.length >> 2) * 2; g.font = '500 11.5px "IBM Plex Sans KR",sans-serif'; g.fillStyle = '#7C97A1'; g.textAlign = 'center'; g.fillText('한강', X(hm[hi]), Y(hm[hi + 1]) + 4); g.textAlign = 'start'; } }   // 한강(강을 낀 구 경계에서 뽑은 줄기, 폭 약 1km)
      }
      var vis = pts.filter(function (p) { return p.e[7] >= lo0 && p.e[7] <= lo1 && p.e[6] >= la0 && p.e[6] <= la1; }), cnt = [0, 0, 0, 0, 0, 0];
      vis.forEach(function (p) { cnt[p.e[4]]++; });
      var faces = vis.length <= 90 && z >= 6000, r = z < 900 ? 1.7 : z < 2500 ? 2.6 : z < 6000 ? 3.8 : 5, keep = {};
      if (!faces) vis.forEach(function (p) { g.fillStyle = C[p.e[4]]; g.globalAlpha = z < 900 ? .75 : .9; g.beginPath(); g.arc(X(p.e[7]), Y(p.e[6]), r, 0, 6.2832); g.fill(); });
      g.globalAlpha = 1;
      if (faces) vis.forEach(function (p) {
        keep[p.c] = 1; var b = face[p.c], mine = p.c === opt.me;
        if (!b) { b = face[p.c] = document.createElement('button'); b.type = 'button'; b.className = 'acbm in' + (mine ? ' me' : '') + (opt.peer && opt.peer[p.c] ? ' pr' : ''); b.setAttribute('aria-label', p.e[0]);
          b.appendChild(faceSvg(p.e[4], mine ? 38 : 24)); if (mine) { var t = document.createElement('span'); t.textContent = p.e[0]; b.appendChild(t); b.style.zIndex = 3; }
          b.onclick = function () { card(p); }; lay.appendChild(b); }
        b.style.left = X(p.e[7]) + 'px'; b.style.top = Y(p.e[6]) + 'px';
      });
      for (var k in face) if (!keep[k]) { face[k].remove(); delete face[k]; }
      // 가까이 보면 단지 이름을 얼굴 아래에
      if (faces && vis.length <= 40) { g.font = '11.5px "IBM Plex Sans KR",sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
        vis.forEach(function (p) { if (p.c === opt.me) return; var x = X(p.e[7]), y = Y(p.e[6]) + 25, t = p.e[0].replace(/아파트$/, '').slice(0, 12);
          g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3.5; g.strokeText(t, x, y); g.fillStyle = '#6B7067'; g.fillText(t, x, y); }); g.textAlign = 'start'; }
      // 구 이름: 넓게 볼 때는 큰 구만
      if (z < 9000) { var need = z < 500 ? 120 : z < 900 ? 60 : z < 2000 ? 25 : 1, used = [];
        g.font = '600 12.5px "IBM Plex Sans KR",sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round';
        labs.forEach(function (l) { if (l.k < need) return; var x = X(l.x), y = Y(l.y); if (x < 20 || x > W - 20 || y < 14 || y > H - 14) return;
          for (var i = 0; i < used.length; i++) if (Math.abs(used[i][0] - x) < 62 && Math.abs(used[i][1] - y) < 18) return; used.push([x, y]);
          g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 4; g.strokeText(l.n, x, y + 4); g.fillStyle = '#1C1F1B'; g.fillText(l.n, x, y + 4); });
        g.textAlign = 'start'; }
      // 축척 막대
      var km = [50, 20, 10, 5, 2, 1, .5, .2, .1].filter(function (k) { return k / 111 * z <= 120; })[0] || .1, px = km / 111 * z;
      g.strokeStyle = '#1C1F1B'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, H - 22.5); g.lineTo(14 + px, H - 22.5); g.moveTo(14.5, H - 27); g.lineTo(14.5, H - 18); g.moveTo(14 + px - .5, H - 27); g.lineTo(14 + px - .5, H - 18); g.stroke();
      g.fillStyle = '#1C1F1B'; g.font = '600 11.5px "IBM Plex Sans KR",sans-serif'; g.fillText(km >= 1 ? km + 'km' : km * 1000 + 'm', 20 + px, H - 18);
      g.fillStyle = '#6B7067'; g.font = '11px "IBM Plex Sans KR",sans-serif'; g.textAlign = 'right'; g.fillText('집지니 지도 · 국토교통부 관리비 2026년 1~9월', W - 10, H - 18); g.textAlign = 'start';
      var n = vis.length; [1, 2, 3, 4, 5].forEach(function (t) { bar.children[t - 1].style.width = (n ? cnt[t] / n * 100 : 0) + '%'; });
      leg.textContent = ''; var hd = document.createElement('b'); hd.textContent = '보이는 범위 ' + n.toLocaleString('ko-KR') + '단지'; leg.appendChild(hd);
      [1, 2, 3, 4, 5].forEach(function (t) { var s = document.createElement('span'); s.style.color = C[t]; s.textContent = NAME[t] + ' ' + (n ? Math.round(cnt[t] / n * 100) : 0) + '%'; leg.appendChild(s); });
      place();
    }
    function zoom(f, px, py) { var nz = Math.max(zmin, Math.min(90000, z * f)); if (nz === z) return; var lng = cx + (px - W / 2) / z / KX, lat = cy - (py - H / 2) / z; z = nz; cx = lng - (px - W / 2) / z / KX; cy = lat + (py - H / 2) / z; draw(); }
    var ptr = {}, moved = 0, pinch = 0;
    m.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.oz,.acbtip,.acbm')) return; ptr[ev.pointerId] = [ev.clientX, ev.clientY]; moved = 0; m.classList.add('drag'); try { m.setPointerCapture(ev.pointerId); } catch (x) {} });
    m.addEventListener('pointermove', function (ev) {
      var p = ptr[ev.pointerId]; if (!p) return; var ids = Object.keys(ptr);
      if (ids.length === 2) { ptr[ev.pointerId] = [ev.clientX, ev.clientY]; var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = m.getBoundingClientRect();
        if (pinch) zoom(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pinch = d; moved = 99; return; }
      var dx = ev.clientX - p[0], dy = ev.clientY - p[1]; moved += Math.abs(dx) + Math.abs(dy); cx -= dx / z / KX; cy += dy / z; ptr[ev.pointerId] = [ev.clientX, ev.clientY]; draw();
    });
    function up(ev) {
      if (!ptr[ev.pointerId]) return; delete ptr[ev.pointerId]; pinch = 0; if (!Object.keys(ptr).length) m.classList.remove('drag');
      if (moved > 6 || ev.type !== 'pointerup') return;
      var r = m.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, best = null, bd = 14;
      pts.forEach(function (p) { var d = Math.hypot(X(p.e[7]) - mx, Y(p.e[6]) - my); if (d < bd) { bd = d; best = p; } });
      if (best) card(best); else if (tip) { tip.remove(); tip = null; tipP = null; }
    }
    m.addEventListener('pointerup', up); m.addEventListener('pointercancel', up);
    m.addEventListener('wheel', function (ev) { ev.preventDefault(); var r = m.getBoundingClientRect(); zoom(Math.exp(-ev.deltaY * 0.0016), ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
    m.addEventListener('dblclick', function (ev) { if (ev.target.closest('.oz')) return; var r = m.getBoundingClientRect(); zoom(2, ev.clientX - r.left, ev.clientY - r.top); });
    oz.children[0].onclick = function () { zoom(1.6, W / 2, H / 2); }; oz.children[1].onclick = function () { zoom(1 / 1.6, W / 2, H / 2); };
    function boot() { if (!size()) return; fit(); draw(); }
    if ('ResizeObserver' in window) { var first = true; new ResizeObserver(function () { if (first) { first = false; boot(); } else if (size()) draw(); }).observe(m); } else boot();
    return { zoomTo: function (lat, lng, nz) { cy = lat; cx = lng; z = nz || 12000; draw(); } };
  }
  function bigMap(m, root, onPick) { return getIdx(root).then(function (I) { return ownMap(m, I, root, { pick: onPick }); }); }
  window.JJacb = { watch: watch, load: load, render: render, faceSvg: faceSvg, NAME: NAME, C: C, bigMap: bigMap };
  document.querySelectorAll('section.acb[data-c]').forEach(load);
})();
