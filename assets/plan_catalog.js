/* 집지니 「비슷한 평면 고르기」 (2026-11-10)
   JJPlanCat.mount(el, { areaM2: 숫자 또는 함수, onPick: function (결과, 항목) {} , beds, baths })
   자료: /assets/plans/catalog.json + /assets/plans/img/pNNNN.jpg  (없으면 el 을 숨긴다)
   결과: { ok, mmpp:1(면적 있음)/0, rooms:[{ name, kind(거실|방|욕실|발코니|주방|현관|드레스룸|실외기실|기타), area, perim, w, d }], sum:{ 방, 욕실, 발코니, 바닥, 벽, 천장, 걸레받이 }, 예시ID }
   출처 표기 포함 (한국지능정보사회진흥원 「건축 도면 데이터」). */
(function (root) {
  var BASE = 'https://jipjini.com/assets/plans/', CAT = null, WAIT = null;
  var KN = ['거실', '방', '주방', '현관', '발코니', '욕실', '드레스룸', '실외기실', '기타'];
  var CREDIT = '본 서비스는 과학기술정보통신부의 재원으로 한국지능정보사회진흥원의 지원을 받아 구축된 「건축 도면 데이터」를 활용하였습니다.';
  function R1(v) { return Math.round(v * 10) / 10; } function R2(v) { return Math.round(v * 100) / 100; }
  function load() { if (CAT) return Promise.resolve(CAT); if (WAIT) return WAIT; WAIT = fetch(BASE + 'catalog.json', { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw new Error('없음'); return r.json(); }).then(function (j) { if (!j || !Array.isArray(j.plans) || !j.plans.length) throw new Error('빈 자료'); CAT = j; return j; }); return WAIT; }
  function compute(e, m2) {
    m2 = Number(m2) || 0; var nb = 0, nt = 0, nv = 0, ne = 0, rooms = [];
    (e.r || []).forEach(function (q) {
      var kind = KN[q[0]] || '기타', name = kind;
      if (kind === '방') { nb++; name = nb === 1 ? '안방' : '작은방' + (nb - 1); } else if (kind === '욕실') { nt++; name = e.t === 1 ? '욕실' : (nt === 1 ? '공용욕실' : nt === 2 ? '안방욕실' : '욕실' + nt); }
      else if (kind === '발코니') { nv++; name = '발코니' + nv; } else if (kind === '기타') { ne++; name = '기타' + ne; }
      var o = { name: name, kind: kind, share: q[1] };
      if (m2) { o.area = R2(q[1] * m2); o.perim = R2(q[3] * Math.sqrt(o.area)); o.w = R1(Math.sqrt(o.area * q[2])); o.d = o.w ? R1(o.area / o.w) : 0; }
      rooms.push(o); });
    var sum = { 방: e.b, 욕실: e.t, 발코니: e.v };
    if (m2) { var liv = rooms.filter(function (r) { return /거실|방|주방|드레스룸|기타/.test(r.kind) && r.kind !== '실외기실'; });
      sum.바닥 = R1(liv.reduce(function (s, r) { return s + r.area; }, 0)); sum.천장 = sum.바닥; sum.벽 = R1(liv.reduce(function (s, r) { return s + r.perim * 2.4; }, 0)); sum.걸레받이 = R1(liv.reduce(function (s, r) { return s + r.perim; }, 0)); }
    return { ok: true, mmpp: m2 ? 1 : 0, rooms: rooms, sum: sum, 예시ID: e.id, 그림: BASE + 'img/' + e.id + '.jpg' };
  }
  function mount(el, opt) {
    opt = opt || {}; if (!el) return; el.style.display = 'none';
    load().then(function (cat) {
      var st = { b: Number(opt.beds) || 3, t: Number(opt.baths) || 2, n: 8, pick: '' };
      function m2() { return typeof opt.areaM2 === 'function' ? Number(opt.areaM2()) || 0 : Number(opt.areaM2) || 0; }
      function chip(lbl, on, attr) { return '<button type="button" ' + attr + ' style="padding:5px 11px;border-radius:999px;font-size:12.5px;cursor:pointer;border:1px solid ' + (on ? '#23395d;background:#23395d;color:#fff' : '#b8c2d3;background:#fff;color:#223') + '">' + lbl + '</button>'; }
      function draw() {
        var list = cat.plans.filter(function (p) { return p.b === st.b && p.t === st.t; }), h = [];
        h.push('<div style="font-size:12.5px;color:#4d5a70;margin-bottom:6px">도면이 없으면 우리 집과 비슷한 평면을 골라 주세요. 고른 평면의 방 구성 비율에 전용면적을 곱해 방별 크기를 채웁니다.</div>');
        h.push('<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><span style="font-size:12px;color:#666">방</span>' + [1, 2, 3, 4, 5].map(function (n) { return chip(n + '개', st.b === n, 'data-jjc-b="' + n + '"'); }).join('') + '<span style="font-size:12px;color:#666;margin-left:6px">욕실</span>' + [1, 2, 3].map(function (n) { return chip(n + '개', st.t === n, 'data-jjc-t="' + n + '"'); }).join('') + '</div>');
        if (!list.length) h.push('<div style="font-size:12.5px;color:#888;padding:10px 0">이 구성의 예시 평면이 없습니다. 방·욕실 수를 바꿔 보세요.</div>');
        else { h.push('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">' + list.slice(0, st.n).map(function (p) { var on = st.pick === p.id;
            return '<button type="button" data-jjc-p="' + p.id + '" style="padding:0;border:2px solid ' + (on ? '#23395d' : '#dde2ea') + ';border-radius:8px;background:#fff;cursor:pointer;overflow:hidden"><img loading="lazy" src="' + BASE + 'img/' + p.id + '.jpg" alt="예시 평면 방 ' + p.b + ' 욕실 ' + p.t + '" style="width:100%;height:120px;object-fit:contain;display:block;background:#fff"><span style="display:block;font-size:11.5px;padding:3px 0;color:' + (on ? '#23395d;font-weight:700' : '#555') + '">' + (on ? '선택됨' : '발코니 ' + p.v + '곳') + '</span></button>'; }).join('') + '</div>');
          if (list.length > st.n) h.push('<div style="margin-top:6px"><button type="button" data-jjc-more="1" style="padding:5px 12px;border:1px solid #999;background:#fff;border-radius:6px;font-size:12.5px;cursor:pointer">더 보기 (' + (list.length - st.n) + ')</button></div>'); }
        h.push('<div style="font-size:11px;color:#8a8f98;margin-top:8px;line-height:1.5">' + CREDIT + '<br>예시 평면은 실제 우리 집 도면이 아니라 구조가 비슷한 참고 그림입니다.</div>');
        el.innerHTML = h.join(''); el.style.display = '';
      }
      el.addEventListener('click', function (ev) {
        var t = ev.target.closest ? ev.target.closest('button') : null; if (!t || !el.contains(t)) return;
        if (t.hasAttribute('data-jjc-b')) { st.b = Number(t.getAttribute('data-jjc-b')); st.n = 8; draw(); }
        else if (t.hasAttribute('data-jjc-t')) { st.t = Number(t.getAttribute('data-jjc-t')); st.n = 8; draw(); }
        else if (t.hasAttribute('data-jjc-more')) { st.n += 12; draw(); }
        else if (t.hasAttribute('data-jjc-p')) { st.pick = t.getAttribute('data-jjc-p'); var e = cat.plans.filter(function (p) { return p.id === st.pick; })[0]; draw(); if (e && opt.onPick) opt.onPick(compute(e, m2()), e); }
      });
      draw();
    }).catch(function () { el.style.display = 'none'; });
  }
  root.JJPlanCat = { mount: mount, compute: compute, load: load, credit: CREDIT, base: BASE };
})(typeof window !== 'undefined' ? window : this);
