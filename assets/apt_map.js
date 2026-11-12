/* 우리 아파트 찾기 — 시군구 지도(직접 그림) + 단지 목록. 카카오 열쇠가 있으면 구역 안 단지를 카카오 지도에도 찍는다.
   자료: data/apt/index.json(구역·경계·숫자), data/apt/<구역번호>.json(단지 목록). tools/build_apt_map.py 가 만든다.
   단지 상태 s: 2 도면 준비됨 · 1 준비 중(평면 확보) · 0 예정 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var IDX = null, CACHE = {}, CUR = null, TAB = 'all', OPEN = '', SHOWN = 60, ALL = null;
  var ST = ['예정', '준비 중', '도면 준비됨'];
  var ST_HELP = ['아직 평면을 확보하지 못한 단지입니다. 평수나 평면 사진으로 시작하실 수 있습니다.',
    '평면은 확보했고 집지니 도면으로 옮기는 중입니다. 열리기 전에는 평수로 먼저 시작하실 수 있습니다.',
    '이 단지 평면이 집지니 도면으로 준비되어 있습니다.'];
  var num = function (n) { return (n || 0).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function track(name, p) { try { if (window.gtag) window.gtag('event', name, p || {}); } catch (e) {} }

  // 지도 틀: 수도권만. 먼 섬(백령도 등)은 그림 밖으로 둔다.
  var BOX = { x0: 126.08, x1: 127.9, y0: 36.86, y1: 38.32 }, KX = Math.cos(37.55 * Math.PI / 180), SC = 520;
  var W = Math.round((BOX.x1 - BOX.x0) * KX * SC), H = Math.round((BOX.y1 - BOX.y0) * SC);
  function px(p) { return [((p[0] - BOX.x0) * KX * SC), ((BOX.y1 - p[1]) * SC)]; }
  function shade(r) {                      // 평면 확보 비율 → 종이색에서 올리브로
    var t = Math.min(1, r / 0.35), a = [237, 233, 221], b = [91, 107, 46];
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')';
  }
  function el(tag, at, txt) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; return e; }

  var VIEW = null, GEOM = [];
  function drawMap() {
    var svg = $('aptSvg'); svg.innerHTML = '';
    var gA = el('g', {}), gL = el('g', { id: 'aptLabels' }); GEOM = [];
    IDX.구역.forEach(function (r) {
      var tot = r.수[0] + r.수[1] + r.수[2], have = r.수[1] + r.수[2], ratio = tot ? have / tot : 0;
      var d = r.경계.map(function (ring) { return 'M' + ring.map(function (p) { var q = px(p); return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z'; }).join('');
      var path = el('path', { d: d, fill: shade(ratio), 'class': 'rg', tabindex: 0, 'data-id': r.id, role: 'button', 'aria-label': r.짧은시도 + ' ' + r.이름 + ' 단지 ' + tot + '곳, 평면 확보 ' + have + '곳' });
      path.appendChild(el('title', {}, r.짧은시도 + ' ' + r.이름 + ' — 단지 ' + num(tot) + '곳 · 평면 확보 ' + num(have) + '곳'));
      gA.appendChild(path);
      var xs = [], ys = []; r.경계.forEach(function (ring) { ring.forEach(function (p) { var q = px(p); xs.push(q[0]); ys.push(q[1]); }); });
      GEOM.push({ r: r, x0: Math.min.apply(0, xs), x1: Math.max.apply(0, xs), y0: Math.min.apply(0, ys), y1: Math.max.apply(0, ys), c: px(r.가운데), have: have, tot: tot, dark: ratio > 0.2 });
    });
    svg.appendChild(gA); svg.appendChild(gL);
    svg.addEventListener('click', function (e) { var t = e.target.closest('.rg'); if (t) pick(t.getAttribute('data-id')); });
    svg.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('rg')) { e.preventDefault(); pick(e.target.getAttribute('data-id')); } });
    setView('전체');
  }
  // 보는 범위: 전체 · 서울 · 인천 · 경기. 서울은 구가 작아 전체 그림에서는 이름이 겹치므로 따로 크게 본다.
  function setView(name) {
    var g = GEOM.filter(function (m) { return name === '전체' || m.r.짧은시도 === name; }).filter(function (m) { return m.c[0] > 0; });
    var x0 = Math.max(0, Math.min.apply(0, g.map(function (m) { return m.x0; }))), x1 = Math.min(W, Math.max.apply(0, g.map(function (m) { return m.x1; })));
    var y0 = Math.max(0, Math.min.apply(0, g.map(function (m) { return m.y0; }))), y1 = Math.min(H, Math.max.apply(0, g.map(function (m) { return m.y1; })));
    var pad = (x1 - x0) * 0.04; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    VIEW = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, name: name };
    $('aptSvg').setAttribute('viewBox', [x0, y0, x1 - x0, y1 - y0].map(function (v) { return v.toFixed(1); }).join(' '));
    labels();
    Array.prototype.forEach.call(document.querySelectorAll('#aptView button'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === name); });
  }
  function labels() {
    var gL = $('aptLabels'), box = $('aptSvg').getBoundingClientRect(), k = (box.width || 560) / VIEW.w, f = 11 / k; gL.innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('.rg'), function (p) { p.style.strokeWidth = (p.classList.contains('on') ? 2 : 0.9) / k; });
    GEOM.forEach(function (m) {
      var bw = (m.x1 - m.x0) * k, bh = (m.y1 - m.y0) * k, c = m.c;
      if (c[0] < VIEW.x || c[0] > VIEW.x + VIEW.w || c[1] < VIEW.y || c[1] > VIEW.y + VIEW.h) return;
      var nm = m.r.이름.replace(/^.+시 ?(.+구)$/, '$1');
      if (bw < nm.length * 11 + 6 || bh < 20) return;
      var two = bh > 36;
      gL.appendChild(el('text', { x: c[0].toFixed(1), y: (c[1] + (two ? -1 : 3.5) / k).toFixed(1), 'class': 'rl' + (m.dark ? ' w' : ''), 'font-size': f.toFixed(2) }, nm));
      if (two) gL.appendChild(el('text', { x: c[0].toFixed(1), y: (c[1] + 11 / k).toFixed(1), 'class': 'rl n' + (m.dark ? ' w' : ''), 'font-size': (f * 0.9).toFixed(2) }, m.have + '/' + m.tot));
    });
  }
  window.addEventListener('resize', function () { if (VIEW) labels(); });

  function legend() {
    var s = IDX.합계;
    $('aptLegend').innerHTML = [2, 1, 0].map(function (k) { return '<li><span class="mk s' + k + '"></span>' + ST[k] + ' <b>' + num(s[k]) + '</b>곳</li>'; }).join('');
    $('aptAll').textContent = num(s[0] + s[1] + s[2]); $('aptHave').textContent = num(s[1] + s[2]);
    $('aptSrc').textContent = '단지 목록: ' + IDX.출처 + ' · ' + IDX.만든날 + ' 기준. 평면 확보 수는 날마다 늘어납니다. 구역 경계는 2018년 기준이라 그 뒤 나뉜 구(인천 검단·영종·제물포, 부천·화성의 구)는 옛 경계로 묶어 보여 드립니다.';
  }

  function load(id, cb) {
    if (CACHE[id]) return cb(CACHE[id]);
    fetch('data/apt/' + id + '.json?v=' + encodeURIComponent(IDX.판 || IDX.만든날)).then(function (r) { return r.json(); }).then(function (j) { CACHE[id] = j; cb(j); }).catch(function () { cb([]); });
  }
  function region(id) { return IDX.구역.filter(function (r) { return r.id === id; })[0]; }

  function pick(id, openCode) {
    CUR = id; TAB = 'all'; OPEN = openCode || ''; SHOWN = 60;
    Array.prototype.forEach.call(document.querySelectorAll('.rg'), function (p) { p.classList.toggle('on', p.getAttribute('data-id') === id); });
    var r = region(id); if (VIEW.name !== '전체' && VIEW.name !== r.짧은시도) setView(r.짧은시도); else labels(); track('apt_region', { region: r.짧은시도 + ' ' + r.이름 });
    load(id, function (rows) { side(r, rows); kakao(r); if (window.innerWidth < 880) $('aptSide').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  function side(r, rows) {
    var tot = rows.length, n2 = r.수[2], n1 = r.수[1];
    $('aptSideTtl').textContent = r.짧은시도 + ' ' + r.이름;
    $('aptSideSub').innerHTML = '단지 <b>' + num(tot) + '</b>곳 · 도면 준비됨 <b>' + num(n2) + '</b> · 준비 중 <b>' + num(n1) + '</b> · 예정 <b>' + num(r.수[0]) + '</b>';
    $('aptTop').innerHTML = '<div class="apt-ratio" aria-hidden="true"><i class="r2" style="width:' + (tot ? n2 / tot * 100 : 0) + '%"></i><i class="r1" style="width:' + (tot ? n1 / tot * 100 : 0) + '%"></i></div>' +
      '<div class="apt-tabs"><button data-t="all" class="on">전체 ' + num(tot) + '</button><button data-t="have">평면 확보 ' + num(n1 + n2) + '</button></div>';
    list(rows);
  }

  function rowHtml(x, withRegion) {
    var h = '<tr class="row' + (OPEN === x.c ? ' on' : '') + '" data-c="' + x.c + '"' + (x.rid ? ' data-r="' + x.rid + '"' : '') + '><td><span class="mk s' + x.s + '" title="' + ST[x.s] + '"></span></td>' +
      '<td><span class="nm">' + esc(x.n) + '</span><br><span class="dg">' + esc((withRegion ? x.rn + ' ' : '') + x.d) + '</span></td>' +
      '<td class="num">' + (x.h ? num(x.h) : '–') + '</td><td class="num hide-s">' + (x.y || '–') + '</td><td class="num">' + (x.p ? x.p + '개' : '–') + '</td></tr>';
    if (OPEN === x.c) h += detail(x);
    return h;
  }
  function detail(x) {
    var go = x.s === 2 ? '<a class="apt-go" href="cad.html?apt=' + encodeURIComponent(x.c) + '" data-ev="apt_open">이 단지 평면으로 꾸미기</a>'
      : '<a class="apt-go" href="cad.html?from=apt&amp;apt=' + encodeURIComponent(x.c) + '" data-ev="apt_start">' + (x.s === 1 ? '평수로 먼저 시작하기' : '평면 사진이나 평수로 시작하기') + '</a>';
    var wish = x.s === 2 ? '' : '<button class="apt-ln" data-wish="' + x.c + '">이 단지 먼저 열어 달라고 알리기</button>';
    return '<tr class="apt-det"><td colspan="5"><dl><dt>상태</dt><dd>' + ST[x.s] + '</dd><dt>세대수</dt><dd>' + (x.h ? num(x.h) + '세대' : '자료 없음') + '</dd><dt>사용승인</dt><dd>' + (x.y ? x.y + '년' : '자료 없음') + '</dd><dt>평형</dt><dd>' + (x.p ? x.p + '개 확보' : '–') + '</dd></dl>' +
      '<p>' + ST_HELP[x.s] + '</p><div class="apt-act">' + go + wish + '<a class="apt-ln" href="request.html">상담부터 받기</a></div></td></tr>';
  }
  function table(rows, withRegion) {
    if (!rows.length) return '<p class="apt-empty">해당하는 단지가 없습니다.</p>';
    var cut = rows.slice(0, SHOWN);
    return '<table class="apt-tbl"><thead><tr><th></th><th>단지</th><th class="num">세대</th><th class="num hide-s">사용승인</th><th class="num">평형</th></tr></thead><tbody>' +
      cut.map(function (x) { return rowHtml(x, withRegion); }).join('') + '</tbody></table>' +
      (rows.length > SHOWN ? '<p class="apt-more"><button class="apt-ln" data-more="1">' + num(rows.length - SHOWN) + '곳 더 보기</button></p>' : '');
  }
  var LAST = { rows: [], withRegion: false };
  function list(rows, withRegion) {
    LAST = { rows: rows, withRegion: !!withRegion };
    var v = TAB === 'have' ? rows.filter(function (x) { return x.s > 0; }) : rows;
    $('aptList').innerHTML = table(v, withRegion);
  }

  $('aptSide').addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('[data-t]'))) { TAB = b.getAttribute('data-t'); SHOWN = 60; Array.prototype.forEach.call(document.querySelectorAll('.apt-tabs button'), function (x) { x.classList.toggle('on', x === b); }); return list(LAST.rows, LAST.withRegion); }
    if (t.closest('[data-more]')) { SHOWN += 120; return list(LAST.rows, LAST.withRegion); }
    if ((b = t.closest('[data-wish]'))) { track('apt_wish', { apt: b.getAttribute('data-wish') }); b.outerHTML = '<span class="apt-ln" style="text-decoration:none;color:#33491C">알려 주셔서 고맙습니다. 요청이 많은 단지부터 엽니다.</span>'; return; }
    if ((b = t.closest('[data-ev]'))) { track(b.getAttribute('data-ev'), { apt: OPEN }); return; }
    if ((b = t.closest('tr.row'))) { var c = b.getAttribute('data-c'); OPEN = OPEN === c ? '' : c; if (OPEN) { track('apt_pick', { apt: c }); locate(LAST.rows.filter(function (x) { return x.c === c; })[0]); } list(LAST.rows, LAST.withRegion); }
  });

  // 단지 이름 찾기: 처음 찾을 때 구역 파일을 모두 받는다(합쳐 1.3MB쯤).
  var qT = 0;
  function loadAll(cb) {
    if (ALL) return cb(ALL);
    var left = IDX.구역.length, out = [];
    IDX.구역.forEach(function (r) { load(r.id, function (rows) { rows.forEach(function (x) { x.rid = r.id; x.rn = r.짧은시도 + ' ' + r.이름; out.push(x); }); if (!--left) { ALL = out; cb(out); } }); });
  }
  $('aptQ').addEventListener('input', function () {
    var q = this.value.replace(/\s+/g, '').toLowerCase(); clearTimeout(qT);
    if (q.length < 2) { if (CUR) pick(CUR); return; }
    qT = setTimeout(function () {
      loadAll(function (all) {
        var hit = all.filter(function (x) { return (x.n + x.d + x.g).replace(/\s+/g, '').toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return b.s - a.s || b.h - a.h; });
        TAB = 'all'; SHOWN = 60; OPEN = '';
        $('aptSideTtl').textContent = '「' + $('aptQ').value.trim() + '」 찾은 단지';
        $('aptSideSub').innerHTML = '<b>' + num(hit.length) + '</b>곳 · 평면 확보 <b>' + num(hit.filter(function (x) { return x.s > 0; }).length) + '</b>곳';
        $('aptTop').innerHTML = ''; list(hit, true); track('apt_search', { q: $('aptQ').value.trim().slice(0, 30) });
      });
    }, 220);
  });

  // 카카오 지도. 멀리서는 구역마다 「평면 확보 / 전체」 숫자를, 가까이서는 단지마다 핀을 찍는다. 수도권 밖으로는 못 나가게 잠근다.
  var KMAP = null, KOV = [], KPIN = null, RBOX = null, KT = 0;
  function kakaoReady(cb) {
    if (!window.JJ_KAKAO_KEY) return;
    if (window.kakao && window.kakao.maps && window.kakao.maps.Map) return cb();
    if (kakaoReady.q) return kakaoReady.q.push(cb);
    kakaoReady.q = [cb];
    var s = document.createElement('script'); s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=' + encodeURIComponent(window.JJ_KAKAO_KEY);
    s.onload = function () { window.kakao.maps.load(function () { kakaoReady.q.forEach(function (f) { f(); }); kakaoReady.q = null; }); };
    document.head.appendChild(s);
  }
  function kmap(center, level) {
    var K = window.kakao.maps, box = $('aptKakao'); box.hidden = false;
    if (!KMAP) {
      KMAP = new K.Map(box, { center: center || new K.LatLng(37.5, 126.95), level: level || 10 }); KMAP.setMaxLevel(11);
      KMAP.addControl(new K.ZoomControl(), K.ControlPosition.RIGHT);
      var lim = new K.LatLngBounds(new K.LatLng(BOX.y0, BOX.x0), new K.LatLng(BOX.y1, BOX.x1));
      K.event.addListener(KMAP, 'idle', function () {
        var c = KMAP.getCenter(); if (!lim.contain(c)) return KMAP.setCenter(new K.LatLng(Math.min(BOX.y1, Math.max(BOX.y0, c.getLat())), Math.min(BOX.x1, Math.max(BOX.x0, c.getLng()))));
        clearTimeout(KT); KT = setTimeout(pins, 120);
      });
      RBOX = IDX.구역.map(function (r) { var xs = [], ys = []; r.경계.forEach(function (g) { g.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); }); return { r: r, x0: Math.min.apply(0, xs), x1: Math.max.apply(0, xs), y0: Math.min.apply(0, ys), y1: Math.max.apply(0, ys) }; });
      pins();
    } else if (center) { KMAP.relayout(); if (level) KMAP.setLevel(level); KMAP.setCenter(center); }
    return KMAP;
  }
  function pins() {
    if (!KMAP) return; var K = window.kakao.maps, lv = KMAP.getLevel(), bd = KMAP.getBounds(), sw = bd.getSouthWest(), ne = bd.getNorthEast();
    var x0 = sw.getLng(), x1 = ne.getLng(), y0 = sw.getLat(), y1 = ne.getLat();
    var hitR = RBOX.filter(function (b) { return b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1; });
    var wipe = function () { KOV.forEach(function (o) { o.setMap(null); }); KOV = []; };
    $('aptCapK').textContent = lv >= 8 ? '구역의 숫자는 「평면 확보 / 전체 단지」입니다. 누르거나 확대하면 단지마다 핀이 보입니다.' : '진한 핀은 도면 준비됨, 연한 핀은 준비 중, 희끗한 핀은 예정입니다. 핀을 누르면 단지 정보가 열립니다.';
    if (lv >= 8) {                                   // 멀리: 구역 숫자
      wipe();
      hitR.forEach(function (b) {
        var r = b.r, tot = r.수[0] + r.수[1] + r.수[2], have = r.수[1] + r.수[2]; if (r.가운데[0] < x0 || r.가운데[0] > x1 || r.가운데[1] < y0 || r.가운데[1] > y1) return;
        var d = document.createElement('button'); d.className = 'kreg' + (have ? ' has' : ''); d.innerHTML = '<b>' + esc(r.이름.replace(/^.+시 ?(.+구)$/, '$1')) + '</b><span>' + have + ' / ' + num(tot) + '</span>';
        d.onclick = function () { pick(r.id); };
        var ov = new K.CustomOverlay({ position: new K.LatLng(r.가운데[1], r.가운데[0]), content: d, yAnchor: 0.5, zIndex: have ? 2 : 1 }); ov.setMap(KMAP); KOV.push(ov);
      });
      return;
    }
    var left = hitR.length, all = []; if (!left) return wipe();
    hitR.forEach(function (b) { load(b.r.id, function (rows) { rows.forEach(function (x) { if (x.ll && x.ll[1] > x0 && x.ll[1] < x1 && x.ll[0] > y0 && x.ll[0] < y1) { x.rid = b.r.id; all.push(x); } }); if (!--left) draw(); }); });
    function draw() {
      wipe(); all.sort(function (p, q) { return q.s - p.s || q.h - p.h; });
      var cut = all.slice(0, 700), named = lv <= 4;
      cut.forEach(function (x) {
        var d = document.createElement('button'); d.className = 'kpin s' + x.s + (OPEN === x.c ? ' on' : ''); d.title = x.n + ' · ' + ST[x.s];
        d.innerHTML = '<i></i>' + (named || OPEN === x.c ? '<span>' + esc(x.n.replace(/아파트$/, '')) + '</span>' : '');
        d.onclick = function () { openFromMap(x); };
        var ov = new K.CustomOverlay({ position: new K.LatLng(x.ll[0], x.ll[1]), content: d, yAnchor: 0.5, xAnchor: 0, zIndex: OPEN === x.c ? 9 : x.s + 1 }); ov.setMap(KMAP); KOV.push(ov);
      });
      if (all.length > cut.length) $('aptCapK').textContent += ' 이 범위에는 단지가 ' + num(all.length) + '곳 있어 세대수 큰 순으로 ' + cut.length + '곳만 보입니다. 확대하면 더 나옵니다.';
    }
  }
  function openFromMap(x) {
    var r = region(x.rid); OPEN = x.c; track('apt_pick', { apt: x.c, from: 'map' });
    var show = function (rows) { CUR = r.id; side(r, rows); SHOWN = Math.max(60, rows.findIndex(function (y) { return y.c === x.c; }) + 5); list(rows); var tr = document.querySelector('tr.row.on'); if (tr) tr.scrollIntoView({ block: 'center', behavior: 'smooth' }); pins(); };
    load(r.id, show);
  }
  function kakao(r) {
    if (!window.JJ_KAKAO_KEY) return;
    kakaoReady(function () { var K = window.kakao.maps; kmap(new K.LatLng(r.가운데[1], r.가운데[0]), 7); });
  }
  // 단지를 고르면 지도를 그 자리로 옮긴다. 좌표가 없는 단지만 카카오 장소 찾기로 한 번 찾고, 찾은 자리는 이 브라우저에 적어 둔다.
  function locate(x) {
    if (!window.JJ_KAKAO_KEY || !x) return;
    kakaoReady(function () {
      var K = window.kakao.maps, S = K.services;
      var go = function (ll) { x.ll = ll; if (!x.rid) x.rid = CUR; kmap(new K.LatLng(ll[0], ll[1]), 4); pins(); };
      var key = 'jj_apt_ll_' + x.c, mem = null; try { mem = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
      if (x.ll) return go(x.ll); if (mem) return go(mem); if (!S) return;
      var keep = function (ll) { if (ll[0] < BOX.y0 || ll[0] > BOX.y1 || ll[1] < BOX.x0 || ll[1] > BOX.x1) return; try { localStorage.setItem(key, JSON.stringify(ll)); } catch (e) {} go(ll); };
      var byName = function () {
        var reg = region(x.rid || CUR), opt = { size: 15 }; if (reg) { opt.location = new K.LatLng(reg.가운데[1], reg.가운데[0]); opt.radius = 20000; }
        new S.Places().keywordSearch((x.d + ' ' + x.n).trim(), function (res, st) {
          if (st !== S.Status.OK || !res.length) return;
          var k6 = x.n.replace(/\s|아파트$/g, '').slice(0, 6);
          var score = function (p) { return (/아파트/.test(p.category_name || '') ? 4 : 0) + ((p.address_name || '').indexOf(x.d) >= 0 ? 3 : 0) + (p.place_name.replace(/\s/g, '').indexOf(k6) >= 0 ? 2 : 0) - (/분양|모델하우스|상가|부동산|관리사무소|어린이집|경로당/.test(p.place_name + (p.category_name || '')) ? 5 : 0); };
          var hit = res.slice().sort(function (p, q) { return score(q) - score(p); })[0]; if (score(hit) < 5) return;
          keep([+hit.y, +hit.x]);
        }, opt);
      };
      if (x.a) new S.Geocoder().addressSearch(x.a, function (res, st) { if (st === S.Status.OK && res.length) keep([+res[0].y, +res[0].x]); else byName(); });
      else byName();
    });
  }


  // 주소·동 이름으로 찾기: 카카오 주소 찾기 → 그 자리가 속한 구역과 동의 단지 목록을 보여 주고 지도를 옮긴다.
  function inRing(pt, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var a = ring[i], b = ring[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function regionAt(lng, lat) { var hit = null; IDX.구역.forEach(function (r) { if (!hit && r.경계.some(function (ring) { return inRing([lng, lat], ring); })) hit = r; }); return hit; }
  function addrFind() {
    var q = $('aptQ').value.trim(), msg = $('aptAddrMsg'); if (q.length < 2) return;
    if (!window.JJ_KAKAO_KEY) { msg.textContent = '주소로 찾기는 지도 연결 뒤에 쓸 수 있습니다. 단지 이름으로 찾아 주세요.'; return; }
    msg.textContent = '찾는 중입니다…';
    kakaoReady(function () {
      var K = window.kakao.maps, S = K.services;
      var done = function (lat, lng, dong, label) {
        var r = regionAt(lng, lat); if (!r) { msg.textContent = '서울·경기·인천 안의 주소만 찾을 수 있습니다.'; return; }
        msg.textContent = ''; track('apt_addr', { region: r.짧은시도 + ' ' + r.이름 });
        CUR = r.id; TAB = 'all'; OPEN = ''; SHOWN = 60;
        Array.prototype.forEach.call(document.querySelectorAll('.rg'), function (p) { p.classList.toggle('on', p.getAttribute('data-id') === r.id); }); labels();
        load(r.id, function (rows) {
          var near = dong ? rows.filter(function (x) { return x.d === dong || x.d.replace(/\d+가$/, '') === dong.replace(/\d+가$/, ''); }) : [];
          var show = near.length ? near : rows;
          $('aptSideTtl').textContent = near.length ? r.짧은시도 + ' ' + r.이름 + ' ' + dong : r.짧은시도 + ' ' + r.이름;
          $('aptSideSub').innerHTML = '「' + esc(label) + '」 근처 · 단지 <b>' + num(show.length) + '</b>곳 · 평면 확보 <b>' + num(show.filter(function (x) { return x.s > 0; }).length) + '</b>곳' + (near.length ? '' : ' (그 동에는 올려 둔 단지가 없어 구역 전체를 보여 드립니다)');
          $('aptTop').innerHTML = ''; list(show);
          kmap(new K.LatLng(lat, lng), 5);
          if (KPIN) KPIN.setMap(null);
          var pin = document.createElement('div'); pin.className = 'kfind'; pin.title = label;
          KPIN = new K.CustomOverlay({ position: new K.LatLng(lat, lng), content: pin, yAnchor: 1, zIndex: 20 }); KPIN.setMap(KMAP);
          if (window.innerWidth < 880) $('aptSide').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      };
      new S.Geocoder().addressSearch(q, function (res, st) {
        if (st === S.Status.OK && res.length) { var a = res[0], ad = a.address || {}, rd = a.road_address || {}; return done(+a.y, +a.x, ad.region_3depth_name || rd.region_3depth_name || '', a.address_name || q); }
        new S.Places().keywordSearch(q, function (r2, s2) {
          if (s2 !== S.Status.OK || !r2.length) { msg.textContent = '그 주소를 찾지 못했습니다. 도로명이나 동 이름, 단지 이름으로 다시 적어 주세요.'; return; }
          var p = r2[0], parts = (p.address_name || '').split(' '), dong = parts.filter(function (w) { return /(동|가|리)$/.test(w); }).pop() || '';
          done(+p.y, +p.x, dong, p.place_name);
        }, { size: 5 });
      });
    });
  }
  $('aptAddrBtn').addEventListener('click', addrFind);
  $('aptQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addrFind(); } });

  $('aptView').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setView(b.getAttribute('data-v')); });

  fetch('data/apt/index.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    IDX = j; legend(); drawMap();
    if (window.JJ_KAKAO_KEY) kakaoReady(function () { kmap(); });
    var m = /[?&]r=(\d+)/.exec(location.search); if (m && region(m[1])) pick(m[1]);
  }).catch(function () { $('aptSideSub').textContent = '지도 자료를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'; });
})();
