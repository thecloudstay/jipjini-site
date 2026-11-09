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
  var KW = [[/거\s*실|living/i, '거실'], [/침\s*실|안\s*방|^방\s*\d|bed\s*room|^room/i, '방'], [/욕\s*실|화장실|bath|toilet|^w\.?c/i, '욕실'], [/발코니|베란다|다용도|balcony/i, '발코니'], [/실외기/i, '실외기실'],
    [/주\s*방|식\s*당|kitchen|dining/i, '주방'], [/현\s*관|entrance/i, '현관'], [/드레스|파우더|dress/i, '드레스룸'], [/팬트리|창고|알파|pantry/i, '기타']];
  function script(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = function () { ok(); }; s.onerror = function () { no(new Error('불러오지 못했습니다: ' + src)); }; document.head.appendChild(s); }); }
  function needAuto() { return root.JJPlanAuto ? Promise.resolve() : script(BASE + 'plan_auto.js?v=20261110c'); }
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
  function numOf(t) { var s = String(t).replace(/[\s,.]/g, ''); if (!/^\d{3,5}$/.test(s)) return 0; var n = Number(s); return (n >= 600 && n <= 30000) ? n : 0; }
  /** 글자 인식 결과로 방 종류를 확정하고, 치수 숫자로 척도를 검증·보완한다 */
  function refine(base, items, areaM2) {
    var A = root.JJPlanAuto, named = 0, dims = [], rooms = base.rooms || [];
    var found = rooms.map(function (r) { return { pts: r.pts, px: r.px, kind: base.engine === '학습' ? r.kind : undefined, _k0: r.kind }; });
    items.forEach(function (it) {
      var cx = it.x + it.w / 2, cy = it.y + it.h / 2, n = numOf(it.text);
      if (n) { dims.push({ n: n, v: it.v, cx: cx, cy: cy }); return; }
      for (var i = 0; i < KW.length; i++) if (KW[i][0].test(it.text)) { for (var j = 0; j < found.length; j++) if (found[j].pts.length >= 3 && inPoly(cx, cy, found[j].pts)) { if (!found[j]._txt) { found[j].kind = KW[i][1]; found[j]._txt = true; named++; } break; } break; }
    });
    // 글자로 이름이 붙은 방이 하나라도 있으면, 이름 없는 공간은 모양·크기 추정에 맡긴다(거실 추정 포함)
    var xs = [], ys = []; found.forEach(function (f) { f.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    var bw = Math.max.apply(null, xs) - Math.min.apply(null, xs), bh = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    var innerPx = rooms.filter(function (r) { return r.kind !== '발코니' && r.kind !== '실외기실'; }).reduce(function (s, r) { return s + r.px; }, 0), m2 = Number(areaM2) || 0;
    var mmArea = (m2 && innerPx) ? Math.sqrt(m2 * 1e6 / innerPx) : 0;
    // 치수 기준 척도: 가로로 쓴 가장 큰 숫자 = 도면 전체 가로, 세로로 쓴 가장 큰 숫자 = 전체 세로 (둘 다 있으면 평균). 벽 두께만큼 몇 % 오차가 있다
    var hMax = 0, vMax = 0; dims.forEach(function (d) { if (d.v) vMax = Math.max(vMax, d.n); else hMax = Math.max(hMax, d.n); });
    var cand = []; if (hMax && bw > 50) cand.push(hMax / bw); if (vMax && bh > 50) cand.push(vMax / bh);
    var mmDim = 0; if (cand.length === 2 && Math.abs(cand[0] - cand[1]) / Math.max(cand[0], cand[1]) <= 0.15) mmDim = (cand[0] + cand[1]) / 2; else if (cand.length === 1) mmDim = cand[0];
    var sc = { 방식: mmArea ? '면적' : '없음', 면적기준: mmArea ? Math.round(mmArea * 100) / 100 : 0, 치수기준: mmDim ? Math.round(mmDim * 100) / 100 : 0, 차이: 0, 안내: '' }, fix = 0;
    if (mmArea && mmDim) { sc.차이 = Math.round((mmDim - mmArea) / mmArea * 1000) / 10;
      sc.안내 = Math.abs(sc.차이) <= 12 ? '도면에 적힌 치수와 전용면적 기준 척도가 맞습니다 (차이 ' + sc.차이 + '%).' : '도면 치수로 본 크기와 전용면적이 ' + Math.abs(sc.차이) + '% 다릅니다 — 전용면적 또는 도면을 확인해 주세요.'; }
    else if (!mmArea && mmDim) { fix = mmDim; sc.방식 = '치수'; sc.안내 = '전용면적 없이 도면에 적힌 치수(' + (hMax || vMax).toLocaleString('ko-KR') + ' 등)로 크기를 계산했습니다.'; }
    var out = A.finalize(found, base.W, base.H, base.dataUrl, areaM2, base.engine, fix);
    out.글자 = { 개수: items.length, 방이름: named, 치수: dims.map(function (d) { return d.n; }).sort(function (a, b) { return b - a; }).slice(0, 12) }; out.척도 = sc;
    if (base.문) out.문 = base.문; if (base.창) out.창 = base.창;
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
  function analyze(src, opt) {
    opt = opt || {}; var step = opt.onStep || function () {}, A;
    return needAuto().then(function () { A = root.JJPlanAuto; return toImage(src); }).then(function (img) {
      var NW = img.naturalWidth || img.width, NH = img.naturalHeight || img.height; if (!NW || !NH) return { ok: false, why: '그림을 읽지 못했습니다.' };
      var K = Math.min(1, 1600 / Math.max(NW, NH)), W = Math.round(NW * K), H = Math.round(NH * K), keep = document.createElement('canvas'); keep.width = W; keep.height = H;
      var kg = keep.getContext('2d'); kg.fillStyle = '#fff'; kg.fillRect(0, 0, W, H); kg.drawImage(img, 0, 0, W, H); var dataUrl = keep.toDataURL('image/jpeg', 0.86);
      step('도면의 글자·치수를 읽는 중');
      var ocrJob = opt.ocr === false ? Promise.resolve([]) : readTextScaled(keep).catch(function () { return null; });
      return ocrJob.then(function (items) {
        var clean = keep;
        if (items && items.length) { clean = document.createElement('canvas'); clean.width = W; clean.height = H; var cg = clean.getContext('2d'); cg.drawImage(keep, 0, 0); cg.fillStyle = '#fff';
          items.forEach(function (it) { cg.fillRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4); }); }
        step('도면에서 방을 찾는 중');
        var base = A.analyzeImage(clean, { areaM2: opt.areaM2 }); base.dataUrl = dataUrl; base.W = W; base.H = H;
        return aiReady().then(function (ai) { if (!ai) return null; step('학습 인식기로 벽·문·창을 읽는 중'); return aiAnalyze(ai, clean).catch(function () { return null; }); }).then(function (aiRes) {
          if (aiRes && aiRes.found.length >= 2) { base = A.finalize(aiRes.found, W, H, dataUrl, opt.areaM2, '학습'); base.문 = aiRes.문; base.창 = aiRes.창; }
          if (!base.ok || !items || !items.length) { if (base.ok) base.글자 = { 개수: 0, 방이름: 0, 치수: [], 실패: items === null }; return base; }
          return refine(base, items, opt.areaM2);
        });
      });
    }).catch(function (e) { return { ok: false, why: (e && e.message) || '도면을 읽지 못했습니다.' }; });
  }
  // 작은 글자를 위해 긴 변이 1800 보다 작으면 키워서 읽고 좌표를 되돌린다
  function readTextScaled(cv) {
    var m = Math.max(cv.width, cv.height), f = m < 1800 ? Math.min(2, 1800 / m) : 1; if (f <= 1.05) return readText(cv);
    var up = document.createElement('canvas'); up.width = Math.round(cv.width * f); up.height = Math.round(cv.height * f); var g = up.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, up.width, up.height);
    return readText(up).then(function (items) { items.forEach(function (it) { it.x /= f; it.y /= f; it.w /= f; it.h /= f; }); return items; });
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
