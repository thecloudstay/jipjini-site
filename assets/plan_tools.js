/* 집지니 도면 도구 (2026-11-10) — 도면 그림 한 장에서 적산 정보를 뽑는 전체 흐름
   JJPlanTools.analyze(file | canvas | img, { areaM2, onStep }) → Promise<결과>   (결과 모양은 JJPlanAuto 와 같고 아래가 덧붙는다)
     결과.글자 = { 개수, 방이름: n, 치수: [숫자…] }
     결과.척도 = { 방식: '면적' | '치수' | '없음', 면적기준, 치수기준, 차이, 안내 }
     결과.문 / 결과.창 = 학습 모델이 있을 때 [{ x1, y1, x2, y2, w_m }]
   JJPlanTools.fixPhoto(file) → Promise<canvas | null>   기울어진 사진의 네 모서리를 맞춰 반듯하게 편다
   쓰는 것: plan_auto.js(규칙 방 나누기·보통 구성) + vendor/jjvendor.js(글자 인식·사진 보정·다각형 연산·추론 실행기) + models/plan_spa.onnx·plan_str.onnx(있을 때만)
   학습 모델이 없거나 어느 단계가 실패하면 그 단계만 건너뛰고 앞 단계 결과를 돌려준다. */
(function (root) {
  var BASE = root.JJ_ASSET_BASE || 'https://jipjini.com/assets/', VEN = null, OCR = null, AI = undefined;
  var KW = [[/^(A\.?D|P\.?D|P\.?S|E\.?P\.?S|T\.?P\.?S)(\s*[&·\/]\s*(A\.?D|P\.?D|P\.?S))?$|피트|덕트|^PIT$/i, '피트'], [/거\s*[실설]|가족실|living/i, '거실'], [/[침칩템]\s*실|^심1\d$|안\s*방|^방\s*\d|bed\s*room|^room/i, '방'], [/[욕옥]\s*[실스]|^요스$|화장실|bath|toilet|^w\.?c/i, '욕실'], [/[발빌밥필]\s*코\s*[니나]|베란다|다용도|balcony/i, '발코니'], [/실외기/i, '실외기실'],
    [/주\s*방|식\s*당|kitchen|dining/i, '주방'], [/[현협한헌]\s*관|entrance/i, '현관'], [/드레스|파우더|dress/i, '드레스룸'], [/팬트리|창고|알파|세탁|보일러|대피|pantry/i, '기타']];
  function script(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = function () { ok(); }; s.onerror = function () { no(new Error('불러오지 못했습니다: ' + src)); }; document.head.appendChild(s); }); }
  function needAuto() { return root.JJPlanAuto ? Promise.resolve() : script(BASE + 'plan_auto.js?v=20261110h'); }
  function vendor() { if (VEN) return VEN; root.JJ_VENDOR_BASE = BASE + 'vendor/'; VEN = script(BASE + 'vendor/jjvendor.js?v=20261110').then(function () { if (!root.JJVendor) throw new Error('도구 묶음 없음'); return root.JJVendor; }); VEN.catch(function () { VEN = null; }); return VEN; }
  function toImage(src) {
    return new Promise(function (ok, no) {
      if (!src) return no(new Error('그림이 없습니다.'));
      if (src.getContext || (src.tagName && src.tagName === 'IMG')) return ok(src);
      if (!/^image\//.test(src.type || '')) return no(new Error('그림 파일(JPG·PNG)만 넣을 수 있습니다. PDF 는 화면을 캡처해서 넣어 주세요.'));
      if (src.size > 15 * 1024 * 1024) return no(new Error('15MB 이하 그림만 넣을 수 있습니다.'));
      var url = URL.createObjectURL(src), img = new Image(); img.onload = function () { ok(img); }; img.onerror = function () { no(new Error('그림을 열지 못했습니다.')); }; img.src = url;
    });
  }
  function canvasOf(dataUrl, W, H) { return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, 0, 0, W, H); ok(c); }; im.onerror = function () { no(new Error('그림 변환 실패')); }; im.src = dataUrl; }); }
  function inPoly(x, y, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }

  // ── 글자 인식: 그대로 한 번 + 시계 방향 90도 돌려 한 번(세로로 쓴 치수) ──
  function ocrService() {
    if (OCR) return OCR;
    OCR = vendor().then(function (V) { var s = new V.PaddleOcrService({ model: { detection: BASE + 'ocr/det.onnx', recognition: BASE + 'ocr/rec.onnx', charactersDictionary: BASE + 'ocr/dict.txt' } }); return s.initialize().then(function () { return s; }); });
    OCR.catch(function () { OCR = null; }); return OCR;
  }
  function readText(canvas) {
    return ocrService().then(function (svc) {
      var W = canvas.width, H = canvas.height, rot = document.createElement('canvas'); rot.width = H; rot.height = W; var g = rot.getContext('2d'); g.translate(H, 0); g.rotate(Math.PI / 2); g.drawImage(canvas, 0, 0);
      return svc.recognize(canvas, { flatten: true }).then(function (a) {
        return svc.recognize(rot, { flatten: true }).then(function (b) {
          var out = [];
          (a.results || []).forEach(function (r) { if (r.confidence >= 0.5 && r.text) out.push({ text: String(r.text).trim(), x: r.box.x, y: r.box.y, w: r.box.width, h: r.box.height, v: false, conf: r.confidence }); });
          (b.results || []).forEach(function (r) { if (!(r.confidence >= 0.6) || !r.text) return; var t = String(r.text).trim(); if (!/\d{3}/.test(t.replace(/[,.\s]/g, ''))) return;   // 돌린 그림에서는 숫자만
            var o = { text: t, x: r.box.y, y: H - (r.box.x + r.box.width), w: r.box.height, h: r.box.width, v: true, conf: r.confidence };
            if (o.h < o.w * 1.3) return;   // 원래 그림에서 세로로 긴 것만 (가로 글자가 두 번 잡히는 것 방지)
            out.push(o); });
          return out;
        });
      });
    });
  }
  function nmOf(t) { var L = [[/^(A\.?D|P\.?D|P\.?S|E\.?P\.?S|T\.?P\.?S)|피트|덕트/i, '피트'], [/가족실/, '가족실'], [/알파/, '알파룸'], [/팬트리/, '팬트리'], [/다용도/, '다용도실'], [/실외기/, '실외기실'], [/세탁/, '세탁실'], [/창고/, '창고'], [/보일러/, '보일러실'], [/대피/, '대피공간'], [/파우더/, '파우더룸']]; for (var i = 0; i < L.length; i++) if (L[i][0].test(t)) return L[i][1]; return ''; }
  /** 방 바깥선을 가로·세로로 반듯하게 편다 (건물은 거의 직각이다). 20도 안쪽으로 기운 변은 가로/세로로, 짧은 빗변은 가까운 쪽으로, 길고 뚜렷한 빗변(모서리를 깎은 벽)만 남긴다 */
  function orthoPoly(p, D) {
    var n = p.length; if (n < 4) return p; var E = [], i;
    for (i = 0; i < n; i++) { var a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy); if (len < 0.5) continue;
      var cls = Math.abs(dy) <= Math.abs(dx) * 0.4 ? 'H' : Math.abs(dx) <= Math.abs(dy) * 0.4 ? 'V' : 'D'; if (cls === 'D' && len < D * 0.07) cls = Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V';
      E.push({ cls: cls, len: len, a: a, b: b, c: cls === 'H' ? (a[1] + b[1]) / 2 : cls === 'V' ? (a[0] + b[0]) / 2 : 0 }); }
    var merge = function () { var out = []; E.forEach(function (e) { var l = out[out.length - 1]; if (l && l.cls === e.cls && e.cls !== 'D') { l.c = (l.c * l.len + e.c * e.len) / (l.len + e.len); l.len += e.len; l.b = e.b; } else out.push({ cls: e.cls, len: e.len, a: e.a, b: e.b, c: e.c }); });
      while (out.length > 2 && out[0].cls === out[out.length - 1].cls && out[0].cls !== 'D') { var f = out[0], l2 = out.pop(); f.c = (f.c * f.len + l2.c * l2.len) / (f.len + l2.len); f.len += l2.len; f.a = l2.a; } E = out; };
    merge();
    // 작은 턱(짧은 변을 사이에 둔 같은 방향 두 변이 거의 한 줄)은 없앤다
    for (var pass = 0; pass < 4; pass++) { var ch = false; for (i = 0; i < E.length && E.length > 4; i++) { var e0 = E[(i + E.length - 1) % E.length], e1 = E[i], e2 = E[(i + 1) % E.length]; if (e1.cls !== 'D' && e1.len < D * 0.022 && e0.cls === e2.cls && e0.cls !== 'D' && e0.cls !== e1.cls && Math.abs(e0.c - e2.c) < D * 0.022) { E.splice(i, 1); ch = true; break; } } if (!ch) break; merge(); }
    if (E.length < 3) return p; var out2 = [], m = E.length;
    for (i = 0; i < m; i++) { var e = E[i], f2 = E[(i + 1) % m], k = e.cls + f2.cls;
      if (k === 'HV') out2.push([f2.c, e.c]); else if (k === 'VH') out2.push([e.c, f2.c]); else if (k === 'HD') out2.push([e.b[0], e.c]); else if (k === 'DH') out2.push([f2.a[0], f2.c]); else if (k === 'VD') out2.push([e.c, e.b[1]]); else if (k === 'DV') out2.push([f2.c, f2.a[1]]);
      else if (k === 'HH') { out2.push([e.b[0], e.c]); out2.push([e.b[0], f2.c]); } else if (k === 'VV') { out2.push([e.c, e.b[1]]); out2.push([f2.c, e.b[1]]); } else out2.push([e.b[0], e.b[1]]); }
    return out2.length >= 3 ? out2.map(function (q) { return [Math.round(q[0]), Math.round(q[1])]; }) : p;
  }
  /** 모든 방을 반듯하게 펴고, 거의 같은 가로·세로 자리는 한 줄로 맞춘다(방끼리 벽선이 가지런해진다) */
  function squareUp(found) {
    var xs = [], ys = []; found.forEach(function (f) { (f.pts || []).forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); }); if (xs.length < 4) return;
    var D = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)) || 1;
    found.forEach(function (f) { if (f.pts && f.pts.length >= 4) f.pts = orthoPoly(f.pts, D); });
    [0, 1].forEach(function (ax) { var vals = []; found.forEach(function (f) { f.pts.forEach(function (q) { vals.push(q[ax]); }); }); vals.sort(function (a, b) { return a - b; }); var map = {}, grp = [];
      var flush = function () { if (!grp.length) return; var m = Math.round(grp.reduce(function (s2, v) { return s2 + v; }, 0) / grp.length); grp.forEach(function (v) { map[v] = m; }); grp = []; };
      vals.forEach(function (v) { if (grp.length && v - grp[0] > D * 0.011) flush(); grp.push(v); }); flush();
      found.forEach(function (f) { f.pts.forEach(function (q) { q[ax] = map[q[ax]]; }); }); });
    found.forEach(function (f) { var o = []; f.pts.forEach(function (q) { var l = o[o.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) o.push(q); }); while (o.length > 1 && o[0][0] === o[o.length - 1][0] && o[0][1] === o[o.length - 1][1]) o.pop();
      var k = []; for (var i = 0; i < o.length; i++) { var a = o[(i + o.length - 1) % o.length], b = o[i], c = o[(i + 1) % o.length]; if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) continue; k.push(b); } if (k.length >= 3) f.pts = k; });
    // 거의 네모인 공간(네모 넓이의 84% 이상)은 딱 네모로 완성한다 — 모서리의 작은 턱·깎임은 그림 잡음이거나 기둥이다. 다만 채우려는 자리에 다른 공간이 있으면(모서리의 피트·현관) 그대로 둔다
    var bbx = function (pts) { var x = pts.map(function (q) { return q[0]; }), y = pts.map(function (q) { return q[1]; }); return [Math.min.apply(null, x), Math.min.apply(null, y), Math.max.apply(null, x), Math.max.apply(null, y)]; }, areaOf = function (pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
    found.forEach(function (f) { if (!f.pts || f.pts.length <= 4) return; var B = bbx(f.pts), ba = (B[2] - B[0]) * (B[3] - B[1]); if (ba <= 0 || areaOf(f.pts) < ba * 0.84) return;
      var hit = found.some(function (g) { if (g === f || !g.pts) return false; var cx = 0, cy = 0; g.pts.forEach(function (q) { cx += q[0]; cy += q[1]; }); cx /= g.pts.length; cy /= g.pts.length; return cx > B[0] && cx < B[2] && cy > B[1] && cy < B[3] && !inPoly(cx, cy, f.pts); });
      if (!hit) f.pts = [[B[0], B[1]], [B[2], B[1]], [B[2], B[3]], [B[0], B[3]]]; });
    // 끊긴 곳 다시 살펴 채우기 (2026-11-10): ① 두 공간 사이에 벽보다 넓고 1.5m 안쪽인 빈 틈이 있으면 약한 쪽(발코니·이름 없는 칸·작은 칸)을 늘려 메운다
    // ② 방들 앞에 놓인 띠 모양 발코니가 중간에서 끊겼으면(문 호·가구 선에 색이 막힌 자리) 맞닿은 방 줄의 끝까지 늘린다. 채우려는 자리에 다른 공간이 있으면 하지 않는다.
    (function () { var wt = D * 0.018, isRect = function (f) { return f.pts && f.pts.length === 4; }, weak = function (f) { return !!f.guess || /발코니|기타|피트|세탁|다용도|창고|현관|드레스|실외기/.test(String(f.kind || '') + String(f.nm || '')); };
      var free = function (x0, y0, x1, y1, a, b) { return !found.some(function (g) { if (g === a || g === b || !g.pts) return false; var G = bbx(g.pts); return Math.min(x1, G[2]) - Math.max(x0, G[0]) > wt * 1.6 && Math.min(y1, G[3]) - Math.max(y0, G[1]) > wt * 1.6; }); };   /* 벽 두께만큼 겹치는 것은 겹침이 아니다 */
      var setB = function (f, B) { f.pts = [[B[0], B[1]], [B[2], B[1]], [B[2], B[3]], [B[0], B[3]]]; f.filled = true; };
      for (var pass = 0; pass < 2; pass++) found.forEach(function (f) { if (!isRect(f) || !weak(f)) return;
        [0, 1].forEach(function (ax) { [1, -1].forEach(function (dir) { var B = bbx(f.pts), o = 1 - ax, span = B[o + 2] - B[o], edge = dir > 0 ? B[ax + 2] : B[ax], best = null, bg = 1e9;
            found.forEach(function (g) { if (g === f || !g.pts) return; var G = bbx(g.pts), gap = dir > 0 ? G[ax] - edge : edge - G[ax + 2], ov = Math.min(B[o + 2], G[o + 2]) - Math.max(B[o], G[o]); if (gap < -wt || ov < span * 0.6) return; if (gap < bg) { bg = gap; best = G; } });
            if (!best || bg <= D * 0.035 || bg > D * 0.13) return; var N = B.slice(); if (dir > 0) N[ax + 2] = best[ax] - wt; else N[ax] = best[ax + 2] + wt;
            var S = B.slice(); if (dir > 0) { S[ax] = B[ax + 2] + 1; S[ax + 2] = N[ax + 2]; } else { S[ax + 2] = B[ax] - 1; S[ax] = N[ax]; } if (free(S[0], S[1], S[2], S[3], f, null)) setB(f, N); }); }); });
      found.forEach(function (f) { if (!isRect(f) || f.kind !== '발코니') return; var B = bbx(f.pts), w = B[2] - B[0], h = B[3] - B[1], ax = w >= h * 1.8 ? 0 : h >= w * 1.8 ? 1 : -1; if (ax < 0) return; var o = 1 - ax, lo = B[ax], hi = B[ax + 2], iv = [];
        found.forEach(function (g) { if (g === f || !g.pts || g.kind === '발코니' || g.kind === '피트') return; var G = bbx(g.pts); if (Math.abs(G[o + 2] - B[o]) <= D * 0.05 || Math.abs(G[o] - B[o + 2]) <= D * 0.05) iv.push([G[ax], G[ax + 2]]); });
        for (var ch = true; ch;) { ch = false; iv.forEach(function (q) { if (q[1] < lo - D * 0.04 || q[0] > hi + D * 0.04) return; if (q[0] < lo - 1) { lo = q[0]; ch = true; } if (q[1] > hi + 1) { hi = q[1]; ch = true; } }); }
        var len0 = B[ax + 2] - B[ax]; if ((hi - lo) - len0 < D * 0.03 || len0 < (hi - lo) * 0.55) return;   // 이미 끝까지 닿았거나, 절반도 안 되는 발코니를 억지로 늘리지는 않는다
        var N = B.slice(); if (hi > B[ax + 2] + D * 0.03) { var S1 = B.slice(); S1[ax] = B[ax + 2] + 1; S1[ax + 2] = hi; if (free(S1[0], S1[1], S1[2], S1[3], f, null)) N[ax + 2] = hi; }
        if (lo < B[ax] - D * 0.03) { var S2 = B.slice(); S2[ax + 2] = B[ax] - 1; S2[ax] = lo; if (free(S2[0], S2[1], S2[2], S2[3], f, null)) N[ax] = lo; }
        if (N[ax] !== B[ax] || N[ax + 2] !== B[ax + 2]) setB(f, N); }); })();
  }
  function numsOf(t) { var m = String(t).replace(/\s/g, '').match(/\d{1,2}[,.]\d{3}|\d{3,5}/g) || [], out = []; if (m.join('').length < String(t).replace(/[\s]/g, '').length - 1) return out; m.forEach(function (q) { var n = Number(q.replace(/[,.]/g, '')); if (n >= 600 && n <= 30000) out.push(n); }); return out; }
  /** 두 줄로 쓴 방 이름(「드레/스룸」「주방 및/식당」) 한 덩어리로 */
  function mergeLines(items) {
    var kindOf = function (t) { for (var k = 0; k < KW.length; k++) if (KW[k][0].test(t)) return KW[k][1]; return ''; }, out = [], used = {};
    var its = items.slice().sort(function (a, b) { return a.y - b.y; });
    its.forEach(function (a, i) { if (used[i]) return; var cur = a;
      if (!a.v && !/\d{3}/.test(a.text) && a.text.length <= 6) for (var j = i + 1; j < its.length; j++) { var b = its[j]; if (used[j] || b.v || /\d{3}/.test(b.text) || b.text.length > 6) continue;
        var gap = b.y - (cur.y + cur.h); if (gap > Math.min(cur.h, b.h) * 0.9 || gap < -Math.min(cur.h, b.h) * 0.4) continue; if (Math.abs((cur.x + cur.w / 2) - (b.x + b.w / 2)) > Math.max(cur.w, b.w) * 0.5) continue;
        var ka = kindOf(cur.text), kb = kindOf(b.text), kc = kindOf(cur.text + b.text); if (!kc || (ka && kb && ka !== kb)) continue;
        var x0 = Math.min(cur.x, b.x), y0 = Math.min(cur.y, b.y); cur = { text: cur.text + b.text, x: x0, y: y0, w: Math.max(cur.x + cur.w, b.x + b.w) - x0, h: Math.max(cur.y + cur.h, b.y + b.h) - y0, v: false, conf: Math.min(cur.conf || 1, b.conf || 1) }; used[j] = 1; }
      out.push(cur); });
    return out;
  }
  /** 치수선 척도: 한 줄로 이어 쓴 치수 숫자(3,500 | 2,580 | …)는 글자 가운데 사이 거리가 (앞+뒤)/2 mm 이다 → mm/화소. 방 나누기 결과와 무관하게 구한다 */
  function chainScale(items) {
    var ds = []; items.forEach(function (it) { var ns = numsOf(it.text); if (!ns.length) return; var n = ns.length;
      ns.forEach(function (v, k) { var f = (k + 0.5) / n; ds.push({ n: v, v: !!it.v, c: it.v ? it.y + it.h * (1 - f) : it.x + it.w * f, o: it.v ? it.x + it.w / 2 : it.y + it.h / 2, t: it.v ? it.w : it.h }); }); });
    var cand = [];
    [false, true].forEach(function (V) { var L = ds.filter(function (d) { return d.v === V; }).sort(function (a, b) { return a.o - b.o || a.c - b.c; }), rows = [];
      L.forEach(function (d) { var r = rows[rows.length - 1]; if (r && Math.abs(r[0].o - d.o) <= Math.max(r[0].t, d.t) * 0.8) r.push(d); else rows.push([d]); });
      rows.forEach(function (r) { r.sort(function (a, b) { return a.c - b.c; }); for (var i = 0; i + 1 < r.length; i++) { var dpx = r[i + 1].c - r[i].c; if (dpx > 12) cand.push((r[i].n + r[i + 1].n) / 2 / dpx); } }); });
    if (cand.length < 2) return { mm: 0, n: cand.length };
    cand.sort(function (a, b) { return a - b; }); var med = cand[cand.length >> 1], ok = cand.filter(function (c) { return Math.abs(c - med) / med <= 0.1; });
    return ok.length >= 2 && ok.length >= cand.length * 0.5 ? { mm: ok.reduce(function (s2, c) { return s2 + c; }, 0) / ok.length, n: ok.length } : { mm: 0, n: 0 };
  }
  function numOf(t) { var s = String(t).replace(/[\s,.]/g, ''); if (!/^\d{3,5}$/.test(s)) return 0; var n = Number(s); return (n >= 600 && n <= 30000) ? n : 0; }
  /** 글자 인식 결과로 방 종류를 확정하고, 치수 숫자로 척도를 검증·보완한다 */
  function refine(base, items, areaM2) {
    var A = root.JJPlanAuto, named = 0, dims = [], rooms = base.rooms || [], txtArea = 0;
    var found = rooms.map(function (r) { return { pts: r.pts, px: r.px, kind: (base.engine === '학습' || base.engine === '글자 기준') ? r.kind : undefined, _k0: r.kind, nm: r.nm }; });
    items.forEach(function (it) {
      var cx = it.x + it.w / 2, cy = it.y + it.h / 2, ns = numsOf(it.text), am = /전\s*용\s*(?:면적)?\s*[:：]?\s*(\d{2,3}(?:\.\d{1,2})?)/.exec(it.text);
      if (am && !txtArea) { var av = Number(am[1]); if (av >= 12 && av <= 400) txtArea = av; }
      var ra = !it.v && /^[^\d]{0,2}(\d{1,2})[.,](\d{2,3})\s*(?:m|㎡|M|n|rn)/.exec(String(it.text).replace(/\s/g, ''));
      if (ra) { var rv = Number(ra[1] + '.' + ra[2]); if (rv >= 0.5 && rv <= 60) for (var j2 = 0; j2 < found.length; j2++) if (found[j2].pts.length >= 3 && inPoly(cx, cy, found[j2].pts)) { if (!found[j2].areaTxt) found[j2].areaTxt = rv; break; } return; }
      if (ns.length) { ns.forEach(function (n) { dims.push({ n: n, v: it.v, cx: cx, cy: cy }); }); return; }
      if (base.engine === '글자 기준') { for (var i0 = 0; i0 < KW.length; i0++) if (KW[i0][0].test(it.text)) { named++; break; } return; }   // 글자 기준 나누기는 씨앗이 이미 이름을 갖고 있다 — 여기서 다시 붙이면 욕실을 감싼 안방이 「욕실」이 된다(바깥선만 보므로)
      for (var i = 0; i < KW.length; i++) if (KW[i][0].test(it.text)) { for (var j = 0; j < found.length; j++) if (found[j].pts.length >= 3 && inPoly(cx, cy, found[j].pts)) { if (!found[j]._txt) { found[j].kind = KW[i][1]; found[j]._txt = true; named++; } break; } break; }
    });
    squareUp(found);
    // 가늘게 남은 조각(짧은 변이 0.35m 안쪽 — 문틈·벽 사이 자투리)은 공간이 아니다. 피트는 남긴다
    (function () { var ax = [], ay = []; found.forEach(function (f) { f.pts.forEach(function (q) { ax.push(q[0]); ay.push(q[1]); }); }); var D0 = Math.max(Math.max.apply(null, ax) - Math.min.apply(null, ax), Math.max.apply(null, ay) - Math.min.apply(null, ay)) || 1;
      for (var q = found.length - 1; q >= 0 && found.length > 3; q--) { var f = found[q]; if (f.kind === '피트' || f._k0 === '피트' || f.kind === '발코니' || f._k0 === '발코니') continue; var x = f.pts.map(function (p) { return p[0]; }), y = f.pts.map(function (p) { return p[1]; }); if (Math.min(Math.max.apply(null, x) - Math.min.apply(null, x), Math.max.apply(null, y) - Math.min.apply(null, y)) < D0 * 0.028) found.splice(q, 1); } })();
    // 글자로 이름이 붙은 방이 하나라도 있으면, 이름 없는 공간은 모양·크기 추정에 맡긴다(거실 추정 포함)
    var xs = [], ys = []; found.forEach(function (f) { f.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    var innerPx = rooms.filter(function (r) { return r.kind !== '발코니' && r.kind !== '실외기실' && r.kind !== '피트'; }).reduce(function (s, r) { return s + r.px; }, 0), m2 = Number(areaM2) || txtArea || 0;
    // 전용면적은 안목치수(외벽 안쪽) 기준이라 세대 안 칸막이벽은 면적에 들어간다 → 굵은 벽 화소의 40% 를 더해 척도를 잡는다(방만 세면 방이 4~5% 크게 나온다)
    var mmArea = (m2 && innerPx) ? Math.sqrt(m2 * 1e6 / (innerPx + 0.4 * (base.wallPx || 0))) : 0;
    // 치수 기준 척도: ① 이어 쓴 치수선(글자 사이 거리) — 방 나누기와 무관해 가장 믿을 만하다 ② 없으면 가장 큰 숫자 = 도면 전체 가로·세로
    var chain = chainScale(items), hMax = 0, vMax = 0; dims.forEach(function (d) { if (d.v) vMax = Math.max(vMax, d.n); else hMax = Math.max(hMax, d.n); });
    var cand = []; if (hMax && bw > 50) cand.push(hMax / bw); if (vMax && bh > 50) cand.push(vMax / bh);
    var mmDim = 0; if (chain.mm) mmDim = chain.mm; else if (cand.length === 2 && Math.abs(cand[0] - cand[1]) / Math.max(cand[0], cand[1]) <= 0.15) mmDim = (cand[0] + cand[1]) / 2; else if (cand.length === 1) mmDim = cand[0];
    var sc = { 방식: mmArea ? '면적' : '없음', 면적기준: mmArea ? Math.round(mmArea * 100) / 100 : 0, 치수기준: mmDim ? Math.round(mmDim * 100) / 100 : 0, 차이: 0, 안내: '', 도면전용: txtArea || 0 }, fix = mmArea || 0;
    if (mmArea && mmDim) sc.차이 = Math.round((mmDim * mmDim - mmArea * mmArea) / (mmArea * mmArea) * 1000) / 10;   // 면적으로 본 차이(%)
    if (chain.mm) { fix = mmDim; sc.방식 = '치수'; sc.안내 = '도면에 적힌 치수선(' + chain.n + '곳)으로 크기를 계산했습니다.' + (mmArea ? (Math.abs(sc.차이) <= 15 ? ' 전용면적과도 맞습니다.' : ' 입력한 전용면적 ' + m2 + '㎡ 와 ' + Math.abs(sc.차이) + '% 다릅니다 — 다른 평형(타입)의 도면일 수 있으니 확인해 주세요.') : ''); }
    else if (mmArea && mmDim) sc.안내 = Math.abs(sc.차이) <= 20 ? '도면에 적힌 치수와 전용면적 기준 척도가 맞습니다.' : '도면 치수로 본 크기와 전용면적이 ' + Math.abs(sc.차이) + '% 다릅니다 — 전용면적 또는 도면을 확인해 주세요.';
    else if (!mmArea && mmDim) { fix = mmDim; sc.방식 = '치수'; sc.안내 = '전용면적 없이 도면에 적힌 치수(' + (hMax || vMax).toLocaleString('ko-KR') + ' 등)로 크기를 계산했습니다.'; }
    if (!Number(areaM2) && txtArea && sc.방식 === '면적') sc.안내 = '도면에 적힌 전용면적 ' + txtArea + '㎡ 로 크기를 계산했습니다.';
    else if (Number(areaM2) && txtArea && Math.abs(txtArea - Number(areaM2)) / Number(areaM2) > 0.04) sc.안내 += (sc.안내 ? ' ' : '') + '도면에는 전용 ' + txtArea + '㎡ 로 적혀 있습니다(입력값 ' + areaM2 + '㎡).';
    // 방마다 면적이 적힌 도면(부동산114): 적힌 값이 정답 — 척도는 (적힌 면적 ÷ 화소)의 중앙값, 각 방 면적은 적힌 값으로 맞춘다
    var ta = found.filter(function (f) { return f.areaTxt && f.px > 0; });
    if (ta.length >= 2) { var ms = ta.map(function (f) { return Math.sqrt(f.areaTxt * 1e6 / f.px); }).sort(function (a, b) { return a - b; }), mmTxt = ms[ms.length >> 1];
      sc.방면적 = ta.length; if (!chain.mm) { fix = mmTxt; sc.방식 = '방 면적'; sc.안내 = '도면에 방마다 적힌 면적(' + ta.length + '곳)으로 크기를 계산했습니다.'; }
      else sc.안내 = '도면에 적힌 치수선(' + chain.n + '곳)과 방 면적(' + ta.length + '곳)으로 크기를 계산했습니다.';
      var m2t = (innerPx + 0.4 * (base.wallPx || 0)) * fix * fix / 1e6; if (Number(areaM2) && Math.abs(m2t - Number(areaM2)) / Number(areaM2) > 0.2) sc.안내 += ' 입력한 전용면적 ' + areaM2 + '㎡ 와 크게 다릅니다(도면으로는 약 ' + Math.round(m2t) + '㎡) — 다른 평형(타입)의 도면일 수 있으니 확인해 주세요.';
      ta.forEach(function (f) { var calc = f.px * fix * fix / 1e6; if (Math.abs(calc - f.areaTxt) / f.areaTxt <= 0.3) f.px = f.areaTxt * 1e6 / (fix * fix); }); }
    var out = A.finalize(found, base.W, base.H, base.dataUrl, areaM2, base.engine, fix);
    out.rooms.forEach(function (r) { for (var q = 0; q < found.length; q++) if (found[q].pts === r.pts && found[q].areaTxt) r.areaTxt = found[q].areaTxt; });
    out.글자 = { 개수: items.length, 방이름: named, 치수: dims.map(function (d) { return d.n; }).sort(function (a, b) { return b - a; }).slice(0, 12) }; out.척도 = sc; (out.shapes || []).forEach(function (sh) { if (sh.t === 'scale') sh.by = sc.방식; }); if (base.wallPx) out.wallPx = base.wallPx;
    if (base.문) out.문 = base.문; if (base.창) out.창 = base.창;
    if (!out.창 && base.창선 && base.창선.length) { var mmW = out.mmpp || 0, roomAt = function (pt) { for (var q = 0; q < out.rooms.length; q++) if (out.rooms[q].pts.length >= 3 && inPoly(pt[0], pt[1], out.rooms[q].pts)) return out.rooms[q]; return null; }, isBal = function (r) { return r && (r.kind === '발코니' || r.kind === '실외기실'); };
      out.창 = []; base.창선.forEach(function (wn) { var ra = roomAt(wn.a), rb = roomAt(wn.b); if (ra && rb && ra === rb) return; if (!ra && !rb) return;   // 같은 방 안의 선(욕조·가구)이나 세대 밖은 창이 아니다
        var len = Math.sqrt(Math.pow(wn.x2 - wn.x1, 2) + Math.pow(wn.y2 - wn.y1, 2)), wm = mmW ? Math.round(len * mmW / 10) / 100 : 0, inn = isBal(ra) ? rb : ra, outR = isBal(ra) ? ra : rb, kind, hh;
        if (isBal(ra) && isBal(rb)) return;   // 발코니끼리 칸막이
        if ((isBal(ra) || isBal(rb)) && inn && !isBal(inn)) { kind = '분합창'; hh = 2300; }                       // 방·거실 ↔ 발코니
        else if (isBal(ra) || isBal(rb)) { kind = '하이샷시'; hh = 2300; }   // 발코니 ↔ 바깥: 우리나라 발코니는 하이샷시가 기본(도면에서 창틀마다 끊겨 보여도 같은 샷시)
        else if (ra && rb) return;                                                                              // 방 ↔ 방: 창이 아니라 문·가구 선일 가능성이 높다
        else { var rm = ra || rb; if (rm.kind === '욕실') { kind = '작은 창'; hh = 600; } else if (wm && wm >= 2.4) { kind = '큰 창'; hh = 2300; } else { kind = '창'; hh = 1500; } }   // 방 ↔ 바깥(발코니 없는 쪽·확장형)
        var rmC = inn || ra || rb, hz = Math.abs(wn.x2 - wn.x1) >= Math.abs(wn.y2 - wn.y1), kx = hz ? 0 : 1, cs = rmC.pts.map(function (q) { return q[kx]; }), cLo = Math.min.apply(null, cs), cHi = Math.max.apply(null, cs), w1 = hz ? wn.x1 : wn.y1, w2 = hz ? wn.x2 : wn.y2, n1 = Math.max(cLo, Math.min(cHi, Math.min(w1, w2))), n2 = Math.max(cLo, Math.min(cHi, Math.max(w1, w2)));
        if (n2 - n1 < Math.abs(w2 - w1) * 0.4) return;   /* 방 벽 길이를 벗어난 창 선은 그 방의 창이 아니다 */ wn = hz ? { x1: n1, y1: wn.y1, x2: n2, y2: wn.y2 } : { x1: wn.x1, y1: n1, x2: wn.x2, y2: n2 }; len = Math.abs(n2 - n1); wm = mmW ? Math.round(len * mmW / 10) / 100 : 0;
        out.창.push({ x1: Math.round(wn.x1), y1: Math.round(wn.y1), x2: Math.round(wn.x2), y2: Math.round(wn.y2), w_m: wm, h_mm: hh, 종류: kind, 안: (inn && inn.name) || '', 밖: outR && isBal(outR) ? outR.name : (ra && rb ? '' : '바깥'), 가정: '폭은 도면에서 읽고 높이는 자리로 가정' }); }); }
    return out;
  }

  // ── 학습 인식기 (models/plan_spa.onnx · plan_str.onnx 가 올라와 있을 때만) ──
  var SPA_KIND = ['', '거실', '방', '주방', '현관', '발코니', '욕실', '드레스룸', '실외기실', '기타'];
  function aiReady() {
    if (AI !== undefined) return Promise.resolve(AI);
    return fetch(BASE + 'models/manifest.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('없음'); return r.json(); }).then(function (mf) {
      return vendor().then(function (V) { var opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }, jobs = [];
        jobs.push(mf.spa ? V.ort.InferenceSession.create(BASE + 'models/' + mf.spa, opt) : Promise.resolve(null)); jobs.push(mf.str ? V.ort.InferenceSession.create(BASE + 'models/' + mf.str, opt) : Promise.resolve(null));
        return Promise.all(jobs).then(function (s) { AI = (s[0] || s[1]) ? { spa: s[0], str: s[1], size: mf.size || 512, ver: mf.ver || '' } : null; return AI; }); });
    }).catch(function () { AI = null; return null; });
  }
  function segment(sess, canvas, S) {   // 정사각 S 로 흰 여백을 두고 줄여 넣고(학습 때와 같은 방식) 화소별 분류 번호를 돌려준다
    var V = root.JJVendor, W = canvas.width, H = canvas.height, k = S / Math.max(W, H), nw = Math.max(1, Math.round(W * k)), nh = Math.max(1, Math.round(H * k)), ox = (S - nw) >> 1, oy = (S - nh) >> 1;
    var c = document.createElement('canvas'); c.width = S; c.height = S; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.drawImage(canvas, ox, oy, nw, nh);
    var d = g.getImageData(0, 0, S, S).data, N = S * S, x = new Float32Array(3 * N); for (var i = 0; i < N; i++) { x[i] = d[i * 4] / 127.5 - 1; x[N + i] = d[i * 4 + 1] / 127.5 - 1; x[2 * N + i] = d[i * 4 + 2] / 127.5 - 1; }
    var feeds = {}; feeds[sess.inputNames[0]] = new V.ort.Tensor('float32', x, [1, 3, S, S]);
    return sess.run(feeds).then(function (o) { var t = o[sess.outputNames[0]], C = t.dims[1], hh = t.dims[2], ww = t.dims[3], L = t.data, M = hh * ww, cls = new Uint8Array(M);
      for (var p = 0; p < M; p++) { var b = 0, bv = L[p]; for (var q = 1; q < C; q++) { var v = L[q * M + p]; if (v > bv) { bv = v; b = q; } } cls[p] = b; }
      return { cls: cls, w: ww, h: hh, k: k * (ww / S), ox: ox * (ww / S), oy: oy * (hh / S) }; });
  }
  function components(cls, w, h, want, minPx) {   // 같은 분류로 이어진 덩어리 → { c, px, x0,y0,x1,y1, lab 번호 }
    var lab = new Int32Array(w * h), out = [], st = new Int32Array(w * h), n = 0;
    for (var s0 = 0; s0 < w * h; s0++) { var c0 = cls[s0]; if (!want(c0) || lab[s0]) continue; n++; var top = 0; st[top++] = s0; lab[s0] = n; var px = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      while (top) { var p = st[--top], x = p % w, y = (p / w) | 0; px++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && !lab[p - 1] && cls[p - 1] === c0) { lab[p - 1] = n; st[top++] = p - 1; } if (x < w - 1 && !lab[p + 1] && cls[p + 1] === c0) { lab[p + 1] = n; st[top++] = p + 1; }
        if (y > 0 && !lab[p - w] && cls[p - w] === c0) { lab[p - w] = n; st[top++] = p - w; } if (y < h - 1 && !lab[p + w] && cls[p + w] === c0) { lab[p + w] = n; st[top++] = p + w; } }
      if (px >= minPx) out.push({ c: c0, px: px, x0: x0, y0: y0, x1: x1, y1: y1, n: n, s: s0 }); }
    return { list: out, lab: lab };
  }
  function contour(lab, w, h, comp) {   // 덩어리 바깥선 따라가기(무어 방식) → 꼭짓점 줄이기 → 직각 맞추기
    var isIn = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x] === comp.n; }, DIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    var cx = comp.s % w, cy = (comp.s / w) | 0, dir = 0, pts = [[cx, cy]], guard = 0;
    while (guard++ < 40000) { var f = false; for (var k = 0; k < 8; k++) { var nd = (dir + 6 + k) % 8, nx = cx + DIR[nd][0], ny = cy + DIR[nd][1]; if (isIn(nx, ny)) { cx = nx; cy = ny; dir = nd; f = true; break; } } if (!f || (cx === pts[0][0] && cy === pts[0][1])) break; pts.push([cx, cy]); }
    return pts;
  }
  function tidy(pts, eps) {   // 다각형 연산 도구로 꼭짓점 정리(자기 교차 제거 포함). 도구가 없으면 원본
    try { var C = root.JJVendor.clipper.Clipper, path = pts.map(function (p) { return { x: Math.round(p[0] * 100), y: Math.round(p[1] * 100) }; });
      var simp = C.simplifyPath ? C.simplifyPath(path, eps * 100, true) : path, u = C.union([simp], root.JJVendor.clipper.FillRule.NonZero), best = null, ba = 0;
      (u || []).forEach(function (q) { var a = Math.abs(C.area(q)); if (a > ba) { ba = a; best = q; } });
      if (best && best.length >= 3) return best.map(function (q) { return [q.x / 100, q.y / 100]; }); } catch (e) {}
    return pts;
  }
  function aiAnalyze(ai, canvas) {
    var S = ai.size, W = canvas.width, H = canvas.height, K = Math.min(1, 1600 / Math.max(W, H));
    return (ai.str ? segment(ai.str, canvas, S) : Promise.resolve(null)).then(function (st) {
      return (ai.spa ? segment(ai.spa, canvas, S) : Promise.resolve(null)).then(function (sp) {
        var doors = [], wins = [];
        var back = function (seg, x, y) { return [(x - seg.ox) / seg.k, (y - seg.oy) / seg.k]; };
        if (st) { var cs = components(st.cls, st.w, st.h, function (c) { return c === 2 || c === 3; }, 6);
          cs.list.forEach(function (o) { var a = back(st, o.x0, o.y0), b = back(st, o.x1 + 1, o.y1 + 1), horiz = (b[0] - a[0]) >= (b[1] - a[1]);
            var seg = horiz ? { x1: a[0], y1: (a[1] + b[1]) / 2, x2: b[0], y2: (a[1] + b[1]) / 2 } : { x1: (a[0] + b[0]) / 2, y1: a[1], x2: (a[0] + b[0]) / 2, y2: b[1] }; seg.box = [a[0], a[1], b[0], b[1]]; (o.c === 2 ? doors : wins).push(seg); });
          // 문 자리를 공간 분류 그림에서 지워, 문이 열려 이어진 방을 끊는다
          if (sp && sp.w === st.w && sp.h === st.h) for (var i = 0; i < st.cls.length; i++) if (st.cls[i] === 1 || st.cls[i] === 2) sp.cls[i] = 0; }
        if (!sp) return null;
        var minPx = Math.max(12, Math.round(sp.w * sp.h * 0.0015)), cc = components(sp.cls, sp.w, sp.h, function (c) { return c >= 1 && c <= 9; }, minPx), found = [];
        cc.list.forEach(function (o) { var raw = contour(cc.lab, sp.w, sp.h, o); if (raw.length < 6) return; var poly = tidy(raw, Math.max(1.2, sp.w / 220)); if (poly.length < 3) return;
          found.push({ pts: poly.map(function (p) { var q = back(sp, p[0] + 0.5, p[1] + 0.5); return [Math.round(q[0] * K), Math.round(q[1] * K)]; }), px: o.px / (sp.k * sp.k) * K * K, kind: SPA_KIND[o.c] || '기타' }); });
        if (!found.length) return null;
        var sc = function (s) { return { x1: Math.round(s.x1 * K), y1: Math.round(s.y1 * K), x2: Math.round(s.x2 * K), y2: Math.round(s.y2 * K) }; };
        return { found: found, 문: doors.map(sc), 창: wins.map(sc) };
      });
    });
  }

  /** 전체 흐름: 글자 인식 → 글자를 지운 그림에서 방 나누기(규칙 또는 학습) → 글자로 방 이름·치수 보완
   *  (도면의 글자·치수 숫자는 방 나누기에서 벽으로 오인되므로 먼저 읽고 지운다) */
  // ── 글자 기준 방 나누기 (2026-11-10) — 부동산 사이트 도면(KB·네이버·부동산114)용
  //   방 이름 글자 자리를 씨앗으로, 굵은 벽선만 벽으로 보고(타일 무늬·문 호·기구 선 같은 가는 선은 무시), 벽에서 먼 곳부터 물 채우듯 넓혀 간다.
  //   서로 다른 씨앗의 물은 가장 좁은 목(문·창 자리)에서 만나므로 문이 열려 있어도 방이 나뉜다. 바깥(그림 테두리)도 씨앗 하나.
  function seedRooms(canvas, items, W, H, areaM2) {
    var seeds0 = []; items.forEach(function (it) { for (var i = 0; i < KW.length; i++) if (KW[i][0].test(it.text)) { seeds0.push({ x: it.x + it.w / 2, y: it.y + it.h / 2, kind: KW[i][1], text: it.text }); break; } });
    if (seeds0.length < 3) return null;
    var s = Math.max(W, H) < 560 ? Math.min(2, 640 / Math.max(W, H)) : Math.min(1, 640 / Math.max(W, H)), w = Math.max(32, Math.round(W * s)), h = Math.max(32, Math.round(H * s)), N = w * h;
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(canvas, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, dark = new Uint8Array(N), line = new Uint8Array(N), lineL = new Uint8Array(N), sat = new Uint8Array(N), i, x, y;
    for (i = 0; i < N; i++) { var r0c = d[i * 4], g0c = d[i * 4 + 1], b0c = d[i * 4 + 2], v = (r0c * 299 + g0c * 587 + b0c * 114) / 1000, mx = Math.max(r0c, g0c, b0c), mn = Math.min(r0c, g0c, b0c); dark[i] = (v < 96 && (mx - mn) < 60) ? 1 : 0; line[i] = (v < 175 && (mx - mn) < 70) ? 1 : 0; lineL[i] = (v < 208 && (mx - mn) < 40) ? 1 : 0; sat[i] = mx - mn; }   // 벽 = 어둡고 색이 없는 선 (짙은 갈색 마루·현관 타일은 벽이 아님)
    // 굵은 선만: 3×3 깎기 → 두 번 불리기
    var er = new Uint8Array(N), wall = new Uint8Array(N);
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; if (dark[i] && dark[i - 1] && dark[i + 1] && dark[i - w] && dark[i + w]) er[i] = 1; }
    var cur = er; for (var pass = 0; pass < 2; pass++) { var nx2 = new Uint8Array(N); for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; if (cur[i] || cur[i - 1] || cur[i + 1] || cur[i - w] || cur[i + w]) nx2[i] = dark[i] || pass === 0 ? 1 : 0; } cur = nx2; }
    wall = cur;
    // 점 같은 검은 덩어리(수전·배수구·타일 줄눈 교차점)는 벽이 아니다 — 남겨 두면 작은 방 가운데가 「벽 근처」가 되어 씨앗이 안 생긴다
    var U0 = 40;
    (function () { var bxa = w, bxb = 0, bya = h, byb = 0, k; for (k = 0; k < N; k++) if (wall[k]) { var xx = k % w, yy = (k / w) | 0; if (xx < bxa) bxa = xx; if (xx > bxb) bxb = xx; if (yy < bya) bya = yy; if (yy > byb) byb = yy; }
      U0 = Math.sqrt(Math.max(1, (bxb - bxa) * (byb - bya)) * 0.8 / ((Number(areaM2) || 84) * 1.3)); var lim = Math.max(10, U0 * U0 * 0.03), seenW = new Uint8Array(N);
      for (k = 0; k < N; k++) { if (!wall[k] || seenW[k]) continue; var st = [k], comp = [k]; seenW[k] = 1;
        while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; var q2 = ny * w + nx; if (wall[q2] && !seenW[q2]) { seenW[q2] = 1; st.push(q2); comp.push(q2); } } }
        if (comp.length < lim) comp.forEach(function (q3) { wall[q3] = 0; }); } })();
    // 창: 굵은 벽 사이 틈을 가는 선이 벽 방향으로 잇고 있으면(틈 길이의 70% 이상) 그 틈을 벽으로 메운다 — 방과 발코니가 넓은 창으로 한 덩어리가 되는 것을 막는다
    var bridge = function (horizontal) { var L1 = horizontal ? h : w, L2 = horizontal ? w : h, idx = function (a, b2) { return horizontal ? a * w + b2 : b2 * w + a; }, maxGap = Math.round(L2 * 0.45), minRun = Math.max(10, Math.round(U0 * 0.32)), band = Math.max(1, Math.round(U0 * 0.1));   // 「길게 이어진 벽」은 벽 두께(약 0.2m)보다 확실히 길어야 한다 — 짧으면 타일 줄눈마다 메워져 욕실·발코니가 통째로 벽이 된다 (실전 시나리오 S01 에서 발견)
      for (var a = 1; a < L1 - 1; a++) { var runs = [], st = -1; for (var b2 = 0; b2 <= L2; b2++) { var on = b2 < L2 && wall[idx(a, b2)]; if (on && st < 0) st = b2; else if (!on && st >= 0) { runs.push([st, b2 - 1]); st = -1; } }
        for (var r = 0; r + 1 < runs.length; r++) { var g0 = runs[r][1] + 1, g1 = runs[r + 1][0] - 1, gap = g1 - g0 + 1; if (gap < 3 || gap > maxGap) continue;
          // 양쪽 벽 가운데 적어도 한쪽이 이 방향으로 길게 이어진 벽이어야 한다(창은 벽의 연장선 위에 있다) — 방 안의 타일 줄눈은 양 끝이 가로지르는 벽이라 제외된다
          var lenA = runs[r][1] - runs[r][0] + 1, lenB = runs[r + 1][1] - runs[r + 1][0] + 1, oneLong = lenA >= minRun || lenB >= minRun, bothLong = lenA >= minRun && lenB >= minRun; if (!oneLong) continue;
          // 창 선은 벽 가운데가 아니라 옆으로 비껴 그려진다 → 벽 두께 안쪽 띠에서, 「한 줄로 이어진」 선을 찾는다(띠 전체를 합치면 타일 줄눈이 다 걸린다).
          // 짙은 선은 한쪽 벽만 길어도 되고, 네이버식 연한 회색 선은 양쪽이 모두 긴 벽일 때만(연한 타일 줄눈과 구분)
          var bestD = 0, bestL = 0; for (var bo = -band; bo <= band; bo++) { var aa = a + bo; if (aa < 0 || aa >= L1) continue; var cd = 0, cl = 0, c1 = 0; for (var t = g0; t <= g1; t++) { var kk3 = idx(aa, t); if (line[kk3]) c1++; if (line[kk3] || (aa > 0 && line[idx(aa - 1, t)]) || (aa < L1 - 1 && line[idx(aa + 1, t)])) cd++; if (lineL[kk3]) cl++; } if (c1 < gap * 0.55) cd = 0;   /* 한 줄만 봐도 절반 넘게 이어져야 선이다 — 이웃 줄까지 합치면 바둑판 타일(욕실)이 선으로 보인다 (R-KB-A) */   /* 짙은 선은 이웃 줄까지 합쳐 본다(선이 한 화소쯤 흔들린다) */ if (cd > bestD) bestD = cd; if (cl > bestL) bestL = cl; }
          if (bestD >= gap * 0.7 || (bothLong && bestL >= gap * 0.7)) for (var t2 = g0; t2 <= g1; t2++) add.push(idx(a, t2)); } } };
    var add = []; bridge(true); bridge(false); add.forEach(function (k) { wall[k] = 1; });
    var wc = 0; for (i = 0; i < N; i++) wc += wall[i]; if (wc < N * 0.006 || wc > N * 0.35) return null;   // 굵은 검은 벽이 없는 도면 → 다른 방식으로
    // 도면 본체 찾기: 벽은 거의 한 덩어리로 이어져 있다 → 가장 큰 벽 덩어리와 그 둘레(약 2m) 안의 덩어리만 도면으로 본다.
    // 화면 갈무리에 같이 찍힌 굵은 글자·단추·사진 테두리가 「벽」으로 잡혀 크기 어림과 방 이름 찾기를 흐트러뜨리는 것을 막는다 (실제 도면 시험: 화면 갈무리에서 「방 3 욕실 2」 글자를 방으로 읽음)
    (function () { var seenP = new Int32Array(N), comps = [], k; for (k = 0; k < N; k++) { if (!wall[k] || seenP[k]) continue; var id = comps.length + 1, st = [k], c = { n: 0, x0: w, x1: 0, y0: h, y1: 0 }; seenP[k] = id;
        while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0; c.n++; if (px < c.x0) c.x0 = px; if (px > c.x1) c.x1 = px; if (py < c.y0) c.y0 = py; if (py > c.y1) c.y1 = py; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; var q2 = ny * w + nx; if (wall[q2] && !seenP[q2]) { seenP[q2] = id; st.push(q2); } } }
        comps.push(c); }
      if (comps.length < 2) return; var big = comps.slice().sort(function (a, b) { return b.n - a.n; })[0], B = [big.x0, big.y0, big.x1, big.y1], mg = Math.max(12, Math.round(U0 * 2)), keep = {}, ch = true;
      comps.forEach(function (c, i2) { if (c === big) keep[i2 + 1] = 1; });
      while (ch) { ch = false; comps.forEach(function (c, i2) { if (keep[i2 + 1]) return; if (c.x1 >= B[0] - mg && c.x0 <= B[2] + mg && c.y1 >= B[1] - mg && c.y0 <= B[3] + mg && (c.n >= big.n * 0.02 || (c.x0 >= B[0] - mg && c.x1 <= B[2] + mg && c.y0 >= B[1] - mg && c.y1 <= B[3] + mg))) { keep[i2 + 1] = 1; if (c.n >= big.n * 0.02) { B = [Math.min(B[0], c.x0), Math.min(B[1], c.y0), Math.max(B[2], c.x1), Math.max(B[3], c.y1)]; ch = true; } } }); }
      for (k = 0; k < N; k++) if (wall[k] && !keep[seenP[k]]) wall[k] = 0; })();
    // 도면 크기 어림(화소/m): 벽이 차지한 네모의 80% ≈ 전용 + 발코니(전용의 1.3배)
    var bx0 = w, bx1 = 0, by0 = h, by1 = 0; for (i = 0; i < N; i++) if (wall[i]) { x = i % w; y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    var U = Math.sqrt(Math.max(1, (bx1 - bx0) * (by1 - by0)) * 0.8 / ((Number(areaM2) || 84) * 1.3));
    // 벽까지 거리
    var dist = new Int32Array(N).fill(-1), q = new Int32Array(N), qh = 0, qt = 0;
    for (i = 0; i < N; i++) if (wall[i]) { dist[i] = 0; q[qt++] = i; }
    while (qh < qt) { var p = q[qh++], px = p % w, py = (p / w) | 0, dd = dist[p] + 1;
      if (px > 0 && dist[p - 1] < 0) { dist[p - 1] = dd; q[qt++] = p - 1; } if (px < w - 1 && dist[p + 1] < 0) { dist[p + 1] = dd; q[qt++] = p + 1; }
      if (py > 0 && dist[p - w] < 0) { dist[p - w] = dd; q[qt++] = p - w; } if (py < h - 1 && dist[p + w] < 0) { dist[p + w] = dd; q[qt++] = p + w; } }
    var maxD = 0; for (i = 0; i < N; i++) if (dist[i] > maxD) maxD = dist[i];
    // 씨앗: 1 = 바깥, 2… = 방 이름 글자. 글자 자리가 벽이면 근처에서 벽과 가장 먼 점으로
    var lab = new Int32Array(N), buckets = []; for (i = 0; i <= maxD; i++) buckets.push([]);
    var push = function (p, l, pr) { if (lab[p] || wall[p]) return; lab[p] = l; buckets[Math.max(0, Math.min(maxD, pr))].push(p); };
    for (x = 0; x < w; x++) { push(x, 1, dist[x]); push((h - 1) * w + x, 1, dist[(h - 1) * w + x]); } for (y = 0; y < h; y++) { push(y * w, 1, dist[y * w]); push(y * w + w - 1, 1, dist[y * w + w - 1]); }
    var seeds = [];
    seeds0.forEach(function (sd) { var sx = Math.round(sd.x * s), sy = Math.round(sd.y * s), best = -1, bd = 0, R = 6; var mgS = (sd.kind === '발코니' || sd.kind === '기타' || sd.kind === '실외기실') ? U * 2.2 : U * 0.3; if (sx < bx0 - mgS || sx > bx1 + mgS || sy < by0 - mgS || sy > by1 + mgS) return;   /* 도면 바깥(화면의 다른 글자) */
      for (var yy = Math.max(1, sy - R); yy <= Math.min(h - 2, sy + R); yy++) for (var xx = Math.max(1, sx - R); xx <= Math.min(w - 2, sx + R); xx++) { var k = yy * w + xx; if (!wall[k] && !lab[k] && dist[k] > bd) { bd = dist[k]; best = k; } }
      if (best < 0) return; var l = seeds.length + 2; seeds.push({ kind: sd.kind, text: sd.text, l: l, p: best }); push(best, l, dist[best]); });
    if (seeds.length < 3) return null;
    // 이름 없는 방: 벽에서 충분히 먼 덩어리(중심부)에 씨앗이 하나도 없으면 씨앗 추가
    var r0 = Math.max(4, Math.round(U * 0.5)), seen = new Uint8Array(N);   // 문 반폭(약 0.45m)보다 커야 이름 있는 방과 문으로 이어지지 않는다 → 글자 없는 욕실도 따로 잡힌다
    for (i = 0; i < N; i++) { if (seen[i] || dist[i] < r0) continue; var st = [i], comp = [i], has = false; seen[i] = 1;
      while (st.length) { var p2 = st.pop(); if (lab[p2]) has = true; var x2 = p2 % w, y2 = (p2 / w) | 0, nb = [x2 > 0 ? p2 - 1 : -1, x2 < w - 1 ? p2 + 1 : -1, y2 > 0 ? p2 - w : -1, y2 < h - 1 ? p2 + w : -1];
        for (var b = 0; b < 4; b++) { var n2 = nb[b]; if (n2 >= 0 && !seen[n2] && dist[n2] >= r0) { seen[n2] = 1; st.push(n2); comp.push(n2); } } }
      if (!has && comp.length >= Math.max(9, U * U * 0.06)) { var bestP = comp[0]; comp.forEach(function (p3) { if (dist[p3] > dist[bestP]) bestP = p3; }); var l2 = seeds.length + 2; seeds.push({ kind: undefined, text: '', l: l2, p: bestP }); push(bestP, l2, dist[bestP]); } }
    // 벽에서 먼 곳부터 넓히기
    for (var lev = maxD; lev >= 0; lev--) { var B = buckets[lev]; for (var bi = 0; bi < B.length; bi++) { var p4 = B[bi], l4 = lab[p4], x4 = p4 % w, y4 = (p4 / w) | 0;
        if (x4 > 0) push(p4 - 1, l4, Math.min(lev, dist[p4 - 1])); if (x4 < w - 1) push(p4 + 1, l4, Math.min(lev, dist[p4 + 1])); if (y4 > 0) push(p4 - w, l4, Math.min(lev, dist[p4 - w])); if (y4 < h - 1) push(p4 + w, l4, Math.min(lev, dist[p4 + w])); } }
    // (색) 칸마다 바탕색을 칠한 도면(부동산114·옛 네이버 양식): 이름 글자가 없는 욕실·현관·발코니가 문·창 틈으로 이웃 방과 한 덩어리가 된다 → 한 덩어리 안에서 바탕색이 뚜렷이 다른 큰 조각을 따로 갈라낸다 (실제 도면 시험 R-114-B 에서 발견)
    (function () { var byL = {}, k; for (k = 0; k < N; k++) if (lab[k] >= 2) (byL[lab[k]] = byL[lab[k]] || []).push(k);
      var keyOf = function (k2) { var o = k2 * 4; return ((d[o] >> 4) << 8) | ((d[o + 1] >> 4) << 4) | (d[o + 2] >> 4); }, minC = U * U * 0.8, nb4 = function (p) { var px = p % w, py = (p / w) | 0; return [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; };
      seeds.slice().forEach(function (sd) { var pix = byL[sd.l]; if (!pix || pix.length < minC * 2) return;
        var hist = {}, sum = {}; pix.forEach(function (k2) { var q = keyOf(k2), o = k2 * 4, a = sum[q] || (sum[q] = [0, 0, 0]); hist[q] = (hist[q] || 0) + 1; a[0] += d[o]; a[1] += d[o + 1]; a[2] += d[o + 2]; });
        var keys = Object.keys(hist).sort(function (a, b) { return hist[b] - hist[a]; }); if ((hist[keys[0]] || 0) + (hist[keys[1]] || 0) + (hist[keys[2]] || 0) < pix.length * 0.72) return;   // 마루·타일 무늬로 채운 도면(KB)은 건드리지 않는다
        var sk = String(keys[0]) === '4095' && keys.length > 1 ? keys[1] : keys[0];   /* 이 칸의 바탕색 = 가장 넓은 색(글자를 지운 흰 자리는 빼고). 글자 둘레만 보면 지운 자리·글자 번짐을 바탕색으로 잘못 잡아 방이 통째로 떨어져 나간다 (시나리오 S06) */
        var mean = function (q) { var a = sum[q], n = hist[q]; return [a[0] / n, a[1] / n, a[2] / n]; }, sm = mean(sk), made = [];
        keys.forEach(function (q) { if (String(q) === String(sk) || hist[q] < minC) return; var m = mean(q), df = Math.max(Math.abs(m[0] - sm[0]), Math.abs(m[1] - sm[1]), Math.abs(m[2] - sm[2])); if (df < 36) return; var white = Math.min(m[0], m[1], m[2]) > 240, need = white ? U * U * 2.2 : minC;   /* 흰 칸은 싱크대·욕조(1.5㎡ 안팎)보다 커야 방으로 본다 */
          var like = function (k4) { var o = k4 * 4; return Math.abs(d[o] - m[0]) <= 18 && Math.abs(d[o + 1] - m[1]) <= 18 && Math.abs(d[o + 2] - m[2]) <= 18; }, seenQ = {};
          var cands = [];
          pix.forEach(function (k5) { if (seenQ[k5] || lab[k5] !== sd.l || !like(k5)) return; var st = [k5], comp = [k5], x0 = w, x1 = 0, y0 = h, y1 = 0; seenQ[k5] = 1;
            while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; nb4(p).forEach(function (n) { if (n >= 0 && !seenQ[n] && lab[n] === sd.l && like(n)) { seenQ[n] = 1; st.push(n); comp.push(n); } }); }
            if (comp.length < need || comp.length < (x1 - x0 + 1) * (y1 - y0 + 1) * 0.55) { if (comp.length >= U * U * 0.03) cands.push(null); return; }
            cands.push({ comp: comp, x0: x0, x1: x1, y0: y0, y1: y1 }); });
          if (cands.length > 3) return;   /* 같은 색 조각이 여럿 흩어져 있으면 칸이 아니라 무늬(타일·마루)다 — 가르지 않는다 (시나리오 S01 의 발코니 타일) */
          cands.forEach(function (cd) { if (!cd) return; var comp = cd.comp, x0 = cd.x0, x1 = cd.x1, y0 = cd.y0, y1 = cd.y1;
            if (white) { var wc2 = 0; comp.forEach(function (c5) { var nb5 = nb4(c5); for (var q5 = 0; q5 < 4; q5++) if (nb5[q5] >= 0 && wall[nb5[q5]]) { wc2++; break; } }); if (wc2 < ((x1 - x0) + (y1 - y0)) * 2 * 0.3) return; }   /* 흰 칸은 둘레의 30% 이상이 벽에 닿아야 방이다 — 방 가운데 떠 있는 흰 네모는 글자를 지운 자리다 (시나리오 S06) */
            var l = seeds.length + 2, bp = comp[0]; comp.forEach(function (c2) { lab[c2] = l; if (dist[c2] > dist[bp]) bp = c2; }); seeds.push({ kind: undefined, text: '', l: l, p: bp, byColor: true, rgb: m }); made.push(l); }); });
        if (!made.length) return;
        // 갈라낸 칸 너머에 남은 조각(욕조·변기·글자 자리처럼 색이 다른 곳)은 본래 방과 끊겼으면 맞닿은 새 칸에 붙인다
        var seenR = {}, parts = []; pix.forEach(function (k6) { if (lab[k6] !== sd.l || seenR[k6]) return; var st = [k6], comp = [k6], tc = {}; seenR[k6] = 1;
          while (st.length) { var p = st.pop(); nb4(p).forEach(function (n) { if (n < 0) return; if (lab[n] === sd.l) { if (!seenR[n]) { seenR[n] = 1; st.push(n); comp.push(n); } } else if (made.indexOf(lab[n]) >= 0) tc[lab[n]] = (tc[lab[n]] || 0) + 1; }); }
          parts.push([comp, tc]); });
        parts.sort(function (a, b) { return b[0].length - a[0].length; }); parts.slice(1).forEach(function (pt) { var bl = 0, bc = 0; Object.keys(pt[1]).forEach(function (l2) { if (pt[1][l2] > bc) { bc = pt[1][l2]; bl = Number(l2); } }); if (bl) pt[0].forEach(function (c3) { lab[c3] = bl; }); });
      }); })();
    // (색2) 무늬로 채운 도면(마루·바둑판 타일)에서도 가르기: 0.2m 남짓한 칸으로 나눠 칸마다 평균색을 내면 무늬가 뭉개져 바닥 종류가 드러난다.
    //   이름 있는 덩어리 안에서 그 덩어리의 주된 바닥색과 뚜렷이 다른 칸들이 1.2~9㎡ 네모로 모여 있으면 글자 없는 다른 공간(욕실·현관)이다 (옛 네이버 양식의 욕실 — 실제 도면 시험 R-NV-1)
    (function () { var Bk = Math.max(3, Math.round(U * 0.2)), gw = Math.ceil(w / Bk), gh = Math.ceil(h / Bk), GN = gw * gh;
      seeds.slice().forEach(function (sd) { if (!sd.kind || sd.kind === '발코니' || sd.kind === '피트' || sd.kind === '욕실' || sd.kind === '현관') return;
        var cntB = new Int32Array(GN), sr = new Float32Array(GN), sg = new Float32Array(GN), sb = new Float32Array(GN), tot = 0, k;
        for (k = 0; k < N; k++) if (lab[k] === sd.l) { var gi = ((k / w) | 0) / Bk | 0, gj = (k % w) / Bk | 0, g9 = gi * gw + gj; cntB[g9]++; sr[g9] += d[k * 4]; sg[g9] += d[k * 4 + 1]; sb[g9] += d[k * 4 + 2]; tot++; }
        if (tot < U * U * 5) return; var full = Bk * Bk * 0.6, hist = {}, bestK = '', bestC = 0, cells = [];
        for (k = 0; k < GN; k++) if (cntB[k] >= full) { sr[k] /= cntB[k]; sg[k] /= cntB[k]; sb[k] /= cntB[k]; var key = (sr[k] >> 5) + ',' + (sg[k] >> 5) + ',' + (sb[k] >> 5); hist[key] = (hist[key] || 0) + 1; if (hist[key] > bestC) { bestC = hist[key]; bestK = key; } cells.push(k); }
        if (cells.length < 20 || bestC < cells.length * 0.35) return; var mr = 0, mg = 0, mb = 0, mn = 0; cells.forEach(function (c) { if ((sr[c] >> 5) + ',' + (sg[c] >> 5) + ',' + (sb[c] >> 5) === bestK) { mr += sr[c]; mg += sg[c]; mb += sb[c]; mn++; } }); mr /= mn; mg /= mn; mb /= mn;
        var odd = new Uint8Array(GN); cells.forEach(function (c) { if (Math.min(sr[c], sg[c], sb[c]) > 236) return;   /* 흰 칸(글자를 지운 자리·흰 가구)은 다른 바닥이 아니다 */ if (Math.max(Math.abs(sr[c] - mr), Math.abs(sg[c] - mg), Math.abs(sb[c] - mb), 1.4 * Math.abs((sr[c] - sb[c]) - (mr - mb))) >= 34) odd[c] = 1; });   /* 밝기뿐 아니라 색 기운(붉은 쪽↔푸른 쪽) 차이도 본다 — 크림색 방과 하늘색 타일 욕실은 밝기가 비슷하다 */
        var seenG = new Uint8Array(GN); cells.forEach(function (c0) { if (!odd[c0] || seenG[c0]) return; var st = [c0], comp = [c0], x0 = gw, x1 = 0, y0 = gh, y1 = 0; seenG[c0] = 1;
          while (st.length) { var c = st.pop(), cx = c % gw, cy = (c / gw) | 0; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
            [cx > 0 ? c - 1 : -1, cx < gw - 1 ? c + 1 : -1, cy > 0 ? c - gw : -1, cy < gh - 1 ? c + gw : -1].forEach(function (n) { if (n >= 0 && odd[n] && !seenG[n] && Math.max(Math.abs(sr[n] - sr[c]), Math.abs(sg[n] - sg[c]), Math.abs(sb[n] - sb[c])) < 45) { seenG[n] = 1; st.push(n); comp.push(n); } }); }
          var m2 = comp.length * Bk * Bk / (U * U), bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (m2 < 1.2 || m2 > 9 || comp.length > cells.length * 0.4 || comp.length < bw * bh * 0.62 || Math.min(bw, bh) * Bk < U * 0.8) return;
          // 네모 범위 안의 이 덩어리 화소를 새 칸으로 (무늬 줄·기구 선 포함), 벽에 닿은 비율도 잰다
          var l = seeds.length + 2, bp = -1, px0 = x0 * Bk, px1 = Math.min(w, (x1 + 1) * Bk), py0 = y0 * Bk, py1 = Math.min(h, (y1 + 1) * Bk), wallHit = 0, per = 0;
          for (var xx = px0; xx < px1; xx++) { per += 2; [py0 - 1, py1].forEach(function (yy) { for (var t = 0; t < 4; t++) { var y3 = yy + (yy < py0 ? -t : t); if (y3 >= 0 && y3 < h && wall[y3 * w + xx]) { wallHit++; break; } } }); }
          for (var yy2 = py0; yy2 < py1; yy2++) { per += 2; [px0 - 1, px1].forEach(function (xx2) { for (var t = 0; t < 4; t++) { var x3 = xx2 + (xx2 < px0 ? -t : t); if (x3 >= 0 && x3 < w && wall[yy2 * w + x3]) { wallHit++; break; } } }); }
          for (var yy3 = py0; yy3 < py1; yy3++) for (var xx3 = px0; xx3 < px1; xx3++) { var k5 = yy3 * w + xx3; if (lab[k5] === sd.l && !wall[k5]) { lab[k5] = l; if (bp < 0 || dist[k5] > dist[bp]) bp = k5; } }
          if (bp < 0) return; seeds.push({ kind: undefined, text: '', l: l, p: bp, byColor: true, encl: wallHit / Math.max(1, per) }); }); }); })();
    // (현관) 현관 글자를 못 읽었을 때(짙은 타일 위 글자): 거실·주방 덩어리 안에서 바닥보다 뚜렷이 어둡고 벽에 붙은 네모 조각(1~7㎡)을 현관으로 갈라낸다 (KB 양식 — 실제 도면 시험 R-KB-A)
    if (!seeds.some(function (sd) { return sd.kind === '현관'; })) (function () { var done = false;
      seeds.slice().forEach(function (sd) { if (done || (sd.kind !== '거실' && sd.kind !== '주방')) return; var pix = [], hv = new Int32Array(256), k; for (k = 0; k < N; k++) if (lab[k] === sd.l) { pix.push(k); hv[(d[k * 4] * 299 + d[k * 4 + 1] * 587 + d[k * 4 + 2] * 114) / 1000 | 0]++; }
        if (pix.length < U * U * 6) return; var acc = 0, med = 128; for (k = 0; k < 256; k++) { acc += hv[k]; if (acc >= pix.length / 2) { med = k; break; } } if (med < 110) return;
        var darkP = function (k2) { var o = k2 * 4, v = (d[o] * 299 + d[o + 1] * 587 + d[o + 2] * 114) / 1000; return v < med - 38 && v > 40; }, seenD = {};
        pix.forEach(function (k3) { if (done || seenD[k3] || !darkP(k3)) return; var st = [k3], comp = [k3], x0 = w, x1 = 0, y0 = h, y1 = 0, wc3 = 0; seenD[k3] = 1;
          while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0, nearW = false; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
            [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1].forEach(function (n) { if (n < 0) return; if (wall[n]) nearW = true; else if (!seenD[n] && lab[n] === sd.l && darkP(n)) { seenD[n] = 1; st.push(n); comp.push(n); } }); if (nearW) wc3++; }
          var bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (comp.length < U * U * 1.0 || comp.length > U * U * 7 || comp.length < bw * bh * 0.6 || wc3 < (bw + bh) * 2 * 0.25) return;
          var l = seeds.length + 2, bp = comp[0]; for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) { var k4 = yy * w + xx; if (lab[k4] === sd.l && !wall[k4]) { lab[k4] = l; if (dist[k4] > dist[bp]) bp = k4; } }   /* 타일 줄눈까지 네모째로 */
          seeds.push({ kind: '현관', text: '현관', l: l, p: bp, byColor: true, guessed: true }); done = true; }); }); })();
    // 가는 선으로만 그린 발코니·창고(부동산114): 굵은 벽이 없어 바깥과 한 덩어리가 된다 → 이름 글자 둘레의 바탕색과 같은 색이 이어진 곳을 그 칸으로 잡는다
    var rc0 = function (k) { return Math.min.apply(null, k.split(',').map(function (v) { return Number(v) * 8 + 4; })); };
    (function () { var cntG = {}; for (var k = 0; k < N; k++) if (lab[k] >= 2) cntG[lab[k]] = (cntG[lab[k]] || 0) + 1;
      seeds.slice().sort(function (a, b) { return (a.kind === '발코니' ? 0 : 1) - (b.kind === '발코니' ? 0 : 1); }).forEach(function (sd) { if (!(sd.kind === '발코니' || sd.kind === '기타' || sd.kind === '실외기실') || (cntG[sd.l] || 0) >= U * U * 1.0) return;
        var sx = sd.p % w, sy = (sd.p / w) | 0, R = Math.max(8, Math.round(U * 0.7)), hist = {}, bestK = '', bestC = 0;
        for (var yy = Math.max(0, sy - R); yy <= Math.min(h - 1, sy + R); yy++) for (var xx = Math.max(0, sx - R * 2); xx <= Math.min(w - 1, sx + R * 2); xx++) { var o = (yy * w + xx) * 4, r = d[o], g2 = d[o + 1], b = d[o + 2]; if (Math.min(r, g2, b) > 243 || Math.max(r, g2, b) < 120) continue; var key = (r >> 3) + ',' + (g2 >> 3) + ',' + (b >> 3); hist[key] = (hist[key] || 0) + 1; if (hist[key] > bestC) { bestC = hist[key]; bestK = key; } }
        if (bestC < 12) return; var rc = bestK.split(',').map(function (v) { return Number(v) * 8 + 4; }), tol = Math.max(5, Math.min(20, (255 - Math.max(rc0(bestK), 0)) * 0.55));
        var like = function (k2) { var o = k2 * 4; return Math.abs(d[o] - rc[0]) <= tol && Math.abs(d[o + 1] - rc[1]) <= tol && Math.abs(d[o + 2] - rc[2]) <= tol; };
        var seenC = new Uint8Array(N), st = [], comp = [];
        for (var y3 = Math.max(0, sy - R); y3 <= Math.min(h - 1, sy + R); y3++) for (var x3 = Math.max(0, sx - R * 2); x3 <= Math.min(w - 1, sx + R * 2); x3++) { var k3 = y3 * w + x3; if (!wall[k3] && (lab[k3] <= 1 || lab[k3] === sd.l) && like(k3)) { seenC[k3] = 1; st.push(k3); comp.push(k3); } }
        while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0, nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; for (var q = 0; q < 4; q++) { var n = nb[q]; if (n >= 0 && !seenC[n] && !wall[n] && (lab[n] <= 1 || lab[n] === sd.l) && like(n)) { seenC[n] = 1; st.push(n); comp.push(n); } } }
        if (comp.length < U * U * 0.5 || comp.length > N * 0.2) return;
        // 글자를 지운 흰 네모·가는 선 때문에 생긴 구멍 메우기: 덩어리의 네모 범위 안에서 사방이 덩어리에 막힌 바깥 화소
        comp.forEach(function (k4) { lab[k4] = sd.l; });
        for (var pass2 = 0; pass2 < 3; pass2++) for (var k5 = w; k5 < N - w; k5++) { if (lab[k5] > 1 || wall[k5]) continue; var c4 = (lab[k5 - 1] === sd.l) + (lab[k5 + 1] === sd.l) + (lab[k5 - w] === sd.l) + (lab[k5 + w] === sd.l); if (c4 >= 3) lab[k5] = sd.l; } }); })();
    (function () { var seenE = new Uint8Array(N), lim = U * U * 0.22; /* 0.2㎡ 남짓한 닫힌 칸(피트·PD)도 잡는다 */ for (var k = 0; k < N; k++) { if (lab[k] || wall[k] || seenE[k]) continue; var st = [k], comp = [k]; seenE[k] = 1;
        while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0, nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; for (var b = 0; b < 4; b++) { var q2 = nb[b]; if (q2 >= 0 && !lab[q2] && !wall[q2] && !seenE[q2]) { seenE[q2] = 1; st.push(q2); comp.push(q2); } } }
        if (comp.length >= lim) { var l = seeds.length + 2, bp = comp[0]; comp.forEach(function (q3) { lab[q3] = l; if (dist[q3] > dist[bp]) bp = q3; }); seeds.push({ kind: undefined, text: '', l: l, p: bp }); } } })();
    // (가) 한 공간에 이름이 둘 이상(주방/식당·거실·가족실이 트인 평면): 벽 사이 목이 없어 한 씨앗이 다 차지하므로, 그 공간 안에서 가까운 씨앗끼리 다시 나눈다
    var cnt0 = {}; for (i = 0; i < N; i++) if (lab[i] >= 2) cnt0[lab[i]] = (cnt0[lab[i]] || 0) + 1;
    var minPx0 = N * 0.0012, groups = {};
    seeds.forEach(function (sd) { if (!sd.kind || sd.kind === '피트' || (cnt0[sd.l] || 0) >= minPx0) return; var px0 = sd.p % w, py0 = (sd.p / w) | 0, win = 0;
      for (var rr = 1; rr <= 4 && !win; rr++) [[rr, 0], [-rr, 0], [0, rr], [0, -rr]].forEach(function (o2) { var xx = px0 + o2[0], yy = py0 + o2[1]; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { var l9 = lab[yy * w + xx]; if (l9 >= 2 && l9 !== sd.l && !win) win = l9; } });
      if (win) (groups[win] = groups[win] || []).push(sd); });
    Object.keys(groups).forEach(function (wk) { var W0 = Number(wk), owner = seeds.filter(function (sd) { return sd.l === W0; })[0]; if (!owner || !owner.kind) return; var members = [owner].concat(groups[wk]), setL = {}; members.forEach(function (m) { setL[m.l] = 1; });
      var own = new Int32Array(N), qq = new Int32Array(N), a0 = 0, a1 = 0; members.forEach(function (m) { own[m.p] = m.l; qq[a1++] = m.p; });
      while (a0 < a1) { var pc = qq[a0++], xc = pc % w, yc = (pc / w) | 0, nb2 = [xc > 0 ? pc - 1 : -1, xc < w - 1 ? pc + 1 : -1, yc > 0 ? pc - w : -1, yc < h - 1 ? pc + w : -1];
        for (var b3 = 0; b3 < 4; b3++) { var n3 = nb2[b3]; if (n3 >= 0 && !own[n3] && setL[lab[n3]]) { own[n3] = own[pc]; qq[a1++] = n3; } } }
      for (i = 0; i < N; i++) if (own[i]) lab[i] = own[i]; });
    // (가2) 거실·주방·가족실이 문보다 넓게(1.3m 이상) 트여 맞닿아 있으면 한 공간으로 보고, 각 이름 글자에서 가까운 쪽으로 다시 나눈다 (벽에서 먼 곳부터 채우면 거실이 주방까지 다 차지하기 때문)
    var openL = {}; seeds.forEach(function (sd) { if (sd.kind === '거실' || sd.kind === '주방') openL[sd.l] = sd; });
    var par = {}, findP = function (a) { while (par[a] !== undefined && par[a] !== a) a = par[a]; return a; }, wide = {}, thr = U * 0.65;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; var la = lab[i]; if (!openL[la] || dist[i] < thr) continue; var lb = lab[i + 1], lc = lab[i + w];
      if (lb !== la && openL[lb]) wide[Math.min(la, lb) + '|' + Math.max(la, lb)] = (wide[Math.min(la, lb) + '|' + Math.max(la, lb)] || 0) + 1;
      if (lc !== la && openL[lc]) wide[Math.min(la, lc) + '|' + Math.max(la, lc)] = (wide[Math.min(la, lc) + '|' + Math.max(la, lc)] || 0) + 1; }
    Object.keys(wide).forEach(function (k) { if (wide[k] < 3) return; var pr = k.split('|'), a = findP(Number(pr[0])), b2 = findP(Number(pr[1])); if (par[a] === undefined) par[a] = a; if (a !== b2) par[b2] = a; });
    var grp = {}; Object.keys(openL).forEach(function (l) { l = Number(l); if (par[l] === undefined) return; var rt = findP(l); (grp[rt] = grp[rt] || []).push(openL[l]); });
    // 트인 공간은 가까운 글자 쪽으로 나누면 경계가 비스듬해진다 → 가로나 세로 한 줄로 반듯하게 자른다. 자르는 자리는 두 이름 글자 사이에서 공간이 가장 좁아지는 곳(벽 모서리·턱)
    var cutGroup = function (pix, mem) {
      if (mem.length < 2 || pix.length < 4) { for (var q0 = 0; q0 < pix.length; q0++) lab[pix[q0]] = mem[0].l; return; }
      var best = null; [0, 1].forEach(function (ax) { var co = function (k) { return ax ? (k / w) | 0 : k % w; }, sd = mem.slice().sort(function (a, b2) { return co(a.p) - co(b2.p); }), hist = null;
        for (var gi = 0; gi + 1 < sd.length; gi++) { var lo = co(sd[gi].p), hi = co(sd[gi + 1].p); if (hi - lo < Math.max(4, U * 0.5)) continue;
          if (!hist) { hist = new Int32Array(ax ? h : w); for (var q1 = 0; q1 < pix.length; q1++) hist[co(pix[q1])]++; }
          var from = Math.ceil(lo + (hi - lo) * 0.18), to = Math.floor(hi - (hi - lo) * 0.18), mid = (lo + hi) / 2;
          for (var c = from; c <= to; c++) { var cost = hist[c] * (1 + 0.25 * Math.abs(c - mid) / Math.max(1, (hi - lo) / 2)); if (!best || cost < best.cost) best = { cost: cost, ax: ax, c: c, left: sd.slice(0, gi + 1), right: sd.slice(gi + 1) }; } } });
      if (!best) { var own0 = mem[0]; for (var q2 = 0; q2 < pix.length; q2++) { var k2 = pix[q2], bd = 1e18; for (var mi = 0; mi < mem.length; mi++) { var dx = (k2 % w) - (mem[mi].p % w), dy = ((k2 / w) | 0) - ((mem[mi].p / w) | 0), d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; own0 = mem[mi]; } } lab[k2] = own0.l; } return; }
      var A = [], B = []; for (var q3 = 0; q3 < pix.length; q3++) { var k3 = pix[q3]; ((best.ax ? (k3 / w) | 0 : k3 % w) < best.c ? A : B).push(k3); }
      cutGroup(A, best.left); cutGroup(B, best.right); };
    Object.keys(grp).forEach(function (rt) { var mem = grp[rt]; if (mem.length < 2) return; var setL = {}; mem.forEach(function (m) { setL[m.l] = 1; }); var pix = []; for (i = 0; i < N; i++) if (setL[lab[i]]) pix.push(i); cutGroup(pix, mem); });
    // (나) 이름 없는 작은 공간이 창 메우기로 생긴 선(욕조·기구 선)만으로 이웃 방과 나뉘어 있으면 그 방에 다시 붙인다 (발코니에는 붙이지 않음)
    var isAdd = new Uint8Array(N); add.forEach(function (k) { isAdd[k] = 1; }); var kindOf = {}; seeds.forEach(function (sd) { kindOf[sd.l] = sd.kind; });
    var touch = {}; add.forEach(function (k) { var xk = k % w, yk = (k / w) | 0, ls = {};
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o3) { for (var st3 = 1; st3 <= 3; st3++) { var xx = xk + o3[0] * st3, yy = yk + o3[1] * st3; if (xx < 0 || yy < 0 || xx >= w || yy >= h) break; var kk = yy * w + xx; if (isAdd[kk]) continue; if (wall[kk]) break; if (lab[kk] >= 2) ls[lab[kk]] = 1; break; } });
      var ks = Object.keys(ls); if (ks.length === 2) { var u1 = ks[0], u2 = ks[1]; touch[u1 + '|' + u2] = (touch[u1 + '|' + u2] || 0) + 1; touch[u2 + '|' + u1] = (touch[u2 + '|' + u1] || 0) + 1; } });
    var cntM = {}; for (i = 0; i < N; i++) if (lab[i] >= 2) cntM[lab[i]] = (cntM[lab[i]] || 0) + 1;
    var mergeTo = {}; seeds.forEach(function (sd) { if (sd.kind || sd.byColor || (cntM[sd.l] || 0) >= U * U * 2.2) return;   /* 2㎡ 넘는 칸(발코니·욕실)은 기구 선 조각이 아니다 — 창 너머 방에 붙이지 않는다 (R-114-B) */ var bestN = 0, bestC = 0; Object.keys(touch).forEach(function (key) { var pr = key.split('|'); if (Number(pr[0]) !== sd.l) return; var k2 = kindOf[pr[1]]; if (!k2 || k2 === '발코니' || k2 === '실외기실') return; if (touch[key] > bestC) { bestC = touch[key]; bestN = Number(pr[1]); } }); if (bestN && bestC >= 6) mergeTo[sd.l] = bestN; });
    if (Object.keys(mergeTo).length) { for (i = 0; i < N; i++) { var ml = mergeTo[lab[i]]; if (ml) lab[i] = ml; } add.forEach(function (k) { var xk = k % w, ls2 = {}; [k - 1, k + 1, k - w, k + w].forEach(function (kk) { if (kk >= 0 && kk < N && lab[kk] >= 2) ls2[lab[kk]] = 1; }); var ks2 = Object.keys(ls2); if (ks2.length === 1 && wall[k] && isAdd[k]) { /* 같은 방 안의 선: 벽에서 뺀다 */ wall[k] = 0; lab[k] = Number(ks2[0]); } }); }
    if (root.JJ_PLAN_DEBUG) root.JJ_PLAN_DEBUG = { w: w, h: h, wall: wall, lab: lab, seeds: seeds, items: items };
    // 방마다 바깥선
    // 한 이름표가 여러 조각으로 흩어져 있으면 가장 큰 조각에서 바깥선을 딴다(작은 조각에서 따면 공간이 통째로 사라진다 — R-114-B 의 주방)
    var bigFirst = {}, bigBox = {};   // bigBox: 무늬 선에 잘게 나뉘었지만 전체로는 네모를 꽉 채운 공간 → 그 네모를 바깥선으로 쓴다
    (function () { var seenF = new Uint8Array(N), bestOf = {}, comps = []; for (var k = 0; k < N; k++) { if (lab[k] < 2 || seenF[k]) continue; var l = lab[k], st = [k], comp = [k]; seenF[k] = 1;
        while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0, nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; for (var b = 0; b < 4; b++) { var n = nb[b]; if (n >= 0 && !seenF[n] && lab[n] === l) { seenF[n] = 1; st.push(n); comp.push(n); } } }
        comps.push([l, comp]); if (!bestOf[l] || comp.length > bestOf[l].length) bestOf[l] = comp; }
      Object.keys(bestOf).forEach(function (l) { var m = bestOf[l][0]; bestOf[l].forEach(function (q) { if (q < m) m = q; }); bigFirst[l] = m; var tot = 0, bx0 = w, bx1 = 0, by0 = h, by1 = 0; comps.forEach(function (c2) { if (String(c2[0]) !== String(l)) return; tot += c2[1].length; c2[1].forEach(function (q) { var qx = q % w, qy = (q / w) | 0; if (qx < bx0) bx0 = qx; if (qx > bx1) bx1 = qx; if (qy < by0) by0 = qy; if (qy > by1) by1 = qy; }); }); if (bestOf[l].length < tot * 0.6 && tot >= (bx1 - bx0 + 1) * (by1 - by0 + 1) * 0.6) bigBox[l] = [bx0, by0, bx1 + 1, by1 + 1]; }); })();   /* 조각을 지우지는 않는다(무늬 선으로 잘게 나뉜 발코니가 사라진다 — 시나리오 S01). 바깥선을 딸 출발점만 가장 큰 조각으로 잡는다 */
    var cnt = {}, first = {}; for (i = 0; i < N; i++) { var li = lab[i]; if (li >= 2) { cnt[li] = (cnt[li] || 0) + 1; if (first[li] === undefined) first[li] = i; } }
    Object.keys(bigFirst).forEach(function (l) { first[l] = bigFirst[l]; });
    var found = [], minPx = N * 0.0012;
    seeds.forEach(function (sd) { var n = cnt[sd.l] || 0; if (n < (sd.kind ? Math.min(minPx, U * U * 0.15) : minPx)) return;   /* 이름 있는 조각은 작아도 남긴다 — 무늬 선에 잘게 나뉜 욕실의 씨앗 조각이 이웃 조각을 모으는 중심이 된다 */ var poly; if (bigBox[sd.l]) { var bb4 = bigBox[sd.l]; poly = [[bb4[0], bb4[1]], [bb4[2], bb4[1]], [bb4[2], bb4[3]], [bb4[0], bb4[3]]]; } else { var raw = contour(lab, w, h, { n: sd.l, s: first[sd.l] }); if (raw.length < 6) return; poly = tidy(raw, Math.max(1.5, w / 260)); } if (poly.length < 3) return;
      found.push({ l: sd.l, pts: poly.map(function (pt) { return [Math.round((pt[0] + 0.5) / s), Math.round((pt[1] + 0.5) / s)]; }), px: n / (s * s), kind: sd.kind, text: sd.text, byColor: !!sd.byColor, encl: sd.encl, nm: /가족실/.test(sd.text) ? '가족실' : nmOf(sd.text) }); });
    if (found.length < 3) return null;
    // 이름이 안 읽힌 공간 가리기: 가는 선이 빽빽한 큰 공간(계단·승강기 = 공용부)은 뺀다 / 길쭉하면 발코니 / 욕실 글자가 아예 없는 도면의 작은 칸은 욕실 / 나머지 큰 것은 방, 작은 것은 기타
    var named = found.filter(function (f) { return f.kind; }).map(function (f) { return f.px; }).sort(function (a, b) { return a - b; }), medN = named[named.length >> 1] || 0;
    var anyBath = seeds.some(function (sd) { return sd.kind === '욕실'; }), lineN = {}, satN = {}, whiteN = {}, tintN = {};   /* tintN: 옅게라도 색이 도는 화소(하늘색 타일) */ for (i = 0; i < N; i++) { var l8 = lab[i]; if (l8 >= 2) { if (line[i] && !wall[i]) lineN[l8] = (lineN[l8] || 0) + 1; if (sat[i] > 28) satN[l8] = (satN[l8] || 0) + 1; if (sat[i] > 16) tintN[l8] = (tintN[l8] || 0) + 1; if (d[i * 4] > 236 && d[i * 4 + 1] > 236 && d[i * 4 + 2] > 236) whiteN[l8] = (whiteN[l8] || 0) + 1; } }
    var anyDoor = seeds.some(function (sd) { return sd.kind === '현관'; });
    found = found.filter(function (f) { if (f.kind) return true; var n = cnt[f.l] || 1, m2r = n / (U * U), ld = (lineN[f.l] || 0) / n, bx = f.pts.map(function (q) { return q[0]; }), by = f.pts.map(function (q) { return q[1]; }), fw = Math.max.apply(null, bx) - Math.min.apply(null, bx), fh = Math.max.apply(null, by) - Math.min.apply(null, by), strip = Math.max(fw, fh) / Math.max(1, Math.min(fw, fh)) >= 3.2;
      var wf = (whiteN[f.l] || 0) / n; f.dbg = [Math.round(m2r * 10) / 10, Math.round(ld * 1000) / 1000, Math.round((satN[f.l] || 0) / n * 100) / 100, Math.round(wf * 100) / 100]; if (m2r >= 9 && ld >= 0.045) return false;   // 공용부
      if (!f.byColor && m2r >= 2.5 && ld >= 0.06 && wf >= 0.7 && !strip) return false;   // 흰 바탕에 가위표·기계 선이 빽빽한 칸 = 승강기·설비 통로(공용부) — 세대 공간이 아니다 (R-114)
      f.wf = wf; if (!strip && m2r >= 1.5 && m2r <= 7.5 && ld >= 0.05 && wf < 0.6 && (f.byColor || !anyBath)) { f.kind = '욕실'; f.guess = true; return true; }   /* 바탕색이 다른 칸에 기구 선(변기·욕조)이 있으면 욕실 */
      if (f.encl !== undefined && !strip) { if (f.encl >= 0.68 && m2r <= 7.5) { f.kind = '욕실'; f.guess = true; return true; } if (!anyDoor && m2r <= 5) { anyDoor = true; f.kind = '현관'; f.guess = true; return true; } }   /* 무늬 바닥으로 가른 칸: 벽으로 둘러싸였으면 욕실, 한쪽이 트였으면 현관 (코디 확인) */
      if (f.byColor && !strip && !anyDoor && m2r <= 2.6 && ld < 0.05 && wf < 0.5) { anyDoor = true; f.kind = '현관'; f.guess = true; return true; }   /* 기구 없는 작은 색 칸 = 현관(코디 확인) */
      if (m2r < 1.05) { f.kind = '피트'; f.nm = '피트'; f.guess = true; return true; }   /* 벽으로 닫힌 1㎡ 안쪽 작은 칸 = 설비 통로(피트·PD)로 본다 (코디 확인) */
      if (strip) { f.kind = '발코니'; f.guess = true; return true; }
      if (!anyBath && !f.byColor && m2r >= 1.2 && m2r <= 7.5 && ((satN[f.l] || 0) / n >= 0.12 || (ld >= 0.04 && (tintN[f.l] || 0) / n >= 0.15))) { f.kind = '욕실'; f.guess = true; return true; }
      f.kind = f.px >= medN ? '방' : '기타'; f.guess = true; return true; });
    // 욕실 안쪽 칸막이 벽 때문에 둘로 나뉜 욕실: 이름 없는 작은 칸이 이름 있는 욕실과 벽 하나 사이로 붙어 있고 바닥색이 같으면 그 욕실의 일부다 (KB 양식의 샤워 칸 — R-KB-A)
    (function () { var sum = {}, k; for (k = 0; k < N; k++) { var l9 = lab[k]; if (l9 < 2) continue; var a9 = sum[l9] || (sum[l9] = [0, 0, 0, 0]); a9[0] += d[k * 4]; a9[1] += d[k * 4 + 1]; a9[2] += d[k * 4 + 2]; a9[3]++; }
      var bbQ = function (f) { var xs2 = f.pts.map(function (q) { return q[0]; }), ys2 = f.pts.map(function (q) { return q[1]; }); return [Math.min.apply(null, xs2), Math.min.apply(null, ys2), Math.max.apply(null, xs2), Math.max.apply(null, ys2)]; }, mean = function (f) { var a = sum[f.l]; return a ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : null; }, gapM = U * 0.4 / s;
      for (var rep = 0; rep < 4; rep++) { var before = found.length;
      found = found.filter(function (f) { if (!f.guess || f.byColor || (f.kind !== '기타' && f.kind !== '피트' && f.kind !== '방')) return true; var n = cnt[f.l] || 0; if (n > U * U * 4.5) return true; var mf = mean(f), A = bbQ(f); if (!mf) return true;
        var host = null; found.forEach(function (g) { if (host || g === f || g.kind !== '욕실' || g.guess) return; var mg2 = mean(g), Bg = bbQ(g); if (!mg2) return; if (A[0] - gapM > Bg[2] || A[2] + gapM < Bg[0] || A[1] - gapM > Bg[3] || A[3] + gapM < Bg[1]) return; if (Math.max(Math.abs(mf[0] - mg2[0]), Math.abs(mf[1] - mg2[1]), Math.abs(mf[2] - mg2[2])) > 40) return; host = g; });
        if (!host) return true; var Bh = bbQ(host), U4 = [Math.min(A[0], Bh[0]), Math.min(A[1], Bh[1]), Math.max(A[2], Bh[2]), Math.max(A[3], Bh[3])]; host.px += f.px; cnt[host.l] = (cnt[host.l] || 0) + n; if ((host.px) >= (U4[2] - U4[0]) * (U4[3] - U4[1]) * 0.7) host.pts = [[U4[0], U4[1]], [U4[2], U4[1]], [U4[2], U4[3]], [U4[0], U4[3]]]; return false; }); if (found.length === before) break; } })();
    found = found.filter(function (f) { return f.kind === '피트' || f.kind === '욕실' || (cnt[f.l] || 0) / (U * U) >= 0.6; });   // 0.6㎡ 안 되는 이름 붙은 조각(글자 둘레 자투리)은 공간이 아니다
    // 세대 바깥으로 삐져나온 흰 칸(승강기·계단실 조각)은 뺀다: 이름 있는 공간·색으로 가른 칸·발코니가 차지한 네모 밖으로 40% 넘게 나가 있으면 세대 공간이 아니다 (R-114 의 승강기)
    (function () { var hx0 = 1e9, hy0 = 1e9, hx1 = -1e9, hy1 = -1e9, any = 0; found.forEach(function (f) { if (f.guess && !f.byColor && f.kind !== '발코니' && f.kind !== '욕실') return; any++; f.pts.forEach(function (q) { if (q[0] < hx0) hx0 = q[0]; if (q[0] > hx1) hx1 = q[0]; if (q[1] < hy0) hy0 = q[1]; if (q[1] > hy1) hy1 = q[1]; }); }); if (any < 3) return;
      found = found.filter(function (f) { if (!f.guess || f.byColor || !(f.wf >= 0.7) || (f.kind !== '기타' && f.kind !== '방' && f.kind !== '피트')) return true; var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; f.pts.forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; });
        var a = Math.max(1, (x1 - x0) * (y1 - y0)), ia = Math.max(0, Math.min(x1, hx1) - Math.max(x0, hx0)) * Math.max(0, Math.min(y1, hy1) - Math.max(y0, hy0)); return ia / a > 0.6; }); })();
    // 세대와 떨어져 홀로 있는 작은 칸(공용부 조각)은 피트로 넣지 않는다
    var bb = function (f) { var xs2 = f.pts.map(function (q) { return q[0]; }), ys2 = f.pts.map(function (q) { return q[1]; }); return [Math.min.apply(null, xs2), Math.min.apply(null, ys2), Math.max.apply(null, xs2), Math.max.apply(null, ys2)]; }, mg = U * 0.45 / s;
    found = found.filter(function (f) { if (f.kind !== '피트' || !f.guess) return true; var a2 = bb(f); return found.some(function (g2) { if (g2 === f || (g2.kind === '피트' && g2.guess)) return false; var b2 = bb(g2); return a2[0] - mg <= b2[2] && a2[2] + mg >= b2[0] && a2[1] - mg <= b2[3] && a2[3] + mg >= b2[1]; }); });
    if (root.JJ_PLAN_DEBUG) root.JJ_PLAN_DEBUG.un = found.filter(function (f) { return f.dbg; }).map(function (f) { return f.kind + JSON.stringify(f.dbg); }).join(' ') + ' U=' + U.toFixed(1);
    if (found.length < 3) return null;
    var wallN = 0; for (i = 0; i < N; i++) if (wall[i] && !isAdd[i]) wallN++; found.wallPx = wallN / (s * s);
    // 창 자리: 굵은 벽 사이를 가는 선이 잇던 틈(위에서 메운 곳)을 선분으로 뽑는다. 폭은 도면에서, 높이는 뒤에서 자리(발코니 바깥 = 하이샷시 등)로 가정한다
    var wins = [], seenA = new Uint8Array(N);
    for (i = 0; i < N; i++) { if (!isAdd[i] || !wall[i] || seenA[i]) continue; var stA = [i], x0a = w, x1a = 0, y0a = h, y1a = 0, cntA = 0; seenA[i] = 1;
      while (stA.length) { var pa = stA.pop(), xa = pa % w, ya = (pa / w) | 0; cntA++; if (xa < x0a) x0a = xa; if (xa > x1a) x1a = xa; if (ya < y0a) y0a = ya; if (ya > y1a) y1a = ya;
        for (var dy2 = -1; dy2 <= 1; dy2++) for (var dx2 = -1; dx2 <= 1; dx2++) { var nx3 = xa + dx2, ny3 = ya + dy2; if (nx3 < 0 || ny3 < 0 || nx3 >= w || ny3 >= h) continue; var qa = ny3 * w + nx3; if (isAdd[qa] && wall[qa] && !seenA[qa]) { seenA[qa] = 1; stA.push(qa); } } }
      var bwA = x1a - x0a + 1, bhA = y1a - y0a + 1, hor = bwA >= bhA, len = hor ? bwA : bhA, thick = hor ? bhA : bwA; if (len < U * 0.45 || thick > U * 0.6 || len < thick * 2) continue;
      var cxA = (x0a + x1a) / 2, cyA = (y0a + y1a) / 2, off = thick / 2 + Math.max(4, U * 0.22);
      wins.push({ x1: (hor ? x0a : cxA) / s, y1: (hor ? cyA : y0a) / s, x2: (hor ? x1a + 1 : cxA) / s, y2: (hor ? cyA : y1a + 1) / s, a: [(hor ? cxA : cxA - off) / s, (hor ? cyA - off : cyA) / s], b: [(hor ? cxA : cxA + off) / s, (hor ? cyA + off : cyA) / s] }); }
    found.창선 = wins;
    return found;
  }
  function analyze(src, opt) {
    opt = opt || {}; var step0 = opt.onStep || function () {}, step = function (t) { step0('집지니가 ' + t); }, A;   // 안내 문구는 모두 「집지니가 …하고 있습니다」
    return needAuto().then(function () { A = root.JJPlanAuto; return toImage(src); }).then(function (img) {
      var NW = img.naturalWidth || img.width, NH = img.naturalHeight || img.height; if (!NW || !NH) return { ok: false, why: '그림을 읽지 못했습니다.' };
      var K = Math.min(1, 1600 / Math.max(NW, NH)), W = Math.round(NW * K), H = Math.round(NH * K), keep = document.createElement('canvas'); keep.width = W; keep.height = H;
      var kg = keep.getContext('2d'); kg.fillStyle = '#fff'; kg.fillRect(0, 0, W, H); kg.drawImage(img, 0, 0, W, H); var dataUrl = keep.toDataURL('image/jpeg', 0.86);
      step('도면의 글자와 치수를 읽고 있습니다');
      var ocrJob = opt.ocr === false ? Promise.resolve([]) : readTextScaled(keep).catch(function () { return null; });
      return ocrJob.then(function (items) {
        if (items && items.length) items = mergeLines(items);
        var clean = keep, seedJob = Promise.resolve();
        if (items && items.length) { clean = document.createElement('canvas'); clean.width = W; clean.height = H; var cg = clean.getContext('2d'); cg.drawImage(keep, 0, 0); cg.fillStyle = '#fff';
          items.forEach(function (it) { cg.fillRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4); }); }
        step('도면에서 방을 나누고 있습니다');
        var base = A.analyzeImage(clean, { areaM2: opt.areaM2 }); base.dataUrl = dataUrl; base.W = W; base.H = H;
        // 방 이름이 3곳 이상 읽히면 글자 기준 나누기가 우선 (부동산 사이트 도면)
        if (items && items.length) { var seeded = null; try { seeded = seedRooms(clean, items, W, H, opt.areaM2); } catch (e) { if (root.JJ_PLAN_DEBUG) console.error(e); seeded = null; }
          if (seeded) { var mk = function () { base = A.finalize(seeded, W, H, dataUrl, opt.areaM2, '글자 기준'); base.wallPx = seeded.wallPx; base.창선 = seeded.창선; }; mk();
            var blind = seeded.filter(function (f) { return f.guess; }).sort(function (a, b) { return b.px - a.px; }).slice(0, 5);
            if (blind.length) { step('이름이 안 읽힌 칸을 다시 읽고 있습니다'); seedJob = blind.reduce(function (pr, f) { return pr.then(function () { return readRegion(keep, f).then(function (k) { if (k) { f.kind = k.kind; f.nm = k.nm; f.guess = false; items.push(k.item); } }, function () {}); }); }, Promise.resolve()).then(mk); } } }
        return seedJob.then(aiReady).then(function (ai) { if (!ai) return null; step('벽·문·창 자리를 읽고 있습니다'); return aiAnalyze(ai, clean).catch(function () { return null; }); }).then(function (aiRes) {
          if (aiRes && aiRes.found.length >= 2) { base = A.finalize(aiRes.found, W, H, dataUrl, opt.areaM2, '학습'); base.문 = aiRes.문; base.창 = aiRes.창; }
          if (!base.ok || !items || !items.length) { if (base.ok) { base.글자 = { 개수: 0, 방이름: 0, 치수: [], 실패: items === null }; try { var fr = base.rooms.map(function (r) { return { pts: r.pts, px: r.px, kind: r.kind, nm: r.nm }; }); squareUp(fr); var b2 = A.finalize(fr, W, H, dataUrl, opt.areaM2, base.engine); b2.글자 = base.글자; base = b2; } catch (_q) {} } return base; }
          return refine(base, items, opt.areaM2);
        });
      });
    }).catch(function (e) { return { ok: false, why: (e && e.message) || '도면을 읽지 못했습니다.' }; });
  }
  /** 이름이 안 읽힌 칸 하나만 잘라 크게(어두운 바탕이면 뒤집어) 다시 읽는다 → { kind, nm, item } | null */
  function readRegion(cv, f) {
    var xs = f.pts.map(function (p) { return p[0]; }), ys = f.pts.map(function (p) { return p[1]; }), x0 = Math.max(0, Math.min.apply(null, xs)), y0 = Math.max(0, Math.min.apply(null, ys)), x1 = Math.min(cv.width, Math.max.apply(null, xs)), y1 = Math.min(cv.height, Math.max.apply(null, ys)), bw = x1 - x0, bh = y1 - y0;
    if (bw < 16 || bh < 12) return Promise.resolve(null);
    var k = Math.max(1, Math.min(5, 900 / Math.max(bw, bh))), c = document.createElement('canvas'); c.width = Math.round(bw * k); c.height = Math.round(bh * k); var g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, x0, y0, bw, bh, 0, 0, c.width, c.height);
    var d = g.getImageData(0, 0, c.width, c.height), a = d.data, sum = 0, i; for (i = 0; i < a.length; i += 16) sum += (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000; var mean = sum / (a.length / 16);
    // 바탕과 글자를 벌린다: 어두운 바탕(현관 타일)은 뒤집고, 밝기만 남겨 대비를 키운다
    for (i = 0; i < a.length; i += 4) { var v = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000; if (mean < 125) v = 255 - v; v = Math.max(0, Math.min(255, (v - 128) * 1.6 + 128)); a[i] = a[i + 1] = a[i + 2] = v; } g.putImageData(d, 0, 0);
    return ocrService().then(function (svc) { return svc.recognize(c, { flatten: true }); }).then(function (r) {
      var hit = null; (r.results || []).forEach(function (t) { if (hit || !(t.confidence >= 0.5) || !t.text) return; var tx = String(t.text).trim(); for (var q = 0; q < KW.length; q++) if (KW[q][0].test(tx)) { hit = { kind: KW[q][1], nm: nmOf(tx), item: { text: tx, x: x0 + t.box.x / k, y: y0 + t.box.y / k, w: t.box.width / k, h: t.box.height / k, v: false, conf: t.confidence } }; break; } });
      return hit; });
  }
  // 작은 글자를 위해 긴 변이 1800 보다 작으면 키워서 읽고 좌표를 되돌린다
  function readTextScaled(cv) {
    var m = Math.max(cv.width, cv.height), f = m < 2600 ? Math.min(m < 800 ? 4 : 2.5, 2600 / m) : 1;   // 작은 그림(네이버·부동산114 미리보기, 600 안팎)은 4배까지 if (f <= 1.05) f = 1;   // 방 이름 글자가 작아서 긴 변 2600 까지 키워 읽는다
    var up = document.createElement('canvas'); up.width = Math.round(cv.width * f); up.height = Math.round(cv.height * f); var g = up.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, up.width, up.height);
    var bw = document.createElement('canvas'); bw.width = up.width; bw.height = up.height; var bg = bw.getContext('2d'); bg.drawImage(up, 0, 0); var d = bg.getImageData(0, 0, bw.width, bw.height), a = d.data;
    for (var i = 0; i < a.length; i += 4) { var v = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000 < 110 ? 0 : 255; a[i] = a[i + 1] = a[i + 2] = v; } bg.putImageData(d, 0, 0);
    var isName = function (t) { for (var k = 0; k < KW.length; k++) if (KW[k][0].test(t)) return true; return false; };
    return readText(up).then(function (items) {
      return readText(bw).then(function (more) {   // 같은 자리 글자는 방 이름으로 읽힌 쪽을 남긴다
        more.forEach(function (t) { var hit = -1; for (var k = 0; k < items.length; k++) { var q = items[k]; if (Math.abs((q.x + q.w / 2) - (t.x + t.w / 2)) < Math.max(q.w, t.w) * 0.6 && Math.abs((q.y + q.h / 2) - (t.y + t.h / 2)) < Math.max(q.h, t.h) * 0.8) { hit = k; break; } }
          if (hit < 0) items.push(t); else if (!isName(items[hit].text) && isName(t.text)) items[hit] = t; });
        return items; }, function () { return items; });
    }).then(function (items) { items.forEach(function (it) { it.x /= f; it.y /= f; it.w /= f; it.h /= f; }); return items; });
  }

  /** 기울어진 사진 바로잡기: 네 모서리를 끌어 맞추면 반듯하게 편 그림(canvas)을 돌려준다. 취소하면 null */
  function fixPhoto(src) {
    return Promise.all([vendor(), toImage(src)]).then(function (r) {
      var V = r[0], img = r[1];
      return new Promise(function (ok) {
        var bg = document.createElement('div'); bg.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(20,22,26,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px';
        bg.innerHTML = '<div style="color:#fff;font-size:14px;margin-bottom:8px;text-align:center">도면의 네 모서리에 점을 맞춘 뒤 확인을 눌러 주세요</div><div id="jjFixHost" style="width:min(94vw,820px);height:min(70vh,640px);background:#111;border-radius:10px;overflow:hidden"></div><div style="margin-top:10px"><button type="button" id="jjFixNo" style="padding:10px 18px;border-radius:8px;border:1px solid #777;background:transparent;color:#ddd;font-size:14px;cursor:pointer">그대로 쓰기</button></div>';
        document.body.appendChild(bg); var ed = null, done = function (v) { try { if (ed) ed.destroy(); } catch (e) {} bg.remove(); ok(v); };
        bg.querySelector('#jjFixNo').addEventListener('click', function () { done(null); });
        var start = function (corners) { try { ed = V.scanic.createCornerEditor({ container: bg.querySelector('#jjFixHost'), image: img, corners: corners || undefined, onConfirm: function (c) { V.scanic.extractDocument(img, c, { output: 'canvas' }).then(function (x) { done(x && x.output ? x.output : null); }).catch(function () { done(null); }); }, onCancel: function () { done(null); } }); } catch (e) { done(null); } };
        try { V.scanic.scanDocument(img).then(function (s) { start(s && s.success ? s.corners : null); }).catch(function () { start(null); }); } catch (e) { start(null); }
      });
    }).catch(function () { return null; });
  }
  root.JJPlanTools = { analyze: analyze, fixPhoto: fixPhoto, readText: readText, refine: refine, aiReady: aiReady, vendor: vendor, _components: components, _contour: contour, version: '2026-11-10' };
})(typeof window !== 'undefined' ? window : this);
