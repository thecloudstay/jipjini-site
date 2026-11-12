/* 집지니 자동적산기 — 첫 화면 체험판 (2026-11-12)
   다시 그린 실제 도면(송도파크자이 131A)의 방을 누르면 그 자리에서 물량과 금액을 셈한다.
   셈법: 바닥 = 방 넓이 / 도배 = 둘레 × 2.3m + 천장 넓이 / 욕실 타일 = 바닥 넓이 + 둘레 × 2.4m (문·창 빼기 전 어림)
   단가: data/real-quotes.json 실제 견적서 단가(공급가) — 강마루 45,000 · 장판 21,000 · 실크 도배 42,000 · 욕실 타일 27,000 원/㎡ */
(function () {
  var box = document.getElementById('estPlan'); if (!box) return;
  var W = {
    maru: { n: '강마루', p: 45000, k: /거실|방|주방/, q: function (r) { return r.a; }, f: '바닥 넓이' },
    jang: { n: '장판', p: 21000, k: /거실|방|주방/, q: function (r) { return r.a; }, f: '바닥 넓이' },
    dobae: { n: '실크 도배', p: 42000, k: /거실|방|주방/, q: function (r) { return r.l * 2.3 + r.a; }, f: '둘레 × 2.3m + 천장' },
    tile: { n: '욕실 타일', p: 27000, k: /욕실/, q: function (r) { return r.a + r.l * 2.4; }, f: '바닥 + 둘레 × 2.4m' }
  };
  var SEL = { maru: {}, jang: {}, dobae: {}, tile: {} }, CUR = 'maru', R = [];
  var won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  fetch('data/plans/A10025531.json').then(function (r) { return r.json(); }).then(function (d) {
    var p = d.평형[0].plan, mm = p.mmpp || 20, xs = [], ys = [];
    p.rooms.forEach(function (r, i) {
      var L = 0, n = r.pts.length; for (var j = 0; j < n; j++) { var a = r.pts[j], b = r.pts[(j + 1) % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      r.pts.forEach(function (q) { xs.push(q[0]); ys.push(q[1]); });
      var sx = 0, sy = 0; r.pts.forEach(function (q) { sx += q[0]; sy += q[1]; });
      R.push({ i: i, n: r.name, k: r.kind, a: r.area || 0, l: L * mm / 1000, pts: r.pts, cx: sx / n, cy: sy / n });
    });
    R.forEach(function (r) { ['maru', 'dobae', 'tile'].forEach(function (w) { if (W[w].k.test(r.k) && r.a > 1) SEL[w][r.i] = 1; }); });
    var x0 = Math.min.apply(0, xs) - 10, y0 = Math.min.apply(0, ys) - 10, w = Math.max.apply(0, xs) - x0 + 10, h = Math.max.apply(0, ys) - y0 + 10;
    var s = ['<svg viewBox="' + [x0, y0, w, h].join(' ') + '" role="group" aria-label="방을 눌러 고르기">'];
    R.forEach(function (r) {
      s.push('<g class="rm k-' + r.k + '" data-i="' + r.i + '" tabindex="0" role="button" aria-label="' + r.n + '"><polygon points="' + r.pts.map(function (q) { return q.join(','); }).join(' ') + '"/>' +
        (r.a > 3 ? '<text x="' + r.cx.toFixed(0) + '" y="' + (r.cy - 2).toFixed(0) + '">' + r.n + '</text><text class="s" x="' + r.cx.toFixed(0) + '" y="' + (r.cy + 16).toFixed(0) + '">' + r.a.toFixed(1) + '㎡</text>' : '') + '</g>');
    });
    s.push('</svg>'); box.innerHTML = s.join('');
    [].forEach.call(box.querySelectorAll('.rm'), function (g) {
      var go = function () { var i = +g.dataset.i, r = R[i]; if (!W[CUR].k.test(r.k)) return; if (SEL[CUR][i]) delete SEL[CUR][i]; else SEL[CUR][i] = 1; draw(); };
      g.addEventListener('click', go); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    draw();
  }).catch(function () { box.innerHTML = '<p class="none">도면을 불러오지 못했습니다</p>'; });
  [].forEach.call(document.querySelectorAll('#est .et button'), function (b) {
    b.onclick = function () { CUR = b.dataset.w; [].forEach.call(document.querySelectorAll('#est .et button'), function (x) { x.classList.toggle('on', x === b); }); draw(); };
  });
  function draw() {
    [].forEach.call(box.querySelectorAll('.rm'), function (g) { var i = +g.dataset.i, r = R[i]; g.classList.toggle('can', W[CUR].k.test(r.k)); g.classList.toggle('on', !!SEL[CUR][i]); });
    var rows = [], sum = 0;
    Object.keys(W).forEach(function (k) {
      var q = 0; Object.keys(SEL[k]).forEach(function (i) { q += W[k].q(R[i]); }); if (!q) return;
      var m = q * W[k].p; sum += m;
      rows.push('<tr' + (k === CUR ? ' class="cur"' : '') + '><th>' + W[k].n + '<small>' + W[k].f + '</small></th><td>' + q.toFixed(1) + '㎡ × ' + W[k].p.toLocaleString('ko-KR') + '</td><td>' + won(m) + '</td></tr>');
    });
    document.getElementById('estRows').innerHTML = rows.join('') || '<tr><th>방을 눌러 고르세요</th><td></td><td></td></tr>';
    document.getElementById('estSum').textContent = won(sum);
  }
})();
