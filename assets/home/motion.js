/* 첫 화면 움직임 (2026-11-16) — first.js 는 그대로 두고, 그 결과(도면 그림·금액·숫자)가 바뀌는 것을 지켜보다 움직임만 더한다.
   움직임을 줄이도록 설정했으면 숫자 세기·그림 효과를 하지 않는다. */
(function () {
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  if (!RM) root.classList.add('jm');
  var $ = function (id) { return document.getElementById(id); };

  // 「30초 안에」 밑줄
  var h1 = document.querySelector('.f1 .fh h1 .fnb'); if (h1) h1.classList.add('jm-u');

  // 로딩 — 집지니 표를 획으로
  var LOAD = '<div class="jm-load" role="status"><svg viewBox="0 0 64 64" aria-hidden="true"><path class="o" d="M8 30 L32 9 L56 30 L56 56 L8 56 Z"/><text class="k" x="32" y="47" text-anchor="middle">집</text></svg><span>우리 집 도면을 펼치는 중</span></div>';
  var plan = $('f1-plan'); if (plan && !plan.innerHTML.trim()) plan.innerHTML = LOAD;

  if (RM) return;

  // 도면이 새로 그려질 때마다: 훑는 선 + 방 차례로 + 벽이 왼쪽부터
  var box = plan && plan.parentNode;
  if (box && !box.querySelector('.jm-scan')) { var sc = document.createElement('i'); sc.className = 'jm-scan'; box.appendChild(sc); }
  if (plan) new MutationObserver(function () {
    var svg = plan.querySelector('svg'); if (!svg || svg.__jm) return; svg.__jm = 1;
    var polys = svg.querySelectorAll('polygon');
    for (var i = 0; i < polys.length; i++) polys[i].style.animationDelay = (0.12 + i * 0.05).toFixed(2) + 's';
    box.classList.remove('jm-draw'); void box.offsetWidth; box.classList.add('jm-draw');
  }).observe(plan, { childList: true });

  // 금액 세어 올라가기 — "3,450만 원" 같은 글을 숫자만 굴린다
  function parse(t) { var m = String(t || '').replace(/\s/g, '').match(/^([\d,]+(?:\.\d+)?)(.*)$/); return m ? { n: Number(m[1].replace(/,/g, '')), d: (m[1].split('.')[1] || '').length, rest: m[2] } : null; }
  function roll(el, from, to, dec, render, ms) {
    var t0 = performance.now(); el.__jmBusy = 1;
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
      render(v.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
      if (k < 1) requestAnimationFrame(step); else el.__jmBusy = 0;
    })(t0);
  }
  var big = $('f1-cbig'), last = 0, first = true;
  if (big) new MutationObserver(function () {
    if (big.__jmBusy) return;
    var small = big.querySelector('small'), num = parse(big.firstChild && big.firstChild.nodeType === 3 ? big.firstChild.nodeValue : '');
    if (!num || !num.n) return;
    var to = num.n, from = first ? 0 : last, sm = small ? small.outerHTML : '';
    last = to; if (from === to) return;
    roll(big, from, to, num.d, function (s) { big.innerHTML = s + num.rest + sm; }, first ? 1100 : 450);
    if (first) { var bars = document.querySelector('.f1 .bars'); if (bars) bars.classList.add('jm-grow'); }
    first = false;
  }).observe(big, { childList: true, characterData: true, subtree: true });

  // 근거 숫자 — 보일 때 한 번 세기
  var proof = document.querySelector('.f1 .fproof');
  if (proof && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; io.disconnect(); proof.classList.add('jm-in');
        proof.querySelectorAll('.three em').forEach(function (em) {
          var p = parse(em.textContent); if (!p || !p.n) return;
          roll(em, 0, p.n, p.d, function (s) { em.textContent = s + p.rest; }, 1200);
        });
      });
    }, { threshold: 0.35 });
    io.observe(proof);
  }
})();
