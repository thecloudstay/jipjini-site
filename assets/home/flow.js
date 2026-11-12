/* 첫 화면 오른쪽: 평면도 한 장이 발주까지 바뀌어 가는 다섯 단계 (2026-11-12)
   ① 고객이 올린 평면도 사진 → ② 벡터 변환 → ③ 집지니 CAD → ④ 자동 물량 → ⑤ 발주
   보기는 송도파크자이 131A. 원본 평면도 그림은 쓰지 않고, 집지니가 다시 그린 좌표로 사진 느낌까지 꾸민다.
   셈법은 estim.js와 같다: 바닥 = 넓이, 도배 = 둘레 × 2.3m + 천장, 욕실 타일 = 바닥 + 둘레 × 2.4m (문·창 빼기 전 어림) */
(function () {
  var box = document.getElementById('heroFlow'); if (!box) return;
  var steps = [].slice.call(document.querySelectorAll('#heroSteps button'));
  var tag = box.querySelector('.ftag'), ord = box.querySelector('.ford'), cur = 1, timer = null, paused = false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var num = function (v, d) { return (+v).toLocaleString('ko-KR', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
  var P = function (pts) { return pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' '); };

  fetch('data/plans/A10025531.json').then(function (r) { return r.json(); }).then(function (d) {
    var p = d.평형[0].plan, mm = p.mmpp || 20, R = [], vtx = 0, xs = [], ys = [];
    var RAW = p.rooms.map(function (r) { return r.pts; });
    // 인식 좌표의 1~5px 흔들림 때문에 벽이 찌그러져 보인다: 가까운 x·y 값을 한 줄로 모으고, 생긴 군더더기 꼭짓점을 지운다
    var snap = (function () {
      var T = 6, ax = [], ay = [];
      p.rooms.forEach(function (r) { r.pts.forEach(function (q) { ax.push(q[0]); ay.push(q[1]); }); });
      (p.외곽 || []).forEach(function (q) { ax.push(q[0]); ay.push(q[1]); });
      function grp(a) { a = a.slice().sort(function (u, v) { return u - v; }); var g = [], c = [a[0]];
        for (var i = 1; i < a.length; i++) { if (a[i] - c[c.length - 1] <= T) c.push(a[i]); else { g.push(c); c = [a[i]]; } } g.push(c);
        return g.map(function (c) { var m = c.slice().sort(function (u, v) { return u - v; })[c.length >> 1]; return { lo: c[0] - T, hi: c[c.length - 1] + T, v: m }; }); }
      var gx = grp(ax), gy = grp(ay);
      function f(g, v) { for (var i = 0; i < g.length; i++) if (v >= g[i].lo && v <= g[i].hi) return g[i].v; return v; }
      return { x: function (v) { return f(gx, v); }, y: function (v) { return f(gy, v); } };
    })();
    function clean(pts) {
      var a = pts.map(function (q) { return [snap.x(q[0]), snap.y(q[1])]; }), b = [];
      a.forEach(function (q) { var l = b[b.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) b.push(q); });
      if (b.length > 1 && b[0][0] === b[b.length - 1][0] && b[0][1] === b[b.length - 1][1]) b.pop();
      // 짧은 사선(모서리 뭉개짐)은 직각 모서리로 바꾼다
      var o = []; b.forEach(function (q, i) { var w = b[(i + 1) % b.length]; o.push(q);
        var dx = Math.abs(w[0] - q[0]), dy = Math.abs(w[1] - q[1]); if (dx && dy && Math.min(dx, dy) < 40) o.push(dx < dy ? [q[0], w[1]] : [w[0], q[1]]); }); b = o;
      for (var k = 0; k < 3; k++) { var c = []; for (var i = 0; i < b.length; i++) { var u = b[(i - 1 + b.length) % b.length], q = b[i], w = b[(i + 1) % b.length];
        if ((u[0] === q[0] && q[0] === w[0]) || (u[1] === q[1] && q[1] === w[1])) continue; c.push(q); } if (c.length < 3) break; b = c; }
      return b;
    }
    p.rooms = p.rooms.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; o.pts = clean(r.pts); return o; });
    if (p.외곽) p.외곽 = clean(p.외곽);
    ['창', '문'].forEach(function (k) { (p[k] || []).forEach(function (o) { o.x1 = snap.x(o.x1); o.x2 = snap.x(o.x2); o.y1 = snap.y(o.y1); o.y2 = snap.y(o.y2); }); });
    (p.외곽 || []).concat.apply([], p.rooms.map(function (r) { return r.pts; })).forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
    (p.외곽 || []).forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
    p.rooms.forEach(function (r) {
      var n = r.pts.length, L = 0, sx = 0, sy = 0;
      for (var j = 0; j < n; j++) { var a = r.pts[j], b = r.pts[(j + 1) % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); sx += a[0]; sy += a[1]; }
      R.push({ n: r.name.replace(/\d+$/, ''), k: r.kind, a: r.area || 0, l: L * mm / 1000, pts: r.pts, cx: sx / n, cy: sy / n });
    });
    var x0 = Math.min.apply(0, xs), y0 = Math.min.apply(0, ys), x1 = Math.max.apply(0, xs), y1 = Math.max.apply(0, ys);
    var M = 70, vb = [x0 - M, y0 - M, x1 - x0 + M * 1.6, y1 - y0 + M * 2.1].map(function (v) { return v.toFixed(0); }).join(' ');
    var s = ['<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans KR,sans-serif">',
      '<defs><filter id="fxN" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .22"/></feComponentTransfer></filter>',
      '<filter id="fxB"><feGaussianBlur stdDeviation="1.3"/></filter>',
      '<radialGradient id="fxV" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>'];

    // ① 사진: 종이 위 인쇄물을 휴대폰으로 찍은 느낌 (살짝 기울고 흐리고 거칠게)
    var bx = x0 - M, by = y0 - M, bw = x1 - x0 + M * 1.6, bh = y1 - y0 + M * 2.1;
    s.push('<g class="L L1"><rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="#E9E5DB"/>');
    s.push('<g transform="rotate(-2.2 ' + ((x0 + x1) / 2) + ' ' + ((y0 + y1) / 2) + ')" filter="url(#fxB)"><rect x="' + (x0 - 30) + '" y="' + (y0 - 30) + '" width="' + (x1 - x0 + 60) + '" height="' + (y1 - y0 + 60) + '" fill="#F7F5EF"/>');
    R.forEach(function (r) { s.push('<polygon points="' + P(r.pts) + '" fill="' + (r.k === '발코니' ? '#E6E3DA' : 'none') + '" stroke="#2B2B28" stroke-width="7" stroke-linejoin="round"/>'); });
    R.forEach(function (r) { if (r.a > 5) s.push('<text x="' + r.cx + '" y="' + (r.cy + 6) + '" font-size="19" fill="#55554F" text-anchor="middle">' + r.n + '</text>'); });
    s.push('</g><rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="url(#fxV)"/><rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" filter="url(#fxN)"/></g>');

    // ② 벡터: 선이 그려지고 꼭짓점이 찍힌다
    s.push('<g class="L L2">');
    RAW.forEach(function (q) { s.push('<polygon pathLength="1" points="' + P(q) + '" fill="none" stroke="#1F5E2E" stroke-width="2"/>'); });
    RAW.forEach(function (pts) { pts.forEach(function (q) { s.push('<circle cx="' + q[0] + '" cy="' + q[1] + '" r="4.5" fill="#fff" stroke="#1F5E2E" stroke-width="2"/>'); }); });
    s.push('</g>');

    // ④ 물량: 공종별로 방을 칠하고 넓이를 단다 (CAD 아래에 깔림)
    s.push('<g class="L L4">');
    R.forEach(function (r) {
      var c = /거실|방|주방/.test(r.k) ? '#CFE2C8' : r.k === '욕실' ? '#8FB596' : null;
      if (c) s.push('<polygon points="' + P(r.pts) + '" fill="' + c + '"/>');
    });
    s.push('</g>');

    // ③ CAD: 외벽·내벽·창·문·실명·전체 치수
    s.push('<g class="L L3">');
    R.forEach(function (r) { s.push('<polygon points="' + P(r.pts) + '" fill="none" stroke="#1C1F1B" stroke-width="3.5" stroke-linejoin="miter"/>'); });
    if (p.외곽) s.push('<polygon points="' + P(p.외곽) + '" fill="none" stroke="#1C1F1B" stroke-width="9" stroke-linejoin="miter"/>');
    (p.창 || []).forEach(function (w) { s.push('<line x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '" stroke="#1F5E2E" stroke-width="10"/><line x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '" stroke="#fff" stroke-width="3"/>'); });
    (p.문 || []).forEach(function (o) {
      var mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2, L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1); if (!L) return;
      var ux = (o.x2 - o.x1) / L, uy = (o.y2 - o.y1) / L, nx = -uy, ny = ux; if ((o.cx - mx) * nx + (o.cy - my) * ny > 0) { nx = -nx; ny = -ny; }
      var ex = o.x1 + nx * L, ey = o.y1 + ny * L, sw = (ux * ny - uy * nx) > 0 ? 1 : 0;
      s.push('<line x1="' + o.x1 + '" y1="' + o.y1 + '" x2="' + o.x2 + '" y2="' + o.y2 + '" stroke="#fff" stroke-width="6"/><line x1="' + o.x1 + '" y1="' + o.y1 + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="#1C1F1B" stroke-width="2"/><path d="M' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ' A' + L.toFixed(1) + ' ' + L.toFixed(1) + ' 0 0 ' + sw + ' ' + o.x2 + ' ' + o.y2 + '" fill="none" stroke="#1C1F1B" stroke-width="1.2" stroke-dasharray="4 3"/>');
    });
    var dy = y1 + 40, dx = x0 - 40, Wm = Math.round((x1 - x0) * mm / 10) * 10, Hm = Math.round((y1 - y0) * mm / 10) * 10;
    s.push('<g stroke="#1C1F1B" stroke-width="1.4"><line x1="' + x0 + '" y1="' + dy + '" x2="' + x1 + '" y2="' + dy + '"/><line x1="' + x0 + '" y1="' + (dy - 9) + '" x2="' + x0 + '" y2="' + (dy + 9) + '"/><line x1="' + x1 + '" y1="' + (dy - 9) + '" x2="' + x1 + '" y2="' + (dy + 9) + '"/>' +
      '<line x1="' + dx + '" y1="' + y0 + '" x2="' + dx + '" y2="' + y1 + '"/><line x1="' + (dx - 9) + '" y1="' + y0 + '" x2="' + (dx + 9) + '" y2="' + y0 + '"/><line x1="' + (dx - 9) + '" y1="' + y1 + '" x2="' + (dx + 9) + '" y2="' + y1 + '"/></g>');
    s.push('<text x="' + ((x0 + x1) / 2) + '" y="' + (dy + 30) + '" font-size="19" text-anchor="middle" fill="#1C1F1B" paint-order="stroke" stroke="#fff" stroke-width="6">' + num(Wm) + '</text>');
    s.push('<text transform="translate(' + (dx - 12) + ' ' + ((y0 + y1) / 2) + ') rotate(-90)" font-size="19" text-anchor="middle" fill="#1C1F1B" paint-order="stroke" stroke="#fff" stroke-width="6">' + num(Hm) + '</text>');
    R.forEach(function (r) { if (r.a > 4 || r.k === '욕실') s.push('<text class="nm" x="' + r.cx.toFixed(0) + '" y="' + (r.cy + 2).toFixed(0) + '" font-size="18" font-weight="600" text-anchor="middle" fill="#1C1F1B">' + r.n + '</text><text class="ar" x="' + r.cx.toFixed(0) + '" y="' + (r.cy + 24).toFixed(0) + '" font-size="16" text-anchor="middle" fill="#1F5E2E">' + r.a.toFixed(1) + '㎡</text>'); });
    s.push('</g></svg>');
    box.querySelector('.fsvg').innerHTML = s.join('');

    // ⑤ 적산서: 방 넓이·둘레 × 콘솔 물량 묶음표(data/takeoff-map.json)와 같은 계수 — 공종별 상세 물량
    var FL = /거실|방|주방|드레스/, flR = R.filter(function (r) { return FL.test(r.k) && r.a > 1; }), baR = R.filter(function (r) { return r.k === '욕실' && r.a > 1; }), enR = R.filter(function (r) { return r.k === '현관' && r.a > 0.5; });
    var S = function (a, f) { return a.reduce(function (t, r) { return t + f(r); }, 0); };
    var F = S(flR, function (r) { return r.a; }), Lb = S(flR, function (r) { return r.l; }), Wp = S(flR, function (r) { return r.l * 2.3 + r.a; });
    var Bf = S(baR, function (r) { return r.a; }), Bw = S(baR, function (r) { return r.l * 2.4; }), Ef = S(enR, function (r) { return r.a; }), nb = baR.length;
    var wins = {}; (p.창 || []).forEach(function (w) { var L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * mm / 100) * 100; if (L >= 400) wins[L] = (wins[L] || 0) + 1; });
    var wl = Object.keys(wins).map(Number).sort(function (a, b) { return b - a; }), nWin = wl.reduce(function (t, k) { return t + wins[k]; }, 0), nDoor = (p.문 || []).length;
    var Q = [
      ['바닥 · 강마루', [['강마루 (도급재)', '바닥 ' + num(F, 1) + '㎡ × 1.0', F, '㎡'], ['걸레받이', '둘레 ' + num(Lb, 1) + 'm × 1.05', Lb * 1.05, 'm'], ['바닥 본드', '걸레받이 m × 0.05', Lb * 1.05 * 0.05, 'kg']]],
      ['도배 · 실크', [['실크 벽지 (도급재)', '벽 둘레 × 2.3m + 천장', Wp, '㎡']]],
      ['욕실 ' + nb + '곳 · 타일', [['벽 타일 300×600', '벽 ' + num(Bw, 1) + '㎡ × 1.05', Bw * 1.05, '㎡'], ['바닥 타일', '바닥 ' + num(Bf, 1) + '㎡ × 1.05', Bf * 1.05, '㎡'], ['압착 시멘트', '타일 ㎡ × 5', (Bw + Bf) * 1.05 * 5, 'kg'], ['줄눈', '타일 ㎡ × 0.5', (Bw + Bf) * 1.05 * 0.5, 'kg'], ['코너비트 SUS', '벽 타일 ㎡ × 0.25', Bw * 1.05 * 0.25, '개'], ['실리콘 300ml', '벽 타일 ㎡ × 0.12', Bw * 1.05 * 0.12, '본']]],
      ['욕실 ' + nb + '곳 · 도기', [['양변기', '욕실마다 1', nb, '개'], ['세면대', '욕실마다 1', nb, '개'], ['수전', '욕실마다 1', nb, '개'], ['실리콘 300ml', '욕실마다 2', nb * 2, '본']]],
      ['현관 · 타일', [['바닥 타일', '현관 ' + num(Ef, 1) + '㎡ × 1.05', Ef * 1.05, '㎡'], ['셀프레벨링', '㎡ × 3', Ef * 3, 'kg'], ['압착 시멘트', '㎡ × 5', Ef * 1.05 * 5, 'kg']]],
      ['창호 · 문', wl.map(function (k) { return ['창 가로 ' + num(k), '도면에서 잰 폭', wins[k], '곳']; }).concat([['실내 문', '도면의 문 자리', nDoor, '짝']])]
    ];
    var up = function (u) { return u === '개' || u === '본' || u === '곳' || u === '짝'; };
    var qn = function (v, u) { return up(u) ? num(Math.ceil(v - 1e-9)) : num(v, 1); };
    var nr = 0, qh = ['<div class="qhd"><b>적산서</b><span>송도파크자이 131A · 콘솔 물량 묶음표 계수 · 어림</span></div><div class="qbody"><div class="qin">'];
    Q.forEach(function (g) { qh.push('<p class="qg">' + g[0] + '</p><table>');
      g[1].forEach(function (x) { nr++; qh.push('<tr><th>' + x[0] + '<small>' + x[1] + '</small></th><td>' + qn(x[2], x[3]) + '<i>' + x[3] + '</i></td></tr>'); }); qh.push('</table>'); });
    qh.push('</div></div><p class="qft">품목 ' + nr + '줄 · 포장 단위(박스·포)는 자재상 규격으로 바꿔 발주</p>');
    box.querySelector('.fqty').innerHTML = qh.join('');

    // ⑥ 발주: 적산 물량을 자재상별로 묶어 보낸다
    var V = [['바닥재 · 도배 자재상', [['강마루', F, '㎡'], ['걸레받이', Lb * 1.05, 'm'], ['실크 벽지', Wp, '㎡']], F * 45000 + Wp * 42000],
             ['타일 · 도기 자재상', [['벽·바닥 타일', (Bw + Bf + Ef) * 1.05, '㎡'], ['압착 시멘트', ((Bw + Bf) * 1.05 + Ef * 1.05) * 5, 'kg'], ['양변기·세면대·수전', nb * 3, '개']], (Bw + Bf) * 1.1 * 27000],
             ['창호 · 문 업체', [['창', nWin, '곳'], ['실내 문', nDoor, '짝']], 0]];
    var sum = 0, h = ['<div class="ohd"><b>발주</b><span>적산서 그대로 · 자재상 세 곳</span></div>'];
    V.forEach(function (v, i) { sum += v[2];
      h.push('<div class="ov" style="--i:' + i + '"><div class="ovh"><b>' + v[0] + '<small>' + (v[2] ? '어림 ' + num(Math.round(v[2] / 1e4)) + '만 원' : '크기별 실측 뒤 견적') + '</small></b><em>전송됨</em></div><p>' + v[1].map(function (x) { return x[0] + ' <span>' + qn(x[1], x[2]) + x[2] + '</span>'; }).join(' · ') + '</p></div>'); });
    h.push('<div class="osum"><span>어림 합계 · 실견적 단가 기준 · 부가세 별도</span><b>' + num(Math.round(sum / 1e4)) + '만 원</b></div>');
    ord.innerHTML = h.join('');
    RAW.forEach(function (q) { vtx += q.length; }); box.dataset.vtx = vtx;
    go(1); if (!reduce) loop();
  }).catch(function () {});

  var TAG = ['', '고객이 올린 평면도 사진 · 분양 안내 캡처도 그대로', '벡터 변환 · 선과 꼭짓점을 좌표로', '집지니 CAD · 벽 · 창 · 문 · 치수, .dwg로 내려받기', '자동 물량 · 방마다 바닥 · 벽 · 천장 넓이', '적산 · 공종별 품목·규격·수량', '발주 · 적산서 그대로 자재상별로'];
  var DUR = [0, 3400, 3400, 3400, 3600, 7600, 5200], N = 6;
  function go(n) {
    cur = n; box.dataset.s = n;
    tag.innerHTML = '<b>' + n + '/' + N + '</b> ' + TAG[n] + (n === 2 && box.dataset.vtx ? ' · 꼭짓점 ' + box.dataset.vtx + '개' : '');
    steps.forEach(function (b) { var on = +b.dataset.s === n; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) b.style.setProperty('--d', DUR[n] + 'ms'); });
    if (n === 5) { var qb = box.querySelector('.qbody'), qi = box.querySelector('.qin'); if (qb && qi) { qi.style.setProperty('--sy', Math.min(0, qb.clientHeight - qi.scrollHeight) + 'px'); qi.classList.remove('run'); void qi.offsetWidth; qi.classList.add('run'); } }
  }
  function loop() { clearTimeout(timer); timer = setTimeout(function tick() { if (!paused) go(cur % N + 1); timer = setTimeout(tick, DUR[cur]); }, DUR[cur]); }
  steps.forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.s); if (!reduce) loop(); }); });
  var fig = box.parentNode;
  fig.addEventListener('mouseenter', function () { paused = true; }); fig.addEventListener('mouseleave', function () { paused = false; });
  document.addEventListener('visibilitychange', function () { paused = document.hidden; });
})();
