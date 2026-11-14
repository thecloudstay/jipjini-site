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
  var KW = [[/^(A\.?D|P\.?D|P\.?S|E\.?P\.?S|T\.?P\.?S)(\s*[&·\/]\s*(A\.?D|P\.?D|P\.?S))?$|피트|덕트|^PIT$/i, '피트'], [/거\s*[실설]|가족실|living/i, '거실'], [/[침칩템]\s*실|^심1\d$|안\s*방|^방\s*\d|bed\s*room|^room/i, '방'], [/[욕옥]\s*[실스]|^요스$|화장실|bath|toilet|^w\.?c/i, '욕실'], [/[발빌밥필]\s*코\s*[니나]|베란다|다용도|테\s*라\s*[스쓰]|옥상\s*정원|balcony|terrace/i, '발코니'], [/실외기/i, '실외기실'],
    [/주\s*방|식\s*당|kitchen|dining/i, '주방'], [/[현협]\s*관|entrance/i, '현관'], [/드레스|파우더|dress/i, '드레스룸'], [/팬트리|창고|알파|세탁|보일러|대피|pantry/i, '기타']];
  // 조정값(2026-11-11): 대표 컴퓨터의 자동 조정기(plan_tune.py)가 window.JJ_PLAN_TUNE 으로 숫자를 바꿔 시험한다. 없으면 여기 적힌 기본값 그대로.
  function tv(k, dflt) { var T = root.JJ_PLAN_TUNE, v = T ? T[k] : null; return typeof v === 'number' && isFinite(v) ? v : dflt; }
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
    found.forEach(function (f) { if (!f.pts || f.pts.length <= 4) return; var B = bbx(f.pts), ba = (B[2] - B[0]) * (B[3] - B[1]); if (ba <= 0 || areaOf(f.pts) < ba * tv('rectFill', 0.84)) return;
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
    var cand = [], keep = [];   // keep: 읽힌 치수 줄 그대로(다시 그릴 때 원본 치수를 그대로 쓴다)
    [false, true].forEach(function (V) { var L = ds.filter(function (d) { return d.v === V; }).sort(function (a, b) { return a.o - b.o || a.c - b.c; }), rows = [];
      L.forEach(function (d) { var r = rows[rows.length - 1]; if (r && Math.abs(r[0].o - d.o) <= Math.max(r[0].t, d.t) * 0.8) r.push(d); else rows.push([d]); });
      rows.forEach(function (r) { r.sort(function (a, b) { return a.c - b.c; }); keep.push({ v: V, o: r.reduce(function (s3, q) { return s3 + q.o; }, 0) / r.length, d: r.map(function (q) { return { n: q.n, c: q.c }; }) }); for (var i = 0; i + 1 < r.length; i++) { var dpx = r[i + 1].c - r[i].c; if (dpx > 12) cand.push((r[i].n + r[i + 1].n) / 2 / dpx); } }); });
    if (cand.length < 2) return { mm: 0, n: cand.length, rows: keep };
    cand.sort(function (a, b) { return a - b; }); var med = cand[cand.length >> 1], ok = cand.filter(function (c) { return Math.abs(c - med) / med <= 0.1; });
    return ok.length >= 2 && ok.length >= cand.length * 0.5 ? { mm: ok.reduce(function (s2, c) { return s2 + c; }, 0) / ok.length, n: ok.length, rows: keep } : { mm: 0, n: 0, rows: keep };
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
    // 2026-11-11 저녁: 전용면적 어림 — 방 안쪽 넓이만 더한 「실내 합」은 칸막이벽이 빠져 전용면적보다 늘 10% 남짓 작다(채점 150장 중 35장이 이 차이로 틀림). 전용면적과 견줄 값은 벽 몫을 더해 따로 낸다.
    if (out.sum && fix) out.sum.전용추정 = Math.round((innerPx + 0.4 * (base.wallPx || 0)) * fix * fix / 1e5) / 10;
    out.rooms.forEach(function (r) { for (var q = 0; q < found.length; q++) if (found[q].pts === r.pts && found[q].areaTxt) r.areaTxt = found[q].areaTxt; });
    out.글자 = { 개수: items.length, 방이름: named, 치수: dims.map(function (d) { return d.n; }).sort(function (a, b) { return b - a; }).slice(0, 12) }; out.척도 = sc; (out.shapes || []).forEach(function (sh) { if (sh.t === 'scale') sh.by = sc.방식; }); if (base.wallPx) out.wallPx = base.wallPx; if (base.외곽) out.외곽 = base.외곽; if (chain && chain.mm && chain.rows && chain.rows.length) out.치수줄 = chain.rows;   // 2026-11-11 원본에 적힌 치수 줄(다시 그릴 때 그 숫자 그대로)
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
        return Promise.all(jobs).then(function (s) { AI = (s[0] || s[1]) ? { spa: s[0], str: s[1], size: mf.size || 512, ver: mf.ver || '', norm: mf.norm || '', map: mf.strMap || { wall: 1, door: 2, window: 3 } } : null; return AI; }); });
    }).catch(function () { AI = null; return null; });
  }
  function segment(sess, canvas, S, norm) {   // 정사각 S 로 흰 여백을 두고 줄여 넣고(학습 때와 같은 방식) 화소별 분류 번호를 돌려준다
    var V = root.JJVendor, W = canvas.width, H = canvas.height, k = S / Math.max(W, H), nw = Math.max(1, Math.round(W * k)), nh = Math.max(1, Math.round(H * k)), ox = (S - nw) >> 1, oy = (S - nh) >> 1;
    var c = document.createElement('canvas'); c.width = S; c.height = S; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.drawImage(canvas, ox, oy, nw, nh);
    var d = g.getImageData(0, 0, S, S).data, N = S * S, x = new Float32Array(3 * N); if (norm === 'imagenet') { for (var i0 = 0; i0 < N; i0++) { x[i0] = (d[i0 * 4] / 255 - 0.485) / 0.229; x[N + i0] = (d[i0 * 4 + 1] / 255 - 0.456) / 0.224; x[2 * N + i0] = (d[i0 * 4 + 2] / 255 - 0.406) / 0.225; } } else for (var i = 0; i < N; i++) { x[i] = d[i * 4] / 127.5 - 1; x[N + i] = d[i * 4 + 1] / 127.5 - 1; x[2 * N + i] = d[i * 4 + 2] / 127.5 - 1; }
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
  // 거의 가로·세로인 변만 반듯하게 맞춘다(기울기가 tol 보다 작은 변). 사선 변은 그대로 — 외곽선용
  function axisSnap(p, tol) { var n = p.length, q = p.map(function (a) { return [a[0], a[1]]; }), i, j;
    for (i = 0; i < n; i++) { j = (i + 1) % n; var dx = Math.abs(q[j][0] - q[i][0]), dy = Math.abs(q[j][1] - q[i][1]); if (dx <= dy * tol) { var mx = (q[i][0] + q[j][0]) / 2; q[i][0] = mx; q[j][0] = mx; } }
    for (i = 0; i < n; i++) { j = (i + 1) % n; var dx2 = Math.abs(q[j][0] - q[i][0]), dy2 = Math.abs(q[j][1] - q[i][1]); if (dy2 <= dx2 * tol) { var my = (q[i][1] + q[j][1]) / 2; q[i][1] = my; q[j][1] = my; } }
    var out = []; for (i = 0; i < n; i++) { var a = q[(i + n - 1) % n], b = q[i], c = q[(i + 1) % n], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01 || Math.abs(cr) < 0.02 * Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])) continue; out.push(b); }
    return out.length >= 4 ? out : q; }
  function tidy(pts, eps) {   // 다각형 연산 도구로 꼭짓점 정리(자기 교차 제거 포함). 도구가 없으면 원본
    try { var C = root.JJVendor.clipper.Clipper, path = pts.map(function (p) { return { x: Math.round(p[0] * 100), y: Math.round(p[1] * 100) }; });
      var simp = C.simplifyPath ? C.simplifyPath(path, eps * 100, true) : path, u = C.union([simp], root.JJVendor.clipper.FillRule.NonZero), best = null, ba = 0;
      (u || []).forEach(function (q) { var a = Math.abs(C.area(q)); if (a > ba) { ba = a; best = q; } });
      if (best && best.length >= 3) return best.map(function (q) { return [q.x / 100, q.y / 100]; }); } catch (e) {}
    return pts;
  }
  function aiAnalyze(ai, canvas) {
    var S = ai.size, W = canvas.width, H = canvas.height, K = Math.min(1, 1600 / Math.max(W, H));
    // 2026-11-13 자체 모델이 빠른 판에서 84.8→35.1 로 진 원인: 학습 때는 이미지넷 정규화로 넣었는데 여기선 정규화 없이(0~1) 넣고 있었다 → 매니페스트 norm 을 그대로 넘긴다.
    //   구조 분류 번호도 매니페스트 strMap 을 따른다(선생 모델은 벽2·문3·창4, 자체 모델은 벽1·문2·창3).
    var MP = ai.map || { wall: 1, door: 2, window: 3 };
    return (ai.str ? segment(ai.str, canvas, S, ai.norm) : Promise.resolve(null)).then(function (st) {
      return (ai.spa ? segment(ai.spa, canvas, S, ai.norm) : Promise.resolve(null)).then(function (sp) {
        var doors = [], wins = [];
        var back = function (seg, x, y) { return [(x - seg.ox) / seg.k, (y - seg.oy) / seg.k]; };
        if (st) { var cs = components(st.cls, st.w, st.h, function (c) { return c === MP.door || c === MP.window; }, 6);
          cs.list.forEach(function (o) { var a = back(st, o.x0, o.y0), b = back(st, o.x1 + 1, o.y1 + 1), horiz = (b[0] - a[0]) >= (b[1] - a[1]);
            var seg = horiz ? { x1: a[0], y1: (a[1] + b[1]) / 2, x2: b[0], y2: (a[1] + b[1]) / 2 } : { x1: (a[0] + b[0]) / 2, y1: a[1], x2: (a[0] + b[0]) / 2, y2: b[1] }; seg.box = [a[0], a[1], b[0], b[1]]; (o.c === MP.door ? doors : wins).push(seg); });
          // 문 자리를 공간 분류 그림에서 지워, 문이 열려 이어진 방을 끊는다
          if (sp && sp.w === st.w && sp.h === st.h) for (var i = 0; i < st.cls.length; i++) if (st.cls[i] === MP.wall || st.cls[i] === MP.door) sp.cls[i] = 0; }
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
  // 2026-11-11 섞어 쓰기: 학습 인식기(벽·문·창)가 찾은 문 자리를 원본 좌표 네모 목록으로 돌려준다 → seedRooms 가 그 자리를 벽으로 막는다
  function doorBoxes(st, map) { var cs = components(st.cls, st.w, st.h, function (c) { return c === map.door; }, 2); return cs.list.map(function (o) { return [(o.x0 - st.ox) / st.k, (o.y0 - st.oy) / st.k, (o.x1 + 1 - st.ox) / st.k, (o.y1 + 1 - st.oy) / st.k]; }); }
  function seedRooms(canvas, items, W, H, areaM2, thin, doors) {   // thin: 벽이 가는 선(1~2화소)인 도면 — 굵은 선 고르기를 건너뛴다
    var seeds0 = []; items.forEach(function (it) { for (var i = 0; i < KW.length; i++) if (KW[i][0].test(it.text)) { seeds0.push({ x: it.x + it.w / 2, y: it.y + it.h / 2, kind: KW[i][1], text: it.text }); break; } });
    if (seeds0.length < 2) return null;   // 2026-11-11 이름이 2곳만 읽힌 소형 평면(거실·침실)도 글자 기준으로 나눈다 — 이름 없는 칸은 아래에서 씨앗이 더해지고, 끝에서 공간이 3곳 미만이면 그만둔다
    var s = Math.max(W, H) < 560 ? Math.min(2, tv('res', 640) / Math.max(W, H)) : Math.min(1, tv('res', 640) / Math.max(W, H)), w = Math.max(32, Math.round(W * s)), h = Math.max(32, Math.round(H * s)), N = w * h;
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(canvas, 0, 0, w, h);
    var d = g.getImageData(0, 0, w, h).data, dark = new Uint8Array(N), line = new Uint8Array(N), lineL = new Uint8Array(N), sat = new Uint8Array(N), i, x, y;
    var tDark = tv('wallDark', 96), tSat = tv('wallSat', 60);
    for (i = 0; i < N; i++) { var r0c = d[i * 4], g0c = d[i * 4 + 1], b0c = d[i * 4 + 2], v = (r0c * 299 + g0c * 587 + b0c * 114) / 1000, mx = Math.max(r0c, g0c, b0c), mn = Math.min(r0c, g0c, b0c); dark[i] = (v < tDark && (mx - mn) < tSat) ? 1 : 0; line[i] = (v < 175 && (mx - mn) < 70) ? 1 : 0; lineL[i] = (v < 208 && (mx - mn) < 40) ? 1 : 0; sat[i] = mx - mn; }   // 벽 = 어둡고 색이 없는 선 (짙은 갈색 마루·현관 타일은 벽이 아님)
    // 굵은 선만: 3×3 깎기 → 두 번 불리기
    var er = new Uint8Array(N), wall = new Uint8Array(N);
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; if (dark[i] && dark[i - 1] && dark[i + 1] && dark[i - w] && dark[i + w]) er[i] = 1; }
    var cur = er; for (var pass = 0; pass < 2; pass++) { var nx2 = new Uint8Array(N); for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { i = y * w + x; if (cur[i] || cur[i - 1] || cur[i + 1] || cur[i - w] || cur[i + w]) nx2[i] = dark[i] || pass === 0 ? 1 : 0; } cur = nx2; }
    wall = thin ? dark.slice() : cur;   // 2026-11-11 가는 벽선 도면(소형 평면·축소 그림): 깎으면 벽이 다 사라져 「규칙」 방식으로 떨어지고 거실·침실이 한 덩어리가 됐다(시험 50곳의 한원힐트리움 45점)
    // 점 같은 검은 덩어리(수전·배수구·타일 줄눈 교차점)는 벽이 아니다 — 남겨 두면 작은 방 가운데가 「벽 근처」가 되어 씨앗이 안 생긴다
    var U0 = 40;
    (function () { var bxa = w, bxb = 0, bya = h, byb = 0, k; for (k = 0; k < N; k++) if (wall[k]) { var xx = k % w, yy = (k / w) | 0; if (xx < bxa) bxa = xx; if (xx > bxb) bxb = xx; if (yy < bya) bya = yy; if (yy > byb) byb = yy; }
      U0 = Math.sqrt(Math.max(1, (bxb - bxa) * (byb - bya)) * 0.8 / ((Number(areaM2) || 84) * 1.3)); var lim = Math.max(10, U0 * U0 * 0.03), seenW = new Uint8Array(N);
      for (k = 0; k < N; k++) { if (!wall[k] || seenW[k]) continue; var st = [k], comp = [k]; seenW[k] = 1;
        while (st.length) { var p = st.pop(), px = p % w, py = (p / w) | 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; var q2 = ny * w + nx; if (wall[q2] && !seenW[q2]) { seenW[q2] = 1; st.push(q2); comp.push(q2); } } }
        if (comp.length < (thin ? Math.max(lim, U0 * 2.2) : lim)) comp.forEach(function (q3) { wall[q3] = 0; }); } })();   /* 가는 선 도면에서는 기구(변기·세면대) 테두리가 벽으로 남지 않게 더 긴 선만 벽으로 본다 */
    // 창: 굵은 벽 사이 틈을 가는 선이 벽 방향으로 잇고 있으면(틈 길이의 70% 이상) 그 틈을 벽으로 메운다 — 방과 발코니가 넓은 창으로 한 덩어리가 되는 것을 막는다
    var bridge = function (horizontal) { var L1 = horizontal ? h : w, L2 = horizontal ? w : h, idx = function (a, b2) { return horizontal ? a * w + b2 : b2 * w + a; }, maxGap = Math.round(L2 * 0.45), minRun = Math.max(10, Math.round(U0 * 0.32)), band = Math.max(1, Math.round(U0 * 0.1));   // 「길게 이어진 벽」은 벽 두께(약 0.2m)보다 확실히 길어야 한다 — 짧으면 타일 줄눈마다 메워져 욕실·발코니가 통째로 벽이 된다 (실전 시나리오 S01 에서 발견)
      for (var a = 1; a < L1 - 1; a++) { var runs = [], st = -1; for (var b2 = 0; b2 <= L2; b2++) { var on = b2 < L2 && wall[idx(a, b2)]; if (on && st < 0) st = b2; else if (!on && st >= 0) { runs.push([st, b2 - 1]); st = -1; } }
        for (var r = 0; r + 1 < runs.length; r++) { var g0 = runs[r][1] + 1, g1 = runs[r + 1][0] - 1, gap = g1 - g0 + 1; if (gap < 3 || gap > maxGap) continue;
          // 양쪽 벽 가운데 적어도 한쪽이 이 방향으로 길게 이어진 벽이어야 한다(창은 벽의 연장선 위에 있다) — 방 안의 타일 줄눈은 양 끝이 가로지르는 벽이라 제외된다
          var lenA = runs[r][1] - runs[r][0] + 1, lenB = runs[r + 1][1] - runs[r + 1][0] + 1, oneLong = lenA >= minRun || lenB >= minRun, bothLong = lenA >= minRun && lenB >= minRun; if (!oneLong) continue;
          // 창 선은 벽 가운데가 아니라 옆으로 비껴 그려진다 → 벽 두께 안쪽 띠에서, 「한 줄로 이어진」 선을 찾는다(띠 전체를 합치면 타일 줄눈이 다 걸린다).
          // 짙은 선은 한쪽 벽만 길어도 되고, 네이버식 연한 회색 선은 양쪽이 모두 긴 벽일 때만(연한 타일 줄눈과 구분)
          var bestD = 0, bestL = 0; for (var bo = -band; bo <= band; bo++) { var aa = a + bo; if (aa < 0 || aa >= L1) continue; var cd = 0, cl = 0; for (var t = g0; t <= g1; t++) { var kk3 = idx(aa, t); if (line[kk3] || (aa > 0 && line[idx(aa - 1, t)]) || (aa < L1 - 1 && line[idx(aa + 1, t)])) cd++; if (lineL[kk3]) cl++; }   /* 짙은 선은 이웃 줄까지 합쳐 본다(선이 한 화소쯤 흔들린다) */ if (cd > bestD) bestD = cd; if (cl > bestL) bestL = cl; }
          if (bestD >= gap * 0.7 || (bothLong && bestL >= gap * 0.7)) for (var t2 = g0; t2 <= g1; t2++) add.push(idx(a, t2)); } } };
    var add = []; bridge(true); bridge(false); add.forEach(function (k) { wall[k] = 1; });
    // 문 틈 막기(2026-11-11): 학습 인식기가 문이라고 본 자리에, 양 끝이 벽에 닿을 때만 벽을 한 줄 긋는다 — 문으로 이어진 욕실·방이 따로 나뉜다
    var doorOut = [];   // 문 자리(2026-11-12): 막음 선을 그은 자리를 문으로 내보낸다 — 평면에 문 기호를 그리는 데 쓴다
    var doorN = 0; (doors || []).forEach(function (b) { var x0 = Math.round(b[0] * s), y0 = Math.round(b[1] * s), x1 = Math.round(b[2] * s), y1 = Math.round(b[3] * s), reach = Math.max(4, Math.round(U0 * tv('doorReach', 0.9))), best = null;
      // 문 네모 안팎에서, 벽에서 벽까지 가장 짧게 가로지르는 줄(가로 또는 세로)을 찾는다
      var tryLine = function (hz, c) { var lo = hz ? x0 : y0, hi = hz ? x1 : y1, at = function (t) { return hz ? c * w + t : t * w + c; }, lim = hz ? w : h, a = Math.round((lo + hi) / 2), z = a; if (c < 1 || c >= (hz ? h : w) - 1 || wall[at(a)]) return;
        while (a > 0 && !wall[at(a)] && (lo - a) <= reach) a--; while (z < lim - 1 && !wall[at(z)] && (z - hi) <= reach) z++; if (!wall[at(a)] || !wall[at(z)]) return; var len = z - a; if (len < 3 || len > U0 * tv('doorLen', 1.6)) return; if (!best || len < best.len) best = { hz: hz, c: c, a: a, z: z, len: len }; };
      for (var cy = y0 - 1; cy <= y1 + 1; cy++) tryLine(true, cy); for (var cx = x0 - 1; cx <= x1 + 1; cx++) tryLine(false, cx);
      if (best) { doorN++; for (var t = best.a; t <= best.z; t++) wall[best.hz ? best.c * w + t : t * w + best.c] = 1;
        // 막음 선은 벽에서 벽까지라 문보다 길 수 있다 → 문으로 내보낼 때는 학습 인식기가 본 문 네모와 겹치는 구간만(문 폭)
        var lo2 = best.hz ? x0 : y0, hi2 = best.hz ? x1 : y1, da = Math.max(best.a, lo2 - 1), dz = Math.min(best.z, hi2 + 1); if (dz - da < 3) { da = best.a; dz = best.z; } best = { hz: best.hz, c: best.c, a: da, z: dz };
        var bcx = (b[0] + b[2]) / 2, bcy = (b[1] + b[3]) / 2; doorOut.push(best.hz ? { x1: Math.round(best.a / s), y1: Math.round(best.c / s), x2: Math.round(best.z / s), y2: Math.round(best.c / s), cx: Math.round(bcx), cy: Math.round(bcy) } : { x1: Math.round(best.c / s), y1: Math.round(best.a / s), x2: Math.round(best.c / s), y2: Math.round(best.z / s), cx: Math.round(bcx), cy: Math.round(bcy) }); } });
    var wc = 0; for (i = 0; i < N; i++) wc += wall[i]; if (wc < N * 0.006 || wc > N * 0.35) return null;   // 굵은 검은 벽이 없는 도면 → 다른 방식으로
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
    seeds0.forEach(function (sd) { var sx = Math.round(sd.x * s), sy = Math.round(sd.y * s), best = -1, bd = 0, R = 6;
      for (var yy = Math.max(1, sy - R); yy <= Math.min(h - 2, sy + R); yy++) for (var xx = Math.max(1, sx - R); xx <= Math.min(w - 2, sx + R); xx++) { var k = yy * w + xx; if (!wall[k] && !lab[k] && dist[k] > bd) { bd = dist[k]; best = k; } }
      if (best < 0) return; var l = seeds.length + 2; seeds.push({ kind: sd.kind, text: sd.text, l: l, p: best }); push(best, l, dist[best]); });
    if (seeds.length < 2) return null;
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
    // 2026-11-11 바닥색으로 경계 바로잡기(네이버 부동산 양식): 거실·주방은 나무 마루(주황), 침실은 연한 노랑, 욕실은 연한 파랑으로 늘 같게 칠한다.
    //   (1) 벽 없이 트인 거실↔침실은 물 채우기 경계가 비스듬히 생긴다 → 노란 바닥은 침실, 마루 바닥은 거실 쪽으로 다시 붙인다.
    //   (2) 샤워 칸막이 같은 가는 선으로 둘로 갈린 파란 칸은 한 욕실로 합친다.
    (function () { var cls = new Uint8Array(N), k, nW = 0, nB = 0; for (k = 0; k < N; k++) { if (lab[k] < 2) continue; var o = k * 4, r = d[o], g2 = d[o + 1], b = d[o + 2];
        if (b - r >= 10 && g2 - r >= 3 && Math.min(r, g2, b) > 185) { cls[k] = 3; nB++; } else if (r > 150 && r - g2 >= 40 && g2 - b >= 25) { cls[k] = 1; nW++; } else if (r > 185 && r - g2 < 40 && g2 - b >= 18 && b < 236) cls[k] = 2; }
      if (nB < N * 0.002 || nW < N * 0.02) return;   // 이 양식이 아니다
      var isBed = function (l) { return kindOf[l] === '방'; }, isLiv = function (l) { return kindOf[l] === '거실' || kindOf[l] === '주방'; };
      var spread = function (want, srcOk, zoneOk) { var q = new Int32Array(N), a0 = 0, a1 = 0, own = new Int32Array(N); for (var i2 = 0; i2 < N; i2++) if (cls[i2] === want && srcOk(lab[i2])) { own[i2] = lab[i2]; q[a1++] = i2; }
        while (a0 < a1) { var p = q[a0++], px = p % w, py = (p / w) | 0, nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1]; for (var b2 = 0; b2 < 4; b2++) { var n = nb[b2]; if (n >= 0 && !own[n] && cls[n] === want && zoneOk(lab[n]) && !wall[n]) { own[n] = own[p]; q[a1++] = n; } } }
        for (var i3 = 0; i3 < N; i3++) if (own[i3]) lab[i3] = own[i3]; };
      var zone = function (l) { return isBed(l) || isLiv(l); };
      spread(2, isBed, zone); spread(1, isLiv, zone);
      // 색을 못 가린 자투리(선·글자 지운 자리)가 남의 방 안에 섬처럼 남으면 둘레에서 가장 많은 이름표를 따른다
      for (var pass = 0; pass < 2; pass++) for (k = w; k < N - w; k++) { var l0 = lab[k]; if (l0 < 2 || !zone(l0) || cls[k]) continue; var ns = [lab[k - 1], lab[k + 1], lab[k - w], lab[k + w]], c = {}, bestL = 0, bc = 0; ns.forEach(function (x) { if (x >= 2 && zone(x)) { c[x] = (c[x] || 0) + 1; if (c[x] > bc) { bc = c[x]; bestL = x; } } }); if (bestL && bestL !== l0 && bc >= 3) lab[k] = bestL; }
      // (1.5) 2026-11-11 낮: 남의 방에 묻힌 파란 칸 떼어 내기 — 문 틈으로 침실·거실과 한 덩어리가 된 욕실(이름 글자 없음)을 바닥색으로 따로 세운다.
      //   고정 표본 60장에서 「모양 겹침」이 34장 틀렸고 그 가운데 욕실 겹침 0%가 여럿(연수1차대림 105 등): 파란 바닥은 있는데 욕실이 한 칸도 안 나왔다.
      (function () { var cT = {}, bT = {}, i4; for (i4 = 0; i4 < N; i4++) { var l4 = lab[i4]; if (l4 >= 2) { cT[l4] = (cT[l4] || 0) + 1; if (cls[i4] === 3) bT[l4] = (bT[l4] || 0) + 1; } }
        var seenB = new Uint8Array(N); for (i4 = 0; i4 < N; i4++) { if (cls[i4] !== 3 || seenB[i4]) continue; var host = lab[i4]; if (host < 2) continue; seenB[i4] = 1; var st4 = [i4], comp4 = [], x0 = w, x1 = 0, y0 = h, y1 = 0;
          while (st4.length) { var p4 = st4.pop(); comp4.push(p4); var px4 = p4 % w, py4 = (p4 / w) | 0; if (px4 < x0) x0 = px4; if (px4 > x1) x1 = px4; if (py4 < y0) y0 = py4; if (py4 > y1) y1 = py4; var nb4 = [px4 > 0 ? p4 - 1 : -1, px4 < w - 1 ? p4 + 1 : -1, py4 > 0 ? p4 - w : -1, py4 < h - 1 ? p4 + w : -1]; for (var b4 = 0; b4 < 4; b4++) { var n4 = nb4[b4]; if (n4 >= 0 && !seenB[n4] && cls[n4] === 3 && lab[n4] === host) { seenB[n4] = 1; st4.push(n4); } } }
          if (kindOf[host] === '욕실' || (bT[host] || 0) >= (cT[host] || 1) * 0.4) continue;      // 이미 욕실이거나 칸 전체가 파랗다
          var bw4 = x1 - x0 + 1, bh4 = y1 - y0 + 1; if (comp4.length < U * U * tv('bathMin', 0.3) || Math.min(bw4, bh4) < U * tv('bathSide', 0.8) || bw4 * bh4 > U * U * tv('bathMax', 12)) continue;   // 창 유리 같은 가는 띠·12㎡ 넘는 덩어리는 욕실이 아니다. 기구 선에 잘려 파란 바닥이 조각나도(0.3㎡부터) 네모 안을 통째로 잡는다
          var nl = seeds.length + 2; seeds.push({ kind: '욕실', text: '', l: nl, p: comp4[0], byColor: true }); kindOf[nl] = '욕실';
          for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) { var q4 = yy * w + xx; if (lab[q4] === host && !wall[q4] && cls[q4] !== 1 && cls[q4] !== 2) lab[q4] = nl; } } })();
      // (1.6) 2026-11-11 저녁: 남의 칸에 묻힌 노란 바닥 → 침실. 방 이름이 안 읽힌 침실이 문 틈으로 주방·거실과 한 덩어리가 되거나 이름 없는 칸(기타)으로 남아 방이 하나 모자랐다
      //   (채점 3단계 150장 중 정답이 분명한 방 개수 틀림 9장 가운데 6장이 「하나 모자람」: 주방이 16~22㎡로 부풀거나 9㎡짜리 「기타」가 따로 있었다). 네이버 양식에서 연노랑 바닥은 침실이다.
      (function () { var cT6 = {}, yT6 = {}, i6; for (i6 = 0; i6 < N; i6++) { var l6 = lab[i6]; if (l6 >= 2) { cT6[l6] = (cT6[l6] || 0) + 1; if (cls[i6] === 2) yT6[l6] = (yT6[l6] || 0) + 1; } }
        var seen6 = new Uint8Array(N), minA = U * U * tv('bedMin', 7), minS = U * tv('bedSide', 2.1);
        for (i6 = 0; i6 < N; i6++) { if (cls[i6] !== 2 || seen6[i6]) continue; var host6 = lab[i6]; if (host6 < 2) continue; seen6[i6] = 1; var st6 = [i6], cp6 = [], x0 = w, x1 = 0, y0 = h, y1 = 0;
          while (st6.length) { var p6 = st6.pop(); cp6.push(p6); var px6 = p6 % w, py6 = (p6 / w) | 0; if (px6 < x0) x0 = px6; if (px6 > x1) x1 = px6; if (py6 < y0) y0 = py6; if (py6 > y1) y1 = py6; var nb6 = [px6 > 0 ? p6 - 1 : -1, px6 < w - 1 ? p6 + 1 : -1, py6 > 0 ? p6 - w : -1, py6 < h - 1 ? p6 + w : -1]; for (var b6 = 0; b6 < 4; b6++) { var n6 = nb6[b6]; if (n6 >= 0 && !seen6[n6] && cls[n6] === 2 && lab[n6] === host6) { seen6[n6] = 1; st6.push(n6); } } }
          if (kindOf[host6] === '방' || kindOf[host6] === '욕실' || kindOf[host6] === '발코니') continue;
          var bw6 = x1 - x0 + 1, bh6 = y1 - y0 + 1; if (cp6.length < minA || Math.min(bw6, bh6) < minS || cp6.length < bw6 * bh6 * 0.6) continue;
          var whole = cp6.length >= (cT6[host6] || 1) * 0.7;      // 그 칸이 통째로 노랗다(이름 없는 칸·알파룸) → 칸 전체를 침실로
          if (whole) { kindOf[host6] = '방'; for (var s6 = 0; s6 < seeds.length; s6++) if (seeds[s6].l === host6) { seeds[s6].kind = '방'; seeds[s6].byColor = true; } continue; }
          var nl6 = seeds.length + 2; seeds.push({ kind: '방', text: '', l: nl6, p: cp6[0], byColor: true }); kindOf[nl6] = '방';
          for (var yy6 = y0; yy6 <= y1; yy6++) for (var xx6 = x0; xx6 <= x1; xx6++) { var q6 = yy6 * w + xx6; if (lab[q6] === host6 && !wall[q6] && cls[q6] !== 1 && cls[q6] !== 3) lab[q6] = nl6; } } })();
      // (1.7) 2026-11-11 오후: 현관 찾기 — 네이버 양식은 현관에 이름을 적지 않고 바닥을 옅은 회색·흰색 바둑판으로 칠한다(고정 표본 60장 중 50장에서 현관 0칸).
      //   무채색이면서 옅은 회색과 흰색이 반반 섞인 자리를 바둑판으로 보고, 가장 큰 덩어리 하나를 현관으로 세운다. 한 가지 회색으로 꽉 찬 칸(대피공간·실외기실)은 반반이 아니라 빠진다.
      (function () { var s5; for (s5 = 0; s5 < seeds.length; s5++) if (seeds[s5].kind === '현관') return;
        var W1 = w + 1, IA = new Int32Array(W1 * (h + 1)), IW = new Int32Array(W1 * (h + 1)), x5, y5;
        for (y5 = 0; y5 < h; y5++) { var ra = 0, rw = 0; for (x5 = 0; x5 < w; x5++) { var o5 = (y5 * w + x5) * 4, r5 = d[o5], g5 = d[o5 + 1], b5 = d[o5 + 2], mx5 = Math.max(r5, g5, b5), mn5 = Math.min(r5, g5, b5);
            if (mx5 - mn5 <= 9) { if (mn5 >= 247) rw++; else if (mn5 >= 220 && mx5 <= 244) ra++; } IA[(y5 + 1) * W1 + x5 + 1] = IA[y5 * W1 + x5 + 1] + ra; IW[(y5 + 1) * W1 + x5 + 1] = IW[y5 * W1 + x5 + 1] + rw; } }
        var R5 = Math.max(4, Math.round(U * tv('hallWin', 0.3))), ck = new Uint8Array(N), box = function (I, xa, ya, xb, yb) { return I[yb * W1 + xb] - I[ya * W1 + xb] - I[yb * W1 + xa] + I[ya * W1 + xa]; };
        var hLo = tv('hallLo', 0.25), hSum = tv('hallSum', 0.8);
        for (y5 = R5; y5 < h - R5; y5++) for (x5 = R5; x5 < w - R5; x5++) { var k5 = y5 * w + x5; if (wall[k5] || cls[k5]) continue; var ar5 = (2 * R5 + 1) * (2 * R5 + 1), fa = box(IA, x5 - R5, y5 - R5, x5 + R5 + 1, y5 + R5 + 1) / ar5, fw = box(IW, x5 - R5, y5 - R5, x5 + R5 + 1, y5 + R5 + 1) / ar5; if (fa >= hLo && fa <= 0.72 && fw >= hLo - 0.03 && fw <= 0.72 && fa + fw >= hSum) ck[k5] = 1; }
        var seen5 = new Uint8Array(N), best5 = null; for (var i5 = 0; i5 < N; i5++) { if (!ck[i5] || seen5[i5]) continue; seen5[i5] = 1; var st5 = [i5], cp = [], a0 = w, a1 = 0, c0 = h, c1 = 0;
          while (st5.length) { var p5 = st5.pop(); cp.push(p5); var px5 = p5 % w, py5 = (p5 / w) | 0; if (px5 < a0) a0 = px5; if (px5 > a1) a1 = px5; if (py5 < c0) c0 = py5; if (py5 > c1) c1 = py5; var nb5 = [px5 > 0 ? p5 - 1 : -1, px5 < w - 1 ? p5 + 1 : -1, py5 > 0 ? p5 - w : -1, py5 < h - 1 ? p5 + w : -1]; for (var b5i = 0; b5i < 4; b5i++) { var n5 = nb5[b5i]; if (n5 >= 0 && ck[n5] && !seen5[n5]) { seen5[n5] = 1; st5.push(n5); } } }
          var bw5 = a1 - a0 + 1, bh5 = c1 - c0 + 1; if (cp.length < U * U * tv('hallMin', 0.35) || Math.min(bw5, bh5) < U * 0.5 || bw5 * bh5 > U * U * tv('hallMax', 9) || cp.length < bw5 * bh5 * 0.35) continue; if (!best5 || cp.length > best5.cp.length) best5 = { cp: cp, x0: a0, x1: a1, y0: c0, y1: c1 }; }
        if (!best5) return; var nl5 = seeds.length + 2; seeds.push({ kind: '현관', text: '', l: nl5, p: best5.cp[0], byColor: true }); kindOf[nl5] = '현관';
        // 창 크기만큼 안쪽으로 깎인 가장자리를 되채운다: 덩어리 네모를 조금 넓혀, 벽이 아니고 바닥색(마루·침실·욕실)이 아닌 무채색 밝은 자리를 현관으로
        var inC = new Uint8Array(N); best5.cp.forEach(function (q) { inC[q] = 1; lab[q] = nl5; });
        for (var g5i = 0; g5i < R5 + 1; g5i++) { var add5 = []; for (y5 = Math.max(1, best5.y0 - R5 - 1); y5 <= Math.min(h - 2, best5.y1 + R5 + 1); y5++) for (x5 = Math.max(1, best5.x0 - R5 - 1); x5 <= Math.min(w - 2, best5.x1 + R5 + 1); x5++) { var q5 = y5 * w + x5; if (inC[q5] || wall[q5] || cls[q5]) continue; if (!(inC[q5 - 1] || inC[q5 + 1] || inC[q5 - w] || inC[q5 + w])) continue; var o6 = q5 * 4; if (Math.max(d[o6], d[o6 + 1], d[o6 + 2]) - Math.min(d[o6], d[o6 + 1], d[o6 + 2]) <= 12 && Math.min(d[o6], d[o6 + 1], d[o6 + 2]) >= 215) add5.push(q5); } add5.forEach(function (q) { inC[q] = 1; lab[q] = nl5; }); } })();
      // (2) 파란 칸 합치기
      var cntL = {}, blueL = {}; for (k = 0; k < N; k++) { var l = lab[k]; if (l >= 2) { cntL[l] = (cntL[l] || 0) + 1; if (cls[k] === 3) blueL[l] = (blueL[l] || 0) + 1; } }
      var isBlue = function (l) { return l >= 2 && (blueL[l] || 0) >= (cntL[l] || 1) * 0.4 && (!kindOf[l] || kindOf[l] === '욕실'); }, adj = {};
      for (k = 0; k < N - w; k++) { var la = lab[k]; if (!isBlue(la)) continue; [k % w < w - 1 ? lab[k + 1] : 0, lab[k + w]].forEach(   /* 바로 맞닿은 칸만 — 두 칸 건너까지 보면 줄인 그림에서 얇은 벽 너머의 다른 욕실과 합쳐져 욕실이 1개로 줄었다(106장 중 4장) */function (lb) { if (lb !== la && isBlue(lb)) { var key = Math.min(la, lb) + '|' + Math.max(la, lb); adj[key] = (adj[key] || 0) + 1; } }); }
      var to = {}, root2 = function (x) { while (to[x]) x = to[x]; return x; }; Object.keys(adj).forEach(function (key) { if (adj[key] < Math.max(4, U * 0.5)) return; var pr = key.split('|'), a = root2(Number(pr[0])), b3 = root2(Number(pr[1])); if (a === b3) return; var named = kindOf[a] ? a : kindOf[b3] ? b3 : ((cntL[a] || 0) >= (cntL[b3] || 0) ? a : b3), other = named === a ? b3 : a; to[other] = named; });
      if (Object.keys(to).length) for (k = 0; k < N; k++) { var l9 = lab[k]; if (to[l9]) lab[k] = root2(l9); } })();
    // (2.45) 2026-11-12 새벽: 이름표 없는 도면(네이버 양식 대부분)은 욕실 이름이 이 뒤 단계(바깥선을 딴 다음)에서야 붙어서, 아래 욕실 넓히기 (2.5)~(2.7)이 통째로 건너뛰어졌다 — 욕조가 빠지던 뿌리.
    //   글자가 없어도 「칸의 40% 넘게 파랗고 크기가 욕실만 한 칸」은 여기서 욕실로 보고 넓히기를 태운다(이름은 붙이지 않는다 — 이름은 뒤 단계가 그대로 정한다).
    var bathLike = {}; (function () { var c = {}, bl = {}, k; for (k = 0; k < N; k++) { var l = lab[k]; if (l < 2) continue; c[l] = (c[l] || 0) + 1; var o = k * 4, r = d[o], g2 = d[o + 1], b = d[o + 2]; if (b - r >= 10 && g2 - r >= 3 && Math.min(r, g2, b) > 185) bl[l] = (bl[l] || 0) + 1; }
      Object.keys(c).forEach(function (l) { if (kindOf[l] === '욕실' || ((!kindOf[l] || kindOf[l] === '기타') && (bl[l] || 0) >= c[l] * 0.4 && c[l] >= U * U * 0.5 && c[l] <= U * U * 8)) bathLike[l] = 1; }); })();
    var isBathL = function (l) { return l >= 2 && bathLike[l] === 1; };
    // (2.5) 2026-11-11 저녁: 욕조·샤워 칸 합치기 — 욕실 안의 욕조·샤워 칸막이 선(가는 선)에 욕실이 둘로 갈려, 한쪽만 욕실로 남고 나머지는 이름 없는 칸이 됐다.
    //   채점 3단계 150장에서 욕실 모양 겹침이 평균 48%(침실 80·마루 79)였고 「욕실 크기 2~9㎡」가 68장 틀렸다. 가는 선(또는 선 없이)으로 욕실과 맞닿은 이름 없는 작은 칸은 그 욕실에 합친다. 굵은 벽 너머의 칸(피트·대피공간)은 그대로 둔다.
    (function () { var cnt = {}, k, share = {}, gap = {}, thinMax = Math.max(2, Math.round(U * tv('tubLine', 0.07))), look = thinMax + 4;
      for (k = 0; k < N; k++) { var l = lab[k]; if (l >= 2) cnt[l] = (cnt[l] || 0) + 1; }
      var cand = function (l) { return l >= 2 && (!kindOf[l] || kindOf[l] === '기타') && (cnt[l] || 0) <= U * U * tv('tubMax', 2.6); }, isBath = isBathL;
      var pass = function (step, lineOf) { for (var p = 0; p < N; p++) { var a = lab[p]; if (a < 2) continue; var q = p + step, t = 0; if (q >= N || lineOf(q) !== lineOf(p)) continue; if (lab[q] === a) continue;
          while (q < N && lineOf(q) === lineOf(p) && lab[q] < 2 && t <= look) { q += step; t++; } if (q >= N || lineOf(q) !== lineOf(p) || t > look) continue; var b = lab[q]; if (b < 2 || b === a) continue;
          var B = isBath(a) && cand(b) ? a : isBath(b) && cand(a) ? b : 0; if (!B) continue; var C = B === a ? b : a, key = B + '|' + C; share[key] = (share[key] || 0) + 1; gap[key] = (gap[key] || 0) + t; } };
      pass(1, function (i) { return (i / w) | 0; }); pass(w, function (i) { return i % w; });
      var to = {}; Object.keys(share).forEach(function (key) { var pr = key.split('|'), B = Number(pr[0]), C = Number(pr[1]); if (to[C]) return; if (share[key] < Math.max(4, U * 0.5) || gap[key] / share[key] > thinMax) return; if ((cnt[B] || 0) + (cnt[C] || 0) > U * U * 9) return; to[C] = B; });
      if (!Object.keys(to).length) return;
      for (k = 0; k < N; k++) { if (to[lab[k]]) lab[k] = to[lab[k]]; }
      // 사이에 있던 가는 선 자리도 욕실로 메운다(양옆이 같은 욕실이면)
      for (var rep2 = 0; rep2 < thinMax; rep2++) for (k = w; k < N - w; k++) { if (lab[k] >= 2) continue; var L1 = lab[k - 1], R1 = lab[k + 1], T1 = lab[k - w], B1 = lab[k + w]; if (isBath(L1) && (R1 === L1 || lab[Math.min(N - 1, k + 2)] === L1)) { lab[k] = L1; wall[k] = 0; } else if (isBath(T1) && (B1 === T1 || lab[Math.min(N - 1, k + 2 * w)] === T1)) { lab[k] = T1; wall[k] = 0; } } })();
    // (2.6) 2026-11-11 밤: 욕실을 벽까지 채우기 — 네이버 양식은 욕실 바닥만 파랗고 변기·세면대·세면대 받침·욕조·문 여는 자리는 희게 그린다.
    //   32장에서 재 보니 파란 바닥은 실제 욕실 넓이의 절반 남짓(벽까지의 넓이 ÷ 파랑 = 1.4~2.4배)이었다. 욕실 모양 겹침이 낮고 「욕실 크기」가 작게 나오는 뿌리다.
    //   욕실 칸에서 흰 자리·가는 선을 타고 번지되, 굵은 벽·다른 바닥색·그림 바깥(가장자리에서 흰색으로 이어진 곳)·이름 있는 방은 넘지 않는다.
    (function () { var k, o, cnt = {}, anyBath = false; for (k = 0; k < N; k++) { var l = lab[k]; if (l >= 2) { cnt[l] = (cnt[l] || 0) + 1; if (isBathL(l)) anyBath = true; } } if (!anyBath) return;
      var T = Math.max(3, Math.round(U * tv('bathWall', 0.09))), cl = new Uint8Array(N);   // 1 흰색 · 2 가는 선(어두움) · 3 흐린 회색 · 4 파랑 · 5 굵은 벽 · 6 다른 바닥색
      for (k = 0; k < N; k++) { o = k * 4; var r = d[o], g2 = d[o + 1], b = d[o + 2], mx = Math.max(r, g2, b), mn = Math.min(r, g2, b); cl[k] = mx < 110 ? 2 : (b - r >= 10 && g2 - r >= 3 && mn > 185) ? 4 : mn > 232 ? 1 : (mx - mn < 14 || (b >= r && mx - mn < 44)) ? 3 : 6; }   /* 가는 선이 파랑·흰색과 섞인 푸르스름한 회색도 선으로 본다(따뜻한 색 = 다른 바닥) */
      // 굵은 벽: 어두운 화소 가운데 가로로도 세로로도 T 화소 넘게 이어진 것
      var runH = new Uint16Array(N), runV = new Uint16Array(N), x, y, i2, c0;
      for (y = 0; y < h; y++) { c0 = 0; for (x = 0; x <= w; x++) { i2 = y * w + x; if (x < w && cl[i2] === 2) c0++; else { for (var q = 1; q <= c0; q++) runH[i2 - q] = c0; c0 = 0; } } }
      for (x = 0; x < w; x++) { c0 = 0; for (y = 0; y <= h; y++) { i2 = y * w + x; if (y < h && cl[i2] === 2) c0++; else { for (var q2 = 1; q2 <= c0; q2++) runV[i2 - q2 * w] = c0; c0 = 0; } } }
      for (k = 0; k < N; k++) if (cl[k] === 2 && Math.min(runH[k], runV[k]) >= T) cl[k] = 5;
      // 그림 바깥: 가장자리에서 흰 화소로만 이어진 곳
      var ext = new Uint8Array(N), st = [], push = function (p) { if (cl[p] === 1 && !ext[p]) { ext[p] = 1; st.push(p); } }; for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (st.length) { var p0 = st.pop(), px0 = p0 % w; if (px0 > 0) push(p0 - 1); if (px0 < w - 1) push(p0 + 1); if (p0 >= w) push(p0 - w); if (p0 < N - w) push(p0 + w); }
      // 문 틈으로 새지 않게: 굵은 벽·다른 바닥색·바깥·다른 욕실을 「막힌 곳」으로 보고, 폭이 1m쯤 안 되는 목(문 틈)은 지나가지 않는다.
      //   (tools10 은 문 틈을 타고 현관까지 삼켜 욕실이 9㎡가 됐다 — A40673924, A10025594)
      var R = Math.max(2, Math.round(U * tv('bathNeck', 0.5))), W1 = w + 1, sat = new Int32Array(W1 * (h + 1)), blk = new Uint8Array(N);
      for (k = 0; k < N; k++) blk[k] = (cl[k] === 5 || cl[k] === 6 || ext[k]) ? 1 : 0;
      for (y = 0; y < h; y++) { var rs = 0; for (x = 0; x < w; x++) { rs += blk[y * w + x]; sat[(y + 1) * W1 + x + 1] = sat[y * W1 + x + 1] + rs; } }
      var clear = function (p) { var px = p % w, py = (p / w) | 0, ax = Math.max(0, px - R), bx = Math.min(w - 1, px + R), ay = Math.max(0, py - R), by = Math.min(h - 1, py + R); return sat[(by + 1) * W1 + bx + 1] - sat[ay * W1 + bx + 1] - sat[(by + 1) * W1 + ax] + sat[ay * W1 + ax] === 0; };
      var donor = function (l) { return l < 2 || !kindOf[l] || /^(기타|거실|주방|복도)$/.test(kindOf[l]); }, labs = Object.keys(cnt).filter(function (l) { return isBathL(Number(l)); });
      labs.forEach(function (ls) { var B = Number(ls), x0 = w, x1 = 0, y0 = h, y1 = 0, qd = [], k2; for (k2 = 0; k2 < N; k2++) if (lab[k2] === B) { var qx = k2 % w, qy = (k2 / w) | 0; if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy; qd.push(k2); }
        var mg = Math.round(Math.sqrt(qd.length) * tv('bathReach', 1.0)); x0 = Math.max(0, x0 - mg); x1 = Math.min(w - 1, x1 + mg); y0 = Math.max(0, y0 - mg); y1 = Math.min(h - 1, y1 + mg);
        var core = [], seen = {}, a0 = 0, base = qd.length, ok = function (n) { return !blk[n] && !isBathL(lab[n]) && donor(lab[n]) && !(cl[n] === 4 && lab[n] >= 2); };
        // ① 넓은 길로만 번진다
        while (a0 < qd.length) { var p = qd[a0++], px = p % w, py = (p / w) | 0, nb = [px > x0 ? p - 1 : -1, px < x1 ? p + 1 : -1, py > y0 ? p - w : -1, py < y1 ? p + w : -1];
          for (var b3 = 0; b3 < 4; b3++) { var n = nb[b3]; if (n < 0 || seen[n] || lab[n] === B) continue; if (!ok(n) || !clear(n)) continue; seen[n] = 1; qd.push(n); core.push(n); } }
        // ② 번진 자리에서 벽 쪽으로 R 만큼만 더 채운다(벽에 붙은 가장자리)
        var got = core.slice(), fr = core.concat(qd.slice(0, base)), dist = {}, a1 = 0; fr.forEach(function (q) { dist[q] = 0; });
        while (a1 < fr.length) { var p2 = fr[a1++], d2 = dist[p2]; if (d2 >= R) continue; var px2 = p2 % w, py2 = (p2 / w) | 0, nb2 = [px2 > x0 ? p2 - 1 : -1, px2 < x1 ? p2 + 1 : -1, py2 > y0 ? p2 - w : -1, py2 < y1 ? p2 + w : -1];
          for (var b4 = 0; b4 < 4; b4++) { var n3 = nb2[b4]; if (n3 < 0 || dist[n3] !== undefined || lab[n3] === B) continue; if (!ok(n3)) continue; dist[n3] = d2 + 1; fr.push(n3); if (!seen[n3]) { seen[n3] = 1; got.push(n3); } } }
        if (!got.length || got.length > base * tv('bathGrow', 2.2) || base + got.length > U * U * tv('bathMax', 9)) return;   // 너무 많이 번지면 샌 것이다 — 그대로 둔다
        got.forEach(function (n2) { lab[n2] = B; wall[n2] = 0; }); });
      // (2.7) 2026-11-12 새벽: 욕조까지 넓히기 — (2.6)은 문 틈으로 새지 않게 「폭 1m 안 되는 목은 안 지나간다」로 막았는데, 욕조도 폭이 0.7m라 같이 막혀 욕조가 빠졌다(원인).
      //   문 틈은 학습 모델·문 찾기가 그어 둔 막음 선(wall 인데 어두운 화소가 아닌 자리)으로 막고, 목 제한 없이 번진다. 새는 것은 세 가지로 거른다:
      //   ① 번진 뒤 넓이가 욕실 크기를 넘으면 버림 ② 번진 자리의 절반 넘게가 흰색(기구·문 여는 자리)이어야 함 ③ 원래 욕실의 1.3배 넘게 늘면 버림.
      var syn = new Uint8Array(N), dbar = new Uint8Array(N); for (k = 0; k < N; k++) if (wall[k] && (cl[k] === 1 || cl[k] === 4 || cl[k] === 6)) syn[k] = 1;   // 문 막음 선: 벽 표시인데 그림에는 선이 없는 자리
      for (k = w; k < N - w; k++) if (syn[k] || (wall[k] && (syn[k - 1] || syn[k + 1] || syn[k - w] || syn[k + w]))) dbar[k] = 1;
      labs.forEach(function (ls) { var B = Number(ls), qd = [], k2, x0 = w, x1 = 0, y0 = h, y1 = 0; for (k2 = 0; k2 < N; k2++) if (lab[k2] === B) { var qx = k2 % w, qy = (k2 / w) | 0; if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy; qd.push(k2); }
        if (!qd.length) return; var base = qd.length, mg = Math.round(Math.sqrt(base) * tv('tubReach', 0.8)); x0 = Math.max(0, x0 - mg); x1 = Math.min(w - 1, x1 + mg); y0 = Math.max(0, y0 - mg); y1 = Math.min(h - 1, y1 + mg);
        var seen = {}, got = [], a0 = 0, white = 0, ok = function (n) { return !blk[n] && !dbar[n] && !isBathL(lab[n]) && donor(lab[n]) && !(cl[n] === 4 && lab[n] >= 2); };
        while (a0 < qd.length) { var p = qd[a0++], px = p % w, py = (p / w) | 0, nb = [px > x0 ? p - 1 : -1, px < x1 ? p + 1 : -1, py > y0 ? p - w : -1, py < y1 ? p + w : -1];
          for (var b3 = 0; b3 < 4; b3++) { var n = nb[b3]; if (n < 0 || seen[n] || lab[n] === B) continue; if (!ok(n)) continue; seen[n] = 1; qd.push(n); got.push(n); if (cl[n] === 1) white++; if (got.length > base * 3) { if (root.JJ_LOG) root.JJ_LOG.push({ t: 'tub-넘침', B: B, base: base }); return; } } }
        if (root.JJ_LOG) root.JJ_LOG.push({ t: 'tub?', B: B, base: Math.round(base / U / U * 10) / 10, got: Math.round(got.length / U / U * 10) / 10, white: Math.round(white / Math.max(1, got.length) * 100) });
        if (got.length < U * U * 0.08 || got.length > base * tv('tubGrow', 0) || base + got.length > U * U * tv('bathMax', 9) || white < got.length * tv('tubWhite', 0.5)) return;
        if (root.JJ_LOG) root.JJ_LOG.push({ t: 'tub', B: B, base: base, got: got.length, white: white });
        got.forEach(function (n2) { lab[n2] = B; wall[n2] = 0; }); }); })();
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
    seeds.forEach(function (sd) { var n = cnt[sd.l] || 0; if (n < minPx) return; var poly; if (bigBox[sd.l]) { var bb4 = bigBox[sd.l]; poly = [[bb4[0], bb4[1]], [bb4[2], bb4[1]], [bb4[2], bb4[3]], [bb4[0], bb4[3]]]; } else { var raw = contour(lab, w, h, { n: sd.l, s: first[sd.l] }); if (raw.length < 6) return; poly = tidy(raw, Math.max(1.5, w / 260)); } if (poly.length < 3) return;
      found.push({ l: sd.l, pts: poly.map(function (pt) { return [Math.round((pt[0] + 0.5) / s), Math.round((pt[1] + 0.5) / s)]; }), px: n / (s * s), kind: sd.kind, text: sd.text, byColor: !!sd.byColor, nm: /가족실/.test(sd.text) ? '가족실' : nmOf(sd.text) }); });
    if (found.length < 3) return null;
    // 이름이 안 읽힌 공간 가리기: 가는 선이 빽빽한 큰 공간(계단·승강기 = 공용부)은 뺀다 / 길쭉하면 발코니 / 욕실 글자가 아예 없는 도면의 작은 칸은 욕실 / 나머지 큰 것은 방, 작은 것은 기타
    var named = found.filter(function (f) { return f.kind; }).map(function (f) { return f.px; }).sort(function (a, b) { return a - b; }), medN = named[named.length >> 1] || 0;
    var anyBath = seeds.some(function (sd) { return sd.kind === '욕실'; }), lineN = {}, satN = {}, whiteN = {}; for (i = 0; i < N; i++) { var l8 = lab[i]; if (l8 >= 2) { if (line[i] && !wall[i]) lineN[l8] = (lineN[l8] || 0) + 1; if (sat[i] > 28) satN[l8] = (satN[l8] || 0) + 1; if (d[i * 4] > 236 && d[i * 4 + 1] > 236 && d[i * 4 + 2] > 236) whiteN[l8] = (whiteN[l8] || 0) + 1; } }
    var anyDoor = seeds.some(function (sd) { return sd.kind === '현관'; });
    found = found.filter(function (f) { if (f.kind) return true; var n = cnt[f.l] || 1, m2r = n / (U * U), ld = (lineN[f.l] || 0) / n, bx = f.pts.map(function (q) { return q[0]; }), by = f.pts.map(function (q) { return q[1]; }), fw = Math.max.apply(null, bx) - Math.min.apply(null, bx), fh = Math.max.apply(null, by) - Math.min.apply(null, by), strip = Math.max(fw, fh) / Math.max(1, Math.min(fw, fh)) >= 3.2;
      var wf = (whiteN[f.l] || 0) / n; f.dbg = [Math.round(m2r * 10) / 10, Math.round(ld * 1000) / 1000, Math.round((satN[f.l] || 0) / n * 100) / 100, Math.round(wf * 100) / 100]; if (m2r >= 9 && ld >= 0.045) return false;   // 공용부
      // 2026-11-14 흑백 분양 평면(답십리 84C): 욕실 글자도 바닥색도 없는 도면에서는 변기·세면대 선 때문에 욕실(3.4~3.6㎡)이 이 「공용부」 규칙에 걸려 통째로 사라졌다(대량 변환 R16 욕실 놓침 194평면).
      //   욕실이 하나도 안 잡힌 도면에서 2.5~6㎡ 칸은 지우지 않고 욕실 후보로 남긴다 — 수가 넘치면 capBath 가 넓이·선 밀도로 추리고, 파란 바닥 도면이면 아래에서 다시 기타로 돌린다.
      if (!f.byColor && m2r >= 2.5 && ld >= 0.06 && wf >= 0.7 && !strip) { if (!anyBath && m2r <= 6 && ld < 0.2) { f.kind = '욕실'; f.guess = true; f.mono = true; return true; } return false; }   // 흰 바탕에 가위표·기계 선이 빽빽한 칸 = 승강기·설비 통로(공용부) — 세대 공간이 아니다 (R-114)
      f.wf = wf; if (!strip && m2r >= 1.5 && m2r <= 7.5 && ld >= 0.05 && wf < 0.6 && (f.byColor || !anyBath)) { f.kind = '욕실'; f.guess = true; return true; }   /* 바탕색이 다른 칸에 기구 선(변기·욕조)이 있으면 욕실 */
      if (f.byColor && !strip && !anyDoor && m2r <= 2.6 && ld < 0.05 && wf < 0.5) { anyDoor = true; f.kind = '현관'; f.guess = true; return true; }   /* 기구 없는 작은 색 칸 = 현관(코디 확인) */
      if (m2r < 1.05 || (m2r < 1.6 && ld >= 0.08)) { f.kind = '피트'; f.nm = '피트'; f.guess = true; return true; }   /* 2026-11-14: 1.1㎡ 피트도 가위표 선이 빽빽하면 피트(답십리 84C) */   /* 벽으로 닫힌 1㎡ 안쪽 작은 칸 = 설비 통로(피트·PD)로 본다 (코디 확인) */
      if (strip) { f.kind = '발코니'; f.guess = true; return true; }
      if (!anyBath && !f.byColor && m2r >= 1.2 && m2r <= 7.5 && (satN[f.l] || 0) / n >= 0.12) { f.kind = '욕실'; f.guess = true; return true; }
      if (!anyDoor && !f.byColor && m2r >= 1.5 && m2r <= 5 && ld < 0.05 && wf >= 0.85) { anyDoor = true; f.kind = '현관'; f.guess = true; return true; }   /* 2026-11-14 흑백 평면: 현관 글자·바둑판 무늬가 없으면 비어 있는 작은 칸 하나를 현관으로(코디 확인) — 답십리 84C 2.9㎡ 가 「방4」로 나오던 것 */
      f.kind = f.px >= medN && m2r >= 4.5 ? '방' : '기타'; f.guess = true; return true; });   // 2026-11-14 4.5㎡ 안 되는 칸을 방으로 세지 않는다
    // 2026-11-11 욕실 바닥색으로 욕실 가리기(네이버 부동산 양식): 이 양식은 욕실 바닥을 늘 같은 연한 파랑(약 228·242·244)으로 칠한다 — 시험 106장 중 103장.
    //   파란 바닥이 있는 도면이면 「파란 칸 = 욕실」이 정답이다. 이름이 안 읽힌 칸을 선 밀도로 욕실이라 어림하던 것(드레스룸·현관·대피공간까지 욕실이 됨)을 이 도면에서는 쓰지 않는다.
    (function () { var blueN = {}, tot = 0, k; for (k = 0; k < N; k++) { var o = k * 4, r = d[o], g2 = d[o + 1], b = d[o + 2]; if (b - r >= 10 && g2 - r >= 3 && Math.min(r, g2, b) > 185) { tot++; var l = lab[k]; if (l >= 2) blueN[l] = (blueN[l] || 0) + 1; } }
      if (tot < N * 0.002) return; var any = 0;
      found.forEach(function (f) { var bf = (blueN[f.l] || 0) / Math.max(1, cnt[f.l] || 1), bfFloor = (blueN[f.l] || 0) / Math.max(1, (cnt[f.l] || 1) - (whiteN[f.l] || 0)); f.blue = bf; if ((bf >= 0.4 || (bf >= 0.15 && bfFloor >= 0.55)) /* 2026-11-14 욕조·변기·세면대(흰색)가 칸의 절반을 덮는 욕실은 파란 바닥이 40% 아래로 나와 「기타」가 됐다(대량 변환 R16 보류 138장 중 다수) — 흰 기구를 뺀 바닥 기준으로도 본다 */ /* 2026-11-13 컴퓨터판 판정을 따름: 「이름 없는 욕실 넓히기」(e9a0260)는 대표 컴퓨터 받아 둔 원본 무작위 25짝에서 −0.6점이라 컴퓨터 도구에서 버린 고침 — 누리집도 같게 */ && (f.guess || !f.kind || f.kind === '욕실')) { if (f.guess) f.nm = undefined; f.kind = '욕실'; f.sure = true; any++; } });
      if (!any) return; found.blueStyle = true;
      found.forEach(function (f) { if (f.kind === '욕실' && f.guess && !f.sure) f.kind = '기타'; }); })();
    found = found.filter(function (f) { return f.kind === '피트' || (cnt[f.l] || 0) / (U * U) >= 0.6; });   // 0.6㎡ 안 되는 이름 붙은 조각(글자 둘레 자투리)은 공간이 아니다
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
    found.창선 = wins; found.문선 = doorOut;
    // 2026-11-11 집 외곽선 먼저 따기: 찾은 공간을 벽 두께만큼 불려 한 덩어리로 잇고(방 사이 벽이 메워진다) 속 구멍을 메운 뒤 가장 큰 덩어리의 바깥선을 딴다.
    //   방마다 따로 직각을 맞추면 방들이 서로 떨어져 「집 모양」이 사라지던 문제 — 외곽선은 방과 별개로 한 줄로 그리고, 사선 벽은 사선 그대로 둔다.
    try { (function () { var inL = {}, m = new Uint8Array(N), k, tt = Math.max(2, Math.round(U * 0.22)); found.forEach(function (f) { inL[f.l] = 1; }); for (k = 0; k < N; k++) if (inL[lab[k]]) m[k] = 1;
      for (var ps = 0; ps < tt; ps++) { var nx5 = new Uint8Array(N); for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) { k = yy * w + xx; if (m[k] || (xx > 0 && m[k - 1]) || (xx < w - 1 && m[k + 1]) || (yy > 0 && m[k - w]) || (yy < h - 1 && m[k + w])) nx5[k] = 1; } m = nx5; }
      var outS = new Uint8Array(N), stO = []; var seedO = function (q) { if (!m[q] && !outS[q]) { outS[q] = 1; stO.push(q); } }; for (xx = 0; xx < w; xx++) { seedO(xx); seedO((h - 1) * w + xx); } for (yy = 0; yy < h; yy++) { seedO(yy * w); seedO(yy * w + w - 1); }
      while (stO.length) { var pO = stO.pop(), xO = pO % w, yO = (pO / w) | 0; if (xO > 0) seedO(pO - 1); if (xO < w - 1) seedO(pO + 1); if (yO > 0) seedO(pO - w); if (yO < h - 1) seedO(pO + w); }
      var ins = new Uint8Array(N); for (k = 0; k < N; k++) ins[k] = outS[k] ? 0 : 1;
      var cc2 = components(ins, w, h, function (c) { return c === 1; }, Math.round(U * U * 4)); if (!cc2.list.length) return; var big = cc2.list.sort(function (a, b) { return b.px - a.px; })[0];
      var raw2 = contour(cc2.lab, w, h, big); if (raw2.length < 8) return; var poly2 = axisSnap(tidy(raw2, Math.max(1.5, w / 260)), 0.14); if (poly2.length < 4) return;
      found.외곽 = poly2.map(function (pt) { return [Math.round((pt[0] + 0.5) / s), Math.round((pt[1] + 0.5) / s)]; }); })(); } catch (_o) {}
    return found;
  }
  // 2026-11-11 욕실 개수 상한: 이름이 안 읽힌 작은 색 칸(드레스룸·현관·대피공간·실외기실)을 모두 욕실로 어림해 욕실이 3~4개로 나왔다(시험 106장 중 44장 감점).
  //   이름이 읽힌 욕실은 그대로 두고, 어림한 욕실은 전용면적에 맞는 개수(50㎡ 미만 1 · 135㎡ 미만 2 · 그 이상 3)까지만 — 기구 선이 많고 2~6㎡ 인 칸부터 — 남기고 나머지는 「기타」로 돌린다.
  function capBath(found, areaM2) {
    if (found.blueStyle) return;   // 욕실 바닥색으로 이미 가렸다
    var m2 = Number(areaM2) || 0, cap = !m2 ? 2 : m2 < 50 ? 1 : m2 < 135 ? 2 : 3, named = 0, guess = [];
    found.forEach(function (f) { if (f.kind !== '욕실') return; if (f.guess) guess.push(f); else named++; });
    var room = Math.max(0, cap - named); if (guess.length <= room) return;
    var score = function (f) { var d = f.dbg || [0, 0], a = d[0], fit = a >= 2 && a <= 6 ? 1 : a >= 1.5 && a <= 7.5 ? 0.5 : 0; return fit * 10 + Math.min(1, (d[1] || 0) / 0.12); };
    guess.sort(function (a, b) { return score(b) - score(a); }).slice(room).forEach(function (f) { f.kind = '기타'; });
  }
  // 2026-11-12 대표 지적 「욕실 기구·주방 기구를 따라 그리는데 전혀 맞지 않는다」: 그림에 그려진 자리를 읽어 그 자리에 그린다(지어서 놓지 않는다).
  //   욕실 칸 안의 흰 덩어리 = 욕조(길쭉하고 큼) · 변기·세면대(작고 둥긂), 주방 칸 안의 흰·연한 회색 긴 띠 = 싱크대 상판. 크기는 척도(mm/화소)로 잰다.
  function fixtures(cv, res) {
    var W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data, mm = res.mmpp, out = [];
    var inPg = function (x, y, P) { var c = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i][1] > y) !== (P[j][1] > y)) && (x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0])) c = !c; } return c; };
    res.rooms.forEach(function (rm) { var kind = rm.kind; if (kind !== '욕실' && kind !== '주방') return; var P = rm.pts; if (!P || P.length < 3) return;
      var xs = P.map(function (q) { return q[0]; }), ys = P.map(function (q) { return q[1]; }), x0 = Math.max(0, Math.floor(Math.min.apply(null, xs))), x1 = Math.min(W - 1, Math.ceil(Math.max.apply(null, xs))), y0 = Math.max(0, Math.floor(Math.min.apply(null, ys))), y1 = Math.min(H - 1, Math.ceil(Math.max.apply(null, ys))), bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (bw < 4 || bh < 4) return; var m = new Uint8Array(bw * bh), i, j;
      for (j = 0; j < bh; j++) for (i = 0; i < bw; i++) { var o = ((y0 + j) * W + x0 + i) * 4, r = d[o], g = d[o + 1], b = d[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mn >= 232 && mx - mn <= 14 && inPg(x0 + i + 0.5, y0 + j + 0.5, P)) m[j * bw + i] = 1; }
      var seen = new Uint8Array(bw * bh), a2 = function (px) { return px * mm * mm / 1e6; };
      for (j = 0; j < bh; j++) for (i = 0; i < bw; i++) { var s0 = j * bw + i; if (!m[s0] || seen[s0]) continue; var st = [s0], n = 0, cx0 = i, cx1 = i, cy0 = j, cy1 = j; seen[s0] = 1;
        while (st.length) { var k = st.pop(), ki = k % bw, kj = (k / bw) | 0; n++; if (ki < cx0) cx0 = ki; if (ki > cx1) cx1 = ki; if (kj < cy0) cy0 = kj; if (kj > cy1) cy1 = kj; [k - 1, k + 1, k - bw, k + bw].forEach(function (q, t) { if (q < 0 || q >= bw * bh || (t < 2 && ((q % bw) !== ki + (t ? 1 : -1)))) return; if (m[q] && !seen[q]) { seen[q] = 1; st.push(q); } }); }
        var w = (cx1 - cx0 + 1) * mm, h = (cy1 - cy0 + 1) * mm, L = Math.max(w, h), S = Math.min(w, h), A = a2(n), fill = n / ((cx1 - cx0 + 1) * (cy1 - cy0 + 1)), box = { x0: x0 + cx0, y0: y0 + cy0, x1: x0 + cx1 + 1, y1: y0 + cy1 + 1 };
        if (A > 3.5 || fill < 0.35) continue;   // 칸 바닥 전체가 흰 경우(흰 타일)는 기구가 아니다
        if (kind === '욕실') { if (L >= 1150 && L <= 1900 && S >= 550 && S <= 900 && L / S >= 1.5) out.push(Object.assign({ k: '욕조' }, box)); else if (L >= 300 && L <= 800 && S >= 250 && S <= 600) out.push(Object.assign({ k: L / S >= 1.3 ? '변기' : '세면대' }, box)); else if (L >= 750 && L <= 1300 && S >= 750 && L / S < 1.4 && A >= 0.5) out.push(Object.assign({ k: '샤워' }, box)); }
        else if (L >= 1200 && S >= 420 && S <= 850 && L / S >= 2.2) out.push(Object.assign({ k: '싱크대' }, box)); } });
    return out;
  }
  function analyze(src, opt) {
    opt = opt || {}; var step0 = opt.onStep || function () {}, step = function (t) { step0('집지니가 ' + t); }, A;   // 안내 문구는 모두 「집지니가 …하고 있습니다」
    return needAuto().then(function () { A = root.JJPlanAuto; return toImage(src); }).then(function (img) {
      var NW = img.naturalWidth || img.width, NH = img.naturalHeight || img.height; if (!NW || !NH) return { ok: false, why: '그림을 읽지 못했습니다.' };
      var K = Math.min(1, 1600 / Math.max(NW, NH)), W = Math.round(NW * K), H = Math.round(NH * K), keep = document.createElement('canvas'); keep.width = W; keep.height = H;
      var kg = keep.getContext('2d'); kg.fillStyle = '#fff'; kg.fillRect(0, 0, W, H); kg.drawImage(img, 0, 0, W, H); var dataUrl = keep.toDataURL('image/jpeg', 0.86);
      step('도면의 글자와 치수를 읽고 있습니다');
      var ocrJob = opt.ocr === false ? Promise.resolve([]) : readTextScaled(keep).catch(function () { return null; });
      // 2026-11-10 옆으로 누운 그림 바로 세우기: 부동산 사이트 평면도 일부는 90도 돌아간 채 올라와 있어 방 이름이 안 읽힌다(시험 50곳에서 평균 50점).
      //   방 이름이 2개도 안 읽히면 왼쪽·오른쪽으로 돌려 글자만 다시 읽고, 3개 이상 읽히는 쪽이 있으면 그 방향으로 분석한다.
      //   2026-11-11 거꾸로 뒤집힌(180도) 그림도 같은 방식으로 세운다 — 시험 50곳의 「규칙」 낮은 점수 9장 가운데 거꾸로 올라온 그림이 있었다(글자를 못 읽어 방이 따로 떠 있는 도면이 나옴).
      var turned = 0, nameN = function (its) { var n = 0; (its || []).forEach(function (it) { if (/거\s*[실설]|[침칩]\s*실|안\s*방|[욕옥]\s*실|화장실|주\s*방|발\s*코\s*니|현\s*관/.test(String(it.text || ''))) n++; }); return n; };
      var rot = function (cv, deg) { var c = document.createElement('canvas'), flip = deg === 180; c.width = flip ? cv.width : cv.height; c.height = flip ? cv.height : cv.width; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.translate(c.width / 2, c.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(cv, -cv.width / 2, -cv.height / 2); return c; };
      ocrJob = ocrJob.then(function (items) {
        if (opt.ocr === false || opt.noRotate || nameN(items) >= 2) return items;
        step('도면 방향을 확인하고 있습니다');
        var best = { n: nameN(items), items: null, cv: null, deg: 0 };
        return [90, 270, 180].reduce(function (pr, deg) { return pr.then(function () { var c = rot(keep, deg); return readTextScaled(c).then(function (its) { var n = nameN(its); if (n > best.n) best = { n: n, items: its, cv: c, deg: deg }; }, function () {}); }); }, Promise.resolve()).then(function () {
          if (best.cv && best.n >= 3) { keep = best.cv; W = keep.width; H = keep.height; dataUrl = keep.toDataURL('image/jpeg', 0.86); turned = best.deg; return best.items; }
          return items; });
      });
      var DOORS = null;   // 학습 인식기가 찾은 문 자리(없으면 규칙만으로)
      ocrJob = ocrJob.then(function (items) { return aiReady().then(function (ai) { if (!ai || !ai.str) return items; step('벽·문·창 자리를 읽고 있습니다'); return segment(ai.str, keep, ai.size, ai.norm).then(function (st) { DOORS = doorBoxes(st, ai.map); return items; }, function () { return items; }); }, function () { return items; }); });
      // 2026-11-11 낮: 방 이름이 두 줄(「주방」 아래 「식당」)이거나 마루 무늬 위에 있으면 한 덩어리로 묶여 깨진 글자(「중합」「…」)로 읽힌다 — 고정 표본 60장 중 주방 못 찾음 9장.
      //   이름도 숫자도 아닌 조각의 둘레를 4배로 잘라 다시 읽고, 방 이름이 나오면 더한다(같은 종류 이름이 바로 곁에 있으면 더하지 않는다).
      ocrJob = ocrJob.then(function (items) { if (opt.ocr === false || !items || !items.length) return items;
        var kindOfT = function (t) { for (var k = 0; k < KW.length; k++) if (KW[k][0].test(t)) return KW[k][1]; return ''; }, hs = items.map(function (it) { return it.h; }).sort(function (a, b) { return a - b; }), med = hs[hs.length >> 1] || 12;
        var odd = items.filter(function (it) { var t = String(it.text || ''); return !kindOfT(t) && !/^[\d\s.,:×xX*㎡m²]+$/.test(t) && t.length <= 6 && (it.h > med * 1.5 || !/[가-힣A-Za-z]{2}/.test(t) || /[가-힣]/.test(t)); }).slice(0, 8);
        return odd.reduce(function (pr, it) { return pr.then(function () { var pad = Math.max(it.h, med) * 1.3, cx0 = Math.max(0, it.x - pad * 1.6), cy0 = Math.max(0, it.y - pad), cw = Math.min(keep.width - cx0, it.w + pad * 3.2), ch = Math.min(keep.height - cy0, it.h + pad * 2), f = 4;
            var c = document.createElement('canvas'); c.width = Math.max(480, Math.round(cw * f)); c.height = Math.max(200, Math.round(ch * f)); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; var ox = (c.width - cw * f) / 2, oy = (c.height - ch * f) / 2; g.drawImage(keep, cx0, cy0, cw, ch, ox, oy, cw * f, ch * f);
            return readText(c).then(function (r) { (r || []).forEach(function (t) { var kd = kindOfT(String(t.text || '')); if (!kd) return; var nx = cx0 + (t.x - ox) / f, ny = cy0 + (t.y - oy) / f, nw = t.w / f, nh = t.h / f;
              var near = items.some(function (q) { return kindOfT(String(q.text || '')) === kd && Math.hypot((q.x + q.w / 2) - (nx + nw / 2), (q.y + q.h / 2) - (ny + nh / 2)) < Math.max(med, nh) * 4; }); if (!near) items.push({ text: t.text, x: nx, y: ny, w: nw, h: nh, conf: t.conf }); }); }, function () {}); }); }, Promise.resolve()).then(function () { return items; }, function () { return items; }); });
      return ocrJob.then(function (items) {
        if (items && items.length) items = mergeLines(items);
        var clean = keep, seedJob = Promise.resolve();
        if (items && items.length) { clean = document.createElement('canvas'); clean.width = W; clean.height = H; var cg = clean.getContext('2d'); cg.drawImage(keep, 0, 0); cg.fillStyle = '#fff';
          items.forEach(function (it) { cg.fillRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4); }); }
        step('도면에서 방을 나누고 있습니다');
        var base = A.analyzeImage(clean, { areaM2: opt.areaM2 }); base.dataUrl = dataUrl; base.W = W; base.H = H;
        // 방 이름이 3곳 이상 읽히면 글자 기준 나누기가 우선 (부동산 사이트 도면)
        if (items && items.length) { var seeded = null; try { seeded = seedRooms(clean, items, W, H, opt.areaM2, false, DOORS); if (!seeded) seeded = seedRooms(clean, items, W, H, opt.areaM2, true, DOORS); } catch (e) { if (root.JJ_PLAN_DEBUG) console.error(e); seeded = null; }
          if (seeded) { var mk = function () { capBath(seeded, opt.areaM2); base = A.finalize(seeded, W, H, dataUrl, opt.areaM2, '글자 기준'); base.wallPx = seeded.wallPx; base.창선 = seeded.창선; if (seeded.문선 && seeded.문선.length) base.문 = seeded.문선; base.외곽 = seeded.외곽; }; mk();
            var blind = seeded.filter(function (f) { return f.guess; }).sort(function (a, b) { return b.px - a.px; }).slice(0, 5);
            if (blind.length) { step('이름이 안 읽힌 칸을 다시 읽고 있습니다'); seedJob = blind.reduce(function (pr, f) { return pr.then(function () { return readRegion(keep, f).then(function (k) { if (k) { f.kind = k.kind; f.nm = k.nm; f.guess = false; items.push(k.item); } }, function () {}); }); }, Promise.resolve()).then(mk); } } }
        return seedJob.then(aiReady).then(function (ai) { if (!ai || !ai.spa) return null; step('공간을 가려 읽고 있습니다'); return aiAnalyze(ai, clean).catch(function () { return null; }); }).then(function (aiRes) {
          if (aiRes && aiRes.found.length >= 2) { base = A.finalize(aiRes.found, W, H, dataUrl, opt.areaM2, '학습'); base.문 = aiRes.문; base.창 = aiRes.창; }
          if (!base.ok || !items || !items.length) { if (base.ok) { base.글자 = { 개수: 0, 방이름: 0, 치수: [], 실패: items === null }; try { var fr = base.rooms.map(function (r) { return { pts: r.pts, px: r.px, kind: r.kind, nm: r.nm }; }); squareUp(fr); var b2 = A.finalize(fr, W, H, dataUrl, opt.areaM2, base.engine); b2.글자 = base.글자; if (base.외곽) b2.외곽 = base.외곽; if (base.문) b2.문 = base.문; if (base.창선) b2.창선 = base.창선; base = b2; } catch (_q) {} } return base; }
          return refine(base, items, opt.areaM2);
        });
      }).then(function (res) { if (res && turned) res.회전 = turned; try { if (res && res.ok && res.rooms && res.mmpp > 0) res.기구 = fixtures(keep, res); } catch (_f) {} return res; });
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
  root.JJPlanTools = { analyze: analyze, fixPhoto: fixPhoto, readText: readText, refine: refine, aiReady: aiReady, vendor: vendor, _components: components, _contour: contour, version: '2026-11-11' };
})(typeof window !== 'undefined' ? window : this);
