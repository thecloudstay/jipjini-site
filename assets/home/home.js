/* 집지니 첫 화면 — 지도가 메인 (2026-11-12)
   자료: data/apt/index.json(구역·숫자), data/apt/<구역>.json(단지), data/plans/<단지>.json(집지니가 다시 그린 도면), data/plans/opened.json(날마다 열린 수) */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var num = function (v) { return Number(v).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var track = function (e, p) { try { window.gtag && gtag('event', e, p || {}); } catch (x) {} };
  var IDX = null, CACHE = {}, KMAP = null, OV = [], OPEN = '', K = null, KT = 0;

  /* ── 도면 그림(집지니가 다시 그린 것만) ── */
  function planSVG(p, cls) {
    var G = p.그림 || {}, W = p.W || 923, H = p.H || 676, h = [];
    var xs = [], ys = [];
    (p.rooms || []).forEach(function (r) { r.pts.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var x0 = Math.min.apply(0, xs) - 16, y0 = Math.min.apply(0, ys) - 16, x1 = Math.max.apply(0, xs) + 16, y1 = Math.max.apply(0, ys) + 16;
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
    h.push('<svg viewBox="' + [x0, y0, x1 - x0, y1 - y0].map(function (v) { return v.toFixed(0); }).join(' ') + '" xmlns="http://www.w3.org/2000/svg" class="' + (cls || '') + '">');
    if (G.벽) h.push('<path class="wall" pathLength="1" fill-rule="' + (G.벽채움 === 'nonzero' ? 'nonzero' : 'evenodd') + '" d="' + G.벽 + '" fill="#111311"/>');
    (G.샷시 || []).forEach(function (q) { var hz = q[0] === 'h', a = q[1], b = q[2], c = q[3], d = q[4];
      h.push(hz ? '<line class="win" x1="' + a + '" y1="' + ((b + d) / 2) + '" x2="' + c + '" y2="' + ((b + d) / 2) + '" stroke="#1F5E2E" stroke-width="3"/>'
                : '<line class="win" x1="' + ((a + c) / 2) + '" y1="' + b + '" x2="' + ((a + c) / 2) + '" y2="' + d + '" stroke="#1F5E2E" stroke-width="3"/>'); });
    (G.창선 || []).forEach(function (q) { var hz = q[0] === 'h';
      h.push('<line class="win" x1="' + (hz ? q[2] : q[1]) + '" y1="' + (hz ? q[1] : q[2]) + '" x2="' + (hz ? q[3] : q[1]) + '" y2="' + (hz ? q[1] : q[3]) + '" stroke="#1F5E2E" stroke-width="3"/>'); });
    h.push('</svg>'); return h.join('');
  }
  // 방 좌표와 벽 그림의 자리 맞춤이 평면마다 달라, 그린 뒤 벽 크기에 맞춰 화면 틀을 다시 잡는다
  function fit(el) { var v = el && el.querySelector('svg'), w = v && v.querySelector('.wall'); if (!w) return; try { var b = w.getBBox(), m = Math.max(b.width, b.height) * 0.04; v.setAttribute('viewBox', [b.x - m, b.y - m, b.width + 2 * m, b.height + 2 * m].map(function (x) { return x.toFixed(1); }).join(' ')); } catch (e) {} }
  function getPlan(c) { return fetch('data/plans/' + c + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }); }

  /* ── 숫자 ── */
  fetch('data/apt/index.json').then(function (r) { return r.json(); }).then(function (d) {
    IDX = d; var t = d.합계, all = t[0] + t[1] + t[2];
    $('nAll').textContent = num(all); if ($('nAll2')) $('nAll2').textContent = num(all); $('nHave').textContent = num(t[1] + t[2]); $('nOpen').textContent = num(t[2]);
    if (window.JJ_KAKAO_KEY) kakao();
  });
  fetch('data/plans/opened.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (L) {
    if (L.length > 1) { var a = L[L.length - 1], b = L[L.length - 2]; if (a.단지 > b.단지) document.querySelector('.stats .hot span').textContent = '도면 열림 · 어제보다 +' + num(a.단지 - b.단지); }
  }).catch(function () {});

  /* ── 실견적 점그래프: 평형(가로) × 공사비(세로), 점 크기 = 공종 수 ── */
  fetch('data/real-quotes.json').then(function (r) { return r.json(); }).then(function (d) {
    var C = d.cases.filter(function (c) { return c.total > 5e6 && c.py >= 15; });
    $('nCase').textContent = d.cases.length;
    var full = C.filter(function (c) { return c.sections.length >= 12; }), pp = full.reduce(function (s, c) { return s + c.total / c.py; }, 0) / full.length / 1e4;
    $('caseCap').textContent = '점 하나가 견적서 한 장 · 12공종 넘는 전체 수리 평당 평균 약 ' + num(Math.round(pp)) + '만 원 · 공급가, 부가세 별도';
    var W = 640, H = 300, X = function (v) { return 40 + (v - 10) / 55 * (W - 60); }, Y = function (v) { return H - 20 - v / 7000 * (H - 40); }, h = [];
    h.push('<svg viewBox="0 0 ' + W + ' ' + H + '" font-family="Pretendard,sans-serif">');
    [0, 2000, 4000, 6000].forEach(function (v) { h.push('<line x1="40" x2="' + (W - 10) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#E2E4DF"/><text x="34" y="' + (Y(v) + 4) + '" font-size="11" fill="#9A9E97" text-anchor="end">' + (v ? num(v / 1000) + '천만' : '0') + '</text>'); });
    [20, 30, 40, 50, 60].forEach(function (v) { h.push('<text x="' + X(v) + '" y="' + (H) + '" font-size="11" fill="#9A9E97" text-anchor="middle">' + v + '평</text>'); });
    C.forEach(function (c, i) { var r = 5 + c.sections.length * .55, man = Math.round(c.total / 1e4);
      h.push('<g class="pt" style="--d:' + (i * 0.08) + 's"><circle cx="' + X(c.py) + '" cy="' + Y(man) + '" r="' + r + '" fill="#1F5E2E" fill-opacity=".85" stroke="#fff" stroke-width="2"><title>' + esc(c.region) + ' ' + c.py + '평 · ' + num(man) + '만 원 · ' + c.sections.length + '공종</title></circle></g>'); });
    var top = C.slice().sort(function (a, b) { return b.total - a.total; })[0];
    h.push('</svg>'); $('caseChart').innerHTML = h.join('');
  }).catch(function () {});

  /* ── 지도 ── */
  function kakao() {
    var s = document.createElement('script');
    s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(window.JJ_KAKAO_KEY);
    s.onload = function () { window.kakao.maps.load(init); };
    document.head.appendChild(s);
  }
  function init() {
    K = window.kakao.maps; var narrow = innerWidth < 860;
    KMAP = new K.Map($('hmap'), { center: new K.LatLng(37.48, narrow ? 126.75 : 126.8), level: narrow ? 10 : 9 }); KMAP.addControl(new K.ZoomControl(), K.ControlPosition.LEFT);
    KMAP.setMaxLevel(11); KMAP.setZoomable(true);
    IDX.구역.forEach(function (r) {
      var on = r.수 && r.수[2] > 0;
      if (on) r.경계.forEach(function (ring) {
        new K.Polygon({ map: KMAP, path: ring.map(function (q) { return new K.LatLng(q[1], q[0]); }), strokeWeight: 1.6, strokeColor: '#1F5E2E', strokeOpacity: .8, fillColor: '#1F5E2E', fillOpacity: .12 });
      });
    });
    K.event.addListener(KMAP, 'idle', function () { clearTimeout(KT); KT = setTimeout(draw, 80); });
    draw();
  }
  function put(el, lat, lng, z, ya) { var o = new K.CustomOverlay({ position: new K.LatLng(lat, lng), content: el, yAnchor: ya == null ? 1 : ya, zIndex: z || 1 }); o.setMap(KMAP); OV.push(o); }
  function clear() { OV.forEach(function (o) { o.setMap(null); }); OV = []; }
  function inView(b, lat, lng) { return lat > b.getSouthWest().getLat() && lat < b.getNorthEast().getLat() && lng > b.getSouthWest().getLng() && lng < b.getNorthEast().getLng(); }
  function draw() {
    if (!KMAP) return; clear(); var lv = KMAP.getLevel(), b = KMAP.getBounds();
    if (lv >= 10) {   // 시도
      var S = {}; IDX.구역.forEach(function (r) { var s = S[r.짧은시도] = S[r.짧은시도] || { n: 0, o: 0, x: 0, y: 0, k: 0 }; var t = r.수[0] + r.수[1] + r.수[2]; s.n += t; s.o += r.수[2]; s.x += r.가운데[0] * t; s.y += r.가운데[1] * t; s.k += t; });
      Object.keys(S).forEach(function (k) { var s = S[k]; if (!s.k) return; var d = mk('mk big' + (s.o ? ' has' : ''), '<b>' + k + '</b><span>' + num(s.n) + '</span>' + (s.o ? '<em>도면 ' + s.o + '</em>' : ''));
        d.onclick = function () { KMAP.setLevel(8, { anchor: new K.LatLng(s.y / s.k, s.x / s.k) }); }; put(d, s.y / s.k, s.x / s.k, 5); });
      return;
    }
    if (lv >= 7) {   // 구역
      IDX.구역.forEach(function (r) { var la = r.가운데[1], ln = r.가운데[0]; if (!inView(b, la, ln)) return; var t = r.수[0] + r.수[1] + r.수[2], o = r.수[2];
        var d = mk('mk' + (o ? ' has' : ''), '<b>' + esc(r.이름) + '</b>' + (o ? '<em>' + o + '</em>' : '<span>' + num(t) + '</span>'));
        d.onclick = function () { KMAP.setLevel(5, { anchor: new K.LatLng(la, ln) }); }; put(d, la, ln, o ? 6 : 4); });
      return;
    }
    // 단지 — 화면 안 구역만 불러온다
    var ids = IDX.구역.filter(function (r) { return r.경계.some(function (g) { return g.some(function (q) { return inView(b, q[1], q[0]); }); }) || inView(b, r.가운데[1], r.가운데[0]); }).map(function (r) { return r.id; });
    Promise.all(ids.map(load)).then(function (L) {
      if (KMAP.getLevel() >= 7) return; clear(); var nb = KMAP.getBounds(), named = KMAP.getLevel() <= 4;
      L.forEach(function (rows) { rows.forEach(function (x) {
        if (!x.ll || !inView(nb, x.ll[0], x.ll[1])) return;
        if (x.s === 2) { var d = document.createElement('button'); d.className = 'pin' + (OPEN === x.c ? ' on' : ''); d.title = x.n;
          d.innerHTML = '<i>집</i>' + (named || OPEN === x.c ? '<span>' + esc(x.n.replace(/아파트$/, '')) + '</span>' : '');
          d.onclick = function () { pick(x); }; put(d, x.ll[0], x.ll[1], OPEN === x.c ? 9 : 8); }
        else if (lv <= 5 || x.s === 1) { var e = document.createElement('button'); e.className = 'dot s' + x.s; e.title = x.n; e.onclick = function () { pick(x); }; put(e, x.ll[0], x.ll[1], 2, .5); }
      }); });
    });
  }
  function mk(cls, html) { var d = document.createElement('button'); d.className = cls; d.innerHTML = html; return d; }
  function load(id) { if (CACHE[id]) return Promise.resolve(CACHE[id]); return fetch('data/apt/' + id + '.json').then(function (r) { return r.json(); }).then(function (x) { x.forEach(function (y) { y.rid = id; }); return (CACHE[id] = x); }); }

  /* ── 단지 카드 ── */
  function pick(x) {
    OPEN = x.c; track('home_pick', { apt: x.c, s: x.s });
    $('cardG').textContent = [x.g, x.d, x.y ? x.y + '년' : ''].filter(Boolean).join(' · ');
    $('cardN').textContent = x.n; $('card').hidden = false;
    var go = $('cardGo');
    if (x.s === 2) {
      go.textContent = '이 도면으로 꾸미기'; go.href = 'cad.html?apt=' + encodeURIComponent(x.c) + '&n=' + encodeURIComponent(x.n);
      $('cardPv').innerHTML = '<p class="none">도면을 불러오는 중</p>'; $('cardM').textContent = '';
      getPlan(x.c).then(function (d) { if (OPEN !== x.c) return; var t = d.평형[0], s = t.plan.sum || {};
        $('cardPv').innerHTML = planSVG(t.plan); fit($('cardPv'));
        $('cardM').textContent = '평형 ' + d.평형.map(function (q) { return q.이름; }).join(' · ') + ' · 전용 ' + (t.전용 || '') + '㎡ · 방 ' + (s.방 || '-') + ' · 욕실 ' + (s.욕실 || '-') + ' · 원본 대조 ' + t.점수 + '점';
      }).catch(function () { $('cardPv').innerHTML = '<p class="none">도면을 불러오지 못했습니다</p>'; });
    } else {
      go.textContent = x.s === 1 ? '평수로 먼저 시작하기' : '평면 사진이나 평수로 시작하기';
      go.href = 'cad.html?from=apt&apt=' + encodeURIComponent(x.c) + '&n=' + encodeURIComponent(x.n);
      $('cardPv').innerHTML = '<p class="none">' + (x.s === 1 ? '평면도를 확보했습니다.<br>다시 그려 원본과 대조한 뒤 곧 엽니다.' : '아직 도면이 없습니다.<br>평면 사진을 올리시면 먼저 그려 드립니다.') + '</p>';
      $('cardM').textContent = x.a || '';
    }
    if (KMAP) { KMAP.panTo(new K.LatLng(x.ll[0], x.ll[1])); draw(); }
  }
  $('cardX').onclick = function () { $('card').hidden = true; OPEN = ''; draw(); };

  /* ── 찾기 ── */
  var ALL = null;
  function allRows() { if (ALL) return Promise.resolve(ALL); return Promise.all(IDX.구역.map(function (r) { return load(r.id); })).then(function (L) { return (ALL = [].concat.apply([], L)); }); }
  $('q').addEventListener('focus', function () { if (IDX) allRows(); });
  $('q').addEventListener('input', function () { var v = this.value.trim(); if (!v || !IDX) { $('hits').hidden = true; return; } allRows().then(function (A) { show(A, v); }); });
  $('find').addEventListener('submit', function (e) { e.preventDefault(); var f = $('hits').querySelector('li'); if (f) f.click(); });
  function show(A, v) {
    var k = v.replace(/\s/g, ''), r = A.filter(function (x) { return (x.n + x.d + x.g).replace(/\s/g, '').indexOf(k) >= 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 12), ul = $('hits');
    ul.innerHTML = r.length ? r.map(function (x, i) { return '<li data-i="' + i + '" class="' + (x.s === 2 ? 'on' : '') + '">' + esc(x.n) + '<small>' + esc(x.g) + ' · ' + ['예정', '평면 확보', '도면 열림'][x.s] + '</small></li>'; }).join('') : '<li>찾는 단지가 없습니다</li>';
    ul.hidden = false;
    [].forEach.call(ul.querySelectorAll('li[data-i]'), function (li) { li.onclick = function () { var x = r[+li.dataset.i]; ul.hidden = true; $('q').value = x.n; track('home_find', { apt: x.c });
      if (KMAP && x.ll) { KMAP.setLevel(4); KMAP.setCenter(new K.LatLng(x.ll[0], x.ll[1])); } pick(x); }; });
  }
  document.addEventListener('click', function (e) { if (!$('find').contains(e.target)) $('hits').hidden = true; });

  /* ── 기능 그림: 보일 때 움직인다 ── */
  getPlan('A10025531').then(function (d) { ['planVis', 'planVis2'].forEach(function (id) { var e = $(id); if (!e) return; e.innerHTML = planSVG(d.평형[0].plan, 'psvg'); fit(e); see(e); }); }).catch(function () {});
  see($('stack'));
  [].forEach.call(document.querySelectorAll('[data-go=find]'), function (a) { a.addEventListener('click', function () { setTimeout(function () { $('q').focus(); }, 500); }); });
  function see(el) { if (!('IntersectionObserver' in window)) return el.classList.add('go'); new IntersectionObserver(function (E, o) { E.forEach(function (e) { if (e.isIntersecting) { el.classList.add('go'); o.disconnect(); } }); }, { threshold: .35 }).observe(el); }
})();
