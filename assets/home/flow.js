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

    // ⑤ 발주서: 물량 그대로
    var floor = 0, wall = 0, tile = 0;
    R.forEach(function (r) { if (/거실|방|주방/.test(r.k) && r.a > 1) { floor += r.a; wall += r.l * 2.3 + r.a; } if (r.k === '욕실') tile += r.a + r.l * 2.4; });
    var base = (p.sum && p.sum.걸레받이) || 0, win = (p.창 || []).length;
    var rows = [['강마루', floor * 1.05, '㎡', 45000, '로스 5% 포함'], ['실크 도배', wall, '㎡', 42000, '벽 + 천장'], ['욕실 타일', tile * 1.1, '㎡', 27000, '바닥 + 벽, 로스 10%'], ['걸레받이', base, 'm', 0, '둘레 합'], ['창호(샷시)', win, '곳', 0, '크기별 실측 뒤 견적']];
    var sum = 0, h = ['<div class="ohd"><b>발주서</b><span>송도파크자이 131A · 자재상 전송 대기</span></div><table>'];
    rows.forEach(function (x, i) { var m = x[3] ? x[1] * x[3] : 0; sum += m;
      h.push('<tr style="--i:' + i + '"><th>' + x[0] + '<small>' + x[4] + '</small></th><td>' + num(x[1], x[2] === '곳' ? 0 : 1) + x[2] + '</td><td>' + (m ? num(Math.round(m / 1e4)) + '만 원' : '현장 확인') + '</td></tr>'); });
    h.push('</table><div class="osum"><span>어림 합계 · 실견적 단가 기준 · 부가세 별도</span><b>' + num(Math.round(sum / 1e4)) + '만 원</b></div>');
    ord.innerHTML = h.join('');
    RAW.forEach(function (q) { vtx += q.length; }); box.dataset.vtx = vtx;
    go(1); if (!reduce) loop();
  }).catch(function () {});

  var TAG = ['', '고객이 올린 평면도 사진 · 분양 안내 캡처도 그대로', '벡터 변환 · 선과 꼭짓점을 좌표로', '집지니 CAD · 벽 · 창 · 문 · 치수, .dwg로 내려받기', '자동 물량 · 방마다 바닥 · 벽 · 천장 넓이', '발주 · 물량 그대로 자재상에'];
  function go(n) {
    cur = n; box.dataset.s = n;
    tag.innerHTML = '<b>' + n + '/5</b> ' + TAG[n] + (n === 2 && box.dataset.vtx ? ' · 꼭짓점 ' + box.dataset.vtx + '개' : '');
    steps.forEach(function (b) { var on = +b.dataset.s === n; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  }
  function loop() { clearInterval(timer); timer = setInterval(function () { if (!paused) go(cur % 5 + 1); }, 3400); }
  steps.forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.s); if (!reduce) loop(); }); });
  var fig = box.parentNode;
  fig.addEventListener('mouseenter', function () { paused = true; }); fig.addEventListener('mouseleave', function () { paused = false; });
  document.addEventListener('visibilitychange', function () { paused = document.hidden; });
})();
