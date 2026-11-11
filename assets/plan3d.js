/* 집지니 도면 입체 보기 — 2026-11-09
   도면 창에서 그린 방 다각형·창·문·척도(픽셀 좌표)를 받아 three.js 로 입체를 만든다.
   콘솔(앱스 스크립트 화면)과 고객 전용 페이지가 같은 파일을 쓴다.  three.js 는 r159 (스크립트 태그용 마지막 판).
   쓰는 법:  var v = JJPlan3D.mount(요소, { shapes: [...], mmpp: 척도(mm/px), wallH: 2400 });  v.setMode('orbit'|'walk'); v.rotate(0.5); v.destroy();
*/
(function (W) {
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js';
  var COLORS = { 거실: 0xd8b98b, 방: 0xdcc39a, 주방: 0xd9d9d6, 욕실: 0xb9d0da, 베란다: 0xc6cbce, 현관: 0xcfc9bf, 다용도: 0xc6cbce };
  function useOf(name) { name = String(name || ''); if (/욕실|화장실/.test(name)) return '욕실'; if (/베란다|발코니/.test(name)) return '베란다'; if (/다용도|세탁/.test(name)) return '다용도'; if (/거실/.test(name)) return '거실'; if (/주방|부엌/.test(name)) return '주방'; if (/현관/.test(name)) return '현관'; return '방'; }
  function loadThree(cb) { if (W.THREE) return cb(); var s = document.createElement('script'); s.src = THREE_URL; s.onload = function () { cb(); }; s.onerror = function () { cb(new Error('입체 라이브러리를 불러오지 못했습니다')); }; document.head.appendChild(s); }
  function centroid(pts) { var x = 0, y = 0; pts.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
  function signedArea(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  // 창·문 선분을 가장 가까운 벽(방 변)에 붙인다 → 벽마다 개구부 구간(t0~t1) 목록
  function attachOpenings(rooms, opens, tolPx) {
    var out = [];
    opens.forEach(function (o) {
      var best = null, mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2;
      rooms.forEach(function (r, ri) { var n = r.pts.length; for (var i = 0; i < n; i++) { var a = r.pts[i], b = r.pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = ((mx - a[0]) * dx + (my - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); var px = a[0] + t * dx, py = a[1] + t * dy, d = Math.hypot(mx - px, my - py); if (!best || d < best.d) best = { d: d, ri: ri, ei: i, a: a, b: b, L2: L2 }; } });
      if (!best || best.d > tolPx) { out.push({ o: o, wall: null }); return; }
      var dx = best.b[0] - best.a[0], dy = best.b[1] - best.a[1], t1 = ((o.x1 - best.a[0]) * dx + (o.y1 - best.a[1]) * dy) / best.L2, t2 = ((o.x2 - best.a[0]) * dx + (o.y2 - best.a[1]) * dy) / best.L2;
      out.push({ o: o, wall: { ri: best.ri, ei: best.ei, t0: Math.max(0, Math.min(t1, t2)), t1: Math.min(1, Math.max(t1, t2)) } });
    });
    return out;
  }
  function mount(el, opt) {
    opt = opt || {}; var shapes = opt.shapes || [], mmpp = Number(opt.mmpp) || 10, wallH = (Number(opt.wallH) || 2400) / 1000, thick = 0.12;
    var rooms = shapes.filter(function (q) { return q.t === 'room' && q.pts && q.pts.length >= 3; }), opens = shapes.filter(function (q) { return q.t === 'win' || q.t === 'door'; });
    var api = { mode: 'orbit', destroy: function () {}, setMode: function () {}, rotate: function () {}, ready: false };
    if (!rooms.length) { el.innerHTML = '<div style="padding:24px;color:#6f7479;font-size:14px;">먼저 도면 창에서 「방 면적」으로 공간을 그려 주세요.</div>'; return api; }
    el.innerHTML = '<div style="padding:24px;color:#6f7479;font-size:14px;">입체를 만드는 중…</div>';
    loadThree(function (err) {
      if (err) { el.innerHTML = '<div style="padding:24px;color:#c0392b;font-size:14px;">' + err.message + '</div>'; return; }
      build();
    });
    function build() {
      var T = W.THREE; el.innerHTML = ''; var width = el.clientWidth || 640, height = Math.max(320, Math.round(width * 0.62));
      var renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, W.devicePixelRatio || 1)); renderer.setSize(width, height); el.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.borderRadius = '12px'; renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.cursor = 'grab';
      var scene = new T.Scene(); scene.background = new T.Color(0xf4f1ea);
      var camera = new T.PerspectiveCamera(55, width / height, 0.05, 500);
      scene.add(new T.HemisphereLight(0xffffff, 0xcfc8b8, 2.6)); var sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(8, 14, 6); scene.add(sun);
      // 픽셀 → 미터 (도면 y 아래쪽이 +z)
      var all = []; rooms.forEach(function (r) { r.pts.forEach(function (p) { all.push(p); }); });
      var minX = Math.min.apply(null, all.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, all.map(function (p) { return p[0]; })), minY = Math.min.apply(null, all.map(function (p) { return p[1]; })), maxY = Math.max.apply(null, all.map(function (p) { return p[1]; }));
      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, k = mmpp / 1000;
      var M = function (p) { return [(p[0] - cx) * k, (p[1] - cy) * k]; };
      var spanX = (maxX - minX) * k, spanZ = (maxY - minY) * k, span = Math.max(spanX, spanZ, 3);
      var wallMat = new T.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.9 }), wallTop = new T.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 });
      var glassMat = new T.MeshStandardMaterial({ color: 0x7fb3e6, transparent: true, opacity: 0.45, roughness: 0.2, metalness: 0.1 }), frameMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      var doorMat = new T.MeshStandardMaterial({ color: 0xa06a3a, roughness: 0.8 });
      var ground = new T.Mesh(new T.PlaneGeometry(span * 4, span * 4), new T.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
      var att = attachOpenings(rooms, opens, Math.max(6, 400 / mmpp));   // 벽에서 40cm 안쪽까지 허용
      var byWall = {}; att.forEach(function (x) { if (!x.wall) return; var key = x.wall.ri + ':' + x.wall.ei; (byWall[key] = byWall[key] || []).push(x); });
      var labels = [];
      rooms.forEach(function (r, ri) {
        var pts = r.pts.map(M), use = useOf(r.name), col = COLORS[use] || COLORS.방;
        // 바닥
        var shp = new T.Shape(); pts.forEach(function (p, i) { i ? shp.lineTo(p[0], -p[1]) : shp.moveTo(p[0], -p[1]); }); shp.closePath();
        var floor = new T.Mesh(new T.ShapeGeometry(shp), new T.MeshStandardMaterial({ color: col, roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001 * (ri + 1); scene.add(floor);
        // 벽 — 변마다 상자. 개구부 구간은 비우고 창은 창대·상인방, 문은 상인방만
        var n = pts.length;
        for (var i = 0; i < n; i++) {
          var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.05) continue;
          var ang = Math.atan2(-dz, dx), ops = (byWall[ri + ':' + i] || []).slice().sort(function (p, q) { return p.wall.t0 - q.wall.t0; });
          var segs = [], t = 0;
          ops.forEach(function (x) { if (x.wall.t0 > t) segs.push({ t0: t, t1: x.wall.t0, y0: 0, y1: wallH }); var isW = x.o.t === 'win', h = Math.min(wallH, (Number(x.o.h) || (isW ? 1200 : 2100)) / 1000), sill = isW ? Math.min(wallH - h, 0.9) : 0;
            if (sill > 0) segs.push({ t0: x.wall.t0, t1: x.wall.t1, y0: 0, y1: sill }); if (sill + h < wallH - 0.01) segs.push({ t0: x.wall.t0, t1: x.wall.t1, y0: sill + h, y1: wallH });
            segs.push({ t0: x.wall.t0, t1: x.wall.t1, y0: sill, y1: sill + h, open: isW ? 'win' : 'door' }); t = Math.max(t, x.wall.t1); });
          if (t < 1) segs.push({ t0: t, t1: 1, y0: 0, y1: wallH });
          segs.forEach(function (s) {
            var len = (s.t1 - s.t0) * L, hh = s.y1 - s.y0; if (len <= 0.005 || hh <= 0.005) return;
            var mx = a[0] + dx * (s.t0 + s.t1) / 2, mz = a[1] + dz * (s.t0 + s.t1) / 2, mesh;
            if (s.open === 'win') { mesh = new T.Mesh(new T.BoxGeometry(len, hh, thick * 0.35), glassMat); var fr = new T.Mesh(new T.BoxGeometry(len + 0.04, hh + 0.04, thick * 0.5), frameMat); fr.position.set(mx, s.y0 + hh / 2, mz); fr.rotation.y = ang; scene.add(fr); }
            else if (s.open === 'door') { mesh = new T.Mesh(new T.BoxGeometry(len * 0.96, hh * 0.98, thick * 0.3), doorMat); mesh.position.x += 0; }
            else { mesh = new T.Mesh(new T.BoxGeometry(len, hh, thick), [wallMat, wallMat, wallTop, wallMat, wallMat, wallMat]); }
            mesh.position.set(mx, s.y0 + hh / 2, mz); mesh.rotation.y = ang; scene.add(mesh);
          });
        }
        // 이름표 (캔버스 글자 스프라이트)
        var c0 = M(centroid(r.pts)), area = Math.abs(signedArea(r.pts)) * k * k, cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; var g = cv.getContext('2d'); g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.fillStyle = '#232F14';
        var txt = String(r.name || '방') + (mmpp && opt.mmpp ? '  ' + area.toFixed(1) + '㎡' : ''); g.strokeText(txt, 256, 82); g.fillText(txt, 256, 82);
        var tex = new T.CanvasTexture(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false })); sp.position.set(c0[0], 0.35, c0[1]); sp.scale.set(Math.max(2.4, span * 0.34), Math.max(0.6, span * 0.085), 1); scene.add(sp); labels.push(sp);
      });
      // 카메라 조작 — 궤도(끌어서 돌리기·바퀴로 확대) / 걷기(1인칭: 끌어서 둘러보기, 화살표·WASD 이동, 화면 아래 단추)
      var st = { mode: 'orbit', theta: 0.7, phi: 0.95, dist: span * 1.6, target: new T.Vector3(0, 0.6, 0), walk: { x: 0, z: 0, yaw: 0, pitch: 0 }, drag: null, keys: {} };
      var first = rooms[0] ? M(centroid(rooms[0].pts)) : [0, 0]; st.walk.x = first[0]; st.walk.z = first[1];
      function place() {
        if (st.mode === 'orbit') { var r = st.dist, y = r * Math.cos(st.phi); camera.position.set(st.target.x + r * Math.sin(st.phi) * Math.sin(st.theta), st.target.y + y, st.target.z + r * Math.sin(st.phi) * Math.cos(st.theta)); camera.lookAt(st.target); }
        else { camera.position.set(st.walk.x, 1.55, st.walk.z); var d = new T.Vector3(Math.sin(st.walk.yaw) * Math.cos(st.walk.pitch), Math.sin(st.walk.pitch), Math.cos(st.walk.yaw) * Math.cos(st.walk.pitch)); camera.lookAt(camera.position.clone().add(d)); }
      }
      function render() { labels.forEach(function (s) { s.visible = st.mode === 'orbit'; }); renderer.render(scene, camera); }
      var dom = renderer.domElement;
      dom.addEventListener('pointerdown', function (e) { st.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { dom.setPointerCapture(e.pointerId); } catch (_c) {} dom.style.cursor = 'grabbing'; e.preventDefault(); });
      dom.addEventListener('pointermove', function (e) { if (!st.drag || e.pointerId !== st.drag.id) return; var dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y; st.drag.x = e.clientX; st.drag.y = e.clientY;
        if (st.mode === 'orbit') { st.theta -= dx * 0.008; st.phi = Math.max(0.15, Math.min(1.45, st.phi - dy * 0.006)); } else { st.walk.yaw -= dx * 0.006; st.walk.pitch = Math.max(-1.2, Math.min(1.2, st.walk.pitch - dy * 0.004)); } place(); render(); });
      var up = function (e) { st.drag = null; dom.style.cursor = 'grab'; }; dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
      dom.addEventListener('wheel', function (e) { e.preventDefault(); if (st.mode === 'orbit') { st.dist = Math.max(span * 0.4, Math.min(span * 5, st.dist * (e.deltaY > 0 ? 1.1 : 0.9))); place(); render(); } }, { passive: false });
      var pinch = null; dom.addEventListener('touchstart', function (e) { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
      dom.addEventListener('touchmove', function (e) { if (e.touches.length === 2 && pinch) { var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); st.dist = Math.max(span * 0.4, Math.min(span * 5, st.dist * pinch / d)); pinch = d; place(); render(); } }, { passive: true });
      function step(fw, side) { var sp = 0.35, yaw = st.walk.yaw; st.walk.x += Math.sin(yaw) * fw * sp + Math.cos(yaw) * side * sp; st.walk.z += Math.cos(yaw) * fw * sp - Math.sin(yaw) * side * sp; place(); render(); }
      var onKey = function (e) { if (st.mode !== 'walk') return; var m = { ArrowUp: [1, 0], KeyW: [1, 0], ArrowDown: [-1, 0], KeyS: [-1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] }[e.code]; if (m) { e.preventDefault(); step(m[0], m[1]); } };
      W.addEventListener('keydown', onKey);
      // 걷기 단추 (휴대폰)
      var pad = document.createElement('div'); pad.style.cssText = 'display:none;gap:6px;justify-content:center;margin-top:6px;'; pad.innerHTML = ['앞으로:1:0', '뒤로:-1:0', '왼쪽:0:-1', '오른쪽:0:1'].map(function (s) { var p = s.split(':'); return '<button type="button" data-mv="' + p[1] + ',' + p[2] + '" style="flex:1;max-width:120px;height:38px;border:1.5px solid #4F6B2C;border-radius:10px;background:#fff;color:#4F6B2C;font:inherit;font-size:13px;font-weight:700;">' + p[0] + '</button>'; }).join(''); el.appendChild(pad);
      pad.addEventListener('click', function (e) { var b = e.target.closest('[data-mv]'); if (!b) return; var v = b.getAttribute('data-mv').split(','); step(Number(v[0]), Number(v[1])); });
      var ro = null; try { ro = new ResizeObserver(function () { var w2 = el.clientWidth || width, h2 = Math.max(320, Math.round(w2 * 0.62)); camera.aspect = w2 / h2; camera.updateProjectionMatrix(); renderer.setSize(w2, h2); render(); }); ro.observe(el); } catch (_r) {}
      api.setMode = function (m) { st.mode = m === 'walk' ? 'walk' : 'orbit'; pad.style.display = st.mode === 'walk' ? 'flex' : 'none'; dom.style.cursor = 'grab'; place(); render(); };
      api.rotate = function (d) { if (st.mode === 'orbit') st.theta += d; else st.walk.yaw += d; place(); render(); };
      api.top = function () { st.mode = 'orbit'; st.phi = 0.15; st.theta = 0; pad.style.display = 'none'; place(); render(); };
      api.destroy = function () { W.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); renderer.dispose(); el.innerHTML = ''; };
      api.ready = true; place(); render();
    }
    return api;
  }
  W.JJPlan3D = { mount: mount, attachOpenings: attachOpenings, useOf: useOf };
})(window);
