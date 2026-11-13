/* 공사 순서대로 쓰이는 시스템 — 단계를 누르면 그 단계의 실제 화면을 휴대폰·모니터 틀에 띄운다 (2026-11-13)
   보이는 동안 4.5초마다 다음 단계로 넘어가고, 사람이 한 번 누르면 그 묶음은 멈춘다. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.sys .ph2').forEach(function (ph) {
    var btns = [].slice.call(ph.querySelectorAll('.phb button'));
    var dv = ph.querySelector('.dv'), img = ph.querySelector('.dscr img'), dx = ph.querySelector('.dx'),
        scr = ph.querySelector('.dscr'), cap = ph.querySelector('.dev figcaption');
    if (!btns.length || !dv) return;
    var cur = -1, timer = null, seen = false, held = false;
    function show(i) {
      if (i === cur) return; cur = i;
      var b = btns[i], src = b.getAttribute('data-s'), k = b.getAttribute('data-k');
      btns.forEach(function (x, j) { x.classList.toggle('on', j === i); x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      dv.className = 'dv ' + (k === 'd' ? 'd' : k === 'm' ? 'm' : 'x');
      if (src) { img.src = src; img.alt = b.querySelector('b').textContent + ' 화면'; img.hidden = false; dx.textContent = ''; }
      else { img.hidden = true; img.removeAttribute('src'); dx.textContent = b.getAttribute('data-c'); }
      cap.textContent = src ? b.getAttribute('data-c') : '';
      scr.scrollTop = 0;
      var ol = b.closest('ol'); if (ol && ol.scrollWidth > ol.clientWidth + 4) ol.scrollTo({ left: Math.max(0, b.parentNode.offsetLeft - ol.offsetLeft - 16), behavior: 'smooth' });
      dv.classList.remove('in'); void dv.offsetWidth; dv.classList.add('in');
    }
    function tick() { if (!held && seen) show((cur + 1) % btns.length); }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { held = true; clearInterval(timer); show(i); });
    });
    ph.addEventListener('mouseenter', function () { held = true; });
    ph.addEventListener('mouseleave', function () { if (!ph.dataset.clicked) held = false; });
    btns.forEach(function (b) { b.addEventListener('click', function () { ph.dataset.clicked = '1'; }); });
    show(0);
    if (reduce || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) { es.forEach(function (e) { seen = e.isIntersecting; }); }, { threshold: 0.4 }).observe(ph);
    timer = setInterval(tick, 4500);
  });
})();
