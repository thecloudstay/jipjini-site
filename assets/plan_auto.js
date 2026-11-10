/* 집지니 도면 자동 분석 (자동 생성 — 고치지 말 것. 원본: 콘솔 CoordiApp.html plAutoRoomsCore, tools/build_plan_auto.js)
   JJPlanAuto.analyzeFile(file, { areaM2 }) → Promise<결과>   /   JJPlanAuto.analyzeImage(img, { areaM2 })
   결과: { ok, why, dataUrl, W, H, mmpp, rooms:[{ name, kind(거실|방|욕실|발코니), area, perim, w, d, pts }], shapes, sum:{ 방, 욕실, 발코니, 전용합, 바닥, 벽, 천장, 걸레받이 } } */
(function (root) {
function plPxArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
function plAutoRoomsCore(d, w, h, rf) {   // d: 화소 RGBA (Uint8ClampedArray), rf: 중심부 반지름 비율(기본 0.03 — 문이 열린 도면은 0.045·0.06 으로 다시)
  const N = w * h, gray = new Uint8Array(N), sat = new Uint8Array(N), hist = new Uint32Array(256);
  for (let i = 0; i < N; i++) { const r0 = d[i * 4], g0 = d[i * 4 + 1], b0 = d[i * 4 + 2], v = (r0 * 299 + g0 * 587 + b0 * 114) / 1000 | 0, mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0); gray[i] = v; hist[v]++; sat[i] = mx ? ((mx - mn) * 255 / mx) | 0 : 0; }
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sb = 0, wb = 0, best = 0, T = 128; for (let t = 0; t < 256; t++) { wb += hist[t]; if (!wb) continue; const wf = N - wb; if (!wf) break; sb += t * hist[t]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) * (mb - mf); if (v > best) { best = v; T = t; } }
  // 문턱 두 단계 — 검은 벽(Tlow: 검정 봉우리 뒤 골짜기) / 무채색 어두운 가는 선(Tmid: 창·문 기호, 글자). 색 있는 바닥(목재·타일)은 벽이 아니다
  let darkN = 0; for (let v = 0; v < 48; v++) darkN += hist[v];
  const Tmid = Math.min(T, 150); let Tlow = Tmid;
  if (darkN / N >= 0.01) { let bt = 48, bv = Infinity; for (let t = 36; t <= Math.min(Tmid, 140); t++) { let v = 0; for (let k = t - 4; k <= t + 4; k++) v += hist[k] || 0; if (v < bv) { bv = v; bt = t; } } Tlow = bt; }
  T = Tmid;
  const cand = new Uint8Array(N); for (let i = 0; i < N; i++) cand[i] = gray[i] < Tlow ? 1 : (gray[i] < Tmid && sat[i] < 60 ? 1 : 0);
  // 후보 중 두꺼운 회색 덩어리(음영·회색 바닥)는 벽이 아님: 비후보까지 거리 > 4 인 핵 → 4px 안쪽은 제외 (진짜 검은 벽은 유지)
  const dIn = new Int32Array(N).fill(-1); { let q = new Int32Array(N), a = 0, b = 0; for (let i = 0; i < N; i++) if (!cand[i]) { dIn[i] = 0; q[b++] = i; } while (a < b) { const i = q[a++], x = i % w, y = (i / w) | 0; if (dIn[i] >= 5) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (dIn[j] < 0) { dIn[j] = dIn[i] + 1; q[b++] = j; } } } }
  const wall0 = new Uint8Array(N); for (let i = 0; i < N; i++) wall0[i] = cand[i] && (gray[i] < Tlow || (dIn[i] >= 0 && dIn[i] <= 4)) ? 1 : 0;
  const wall = new Uint8Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && wall0[yy * w + xx]) { v = 1; break; } } wall[y * w + x] = v; }
  // 벽까지 거리 (8방향 너비 우선)
  const dist = new Int32Array(N).fill(-1); let qx = new Int32Array(N), qh = 0, qt = 0; for (let i = 0; i < N; i++) if (wall[i]) { dist[i] = 0; qx[qt++] = i; }
  while (qh < qt) { const i = qx[qh++], x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; if (dist[j] < 0) { dist[j] = dist[i] + 1; qx[qt++] = j; } } }
  const r = Math.max(5, Math.round(Math.min(w, h) * (rf || 0.03)));
  // 중심부 라벨
  const lab = new Int32Array(N).fill(0); let nl = 0; const sizes = [], border = [];
  for (let i = 0; i < N; i++) { if (lab[i] || dist[i] <= r) continue; nl++; let size = 0, touch = false; qh = 0; qt = 0; qx[qt++] = i; lab[i] = nl;
    while (qh < qt) { const k = qx[qh++], x = k % w, y = (k / w) | 0; size++; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch = true; const nb = [k - 1, k + 1, k - w, k + w]; for (const j of nb) { if (j < 0 || j >= N) continue; if (Math.abs((j % w) - x) > 1) continue; if (!lab[j] && dist[j] > r) { lab[j] = nl; qx[qt++] = j; } } }
    sizes[nl] = size; border[nl] = touch; }
  const minSize = N * 0.004, ok = new Uint8Array(nl + 1); let okN = 0; for (let L = 1; L <= nl; L++) if (!border[L] && sizes[L] >= minSize && sizes[L] < N * 0.6) { ok[L] = 1; okN++; }
  if (!okN) return { found: [], why: '벽이 또렷한 평면도(흑백 선 도면)에서 잘 됩니다' };
  // 자유 공간 전체를 가까운 라벨로 채우기
  // 중심부에서 r−2 만큼만 되돌려 키운다 (문 틈·치수선 사이 가는 공간은 안 들어가게)
  const fill = new Int32Array(N).fill(0), dep = new Int32Array(N).fill(0), maxDep = Math.max(2, r - 2); qh = 0; qt = 0; for (let i = 0; i < N; i++) if (lab[i] && ok[lab[i]]) { fill[i] = lab[i]; qx[qt++] = i; }
  while (qh < qt) { const i = qx[qh++], x = i % w, y = (i / w) | 0; if (dep[i] >= maxDep) continue; const nb = [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]; for (const j of nb) { if (j < 0 || j >= N || Math.abs((j % w) - x) > 1) continue; if (!fill[j] && !wall[j]) { fill[j] = fill[i]; dep[j] = dep[i] + 1; qx[qt++] = j; } } }
  // 라벨별 외곽선 → 단순화 → 직각 정리
  const found = [];
  for (let L = 1; L <= nl; L++) { if (!ok[L]) continue; let s0 = -1; for (let i = 0; i < N; i++) if (fill[i] === L) { s0 = i; break; } if (s0 < 0) continue;
    const isIn = (x, y) => x >= 0 && y >= 0 && x < w && y < h && fill[y * w + x] === L;
    const DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let cx = s0 % w, cy = (s0 / w) | 0, dir = 0; const pts = [[cx, cy]]; let guard = 0;
    while (guard++ < 20000) { let foundN = false; for (let k = 0; k < 8; k++) { const nd = (dir + 6 + k) % 8, nx = cx + DIR[nd][0], ny = cy + DIR[nd][1]; if (isIn(nx, ny)) { cx = nx; cy = ny; dir = nd; foundN = true; break; } } if (!foundN) break; if (cx === pts[0][0] && cy === pts[0][1]) break; pts.push([cx, cy]); }
    if (pts.length < 8) continue;
    const dp = (p, eps) => { if (p.length < 3) return p; const a = p[0], b = p[p.length - 1]; let mi = 0, md = 0; for (let i = 1; i < p.length - 1; i++) { const dd = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); if (dd > md) { md = dd; mi = i; } } if (md > eps) { const l = dp(p.slice(0, mi + 1), eps), rr = dp(p.slice(mi), eps); return l.slice(0, -1).concat(rr); } return [a, b]; };
    let fi = 0, fd = 0; pts.forEach((q, i) => { const dd = Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]); if (dd > fd) { fd = dd; fi = i; } });   // 닫힌 선은 가장 먼 점에서 둘로 나눠 단순화
    const eps = Math.max(2, r * 0.25), h1 = dp(pts.slice(0, fi + 1), eps), h2 = dp(pts.slice(fi).concat([pts[0]]), eps); let poly = h1.slice(0, -1).concat(h2.slice(0, -1));
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]); if (dx < dy * 0.22) b[0] = a[0]; else if (dy < dx * 0.22) b[1] = a[1]; }
    const px = plPxArea(poly); if (px < minSize) continue;
    found.push({ pts: poly, px });
  }
  return { found };
}
// 새 분석 도구(jipjini.com/assets: 글자 인식으로 방 이름 확정·글자 지운 뒤 방 나누기·치수 읽기) 불러오기
function perimPx(pts) { var s = 0; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
function R1(v) { return Math.round(v * 10) / 10; } function R2(v) { return Math.round(v * 100) / 100; }
// 문이 열린 채 그려진 도면(부동산 앱·분양 안내문)은 방이 합쳐지므로 중심부 반지름을 키워 가며 다시 나눠 보고, 공간이 가장 많이 나뉜 결과를 쓴다
function inPolyA(x, y, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function centA(p) { var x = 0, y = 0; p.forEach(function (q) { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
// 큰 반지름(0.06)은 열린 문에서 방을 끊어 주지만 작은 방(욕실·발코니)을 놓치고, 작은 반지름(0.03)은 그 반대다.
// → 큰 반지름 결과를 뼈대로 삼고, 더 작은 반지름에서만 잡힌 공간(기존 공간과 겹치지 않는 것)을 보탠다.
// 문 틈 메우기: 같은 줄에 놓인 벽 두 토막 사이의 짧은 틈(문 폭 이하)을 벽으로 이어, 문이 열린 채 그려진 도면에서 방이 합쳐지는 것을 막는다.
//   조건: 틈 길이 ≤ 짧은 변의 10% · 양쪽이 모두 벽 · 둘 중 긴 토막이 틈의 0.8배 이상(벽을 따라가는 줄일 때만 — 방 안을 가로지르는 줄은 벽 두께 토막뿐이라 해당 없음)
function closeDoors(d, w, h) {
  var N = w * h, dark = new Uint8Array(N), out = new Uint8ClampedArray(d), G = Math.max(6, Math.round(Math.min(w, h) * 0.10)), minLong = Math.max(8, Math.round(Math.min(w, h) * 0.03)), n = 0;
  for (var i = 0; i < N; i++) dark[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 < 110 ? 1 : 0;
  function scan(len, cnt, at) {   // at(줄, 칸) → 화소 번호
    for (var a = 0; a < cnt; a++) { var runs = [], st = -1;
      for (var b = 0; b <= len; b++) { var on = b < len && dark[at(a, b)]; if (on && st < 0) st = b; else if (!on && st >= 0) { runs.push([st, b - 1]); st = -1; } }
      for (var r = 0; r + 1 < runs.length; r++) { var gap = runs[r + 1][0] - runs[r][1] - 1, l1 = runs[r][1] - runs[r][0] + 1, l2 = runs[r + 1][1] - runs[r + 1][0] + 1;
        if (gap >= 3 && gap <= G && Math.max(l1, l2) >= Math.max(minLong, gap * 0.8) && Math.min(l1, l2) >= 2) { for (var g = runs[r][1] + 1; g < runs[r + 1][0]; g++) { var q = at(a, g) * 4; out[q] = out[q + 1] = out[q + 2] = 0; out[q + 3] = 255; } n++; } } }
  }
  scan(w, h, function (y, x) { return y * w + x; }); scan(h, w, function (x, y) { return y * w + x; });
  return { data: out, bridged: n };
}
function ruleEngine(d, w, h) {
  var acc = [], why = ''; try { d = closeDoors(d, w, h).data; } catch (e) {}
  [0.045, 0.03, 0.02].forEach(function (rf) {
    var r; try { r = plAutoRoomsCore(d, w, h, rf); } catch (e) { r = { found: [] }; } if (r.why) why = r.why;
    (r.found || []).forEach(function (f) { if (!f.pts || f.pts.length < 3) return; var c = centA(f.pts);
      var clash = acc.some(function (a) { return inPolyA(c[0], c[1], a.pts) || inPolyA(a.c[0], a.c[1], f.pts); });
      if (!clash) acc.push({ pts: f.pts, px: f.px, c: c }); });
  });
  if (acc.length > 18) acc = acc.sort(function (a, b) { return b.px - a.px; }).slice(0, 18);
  return { found: acc, why: why };
}
var TYP = {"1-1":{"n":113,"침실":[[0.2744,1.25,4.15]],"욕실":[[0.0765,1.45,4.25]],"거실":[0.3115,1.45,4.45],"주방":[0.153,1.51,4.35],"현관":[0.0453,1.22,4.13],"드레스룸":0.0,"기타":0.0678,"발코니":[0.0,0.56]},"1-2":{"n":21,"침실":[[0.2461,1.34,4.13]],"욕실":[[0.0685,1.25,4.09],[0.0283,1.39,4.08]],"거실":[0.2799,1.7,4.86],"주방":[0.1446,1.33,4.19],"현관":[0.0466,1.54,4.28],"드레스룸":0.0,"기타":0.0511,"발코니":[0.0,0.33]},"2-1":{"n":129,"침실":[[0.2128,1.16,4.11],[0.1523,1.18,4.13]],"욕실":[[0.0627,1.46,4.12]],"거실":[0.2896,1.38,4.99],"주방":[0.1431,1.49,4.25],"현관":[0.0391,1.21,4.07],"드레스룸":0.0,"기타":0.0536,"발코니":[0.0778,0.96]},"2-2":{"n":61,"침실":[[0.1956,1.24,4.11],[0.137,1.15,4.2]],"욕실":[[0.0468,1.39,4.07],[0.0335,1.38,4.07]],"거실":[0.3026,1.64,5.26],"주방":[0.1382,1.29,4.17],"현관":[0.0394,1.31,4.08],"드레스룸":0.0242,"기타":0.0678,"발코니":[0.0,1.2]},"3-1":{"n":55,"침실":[[0.2114,1.06,4.01],[0.1393,1.15,4.02],[0.114,1.23,4.03]],"욕실":[[0.0615,1.36,4.07]],"거실":[0.2951,1.5,5.04],"주방":[0.0974,1.32,4.13],"현관":[0.0305,1.15,4.02],"드레스룸":0.0,"기타":0.029,"발코니":[0.1352,1.18]},"3-2":{"n":777,"침실":[[0.1549,1.12,4.08],[0.1067,1.19,4.13],[0.0934,1.19,4.09]],"욕실":[[0.042,1.42,4.07],[0.0347,1.41,4.1]],"거실":[0.28,1.81,5.56],"주방":[0.134,1.26,4.23],"현관":[0.0388,1.19,4.12],"드레스룸":0.0359,"기타":0.0687,"발코니":[0.1354,2.37]},"3-3":{"n":84,"침실":[[0.148,1.14,4.02],[0.096,1.21,4.03],[0.0868,1.29,4.04]],"욕실":[[0.0385,1.42,4.06],[0.0225,1.2,4.02],[0.0097,1.27,4.03]],"거실":[0.2728,1.98,5.53],"주방":[0.1285,1.28,4.22],"현관":[0.0368,1.15,4.07],"드레스룸":0.0395,"기타":0.0907,"발코니":[0.0758,2.13]},"4-2":{"n":174,"침실":[[0.1391,1.08,4.06],[0.0938,1.22,4.15],[0.084,1.2,4.04],[0.074,1.22,4.06]],"욕실":[[0.0337,1.46,4.1],[0.028,1.44,4.08]],"거실":[0.2646,1.79,5.69],"주방":[0.1302,1.2,4.22],"현관":[0.0382,1.24,4.23],"드레스룸":0.0456,"기타":0.0538,"발코니":[0.0873,2.57]},"4-3":{"n":43,"침실":[[0.1312,1.21,4.14],[0.0862,1.3,4.05],[0.0764,1.25,4.03],[0.0618,1.25,4.03]],"욕실":[[0.0341,1.38,4.1],[0.0208,1.2,4.05],[0.0123,1.28,4.06]],"거실":[0.2709,2.0,6.28],"주방":[0.1248,1.24,4.23],"현관":[0.0366,1.32,4.16],"드레스룸":0.0463,"기타":0.0579,"발코니":[0.0552,2.21]}};
/** 방·욕실 수와 전용면적만으로 「보통 구성」 어림 (실제 평면 라벨 통계 — 인공지능 허브 「건축 도면 데이터」). 결과 모양은 analyze 와 같다 */
function typical(b, t, m2) {
  b = Math.max(1, Math.min(5, Number(b) || 3)); t = Math.max(1, Math.min(3, Number(t) || 1)); m2 = Number(m2) || 0;
  var e = TYP[b + '-' + t] || TYP[b + '-2'] || TYP[b + '-1'] || TYP['3-2']; if (!e || !m2) return { ok: false, why: '전용면적이 필요합니다.' };
  // 자가 학습 조정값(대표가 확인한 정답 도면의 중앙값)을 표본 수에 비례해 섞는다 — 정답 n 장이면 비중 n/(n+30)
  var tu = JJ.tuning && JJ.tuning.typical && JJ.tuning.typical[b + '-' + t];
  if (tu && tu.n >= 5) { var wt = tu.n / (tu.n + 30), mix = function (base, v) { return v > 0 ? base * (1 - wt) + v * wt : base; }; e = JSON.parse(JSON.stringify(e));
    e.침실.forEach(function (q, i) { q[0] = mix(q[0], (tu.침실 || [])[i]); }); e.욕실.forEach(function (q, i) { q[0] = mix(q[0], (tu.욕실 || [])[i]); });
    e.거실[0] = mix(e.거실[0], tu.거실); e.주방[0] = mix(e.주방[0], tu.주방); e.현관[0] = mix(e.현관[0], tu.현관); e.n = e.n + tu.n; }
  var rooms = [], add = function (name, kind, q) { if (!q || !(q[0] > 0)) return; var area = R2(q[0] * m2), w = R1(Math.sqrt(area * (q[1] || 1.3))); rooms.push({ name: name, kind: kind, area: area, perim: R2((q[2] || 4.2) * Math.sqrt(area)), w: w, d: w ? R1(area / w) : 0 }); };
  add('거실', '거실', e.거실); add('주방', '주방', e.주방);
  for (var i = 0; i < b; i++) add(i === 0 ? '안방' : '작은방' + i, '방', e.침실[Math.min(i, e.침실.length - 1)]);
  for (var j = 0; j < t; j++) add(t === 1 ? '욕실' : (j === 0 ? '공용욕실' : j === 1 ? '안방욕실' : '욕실' + (j + 1)), '욕실', e.욕실[Math.min(j, e.욕실.length - 1)]);
  add('현관', '현관', e.현관); if (e.발코니 && e.발코니[0] > 0) add('발코니1', '발코니', [e.발코니[0], 4, 5.4]);
  var liv = rooms.filter(function (r) { return /거실|방|주방/.test(r.kind); }), sum = { 방: b, 욕실: t, 발코니: rooms.filter(function (r) { return r.kind === '발코니'; }).length };
  sum.바닥 = R1(liv.reduce(function (s, r) { return s + r.area; }, 0)); sum.천장 = sum.바닥; sum.벽 = R1(liv.reduce(function (s, r) { return s + r.perim * 2.4; }, 0)); sum.걸레받이 = R1(liv.reduce(function (s, r) { return s + r.perim; }, 0));
  return { ok: true, mmpp: 1, rooms: rooms, sum: sum, shapes: [], engine: '보통 구성', 표본: e.n };
}
function analyzeImage(img, opt) {
  opt = opt || {}; var NW = img.naturalWidth || img.width, NH = img.naturalHeight || img.height;
  if (!NW || !NH) return { ok: false, why: '그림을 읽지 못했습니다.' };
  // 보관·표시용 그림: 긴 변 1600 이하 JPEG
  var K = Math.min(1, 1600 / Math.max(NW, NH)), W = Math.round(NW * K), H = Math.round(NH * K);
  var keep = document.createElement('canvas'); keep.width = W; keep.height = H; var kg = keep.getContext('2d'); kg.fillStyle = '#fff'; kg.fillRect(0, 0, W, H); kg.drawImage(img, 0, 0, W, H);
  var dataUrl = keep.toDataURL('image/jpeg', 0.86);
  // 분석용: 긴 변 560
  var S = Math.min(1, 560 / Math.max(W, H)), w = Math.max(16, Math.round(W * S)), h = Math.max(16, Math.round(H * S));
  var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(keep, 0, 0, w, h);
  var res = (JJ.engine || ruleEngine)(g.getImageData(0, 0, w, h).data, w, h);
  var found = (res.found || []).map(function (f) { return { pts: f.pts.map(function (p) { return [Math.round(p[0] / S), Math.round(p[1] / S)]; }), px: f.px / (S * S), kind: f.kind || '' }; });
  if (!found.length) return { ok: false, why: '방 영역을 찾지 못했습니다' + (res.why ? ' — ' + res.why : '') + '. 벽선이 또렷한 평면도 그림을 넣어 주세요.', dataUrl: dataUrl, W: W, H: H };
  return finalize(found, W, H, dataUrl, opt.areaM2, JJ.engine ? '학습' : '규칙');
}
/** 찾은 공간 목록(found: [{ pts, px, kind? }])에 이름을 붙이고 전용면적으로 척도·면적·치수·합계를 낸다.
 *  kind 가 미리 정해진 공간(글자 인식·학습 모델)은 그대로 두고, 없는 것만 모양·크기로 추정한다. mmppFix 를 주면 그 척도를 쓴다(치수 숫자로 구한 값). */
function finalize(found, W, H, dataUrl, areaM2, engineName, mmppFix) {
  found = found.slice().sort(function (a, b) { return b.px - a.px; }); var med = found[Math.floor(found.length / 2)].px;
  var cnt = {}, hasLiving = found.some(function (f) { return f.kind === '거실'; }), firstRoom = true;
  found.forEach(function (f) {
    var xs = f.pts.map(function (p) { return p[0]; }), ys = f.pts.map(function (p) { return p[1]; }); f.bw = Math.max.apply(null, xs) - Math.min.apply(null, xs); f.bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    if (!f.kind) { var strip = Math.max(f.bw, f.bh) / Math.max(1, Math.min(f.bw, f.bh)) >= 3.2;
      if (strip) f.kind = '발코니'; else if (f.px < med * 0.35) f.kind = '욕실'; else if (!hasLiving && firstRoom) { f.kind = '거실'; hasLiving = true; } else f.kind = '방';
      if (f.kind === '거실' || f.kind === '방') firstRoom = false; }
  });
  var used = {};
  found.forEach(function (f) { var k = f.kind; cnt[k] = (cnt[k] || 0) + (f.nm ? 0 : 1); var n = cnt[k];
    f.name = f.nm ? (used[f.nm] ? f.nm + (++used[f.nm]) : (used[f.nm] = 1, f.nm)) : k === '방' ? (n === 1 ? '안방' : '방' + n) : k === '거실' ? (n === 1 ? '거실' : '거실' + n) : (k === '욕실' || k === '발코니' || k === '기타') ? k + n : (n === 1 ? k : k + n); });
  var outer = function (f) { return f.kind === '발코니' || f.kind === '실외기실'; };
  var m2 = Number(areaM2) || 0, innerPx = found.filter(function (f) { return !outer(f); }).reduce(function (s, f) { return s + f.px; }, 0);
  var mmpp = Number(mmppFix) > 0 ? Number(mmppFix) : ((m2 > 0 && innerPx > 0) ? Math.sqrt(m2 * 1e6 / innerPx) : 0);
  var rooms = found.map(function (f) {
    var o = { name: f.name, kind: f.kind, nm: f.nm || '', pts: f.pts, px: f.px, share: innerPx ? f.px / innerPx : 0 };
    if (mmpp) { o.area = R2(f.px * mmpp * mmpp / 1e6); o.perim = R2(perimPx(f.pts) * mmpp / 1000); var ar = Math.max(f.bw, 1) / Math.max(f.bh, 1); o.w = R1(Math.sqrt(o.area * ar)); o.d = o.w ? R1(o.area / o.w) : 0; }
    return o; });
  var shapes = rooms.map(function (r) { return { t: 'room', c: '#2f6b4f', name: r.name, pts: r.pts, auto: true }; });
  if (mmpp) { var L = Math.round(1000 / mmpp); shapes.push({ t: 'scale', c: '#1d5fd0', x1: Math.round(W * 0.05), y1: Math.round(H * 0.965), x2: Math.round(W * 0.05) + L, y2: Math.round(H * 0.965), mm: 1000, by: mmppFix ? '치수' : '면적' }); }
  var sum = { 방: cnt['방'] || 0, 욕실: cnt['욕실'] || 0, 발코니: cnt['발코니'] || 0 };
  if (mmpp) { var liv = rooms.filter(function (r) { return /^(거실|방|주방|드레스룸|기타)$/.test(r.kind); });
    sum.전용합 = R1(rooms.filter(function (r) { return r.kind !== '발코니' && r.kind !== '실외기실'; }).reduce(function (s, r) { return s + r.area; }, 0));
    sum.바닥 = R1(liv.reduce(function (s, r) { return s + r.area; }, 0)); sum.천장 = sum.바닥;
    sum.벽 = R1(liv.reduce(function (s, r) { return s + r.perim * 2.4; }, 0)); sum.걸레받이 = R1(liv.reduce(function (s, r) { return s + r.perim; }, 0)); }
  return { ok: true, dataUrl: dataUrl, W: W, H: H, mmpp: mmpp, rooms: rooms, shapes: shapes, sum: sum, engine: engineName || '규칙' };
}
function analyzeFile(file, opt) {
  return new Promise(function (resolve) {
    if (!file || !/^image\//.test(file.type || '')) { resolve({ ok: false, why: '그림 파일(JPG·PNG)만 넣을 수 있습니다. PDF 는 화면을 캡처해서 넣어 주세요.' }); return; }
    if (file.size > 15 * 1024 * 1024) { resolve({ ok: false, why: '15MB 이하 그림만 넣을 수 있습니다.' }); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () { var r; try { r = analyzeImage(img, opt); } catch (e) { r = { ok: false, why: '분석 중 오류: ' + e.message }; } URL.revokeObjectURL(url); resolve(r); };
    img.onerror = function () { URL.revokeObjectURL(url); resolve({ ok: false, why: '그림을 열지 못했습니다.' }); };
    img.src = url;
  });
}
// 미리보기 그림(SVG 문자열): 도면 위에 찾은 공간을 색으로
function overlaySvg(r) {
  if (!r || !r.dataUrl) return ''; var col = { 거실: '#e9b949', 방: '#5b8def', 욕실: '#e06c75', 발코니: '#56b6a6' }, fs = Math.max(14, Math.round(Math.max(r.W, r.H) / 55));
  var h = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + r.W + ' ' + r.H + '" style="width:100%;height:auto;display:block;border-radius:6px;background:#fff"><image href="' + r.dataUrl + '" width="' + r.W + '" height="' + r.H + '"/>'];
  (r.rooms || []).forEach(function (m) { if (!m.pts || m.pts.length < 3) return; var cx = 0, cy = 0; m.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= m.pts.length; cy /= m.pts.length; var c = col[m.kind] || '#888';
    h.push('<polygon points="' + m.pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="' + c + '" fill-opacity="0.28" stroke="' + c + '" stroke-width="' + (fs / 6) + '"/>');
    h.push('<text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="#222" stroke="#fff" stroke-width="' + (fs / 5) + '" paint-order="stroke">' + m.name + (m.area ? ' ' + m.area + '㎡' : '') + '</text>'); });
  h.push('</svg>'); return h.join('');
}
var JJ = { analyzeFile: analyzeFile, analyzeImage: analyzeImage, overlaySvg: overlaySvg, typical: typical, finalize: finalize, engine: null, version: '2026-11-10c' };
// 조정값 받기: 하루 한 번, 실패해도 조용히 (기본 표로 동작)
(function () { try { var K = 'jj_plan_tune', now = Date.now(), c = null; try { c = JSON.parse(localStorage.getItem(K) || 'null'); } catch (_e) {}
  if (c && c.t && now - c.t < 86400000) { JJ.tuning = c.d; return; }
  if (typeof fetch !== 'function') return;
  fetch('https://script.google.com/macros/s/AKfycbzxm4mmZs1yVJPa3T-wb0cdJbEUMPYl6dDKtQNSNmJy4nEsCholrEnPAN8e0JfAtOV99A/exec?type=plan_tune', { redirect: 'follow' }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.typical) { JJ.tuning = d; try { localStorage.setItem(K, JSON.stringify({ t: now, d: d })); } catch (_s) {} } }).catch(function () {}); } catch (_x) {} })();
root.JJPlanAuto = JJ;
})(typeof window !== 'undefined' ? window : this);
