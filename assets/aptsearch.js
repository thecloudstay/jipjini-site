/* 단지 찾기 — 사이트의 모든 단지 검색이 같이 쓰는 한 벌 (2026-11-22)
   대표 「송파동 한양아파트가 안 나온다」: 예전에는 검색어 전체가 「단지명+구」에 한 덩어리로 들어 있어야만 찾았다.
   동 이름을 붙이거나(송파동 한양), 「아파트」를 붙이거나, 순서를 바꾸면(한양 송파) 못 찾던 것을 고친다.
   JJSearch.rank(검색어, 목록, 꺼내기, 개수) — 꺼내기(행) 은 { n: 단지명, g: 시도·구, d: 동 } 을 돌려준다. */
(function (root) {
  function norm(s) { return String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[\s·,.\-]/g, '').replace(/아파트|apt/g, ''); }
  function locTok(t) { return /(특별시|광역시|시|군|구|동|읍|면|리|가)$/.test(t) && t.length >= 2; }
  function score(q, f) {
    var n = norm(f.n), g = norm(f.g), d = norm(f.d), all = g + d + n, raw = String(q || '').trim();
    var whole = norm(raw); if (whole.length < 1) return 0;
    var s = 0;
    // 한 덩어리로 맞는 경우(가장 믿을 만함)
    if (n === whole) s = 100; else if (n.indexOf(whole) === 0) s = 85; else if (n.indexOf(whole) > 0) s = 70;
    else if ((d + n).indexOf(whole) > -1 || (g + n).indexOf(whole) > -1 || (g + d + n).indexOf(whole) > -1 || (n + d).indexOf(whole) > -1 || (n + g).indexOf(whole) > -1) s = 65;
    if (!s) {
      // 낱말로 나눠서: 모든 낱말이 단지명·구·동 어딘가에 있어야 한다
      var toks = raw.split(/\s+/).map(norm).filter(function (t) { return t; });
      if (toks.length < 2) {
        // 띄어쓰기 없이 「송파동한양」: 앞쪽이 구·동, 뒤쪽이 단지명인지 잘라 본다
        for (var i = 2; i < whole.length - 1 && !s; i++) { var a = whole.slice(0, i), b = whole.slice(i); if ((g.indexOf(a) > -1 || d.indexOf(a) > -1 || (a.length > 2 && (g.indexOf(a.slice(0, -1)) > -1 || d.indexOf(a.slice(0, -1)) > -1) && locTok(a))) && n.indexOf(b) > -1) s = n === b ? 62 : 55; }
        return s ? s - Math.min(8, n.length / 4) : 0;
      }
      var nameHit = 0, ok = true;
      toks.forEach(function (t) {
        if (n.indexOf(t) > -1) { nameHit += t.length; return; }
        if (g.indexOf(t) > -1 || d.indexOf(t) > -1) return;
        if (locTok(t) && t.length > 2 && (g.indexOf(t.slice(0, -1)) > -1 || d.indexOf(t.slice(0, -1)) > -1)) return;   // 「송파동」으로 쳤는데 자료는 「송파구」뿐일 때
        ok = false;
      });
      if (!ok || !nameHit) return 0;
      s = 40 + Math.min(20, nameHit * 3) + (nameHit >= n.length ? 12 : 0);
    }
    return s - Math.min(8, n.length / 4);   // 같은 점수면 이름이 짧은(더 꼭 맞는) 단지가 위
  }
  function rank(q, rows, pick, limit) {
    var out = [];
    for (var i = 0; i < rows.length; i++) { var sc = score(q, pick(rows[i])); if (sc > 0) out.push([sc, i]); }
    out.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    return out.slice(0, limit || 20).map(function (x) { return rows[x[1]]; });
  }
  var api = { norm: norm, score: score, rank: rank };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JJSearch = api;
})(typeof window !== 'undefined' ? window : this);
