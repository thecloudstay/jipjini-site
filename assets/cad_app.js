/* 집지니 CAD (2026-11-11) — 공개 쪽 cad.html 의 걸음 이어 주기(올리기 → 도면 확인 → 편집기 열기)
   흐름: ① 도면 그림 올리기 → ② JJPlanTools.analyze 로 방 나누기 + JJPlanStyle 로 다시 그려 보여 주기 → ③ 편집기(assets/cad_editor.js — 콘솔 도면 편집기와 같은 화면)에서 공종 기호·수량표·작업지시서
   편집기는 「분석 결과(방 다각형 목록)」만 있으면 시작한다: JJCad.open({ rooms:[{ name, kind, area, pts }], W, H, mmpp, sum, 창, 문, 외곽, 치수줄 })
     → 올리기 걸음과 떨어져 있어, 나중에 「우리 집 검색」으로 미리 다시 그려 둔 도면을 받아도 같은 편집기를 그대로 쓴다.
   지키는 선: 올린 원본 그림은 이 기기 밖으로 보내지 않고 보관하지도 않는다(다시 그린 도면 자료와 표시만 localStorage 에 둔다). 인쇄·저장물에는 다시 그린 도면만 들어간다. 바깥 꾸러미 없음. */
(function (root) {
  var KEY = 'jj_cad_v2', OLDKEY = 'jj_cad_v1', VER = '20261111j', doc = document, $ = function (id) { return doc.getElementById(id); };
  var S = { state: null, file: null, pending: null };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ev(name) { try { if (root.gtag) root.gtag('event', name); } catch (e) {} }
  function r1(v) { return Math.round(v * 10) / 10; }
  var toastT = 0;
  function toast(t) { var el = $('cadToast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 3200); }
  function today() { var d = new Date(); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }

  // ───── 보관(이 기기에만) ─────
  function save() { try { if (S.state) localStorage.setItem(KEY, JSON.stringify(S.state)); } catch (e) {} }
  // 옛 판(jj_cad_v1: 번호 스티커·방 빗금)으로 남은 작업은 지금 도형으로 바꿔 연다. 못 바꾸면 조용히 지우고 새로 시작한다.
  function load(cb) {
    var o = null, old = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (o && o.v === 2 && o.shapes && o.shapes.length && o.W) return cb(o);
    try { old = JSON.parse(localStorage.getItem(OLDKEY) || 'null'); } catch (e) { old = null; }
    if (!(old && old.plan && old.plan.rooms && old.plan.rooms.length)) { if (old) { try { localStorage.removeItem(OLDKEY); } catch (e) {} } return cb(null); }
    loadEditor(function () { var st = null; try { st = root.JJCadEditor.fromV1(old); if (st) st.at = old.at || Date.now(); } catch (e) { st = null; } if (!st) { try { localStorage.removeItem(OLDKEY); } catch (e) {} } cb(st); });
  }
  function drop() { try { localStorage.removeItem(KEY); localStorage.removeItem(OLDKEY); } catch (e) {} }

  // ───── 걸음 바꾸기 ─────
  function go(n) {
    if (n !== 3 && root.JJCadEditor && edReady) root.JJCadEditor.leave();
    [1, 2, 3].forEach(function (i) { $('pane' + i).classList.toggle('on', i === n); });
    Array.prototype.forEach.call($('cadSteps').children, function (li) { var s = Number(li.getAttribute('data-s')); li.classList.toggle('on', s === n); li.classList.toggle('done', s < n); });
    doc.body.classList.toggle('cad-sheet-on', n === 3);   // 편집 걸음에서는 상담 도우미 단추가 도구를 가리지 않게 숨긴다
    try { root.scrollTo(0, Math.max(0, $(n === 3 ? 'pane3' : 'cadSteps').getBoundingClientRect().top + root.pageYOffset - 76)); } catch (e) {}
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
      창: (r.창 || []).map(function (w) { return { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, 종류: w.종류, w_m: w.w_m, h_mm: w.h_mm, 안: w.안 }; }),
      문: (r.문 || []).map(function (w) { return { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }; }),
      외곽: r.외곽 || null, 치수줄: r.치수줄 || null }));
  }
  function showResult(r) {
    var p = S.pending; $('cadWait').hidden = true; $('cadRes').hidden = false;
    $('cadPaper').innerHTML = root.JJPlanStyle.svg(p, { title: '우리 집 평면 구성도', date: today() });
    var su = p.sum || {}, cnt = function (k) { return p.rooms.filter(function (m) { return m.kind === k; }).length; }, rows = [['찾은 공간', p.rooms.length + '곳']];
    if (cnt('방')) rows.push(['방', cnt('방') + '칸']); if (cnt('욕실')) rows.push(['욕실', cnt('욕실') + '곳']); if (cnt('발코니')) rows.push(['발코니', cnt('발코니') + '곳']); if (su.전용합) rows.push(['실내 넓이(어림)', su.전용합 + '㎡']);
    $('cadSum').innerHTML = rows.map(function (x) { return '<li><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></li>'; }).join('');
    var note = '', g = r && r.글자;
    if (g && !g.방이름) note = '방 이름 글자를 읽지 못해 이름을 어림으로 붙였습니다. 다음 걸음에서 방을 눌러 바로 고칠 수 있습니다.';
    else if (!p.mmpp || (p.척도 && p.척도.방식 === '없음')) note = '크기 기준을 찾지 못해 넓이는 표시하지 않았습니다. 전용면적을 넣고 다시 올리면 넓이가 나옵니다.';
    $('cadResNote').hidden = !note; $('cadResNote').textContent = note; ev('cad_read_ok');
  }

  // ───── ③ 편집기 — 화면과 조작은 assets/cad_editor.js (콘솔 도면 편집기를 옮긴 것). 여기서는 이어 주기만 한다 ─────
  var edReady = false;
  function loadEditor(ok) {
    var mountIt = function () { if (!edReady) { root.JJCadEditor.mount($('cadEd'), { toast: toast, onEvent: ev, onChange: function (st) { S.state = st; save(); }, onRestart: restart }); edReady = true; } ok(); };
    if (root.JJCadEditor) return mountIt();
    var sc = doc.createElement('script'); sc.src = 'assets/cad_editor.js?v=' + VER; sc.onload = mountIt; sc.onerror = function () { toast('편집 화면을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 해 보세요.'); }; doc.head.appendChild(sc);
  }
  // 편집기는 「방 다각형 목록」만 있으면 시작한다. plan = { rooms:[{ name, kind, area, pts }], W, H, mmpp, 창, 문, 외곽, 치수줄 } 또는 이미 저장된 편집 상태({ v:2, shapes })
  function open(plan) {
    if (!plan || !((plan.rooms && plan.rooms.length) || (plan.shapes && plan.shapes.length))) return false;
    loadEditor(function () {
      var st = plan.shapes ? plan : root.JJCadEditor.fromPlan(plan); if (!st) { toast('도면을 열지 못했습니다.'); return; }
      go(3); if (!root.JJCadEditor.open(st)) { toast('도면을 열지 못했습니다.'); go(1); return; } S.state = st; save();
    });
    return true;
  }
  function restart() {
    if (!root.confirm('지금 도면과 작업 지시를 지우고 처음부터 다시 할까요?')) return;
    drop(); S.state = null; if (root.JJCadEditor) root.JJCadEditor.leave(); $('cadResume').classList.remove('on'); go(1);
  }

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
    $('cadRetry').addEventListener('click', function () { go(1); });
    $('cadAgain').addEventListener('click', function () { S.pending = null; go(1); });
    $('cadFix').addEventListener('click', function () { if (!S.file || !root.JJPlanTools) return; root.JJPlanTools.fixPhoto(S.file).then(function (cv) { if (cv) run(cv); }); });
    $('cadStart').addEventListener('click', function () { if (S.pending) { ev('cad_edit_start'); open(S.pending); S.pending = null; } });
    $('cadQuote').addEventListener('click', function () { ev('cad_quote_click'); });
    $('cadNew').addEventListener('click', restart);
    load(function (old) {
      if (!old) return; var d = new Date(old.at || Date.now()), nr = old.shapes.filter(function (q) { return q.t === 'room'; }).length, nw = old.shapes.filter(function (q) { return q.t === 'wk'; }).length;
      $('cadResumeInfo').textContent = '공간 ' + nr + '곳 도면 · 작업 기호 ' + nw + '개 · ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일에 하던 작업';
      $('cadResume').classList.add('on'); $('cadResumeGo').addEventListener('click', function () { open(old); }); $('cadResumeDrop').addEventListener('click', function () { drop(); $('cadResume').classList.remove('on'); });
    });
  }
  root.JJCad = { open: open, version: VER };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window);
