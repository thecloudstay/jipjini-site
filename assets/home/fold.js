/* 2026-11-14 대표 「홈페이지에 텍스트가 많다 — 시각화·계량화, 최대 단순화」
   첫 화면·데이터·대상·단지 찾기·바로 써 보기만 펼쳐 두고, 나머지 열 단락은 「제목 + 숫자 한 줄」로 접는다.
   글은 쪽 안에 그대로 있다(검색엔진·링크용). 주소 끝 #how 처럼 그 단락으로 오면 저절로 펼친다. */
(function () {
  var F = [
    ['how', '그 30%는 어디서', '업체 마진 30~46%', '집지니 마진 0%'],
    ['pain', '답답했던 6가지', '바가지 · 비교 불가 · 늦은 견적', '단가 공개 · 자동 물량 · 24시간'],
    ['cp', '고객 전용 페이지', '링크 하나', '견적 · 공정 · 사진 · 정산'],
    ['safe', '맡겨도 되는 이유', '하자 12개월', '대금은 공정 확인 뒤 지급'],
    ['pos', '시장에서의 자리', '일반 업체 · 반셀프 · 집지니', '32평 기준 비교'],
    ['sys', '공사 단계별 시스템', '전 · 중 · 후', '단계마다 붙는 도구'],
    ['suite', '집지니 제품', 'CAD · DB · ERP · CRM', '적산기 · 데이터'],
    ['tech', '이어진 구조', '도면 1장이', '물량 · 견적 · 지시서 · 고객 화면까지'],
    ['room', '가양동 샘플실', '견본 실물 상담', '서울 강서구'],
    ['ir', '집지니 IR', '13년', '사업 이력 · 투자 자료']
  ];
  function wrap(id, t, a, b) {
    var s = document.getElementById(id); if (!s || s.querySelector('details.fd')) return;
    var d = document.createElement('details'); d.className = 'fd';
    var sm = document.createElement('summary'); sm.innerHTML = '<span class="fd-t">' + t + '</span><span class="fd-a">' + a + '</span><span class="fd-b">' + b + '</span><i aria-hidden="true"></i>';
    var body = document.createElement('div'); body.className = 'fd-body';
    while (s.firstChild) body.appendChild(s.firstChild);
    d.appendChild(sm); d.appendChild(body); s.appendChild(d); s.classList.add('fd-sec');
  }
  function openHash() { var h = location.hash.slice(1); if (!h) return; var el = document.getElementById(h); if (!el) return; var d = el.closest ? el.closest('details.fd') || el.querySelector('details.fd') : null; if (d && !d.open) { d.open = true; setTimeout(function () { el.scrollIntoView(); }, 30); } }
  function go() { F.forEach(function (x) { wrap.apply(null, x); });
    // 접은 단락을 한곳에 모은다: 첫 접은 단락 앞에 제목 한 줄
    var first = document.getElementById(F[0][0]);
    if (first && !document.getElementById('fdHead')) { var h = document.createElement('div'); h.id = 'fdHead'; h.className = 'fd-head'; h.innerHTML = '<h2>더 알아보기</h2><p>눌러서 펼치세요</p>'; first.parentNode.insertBefore(h, first); }
    var ids = F.map(function (x) { return x[0]; }), secs = ids.map(function (i) { return document.getElementById(i); }).filter(Boolean), head = document.getElementById('fdHead');
    var after = head; secs.forEach(function (s) { after.parentNode.insertBefore(s, after.nextSibling); after = s; });
    openHash(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.addEventListener('hashchange', openHash);
})();
