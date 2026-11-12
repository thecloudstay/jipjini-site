/* 집지니 도면 직접 그리기 — 「자르고 붙이기」 (2026-11-12 대표 지시 9단계)
   「평면도가 아예 없는 주택 등 고객은 본인이 직접 그려서」 · 「집 모양이 어떻게 같냐, 다 다르지」
   실측하듯: ① 바깥 크기(가로×세로)로 시작 ② 칸을 눌러 치수대로 자르기 ③ 모자란 곳은 옆에 붙이기(ㄱ·ㄷ자 집)
   ④ 칸마다 이름 단추 ⑤ 다 그리면 cad_io.fromRects 가 벽(외벽 250·칸막이 120)·창을 놓고 편집기가 문을 놓는다.
   모든 칸은 네모 — 초보자가 숫자로만 다룬다. */
(function (root) {
  'use strict';
  var doc = root.document, R = [], sel = -1, cv = null, box = null, onDone = null, toast = function () {}, hist = [];
  var NAMES = ['거실', '안방', '방', '주방', '욕실', '현관', '발코니', '드레스룸', '다용도실', '복도', '창고', '기타'];
  var FILL = { 거실: '#EFE3CC', 주방: '#EFE3CC', 방: '#E4E9DF', 욕실: '#DCE8EE', 현관: '#E6E1D8', 발코니: '#EEEDE6', 기타: '#ECEAE4' };
  var $ = function (id) { return doc.getElementById(id); };
  var m = function (v) { return Math.round(v / 10) / 100; };            // mm → m(소수 둘째)
  var mmOf = function (id) { var v = parseFloat(String($(id).value).replace(',', '.')); return v > 0 ? Math.round(v * 1000 / 10) * 10 : 0; };   // m 입력 → mm(1cm 단위)
  var kind = function (nm) { return (root.JJCadIO && root.JJCadIO.kindOf) ? root.JJCadIO.kindOf(nm) : '기타'; };
  var snap = function () { hist.push(JSON.stringify(R)); if (hist.length > 50) hist.shift(); };
  var overlap = function (a, skip) { return R.some(function (r, i) { return i !== skip && a.x < r.x + r.w - 1 && a.x + a.w > r.x + 1 && a.y < r.y + r.h - 1 && a.y + a.h > r.y + 1; }); };
  var nextName = function (base) { var n = 1; while (R.some(function (r) { return r.name === base + (n > 1 ? n : ''); })) n++; return base + (n > 1 ? n : ''); };

  function mount(el, opt) {
    box = el; onDone = opt.onDone; toast = opt.toast || toast;
    el.innerHTML =
      '<div class="cdw-row"><label>집 바깥 크기</label><span class="cdw-in"><input id="cdwW" type="number" inputmode="decimal" step="0.01" min="1" max="60" placeholder="가로"> m × <input id="cdwH" type="number" inputmode="decimal" step="0.01" min="1" max="60" placeholder="세로"> m</span><button type="button" class="cbtn dark" id="cdwStart">이 크기로 시작</button></div>' +
      '<p class="cdw-help">줄자로 잰 집 전체의 가로·세로를 넣고 시작합니다. 그다음 칸을 눌러 방 크기대로 자르고, ㄱ자처럼 튀어나온 곳은 옆에 붙입니다.</p>' +
      '<div class="cdw-wrap" hidden id="cdwWrap"><canvas id="cdwCv" aria-label="그리는 도면 — 칸을 누르면 고릅니다"></canvas>' +
      '<div class="cdw-pane" id="cdwPane"></div>' +
      '<div class="cdw-end"><button type="button" class="cbtn" id="cdwUndo">되돌리기</button><button type="button" class="cbtn dark" id="cdwDone">다 그렸어요 — 공사 계획으로</button></div></div>';
    $('cdwStart').addEventListener('click', function () { var w = mmOf('cdwW'), h = mmOf('cdwH'); if (!w || !h) { toast('가로와 세로를 m 로 넣어 주세요. 예: 9.6 × 8.4'); return; } if (w > 60000 || h > 60000) { toast('60m 넘는 크기는 넣을 수 없습니다.'); return; } hist = []; R = [{ name: '거실', x: 0, y: 0, w: w, h: h }]; sel = 0; $('cdwWrap').hidden = false; draw(); pane(); });
    $('cdwUndo').addEventListener('click', function () { if (!hist.length) { toast('되돌릴 것이 없습니다.'); return; } R = JSON.parse(hist.pop()); sel = Math.min(sel, R.length - 1); draw(); pane(); });
    $('cdwDone').addEventListener('click', function () { if (!R.length) return; if (!root.JJCadIO || !root.JJCadIO.fromRects) { toast('도구를 불러오지 못했습니다.'); return; } onDone(root.JJCadIO.fromRects(R)); });
    cv = $('cdwCv'); cv.addEventListener('click', function (ev) { var p = toMM(ev); var i = -1; R.forEach(function (r, k) { if (p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h) i = k; }); if (i >= 0) { sel = i; draw(); pane(); } });
    root.addEventListener('resize', function () { if (R.length) draw(); });
  }

  var VIEW = null;
  function bounds() { var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; R.forEach(function (r) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }); return [x0, y0, x1, y1]; }
  function toMM(ev) { var b = cv.getBoundingClientRect(); return [(ev.clientX - b.left - VIEW.ox) / VIEW.k, (ev.clientY - b.top - VIEW.oy) / VIEW.k]; }
  function draw() {
    var Wc = cv.clientWidth || 600, Hc = Math.round(Wc * (Wc < 500 ? 0.95 : 0.68)), dpr = root.devicePixelRatio || 1; cv.width = Wc * dpr; cv.height = Hc * dpr; cv.style.height = Hc + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#FBF8F1'; g.fillRect(0, 0, Wc, Hc);
    var b = bounds(), pad = Wc < 500 ? 30 : 46, k = Math.min((Wc - pad * 2) / (b[2] - b[0]), (Hc - pad * 2) / (b[3] - b[1])), ox = (Wc - (b[2] - b[0]) * k) / 2 - b[0] * k, oy = (Hc - (b[3] - b[1]) * k) / 2 - b[1] * k; VIEW = { k: k, ox: ox, oy: oy };
    var X = function (v) { return ox + v * k; }, Y = function (v) { return oy + v * k; };
    // 1m 모눈
    g.strokeStyle = '#ECE5D6'; g.lineWidth = 1; for (var gx = Math.floor(b[0] / 1000) * 1000; gx <= b[2]; gx += 1000) { g.beginPath(); g.moveTo(X(gx), Y(b[1])); g.lineTo(X(gx), Y(b[3])); g.stroke(); } for (var gy = Math.floor(b[1] / 1000) * 1000; gy <= b[3]; gy += 1000) { g.beginPath(); g.moveTo(X(b[0]), Y(gy)); g.lineTo(X(b[2]), Y(gy)); g.stroke(); }
    R.forEach(function (r, i) { g.fillStyle = FILL[kind(r.name)] || FILL.기타; g.fillRect(X(r.x), Y(r.y), r.w * k, r.h * k); g.strokeStyle = '#2A2A2A'; g.lineWidth = 2; g.strokeRect(X(r.x), Y(r.y), r.w * k, r.h * k); });
    R.forEach(function (r, i) { var cx = X(r.x + r.w / 2), cy = Y(r.y + r.h / 2), fs = Math.max(11, Math.min(16, r.w * k / 6)); g.fillStyle = '#2A2A2A'; g.textAlign = 'center'; g.textBaseline = 'middle';
      var two = r.h * k > fs * 3; g.font = '600 ' + fs + 'px Pretendard, sans-serif'; g.fillText(r.name, cx, two ? cy - fs * 0.7 : cy); if (two) { g.font = (fs - 2) + 'px Pretendard, sans-serif'; g.fillStyle = '#5A5A5A'; g.fillText(m(r.w) + ' × ' + m(r.h) + ' m', cx, cy + fs * 0.55); } });
    if (sel >= 0 && R[sel]) { var r = R[sel]; g.strokeStyle = '#B4232A'; g.lineWidth = 3; g.setLineDash([7, 4]); g.strokeRect(X(r.x) + 2, Y(r.y) + 2, r.w * k - 4, r.h * k - 4); g.setLineDash([]); }
    // 전체 치수
    g.fillStyle = '#5A5A5A'; g.font = '13px Pretendard, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('전체 ' + m(b[2] - b[0]) + ' m', (X(b[0]) + X(b[2])) / 2, Y(b[1]) - 6); g.textBaseline = 'middle';
    g.save(); g.translate(X(b[0]) - 18, (Y(b[1]) + Y(b[3])) / 2); g.rotate(-Math.PI / 2); g.fillText('전체 ' + m(b[3] - b[1]) + ' m', 0, 0); g.restore();
  }
  function pane() {
    var r = R[sel]; if (!r) { $('cdwPane').innerHTML = '<p class="cdw-help">칸을 눌러 고르세요.</p>'; return; }
    var nm = NAMES.map(function (n) { return '<button type="button" class="cbtn' + (r.name.replace(/\d+$/, '') === n ? ' on' : '') + '" data-nm="' + n + '">' + n + '</button>'; }).join('');
    $('cdwPane').innerHTML =
      '<div class="cdw-h">고른 칸 · ' + r.name + ' <small>' + m(r.w) + ' × ' + m(r.h) + ' m · ' + (Math.round(r.w * r.h / 1e4) / 100) + '㎡</small></div>' +
      '<div class="cdw-names">' + nm + '</div>' +
      '<div class="cdw-h2">자르기 <small>방 하나 크기만큼 떼어 냅니다</small></div>' +
      '<div class="cdw-row"><span class="cdw-in">왼쪽에서 <input id="cdwCutX" type="number" inputmode="decimal" step="0.01" placeholder="' + m(r.w / 2) + '"> m</span><button type="button" class="cbtn" data-a="cutx">세로로 자르기</button></div>' +
      '<div class="cdw-row"><span class="cdw-in">위에서 <input id="cdwCutY" type="number" inputmode="decimal" step="0.01" placeholder="' + m(r.h / 2) + '"> m</span><button type="button" class="cbtn" data-a="cuty">가로로 자르기</button></div>' +
      '<div class="cdw-h2">붙이기 <small>튀어나온 방·발코니</small></div>' +
      '<div class="cdw-row"><span class="cdw-in">깊이 <input id="cdwAdd" type="number" inputmode="decimal" step="0.01" placeholder="1.5"> m</span><button type="button" class="cbtn" data-a="addT">위에</button><button type="button" class="cbtn" data-a="addR">오른쪽에</button><button type="button" class="cbtn" data-a="addB">아래에</button><button type="button" class="cbtn" data-a="addL">왼쪽에</button></div>' +
      '<div class="cdw-h2">크기 고치기</div>' +
      '<div class="cdw-row"><span class="cdw-in"><input id="cdwRW" type="number" inputmode="decimal" step="0.01" value="' + m(r.w) + '"> m × <input id="cdwRH" type="number" inputmode="decimal" step="0.01" value="' + m(r.h) + '"> m</span><button type="button" class="cbtn" data-a="size">바꾸기</button><button type="button" class="cbtn" data-a="del" style="color:#B4232A">이 칸 지우기</button></div>';
    Array.prototype.forEach.call($('cdwPane').querySelectorAll('[data-nm]'), function (b) { b.addEventListener('click', function () { snap(); var base = b.getAttribute('data-nm'); r.name = /^(거실|주방|현관)$/.test(base) ? base : nextName(base); draw(); pane(); }); });
    Array.prototype.forEach.call($('cdwPane').querySelectorAll('[data-a]'), function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-a')); }); });
  }
  function act(a) {
    var r = R[sel]; if (!r) return;
    if (a === 'cutx' || a === 'cuty') { var hz = a === 'cutx', v = mmOf(hz ? 'cdwCutX' : 'cdwCutY') || Math.round((hz ? r.w : r.h) / 2 / 10) * 10, L = hz ? r.w : r.h;
      if (v < 600 || v > L - 600) { toast('자르는 자리는 양쪽이 0.6m 넘게 남아야 합니다.'); return; } snap();
      var nb = hz ? { name: nextName('방'), x: r.x + v, y: r.y, w: r.w - v, h: r.h } : { name: nextName('방'), x: r.x, y: r.y + v, w: r.w, h: r.h - v };
      if (hz) r.w = v; else r.h = v; R.push(nb); draw(); pane(); return; }
    if (/^add/.test(a)) { var d = mmOf('cdwAdd') || 1500, nr = a === 'addT' ? { x: r.x, y: r.y - d, w: r.w, h: d } : a === 'addB' ? { x: r.x, y: r.y + r.h, w: r.w, h: d } : a === 'addL' ? { x: r.x - d, y: r.y, w: d, h: r.h } : { x: r.x + r.w, y: r.y, w: d, h: r.h };
      if (overlap(nr, -1)) { toast('그 자리에는 이미 칸이 있습니다. 다른 쪽에 붙이거나 크기를 고치세요.'); return; } snap(); nr.name = d <= 1800 && /T|B/.test(a) ? nextName('발코니') : nextName('방'); R.push(nr); sel = R.length - 1; draw(); pane(); return; }
    if (a === 'size') { var w = mmOf('cdwRW'), h = mmOf('cdwRH'); if (w < 500 || h < 500) { toast('0.5m 넘게 넣어 주세요.'); return; } var t = { x: r.x, y: r.y, w: w, h: h }; if (overlap(t, sel)) { toast('그 크기로는 옆 칸과 겹칩니다. 옆 칸을 먼저 줄이세요.'); return; } snap(); r.w = w; r.h = h; draw(); pane(); return; }
    if (a === 'del') { if (R.length < 2) { toast('마지막 칸은 지울 수 없습니다.'); return; } snap(); R.splice(sel, 1); sel = Math.max(0, sel - 1); draw(); pane(); }
  }
  root.JJCadDraw = { mount: mount, rects: function () { return R.slice(); } };
})(typeof window !== 'undefined' ? window : this);
