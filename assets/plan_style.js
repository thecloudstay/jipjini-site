/* 집지니 재가공 도면 (2026-11-10) — 분석 결과(방 다각형·이름·면적)만으로 깨끗한 바탕에 집지니 양식으로 다시 그린다. 원본 그림은 쓰지 않는다.
   JJPlanStyle.svg(결과, { title, sub, date, plain }) → SVG 문자열      결과 = JJPlanTools.analyze / JJPlanAuto 가 돌려준 것 (rooms[].pts·name·kind·area·w·d, mmpp, sum)
   JJPlanStyle.png(결과, opt, 가로화소=1800) → Promise<dataURL>
   벽은 「방 바깥선을 굵게 긋고 그 위에 방 바닥을 덮는」 방식이라 방 사이 틈이 자연스럽게 벽이 된다. 문·창 자리는 알 수 없어 그리지 않는다(공간 구성도). */
(function (root) {
  var INK = '#26302c', PAPER = '#f7f4ee', LINE = '#c9c2b4', ACC = '#2f6b4f', SUBT = '#7a7468';
  var FILL = { 거실: '#efe5d3', 방: '#e6ebe3', 주방: '#f2e9dd', 욕실: '#dde7ea', 발코니: '#eef0e9', 현관: '#e4ddd1', 드레스룸: '#ebe4dc', 실외기실: '#ecebe6', 기타: '#efede8', 피트: '#d9d6cd' };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 가로·세로가 거의 같은 꼭짓점들을 한 줄로 맞춘다(방끼리 벽선이 가지런해진다)
  function snapAll(rooms, tol) {
    ['0', '1'].forEach(function (ax) { ax = Number(ax); var vals = []; rooms.forEach(function (r) { r.p.forEach(function (q) { vals.push(q[ax]); }); }); vals.sort(function (a, b) { return a - b; });
      var map = {}, grp = []; var flush = function () { if (!grp.length) return; var m = grp.reduce(function (s, v) { return s + v; }, 0) / grp.length; grp.forEach(function (v) { map[v] = Math.round(m * 10) / 10; }); grp = []; };
      vals.forEach(function (v) { if (grp.length && v - grp[0] > tol) flush(); grp.push(v); }); flush();
      rooms.forEach(function (r) { r.p.forEach(function (q) { q[ax] = map[q[ax]]; }); }); });
    rooms.forEach(function (r) { var o = []; r.p.forEach(function (q) { var l = o[o.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) o.push(q); }); if (o.length > 1 && o[0][0] === o[o.length - 1][0] && o[0][1] === o[o.length - 1][1]) o.pop();
      // 한 줄 위에 놓인 가운데 점 빼기
      var k = []; for (var i = 0; i < o.length; i++) { var a = o[(i + o.length - 1) % o.length], b = o[i], c = o[(i + 1) % o.length]; if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) continue; k.push(b); } r.p = k.length >= 3 ? k : o; });
  }
  function inPoly(x, y, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
  // 이름표 자리: 다각형 안에서 벽과 가장 먼 점(격자 탐색)
  function labelAt(p) { var xs = p.map(function (q) { return q[0]; }), ys = p.map(function (q) { return q[1]; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), best = [(x0 + x1) / 2, (y0 + y1) / 2], bd = -1, n = 14;
    var dseg = function (x, y, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
    for (var i = 1; i < n; i++) for (var j = 1; j < n; j++) { var x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * j / n; if (!inPoly(x, y, p)) continue; var d = 1e9; for (var k = 0; k < p.length; k++) d = Math.min(d, dseg(x, y, p[k], p[(k + 1) % p.length]));
      d -= Math.abs(y - (y0 + y1) / 2) * 0.05 + Math.abs(x - (x0 + x1) / 2) * 0.05; if (d > bd) { bd = d; best = [x, y]; } }
    return { x: best[0], y: best[1], room: Math.max(0, bd), w: x1 - x0, h: y1 - y0 }; }
  function svg(r, opt) {
    opt = opt || {}; if (!r || !r.rooms || !r.rooms.length) return '';
    var rooms = r.rooms.filter(function (m) { return m.pts && m.pts.length >= 3; }).map(function (m) { return { m: m, p: m.pts.map(function (q) { return [q[0], q[1]]; }) }; }); if (!rooms.length) return '';
    var xs = [], ys = []; rooms.forEach(function (o) { o.p.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys), bw = bx1 - bx0, bh = by1 - by0, D = Math.max(bw, bh);
    snapAll(rooms, D * 0.024);   // 벽 두께(약 200mm)만큼 떨어진 두 방의 변을 벽 가운데 한 줄로 모은다 → 벽선이 겹치지 않고 한 줄
    var mm = Number(r.mmpp) || 0, T = mm ? Math.max(D * 0.006, 190 / mm) : D * 0.014, Tb = T * 0.45;   // 벽 굵기: 척도를 알면 약 190mm
    var pad = D * 0.11, head = D * 0.15, foot = D * 0.2, VW = bw + pad * 2, VH = bh + pad * 2 + head + foot, ox = pad - bx0, oy = pad + head - by0, fs = D / 38, id = 'jj' + Math.round(bx0 + by1 + rooms.length * 7);
    var pts = function (p) { return p.map(function (q) { return (q[0] + ox).toFixed(1) + ',' + (q[1] + oy).toFixed(1); }).join(' '); };
    var F = "font-family=\"Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif\"";
    var h = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW.toFixed(0) + ' ' + VH.toFixed(0) + '" style="width:100%;height:auto;display:block;background:' + PAPER + '" ' + F + '>'];
    h.push('<defs>' +
      '<pattern id="' + id + 'b" width="' + (D / 60).toFixed(1) + '" height="' + (D / 60).toFixed(1) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="' + (D / 60).toFixed(1) + '" stroke="' + LINE + '" stroke-width="' + (D / 700).toFixed(2) + '"/></pattern>' +
      '<pattern id="' + id + 't" width="' + (D / 45).toFixed(1) + '" height="' + (D / 45).toFixed(1) + '" patternUnits="userSpaceOnUse"><path d="M0 0H' + (D / 45).toFixed(1) + 'M0 0V' + (D / 45).toFixed(1) + '" stroke="#c3d0d4" stroke-width="' + (D / 600).toFixed(2) + '" fill="none"/></pattern>' +
      '<pattern id="' + id + 'w" width="' + (D / 3.2).toFixed(0) + '" height="' + (D / 5.5).toFixed(0) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><text x="0" y="' + (D / 11).toFixed(0) + '" font-size="' + (D / 30).toFixed(1) + '" font-weight="800" fill="' + ACC + '" fill-opacity="0.055" letter-spacing="' + (D / 160).toFixed(1) + '">집지니</text></pattern>' +
      '</defs>');
    h.push('<rect width="100%" height="100%" fill="' + PAPER + '"/>');
    // 바깥 테두리(도면 틀)
    var m0 = D * 0.03; h.push('<rect x="' + m0.toFixed(1) + '" y="' + m0.toFixed(1) + '" width="' + (VW - m0 * 2).toFixed(1) + '" height="' + (VH - m0 * 2).toFixed(1) + '" fill="none" stroke="' + INK + '" stroke-width="' + (D / 500).toFixed(2) + '"/>');
    // 머리: 인장 + 제목
    var sx = m0 + D * 0.035, sy = m0 + D * 0.03, sr = D * 0.036;
    if (!opt.plain) h.push('<g><rect x="' + sx.toFixed(1) + '" y="' + sy.toFixed(1) + '" width="' + (sr * 2).toFixed(1) + '" height="' + (sr * 2).toFixed(1) + '" rx="' + (sr * 0.28).toFixed(1) + '" fill="' + ACC + '"/><text x="' + (sx + sr).toFixed(1) + '" y="' + (sy + sr * 1.42).toFixed(1) + '" text-anchor="middle" font-size="' + (sr * 1.25).toFixed(1) + '" font-weight="800" fill="' + PAPER + '">집</text></g>');
    var tx = sx + (opt.plain ? 0 : sr * 2 + D * 0.022);
    h.push('<text x="' + tx.toFixed(1) + '" y="' + (sy + sr * 0.82).toFixed(1) + '" font-size="' + (fs * 1.25).toFixed(1) + '" font-weight="700" fill="' + INK + '">' + esc(opt.title || '평면 구성도') + '</text>');
    h.push('<text x="' + tx.toFixed(1) + '" y="' + (sy + sr * 1.72).toFixed(1) + '" font-size="' + (fs * 0.74).toFixed(1) + '" fill="' + SUBT + '" letter-spacing="' + (fs * 0.04).toFixed(2) + '">' + esc(opt.sub || '집지니 재가공 도면') + '</text>');
    var su = r.sum || {}, info = []; if (su.전용합) info.push('실내 ' + su.전용합 + '㎡'); if (su.방) info.push('방 ' + su.방); if (su.욕실) info.push('욕실 ' + su.욕실); if (su.발코니) info.push('발코니 ' + su.발코니);
    h.push('<text x="' + (VW - m0 - D * 0.035).toFixed(1) + '" y="' + (sy + sr * 0.82).toFixed(1) + '" text-anchor="end" font-size="' + (fs * 0.86).toFixed(1) + '" font-weight="600" fill="' + INK + '">' + esc(info.join('  ·  ')) + '</text>');
    if (opt.date) h.push('<text x="' + (VW - m0 - D * 0.035).toFixed(1) + '" y="' + (sy + sr * 1.72).toFixed(1) + '" text-anchor="end" font-size="' + (fs * 0.72).toFixed(1) + '" fill="' + SUBT + '">' + esc(opt.date) + '</text>');
    h.push('<line x1="' + m0.toFixed(1) + '" y1="' + (m0 + head * 0.82).toFixed(1) + '" x2="' + (VW - m0).toFixed(1) + '" y2="' + (m0 + head * 0.82).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (D / 500).toFixed(2) + '"/>');
    // 바닥을 먼저 칠하고, 벽은 모든 방 둘레를 같은 굵기의 먹선 한 줄로 긋는다(맞닿은 변은 같은 자리라 겹쳐 보이지 않는다)
    var outer = function (k) { return k === '발코니' || k === '실외기실'; }, TW = Math.max(D * 0.0085, Math.min(D * 0.013, T * 0.75));
    rooms.forEach(function (o) { var k = o.m.kind, f = FILL[k] || FILL.기타; h.push('<polygon points="' + pts(o.p) + '" fill="' + f + '"/>');
      if (k === '발코니' || k === '실외기실') h.push('<polygon points="' + pts(o.p) + '" fill="url(#' + id + 'b)"/>'); else if (k === '욕실' || k === '현관') h.push('<polygon points="' + pts(o.p) + '" fill="url(#' + id + 't)"/>');
      else if (k === '피트') { var px = o.p.map(function (q) { return q[0]; }), py = o.p.map(function (q) { return q[1]; }), ax = Math.min.apply(null, px) + ox, bx = Math.max.apply(null, px) + ox, ay = Math.min.apply(null, py) + oy, by2 = Math.max.apply(null, py) + oy; h.push('<path d="M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + bx.toFixed(1) + ' ' + by2.toFixed(1) + 'M' + bx.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + ax.toFixed(1) + ' ' + by2.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (D / 700).toFixed(2) + '" fill="none"/>'); } });
    rooms.forEach(function (o) { h.push('<polygon points="' + pts(o.p) + '" fill="none" stroke="' + INK + '" stroke-width="' + TW.toFixed(2) + '" stroke-linejoin="miter" stroke-miterlimit="3"/>'); });
    // 창: 벽선 위에 흰 틈 + 가는 두 줄(샷시)로 그리고 종류·폭을 적는다. 방을 반듯하게 편 뒤라 가장 가까운 벽선에 붙인다
    (r.창 || []).forEach(function (wn) { var hor = Math.abs(wn.x2 - wn.x1) >= Math.abs(wn.y2 - wn.y1), c = hor ? (wn.y1 + wn.y2) / 2 : (wn.x1 + wn.x2) / 2, best = null, bd = D * 0.035, a0 = hor ? Math.min(wn.x1, wn.x2) : Math.min(wn.y1, wn.y2), a1 = hor ? Math.max(wn.x1, wn.x2) : Math.max(wn.y1, wn.y2);
      rooms.forEach(function (o) { for (var i = 0; i < o.p.length; i++) { var p1 = o.p[i], p2 = o.p[(i + 1) % o.p.length], eh = p1[1] === p2[1], ev = p1[0] === p2[0]; if (hor ? !eh : !ev) continue; var ec = hor ? p1[1] : p1[0], lo = hor ? Math.min(p1[0], p2[0]) : Math.min(p1[1], p2[1]), hi = hor ? Math.max(p1[0], p2[0]) : Math.max(p1[1], p2[1]); if (Math.min(hi, a1) - Math.max(lo, a0) < (a1 - a0) * 0.5) continue; var d = Math.abs(ec - c); if (d < bd) { bd = d; best = ec; } } });
      if (best == null) return; var X1 = hor ? a0 + ox : best + ox, Y1 = hor ? best + oy : a0 + oy, X2 = hor ? a1 + ox : best + ox, Y2 = hor ? best + oy : a1 + oy, g = TW * 0.36, nx = hor ? 0 : 1, ny = hor ? 1 : 0;
      h.push('<line x1="' + X1.toFixed(1) + '" y1="' + Y1.toFixed(1) + '" x2="' + X2.toFixed(1) + '" y2="' + Y2.toFixed(1) + '" stroke="' + PAPER + '" stroke-width="' + (TW * 1.25).toFixed(2) + '"/>');
      [-1, 1].forEach(function (sg) { h.push('<line x1="' + (X1 + nx * g * sg).toFixed(1) + '" y1="' + (Y1 + ny * g * sg).toFixed(1) + '" x2="' + (X2 + nx * g * sg).toFixed(1) + '" y2="' + (Y2 + ny * g * sg).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (TW * 0.2).toFixed(2) + '"/>'); });
      [[X1, Y1], [X2, Y2]].forEach(function (e) { h.push('<line x1="' + (e[0] - nx * TW * 0.62).toFixed(1) + '" y1="' + (e[1] - ny * TW * 0.62).toFixed(1) + '" x2="' + (e[0] + nx * TW * 0.62).toFixed(1) + '" y2="' + (e[1] + ny * TW * 0.62).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (TW * 0.45).toFixed(2) + '"/>'); });
      wn._at = [(X1 + X2) / 2, (Y1 + Y2) / 2, hor]; });
    // 이름표
    rooms.forEach(function (o) { var m = o.m, L = labelAt(o.p), big = Math.min(L.w, L.h), f1 = Math.max(fs * 0.62, Math.min(fs * 1.05, big / 5.2)), small = big < fs * 3.4, cx = L.x + ox, cy = L.y + oy;
      var lines = [[m.name, f1, 700, INK]]; if (m.area) lines.push([m.area + '㎡', f1 * 0.8, 500, SUBT]); if (!small && m.w && m.d && m.kind !== '발코니') lines.push([m.w + ' × ' + m.d + ' m', f1 * 0.66, 400, SUBT]);
      var tot = lines.reduce(function (s, l) { return s + l[1] * 1.28; }, 0), y = cy - tot / 2;
      lines.forEach(function (l) { y += l[1] * 1.05; h.push('<text x="' + cx.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-size="' + l[1].toFixed(1) + '" font-weight="' + l[2] + '" fill="' + l[3] + '">' + esc(l[0]) + '</text>'); y += l[1] * 0.23; }); });
    (r.창 || []).forEach(function (wn) { if (!wn._at || opt.noWinText) return; var t = wn.종류 + (wn.w_m ? ' ' + wn.w_m + 'm' : ''), f0 = fs * 0.5, x = wn._at[0], y = wn._at[1];
      if (wn._at[2]) h.push('<text x="' + x.toFixed(1) + '" y="' + (y + f0 * 0.34).toFixed(1) + '" text-anchor="middle" font-size="' + f0.toFixed(1) + '" font-weight="600" fill="' + ACC + '" stroke="' + PAPER + '" stroke-width="' + (f0 * 0.5).toFixed(1) + '" paint-order="stroke">' + esc(t) + '</text>');
      else h.push('<text transform="translate(' + (x + f0 * 0.34).toFixed(1) + ' ' + y.toFixed(1) + ') rotate(-90)" text-anchor="middle" font-size="' + f0.toFixed(1) + '" font-weight="600" fill="' + ACC + '" stroke="' + PAPER + '" stroke-width="' + (f0 * 0.5).toFixed(1) + '" paint-order="stroke">' + esc(t) + '</text>'); });
    // 비침 무늬(재가공 표시)
    if (!opt.plain) h.push('<rect x="' + m0.toFixed(1) + '" y="' + (m0 + head * 0.82).toFixed(1) + '" width="' + (VW - m0 * 2).toFixed(1) + '" height="' + (VH - m0 * 2 - head * 0.82 - foot * 0.62).toFixed(1) + '" fill="url(#' + id + 'w)" pointer-events="none"/>');
    // 발: 축척 막대 + 안내
    var fy = VH - m0 - foot * 0.62; h.push('<line x1="' + m0.toFixed(1) + '" y1="' + fy.toFixed(1) + '" x2="' + (VW - m0).toFixed(1) + '" y2="' + fy.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (D / 500).toFixed(2) + '"/>');
    var gx = m0 + D * 0.035, gy = fy + foot * 0.3;
    if (mm) { var one = 1000 / mm, nSeg = one * 3 < bw * 0.5 ? 3 : 1; for (var i = 0; i < nSeg; i++) h.push('<rect x="' + (gx + one * i).toFixed(1) + '" y="' + (gy - D * 0.006).toFixed(1) + '" width="' + one.toFixed(1) + '" height="' + (D * 0.012).toFixed(1) + '" fill="' + (i % 2 ? PAPER : INK) + '" stroke="' + INK + '" stroke-width="' + (D / 700).toFixed(2) + '"/>');
      h.push('<text x="' + gx.toFixed(1) + '" y="' + (gy + fs * 1.15).toFixed(1) + '" font-size="' + (fs * 0.68).toFixed(1) + '" fill="' + SUBT + '">0</text><text x="' + (gx + one * nSeg).toFixed(1) + '" y="' + (gy + fs * 1.15).toFixed(1) + '" text-anchor="middle" font-size="' + (fs * 0.68).toFixed(1) + '" fill="' + SUBT + '">' + nSeg + ' m</text>'); }
    var by = r.척도 && r.척도.방식 && r.척도.방식 !== '없음' ? '크기 기준: ' + (r.척도.방식 === '치수' ? '도면 치수선' : r.척도.방식 === '방 면적' ? '도면에 적힌 방 면적' : '전용면적') : '';
    h.push('<text x="' + (VW - m0 - D * 0.035).toFixed(1) + '" y="' + (gy + fs * 0.1).toFixed(1) + '" text-anchor="end" font-size="' + (fs * 0.7).toFixed(1) + '" fill="' + INK + '">' + esc(opt.note || '원본 평면도를 집지니가 읽어 다시 그린 참고용 도면입니다.') + '</text>');
    h.push('<text x="' + (VW - m0 - D * 0.035).toFixed(1) + '" y="' + (gy + fs * 1.15).toFixed(1) + '" text-anchor="end" font-size="' + (fs * 0.64).toFixed(1) + '" fill="' + SUBT + '">' + esc((by ? by + '  ·  ' : '') + '문·창 위치와 정확한 치수는 현장 실측으로 확정합니다.') + '</text>');
    h.push('</svg>'); return h.join('');
  }
  function png(r, opt, width) {
    return new Promise(function (ok, no) { var s = svg(r, opt); if (!s) return no(new Error('그릴 내용이 없습니다.')); var m = /viewBox="0 0 (\d+) (\d+)"/.exec(s), W = width || 1800, H = Math.round(W * Number(m[2]) / Number(m[1]));
      s = s.replace('<svg ', '<svg width="' + W + '" height="' + H + '" '); var img = new Image(); img.onload = function () { var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H); ok(c.toDataURL('image/png')); };
      img.onerror = function () { no(new Error('그림으로 바꾸지 못했습니다.')); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); });
  }
  root.JJPlanStyle = { svg: svg, png: png, version: '2026-11-10' };
})(typeof window !== 'undefined' ? window : this);
