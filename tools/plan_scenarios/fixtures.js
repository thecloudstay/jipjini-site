/* 도면 분석 실전 시나리오용 합성 도면 (2026-11-10) — 정답(방 크기·면적·창)을 아는 평면을 플랫폼 양식별로 그린다. 고객 도면은 쓰지 않는다.
   평면(미터): 전용 11.5 × 7.0 = 80.5㎡, 앞 발코니 11.5 × 1.4. 거실·주방은 트여 있다. */
(function (root) {
  var ROOMS = [   // [이름표, 종류, x, y, w, h]
    ['욕실', '욕실', 0, 0, 1.9, 2.7], ['드레스룸', '드레스룸', 1.9, 0, 1.7, 2.7], ['주방/식당', '주방', 3.6, 0, 4.5, 2.7], ['현관', '현관', 8.1, 0, 1.5, 2.7], ['욕실', '욕실', 9.6, 0, 1.9, 2.7],
    ['침실', '방', 0, 2.7, 3.6, 4.3], ['거실', '거실', 3.6, 2.7, 4.5, 4.3], ['침실', '방', 8.1, 2.7, 3.4, 2.1], ['침실', '방', 8.1, 4.8, 3.4, 2.2], ['발코니', '발코니', 0, 7.0, 11.5, 1.4]];
  var WALLS = [[0, 0, 11.5, 0], [0, 7, 11.5, 7], [0, 0, 0, 7], [11.5, 0, 11.5, 7], [0, 2.7, 3.6, 2.7], [8.1, 2.7, 11.5, 2.7], [1.9, 0, 1.9, 2.7], [3.6, 0, 3.6, 7], [8.1, 0, 8.1, 7], [9.6, 0, 9.6, 2.7], [8.1, 4.8, 11.5, 4.8]];
  var BALC = [[0, 7, 0, 8.4], [0, 8.4, 11.5, 8.4], [11.5, 7, 11.5, 8.4]];
  var DOORS = [[3.6, 3.2, 3.6, 4.1], [8.1, 3.3, 8.1, 4.2], [8.1, 5.4, 8.1, 6.3], [0.5, 2.7, 1.4, 2.7], [2.4, 2.7, 3.3, 2.7], [8.1, 1.0, 8.1, 1.9], [9.6, 1.0, 9.6, 1.9]];
  var WINS = [[0.6, 7, 3.0, 7], [4.2, 7, 7.5, 7], [8.7, 7, 11.0, 7], [1.0, 8.4, 10.5, 8.4], [4.6, 0, 6.6, 0]];
  var FILL = { kb: { 방: '#e9e4c4', 거실: '#c98a4b', 주방: '#b98150', 욕실: '#c48a93', 드레스룸: '#d8cfae', 현관: '#8a5a44', 발코니: '#a9c4ad' }, nv: { 방: '#fffbe9', 거실: '#cfa06a', 주방: '#cfa06a', 욕실: '#bcd9e0', 드레스룸: '#f1e7cf', 현관: '#d9d2c4', 발코니: '#f1f1f3' }, r114: { 방: '#fbe6c2', 거실: '#f8cfc9', 주방: '#f8cfc9', 욕실: '#ddd3ea', 드레스룸: '#fbe6c2', 현관: '#cfe6e2', 발코니: '#f1f2c3' } };
  function truth() { var t = { 방: 3, 욕실: 2, 발코니: 1, 거실: 1, 주방: 1, 전용: 76.84, 안방: 3.4 * 4.1, 거실면적: 4.3 * 4.1, 트인합: 4.3 * 4.1 + 4.3 * 2.5, 가로mm: 11500 }; return t; }
  /** style: kb | nv | nvdim | r114 | cad | bare    opt: { ppm(화소/미터), labels(false 면 글자 없음) } → canvas */
  function draw(style, opt) {
    opt = opt || {}; var S = opt.ppm || 70, mg = (style === 'nvdim' || style === 'r114' || style === 'cad') ? 1.5 : 0.6, W = Math.round((11.5 + mg * 2) * S), H = Math.round((8.4 + mg * 2 + (style === 'nv' ? 0.6 : 0)) * S), c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), X = function (m) { return (m + mg) * S; }, Y = X, pal = FILL[style === 'nvdim' ? 'nv' : style === 'cad' || style === 'bare' ? 'kb' : style] || FILL.kb, T = 0.2 * S, n방 = 0, n욕 = 0, n발 = 0;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    var hollow = style === 'cad', thinBalc = style === 'r114';
    // 바닥
    if (!hollow && style !== 'bare') ROOMS.forEach(function (r) { g.fillStyle = pal[r[1]] || '#eee'; g.fillRect(X(r[2]), Y(r[3]), r[4] * S, r[5] * S);
      if (style === 'kb' && (r[1] === '욕실' || r[1] === '발코니')) { g.strokeStyle = 'rgba(70,90,80,.55)'; g.lineWidth = 1; for (var a = X(r[2]); a < X(r[2] + r[4]); a += S * 0.22) { g.beginPath(); g.moveTo(a, Y(r[3])); g.lineTo(a, Y(r[3] + r[5])); g.stroke(); } for (var b = Y(r[3]); b < Y(r[3] + r[5]); b += S * 0.22) { g.beginPath(); g.moveTo(X(r[2]), b); g.lineTo(X(r[2] + r[4]), b); g.stroke(); } } });
    // 벽
    var seg = function (s, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'square'; g.beginPath(); g.moveTo(X(s[0]), Y(s[1])); g.lineTo(X(s[2]), Y(s[3])); g.stroke(); };
    WALLS.forEach(function (s) { seg(s, T, '#111'); }); if (thinBalc) BALC.forEach(function (s) { seg(s, Math.max(1, S * 0.02), '#777'); }); else BALC.forEach(function (s) { seg(s, T, '#111'); });
    if (hollow) { WALLS.concat(BALC).forEach(function (s) { seg(s, T - Math.max(2, S * 0.05), '#fff'); }); }
    // 문: 벽을 지우고(바닥색) 문짝 호
    DOORS.forEach(function (d) { var v = d[0] === d[2], rm = ROOMS.filter(function (r) { return v ? (d[1] >= r[3] && d[3] <= r[3] + r[5] && d[0] >= r[2] && d[0] <= r[2] + r[4]) : (d[0] >= r[2] && d[2] <= r[2] + r[4] && d[1] >= r[3] && d[1] <= r[3] + r[5]); })[0];
      g.fillStyle = hollow || style === 'bare' ? '#fff' : (pal[rm ? rm[1] : '거실'] || '#fff'); if (v) g.fillRect(X(d[0]) - T / 2 - 1, Y(d[1]), T + 2, (d[3] - d[1]) * S); else g.fillRect(X(d[0]), Y(d[1]) - T / 2 - 1, (d[2] - d[0]) * S, T + 2);
      g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); if (v) g.arc(X(d[0]), Y(d[1]), (d[3] - d[1]) * S, 0, Math.PI / 2); else g.arc(X(d[0]), Y(d[1]), (d[2] - d[0]) * S, 0, Math.PI / 2); g.stroke(); });
    // 창: 벽 자리를 비우고 가는 두 줄
    WINS.forEach(function (wn) { var hz = wn[1] === wn[3], light = style === 'nv' || style === 'nvdim'; if (thinBalc && wn[1] === 8.4) return; g.fillStyle = '#fff'; if (hz) g.fillRect(X(wn[0]), Y(wn[1]) - T / 2 - 1, (wn[2] - wn[0]) * S, T + 2); else g.fillRect(X(wn[0]) - T / 2 - 1, Y(wn[1]), T + 2, (wn[3] - wn[1]) * S);
      g.strokeStyle = light ? '#b9b9bc' : '#333'; g.lineWidth = Math.max(1, S * 0.02); [-0.3, 0.3].forEach(function (o) { g.beginPath(); if (hz) { g.moveTo(X(wn[0]), Y(wn[1]) + T * o); g.lineTo(X(wn[2]), Y(wn[1]) + T * o); } else { g.moveTo(X(wn[0]) + T * o, Y(wn[1])); g.lineTo(X(wn[0]) + T * o, Y(wn[3])); } g.stroke(); }); });
    // 글자
    if (opt.labels !== false) ROOMS.forEach(function (r) { var nm = r[0]; if (style === 'nv' || style === 'nvdim') { if (r[1] === '방') nm = '침실' + (++n방); else if (r[1] === '욕실') nm = '욕실' + (++n욕); }
      var fs = Math.max(9, S * (hollow ? 0.2 : style === 'r114' ? 0.38 : 0.26)), cx = X(r[2] + r[4] / 2), cy = Y(r[3] + r[5] / 2); g.fillStyle = style === 'kb' && (r[1] === '현관') ? '#2b1d16' : '#1c2733'; g.font = (hollow ? '' : 'bold ') + fs + 'px sans-serif';
      if (style === 'r114' && r[1] !== '발코니') { g.fillText(nm, cx, cy - fs * 0.6); g.fillText(((r[4] - 0.2) * (r[5] - 0.2)).toFixed(3) + '㎡', cx, cy + fs * 0.65); } else g.fillText(nm, cx, cy); });
    if (style === 'nv') { g.save(); g.globalAlpha = 0.16; g.fillStyle = '#555'; g.font = 'bold ' + S * 1.3 + 'px sans-serif'; g.fillText('NAVER', X(5.5), Y(4.6)); g.restore(); g.fillStyle = '#333'; g.font = S * 0.2 + 'px sans-serif'; g.fillText('전용:80.50, 공용:21.22, 분양:101.72, 계약:135.40', X(4.2), Y(8.4) + S * 0.75); }
    // 치수선
    if (style === 'nvdim' || style === 'r114' || style === 'cad') { g.fillStyle = '#222'; g.strokeStyle = '#555'; g.lineWidth = 1; var fs2 = Math.max(9, S * 0.22), yb = Y(8.4) + S * 0.55; g.font = fs2 + 'px sans-serif';
      [[0, 3.6], [3.6, 8.1], [8.1, 11.5]].forEach(function (d) { g.beginPath(); g.moveTo(X(d[0]), yb - S * 0.22); g.lineTo(X(d[1]), yb - S * 0.22); g.moveTo(X(d[0]), yb - S * 0.34); g.lineTo(X(d[0]), yb - S * 0.1); g.moveTo(X(d[1]), yb - S * 0.34); g.lineTo(X(d[1]), yb - S * 0.1); g.stroke(); g.fillText(Math.round((d[1] - d[0]) * 1000).toLocaleString('en-US'), X((d[0] + d[1]) / 2), yb + fs2 * 0.2); });
      g.fillText('11,500', X(5.75), yb + fs2 * 1.6);
      [[0, 2.7], [2.7, 7.0], [7.0, 8.4]].forEach(function (d) { g.save(); g.translate(X(0) - S * 0.6, Y((d[0] + d[1]) / 2)); g.rotate(-Math.PI / 2); g.fillText(Math.round((d[1] - d[0]) * 1000).toLocaleString('en-US'), 0, 0); g.restore(); }); }
    return c;
  }
  /** 전달 방식 흉내: { width, jpeg(품질), frame(화면 캡처 둘레), rotate(도), dark, blur2x } → canvas */
  function deliver(src, d) {
    d = d || {}; var c = src;
    if (d.blur2x) { var h0 = document.createElement('canvas'); h0.width = Math.round(c.width / 2); h0.height = Math.round(c.height / 2); h0.getContext('2d').drawImage(c, 0, 0, h0.width, h0.height); var u = document.createElement('canvas'); u.width = c.width; u.height = c.height; u.getContext('2d').drawImage(h0, 0, 0, u.width, u.height); c = u; }
    if (d.width) { var k = d.width / c.width, r = document.createElement('canvas'); r.width = d.width; r.height = Math.round(c.height * k); var rg = r.getContext('2d'); rg.imageSmoothingQuality = 'high'; rg.drawImage(c, 0, 0, r.width, r.height); c = r; }
    if (d.frame) { var f = document.createElement('canvas'); f.width = c.width + 120; f.height = c.height + 190; var fg = f.getContext('2d'); fg.fillStyle = '#f4f5f7'; fg.fillRect(0, 0, f.width, f.height); fg.fillStyle = '#fff'; fg.fillRect(40, 110, c.width + 40, c.height + 40); fg.drawImage(c, 60, 130); fg.fillStyle = '#222'; fg.font = 'bold 20px sans-serif'; fg.fillText('단지 정보   시세   평면도   학군', 60, 46); fg.font = '14px sans-serif'; fg.fillStyle = '#666'; fg.fillText('매매 8억 2,000   전세 5억 1,000   84A㎡ 타입 · 방 3 욕실 2', 60, 82); c = f; }
    if (d.rotate || d.dark) { var p = document.createElement('canvas'); p.width = c.width; p.height = c.height; var pg = p.getContext('2d'); pg.fillStyle = d.dark ? '#b9b2a6' : '#fff'; pg.fillRect(0, 0, p.width, p.height); pg.translate(p.width / 2, p.height / 2); pg.rotate((d.rotate || 0) * Math.PI / 180); pg.scale(0.94, 0.94); pg.drawImage(c, -c.width / 2, -c.height / 2); pg.setTransform(1, 0, 0, 1, 0, 0); if (d.dark) { pg.globalCompositeOperation = 'multiply'; pg.fillStyle = 'rgba(205,198,186,1)'; pg.fillRect(0, 0, p.width, p.height); pg.globalCompositeOperation = 'source-over'; } c = p; }
    if (d.jpeg) return new Promise(function (ok) { var im = new Image(); im.onload = function () { var o = document.createElement('canvas'); o.width = im.width; o.height = im.height; o.getContext('2d').drawImage(im, 0, 0); ok(o); }; im.src = c.toDataURL('image/jpeg', d.jpeg); });
    return Promise.resolve(c);
  }
  root.JJFix = { draw: draw, deliver: deliver, truth: truth, ROOMS: ROOMS, WINS: WINS };
})(window);
