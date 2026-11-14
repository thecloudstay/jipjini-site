/* 고객 행동 기록 (2026-11-14 대표 「고객이 얼마나 머물며 어디 클릭해 보는지」)
   견적서·고객 전용 페이지에서 화면이 보이는 동안의 시간, 끝까지 내린 정도, 누른 단추·탭·펼친 칸 이름만 모은다.
   입력한 글·전화번호는 모으지 않는다. 30초마다 바뀐 게 있으면, 그리고 창을 닫거나 다른 앱으로 갈 때 한 번 보낸다.
   받는 곳: 집지니 카톡봇 웹앱(track.gs) → 시트 「고객행동기록」 → 콘솔이 대표에게 알림. 대표·직원 크롬은 ?staff=1 로 한 번 열면 표시만 한다. */
(function () {
  var S = document.currentScript, PG = S && S.getAttribute('data-page'), U = 'https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec';
  var qs = new URLSearchParams(location.search), tok = qs.get(PG === 'quote' ? 'id' : 'k') || (location.pathname.match(/\/p\/([A-Za-z0-9_-]+)/) || [])[1] || '';
  if (!PG || !tok) return;
  var staff = false; try { if (qs.get('staff') === '1') localStorage.setItem('jj_staff', '1'); staff = localStorage.getItem('jj_staff') === '1' || qs.get('pv') === '1'; } catch (e) {}
  var sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8), t0 = Date.now(), vis = document.visibilityState !== 'hidden' ? Date.now() : 0, acc = 0, sc = 0, ev = [], sent = '', dv = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? (/KAKAOTALK/i.test(navigator.userAgent) ? '휴대폰·카톡' : '휴대폰') : 'PC';
  function secs() { return Math.round((acc + (vis ? Date.now() - vis : 0)) / 1000); }
  function at() { return Math.round((Date.now() - t0) / 1000) + '초'; }
  function add(x) { x = String(x || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (!x) return; if (ev.length && ev[ev.length - 1].indexOf(x) > 0) return; ev.push(at() + ' ' + x); if (ev.length > 80) ev.shift(); }
  function nameOf(el) { return (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').replace(/\d{2,3}-\d{3,4}-\d{4}/g, '').trim(); }
  document.addEventListener('click', function (e) { var el = e.target.closest && e.target.closest('a,button,summary,.tab,[data-doc],label,input[type=checkbox],input[type=radio],select'); if (!el) return;
    var k = el.tagName === 'SUMMARY' ? (el.parentNode.open ? '접음: ' : '펼침: ') : el.tagName === 'A' ? '링크: ' : el.classList.contains('tab') ? '탭: ' : '';
    add(k + nameOf(el)); }, true);
  window.addEventListener('scroll', function () { var h = document.documentElement, p = Math.round((h.scrollTop + innerHeight) / Math.max(1, h.scrollHeight) * 100); if (p > sc) sc = Math.min(100, p); }, { passive: true });
  function send(force) { var body = JSON.stringify({ jjt: 1, sid: sid, pg: PG, tok: tok, sec: secs(), sc: sc, ev: ev, dv: dv, staff: staff ? 1 : 0 }), key = secs() + '|' + sc + '|' + ev.length; if (!force && key === sent) return; sent = key;
    try { if (navigator.sendBeacon && navigator.sendBeacon(U, new Blob([body], { type: 'text/plain' }))) return; } catch (e) {}
    try { fetch(U, { method: 'POST', body: body, mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e2) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { if (vis) { acc += Date.now() - vis; vis = 0; } add('화면 떠남'); send(true); } else { vis = Date.now(); add('다시 봄'); } });
  window.addEventListener('pagehide', function () { send(true); });
  setTimeout(function () { send(true); }, 5000); setInterval(function () { if (vis) send(false); }, 30000);
})();
