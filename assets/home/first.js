/* 첫 화면 「우리 집 공사비 30초」 (2026-11-16) — 양식은 first.css. 스크립트 꼬리표 data-base 로 사이트 뿌리까지의 길을, data-page 로 쪽 이름을 준다.
   금액: data/repair-prices.json 공종별 평당 금액(집지니 실견적 낮은 4분의 1·가운데·높은 4분의 1) × 공급 평수. 턴키 추정 = 집지니 ÷ 0.7 */
(function () {
  var $ = function (id) { return document.getElementById('f1-' + id); };
  var SC = document.currentScript, BASE = (SC && SC.getAttribute('data-base')) || '', PG = (SC && SC.getAttribute('data-page')) || 'home';
  // 단계별 계측(구글 애널리틱스 이벤트): 찾기 입력 → 단지 고름 → 공종 켜고 끔 → 직접/맡기기 누름. 같은 단계는 한 번 방문에 한 번만 센다(단지 고름·누름은 매번)
  var SENT = {};
  function ev(name, once, extra) { try { if (once && SENT[name]) return; SENT[name] = 1; var o = { page_kind: PG }; if (extra) for (var k in extra) o[k] = extra[k]; if (typeof gtag === 'function') gtag('event', name, o); } catch (e) {} }
  var LIST = [], PR = null, CUR = null, TI = 0, OFF = { '샷시': 1, '베란다': 1, '필름': 1 }, SEL = -1, HIT = [];
  var ORDER = ['철거·준비', '샷시', '설비', '전기·조명', '목공', '욕실·타일', '도장', '필름', '도배', '바닥', '주방', '문·현관', '베란다'];
  var man = function (w) { var m = Math.round(w / 10000); return m >= 10000 ? Math.floor(m / 10000) + '억 ' + (m % 10000 ? (m % 10000).toLocaleString('ko-KR') + '만 원' : '원') : m.toLocaleString('ko-KR') + '만 원'; };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var FILL = { '거실': '#F6F7F4', '방': '#FFFFFF', '주방': '#F6F7F4', '욕실': '#EAF2E6', '발코니': '#EEF0EB', '현관': '#EEF0EB' };

  // 공급 넓이: 평형 이름 앞 숫자(공급 ㎡)가 전용보다 조금 큰 값이면 그대로, 아니면 전용 × 1.32 로 어림
  function supply(t) { var n = parseFloat(String(t['이름']).replace(/[^0-9.].*$/, '')), e = Number(t['전용']) || 0; return (n && e && n > e && n < e * 1.7) ? n : (e ? e * 1.32 : n || 0); }

  function drawPlan(p) {
    var g = p['그림'] || {}, f = g['틀'], x0 = f ? f[0] - 12 : 0, y0 = f ? f[1] - 12 : 0, w = f ? f[2] - f[0] + 24 : p.W, h = f ? f[3] - f[1] + 24 : p.H, s = [];
    s.push('<svg viewBox="' + [x0, y0, w, h].join(' ') + '" role="img" aria-label="평면도">');
    (p.rooms || []).forEach(function (r) { s.push('<polygon points="' + r.pts.map(function (q) { return q.join(','); }).join(' ') + '" fill="' + (FILL[r.kind] || '#FFFFFF') + '" stroke="#DCDFD8" stroke-width="1"/>'); });
    if (g['벽']) s.push('<path d="' + g['벽'] + '" fill="#1C1F1B" fill-rule="' + (g['벽채움'] || 'nonzero') + '"/>');
    (g['샷시'] || []).forEach(function (a) { s.push('<rect x="' + Math.min(a[1], a[3]) + '" y="' + Math.min(a[2], a[4]) + '" width="' + Math.abs(a[3] - a[1]) + '" height="' + Math.abs(a[4] - a[2]) + '" fill="#fff" stroke="#6B7067" stroke-width="1.5"/>'); });
    (p.rooms || []).forEach(function (r) {
      if (!(r.area > 3)) return; var sx = 0, sy = 0, n = r.pts.length; r.pts.forEach(function (q) { sx += q[0]; sy += q[1]; });
      var xs = r.pts.map(function (q) { return q[0]; }), ys = r.pts.map(function (q) { return q[1]; }), cx = (Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2, cy = (Math.min.apply(0, ys) + Math.max.apply(0, ys)) / 2;
      if (n > 4) { cx = sx / n; cy = sy / n; }
      s.push('<text x="' + cx.toFixed(0) + '" y="' + (cy - 3).toFixed(0) + '" text-anchor="middle" font-size="' + (w / 46).toFixed(1) + '" font-weight="600" fill="#1C1F1B">' + esc(r.name) + '</text><text x="' + cx.toFixed(0) + '" y="' + (cy + w / 52 + 2).toFixed(0) + '" text-anchor="middle" font-size="' + (w / 58).toFixed(1) + '" fill="#6B7067">' + r.area.toFixed(1) + '㎡</text>');
    });
    s.push('</svg>'); $('plan').innerHTML = s.join('');
  }

  function calc() {
    if (!CUR || !PR) return; var t = CUR['평형'][TI], py = supply(t) / 3.3058, T = PR.trades, lo = 0, mid = 0, hi = 0, mx = 0;
    ORDER.forEach(function (k) { if (T[k]) mx = Math.max(mx, T[k].p50); });
    var rows = ORDER.filter(function (k) { return T[k]; }).map(function (k) {
      var on = !OFF[k], v = T[k].p50 * py; if (on) { lo += T[k].p25 * py; mid += v; hi += T[k].p75 * py; }
      return '<li class="' + (on ? '' : 'is-off') + '"><label><input type="checkbox" data-k="' + esc(k) + '"' + (on ? ' checked' : '') + '>' + esc(k) + '</label><div class="b"><i style="width:' + (T[k].p50 / mx * 100).toFixed(1) + '%"></i></div><div class="v">' + man(v) + '</div></li>';
    });
    if ($('tl')) $('tl').innerHTML = rows.join('');   // 2026-11-19 첫 화면에서는 공종 목록을 뺐다(대표) — 금액 계산은 그대로
    var all = ORDER.every(function (k) { return !T[k] || !OFF[k]; }), n = ORDER.filter(function (k) { return T[k] && !OFF[k]; }).length;
    var offs = Object.keys(OFF).sort().join(','), base = offs === '베란다,샷시,필름';
    $('clab').textContent = (all ? '올수리(샷시 포함)' : base ? '올수리 기본(샷시·필름·베란다 제외)' : '고른 공사 ' + n + '가지') + ' 예상 공사비 · 공급 ' + Math.round(py) + '평';
    var turn = mid / 0.7;
    $('cbig').innerHTML = mid ? man(mid).replace(/ ?(만 원|원)$/, '<small>$1</small>') : '공사를 골라 주세요';
    $('crng').textContent = mid ? '낮게 ' + man(lo) + ' ~ 높게 ' + man(hi) : '';
    $('vj').textContent = man(mid); $('vt').textContent = man(turn); $('vs').textContent = man(turn - mid) + ' 적게 듭니다';
  }

  function show(code, example) {
    fetch(BASE + 'data/plans/' + code + '.json').then(function (r) { return r.json(); }).then(function (d) {
      CUR = d; CUR.c = code; TI = 0; var best = -1;
      d['평형'].forEach(function (t, i) { var e = Number(t['전용']) || 0; if (best < 0 || Math.abs(e - 84) < Math.abs((Number(d['평형'][best]['전용']) || 0) - 84)) best = i; }); TI = Math.max(0, best);
      var row = LIST.filter(function (x) { return x[0] === code; })[0] || [];
      $('rtag').hidden = !example; $('rname').textContent = d['단지']; $('rsub').textContent = [row[2], row[3], row[4] ? row[4] + '년' : ''].filter(Boolean).join(' · ');
      pick(); if (!example) $('res').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { $('rname').textContent = '도면을 불러오지 못했습니다'; });
  }
  function pick() {
    var t = CUR['평형'][TI], p = t.plan, s = p.sum || {};
    $('types').innerHTML = CUR['평형'].length > 1 ? CUR['평형'].map(function (x, i) { return '<button type="button" data-i="' + i + '" class="' + (i === TI ? 'is-on' : '') + '">' + esc(x['이름']) + ' · 전용 ' + (Number(x['전용']) || 0).toFixed(0) + '㎡</button>'; }).join('') : '';
    drawPlan(p);
    $('pcap').innerHTML = '<span>평형 <b>' + esc(t['이름']) + '</b></span><span>전용 <b>' + (Number(t['전용']) || 0).toFixed(1) + '㎡</b></span><span>방 <b>' + (s['방'] || 0) + '</b> · 욕실 <b>' + (s['욕실'] || 0) + '</b> · 발코니 <b>' + (s['발코니'] || 0) + '</b></span>';
    var q = '?apt=' + encodeURIComponent(CUR.c) + '&n=' + encodeURIComponent(CUR['단지']);
    $('a1').href = BASE + 'cad.html' + q; $('a2').href = BASE + 'req/' + q;
    calc();
  }
  $('a1').addEventListener('click', function () { ev('f1_cta_self', false, { apt: CUR && CUR.c }); });
  $('a2').addEventListener('click', function () { ev('f1_cta_req', false, { apt: CUR && CUR.c }); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es, io) { es.forEach(function (x) { if (x.isIntersecting) { ev('f1_view_result', true); io.disconnect(); } }); }, { threshold: 0.4 }).observe($('res'));
  $('types').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; TI = +b.dataset.i; pick(); });
  if ($('tl')) $('tl').addEventListener('change', function (e) { var k = e.target.dataset.k; if (!k) return; if (e.target.checked) delete OFF[k]; else OFF[k] = 1; calc(); ev('f1_trade', true); });

  // 찾기
  var q = $('q'), sug = $('sug');
  function norm(t) { return String(t || '').replace(/\s+|아파트/g, '').toLowerCase(); }
  function suggest() {
    var k = norm(q.value); SEL = -1;
    if (!k) { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
    HIT = window.JJSearch ? JJSearch.rank(q.value, LIST, function (x) { return { n: x[1], g: x[2], d: x[3] }; }, 8) : [];
    if (!HIT.length) HIT = LIST.filter(function (x) { return norm(x[1]).indexOf(k) >= 0 || norm(x[3]).indexOf(k) >= 0 || norm(x[2]).indexOf(k) >= 0; }).slice(0, 8);   // 동·구 이름만 친 경우
    sug.innerHTML = HIT.length ? HIT.map(function (x, i) { return '<li role="option" id="f1-s' + i + '" data-i="' + i + '"><b>' + esc(x[1]) + '</b><span>' + esc(x[2] + ' ' + x[3]) + ' · 평형 ' + x[6] + '</span></li>'; }).join('') : '<li class="fnone">아직 도면이 열리지 않은 단지입니다. 평형만 알려 주시면 24시간 안에 견적서를 드립니다. <a href="' + BASE + 'req/">의뢰서 쓰기</a></li>';
    sug.hidden = false; q.setAttribute('aria-expanded', 'true');
  }
  function choose(i) { var x = HIT[i]; if (!x) return; ev('f1_pick', false, { apt: x[0], apt_name: x[1], via: 'search' }); q.value = x[1]; sug.hidden = true; q.setAttribute('aria-expanded', 'false'); show(x[0], false); }
  q.addEventListener('input', function () { ev('f1_search', true); suggest(); }); q.addEventListener('focus', suggest);
  q.addEventListener('keydown', function (e) {
    if (sug.hidden || !HIT.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); SEL = (SEL + (e.key === 'ArrowDown' ? 1 : -1) + HIT.length) % HIT.length; [].forEach.call(sug.children, function (li, i) { li.setAttribute('aria-selected', i === SEL ? 'true' : 'false'); }); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(SEL < 0 ? 0 : SEL); }
    else if (e.key === 'Escape') { sug.hidden = true; }
  });
  sug.addEventListener('mousedown', function (e) { var li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
  document.addEventListener('click', function (e) { if (!e.target.closest('.ff')) sug.hidden = true; });
  $('meta').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { ev('f1_pick', false, { apt: b.dataset.c, apt_name: b.textContent, via: 'chip' }); q.value = b.textContent; show(b.dataset.c, false); } });

  Promise.all([fetch(BASE + 'data/plans/open.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }), fetch(BASE + 'data/repair-prices.json').then(function (r) { return r.json(); })]).then(function (a) {
    LIST = a[0]['목록']; PR = a[1];
    if ($('p1')) $('p1').textContent = a[0]['단지'].toLocaleString('ko-KR') + '곳';
    var m = String(PR.source || '').match(/실견적\s*(\d+)건/), o = String(PR.source || '').match(/올수리\s*(\d+)건/);
    if (m && $('p2')) $('p2').textContent = m[1] + '건'; if (o) $('nq').textContent = o[1];
    var ex = LIST.filter(function (x) { return /송도파크자이|반포자이|그랑시티자이/.test(x[1]); }).slice(0, 3);
    $('meta').innerHTML = '지금 도면이 열린 단지 ' + a[0]['단지'].toLocaleString('ko-KR') + '곳 · 평형 ' + a[0]['평형'].toLocaleString('ko-KR') + '개' + (ex.length ? '<br>바로 보기 ' + ex.map(function (x) { return '<button type="button" data-c="' + x[0] + '">' + esc(x[1].replace(/아파트$/, '')) + '</button>'; }).join(' ') : '');
    var first = (LIST.filter(function (x) { return /송도파크자이/.test(x[1]); })[0] || LIST[0]);
    show(first[0], true);
  }).catch(function () { $('meta').textContent = '자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'; });
})();
