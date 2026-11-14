/* 집지니 수리 도구 공통(누수 복구 견적·경매 수리비·견적서 비교) — 2026-11-14
   단가: /data/repair-prices.json (tools/repair_prices.py 가 집지니 실견적에서 뽑음)
   단지 찾기: /data/apt/find.json (tools/apt_find_index.py) · 평면: /data/plans/<단지코드>.json
   보내기: 카톡봇 웹앱(kakao-bot/src/fix_tools.gs) — 상담 요청·동의한 익명 단가만 */
(function (root) {
  var API = 'https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec';
  var cache = {};
  function getJSON(u) { if (!cache[u]) cache[u] = fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); cache[u].catch(function () { delete cache[u]; }); return cache[u]; }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function man(n) { var m = Math.round(n / 10000); return m >= 10000 ? Math.floor(m / 10000) + '억' + (m % 10000 ? ' ' + (m % 10000).toLocaleString('ko-KR') + '만' : '') + ' 원' : m.toLocaleString('ko-KR') + '만 원'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function half(n) { return Math.ceil(n * 2) / 2; }
  function docNo(p) { var d = new Date(), z = function (x) { return (x < 10 ? '0' : '') + x; }; return p + '-' + String(d.getFullYear()).slice(2) + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()); }
  function today() { var d = new Date(); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }

  /* 단지 찾기: 글자를 넣으면 find.json 을 한 번 받아 이름·동·구로 찾는다 */
  function aptFinder(input, list, onPick) {
    var rows = null, t = 0;
    function norm(s) { return String(s || '').replace(/\s|아파트|단지|\(.*?\)/g, '').toLowerCase(); }
    function show(q) {
      if (!rows) return; q = norm(q); if (q.length < 2) { list.innerHTML = ''; return; }
      var hit = [];
      for (var i = 0; i < rows.length && hit.length < 30; i++) { var r = rows[i]; if (norm(r[1]).indexOf(q) > -1 || (norm(r[3] + r[1]).indexOf(q) > -1)) hit.push(r); }
      hit.sort(function (a, b) { return b[6] - a[6]; });
      list.innerHTML = hit.slice(0, 12).map(function (r, i) { return '<li><button type="button" data-i="' + rows.indexOf(r) + '">' + esc(r[1]) + '<small>' + esc(r[2] + ' ' + r[3]) + (r[4] ? ' · ' + esc(r[4]) + '년' : '') + (r[6] ? ' · 평면 있음' : '') + '</small></button></li>'; }).join('') || '<li><button type="button" disabled>찾는 단지가 없습니다 — 아래에 평형을 직접 넣어 주세요</button></li>';
    }
    input.addEventListener('input', function () {
      clearTimeout(t); var q = input.value;
      t = setTimeout(function () { if (rows) return show(q); getJSON('/data/apt/find.json').then(function (d) { rows = d; show(input.value); }).catch(function () { list.innerHTML = '<li><button type="button" disabled>단지 목록을 못 불러왔습니다 — 평형을 직접 넣어 주세요</button></li>'; }); }, 180);
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]'); if (!b) return; var r = rows[+b.getAttribute('data-i')];
      list.innerHTML = ''; input.value = r[1];
      onPick({ code: r[0], name: r[1], gu: r[2], dong: r[3], year: Number(r[4]) || 0, homes: r[5], hasPlan: !!r[6] });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.find')) list.innerHTML = ''; });
  }
  function plan(code) { return getJSON('/data/plans/' + code + '.json'); }
  function prices() { return getJSON('/data/repair-prices.json'); }

  /* 가로 막대: rows=[{k:이름, v:금액, lo, hi}] — 가장 큰 값 기준 */
  function bars(rows) {
    var max = 1; rows.forEach(function (r) { max = Math.max(max, r.hi || r.v); });
    return '<div class="bars" role="img" aria-label="공정별 금액">' + rows.map(function (r) {
      return '<div class="bar"><span>' + esc(r.k) + '</span><span class="t"><i style="width:' + (r.v / max * 100).toFixed(1) + '%"></i>' + (r.lo != null ? '<s style="left:' + (r.lo / max * 100).toFixed(1) + '%;width:' + ((r.hi - r.lo) / max * 100).toFixed(1) + '%"></s>' : '') + '</span><span class="v">' + man(r.v) + '</span></div>';
    }).join('') + '</div>';
  }

  /* 칩(누르면 켜짐/꺼짐). single=true 면 하나만 */
  function chips(el, single, onChange) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b || !el.contains(b)) return;
      if (single) { el.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); }
      else b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      onChange && onChange();
    });
  }
  function picked(el) { return Array.prototype.map.call(el.querySelectorAll('.chip[aria-pressed=true]'), function (b) { return b.getAttribute('data-v'); }); }

  /* 보내기: text/plain 으로 보내 미리 묻기(CORS)를 피한다. 답은 못 읽어도 접수는 된다 */
  function send(o) {
    o.jjf = 1; o.at = new Date().toISOString(); o.ref = location.pathname;
    var body = JSON.stringify(o);
    return fetch(API, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: body.length < 60000 }).then(function () { return true; });
  }
  function phoneOk(p) { return /^01[016789]-?\d{3,4}-?\d{4}$/.test(String(p || '').replace(/\s/g, '')); }

  root.JJFix = { getJSON: getJSON, won: won, man: man, esc: esc, r1: r1, half: half, docNo: docNo, today: today, aptFinder: aptFinder, plan: plan, prices: prices, bars: bars, chips: chips, picked: picked, send: send, phoneOk: phoneOk };
})(window);
