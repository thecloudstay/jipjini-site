/* 집지니 도면 자동 분석 (자동 생성 — 고치지 말 것. 원본: 콘솔 CoordiApp.html plAutoRoomsCore, tools/build_plan_auto.js)
   JJPlanAuto.analyzeFile(file, { areaM2 }) → Promise<결과>   /   JJPlanAuto.analyzeImage(img, { areaM2 })
   결과: { ok, why, dataUrl, W, H, mmpp, rooms:[{ name, kind(거실|방|욕실|발코니), area, perim, w, d, pts }], shapes, sum:{ 방, 욕실, 발코니, 전용합, 바닥, 벽, 천장, 걸레받이 } } */
(function (root) {
function plPxArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
function plAutoRoomsCore(d, w, h) {   // d: 화소 RGBA (Uint8ClampedArray)
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
  const r = Math.max(5, Math.round(Math.min(w, h) * 0.03));
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
function perimPx(pts) { var s = 0; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
function R1(v) { return Math.round(v * 10) / 10; } function R2(v) { return Math.round(v * 100) / 100; }
function ruleEngine(d, w, h) { return plAutoRoomsCore(d, w, h); }
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
  found.sort(function (a, b) { return b.px - a.px; }); var med = found[Math.floor(found.length / 2)].px;
  var nBal = 0, nBath = 0, nRoom = 0;
  found.forEach(function (f) {
    var xs = f.pts.map(function (p) { return p[0]; }), ys = f.pts.map(function (p) { return p[1]; }); f.bw = Math.max.apply(null, xs) - Math.min.apply(null, xs); f.bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    var strip = Math.max(f.bw, f.bh) / Math.max(1, Math.min(f.bw, f.bh)) >= 3.2;
    if (!f.kind) f.kind = strip ? '발코니' : (f.px < med * 0.35 ? '욕실' : (nRoom === 0 ? '거실' : '방'));
    if (f.kind === '발코니') f.name = '발코니' + (++nBal); else if (f.kind === '욕실') f.name = '욕실' + (++nBath);
    else { nRoom++; if (nRoom === 1) { f.kind = '거실'; f.name = '거실'; } else { f.kind = '방'; f.name = nRoom === 2 ? '안방' : '방' + (nRoom - 1); } }
  });
  var m2 = Number(opt.areaM2) || 0, innerPx = found.filter(function (f) { return f.kind !== '발코니'; }).reduce(function (s, f) { return s + f.px; }, 0);
  var mmpp = (m2 > 0 && innerPx > 0) ? Math.sqrt(m2 * 1e6 / innerPx) : 0;
  var rooms = found.map(function (f) {
    var o = { name: f.name, kind: f.kind, pts: f.pts, share: innerPx ? f.px / innerPx : 0 };
    if (mmpp) { o.area = R2(f.px * mmpp * mmpp / 1e6); o.perim = R2(perimPx(f.pts) * mmpp / 1000); var ar = Math.max(f.bw, 1) / Math.max(f.bh, 1); o.w = R1(Math.sqrt(o.area * ar)); o.d = o.w ? R1(o.area / o.w) : 0; }
    return o; });
  var shapes = rooms.map(function (r) { return { t: 'room', c: '#2f6b4f', name: r.name, pts: r.pts, auto: true }; });
  if (mmpp) { var L = Math.round(1000 / mmpp); shapes.push({ t: 'scale', c: '#1d5fd0', x1: Math.round(W * 0.05), y1: Math.round(H * 0.965), x2: Math.round(W * 0.05) + L, y2: Math.round(H * 0.965), mm: 1000, by: '면적' }); }
  var sum = { 방: rooms.filter(function (r) { return r.kind === '방'; }).length, 욕실: nBath, 발코니: nBal };
  if (mmpp) { var liv = rooms.filter(function (r) { return r.kind === '거실' || r.kind === '방'; });
    sum.전용합 = R1(rooms.filter(function (r) { return r.kind !== '발코니'; }).reduce(function (s, r) { return s + r.area; }, 0));
    sum.바닥 = R1(liv.reduce(function (s, r) { return s + r.area; }, 0)); sum.천장 = sum.바닥;
    sum.벽 = R1(liv.reduce(function (s, r) { return s + r.perim * 2.4; }, 0)); sum.걸레받이 = R1(liv.reduce(function (s, r) { return s + r.perim; }, 0)); }
  return { ok: true, dataUrl: dataUrl, W: W, H: H, mmpp: mmpp, rooms: rooms, shapes: shapes, sum: sum, engine: JJ.engine ? '학습' : '규칙' };
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
  (r.rooms || []).forEach(function (m) { var cx = 0, cy = 0; m.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= m.pts.length; cy /= m.pts.length; var c = col[m.kind] || '#888';
    h.push('<polygon points="' + m.pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="' + c + '" fill-opacity="0.28" stroke="' + c + '" stroke-width="' + (fs / 6) + '"/>');
    h.push('<text x="' + cx + '" y="' + cy + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="#222" stroke="#fff" stroke-width="' + (fs / 5) + '" paint-order="stroke">' + m.name + (m.area ? ' ' + m.area + '㎡' : '') + '</text>'); });
  h.push('</svg>'); return h.join('');
}
var JJ = { analyzeFile: analyzeFile, analyzeImage: analyzeImage, overlaySvg: overlaySvg, engine: null, version: '2026-11-10' };
root.JJPlanAuto = JJ;
})(typeof window !== 'undefined' ? window : this);
