/* 살아 있는 숫자 (2026-11-13 대표 지시: 「평면도가 완성되고 통과될수록 홈페이지 숫자·완성률이 저절로 올라가고, 정보가 걸린 모든 곳이 같이 바뀌게」)
   원천은 두 파일뿐이다. 대표 컴퓨터가 도면을 통과시켜 올릴 때마다(publish_pc.py → apt_ready.py) 이 두 파일이 바뀌고, 쪽은 열 때마다 새로 읽는다.
     data/apt/index.json     합계 [평면 없음, 평면 확보, 도면 열림] 단지 수
     data/plans/opened.json  날마다 열린 단지·평형 수 기록
   쓰는 법: 숫자를 넣을 자리에 data-live="이름", 막대에 data-live-bar="이름"(너비 %)
     all 지도 단지 · have 평면 확보 단지 · open 도면 열린 단지 · types 열린 평형 · today 오늘 새로 열린 평형
     pct 확보 단지 중 도면 완성률(%) · pctAll 전체 단지 중 완성률(%) · date 마지막으로 바뀐 날 */
(function () {
  'use strict';
  var base = (document.querySelector('script[src*="live_stats.js"]') || {}).getAttribute ? document.querySelector('script[src*="live_stats.js"]').getAttribute('src').replace(/assets\/live_stats\.js.*$/, '') : '';
  function get(u) { return fetch(base + u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
  function n(x) { return Number(x || 0).toLocaleString('ko-KR'); }
  function p1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  Promise.all([get('data/apt/index.json').catch(function () { return null; }), get('data/plans/opened.json').catch(function () { return []; })]).then(function (r) {
    var idx = r[0], log = r[1] || [], t = (idx && idx.합계) || null, last = log[log.length - 1] || null, prev = log[log.length - 2] || null;
    var S = {};
    if (t) { S.all = t[0] + t[1] + t[2]; S.have = t[1] + t[2]; S.open = t[2]; }
    if (last) { S.types = last.평형; S.open = Math.max(S.open || 0, last.단지 || 0); S.date = last.날; S.today = prev ? Math.max(0, last.평형 - prev.평형) : last.평형; }
    if (S.have) S.pct = S.open / S.have * 100;
    if (S.all) S.pctAll = S.open / S.all * 100;
    var txt = { pct: S.pct != null ? p1(S.pct) : null, pctAll: S.pctAll != null ? (S.pctAll < 1 ? (Math.round(S.pctAll * 100) / 100).toFixed(2) : p1(S.pctAll)) : null,
      date: S.date ? S.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, function (_, y, m, d) { return Number(m) + '월 ' + Number(d) + '일'; }) : null };
    document.querySelectorAll('[data-live]').forEach(function (e) {
      var k = e.getAttribute('data-live'); if (S[k] == null) return;
      e.textContent = txt[k] != null ? txt[k] : n(S[k]);
    });
    document.querySelectorAll('[data-live-bar]').forEach(function (e) {
      var k = e.getAttribute('data-live-bar'), v = S[k]; if (v == null) return;
      e.style.width = Math.max(0.6, Math.min(100, v)) + '%'; e.setAttribute('aria-valuenow', p1(v));
    });
    window.JJ_LIVE = S;
  });
})();
