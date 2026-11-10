/* 집지니 CAD (2026-11-11) — 공개 쪽 cad.html 의 동작 전부
   흐름: ① 도면 그림 올리기 → ② JJPlanTools.analyze 로 방 나누기 + JJPlanStyle 로 다시 그려 보여 주기 → ③ 그 도면 위에 공사 계획·작업 지시 표시 → 한 장으로 인쇄·그림 저장
   편집기는 「분석 결과(방 다각형 목록)」만 있으면 시작한다: JJCad.open({ rooms:[{ name, kind, area, pts }], W, H, mmpp, sum, 창 })
     → 올리기 걸음과 떨어져 있어, 나중에 「우리 집 검색」으로 미리 다시 그려 둔 도면을 받아도 같은 편집기를 그대로 쓴다.
   지키는 선: 올린 원본 그림은 이 기기 밖으로 보내지 않고 보관하지도 않는다(다시 그린 도면 자료만 localStorage 에 둔다). 인쇄·저장물에는 다시 그린 도면만 들어간다.
   조작 방식(벽·모서리에 붙기, 격자, 되돌리기 쌓기)은 캐드 도구들의 일반적인 방식을 참고해 새로 썼다. 바깥 꾸러미 없음. */
(function (root) {
  var KEY = 'jj_cad_v1', VER = '20261111a', doc = document, $ = function (id) { return doc.getElementById(id); };
  var S = { plan: null, marks: [], undo: [], tool: '', file: null, pending: null, polys: [], vb: null, baseHtml: '' };
  var RED = '#b3261e', GRN = '#1e4d3a', INK = '#2A2A2A', PAPER = '#f7f4ee';
  var COLOR = { 철거: RED, 공사: GRN, 메모: INK }, LABEL = { 철거: '철거할 곳', 공사: '공사할 곳', 메모: '작업 지시' }, SHORT = { 철거: '철거', 공사: '공사', 메모: '지시' };
  var CHIPS = {
    철거: ['이 벽 철거', '문틀·문짝 철거', '붙박이장 철거', '욕실 전체 철거', '주방 가구 철거', '바닥재 철거', '발코니 확장(벽 철거)'],
    공사: ['도배', '바닥 교체', '타일', '욕실 전체 공사', '주방 교체', '창호(샷시) 교체', '문 교체', '전기·조명', '페인트·필름', '붙박이장'],
    메모: ['여기 콘센트 추가', '여기 조명 추가', '스위치 옮기기', '문 교체', '벽 새로 세우기(가벽)', '선반·수납장 설치', '에어컨 자리', '물 새는 곳 고치기']
  };
  var NAMES = ['거실', '안방', '방', '주방', '욕실', '발코니', '현관', '드레스룸', '다용도실', '실외기실'];
  var HINT = {
    '': '위 단추에서 할 일을 하나 고르세요. 번호를 누르면 고치고, 끌면 옮깁니다.',
    철거: '철거할 벽을 따라 죽 그으세요. 한 번만 누르면 그 자리에 표시됩니다.',
    공사: '공사할 방을 누르세요. 방의 일부만이면 끌어서 네모를 그리세요.',
    메모: '지시할 자리를 누르세요. 번호가 붙고 내용을 적을 수 있습니다.',
    이름: '이름을 바꿀 방을 누르세요.'
  };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ev(name) { try { if (root.gtag) root.gtag('event', name); } catch (e) {} }
  function r1(v) { return Math.round(v * 10) / 10; }
  var toastT = 0;
  function toast(t) { var el = $('cadToast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 3200); }
  function today() { var d = new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }

  // ───── 보관(이 기기에만) ─────
  function save() { try { if (S.plan) localStorage.setItem(KEY, JSON.stringify({ v: 1, plan: S.plan, marks: S.marks, at: Date.now() })); } catch (e) {} }
  function load() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && o.plan && o.plan.rooms && o.plan.rooms.length ? o : null; } catch (e) { return null; } }
  function drop() { try { localStorage.removeItem(KEY); } catch (e) {} }

  // ───── 걸음 바꾸기 ─────
  function go(n) {
    [1, 2, 3].forEach(function (i) { $('pane' + i).classList.toggle('on', i === n); });
    Array.prototype.forEach.call($('cadSteps').children, function (li) { var s = Number(li.getAttribute('data-s')); li.classList.toggle('on', s === n); li.classList.toggle('done', s < n); });
    try { root.scrollTo(0, Math.max(0, $('cadSteps').getBoundingClientRect().top + root.pageYOffset - 70)); } catch (e) {}
  }

  // ───── ① 올리기 ─────
  function loadTools(ok, no) {
    if (root.JJPlanTools && root.JJPlanAuto) return ok();
    var one = function (src, next) { var sc = doc.createElement('script'); sc.src = 'assets/' + src + '?v=' + VER; sc.onload = next; sc.onerror = no; doc.head.appendChild(sc); };
    var tools = function () { root.JJPlanTools ? ok() : one('plan_tools.js', ok); };
    root.JJPlanAuto ? tools() : one('plan_auto.js', tools);
  }
  function pick(file) {
    if (!file) return;
    if (/pdf$/i.test(file.type || '') || /\.pdf$/i.test(file.name || '')) { toast('문서 파일은 읽지 못합니다. 평면도 화면을 갈무리해 그림으로 올려 주세요.'); return; }
    if (file.type && !/^image\//.test(file.type)) { toast('그림 파일만 올릴 수 있습니다.'); return; }
    if (file.size > 20 * 1024 * 1024) { toast('그림이 너무 큽니다. 화면을 갈무리한 그림으로 올려 주세요.'); return; }
    S.file = file; ev('cad_upload'); run(file);
  }
  function run(src) {
    go(2); $('cadWait').hidden = false; $('cadFail').hidden = true; $('cadRes').hidden = true; $('cadMsg').textContent = '집지니가 도면을 읽을 준비를 하고 있습니다…';
    var slow = setTimeout(function () { $('cadMsg').textContent = '평소보다 오래 걸리고 있습니다. 조금만 더 기다려 주세요…'; }, 90000);
    var fail = function (why) { clearTimeout(slow); $('cadWait').hidden = true; $('cadFail').hidden = false; $('cadWhy').textContent = why || '방을 나누지 못했습니다.'; $('cadFix').hidden = !(S.file && root.JJPlanTools); ev('cad_read_fail'); };
    loadTools(function () {
      var m2 = Number($('cadM2').value) || 0;
      root.JJPlanTools.analyze(src, { areaM2: m2, onStep: function (t) { $('cadMsg').textContent = t + '…'; } }).then(function (r) {
        clearTimeout(slow);
        if (!r || !r.ok || !r.rooms || r.rooms.length < 2) return fail(r && r.why);
        if (r.engine === '보통 구성') return fail('그림에서 벽을 찾지 못했습니다.');
        S.pending = slim(r); showResult(r);
      }, function (e) { fail(e && e.message); });
    }, function () { fail('도면 읽는 도구를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 해 보세요.'); });
  }
  // 분석 결과에서 편집기에 필요한 것만 남긴다 — 원본 그림(dataUrl)은 버린다
  function slim(r) {
    return JSON.parse(JSON.stringify({ W: r.W, H: r.H, mmpp: r.mmpp || 0, sum: r.sum || {}, 척도: r.척도 ? { 방식: r.척도.방식 } : null,
      rooms: r.rooms.map(function (m) { return { name: m.name, kind: m.kind, area: m.area, w: m.w, d: m.d, pts: m.pts }; }),
      창: (r.창 || []).map(function (w) { return { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, 종류: w.종류, w_m: w.w_m }; }) }));
  }
  function showResult(r) {
    var p = S.pending; $('cadWait').hidden = true; $('cadRes').hidden = false;
    $('cadPaper').innerHTML = root.JJPlanStyle.svg(p, { title: '우리 집 평면 구성도', date: today() });
    var su = p.sum || {}, cnt = function (k) { return p.rooms.filter(function (m) { return m.kind === k; }).length; }, rows = [['찾은 공간', p.rooms.length + '곳']];
    if (cnt('방')) rows.push(['방', cnt('방') + '칸']); if (cnt('욕실')) rows.push(['욕실', cnt('욕실') + '곳']); if (cnt('발코니')) rows.push(['발코니', cnt('발코니') + '곳']); if (su.전용합) rows.push(['실내 넓이(어림)', su.전용합 + '㎡']);
    $('cadSum').innerHTML = rows.map(function (x) { return '<li><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></li>'; }).join('');
    var note = '', g = r && r.글자;
    if (g && !g.방이름) note = '방 이름 글자를 읽지 못해 이름을 어림으로 붙였습니다. 다음 걸음의 「방 이름」 단추로 고쳐 주세요.';
    else if (!p.mmpp || (p.척도 && p.척도.방식 === '없음')) note = '크기 기준을 찾지 못해 넓이는 표시하지 않았습니다. 전용면적을 넣고 다시 올리면 넓이가 나옵니다.';
    $('cadResNote').hidden = !note; $('cadResNote').textContent = note; ev('cad_read_ok');
  }

  // ───── ③ 편집기 ─────
  function open(plan, marks) {
    if (!plan || !plan.rooms || !plan.rooms.length) return false;
    S.plan = plan; S.marks = marks || []; S.undo = []; setTool(''); renderBase(); renderOver(); renderList(); go(3); save(); return true;
  }
  function parsePts(s) { return String(s || '').trim().split(/\s+/).map(function (q) { var a = q.split(','); return [Number(a[0]), Number(a[1])]; }).filter(function (q) { return isFinite(q[0]) && isFinite(q[1]); }); }
  function renderBase() {
    var p = S.plan, xs = [], ys = [];
    if (!p.W || !p.H) { p.rooms.forEach(function (m) { (m.pts || []).forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); }); p.W = Math.max.apply(null, xs) + Math.min.apply(null, xs); p.H = Math.max.apply(null, ys) + Math.min.apply(null, ys); xs = []; ys = []; }
    S.baseHtml = root.JJPlanStyle.svg(p, { bare: { W: p.W, H: p.H }, noMark: true });
    $('cadBase').innerHTML = S.baseHtml; var sv = $('cadBase').querySelector('svg'); if (!sv) return;
    // 화면에 실제로 그려진 방 테두리(반듯하게 편 뒤의 자리)를 읽어 붙기·방 고르기에 쓴다
    var shown = p.rooms.map(function (m, i) { return i; }).filter(function (i) { return p.rooms[i].pts && p.rooms[i].pts.length >= 3; });
    var el = Array.prototype.filter.call(sv.querySelectorAll('polygon'), function (g) { return g.getAttribute('fill') === 'none' && g.getAttribute('stroke'); });
    S.polys = el.length === shown.length ? el.map(function (g, k) { return { i: shown[k], p: parsePts(g.getAttribute('points')) }; }) : shown.map(function (i) { return { i: i, p: p.rooms[i].pts }; });
    S.polys.forEach(function (o) { o.p.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = Math.max(x1 - x0, y1 - y0) * 0.07;
    S.vb = { x: r1(x0 - pad), y: r1(y0 - pad), w: r1(x1 - x0 + pad * 2), h: r1(y1 - y0 + pad * 2) };
    var vb = S.vb.x + ' ' + S.vb.y + ' ' + S.vb.w + ' ' + S.vb.h; sv.setAttribute('viewBox', vb); sv.style.maxHeight = '78vh'; $('cadOver').setAttribute('viewBox', vb);
    $('cadScale').textContent = p.mmpp ? '옅은 격자 한 칸은 약 1m 입니다. 정확한 치수는 현장 실측으로 확정합니다.' : '';
  }
  function scale() { var m = $('cadOver').getScreenCTM(); return m && m.a ? m.a : 1; }
  function toPt(e) { var o = $('cadOver'), m = o.getScreenCTM(), q = o.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; q = q.matrixTransform(m.inverse()); return [r1(q.x), r1(q.y)]; }
  function inPoly(x, y, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
  function polyOf(i) { for (var k = 0; k < S.polys.length; k++) if (S.polys[k].i === i) return S.polys[k].p; return null; }
  function roomAt(pt) { var best = -1, ba = 1e18; S.polys.forEach(function (o) { if (!inPoly(pt[0], pt[1], o.p)) return; var a = Math.abs(area(o.p)); if (a < ba) { ba = a; best = o.i; } }); return best; }
  function area(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  // 자석처럼 붙기: 모서리가 먼저, 다음이 벽선
  function snap(pt) {
    var tol = 16 / scale(), best = null, bd = tol;
    S.polys.forEach(function (o) { o.p.forEach(function (q) { var d = dist(pt, q); if (d < bd) { bd = d; best = [q[0], q[1]]; } }); });
    if (best) return { p: best, kind: '모서리' };
    bd = tol * 0.8;
    S.polys.forEach(function (o) { for (var i = 0; i < o.p.length; i++) { var a = o.p[i], b = o.p[(i + 1) % o.p.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; if (!L) continue;
      var t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L)), q = [a[0] + t * dx, a[1] + t * dy], d = dist(pt, q); if (d < bd) { bd = d; best = [r1(q[0]), r1(q[1])]; } } });
    return best ? { p: best, kind: '벽' } : { p: pt, kind: '' };
  }
  function anchor(m, r) {
    if (m.t === '메모') return m.p;
    if (m.t === '철거') return [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2];
    var p = m.box ? [[m.box[0], m.box[1]]] : (polyOf(m.room) || [[S.vb.x, S.vb.y]]), tl = p[0]; p.forEach(function (q) { if (q[1] + q[0] < tl[1] + tl[0]) tl = q; });
    return [tl[0] + r * 1.5, tl[1] + r * 1.5];
  }
  // 표시 그리기 — 화면(편집)과 출력물(한 장)에서 같이 쓴다. r = 번호 동그라미 반지름(도면 단위)
  function marksSvg(r, id) {
    var h = ['<defs><pattern id="' + id + '" width="' + r1(r * 0.8) + '" height="' + r1(r * 0.8) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="' + r1(r * 0.8) + '" stroke="' + GRN + '" stroke-width="' + r1(r * 0.22) + '" stroke-opacity="0.4"/></pattern></defs>'];
    S.marks.forEach(function (m) {   // 넓은 것(공사 영역)을 먼저 깔고
      if (m.t !== '공사') return; var at = 'fill="url(#' + id + ')" stroke="' + GRN + '" stroke-width="' + r1(r * 0.16) + '" stroke-dasharray="' + r1(r * 0.5) + ' ' + r1(r * 0.3) + '" pointer-events="none"';
      if (m.box) h.push('<rect x="' + Math.min(m.box[0], m.box[2]) + '" y="' + Math.min(m.box[1], m.box[3]) + '" width="' + r1(Math.abs(m.box[2] - m.box[0])) + '" height="' + r1(Math.abs(m.box[3] - m.box[1])) + '" ' + at + '/>');
      else { var p = polyOf(m.room); if (p) h.push('<polygon points="' + p.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '" ' + at + '/>'); } });
    S.marks.forEach(function (m) {
      if (m.t !== '철거') return; var a = m.a, b = m.b, x = r * 0.62;
      if (dist(a, b) < 0.5) h.push('<path d="M' + r1(a[0] - x) + ' ' + r1(a[1] - x) + 'L' + r1(a[0] + x) + ' ' + r1(a[1] + x) + 'M' + r1(a[0] + x) + ' ' + r1(a[1] - x) + 'L' + r1(a[0] - x) + ' ' + r1(a[1] + x) + '" stroke="' + RED + '" stroke-width="' + r1(r * 0.3) + '" stroke-linecap="round" fill="none" pointer-events="none"/>');
      else h.push('<g pointer-events="none"><line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="#fff" stroke-width="' + r1(r * 0.62) + '" stroke-linecap="butt"/><line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + RED + '" stroke-width="' + r1(r * 0.42) + '" stroke-dasharray="' + r1(r * 0.62) + ' ' + r1(r * 0.34) + '"/></g>'); });
    S.marks.forEach(function (m, i) { var c = anchor(m, r), n = String(i + 1);
      h.push('<g class="mk" data-i="' + i + '"><circle cx="' + r1(c[0]) + '" cy="' + r1(c[1]) + '" r="' + r1(r * 1.55) + '" fill="#fff" fill-opacity="0.01"/><circle cx="' + r1(c[0]) + '" cy="' + r1(c[1]) + '" r="' + r1(r) + '" fill="' + COLOR[m.t] + '" stroke="#fff" stroke-width="' + r1(r * 0.14) + '"/>' +
        '<text x="' + r1(c[0]) + '" y="' + r1(c[1] + r * 0.38) + '" text-anchor="middle" font-size="' + r1(r * (n.length > 1 ? 0.95 : 1.1)) + '" font-weight="700" fill="#fff" font-family="Pretendard,\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif">' + n + '</text></g>'); });
    return h.join('');
  }
  var D = null, pre = null;   // D = 지금 끌고 있는 것, pre = 미리 보기(긋는 선·네모·붙는 자리)
  function renderOver() {
    if (!S.vb) return; var k = scale(), r = 16 / k, h = [], vb = S.vb, mm = S.plan.mmpp;
    if (mm) { var st = 1000 / mm, n = (vb.w + vb.h) / st; if (n < 90 && st > 4 / k) { var g = []; for (var x = Math.ceil(vb.x / st) * st; x < vb.x + vb.w; x += st) g.push('M' + r1(x) + ' ' + vb.y + 'V' + (vb.y + vb.h)); for (var y = Math.ceil(vb.y / st) * st; y < vb.y + vb.h; y += st) g.push('M' + vb.x + ' ' + r1(y) + 'H' + (vb.x + vb.w)); h.push('<path d="' + g.join('') + '" stroke="' + INK + '" stroke-opacity="0.07" stroke-width="' + r1(1 / k) + '" fill="none" pointer-events="none"/>'); } }
    h.push(marksSvg(r, 'cadHatchE'));
    if (pre) {
      if (pre.line) h.push('<line x1="' + pre.line[0][0] + '" y1="' + pre.line[0][1] + '" x2="' + pre.line[1][0] + '" y2="' + pre.line[1][1] + '" stroke="' + RED + '" stroke-width="' + r1(r * 0.42) + '" stroke-opacity="0.7" pointer-events="none"/>');
      if (pre.box) h.push('<rect x="' + Math.min(pre.box[0], pre.box[2]) + '" y="' + Math.min(pre.box[1], pre.box[3]) + '" width="' + r1(Math.abs(pre.box[2] - pre.box[0])) + '" height="' + r1(Math.abs(pre.box[3] - pre.box[1])) + '" fill="' + GRN + '" fill-opacity="0.15" stroke="' + GRN + '" stroke-width="' + r1(2 / k) + '" pointer-events="none"/>');
      if (pre.at && pre.kind) { var s = 7 / k, q = pre.at; h.push(pre.kind === '모서리' ? '<rect x="' + r1(q[0] - s) + '" y="' + r1(q[1] - s) + '" width="' + r1(s * 2) + '" height="' + r1(s * 2) + '" fill="none" stroke="#0a58ca" stroke-width="' + r1(2.2 / k) + '" pointer-events="none"/>' : '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + r1(s) + '" fill="none" stroke="#0a58ca" stroke-width="' + r1(2.2 / k) + '" pointer-events="none"/>'); }
    }
    $('cadOver').innerHTML = h.join('');
  }
  function whereOf(m) {
    if (m.t === '공사' && !m.box) { var rm = S.plan.rooms[m.room]; return rm ? rm.name + (rm.area ? ' · ' + rm.area + '㎡' : '') : ''; }
    var c = m.t === '공사' ? [(m.box[0] + m.box[2]) / 2, (m.box[1] + m.box[3]) / 2] : anchor(m, 0), i = roomAt(c), t = i >= 0 ? S.plan.rooms[i].name : '';
    if (m.t === '철거' && S.plan.mmpp) { var L = dist(m.a, m.b) * S.plan.mmpp / 1000; if (L >= 0.3) t += (t ? ' · ' : '') + '길이 약 ' + L.toFixed(1) + 'm'; }
    return t;
  }
  function renderList() {
    var n = S.marks.length; $('cadEmpty').hidden = n > 0; $('cadCount').textContent = n ? n + '개' : '';
    $('cadList').innerHTML = S.marks.map(function (m, i) { var w = whereOf(m);
      return '<li><span class="no k' + m.t + '">' + (i + 1) + '</span><div><div class="tx">' + esc(m.text) + '</div><div class="wh">' + esc(SHORT[m.t] + (w ? ' · ' + w : '')) + '</div></div>' +
        '<div class="ac"><button type="button" data-ed="' + i + '">고치기</button><button type="button" class="del" data-del="' + i + '">지우기</button></div></li>'; }).join('');
    $('cadUndo').disabled = !S.undo.length;
  }
  function refresh() { renderOver(); renderList(); save(); }
  // 되돌리기 쌓기
  function snapState() { return JSON.stringify({ marks: S.marks, names: S.plan.rooms.map(function (m) { return [m.name, m.kind]; }) }); }
  function pushUndo() { S.undo.push(snapState()); if (S.undo.length > 60) S.undo.shift(); }
  function undo() { var s = S.undo.pop(); if (!s) return; var o = JSON.parse(s); S.marks = o.marks; o.names.forEach(function (a, i) { if (S.plan.rooms[i]) { S.plan.rooms[i].name = a[0]; S.plan.rooms[i].kind = a[1]; } }); renderBase(); refresh(); }
  function setTool(t) {
    S.tool = t; pre = null; Array.prototype.forEach.call($('cadTools').querySelectorAll('[data-tool]'), function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === t); b.setAttribute('aria-pressed', b.getAttribute('data-tool') === t ? 'true' : 'false'); });
    $('cadStage').classList.toggle('tool', !!t); $('cadHint').textContent = HINT[t]; $('cadToolOff').hidden = !t;
  }

  // 손가락·마우스 공통
  function down(e) {
    if (e.button > 0) return; var pt = toPt(e), mk = e.target.closest ? e.target.closest('.mk') : null;
    if (mk) { var i = Number(mk.getAttribute('data-i')); D = { mode: 'move', i: i, s: pt, c: [e.clientX, e.clientY], orig: JSON.stringify(S.marks[i]), moved: false }; }
    else if (S.tool === '철거') { var a = snap(pt); D = { mode: '철거', a: a.p, s: pt, c: [e.clientX, e.clientY] }; pre = { line: [a.p, a.p], at: a.p, kind: a.kind }; }
    else if (S.tool === '공사') D = { mode: '공사', s: pt, c: [e.clientX, e.clientY], moved: false };
    else D = { mode: 'tap', s: pt, c: [e.clientX, e.clientY] };
    try { $('cadOver').setPointerCapture(e.pointerId); } catch (x) {}
    if (S.tool || mk) e.preventDefault(); renderOver();
  }
  function endOf(D, pt) {   // 철거선 끝점: 붙기 → 벽에 안 붙었으면 가로·세로로 반듯하게
    var b = snap(pt), q = [b.p[0], b.p[1]], tol = 12 / scale();
    if (b.kind !== '모서리') { if (Math.abs(q[0] - D.a[0]) < tol) q[0] = D.a[0]; else if (Math.abs(q[1] - D.a[1]) < tol) q[1] = D.a[1]; }
    return { p: q, kind: b.kind };
  }
  function move(e) {
    var pt = toPt(e);
    if (!D) { if (e.pointerType === 'mouse' && (S.tool === '철거' || S.tool === '메모')) { var s = snap(pt); pre = s.kind ? { at: s.p, kind: s.kind } : null; renderOver(); } return; }
    var far = Math.hypot(e.clientX - D.c[0], e.clientY - D.c[1]);
    if (D.mode === 'move') {
      if (!D.moved && far < 8) return; var m = S.marks[D.i], o = JSON.parse(D.orig), dx = pt[0] - D.s[0], dy = pt[1] - D.s[1];
      if (m.t === '공사' && !m.box) return;   // 방 전체 표시는 옮길 것이 없다
      if (!D.moved) { D.moved = true; pushUndo(); }
      if (m.t === '메모') { var sp = snap([o.p[0] + dx, o.p[1] + dy]), vb = S.vb, eg = 14 / scale(); sp.p = [r1(Math.max(vb.x + eg, Math.min(vb.x + vb.w - eg, sp.p[0]))), r1(Math.max(vb.y + eg, Math.min(vb.y + vb.h - eg, sp.p[1])))]; m.p = sp.p; pre = { at: sp.p, kind: sp.kind }; }
      else if (m.t === '철거') { m.a = [r1(o.a[0] + dx), r1(o.a[1] + dy)]; m.b = [r1(o.b[0] + dx), r1(o.b[1] + dy)]; }
      else m.box = [r1(o.box[0] + dx), r1(o.box[1] + dy), r1(o.box[2] + dx), r1(o.box[3] + dy)];
    } else if (D.mode === '철거') { var b = endOf(D, pt); pre = { line: [D.a, b.p], at: b.p, kind: b.kind }; }
    else if (D.mode === '공사') { if (far > 14) D.moved = true; if (D.moved) { var p0 = snap(D.s).p, p1 = snap(pt); pre = { box: [p0[0], p0[1], p1.p[0], p1.p[1]], at: p1.p, kind: p1.kind }; } }
    e.preventDefault(); renderOver();
  }
  function up(e) {
    if (!D) return; var d = D, pt = toPt(e), far = Math.hypot(e.clientX - d.c[0], e.clientY - d.c[1]); D = null; pre = null;
    if (d.mode === 'move') { if (d.moved) refresh(); else { renderOver(); edit(d.i, false); } return; }
    if (d.mode === '철거') { var b = far < 12 ? { p: d.a } : endOf(d, pt); add({ t: '철거', a: d.a, b: b.p, text: '' }); return; }
    if (d.mode === '공사') {
      if (d.moved) { var p0 = snap(d.s).p, p1 = snap(pt).p; if (Math.abs(p1[0] - p0[0]) * scale() > 16 && Math.abs(p1[1] - p0[1]) * scale() > 16) { add({ t: '공사', box: [p0[0], p0[1], p1[0], p1[1]], text: '' }); return; } }
      var i = roomAt(pt); if (i < 0) { renderOver(); toast('방 안쪽을 눌러 주세요.'); return; }
      for (var k = 0; k < S.marks.length; k++) if (S.marks[k].t === '공사' && !S.marks[k].box && S.marks[k].room === i) { renderOver(); edit(k, false); return; }
      add({ t: '공사', room: i, text: '' }); return;
    }
    renderOver(); if (far > 12) return;
    if (S.tool === '메모') add({ t: '메모', p: snap(pt).p, text: '' });
    else if (S.tool === '이름') { var j = roomAt(pt); if (j < 0) toast('방 안쪽을 눌러 주세요.'); else rename(j); }
    else if (!S.tool && e.pointerType === 'mouse') toast('위 단추에서 할 일을 먼저 고르세요.');
  }
  function add(m) { pushUndo(); S.marks.push(m); renderOver(); edit(S.marks.length - 1, true); }

  // ───── 적어 넣는 창 ─────
  var sheetAt = 0;   // 창이 뜨자마자 같은 자리에 들어오는 손가락 누름(겹쳐 눌림)은 버린다
  function sheet(html) { $('cadSheet').innerHTML = html; $('cadSheetBg').classList.add('on'); doc.body.classList.add('cad-sheet-on'); sheetAt = Date.now(); }
  function closeSheet() { $('cadSheetBg').classList.remove('on'); doc.body.classList.remove('cad-sheet-on'); $('cadSheet').innerHTML = ''; sheetCancel = null; }
  var sheetCancel = null;
  function edit(i, isNew) {
    var m = S.marks[i]; if (!m) return;
    sheet('<h3>' + (i + 1) + '번 · ' + LABEL[m.t] + '</h3><p class="q">무엇을 해야 하는지 적어 주세요. 아래에서 골라도 됩니다.</p>' +
      '<div class="cad-chips">' + CHIPS[m.t].map(function (c) { return '<button type="button" data-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<textarea id="cadText" placeholder="예: ' + esc(CHIPS[m.t][0]) + '" aria-label="작업 내용">' + esc(m.text) + '</textarea>' +
      (m.t === '철거' ? '<p class="q" style="margin:10px 0 0">집을 받치는 벽(내력벽)은 철거할 수 없습니다. 철거해도 되는 벽인지는 견적 의뢰 때 집지니가 확인해 드립니다.</p>' : '') +
      '<div class="crow">' + (isNew ? '' : '<button type="button" class="cbtn" data-act="del" style="color:#b3261e;border-color:#b3261e">지우기</button>') + '<button type="button" class="cbtn" data-act="no">취소</button><button type="button" class="cbtn dark" data-act="ok">저장</button></div>');
    var ta = $('cadText');
    sheetCancel = function () { if (isNew) { S.undo.pop(); S.marks.splice(i, 1); } closeSheet(); refresh(); };
    $('cadSheet').onclick = function (e) {
      var c = e.target.closest('[data-chip]'), a = e.target.closest('[data-act]');
      if (c) { var v = c.getAttribute('data-chip'), cur = ta.value.trim(); if (cur.indexOf(v) < 0) ta.value = cur ? cur + ', ' + v : v; c.classList.add('on'); return; }
      if (!a) return; a = a.getAttribute('data-act');
      if (a === 'no') return sheetCancel();
      if (a === 'del') { closeSheet(); remove(i); return; }
      var t = ta.value.trim().slice(0, 200); if (!t) { if (m.t === '메모') { toast('내용을 적거나 위에서 골라 주세요.'); return; } t = m.t === '철거' ? '철거' : '공사'; }
      if (!isNew && t !== m.text) pushUndo(); m.text = t; closeSheet(); refresh();
    };
  }
  function remove(i) { if (!S.marks[i]) return; pushUndo(); S.marks.splice(i, 1); S.marks.forEach(function () {}); refresh(); toast('지웠습니다. 「되돌리기」로 살릴 수 있습니다.'); }
  function kindOf(n) { return /거실/.test(n) ? '거실' : /주방|부엌|식당/.test(n) ? '주방' : /욕실|화장실/.test(n) ? '욕실' : /발코니|베란다|다용도/.test(n) ? '발코니' : /현관/.test(n) ? '현관' : /드레스|옷방|파우더/.test(n) ? '드레스룸' : /실외기/.test(n) ? '실외기실' : /방|침실|서재/.test(n) ? '방' : '기타'; }
  function rename(i) {
    var rm = S.plan.rooms[i];
    sheet('<h3>방 이름 바꾸기</h3><p class="q">지금 이름: ' + esc(rm.name) + '</p><div class="cad-chips">' + NAMES.map(function (c) { return '<button type="button" data-chip="' + c + '">' + c + '</button>'; }).join('') + '</div>' +
      '<input type="text" id="cadText" maxlength="12" value="' + esc(rm.name) + '" aria-label="방 이름"><div class="crow"><button type="button" class="cbtn" data-act="no">취소</button><button type="button" class="cbtn dark" data-act="ok">저장</button></div>');
    var inp = $('cadText'); sheetCancel = closeSheet;
    $('cadSheet').onclick = function (e) {
      var c = e.target.closest('[data-chip]'), a = e.target.closest('[data-act]');
      if (c) { inp.value = c.getAttribute('data-chip'); return; }
      if (!a) return; if (a.getAttribute('data-act') === 'no') return closeSheet();
      var v = inp.value.trim(); if (!v) { toast('이름을 적어 주세요.'); return; }
      if (v !== rm.name) { pushUndo(); rm.name = v; rm.kind = kindOf(v); renderBase(); } closeSheet(); refresh();
    };
  }

  // ───── 결과: 도면 + 작업 지시 목록 한 장 ─────
  function wrap(t, maxW, fs) {   // 글자 수로 어림해 줄을 나눈다(한글 1, 그 밖 0.56)
    var out = [], cur = '', w = 0; String(t).split('').forEach(function (ch) { var cw = (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.56) * fs; if (w + cw > maxW && cur) { out.push(cur); cur = ''; w = 0; } cur += ch; w += cw; }); if (cur) out.push(cur); return out;
  }
  function buildSheet() {
    var vb = S.vb, Wd = 1000, mg = 40, F = 'font-family="Pretendard,\'Apple SD Gothic Neo\',\'Malgun Gothic\',\'Noto Sans KR\',sans-serif"', h = [], y;
    var dw = Wd - mg * 2, dh = Math.min(dw * vb.h / vb.w, 720), inner = S.baseHtml.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="100%" height="100%" fill="#[0-9a-fA-F]+"\/>/, ''), r = Math.max(vb.w / dw, vb.h / dh) * 15;
    h.push('<rect x="' + mg + '" y="34" width="46" height="46" rx="6" fill="#2f6b4f"/><text x="' + (mg + 23) + '" y="67" text-anchor="middle" font-size="28" font-weight="800" fill="' + PAPER + '">집</text>');
    h.push('<text x="' + (mg + 60) + '" y="56" font-size="28" font-weight="700" fill="' + INK + '">공사 계획 도면</text><text x="' + (mg + 60) + '" y="79" font-size="15" fill="#6B6B6B">집지니 CAD · jipjini.com</text>');
    h.push('<text x="' + (Wd - mg) + '" y="56" text-anchor="end" font-size="17" font-weight="600" fill="' + INK + '">작업 지시 ' + S.marks.length + '개</text><text x="' + (Wd - mg) + '" y="79" text-anchor="end" font-size="15" fill="#6B6B6B">' + today() + '</text>');
    h.push('<line x1="' + mg + '" y1="96" x2="' + (Wd - mg) + '" y2="96" stroke="' + INK + '" stroke-width="2"/>');
    h.push('<rect x="' + mg + '" y="110" width="' + dw + '" height="' + r1(dh) + '" fill="' + PAPER + '" stroke="#C8C4BC"/>');
    h.push('<svg x="' + mg + '" y="110" width="' + dw + '" height="' + r1(dh) + '" viewBox="' + vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h + '">' + inner + marksSvg(r, 'cadHatchP') + '</svg>');
    y = 110 + dh + 44; h.push('<text x="' + mg + '" y="' + r1(y) + '" font-size="22" font-weight="700" fill="' + INK + '">작업 지시</text>'); y += 14; h.push('<line x1="' + mg + '" y1="' + r1(y) + '" x2="' + (Wd - mg) + '" y2="' + r1(y) + '" stroke="' + INK + '" stroke-width="1.5"/>'); y += 12;
    if (!S.marks.length) { y += 26; h.push('<text x="' + mg + '" y="' + r1(y) + '" font-size="18" fill="#6B6B6B">표시한 작업 지시가 없습니다.</text>'); y += 12; }
    S.marks.forEach(function (m, i) { var lines = wrap(m.text, dw - 70, 20), w = whereOf(m), top = y; y += 30;
      h.push('<circle cx="' + (mg + 17) + '" cy="' + r1(y - 7) + '" r="15" fill="' + COLOR[m.t] + '"/><text x="' + (mg + 17) + '" y="' + r1(y - 1) + '" text-anchor="middle" font-size="' + (i > 8 ? 15 : 17) + '" font-weight="700" fill="#fff">' + (i + 1) + '</text>');
      lines.forEach(function (ln, k) { h.push('<text x="' + (mg + 48) + '" y="' + r1(y + k * 27) + '" font-size="20" font-weight="600" fill="' + INK + '">' + esc(ln) + '</text>'); }); y += (lines.length - 1) * 27;
      y += 23; h.push('<text x="' + (mg + 48) + '" y="' + r1(y) + '" font-size="15" fill="#6B6B6B">' + esc(SHORT[m.t] + (w ? ' · ' + w : '')) + '</text>'); y += 13;
      h.push('<line x1="' + mg + '" y1="' + r1(y) + '" x2="' + (Wd - mg) + '" y2="' + r1(y) + '" stroke="#C8C4BC" stroke-width="1"/>'); void top; });
    y += 34; h.push('<text x="' + mg + '" y="' + r1(y) + '" font-size="14" fill="#6B6B6B">원본 평면도를 집지니가 읽어 다시 그린 참고용 도면입니다. 문·창 위치와 정확한 치수는 현장 실측으로 확정합니다.</text>');
    y += 22; h.push('<text x="' + mg + '" y="' + r1(y) + '" font-size="14" fill="#6B6B6B">붉은 점선 = 철거할 곳 · 초록 빗금 = 공사할 곳 · 검은 번호 = 작업 지시' + (S.plan.mmpp ? '' : '') + '</text>');
    var Ht = Math.ceil(y + 30);
    return { w: Wd, h: Ht, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + Wd + ' ' + Ht + '" ' + F + '><rect width="' + Wd + '" height="' + Ht + '" fill="#fff"/>' + h.join('') + '</svg>' };
  }
  function savePng() {
    var sh = buildSheet(), K = 1.8, s = sh.svg.replace('<svg ', '<svg width="' + sh.w * K + '" height="' + sh.h * K + '" '), img = new Image();
    img.onload = function () { var c = doc.createElement('canvas'); c.width = Math.round(sh.w * K); c.height = Math.round(sh.h * K); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var d = new Date(), name = '집지니CAD_공사계획_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.png';
      var done = function (url) { var a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); if (/^blob:/.test(url)) URL.revokeObjectURL(url); }, 1500); toast('그림으로 저장했습니다. 내려받은 파일을 확인하세요.'); };
      if (c.toBlob) c.toBlob(function (b) { b ? done(URL.createObjectURL(b)) : done(c.toDataURL('image/png')); }, 'image/png'); else done(c.toDataURL('image/png')); };
    img.onerror = function () { toast('그림으로 바꾸지 못했습니다. 「한 장으로 인쇄」를 써 주세요.'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); ev('cad_save_png');
  }
  function printSheet() { $('cadPrint').innerHTML = buildSheet().svg; ev('cad_print'); setTimeout(function () { root.print(); }, 80); }

  // ───── 이어 붙이기 ─────
  function init() {
    var file = $('cadFile'), dropEl = $('cadDrop');
    $('cadPick').addEventListener('click', function (e) { e.stopPropagation(); file.click(); });
    dropEl.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () { var f = file.files && file.files[0]; file.value = ''; pick(f); });
    ['dragenter', 'dragover'].forEach(function (n) { dropEl.addEventListener(n, function (e) { e.preventDefault(); dropEl.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { dropEl.addEventListener(n, function (e) { e.preventDefault(); dropEl.classList.remove('over'); }); });
    dropEl.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; pick(f); });
    doc.addEventListener('paste', function (e) { if (!$('pane1').classList.contains('on')) return; var it = (e.clipboardData && e.clipboardData.items) || []; for (var i = 0; i < it.length; i++) if (/^image\//.test(it[i].type)) { pick(it[i].getAsFile()); break; } });
    $('wayUp').addEventListener('click', function () { $('cadSoon').classList.remove('on'); dropEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
    $('waySearch').addEventListener('click', function () { $('cadSoon').classList.add('on'); ev('cad_search_soon'); });
    $('cadRetry').addEventListener('click', function () { go(1); });
    $('cadAgain').addEventListener('click', function () { S.pending = null; go(1); });
    $('cadFix').addEventListener('click', function () { if (!S.file || !root.JJPlanTools) return; root.JJPlanTools.fixPhoto(S.file).then(function (cv) { if (cv) run(cv); }); });
    $('cadStart').addEventListener('click', function () { if (S.pending) { ev('cad_edit_start'); open(S.pending, []); S.pending = null; } });
    $('cadTools').addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (!b) return; var t = b.getAttribute('data-tool'); setTool(S.tool === t ? '' : t); renderOver(); });
    $('cadToolOff').addEventListener('click', function () { setTool(''); renderOver(); });
    $('cadUndo').addEventListener('click', undo);
    var ov = $('cadOver'); ov.addEventListener('pointerdown', down); ov.addEventListener('pointermove', move); ov.addEventListener('pointerup', up);
    ov.addEventListener('pointercancel', function () { if (D && D.mode === 'move' && D.moved) { S.marks[D.i] = JSON.parse(D.orig); S.undo.pop(); } D = null; pre = null; renderOver(); });
    ov.addEventListener('pointerleave', function () { if (!D && pre) { pre = null; renderOver(); } });
    $('cadList').addEventListener('click', function (e) { var a = e.target.closest('[data-ed]'), b = e.target.closest('[data-del]'); if (a) edit(Number(a.getAttribute('data-ed')), false); else if (b) remove(Number(b.getAttribute('data-del'))); });
    $('cadSheetBg').addEventListener('click', function (e) { if (Date.now() - sheetAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
    $('cadSheetBg').addEventListener('click', function (e) { if (e.target === $('cadSheetBg') && sheetCancel) sheetCancel(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (sheetCancel) sheetCancel(); else if (S.tool) { setTool(''); renderOver(); } } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && $('pane3').classList.contains('on') && !sheetCancel) { e.preventDefault(); undo(); } });
    $('cadPng').addEventListener('click', savePng); $('cadPrintBtn').addEventListener('click', printSheet);
    $('cadQuote').addEventListener('click', function () { ev('cad_quote_click'); });
    $('cadNew').addEventListener('click', function () { if (S.marks.length && !root.confirm('지금 도면과 작업 지시를 지우고 처음부터 다시 할까요?')) return; drop(); S.plan = null; S.marks = []; S.undo = []; $('cadResume').classList.remove('on'); go(1); });
    var rs = 0; root.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(function () { if (S.plan && $('pane3').classList.contains('on')) renderOver(); }, 150); });
    var old = load();
    if (old) { var d = new Date(old.at || Date.now()); $('cadResumeInfo').textContent = '공간 ' + old.plan.rooms.length + '곳 도면 · 작업 지시 ' + (old.marks || []).length + '개 · ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일에 하던 작업';
      $('cadResume').classList.add('on'); $('cadResumeGo').addEventListener('click', function () { open(old.plan, old.marks || []); }); $('cadResumeDrop').addEventListener('click', function () { drop(); $('cadResume').classList.remove('on'); }); }
  }
  root.JJCad = { open: open, version: VER };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window);
