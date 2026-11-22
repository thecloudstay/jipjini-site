/* 단지 입체 (2026-11-22). 국토교통부 건물통합정보의 동별 도형을 동별 높이만큼 세워 그린다.
   JJd3.mount(상자, 단지코드, 뿌리경로, {spin:true}) — 자료가 없으면 상자를 감춘다. 쓰리제이에스는 화면에 들어올 때 불러온다. */
(function () {
  'use strict';
  var V = '20261122c', lib = null;
  function load(root) {
    if (lib) return lib;
    function one(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
    lib = one(root + 'assets/vendor/three-r128.min.js').then(function () { return one(root + 'assets/vendor/three-r128-orbit.js'); });
    return lib;
  }
  function css(n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || d; }
  function draw(box, B, opt) {
    var T = window.THREE, cv = document.createElement('canvas'), tip = document.createElement('div'), cap = document.createElement('p');
    cv.setAttribute('aria-label', '단지 입체도'); cv.tabIndex = 0;
    tip.className = 'd3tip'; tip.hidden = true; cap.className = 'd3cap';
    var big = B.filter(function (b) { return b.f >= 3; }), fs = big.map(function (b) { return b.f; });
    cap.textContent = big.length + '동 · ' + (Math.min.apply(0, fs) === Math.max.apply(0, fs) ? Math.max.apply(0, fs) + '층' : Math.min.apply(0, fs) + '~' + Math.max.apply(0, fs) + '층');
    box.appendChild(cv); box.appendChild(tip); box.appendChild(cap);
    var R = new T.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var S = new T.Scene(), C = new T.PerspectiveCamera(36, 1, 1, 20000), K = new T.OrbitControls(C, cv);
    S.background = new T.Color('#F3F5F1'); K.maxPolarAngle = 1.52; K.enableDamping = true; K.enableZoom = !opt.spin; K.enablePan = false;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
    K.autoRotate = !!opt.spin && !still; K.autoRotateSpeed = 0.6;
    S.add(new T.HemisphereLight(0xffffff, 0x8f988f, 0.8)); var sun = new T.DirectionalLight(0xffffff, 0.4); sun.position.set(-300, 600, 250); S.add(sun);
    var wall = new T.MeshLambertMaterial({ color: '#C9D8CC' }), roof = new T.MeshLambertMaterial({ color: css('--jj-green', '#1F5E2E') }), hi = new T.MeshLambertMaterial({ color: '#8FB39A' }),
      low = new T.MeshLambertMaterial({ color: '#DCDFD8' }), edge = new T.LineBasicMaterial({ color: '#6B7067' }), pick = [], ext = 0, hmax = 0;
    B.forEach(function (b, j) {
      var sh = new T.Shape(b.p.map(function (q) { return new T.Vector2(q[0], q[1]); })), isBig = b.f >= 3;
      var geo = new T.ExtrudeGeometry(sh, { depth: isBig ? b.h : 3, bevelEnabled: false }), m = new T.Mesh(geo, isBig ? [roof, wall] : [low, low]);
      m.rotation.x = -Math.PI / 2; m.userData = j; S.add(m);
      if (isBig) { pick.push(m); var e = new T.LineSegments(new T.EdgesGeometry(geo, 30), edge); e.rotation.x = -Math.PI / 2; S.add(e); hmax = Math.max(hmax, b.h); }
      b.p.forEach(function (q) { ext = Math.max(ext, Math.sqrt(q[0] * q[0] + q[1] * q[1])); });
    });
    var g = new T.Mesh(new T.CircleGeometry(ext * 1.25, 72), new T.MeshLambertMaterial({ color: '#E9ECE5' })); g.rotation.x = -Math.PI / 2; g.position.y = -0.2; S.add(g);
    K.target.set(0, hmax * 0.3, 0); var end = new T.Vector3(-ext * 1.0, ext * 0.85 + hmax * 0.5, ext * 1.25); C.far = ext * 14; K.maxDistance = ext * 5;
    // 처음 한 번: 위에서 내려오며 다가온다 (움직임 줄이기 설정이면 바로 제자리)
    var t0 = 0, from = new T.Vector3(-ext * 0.3, ext * 3.2, ext * 2.4), fly = !!opt.fly && !still;
    C.position.copy(fly ? from : end); K.update();
    var ray = new T.Raycaster(), sel = null, down = null;
    cv.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; K.autoRotate = false; });
    cv.addEventListener('pointerup', function (e) {
      if (!down || Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 6) return;
      var r = cv.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), C);
      var h = ray.intersectObjects(pick)[0]; if (sel) sel.material = [roof, wall]; sel = h ? h.object : null;
      if (!sel) { tip.hidden = true; return; }
      sel.material = [roof, hi]; var b = B[sel.userData]; tip.textContent = ''; var t = document.createElement('b'); t.textContent = b.n || '동';
      tip.appendChild(t); tip.appendChild(document.createTextNode(' ' + b.f + '층 · 높이 ' + b.h + 'm')); tip.hidden = false;
      tip.style.left = Math.max(4, Math.min(e.clientX - r.left + 12, r.width - 170)) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px';
    });
    function fit() { var w = cv.clientWidth, h = cv.clientHeight; if (!w) return; R.setSize(w, h, false); C.aspect = w / h; C.updateProjectionMatrix(); }
    window.addEventListener('resize', fit); fit();
    var on = true; if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; }).observe(cv);
    var dead = false; box._d3stop = function () { dead = true; R.dispose(); window.removeEventListener('resize', fit); };
    (function loop(ts) { if (dead) return; if (on) {
      if (fly) { if (!t0) t0 = ts || 1; var k = Math.min(1, ((ts || 1) - t0) / 1800), e = 1 - Math.pow(1 - k, 3); C.position.lerpVectors(from, end, e); if (k >= 1) fly = false; }
      K.update(); R.render(S, C); } requestAnimationFrame(loop); })();
    box.classList.add('ok');
  }
  function mount(box, code, root, opt) {
    opt = opt || {}; root = root || '';
    function seen(fn) { if (!('IntersectionObserver' in window)) return fn(); var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: '300px' }); io.observe(box); }
    // 자료가 있는지는 바로 확인(없으면 칸을 곧장 감춤), 무거운 그리기 도구는 화면에 들어올 때 불러온다
    fetch(root + 'data/acb/d3/' + code + '.json?v=' + V).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (B) { if (!B.length) throw 0; seen(function () { load(root).then(function () { if (box._d3stop) box._d3stop(); box.textContent = ''; draw(box, B, opt); if (opt.done) opt.done(B); }); }); })
      .catch(function () { if (opt.fail) return opt.fail(); var w = box.closest('[data-d3wrap]') || box; w.hidden = true; });
  }
  window.JJd3 = { mount: mount };
})();
