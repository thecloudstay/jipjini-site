/* 아파트 지원금 찾기 (2026-11-28, 대표 「정부지원사업도 안내 — 포털식으로 멋지게」)
   자료: data/apt/support.json(사업) · data/apt/find.json(단지 찾기: [번호, 이름, 시도 시군구, 동, 준공, 세대, 도면]) */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var NOW = new Date(), M = NOW.getMonth() + 1, Y = NOW.getFullYear();
  var S = null, FIND = null, sel = null, tab = '전체';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function get(u) { return fetch(u).then(function (r) { return r.json(); }); }

  function fits(p) {
    if (!sel) return true;
    if (p['지역'] && (sel.loc || '').indexOf(p['지역']) !== 0) return false;
    var age = sel.year ? Y - sel.year : null;
    if (p['최소연수'] && (age == null || age < p['최소연수'])) return false;
    if (p['최대준공'] && (!sel.year || sel.year > p['최대준공'])) return false;
    if (p['최대세대'] && (!sel.hh || sel.hh > p['최대세대'])) return false;
    return true;
  }
  function status(p) {
    var ms = p['월'] || [];
    if (ms.length >= 12) return { c: 's1', t: '연중 접수 · 예산 소진 시 마감', k: 1, n: 0 };
    if (ms.indexOf(M) >= 0) return { c: 's1', t: '지금 접수 기간(지난 공고 기준)', k: 1, n: 0 };
    for (var i = 1; i <= 12; i++) {
      var m = (M + i - 1) % 12 + 1;
      if (ms.indexOf(m) >= 0) return { c: i <= 2 ? 's2' : 's3', t: '다음 접수 ' + m + '월쯤 · 약 ' + i + '달 뒤', k: i <= 2 ? 2 : 3, n: i, m: m };
    }
    return { c: 's3', t: '공고 때 확인', k: 3, n: 99 };
  }

  function list() { return (S['사업'] || []).filter(fits); }

  function kpi(L) {
    var open = L.filter(function (p) { return status(p).k === 1; }).length;
    var nx = L.map(status).filter(function (s) { return s.n > 0; }).sort(function (a, b) { return a.n - b.n; })[0];
    $('spK').innerHTML =
      '<div>받을 수 있는 사업<b class="g">' + L.length + '개</b></div>' +
      '<div>지금 접수 중<b>' + open + '개</b></div>' +
      '<div>다음 접수 시작<b>' + (nx ? nx.m + '월' : '-') + '</b>' + (nx ? '약 ' + nx.n + '달 뒤' : '') + '</div>';
  }

  function cal(L) {
    var h = '<table class="cal"><thead><tr><th>사업</th>';
    for (var m = 1; m <= 12; m++) h += '<th' + (m === M ? ' class="now"' : '') + '>' + m + '월</th>';
    h += '</tr></thead><tbody>';
    L.slice().sort(function (a, b) { return (a['월'][0] || 13) - (b['월'][0] || 13); }).forEach(function (p) {
      h += '<tr><td title="' + esc(p['이름']) + '">' + esc(p['이름']) + '</td>';
      for (var m = 1; m <= 12; m++) {
        var on = p['월'].indexOf(m) >= 0;
        h += '<td' + (m === M ? ' class="now"' : '') + '>' + (on ? '<i class="' + (m === M ? 'on' : '') + '"></i>' : '') + '</td>';
      }
      h += '</tr>';
    });
    $('spCal').innerHTML = h + '</tbody></table>';
  }

  function tabs(L) {
    var cnt = { '전체': L.length };
    L.forEach(function (p) { cnt[p['분야']] = (cnt[p['분야']] || 0) + 1; });
    if (!cnt[tab]) tab = '전체';
    $('spTab').innerHTML = Object.keys(cnt).map(function (k) {
      return '<button role="tab" aria-selected="' + (k === tab) + '" data-k="' + esc(k) + '">' + esc(k) + '<small>' + cnt[k] + '</small></button>';
    }).join('');
  }

  function rows(L) {
    var R = L.filter(function (p) { return tab === '전체' || p['분야'] === tab; })
      .map(function (p) { return { p: p, s: status(p) }; })
      .sort(function (a, b) { return a.s.k - b.s.k || a.s.n - b.s.n || (b.p['지역'] || '').length - (a.p['지역'] || '').length; });
    if (!R.length) { $('spOut').innerHTML = '<p class="spempty">이 분야에 맞는 사업이 없습니다. 시·군·구청 주택과의 공동주택 지원 조례 보조금을 확인해 보세요.</p>'; return; }
    var gu = '';
    if (sel && (tab === '전체' || tab === '공용시설') && !L.some(function (p) { return (p['지역'] || '').split(' ').length > 1; })) {
      var a = (sel.loc || '').split(' '); gu = a[1] || '';
      if (a[0] === '경기' && gu.length > 3 && /구$/.test(gu)) gu = gu.slice(0, 2) + '시';
    }
    var tail = gu ? '<article class="spr"><div><h3>' + esc(gu) + ' 공동주택 지원 조례 보조금</h3><p class="who">' + esc(gu) + '청 주택과(공동주택 담당) · 공용시설 · 단지 신청</p>' +
      '<p>수도권 시·군·구는 대부분 조례로 공용시설(옥상 방수·외벽·배관·보안등·놀이터 등) 보수비 일부를 보조합니다. 비율·한도는 지역마다 다릅니다.</p>' +
      '<p class="meta"><span>대개 해마다 연초 공고</span><span>입주자대표회의 의결 → 관리사무소가 신청</span></p></div>' +
      '<div class="amt"><b>지역마다</b><small>구청 공고 확인</small><span class="st s2">대개 1~2월 공고</span></div></article>' : '';
    $('spOut').innerHTML = R.map(function (x) {
      var p = x.p;
      return '<article class="spr"><div><h3>' + esc(p['이름']) + '</h3>' +
        '<p class="who">' + esc(p['주관']) + ' · ' + esc(p['분야']) + ' · ' + esc(p['신청']) + ' 신청</p>' +
        '<p>' + esc(p['내용']) + '</p>' +
        '<p class="meta"><span>대상: ' + esc(p['대상']) + '</span><span>' + esc(p['언제']) + '</span><span>' + esc(p['누가']) + '</span>' +
        '<span><a href="' + esc(p['출처']) + '" target="_blank" rel="nofollow noopener">근거</a> ' + esc(p['근거일']) + '</span></p></div>' +
        '<div class="amt"><b>' + esc(p['비율']) + '</b><small>' + esc(p['한도']) + '</small><span class="st ' + x.s.c + '">' + esc(x.s.t) + '</span></div></article>';
    }).join('') + tail;
  }

  function draw() {
    var L = list();
    if (sel) {
      $('spSel').hidden = false;
      $('spSel').innerHTML = '<b>' + esc(sel.name) + '</b> · ' + esc(sel.loc) + (sel.year ? ' · 준공 ' + (Y - sel.year) + '년째' : '') + (sel.hh ? ' · ' + sel.hh.toLocaleString('ko-KR') + '세대' : '') +
        '에 맞는 사업만 보고 있습니다.<button type="button" id="spClr">전체 보기</button>' +
        (sel.code ? ' <a href="../apt/' + esc(sel.code) + '/#leak">이 단지 누수 위험 점검</a>' : '');
      $('spClr').onclick = function () { sel = null; try { history.replaceState(null, '', location.pathname); } catch (e) {} draw(); };
    } else $('spSel').hidden = true;
    kpi(L); cal(L); tabs(L); rows(L);
  }

  function pick(r) {
    sel = { code: r[0], name: r[1], loc: r[2], year: parseInt(r[4], 10) || null, hh: r[5] || null };
    $('spList').innerHTML = ''; $('spIn').value = '';
    try { history.replaceState(null, '', '?c=' + r[0]); } catch (e) {}
    draw();
  }
  function loadFind() { return FIND ? Promise.resolve(FIND) : get('../data/apt/find.json').then(function (d) { FIND = d; return d; }); }

  $('spIn').addEventListener('focus', loadFind, { once: true });
  $('spIn').addEventListener('input', function () {
    var q = this.value.replace(/\s+/g, '');
    if (q.length < 2) { $('spList').innerHTML = ''; return; }
    loadFind().then(function (F) {
      var out = [];
      for (var i = 0; i < F.length && out.length < 8; i++) {
        var r = F[i]; if ((r[1] + r[2] + r[3]).replace(/\s+/g, '').indexOf(q) >= 0) out.push(r);
      }
      $('spList').innerHTML = out.map(function (r, i) {
        return '<li><button type="button" data-i="' + i + '"><span><b>' + esc(r[1]) + '</b></span><small>' + esc(r[2] + ' ' + r[3]) + (r[4] ? ' · ' + esc(r[4]) + '년' : '') + '</small></button></li>';
      }).join('');
      $('spList').onclick = function (e) { var b = e.target.closest('button'); if (b) pick(out[+b.dataset.i]); };
    });
  });
  $('spTab').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; tab = b.dataset.k; draw(); });

  get('../data/apt/support.json').then(function (d) {
    S = d; $('spN').textContent = (d['사업'] || []).length; $('spD').textContent = d['확인'] || '';
    var c = (location.search.match(/[?&]c=([A-Z0-9]+)/) || [])[1];
    if (c) loadFind().then(function (F) { for (var i = 0; i < F.length; i++) if (F[i][0] === c) { pick(F[i]); return; } draw(); });
    else draw();
  });
})();
