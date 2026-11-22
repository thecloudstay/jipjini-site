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
    if ($('nAll')) $('nAll').textContent = num(all); if ($('nAll2')) $('nAll2').textContent = num(all); $('nHave').textContent = num(t[1] + t[2]); $('nOpen').textContent = num(t[2]); if ($('irOpen')) $('irOpen').textContent = num(t[2]);
    init();
  });
  fetch('data/plans/opened.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (L) {
    try { var _l = L[L.length - 1]; ['dh1', 'dh2'].forEach(function (id) { var e = document.getElementById(id); if (e && _l) e.textContent = Number(_l.평형).toLocaleString('ko-KR'); }); } catch (_d) {}
    if (L.length > 1) { var a = L[L.length - 1], b = L[L.length - 2]; if (a.단지 > b.단지) document.querySelector('.stats .hot span').textContent = '도면 열림 · 어제보다 +' + num(a.단지 - b.단지); }
  }).catch(function () {});

  /* ── 실견적 점그래프: 평형(가로) × 공사비(세로), 점 크기 = 공종 수 ── */
  fetch('data/real-quotes.json').then(function (r) { return r.json(); }).then(function (d) {
    if (!$('caseChart')) return;
    var C = d.cases.filter(function (c) { return c.total > 5e6 && c.py >= 15; });
    $('nCase').textContent = d.cases.length;
    var full = C.filter(function (c) { return c.sections.length >= 12; }), pp = full.reduce(function (s, c) { return s + c.total / c.py; }, 0) / full.length / 1e4;
    $('caseCap').textContent = '점 하나가 견적서 한 장입니다. 12공종이 넘는 전체 수리는 평당 평균 약 ' + num(Math.round(pp)) + '만 원입니다. 공급가, 부가세 별도.';
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
  // 2026-11-22 집지니 지도 — 남의 지도(카카오) 대신 우리 바탕(바다·땅·시군구 경계·한강)을 직접 그린다. 「우리식 지도로, 아이덴티티」
  //   KMAP 은 예전 쓰던 이름 그대로(단계 getLevel·범위 getBounds·옮기기 setLevel/panTo/setCenter)라 아래 표시 코드는 그대로 돈다.
  function init() {
    var box = $('hmap'), cv = document.createElement('canvas'), lay = document.createElement('div'), zb = document.createElement('div'), g = cv.getContext('2d');
    box.textContent = ''; lay.className = 'hlay'; zb.className = 'hzoom'; zb.innerHTML = '<button type="button" aria-label="크게">+</button><button type="button" aria-label="작게">−</button>';
    box.appendChild(cv); box.appendChild(lay); box.appendChild(zb);
    var KX = 0.7934, W = 0, H = 0, dpr = 1, narrow = innerWidth < 860, cy = 37.48, cx = narrow ? 126.75 : 126.8, base = null, dong = null, dwait = null;
    var ZL = function (l) { return 111000 / (0.26 * Math.pow(2, l)); }, z = ZL(narrow ? 10 : 9), ZMIN = ZL(11), ZMAX = ZL(2);
    var X = function (lng) { return (lng - cx) * z * KX + W / 2; }, Y = function (lat) { return (cy - lat) * z + H / 2; };
    function size() { var r = box.getBoundingClientRect(); if (!r.width) return; dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    function ring(f) { g.moveTo(X(f[0]), Y(f[1])); for (var i = 2; i < f.length; i += 2) g.lineTo(X(f[i]), Y(f[i + 1])); g.closePath(); }
    function paint() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = base ? '#E6ECEE' : '#fff'; g.fillRect(0, 0, W, H);
      if (base) {
        g.beginPath(); base.land.forEach(ring); g.fillStyle = '#FBFBF8'; g.fill('evenodd');
        if (z >= 2200 && !dong && !dwait) dwait = fetch('data/acb/basemap_dong.json?v=20261122a').then(function (r) { return r.json(); }).then(function (j) { dong = j.sort(function (a, b) { return b.a - a.a; }); paint(); }).catch(function () {});   // 2026-11-22 가까이 보면 읍면동 경계·이름
        var la0 = cy - H / 2 / z, la1 = cy + H / 2 / z, lo0 = cx - W / 2 / z / KX, lo1 = cx + W / 2 / z / KX, DONG = z >= 2200 ? dong : null;
        if (DONG) { g.beginPath(); DONG.forEach(function (d) { if (d.x < lo0 - .06 || d.x > lo1 + .06 || d.y < la0 - .06 || d.y > la1 + .06) return; d.r.forEach(ring); }); g.strokeStyle = '#DDE2D8'; g.lineWidth = .8; g.lineJoin = 'round'; g.stroke(); }
        g.beginPath(); base.sgg.forEach(function (s) { s.r.forEach(ring); }); g.strokeStyle = z >= 2200 ? '#A9B0A3' : '#D3D8CE'; g.lineWidth = z < 900 ? .6 : z >= 2200 ? 1.4 : 1; g.lineJoin = 'round'; g.stroke();
      }
      // 도면이 열린 구역: 초록 테두리와 옅은 칠
      g.beginPath(); IDX.구역.forEach(function (r) { if (r.수 && r.수[2] > 0) r.경계.forEach(function (q) { q.forEach(function (c, k) { k ? g.lineTo(X(c[0]), Y(c[1])) : g.moveTo(X(c[0]), Y(c[1])); }); g.closePath(); }); });
      g.fillStyle = 'rgba(31,94,46,.12)'; g.fill(); g.strokeStyle = 'rgba(31,94,46,.8)'; g.lineWidth = 1.6; g.stroke();
      if (base) {
        g.beginPath(); base.sido.forEach(ring); g.strokeStyle = '#8E9489'; g.lineWidth = 1.2; g.stroke();
        g.beginPath(); base.land.forEach(ring); g.strokeStyle = '#B9C4C8'; g.lineWidth = .8; g.stroke();
        if (base.han) { g.beginPath(); base.han.forEach(function (f) { g.moveTo(X(f[0]), Y(f[1])); for (var i = 2; i < f.length; i += 2) g.lineTo(X(f[i]), Y(f[i + 1])); }); g.strokeStyle = '#C9D9DF'; g.lineCap = 'round'; g.lineWidth = Math.max(2.5, Math.min(60, 0.009 * z)); g.stroke(); g.lineCap = 'butt'; }
      }
      if (base && dong && z >= 4200) { var DONG = dong;  g.font = '500 11.5px "IBM Plex Sans KR",sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; var usedD = [];
          DONG.forEach(function (d) { if (Math.sqrt(d.a / 1e4) * z < 46) return; var x = X(d.x), y = Y(d.y); if (x < 24 || x > W - 24 || y < 14 || y > H - 26) return;
            for (var i = 0; i < usedD.length; i++) if (Math.abs(usedD[i][0] - x) < 54 && Math.abs(usedD[i][1] - y) < 16) return; usedD.push([x, y]);
            g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3.5; g.strokeText(d.n, x, y + 4); g.fillStyle = '#5A6157'; g.fillText(d.n, x, y + 4); }); g.textAlign = 'start'; }
      var km = [50, 20, 10, 5, 2, 1, .5, .2, .1].filter(function (k) { return k / 111 * z <= 120; })[0] || .1, px = km / 111 * z;
      g.strokeStyle = '#1C1F1B'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, H - 16.5); g.lineTo(14 + px, H - 16.5); g.moveTo(14.5, H - 21); g.lineTo(14.5, H - 12); g.moveTo(13.5 + px, H - 21); g.lineTo(13.5 + px, H - 12); g.stroke();
      g.fillStyle = '#1C1F1B'; g.font = '600 11.5px "IBM Plex Sans KR",sans-serif'; g.fillText(km >= 1 ? km + 'km' : km * 1000 + 'm', 20 + px, H - 12);
      g.fillStyle = '#6B7067'; g.font = '11px "IBM Plex Sans KR",sans-serif'; g.textAlign = 'right'; g.fillText('집지니 지도', W - 10, H - 12); g.textAlign = 'start';
      OV.forEach(place);
    }
    function place(o) { o.el.style.left = X(o.lng) + 'px'; o.el.style.top = Y(o.lat) + 'px'; }
    function idle() { paint(); clearTimeout(KT); KT = setTimeout(draw, 120); }
    function zoomAt(nz, px, py) { nz = Math.max(ZMIN, Math.min(ZMAX, nz)); var lng = cx + (px - W / 2) / z / KX, lat = cy - (py - H / 2) / z; z = nz; cx = lng - (px - W / 2) / z / KX; cy = lat + (py - H / 2) / z; idle(); }
    KMAP = {
      lay: lay, place: place,
      getLevel: function () { return Math.max(1, Math.round(Math.log(111000 / z / 0.26) / Math.LN2)); },
      getBounds: function () { return { s: cy - H / 2 / z, n: cy + H / 2 / z, w: cx - W / 2 / z / KX, e: cx + W / 2 / z / KX }; },
      setLevel: function (l, o) { z = ZL(l); if (o && o.anchor) { cy = o.anchor[0]; cx = o.anchor[1]; } idle(); },
      setCenter: function (c) { cy = c[0]; cx = c[1]; idle(); }, panTo: function (c) { cy = c[0]; cx = c[1]; idle(); }
    };
    var ptr = {}, moved = 0, pd = 0;
    box.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; ptr[e.pointerId] = [e.clientX, e.clientY]; moved = 0; box.classList.add('drag'); try { box.setPointerCapture(e.pointerId); } catch (_e) {} });
    box.addEventListener('pointermove', function (e) { var p = ptr[e.pointerId]; if (!p) return; var ids = Object.keys(ptr);
      if (ids.length === 2) { ptr[e.pointerId] = [e.clientX, e.clientY]; var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = box.getBoundingClientRect(); if (pd) zoomAt(z * d / pd, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pd = d; return; }
      cx -= (e.clientX - p[0]) / z / KX; cy += (e.clientY - p[1]) / z; moved += Math.abs(e.clientX - p[0]) + Math.abs(e.clientY - p[1]); ptr[e.pointerId] = [e.clientX, e.clientY]; paint(); });
    var up = function (e) { if (!ptr[e.pointerId]) return; delete ptr[e.pointerId]; pd = 0; box.classList.remove('drag'); if (moved > 3) idle(); };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); var r = box.getBoundingClientRect(); zoomAt(z * Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top); }, { passive: false });   // 쪽을 내리다 지도에 걸리지 않게: 바퀴는 Ctrl 과 함께일 때만 확대
    box.addEventListener('dblclick', function (e) { if (e.target.closest('button')) return; var r = box.getBoundingClientRect(); zoomAt(z * 2, e.clientX - r.left, e.clientY - r.top); });
    zb.children[0].onclick = function () { zoomAt(z * 2, W / 2, H / 2); }; zb.children[1].onclick = function () { zoomAt(z / 2, W / 2, H / 2); };
    window.addEventListener('resize', function () { size(); idle(); });
    size(); paint(); draw();
    fetch('data/acb/basemap.json?v=20261122b').then(function (r) { return r.json(); }).then(function (j) { base = j; paint(); }).catch(function () {});
  }
  function put(el, lat, lng, zi, ya) { el.style.position = 'absolute'; el.style.transform = 'translate(-50%,' + (-(ya == null ? 1 : ya) * 100) + '%)'; el.style.zIndex = zi || 1; var o = { el: el, lat: lat, lng: lng }; KMAP.place(o); KMAP.lay.appendChild(el); OV.push(o); }
  function clear() { OV.forEach(function (o) { o.el.remove(); }); OV = []; }
  function inView(b, lat, lng) { return lat > b.s && lat < b.n && lng > b.w && lng < b.e; }
  function draw() {
    if (!KMAP) return; clear(); var lv = KMAP.getLevel(), b = KMAP.getBounds();
    if (lv >= 10) {   // 시도
      var S = {}; IDX.구역.forEach(function (r) { var s = S[r.짧은시도] = S[r.짧은시도] || { n: 0, o: 0, x: 0, y: 0, k: 0 }; var t = r.수[0] + r.수[1] + r.수[2]; s.n += t; s.o += r.수[2]; s.x += r.가운데[0] * t; s.y += r.가운데[1] * t; s.k += t; });
      Object.keys(S).forEach(function (k) { var s = S[k]; if (!s.k) return; var d = mk('mk big' + (s.o ? ' has' : ''), '<b>' + k + '</b><span>' + num(s.n) + '</span>' + (s.o ? '<em>도면 ' + s.o + '</em>' : ''));
        d.onclick = function () { KMAP.setLevel(8, { anchor: [s.y / s.k, s.x / s.k] }); }; put(d, s.y / s.k, s.x / s.k, 5); });
      return;
    }
    if (lv >= 7) {   // 구역
      IDX.구역.forEach(function (r) { var la = r.가운데[1], ln = r.가운데[0]; if (!inView(b, la, ln)) return; var t = r.수[0] + r.수[1] + r.수[2], o = r.수[2];
        var d = mk('mk' + (o ? ' has' : ''), '<b>' + esc(r.이름) + '</b>' + (o ? '<em>' + o + '</em>' : '<span>' + num(t) + '</span>'));
        d.onclick = function () { KMAP.setLevel(5, { anchor: [la, ln] }); }; put(d, la, ln, o ? 6 : 4); });
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
    if (KMAP) { KMAP.panTo([x.ll[0], x.ll[1]]); draw(); }
  }
  $('cardX').onclick = function () { $('card').hidden = true; OPEN = ''; draw(); };

  /* ── 찾기 ── */
  var ALL = null;
  function allRows() { if (ALL) return Promise.resolve(ALL); return Promise.all(IDX.구역.map(function (r) { return load(r.id); })).then(function (L) { return (ALL = [].concat.apply([], L)); }); }
  $('q').addEventListener('focus', function () { if (IDX) allRows(); });
  $('q').addEventListener('input', function () { var v = this.value.trim(); if (!v || !IDX) { $('hits').hidden = true; return; } allRows().then(function (A) { show(A, v); }); });
  $('find').addEventListener('submit', function (e) { e.preventDefault(); var f = $('hits').querySelector('li'); if (f) f.click(); });
  function show(A, v) {
    var k = v.replace(/\s/g, ''), r = (window.JJSearch ? JJSearch.rank(v, A, function (x) { return { n: x.n, g: x.g, d: x.d }; }, 12) : A.filter(function (x) { return (x.n + x.d + x.g).replace(/\s/g, '').indexOf(k) >= 0; }).slice(0, 12)), ul = $('hits');
    ul.innerHTML = r.length ? r.map(function (x, i) { return '<li data-i="' + i + '" class="' + (x.s === 2 ? 'on' : '') + '">' + esc(x.n) + '<small>' + esc(x.g) + ' · ' + ['예정', '평면 확보', '도면 열림'][x.s] + '</small></li>'; }).join('') : '<li>찾는 단지가 없습니다</li>';
    ul.hidden = false;
    [].forEach.call(ul.querySelectorAll('li[data-i]'), function (li) { li.onclick = function () { var x = r[+li.dataset.i]; ul.hidden = true; $('q').value = x.n; track('home_find', { apt: x.c });
      if (KMAP && x.ll) { KMAP.setLevel(4); KMAP.setCenter([x.ll[0], x.ll[1]]); } pick(x); }; });
  }
  document.addEventListener('click', function (e) { if (!$('find').contains(e.target)) $('hits').hidden = true; });

  /* ── 기능 그림: 보일 때 움직인다 ── */
  getPlan('A10025531').then(function (d) { ['planVis'].forEach(function (id) { var e = $(id); if (!e) return; e.innerHTML = planSVG(d.평형[0].plan, 'psvg'); fit(e); see(e); }); }).catch(function () {});
  /* 화면 사진 넘김(작동 모습) */
  [].forEach.call(document.querySelectorAll('.slides'), function (b) { var im = b.querySelectorAll('img'), c = b.querySelector('.sc'), k = 0; if (!im.length) return;
    var show = function () { [].forEach.call(im, function (x, j) { x.classList.toggle('on', j === k); }); if (c) c.textContent = im[k].dataset.c || ''; };
    show(); setInterval(function () { k = (k + 1) % im.length; show(); }, 2600); });
  ['stack', 'donut', 'ways'].forEach(function (id) { if ($(id)) see($(id)); });
  /* 고객 세분화 칸: 고르면 그 사람에게 맞는 세 걸음을 보여 준다(고른 것은 이 기기에만 기억) */
  var tabs = document.querySelectorAll('.wt button'), pans = document.querySelectorAll('.wp');
  function seg(k) { [].forEach.call(tabs, function (b) { var on = b.dataset.seg === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); [].forEach.call(pans, function (p) { p.hidden = p.dataset.seg !== k; }); }
  [].forEach.call(tabs, function (b) { b.onclick = function () { seg(b.dataset.seg); track('home_seg', { seg: b.dataset.seg }); try { localStorage.setItem('jj_seg', b.dataset.seg); } catch (e) {} }; });
  try { var sv = localStorage.getItem('jj_seg'); if (sv) seg(sv); } catch (e) {}
  [].forEach.call(document.querySelectorAll('[data-go=find]'), function (a) { a.addEventListener('click', function () { setTimeout(function () { $('q').focus(); }, 500); }); });
  function see(el) { if (!('IntersectionObserver' in window)) return el.classList.add('go'); new IntersectionObserver(function (E, o) { E.forEach(function (e) { if (e.isIntersecting) { el.classList.add('go'); o.disconnect(); } }); }, { threshold: .35 }).observe(el); }
})();
