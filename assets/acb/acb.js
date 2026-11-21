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
    if (t == 4) { el(svg, 'path', Object.assign({ d: 'M' + (cx - w) + ',' + (y + r * .14) + ' Q' + cx + ',' + (y - r * .26) + ' ' + (cx + w) + ',' + (y + r * .14) }, cap)); el(svg, 'path', { d: 'M' + (cx + ex) + ',' + (cy - r * .02) + ' q ' + (-r * .08) + ',' + (r * .18) + ' 0,' + (r * .22) + ' q ' + (r * .08) + ',' + (-r * .04) + ' 0,' + (-r * .22), fill: '#7FA7C9' }); }
    if (t == 5) el(svg, 'path', Object.assign({ d: 'M' + (cx - w) + ',' + (y + r * .12) + ' L' + (cx - w * .5) + ',' + (y - r * .02) + ' L' + cx + ',' + (y + r * .12) + ' L' + (cx + w * .5) + ',' + (y - r * .02) + ' L' + (cx + w) + ',' + (y + r * .12), 'stroke-linejoin': 'round' }, cap));
    return svg;
  }
  function faceSvg(t, size) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 ' + size + ' ' + size); s.setAttribute('role', 'img'); s.setAttribute('aria-label', NAME[t]); return face(s, t, size / 2, size / 2, size / 2 - 3); }
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
      el(svg, 'path', { d: 'M' + X(i) + ',' + Y(a) + 'L' + X(i + 1) + ',' + Y(b) + 'L' + X(i + 1) + ',' + Y(pb) + 'L' + X(i) + ',' + Y(pa) + 'Z', fill: up ? '#B3261E' : '#1F5E2E', opacity: .12 });
    }
    s.forEach(function (x, i) { d1 += (i ? 'L' : 'M') + X(i) + ',' + Y(x[1]); });
    el(svg, 'path', { d: d2, fill: 'none', stroke: '#6B7067', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
    el(svg, 'path', { d: d1, fill: 'none', stroke: C[o.lv], 'stroke-width': 3, 'stroke-linejoin': 'round' });
    var li = n - 1; el(svg, 'circle', { cx: X(li), cy: Y(s[li][1]), r: 4.5, fill: C[o.lv] });
    return svg;
  }

  function render(box, o, root) {
    var diff = o.m2 - o.pmed, pct = Math.round(diff / o.pmed * 1000) / 10;
    var main = (o.pf || []).slice().sort(function (a, b) { return b[1] - a[1]; })[0];
    var ex = main ? main[0] : 84, sup = ex * (o.k || 1.3), mon = diff * sup;
    var big = o.lv >= 4, same = o.lv == 3;
    var say = same
      ? '비슷한 집 10곳과 거의 같습니다. ㎡당 <b>' + won(o.m2) + '</b>, 비슷한 집 가운데값은 ' + won(o.pmed) + '입니다.'
      : '비슷한 집 10곳보다 ㎡당 <b class="' + (diff > 0 ? 'up' : 'dn') + '">' + won(Math.abs(diff)) + ' ' + (diff > 0 ? '더' : '덜') + '</b> 냅니다 (' + (pct > 0 ? '+' : '') + pct + '%). 전용 ' + Math.round(ex) + '㎡ 세대로 치면 한 달 약 <b class="' + (diff > 0 ? 'up' : 'dn') + '">' + man(mon) + '</b>, 1년 약 ' + man(mon * 12) + '입니다.';
    var h = '<h2>' + esc(o.n) + ' 관리비 <small>집지니 아관비 지수</small></h2>';
    h += '<div class="ahead"><div class="fbig"></div><div><p class="lvn" style="color:' + C[o.lv] + '">' + NAME[o.lv] + '<small>지수 ' + o.ix + '</small></p><p class="say">' + say + '</p></div></div>';
    h += '<div class="scale5">' + [1, 2, 3, 4, 5].map(function (t) { return '<span' + (t == o.lv ? ' class="on" style="border-color:' + C[t] + '"' : ' style="border-color:' + C[t] + '55"') + '>' + NAME[t] + '<br>' + RANGE[t] + '</span>'; }).join('') + '</div>';
    if (o.ga && o.pf && o.pf.length) {
      var hiM = o.s.reduce(function (a, x) { return x[1] > a[1] ? x : a; }), loM = o.s.reduce(function (a, x) { return x[1] < a[1] ? x : a; });
      h += '<h3>평형별 한 달 관리비<small>2026년 1~9월 평균 · 세대 몫 어림</small></h3><table class="br ptype"><thead><tr><th>전용</th><th class="hide">세대</th><th>면적대로 나뉘는 몫</th><th>쓰는 만큼 (평균)</th><th>합계</th><th class="hide">가장 싼 달 ~ 비싼 달</th></tr></thead><tbody>' +
        o.pf.slice().sort(function (a, b) { return a[0] - b[0]; }).map(function (p) {
          var sp = p[0] * (o.k || 1.3);
          return '<tr><td>' + Math.round(p[0]) + '㎡ <small>약 ' + Math.round(sp / 3.3058) + '평</small></td><td class="hide">' + p[1].toLocaleString('ko-KR') + '</td><td>' + man(o.ga * sp) + '</td><td>' + man(o.iu * sp) + '</td><td><b>' + man((o.ga + o.iu) * sp) + '</b></td><td class="hide">' + man(o.lo * sp) + ' ~ ' + man(o.hi * sp) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="anote" style="margin-top:8px">쓰는 만큼은 단지 평균이라 집마다 다릅니다. 가장 비싼 달 ' + (+hiM[0].slice(2)) + '월, 가장 싼 달 ' + (+loM[0].slice(2)) + '월.</p>';
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
    h += '<h3>옆 아파트 지도<small>얼굴을 누르면 단지 이름과 관리비가 나옵니다</small></h3><div class="amap"></div>';
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
    drawMap(box, o, root);
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
  function drawMap(box, o, root) {
    var m = box.querySelector('.amap'); if (!m) return;
    getIdx(root).then(function (I) {
      var me = I[o.c]; if (!me || me.length < 8) { m.previousElementSibling.remove(); m.remove(); return; }
      var lat = me[6], lng = me[7], peer = {}; o.pl.forEach(function (p) { peer[p[0]] = 1; });
      var pts = [];
      for (var c in I) { var e = I[c]; if (e.length < 8) continue; var d = dist(lat, lng, e[6], e[7]); if (c === o.c || d < 1.0) pts.push([c, e, d]); }
      pts.sort(function (a, b) { return a[2] - b[2]; }); pts = pts.slice(0, 31);
      return getKakao(root).then(function (K) {
        m.style.height = (box.clientWidth < 600 ? 320 : 400) + 'px';
        var map = new K.Map(m, { center: new K.LatLng(lat, lng), level: 5 }), bounds = new K.LatLngBounds(), tip = null;
        function card(c, e) {
          if (tip) tip.setMap(null);
          var d = document.createElement('div'); d.className = 'acbtip';
          d.innerHTML = '<b></b><span></span>' + (c === o.c ? '' : '<a>관리비 보기</a>');
          d.querySelector('b').textContent = e[0];
          d.querySelector('span').textContent = '㎡당 ' + e[2].toLocaleString('ko-KR') + '원 · ' + NAME[e[4]] + ' ' + e[3];
          var a = d.querySelector('a'); if (a) a.href = root + 'acb/?c=' + c;
          tip = new K.CustomOverlay({ position: new K.LatLng(e[6], e[7]), content: d, yAnchor: 1.35, zIndex: 20 }); tip.setMap(map);
        }
        pts.forEach(function (p) {
          var c = p[0], e = p[1], mine = c === o.c;
          var b = document.createElement('button'); b.type = 'button'; b.className = 'acbm' + (mine ? ' me' : '') + (peer[c] ? ' pr' : '');
          b.setAttribute('aria-label', e[0]); b.appendChild(faceSvg(e[4], mine ? 38 : 24));
          if (mine) { var t = document.createElement('span'); t.textContent = e[0]; b.appendChild(t); }
          b.onclick = function () { card(c, e); };
          new K.CustomOverlay({ position: new K.LatLng(e[6], e[7]), content: b, yAnchor: .5, xAnchor: mine ? .12 : .5, zIndex: mine ? 9 : 1 }).setMap(map);
          bounds.extend(new K.LatLng(e[6], e[7]));
        });
        if (pts.length > 1) map.setBounds(bounds, 24, 24, 24, 24);
        K.event.addListener(map, 'click', function () { if (tip) { tip.setMap(null); tip = null; } });
      });
    }).catch(function () { var h = m.previousElementSibling; if (h) h.remove(); m.remove(); });
  }

  function load(box) {
    var c = box.getAttribute('data-c'), f = box.getAttribute('data-f'), root = box.getAttribute('data-root') || '/';
    if (!c || !f) return;
    fetch(root + 'data/acb/' + encodeURIComponent(f) + '.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (L) {
      var o = L.filter(function (x) { return x.c === c; })[0];
      if (o) render(box, o, root); else box.remove();
    }).catch(function (e) { if (window.console) console.warn('아관비', e); box.remove(); });
  }
  window.JJacb = { load: load, render: render, faceSvg: faceSvg, NAME: NAME, C: C };
  document.querySelectorAll('section.acb[data-c]').forEach(load);
})();
