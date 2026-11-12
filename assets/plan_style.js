/* 집지니 재가공 도면 (2026-11-10) — 분석 결과(방 다각형·이름·면적)만으로 깨끗한 바탕에 집지니 양식으로 다시 그린다. 원본 그림은 쓰지 않는다.
   JJPlanStyle.svg(결과, { title, sub, date, plain }) → SVG 문자열      결과 = JJPlanTools.analyze / JJPlanAuto 가 돌려준 것 (rooms[].pts·name·kind·area·w·d, mmpp, sum)
   JJPlanStyle.png(결과, opt, 가로화소=1800) → Promise<dataURL>
   벽은 「방 바깥선을 굵게 긋고 그 위에 방 바닥을 덮는」 방식이라 방 사이 틈이 자연스럽게 벽이 된다. 문·창 자리는 알 수 없어 그리지 않는다(공간 구성도). */
(function (root) {
  var INK = '#26302c', PAPER = '#f7f4ee', LINE = '#c9c2b4', ACC = '#4F6B2C', SUBT = '#7a7468';
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
  // 방 다각형들 → 반듯한 외곽선(가로·세로 변만). 칸 단위로 칠해 키우고(벽 두께 절반) 메우고(벽 두께 1.5배까지의 틈) 바깥 테두리를 따라간다.
  // 2026-11-12 대표 지적 「아웃라인이 네이버와 다르다」: 네이버 평면의 외곽은 바깥 치수 줄이 정한다(위·아래 줄의 칸 경계 = 세로 벽, 왼쪽·오른쪽 줄의 시작·끝 = 위·아래 벽).
  //   치수 줄을 읽었으면 외곽을 치수 줄로 만든다: 방들이 차지한 가로 범위를 위 줄 칸 경계에 맞추고, 왼쪽 열 위·아래는 왼쪽 줄, 오른쪽 열 위·아래는 오른쪽 줄의 시작·끝으로.
  //   두 줄의 시작이 250mm 넘게 다르면 그 차이만큼 외곽에 턱이 있다(어긋난 만큼만 턱, 나머지는 직사각). 계단·승강기 칸(방이 없는 칸)은 뺀다.
  function dimHull(r, rooms, mm) {
    var Z = r.치수줄; if (!mm || !Z || !Z.length) return null; var xs = [], ys = []; rooms.forEach(function (o) { o.p.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var rx0 = Math.min.apply(null, xs), rx1 = Math.max.apply(null, xs), ry0 = Math.min.apply(null, ys), ry1 = Math.max.apply(null, ys), cx = (rx0 + rx1) / 2, tol = 450 / mm;
    var ends = function (z) { var d = z.d; if (!d || !d.length) return null; var a = d[0].c - d[0].n / mm / 2, b = d[d.length - 1].c + d[d.length - 1].n / mm / 2, t = [a], acc = a; d.forEach(function (s) { acc += s.n / mm; t.push(acc); }); return { a: a, b: b, ticks: t, n: d.length }; };
    var H = Z.filter(function (z) { return !z.v && z.d && z.d.length >= 2; }).map(ends).filter(Boolean), V = Z.filter(function (z) { return z.v && z.d && z.d.length >= 1; }).map(function (z) { var e = ends(z); if (e) e.o = z.o; return e; }).filter(Boolean);
    if (!H.length || V.length < 2) return null;
    var ticks = []; H.forEach(function (e) { ticks = ticks.concat(e.ticks); }); var snapX = function (x) { var b = null; ticks.forEach(function (t) { if (Math.abs(t - x) <= tol && (b == null || Math.abs(t - x) < Math.abs(b - x))) b = t; }); return b == null ? x : b; };
    var X0 = snapX(rx0), X1 = snapX(rx1); if (X1 - X0 < (rx1 - rx0) * 0.85) return null;
    var Ls = V.filter(function (e) { return e.o < cx; }).sort(function (a, b) { return b.o - a.o; }), Rs = V.filter(function (e) { return e.o > cx; }).sort(function (a, b) { return a.o - b.o; }); if (!Ls.length || !Rs.length) return null;
    var L = Ls[0], R = Rs[0]; if (Math.abs(L.a - ry0) > tol * 2 && Math.abs(R.a - ry0) > tol * 2) return null;   // 치수 줄이 이 집 것이 아니면(엉뚱한 줄) 쓰지 않는다
    var step = 250 / mm, P = [];
    // 턱이 진 자리(가로): 오른쪽 열의 위 끝에 붙은 방들이 시작하는 x — 그 방들 가운데 가장 왼쪽 변을 위 줄 칸 경계에 맞춘다
    var splitAt = function (yEdge, top) { var sx = null; rooms.forEach(function (o) { var px = o.p.map(function (q) { return q[0]; }), py = o.p.map(function (q) { return q[1]; }), e = top ? Math.min.apply(null, py) : Math.max.apply(null, py); if (Math.abs(e - yEdge) > tol) return; var mx = Math.min.apply(null, px); if (sx == null || mx < sx) sx = mx; }); return sx == null ? null : snapX(sx); };
    var topL = L.a, topR = R.a, botL = L.b, botR = R.b;
    P.push([X0, topL]);
    if (Math.abs(topL - topR) > step) { var s1 = topR > topL ? splitAt(topR, true) : splitAt(topL, true); if (s1 == null || s1 <= X0 || s1 >= X1) return null; if (topR > topL) { P.push([s1, topL]); P.push([s1, topR]); } else { P[0] = [X0, topL]; P.push([s1, topL]); P.push([s1, topR]); } }
    P.push([X1, topR]); P.push([X1, botR]);
    if (Math.abs(botL - botR) > step) { var s2 = splitAt(botR < botL ? botR : botL, false); if (s2 == null || s2 <= X0 || s2 >= X1) return null; P.push([s2, botR]); P.push([s2, botL]); }
    P.push([X0, botL]);
    return P;
  }
  function rectHull(rooms, T, D, mm) {
    var st = Math.max(1, D / 500), xs = [], ys = []; rooms.forEach(function (o) { o.p.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var CL = Math.max(T * 1.5, mm ? 1500 / mm : D * 0.12), g = Math.ceil(T * 3 / st) + 2, x0 = Math.min.apply(null, xs) - g * st, y0 = Math.min.apply(null, ys) - g * st, nx = Math.ceil((Math.max.apply(null, xs) - x0) / st) + g + 1, ny = Math.ceil((Math.max.apply(null, ys) - y0) / st) + g + 1, N = nx * ny, a = new Uint8Array(N), i, j, k;
    var inP = function (x, y, P) { var c = false; for (var m = 0, n = P.length - 1; m < P.length; n = m++) { if (((P[m][1] > y) !== (P[n][1] > y)) && (x < (P[n][0] - P[m][0]) * (y - P[m][1]) / (P[n][1] - P[m][1]) + P[m][0])) c = !c; } return c; };
    rooms.forEach(function (o) { var px = o.p.map(function (q) { return q[0]; }), py = o.p.map(function (q) { return q[1]; }), i0 = Math.max(0, Math.floor((Math.min.apply(null, px) - x0) / st)), i1 = Math.min(nx - 1, Math.ceil((Math.max.apply(null, px) - x0) / st)), j0 = Math.max(0, Math.floor((Math.min.apply(null, py) - y0) / st)), j1 = Math.min(ny - 1, Math.ceil((Math.max.apply(null, py) - y0) / st));
      for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) if (inP(x0 + (i + 0.5) * st, y0 + (j + 0.5) * st, o.p)) a[j * nx + i] = 1; });
    var grow = function (src, r, val) { var o = new Uint8Array(N), t = new Uint8Array(N); for (j = 0; j < ny; j++) { var run = -1e9; for (i = 0; i < nx; i++) { if (src[j * nx + i] === val) run = i; t[j * nx + i] = (i - run <= r) ? 1 : 0; } run = 1e9; for (i = nx - 1; i >= 0; i--) { if (src[j * nx + i] === val) run = i; if (run - i <= r) t[j * nx + i] = 1; } }
      for (i = 0; i < nx; i++) { var rn = -1e9; for (j = 0; j < ny; j++) { if (t[j * nx + i]) rn = j; o[j * nx + i] = (j - rn <= r) ? 1 : 0; } rn = 1e9; for (j = ny - 1; j >= 0; j--) { if (t[j * nx + i]) rn = j; if (rn - j <= r) o[j * nx + i] = 1; } } return o; };   // 네모 모양으로 키우기(모서리가 반듯하게 남는다)
    var rC = Math.max(1, Math.round(T * 1.5 / st)), rH = Math.max(1, Math.round(T * 0.3 / st));
    var c1 = grow(a, rC, 1), inv = new Uint8Array(N); for (k = 0; k < N; k++) inv[k] = c1[k] ? 0 : 1; var e1 = grow(inv, rC, 1); for (k = 0; k < N; k++) a[k] = e1[k] ? 0 : 1;   // 닫기: 좁은 틈 메우기
    a = grow(a, rH, 1);                                                                                                  // 벽 바깥면까지
    // 2026-11-12 대표 원칙 「평면도는 기본이 직사각 외곽, 일부러 움푹 판 아파트는 없다 — 파여 보이는 곳은 피트·PD 같은 설비 공간을 잘못 잡은 것」:
    //   집이 차지한 네모 안의 빈 곳을 덩어리별로 보고, 좁은 쪽 폭이 3m 미만이면 메운다(설비 공간). 3m 넘게 꺾인 집(탑상형 ㄱ자)만 꺾인 대로 둔다.
    (function () { var bi0 = nx, bi1 = -1, bj0 = ny, bj1 = -1; for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (a[j * nx + i]) { if (i < bi0) bi0 = i; if (i > bi1) bi1 = i; if (j < bj0) bj0 = j; if (j > bj1) bj1 = j; } if (bi1 < 0) return;
      var seen = new Uint8Array(N), lim = CL * 2 / st; for (j = bj0; j <= bj1; j++) for (i = bi0; i <= bi1; i++) { var s0 = j * nx + i; if (a[s0] || seen[s0]) continue; var comp = [], st2 = [s0], ci0 = i, ci1 = i, cj0 = j, cj1 = j; seen[s0] = 1;
        while (st2.length) { var kk = st2.pop(), ki = kk % nx, kj = (kk / nx) | 0; comp.push(kk); if (ki < ci0) ci0 = ki; if (ki > ci1) ci1 = ki; if (kj < cj0) cj0 = kj; if (kj > cj1) cj1 = kj;
          [[ki - 1, kj], [ki + 1, kj], [ki, kj - 1], [ki, kj + 1]].forEach(function (v) { if (v[0] < bi0 || v[0] > bi1 || v[1] < bj0 || v[1] > bj1) return; var n2 = v[1] * nx + v[0]; if (!a[n2] && !seen[n2]) { seen[n2] = 1; st2.push(n2); } }); }
        if (Math.min(ci1 - ci0 + 1, cj1 - cj0 + 1) < lim) comp.forEach(function (kk) { a[kk] = 1; }); } })();
    var out = new Uint8Array(N), q = []; for (i = 0; i < nx; i++) { q.push(i, (ny - 1) * nx + i); } for (j = 0; j < ny; j++) { q.push(j * nx, j * nx + nx - 1); }   // 안쪽 구멍 메우기: 바깥에서 닿는 빈칸만 바깥
    while (q.length) { k = q.pop(); if (out[k] || a[k]) continue; out[k] = 1; var ci = k % nx, cj = (k / nx) | 0; if (ci > 0) q.push(k - 1); if (ci < nx - 1) q.push(k + 1); if (cj > 0) q.push(k - nx); if (cj < ny - 1) q.push(k + nx); }
    var on = function (ii, jj) { return ii >= 0 && jj >= 0 && ii < nx && jj < ny && !out[jj * nx + ii]; };
    // 테두리 따라가기: 왼쪽 위 첫 칸의 윗변에서 시작해 칸 모서리를 따라 시계 방향으로
    var sj = -1, si = -1; for (j = 0; j < ny && sj < 0; j++) for (i = 0; i < nx; i++) if (on(i, j)) { si = i; sj = j; break; } if (sj < 0) return null;
    var pts = [], cx = si, cy = sj, dir = 0, guard = 0, DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];   // 꼭짓점 좌표(칸 모서리), 방향 0 오른쪽 1 아래 2 왼쪽 3 위
    var cell = function (vx, vy, d) { // 방향 d 로 나아갈 때 오른쪽(안쪽) 칸과 왼쪽(바깥) 칸
      if (d === 0) return [on(vx, vy), on(vx, vy - 1)]; if (d === 1) return [on(vx - 1, vy), on(vx, vy)]; if (d === 2) return [on(vx - 1, vy - 1), on(vx - 1, vy)]; return [on(vx, vy - 1), on(vx - 1, vy - 1)]; };
    do { pts.push([cx, cy]); var turned = false; for (var t2 = 0; t2 < 4; t2++) { var d2 = (dir + 3 + t2) % 4, c = cell(cx, cy, d2); if (c[0] && !c[1]) { dir = d2; turned = true; break; } } if (!turned) return null; cx += DX[dir]; cy += DY[dir]; } while ((cx !== si || cy !== sj) && ++guard < N * 4);
    var P = []; for (k = 0; k < pts.length; k++) { var pr = pts[(k + pts.length - 1) % pts.length], cu = pts[k], nx2 = pts[(k + 1) % pts.length]; if ((pr[0] === cu[0] && cu[0] === nx2[0]) || (pr[1] === cu[1] && cu[1] === nx2[1])) continue; P.push(cu); }
    return P.map(function (v) { return [x0 + v[0] * st, y0 + v[1] * st]; });
  }
  function svg(r, opt) {
    opt = opt || {}; if (!r || !r.rooms || !r.rooms.length) return '';
    // 2026-11-12 대표 지시 「캐드식으로」(오토캐드 화면 그림을 보여 주며): 벽선이 있는 평면은 오토캐드 화면처럼 — 짙은 바탕, 회색 벽(A-WALL-PATT),
    //   흰 글자, 파란 창(A-GLAZ), 청록 문(A-DOOR). 이 함수 안의 색 이름을 통째로 바꾼다
    var CADV = !!(r.그림 && r.그림.벽선 && r.그림.벽선.length && Number(r.mmpp) > 0) && opt.cadStyle !== false;
    var DK = CADV && (opt.cadBg || (typeof window !== 'undefined' && window.JJ_CAD_BG) || 'dark') !== 'light';   // 「배경은 반전 가능하게」: 짙은 바탕(오토캐드 화면) ↔ 흰 바탕(출력)
    var INK = DK ? '#E8EAED' : '#26302c', PAPER = DK ? '#212830' : (CADV ? '#ffffff' : '#f7f4ee'), LINE = DK ? '#5B6670' : '#c9c2b4', SUBT = DK ? '#AEB6BF' : '#7a7468', BGC = PAPER, WOUT = DK ? '#C9CDD2' : '#26302c';
    var rooms = r.rooms.filter(function (m) { return m.pts && m.pts.length >= 3; }).map(function (m) { return { m: m, p: m.pts.map(function (q) { return [q[0], q[1]]; }) }; }); if (!rooms.length) return '';
    var xs = [], ys = []; rooms.forEach(function (o) { o.p.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var rx0 = Math.min.apply(null, xs), rx1 = Math.max.apply(null, xs), ry0 = Math.min.apply(null, ys), ry1 = Math.max.apply(null, ys);   // 방만의 범위(치수선 기준)
    var hull = r.외곽 && r.외곽.length >= 4 ? r.외곽.map(function (q) { return [q[0], q[1]]; }) : null; if (hull) hull.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); if (r.그림 && r.그림.틀) { xs.push(r.그림.틀[0], r.그림.틀[2]); ys.push(r.그림.틀[1], r.그림.틀[3]); }   /* 공용부까지 따라 그린 건물 전체가 들어가게 */ // 집 외곽선(방과 별개로 한 줄)
    var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys), bw = bx1 - bx0, bh = by1 - by0, D = Math.max(bw, bh);
    snapAll(rooms, D * 0.024);   // 벽 두께(약 200mm)만큼 떨어진 두 방의 변을 벽 가운데 한 줄로 모은다 → 벽선이 겹치지 않고 한 줄
    var mm = Number(r.mmpp) || 0, T = mm ? Math.max(D * 0.006, 190 / mm) : D * 0.014, Tb = T * 0.45;   // 벽 굵기: 척도를 알면 약 190mm
    // 2026-11-12 대표 지적 「외곽이 구멍 나고 찌그러진다」: 원본 그림을 따라 딴 외곽선은 창·문 자리에서 끊기고 비스듬히 꺾여 들어왔다(원인).
    //   외곽선은 그림에서 따지 않고, 반듯하게 고친 방들을 합친 모양에서 다시 만든다 — 방을 벽 두께 절반만큼 키워 합치고, 벽 두께보다 좁은 틈·구멍은 메우고, 가로·세로 변만 남긴다.
    if (rooms.length >= 2) { var dh = null; try { dh = dimHull(r, rooms, mm); } catch (_d) {} if (dh) hull = dh; else { try { var rh = rectHull(rooms, T, D, mm); if (rh && rh.length >= 4) hull = rh; } catch (_h) {} } }
    var pad = D * 0.11, head = D * 0.15, foot = D * 0.2, VW = bw + pad * 2, VH = bh + pad * 2 + head + foot, ox = pad - bx0, oy = pad + head - by0, fs = D / 38, id = 'jj' + Math.round(bx0 + by1 + rooms.length * 7);
    var bare = opt.bare && opt.bare.W ? opt.bare : null; if (bare) { VW = bare.W; VH = bare.H; ox = 0; oy = 0; }   // 편집 바탕용: 머리·발 없이 원본 그림과 같은 자리·크기로 그린다(표시가 그대로 겹친다)
    var pts = function (p) { return p.map(function (q) { return (q[0] + ox).toFixed(1) + ',' + (q[1] + oy).toFixed(1); }).join(' '); };
    var F = "font-family=\"Pretendard,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif\"";
    var h = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW.toFixed(0) + ' ' + VH.toFixed(0) + '" style="width:100%;height:auto;display:block;background:' + BGC + '" ' + F + '>'];
    h.push('<defs>' +
      '<pattern id="' + id + 'b" width="' + (D / 60).toFixed(1) + '" height="' + (D / 60).toFixed(1) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="' + (D / 60).toFixed(1) + '" stroke="' + LINE + '" stroke-width="' + (D / 700).toFixed(2) + '"/></pattern>' +
      '<pattern id="' + id + 't" width="' + (D / 45).toFixed(1) + '" height="' + (D / 45).toFixed(1) + '" patternUnits="userSpaceOnUse"><path d="M0 0H' + (D / 45).toFixed(1) + 'M0 0V' + (D / 45).toFixed(1) + '" stroke="#c3d0d4" stroke-width="' + (D / 600).toFixed(2) + '" fill="none"/></pattern>' +
      '<pattern id="' + id + 'w" width="' + (D / 3.2).toFixed(0) + '" height="' + (D / 5.5).toFixed(0) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><text x="0" y="' + (D / 11).toFixed(0) + '" font-size="' + (D / 30).toFixed(1) + '" font-weight="800" fill="' + ACC + '" fill-opacity="0.055" letter-spacing="' + (D / 160).toFixed(1) + '">집지니</text></pattern>' +
      '</defs>');
    h.push('<rect width="100%" height="100%" fill="' + PAPER + '"/>');
    if (!bare) {
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
    }
    // 바닥을 먼저 칠하고, 벽은 모든 방 둘레를 같은 굵기의 먹선 한 줄로 긋는다(맞닿은 변은 같은 자리라 겹쳐 보이지 않는다)
    var outer = function (k) { return k === '발코니' || k === '실외기실'; }, TW = Math.max(D * 0.006, Math.min(D * 0.0092, T * 0.55));   // 2026-11-12 대표 지적 「굵은 벽이 너무 두껍다」 — 벽선을 3할쯤 가늘게
    var G = r.그림 && r.그림.벽 ? r.그림 : null;   // 2026-11-12 대표 지시 「네이버 도면을 그대로 가져와 우리 장점만 얹어라」: 원본을 따라 그린 벽·선이 있으면 벽·문·창·기구는 그것으로 그린다
    if (hull && !G) h.push('<polygon points="' + pts(hull) + '" fill="' + (FILL.피트 || '#ddd') + '"/><polygon points="' + pts(hull) + '" fill="url(#' + id + 'b)"/><polygon points="' + pts(hull) + '" fill="none" stroke="' + INK + '" stroke-width="' + (TW * 1.2).toFixed(2) + '" stroke-linejoin="miter" stroke-miterlimit="3"/>');   // 외곽선을 먼저 긋고 그 안에 방을 놓는다 — 방을 못 찾은 자리도 집 모양은 남는다
    var Gc = r.그림 && r.그림.칸 && r.그림.칸.length ? r.그림.칸 : null, done = {};
    if (Gc) Gc.forEach(function (c) { var o = rooms[c.i]; if (!o) return; done[c.i] = 1; var k = o.m.kind, f = CADV ? PAPER : (FILL[k] || FILL.기타), tr = ' transform="translate(' + ox.toFixed(1) + ' ' + oy.toFixed(1) + ')"'; h.push('<path d="' + c.d + '" fill="' + f + '" fill-rule="evenodd"' + tr + '/>');
      if (CADV) {} else if (k === '발코니' || k === '실외기실') h.push('<path d="' + c.d + '" fill="url(#' + id + 'b)" fill-rule="evenodd"' + tr + '/>'); else if (k === '욕실' || k === '현관') h.push('<path d="' + c.d + '" fill="url(#' + id + 't)" fill-rule="evenodd"' + tr + '/>'); });   // 원본에서 따 온 칸 모양으로 칠하기
    rooms.forEach(function (o, oi) { if (done[oi]) return; var k = o.m.kind, f = CADV ? PAPER : (FILL[k] || FILL.기타); h.push('<polygon points="' + pts(o.p) + '" fill="' + f + '"/>');
      if (CADV) {} else if (k === '발코니' || k === '실외기실') h.push('<polygon points="' + pts(o.p) + '" fill="url(#' + id + 'b)"/>'); else if (k === '욕실' || k === '현관') h.push('<polygon points="' + pts(o.p) + '" fill="url(#' + id + 't)"/>');
      else if (k === '피트') { var px = o.p.map(function (q) { return q[0]; }), py = o.p.map(function (q) { return q[1]; }), ax = Math.min.apply(null, px) + ox, bx = Math.max.apply(null, px) + ox, ay = Math.min.apply(null, py) + oy, by2 = Math.max.apply(null, py) + oy; h.push('<path d="M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + bx.toFixed(1) + ' ' + by2.toFixed(1) + 'M' + bx.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + ax.toFixed(1) + ' ' + by2.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (D / 700).toFixed(2) + '" fill="none"/>'); } });
    // 2026-11-12 네이버 평면과 맞추기: 외곽 안인데 방이 아닌 곳(설비 공간 피트·PD)은 가위표 빗금, 욕실에는 욕조·변기·세면대, 주방에는 싱크대·가스레인지를 그린다(그림만 — 물량에는 넣지 않는다).
    // 기구는 원본 그림에서 읽은 자리(r.기구)에만 그린다 — 읽지 못한 칸에 지어 넣지 않는다(2026-11-12 대표 지적 「기구가 전혀 맞지 않는다」)
    if (G) { var tr0 = ' transform="translate(' + ox.toFixed(1) + ' ' + oy.toFixed(1) + ')"';
      // 2026-11-12 대표 지적 「외곽 밖으로 튀어나간 선을 정리」: 따라 그린 벽·선은 외곽선(+벽 두께 절반) 안쪽만 보이게 자른다
      var mk = '';
      if (false) {   // 2026-11-12 공용부 외곽까지 원본 벽 그대로 — 자르지 않는다
        h.push('<mask id="' + id + 'k" maskUnits="userSpaceOnUse"><polygon points="' + pts(hull) + '" fill="#fff" stroke="#fff" stroke-width="' + (T * 1.1).toFixed(1) + '" stroke-linejoin="miter"/></mask>'); mk = ' mask="url(#' + id + 'k)"'; }
      h.push('<g' + mk + '>');
      if (G.선) h.push('<path d="' + G.선 + '" fill="#5a5a55" stroke="#5a5a55" stroke-width="0.9" stroke-linejoin="round" fill-rule="evenodd"' + tr0 + '/>');
      if (!G.샷시 && !G.먹) (G.창선 || []).forEach(function (q) { var x1 = q[0] === 'h' ? q[2] : q[1], y1 = q[0] === 'h' ? q[1] : q[2], x2 = q[0] === 'h' ? q[3] : q[1], y2 = q[0] === 'h' ? q[1] : q[3]; h.push('<line x1="' + (x1 + ox).toFixed(1) + '" y1="' + (y1 + oy).toFixed(1) + '" x2="' + (x2 + ox).toFixed(1) + '" y2="' + (y2 + oy).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (TW * 0.16).toFixed(2) + '"/>'); });   // 샷시·창: 원본에서 읽은 직선 그대로
      if (false && G.공용) h.push('<path d="' + G.공용 + '" fill="none" stroke="' + INK + '" stroke-width="' + (TW * 0.16).toFixed(2) + '" stroke-linejoin="round"' + tr0 + '/>');   // 계단·승강기 등 공용부의 가는 선(원본 그대로)
      if (G.먹) h.push('<path d="' + G.먹 + '" fill="' + INK + '" fill-rule="evenodd"' + tr0 + '/>');   // 대원칙(2026-11-12): 검정선은 원본 그대로
      else if (G.벽선 && G.벽선.length && r.mmpp > 0) {   /* 2026-11-12 대표 지시 「그냥 캐드 파일로 바로 올려줘 — 따로 메운 뒤 다듬지 말고」: 캐드 파일과 같은 자료(벽선·창·문 기호)를 그대로 그린다 */
        var cm = r.mmpp, rr = [];
        G.벽선.forEach(function (w) { var hT = w[4] / cm / 2; rr.push(w[0] === 'h' ? 'M' + (w[1] - 0.6).toFixed(1) + ' ' + (w[3] - hT).toFixed(1) + 'H' + (w[2] + 0.6).toFixed(1) + 'V' + (w[3] + hT).toFixed(1) + 'H' + (w[1] - 0.6).toFixed(1) + 'Z' : 'M' + (w[3] - hT).toFixed(1) + ' ' + (w[1] - 0.6).toFixed(1) + 'H' + (w[3] + hT).toFixed(1) + 'V' + (w[2] + 0.6).toFixed(1) + 'H' + (w[3] - hT).toFixed(1) + 'Z'); });
        (G.사선벽 || []).forEach(function (d) { var dx = d[2] - d[0], dy = d[3] - d[1], L = Math.hypot(dx, dy) || 1, hT = d[4] / cm / 2, nx = -dy / L * hT, ny = dx / L * hT;   /* 2026-11-12 비스듬한 벽(테라스·실외기실): 두께 있는 사각형 */
          rr.push('M' + (d[0] + nx).toFixed(1) + ' ' + (d[1] + ny).toFixed(1) + 'L' + (d[2] + nx).toFixed(1) + ' ' + (d[3] + ny).toFixed(1) + 'L' + (d[2] - nx).toFixed(1) + ' ' + (d[3] - ny).toFixed(1) + 'L' + (d[0] - nx).toFixed(1) + ' ' + (d[1] - ny).toFixed(1) + 'Z'); });
        var sw = Math.max(0.7, TW * 0.14).toFixed(2), CW = DK ? '#8E9194' : '#A9ADB2', CD = DK ? '#22B8CF' : '#0C8599', CG = DK ? '#4C6EF5' : '#1D4ED8';
        h.push('<path d="' + rr.join('') + '" fill="' + CW + '" stroke="' + WOUT + '" stroke-width="' + (sw * 0.8).toFixed(2) + '" fill-rule="nonzero"' + tr0 + '/>');
        (G.샷시 || []).forEach(function (q) { var x0 = q[1], y0 = q[2], x1 = q[3], y1 = q[4], hz = q[0] === 'h', c = hz ? (y0 + y1) / 2 : (x0 + x1) / 2, T = hz ? (y1 - y0) : (x1 - x0), o = T * 0.12;   /* 캐드 기호 JJ-WIN-DOUBLE: 틀 + 가운데 두 줄 */
          h.push('<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (y1 - y0).toFixed(1) + '" fill="' + PAPER + '" stroke="' + CG + '" stroke-width="' + sw + '"' + tr0 + '/>');
          [c - o, c + o].forEach(function (v) { h.push(hz ? '<line x1="' + x0.toFixed(1) + '" y1="' + v.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + v.toFixed(1) + '" stroke="' + CG + '" stroke-width="' + sw + '"' + tr0 + '/>' : '<line x1="' + v.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + v.toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + CG + '" stroke-width="' + sw + '"' + tr0 + '/>'); }); });
        (G.문 || []).forEach(function (q) { var R0 = Math.hypot(q.x2 - q.x1, q.y2 - q.y1); if (R0 < 4) return;   /* 캐드 기호 JJ-DOOR-SWING: 경첩에서 문짝 선 + 4분의 1 호 */
          var lx = q.cx - q.x1, ly = q.cy - q.y1, Ll = Math.hypot(lx, ly) || 1, ex = q.x1 + lx / Ll * R0, ey = q.y1 + ly / Ll * R0, cr = (q.x2 - q.x1) * ly - (q.y2 - q.y1) * lx;
          h.push('<line x1="' + q.x1.toFixed(1) + '" y1="' + q.y1.toFixed(1) + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="' + CD + '" stroke-width="' + (sw * 1.6).toFixed(2) + '"' + tr0 + '/>');
          h.push('<path d="M' + q.x2.toFixed(1) + ' ' + q.y2.toFixed(1) + 'A' + R0.toFixed(1) + ' ' + R0.toFixed(1) + ' 0 0 ' + (cr > 0 ? 1 : 0) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '" fill="none" stroke="' + CD + '" stroke-width="' + sw + '"' + tr0 + '/>'); }); }
      else h.push('<path d="' + G.벽 + '" fill="' + INK + '" fill-rule="' + (G.벽채움 === 'nonzero' ? 'nonzero' : 'evenodd') + '"' + tr0 + '/>');   /* 캐드 파일에서 읽은 벽은 네모가 겹쳐 있어 nonzero */
      if (false) (G.샷시 || []).forEach(function (q) { var x0 = q[1] + ox, y0 = q[2] + oy, x1 = q[3] + ox, y1 = q[4] + oy, w = x1 - x0, hh = y1 - y0, sw4 = (TW * 0.16).toFixed(2); h.push('<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '" fill="#ffffff" stroke="' + INK + '" stroke-width="' + sw4 + '"/>'); h.push(q[0] === 'h' ? '<line x1="' + x0.toFixed(1) + '" y1="' + ((y0 + y1) / 2).toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + ((y0 + y1) / 2).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + sw4 + '"/>' : '<line x1="' + ((x0 + x1) / 2).toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + ((x0 + x1) / 2).toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + sw4 + '"/>'); });   // 샷시: 원본 벽 틈 자리에 네모 + 가운데 줄(네이버식)
      h.push('</g>'); }
    // 공용부·승강기 이름(2026-11-12 대표 지시): 글씨체·크기·굵기를 방 이름(안방·거실)과 같게
    var lab1 = function (t, x, y) { var f1 = fs * 0.9;   /* EV·공용부 이름은 모든 평면에서 같은 크기(큰 방 이름과 같게) */ h.push('<text x="' + x.toFixed(1) + '" y="' + (y + f1 * 0.36).toFixed(1) + '" text-anchor="middle" font-size="' + f1.toFixed(1) + '" font-weight="700" fill="' + INK + '">' + t + '</text>'); };
    if (G && G.EV) G.EV.forEach(function (e) { lab1('EV', (e[0] + e[2]) / 2 + ox, (e[1] + e[3]) / 2 + oy); });   // 승강기는 이름만(상자 없이)
    if (G && G.공용칸) G.공용칸.forEach(function (c) { lab1('공용부', c[0] + ox, c[1] + oy, (c[2] || 60) * 1.4); });
    if (false && mm && !opt.noFix && r.기구 && r.기구.length) {   // 2026-11-12 대표 지시: 싱크대·붙박이장 상자 모두 그리지 않는다
 var sw = (TW * 0.18).toFixed(2), Mx = function (v) { return v / mm; };
      var rr = function (x, y, w, hh, rad) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh.toFixed(1) + '"' + (rad ? ' rx="' + rad.toFixed(1) + '"' : '') + ' fill="#ffffff" stroke="' + INK + '" stroke-width="' + sw + '"/>'; };
      r.기구.forEach(function (f) { if (!/^(싱크대|붙박이장)$/.test(f.k)) return; if (G && G.먹 && f.k !== '싱크대') return;   /* 붙박이장은 원본 검정선에 이미 있다 */   /* 욕실 기구는 그리지 않는다(대표 지시 2026-11-12) */ var x = f.x0 + ox, y = f.y0 + oy, w = f.x1 - f.x0, hh = f.y1 - f.y0, cx = x + w / 2, cy = y + hh / 2, hor = w >= hh;
        if (f.k === '욕조') { h.push(rr(x, y, w, hh, Mx(100))); h.push(rr(x + Mx(70), y + Mx(70), w - Mx(140), hh - Mx(140), Mx(200))); }
        else if (f.k === '변기') { h.push('<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + (w / 2).toFixed(1) + '" ry="' + (hh / 2).toFixed(1) + '" fill="#fff" stroke="' + INK + '" stroke-width="' + sw + '"/>'); }
        else if (f.k === '세면대') { h.push(rr(x, y, w, hh, Math.min(w, hh) * 0.2)); h.push('<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="' + (w * 0.32).toFixed(1) + '" ry="' + (hh * 0.32).toFixed(1) + '" fill="none" stroke="' + INK + '" stroke-width="' + sw + '"/>'); }
        else if (f.k === '샤워') { h.push(rr(x, y, w, hh)); h.push('<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + (x + w).toFixed(1) + ' ' + (y + hh).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + sw + '"/>'); }
        else if (f.k === '붙박이장' || f.k === '신발장') { h.push(rr(x, y, w, hh)); h.push('<path d="M' + x.toFixed(1) + ' ' + (y + hh).toFixed(1) + 'L' + (x + w).toFixed(1) + ' ' + y.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + sw + '"/>'); }
        else if (f.k === '싱크대') { h.push(rr(x, y, w, hh)); h.push('<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + (x + w).toFixed(1) + ' ' + (y + hh).toFixed(1) + 'M' + (x + w).toFixed(1) + ' ' + y.toFixed(1) + 'L' + x.toFixed(1) + ' ' + (y + hh).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + sw + '"/>'); } }); }   // 싱크대는 네모에 가위표만(대표 지시 2026-11-12)
    // 2026-11-12 대표 지적 「거실에 벽이 있는 것처럼 그렸다 — 네이버와 같게」: 거실·주방·식당·복도는 한 덩어리 공간이라 서로 맞닿은 변에는 벽을 긋지 않는다.
    //   방 둘레를 변마다 따로 긋고, 열린 공간끼리 겹치는 구간만 빼고 긋는다.
    var openK = function (o) { return /^(거실|주방|식당|복도|현관)$/.test(o.m.kind || '') || /거실|주방|식당|복도|현관/.test(o.m.name || ''); }, isEnt = function (o) { return (o.m.kind || '') === '현관' || /현관/.test(o.m.name || ''); }, eps = T * 0.6;   /* 현관도 칸막이 벽이 없다(대표 지적 2026-11-12) — 바닥 높이 차만 가는 선으로 */
    if (!G) rooms.forEach(function (o) { for (var e = 0; e < o.p.length; e++) { var A = o.p[e], B = o.p[(e + 1) % o.p.length], hz = Math.abs(A[1] - B[1]) < 0.01, vt = Math.abs(A[0] - B[0]) < 0.01, segs = [[0, 1]];
        if ((hz || vt) && openK(o)) { var c0 = hz ? A[1] : A[0], a0 = hz ? A[0] : A[1], a1 = hz ? B[0] : B[1], lo = Math.min(a0, a1), hi = Math.max(a0, a1), L = hi - lo || 1;
          rooms.forEach(function (n) { if (n === o || !openK(n)) return; for (var f = 0; f < n.p.length; f++) { var C = n.p[f], E = n.p[(f + 1) % n.p.length]; if (hz ? Math.abs(C[1] - E[1]) > 0.01 : Math.abs(C[0] - E[0]) > 0.01) continue; if (Math.abs((hz ? C[1] : C[0]) - c0) > eps) continue;
            var b0 = Math.max(lo, Math.min(hz ? C[0] : C[1], hz ? E[0] : E[1])), b1 = Math.min(hi, Math.max(hz ? C[0] : C[1], hz ? E[0] : E[1])); if (b1 - b0 < eps) continue;
            var t0 = (b0 - lo) / L, t1 = (b1 - lo) / L; if (a0 > a1) { var tt = 1 - t1; t1 = 1 - t0; t0 = tt; } if (isEnt(o) || isEnt(n)) { var sx = A[0] + (B[0] - A[0]) * t0 + ox, sy = A[1] + (B[1] - A[1]) * t0 + oy, ex = A[0] + (B[0] - A[0]) * t1 + ox, ey = A[1] + (B[1] - A[1]) * t1 + oy; h.push('<line x1="' + sx.toFixed(1) + '" y1="' + sy.toFixed(1) + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" stroke="' + SUBT + '" stroke-width="' + (TW * 0.16).toFixed(2) + '"/>'); } var nx = []; segs.forEach(function (sg) { if (t1 <= sg[0] || t0 >= sg[1]) nx.push(sg); else { if (t0 > sg[0]) nx.push([sg[0], t0]); if (t1 < sg[1]) nx.push([t1, sg[1]]); } }); segs = nx; } }); }
        segs.forEach(function (sg) { if (sg[1] - sg[0] < 0.001) return; var X1 = A[0] + (B[0] - A[0]) * sg[0] + ox, Y1 = A[1] + (B[1] - A[1]) * sg[0] + oy, X2 = A[0] + (B[0] - A[0]) * sg[1] + ox, Y2 = A[1] + (B[1] - A[1]) * sg[1] + oy;
          h.push('<line x1="' + X1.toFixed(1) + '" y1="' + Y1.toFixed(1) + '" x2="' + X2.toFixed(1) + '" y2="' + Y2.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + TW.toFixed(2) + '" stroke-linecap="square"/>'); }); } });
    // 창: 벽선 위에 흰 틈 + 가는 두 줄(샷시)로 그리고 종류·폭을 적는다. 방을 반듯하게 편 뒤라 가장 가까운 벽선에 붙인다
    if (!G) (r.창 || []).forEach(function (wn) { var hor = Math.abs(wn.x2 - wn.x1) >= Math.abs(wn.y2 - wn.y1), c = hor ? (wn.y1 + wn.y2) / 2 : (wn.x1 + wn.x2) / 2, best = null, bd = D * 0.035, a0 = hor ? Math.min(wn.x1, wn.x2) : Math.min(wn.y1, wn.y2), a1 = hor ? Math.max(wn.x1, wn.x2) : Math.max(wn.y1, wn.y2);
      rooms.concat(hull ? [{ p: hull }] : []).forEach(function (o) { for (var i = 0; i < o.p.length; i++) { var p1 = o.p[i], p2 = o.p[(i + 1) % o.p.length], eh = Math.abs(p1[1] - p2[1]) < 0.01, ev = Math.abs(p1[0] - p2[0]) < 0.01; if (hor ? !eh : !ev) continue; var ec = hor ? p1[1] : p1[0], lo = hor ? Math.min(p1[0], p2[0]) : Math.min(p1[1], p2[1]), hi = hor ? Math.max(p1[0], p2[0]) : Math.max(p1[1], p2[1]); if (Math.min(hi, a1) - Math.max(lo, a0) < (a1 - a0) * 0.5) continue; var d = Math.abs(ec - c); if (d < bd) { bd = d; best = ec; } } });
      if (best == null) return; var X1 = hor ? a0 + ox : best + ox, Y1 = hor ? best + oy : a0 + oy, X2 = hor ? a1 + ox : best + ox, Y2 = hor ? best + oy : a1 + oy, g = TW * 0.36, nx = hor ? 0 : 1, ny = hor ? 1 : 0;
      h.push('<line x1="' + X1.toFixed(1) + '" y1="' + Y1.toFixed(1) + '" x2="' + X2.toFixed(1) + '" y2="' + Y2.toFixed(1) + '" stroke="' + PAPER + '" stroke-width="' + (TW * 1.5).toFixed(2) + '"/>');
      [-1, 1].forEach(function (sg) { h.push('<line x1="' + (X1 + nx * g * sg).toFixed(1) + '" y1="' + (Y1 + ny * g * sg).toFixed(1) + '" x2="' + (X2 + nx * g * sg).toFixed(1) + '" y2="' + (Y2 + ny * g * sg).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (TW * 0.2).toFixed(2) + '"/>'); });
      [[X1, Y1], [X2, Y2]].forEach(function (e) { h.push('<line x1="' + (e[0] - nx * TW * 0.62).toFixed(1) + '" y1="' + (e[1] - ny * TW * 0.62).toFixed(1) + '" x2="' + (e[0] + nx * TW * 0.62).toFixed(1) + '" y2="' + (e[1] + ny * TW * 0.62).toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (TW * 0.45).toFixed(2) + '"/>'); });
      wn._at = [(X1 + X2) / 2, (Y1 + Y2) / 2, hor]; });
    // 문(2026-11-12): 벽을 문 폭만큼 끊고 문짝 한 줄과 열리는 호를 그린다. 문 자리는 가장 가까운 방 벽선에 붙인다.
    if (!G) (r.문 || []).forEach(function (dr) { var hor = Math.abs(dr.x2 - dr.x1) >= Math.abs(dr.y2 - dr.y1), c = hor ? (dr.y1 + dr.y2) / 2 : (dr.x1 + dr.x2) / 2, best = null, bd = D * 0.035, a0 = hor ? Math.min(dr.x1, dr.x2) : Math.min(dr.y1, dr.y2), a1 = hor ? Math.max(dr.x1, dr.x2) : Math.max(dr.y1, dr.y2), L = a1 - a0;
      if (L < D * 0.02 || L > D * 0.16) return;
      rooms.forEach(function (o) { for (var i = 0; i < o.p.length; i++) { var p1 = o.p[i], p2 = o.p[(i + 1) % o.p.length], eh = Math.abs(p1[1] - p2[1]) < 0.01, ev = Math.abs(p1[0] - p2[0]) < 0.01; if (hor ? !eh : !ev) continue; var ec = hor ? p1[1] : p1[0], lo = hor ? Math.min(p1[0], p2[0]) : Math.min(p1[1], p2[1]), hi = hor ? Math.max(p1[0], p2[0]) : Math.max(p1[1], p2[1]); if (Math.min(hi, a1) - Math.max(lo, a0) < L * 0.5) continue; var d = Math.abs(ec - c); if (d < bd) { bd = d; best = ec; } } });
      if (best == null) return; var sd = (dr.cx != null ? ((hor ? dr.cy : dr.cx) >= c ? 1 : -1) : 1);
      var X1 = hor ? a0 + ox : best + ox, Y1 = hor ? best + oy : a0 + oy, X2 = hor ? a1 + ox : best + ox, Y2 = hor ? best + oy : a1 + oy, TX = hor ? X1 : X1 + sd * L, TY = hor ? Y1 + sd * L : Y1;
      var sweep = ((TX - X1) * (Y2 - Y1) - (TY - Y1) * (X2 - X1)) > 0 ? 1 : 0;
      h.push('<line x1="' + X1.toFixed(1) + '" y1="' + Y1.toFixed(1) + '" x2="' + X2.toFixed(1) + '" y2="' + Y2.toFixed(1) + '" stroke="' + PAPER + '" stroke-width="' + (TW * 1.5).toFixed(2) + '"/>');
      h.push('<line x1="' + X1.toFixed(1) + '" y1="' + Y1.toFixed(1) + '" x2="' + TX.toFixed(1) + '" y2="' + TY.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (TW * 0.42).toFixed(2) + '"/>');
      h.push('<path d="M' + TX.toFixed(1) + ' ' + TY.toFixed(1) + 'A' + L.toFixed(1) + ' ' + L.toFixed(1) + ' 0 0 ' + sweep + ' ' + X2.toFixed(1) + ' ' + Y2.toFixed(1) + '" fill="none" stroke="' + INK + '" stroke-width="' + (TW * 0.18).toFixed(2) + '"/>'); });
    // 이름표
    // 이름표(2026-11-12 대표 지적 「글자 겹침」): 한 크기로 통일하되, 칸에 안 들어가면 치수 → 면적 줄을 빼고, 그래도 넘치면 그 칸만 줄인다. 이미 놓인 이름표와 겹치면 위·아래로 비켜 놓는다
    var tw = function (t, f) { var w = 0; for (var c = 0; c < t.length; c++) w += /[가-힣㎡]/.test(t[c]) ? f * 0.98 : (t[c] === ' ' ? f * 0.3 : f * 0.58); return w; };
    var placed = [], hit = function (b) { return placed.some(function (q) { return b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]; }); };
    var order = rooms.map(function (o, k) { return k; }).sort(function (a, b) { return (Number(rooms[b].m.area) || 0) - (Number(rooms[a].m.area) || 0); });
    if (!opt.noLabels) order.forEach(function (k) { var o = rooms[k], m = o.m, L = labelAt(o.p), f1 = fs * 0.9, cx = L.x + ox, cy = L.y + oy;
      var lines = [[m.name, f1, 700, INK]]; if (m.area && m.kind !== '피트') lines.push([m.area + '㎡', f1 * 0.8, 500, SUBT]); if (m.w && m.d && !/^(발코니|피트|실외기실)$/.test(m.kind)) lines.push([m.w + ' × ' + m.d + ' m', f1 * 0.66, 400, SUBT]);
      var aw = Math.max(L.room * 2, Math.min(L.w, L.h) * 0.6) * 0.95, ah = Math.max(L.room * 2, L.h * 0.5) * 0.95;
      var size = function () { return [Math.max.apply(null, lines.map(function (l) { return tw(l[0], l[1]); })), lines.reduce(function (s0, l) { return s0 + l[1] * 1.28; }, 0)]; };
      while (lines.length > 1 && (size()[0] > aw || size()[1] > ah)) lines.pop();
      var sz = size(), sc = Math.max(0.5, Math.min(1, aw / sz[0], ah / sz[1])); if (sc < 1) { lines.forEach(function (l) { l[1] *= sc; }); sz = size(); }
      var box = function (y0) { return [cx - sz[0] / 2, y0 - sz[1] / 2, cx + sz[0] / 2, y0 + sz[1] / 2]; }, yy = cy;
      if (hit(box(yy))) { var tries = [1, -1, 2, -2], ok = false; for (var t = 0; t < tries.length && !ok; t++) { var y2 = cy + tries[t] * sz[1] * 0.75; if (!hit(box(y2))) { yy = y2; ok = true; } }
        if (!ok) { lines = lines.slice(0, 1); sz = size(); if (hit(box(yy))) { for (var t2 = 0; t2 < tries.length; t2++) { var y3 = cy + tries[t2] * sz[1] * 1.1; if (!hit(box(y3))) { yy = y3; break; } } } } }
      placed.push(box(yy)); var y = yy - sz[1] / 2;
      lines.forEach(function (l) { y += l[1] * 1.05; h.push('<text x="' + cx.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-size="' + l[1].toFixed(1) + '" font-weight="' + l[2] + '" fill="' + l[3] + '">' + esc(l[0]) + '</text>'); y += l[1] * 0.23; }); });
    (r.창 || []).forEach(function (wn) { if (!wn._at || opt.noWinText) return; var t = wn.종류 + (wn.w_m ? ' ' + wn.w_m + 'm' : ''), f0 = fs * 0.5, x = wn._at[0], y = wn._at[1];
      if (wn._at[2]) h.push('<text x="' + x.toFixed(1) + '" y="' + (y + f0 * 0.34).toFixed(1) + '" text-anchor="middle" font-size="' + f0.toFixed(1) + '" font-weight="600" fill="' + ACC + '" stroke="' + PAPER + '" stroke-width="' + (f0 * 0.5).toFixed(1) + '" paint-order="stroke">' + esc(t) + '</text>');
      else h.push('<text transform="translate(' + (x + f0 * 0.34).toFixed(1) + ' ' + y.toFixed(1) + ') rotate(-90)" text-anchor="middle" font-size="' + f0.toFixed(1) + '" font-weight="600" fill="' + ACC + '" stroke="' + PAPER + '" stroke-width="' + (f0 * 0.5).toFixed(1) + '" paint-order="stroke">' + esc(t) + '</text>'); });
    if (bare) { if (!opt.noMark) h.push('<rect width="100%" height="100%" fill="url(#' + id + 'w)" pointer-events="none"/>'); h.push('</svg>'); return h.join(''); }
    // 2026-11-10 치수선: 축척을 알면 네 변의 구간 치수와 전체 치수를 기본으로 그린다 (대표 지시 「치수선 모두 추론하여 기본으로」). 끄려면 opt.noDims
    if (mm && !opt.noDims) (function () {
      var tol = D * 0.014, band = D * 0.05, off1 = D * 0.034, off2 = D * 0.066, tk = D * 0.008, f0 = fs * 0.58, sw = (D / 800).toFixed(2), minSeg = 300 / mm;
      var fmt = function (px) { var v = Math.round(px * mm / 10) * 10; return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
      var uniq = function (arr, lo, hi) { arr = arr.concat([lo, hi]).filter(function (v) { return v >= lo - tol && v <= hi + tol; }).sort(function (x, y) { return x - y; }); var out = []; arr.forEach(function (v) { if (!out.length || v - out[out.length - 1] > tol) out.push(v); else out[out.length - 1] = (out[out.length - 1] + v) / 2; }); out[0] = lo; out[out.length - 1] = hi;
        var o2 = [out[0]]; for (var i = 1; i < out.length; i++) { if (out[i] - o2[o2.length - 1] >= minSeg || i === out.length - 1) o2.push(out[i]); } if (o2.length > 2 && o2[o2.length - 1] - o2[o2.length - 2] < minSeg) o2.splice(o2.length - 2, 1); return o2; };
      var box = rooms.map(function (o) { var xs2 = o.p.map(function (q) { return q[0]; }), ys2 = o.p.map(function (q) { return q[1]; }); return { x0: Math.min.apply(null, xs2), x1: Math.max.apply(null, xs2), y0: Math.min.apply(null, ys2), y1: Math.max.apply(null, ys2) }; });
      var hLine = function (xa, xb, y, up) { if (xb - xa < minSeg * 0.6) return; h.push('<line x1="' + (xa + ox).toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (xb + ox).toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + SUBT + '" stroke-width="' + sw + '"/>');
        [xa, xb].forEach(function (x) { h.push('<line x1="' + (x + ox).toFixed(1) + '" y1="' + (y - tk).toFixed(1) + '" x2="' + (x + ox).toFixed(1) + '" y2="' + (y + tk).toFixed(1) + '" stroke="' + SUBT + '" stroke-width="' + sw + '"/>'); });
        if (xb - xa > f0 * 2.6) h.push('<text x="' + ((xa + xb) / 2 + ox).toFixed(1) + '" y="' + (up ? y - f0 * 0.45 : y + f0 * 1.25).toFixed(1) + '" text-anchor="middle" font-size="' + f0.toFixed(1) + '" fill="' + SUBT + '">' + fmt(xb - xa) + '</text>'); };
      var vLine = function (ya, yb, x, left) { if (yb - ya < minSeg * 0.6) return; h.push('<line x1="' + x.toFixed(1) + '" y1="' + (ya + oy).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + (yb + oy).toFixed(1) + '" stroke="' + SUBT + '" stroke-width="' + sw + '"/>');
        [ya, yb].forEach(function (y) { h.push('<line x1="' + (x - tk).toFixed(1) + '" y1="' + (y + oy).toFixed(1) + '" x2="' + (x + tk).toFixed(1) + '" y2="' + (y + oy).toFixed(1) + '" stroke="' + SUBT + '" stroke-width="' + sw + '"/>'); });
        if (yb - ya > f0 * 2.6) { var tx2 = left ? x - f0 * 0.45 : x + f0 * 1.25, ty2 = (ya + yb) / 2 + oy; h.push('<text transform="translate(' + tx2.toFixed(1) + ' ' + ty2.toFixed(1) + ') rotate(-90)" text-anchor="middle" font-size="' + f0.toFixed(1) + '" fill="' + SUBT + '">' + fmt(yb - ya) + '</text>'); } };
      var chain = function (pts2, draw) { if (pts2.length < 3) return false; for (var i = 0; i < pts2.length - 1; i++) draw(pts2[i], pts2[i + 1]); return true; };
      var top = [], bot = [], lef = [], rig = []; box.forEach(function (b) { if (b.y0 <= ry0 + band) top.push(b.x0, b.x1); if (b.y1 >= ry1 - band) bot.push(b.x0, b.x1); if (b.x0 <= rx0 + band) lef.push(b.y0, b.y1); if (b.x1 >= rx1 - band) rig.push(b.y0, b.y1); });
      var yT = by0 + oy, yB = by1 + oy, xL = bx0 + ox, xR = bx1 + ox;
      // 2026-11-11 치수 기준은 벽 가운데: 외곽선(벽 바깥면)과 방 안쪽 면의 가운데를 끝점으로 쓴다 — 바깥면까지 재면 원본보다 4%쯤 크게 나왔다(8,850 → 9,170)
      var cx0 = (rx0 + bx0) / 2, cx1 = (rx1 + bx1) / 2, cy0 = (ry0 + by0) / 2, cy1 = (ry1 + by1) / 2;
      // 원본에 치수 줄이 적혀 있으면 그 숫자와 구간을 그대로 옮긴다(그 변은 어림 치수를 그리지 않는다)
      var read = { T: [], B: [], L: [], R: [] }, lab2 = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
      (r.치수줄 || []).forEach(function (row) { var d = row.d || []; if (!d.length) return; var span = (d[d.length - 1].c - d[0].c) * mm, want = 0; d.forEach(function (q, i) { want += (i === 0 || i === d.length - 1) ? q.n / 2 : q.n; }); if (d.length >= 2 && Math.abs(span - want) / want > 0.07) return;
        var b0 = d[0].c - d[0].n / 2 / mm, segs = []; d.forEach(function (q) { segs.push([b0, b0 + q.n / mm, q.n]); b0 += q.n / mm; });
        var lo = row.v ? (G && G.틀 ? Math.min(cy0, G.틀[1]) : cy0) : (G && G.틀 ? Math.min(cx0, G.틀[0]) : cx0), hi = row.v ? (G && G.틀 ? Math.max(cy1, G.틀[3]) : cy1) : (G && G.틀 ? Math.max(cx1, G.틀[2]) : cx1), len = hi - lo;   /* 공용부까지 그렸으면 원본 치수 줄도 건물 전체 기준 */ segs = segs.filter(function (g) { var a = Math.max(g[0], lo - len * 0.04), b = Math.min(g[1], hi + len * 0.04); return b - a >= (g[1] - g[0]) * 0.8; });   /* 2026-11-12: 계단·승강기 같은 공용부 칸은 빼고 전용 칸만 남긴다 */
        if (!segs.length || segs[0][0] < lo - len * 0.08 || segs[segs.length - 1][1] > hi + len * 0.08 || segs[0][0] > lo + len * 0.08 || segs[segs.length - 1][1] < hi - len * 0.08) return;   // 남은 칸이 집 범위와 안 맞으면(다른 그림의 숫자) 쓰지 않는다
        var side = row.v ? (row.o < (bx0 + bx1) / 2 ? 'L' : 'R') : (row.o < (by0 + by1) / 2 ? 'T' : 'B'); read[side].push({ o: row.o, segs: segs }); });
      var drawRead = function (side) { var rowsS = read[side]; if (!rowsS.length) return false; var near = side === 'T' || side === 'L' ? function (a, b) { return b.o - a.o; } : function (a, b) { return a.o - b.o; }; rowsS.sort(near);
        rowsS.slice(0, 3).forEach(function (row, i) { var off = off1 + (off2 - off1) * i; row.segs.forEach(function (sg) { var txt = lab2(sg[2]), keepFmt = fmt; fmt = function () { return txt; };
            if (side === 'T') hLine(sg[0], sg[1], yT - off, true); else if (side === 'B') hLine(sg[0], sg[1], yB + off, false); else if (side === 'L') vLine(sg[0], sg[1], xL - off, true); else vLine(sg[0], sg[1], xR + off, false); fmt = keepFmt; }); }); return true; };
      var rT = drawRead('T'), rB = drawRead('B'), rL = drawRead('L'), rR = drawRead('R');
      var hasT = !rT && chain(uniq(top, cx0, cx1), function (p1, p2) { hLine(p1, p2, yT - off1, true); });
      if (!rB) chain(uniq(bot, cx0, cx1), function (p1, p2) { hLine(p1, p2, yB + off1, false); });
      var hasL = !rL && chain(uniq(lef, cy0, cy1), function (p1, p2) { vLine(p1, p2, xL - off1, true); });
      if (!rR) chain(uniq(rig, cy0, cy1), function (p1, p2) { vLine(p1, p2, xR + off1, false); });
      if (!rT && !rB) hLine(cx0, cx1, yT - (hasT ? off2 : off1), true); if (!rL && !rR) vLine(cy0, cy1, xL - (hasL ? off2 : off1), true);   // 전체 가로·세로(원본 치수 줄이 없을 때만 어림)
    })();
    var m0b = 0;
    // 비침 무늬(재가공 표시)
    if (!opt.plain) h.push('<rect x="' + m0.toFixed(1) + '" y="' + (m0 + head * 0.82).toFixed(1) + '" width="' + (VW - m0 * 2).toFixed(1) + '" height="' + (VH - m0 * 2 - head * 0.82 - foot * 0.62).toFixed(1) + '" fill="url(#' + id + 'w)" pointer-events="none"/>');
    // 발: 축척 막대 + 안내
    var fy = VH - m0 - foot * 0.62; h.push('<line x1="' + m0.toFixed(1) + '" y1="' + fy.toFixed(1) + '" x2="' + (VW - m0).toFixed(1) + '" y2="' + fy.toFixed(1) + '" stroke="' + INK + '" stroke-width="' + (D / 500).toFixed(2) + '"/>');
    var gx = m0 + D * 0.035, gy = fy + foot * 0.3;
    if (mm) { var one = 1000 / mm, nSeg = one * 3 < bw * 0.5 ? 3 : 1; for (var i = 0; i < nSeg; i++) h.push('<rect x="' + (gx + one * i).toFixed(1) + '" y="' + (gy - D * 0.006).toFixed(1) + '" width="' + one.toFixed(1) + '" height="' + (D * 0.012).toFixed(1) + '" fill="' + (i % 2 ? PAPER : INK) + '" stroke="' + INK + '" stroke-width="' + (D / 700).toFixed(2) + '"/>');
      h.push('<text x="' + gx.toFixed(1) + '" y="' + (gy + fs * 1.15).toFixed(1) + '" font-size="' + (fs * 0.68).toFixed(1) + '" fill="' + SUBT + '">0</text><text x="' + (gx + one * nSeg).toFixed(1) + '" y="' + (gy + fs * 1.15).toFixed(1) + '" text-anchor="middle" font-size="' + (fs * 0.68).toFixed(1) + '" fill="' + SUBT + '">' + nSeg + ' m</text>'); }
    var by = r.척도 && r.척도.방식 && r.척도.방식 !== '없음' ? '크기 기준: ' + (r.척도.방식 === '치수' ? '도면 치수선' : r.척도.방식 === '방 면적' ? '도면에 적힌 방 면적' : r.척도.방식 === '캐드 파일' ? '캐드 파일 실제 치수' : r.척도.방식 === '직접 그림' ? '고객이 고른 집 모양·전용면적(어림)' : '전용면적') : '';
    h.push('<text x="' + (VW - m0 - D * 0.035).toFixed(1) + '" y="' + (gy + fs * 0.1).toFixed(1) + '" text-anchor="end" font-size="' + (fs * 0.7).toFixed(1) + '" fill="' + INK + '">' + esc(opt.note || '원본 평면도를 집지니가 읽어 다시 그린 참고용 도면입니다.') + '</text>');
    h.push('<text x="' + (VW - m0 - D * 0.035).toFixed(1) + '" y="' + (gy + fs * 1.15).toFixed(1) + '" text-anchor="end" font-size="' + (fs * 0.64).toFixed(1) + '" fill="' + SUBT + '">' + esc((by ? by + '  ·  ' : '') + (mm && !opt.noDims ? '치수 단위 mm · ' : '') + '문·창 위치와 정확한 치수는 현장 실측으로 확정합니다.') + '</text>');
    h.push('</svg>'); return h.join('');
  }
  function png(r, opt, width) {
    return new Promise(function (ok, no) { var s = svg(r, opt); if (!s) return no(new Error('그릴 내용이 없습니다.')); var m = /viewBox="0 0 (\d+) (\d+)"/.exec(s), W = width || 1800, H = Math.round(W * Number(m[2]) / Number(m[1]));
      s = s.replace('<svg ', '<svg width="' + W + '" height="' + H + '" '); var img = new Image(); img.onload = function () { var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H); ok(c.toDataURL('image/png')); };
      img.onerror = function () { no(new Error('그림으로 바꾸지 못했습니다.')); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); });
  }
  root.JJPlanStyle = { svg: svg, png: png, version: '2026-11-10b' };
})(typeof window !== 'undefined' ? window : this);
