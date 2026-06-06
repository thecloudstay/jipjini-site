/* 집지니 GA4 custom event handler
 * 모든 페이지 공통 — head에 <script src="js/analytics.js" defer></script>로 include
 * gtag 함수가 사전 정의되어 있어야 동작 (gtag.js 로드 후 실행)
 */
(function(){
  if (typeof gtag !== 'function') {
    // gtag 아직 미로딩 — 1초 후 재시도
    setTimeout(arguments.callee, 1000);
    return;
  }

  function fireEvent(name, label, category) {
    try {
      gtag('event', name, {
        event_category: category || 'CTA',
        event_label: label || '',
        page_path: location.pathname
      });
    } catch(e) {}
  }

  // 전체 click 위임 — 단일 리스너로 모든 링크 추적
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if (a && a.href) {
      var h = a.href.toLowerCase();
      if (h.indexOf('script.google.com') !== -1 && h.indexOf('request_form') !== -1) {
        fireEvent('click_quote_form', '정밀의뢰서_GAS진입', 'CTA');
      } else if (h.indexOf('pf.kakao.com') !== -1) {
        fireEvent('click_kakao', '카톡상담_채널', 'CTA');
      } else if (h.indexOf('payment.html') !== -1) {
        fireEvent('click_payment', '코디비_결제진입', 'CTA');
      } else if (h.indexOf('prepare.html') !== -1) {
        fireEvent('click_prepare', '사전준비_체크리스트', 'Engagement');
      } else if (h.indexOf('jipjini-guide.pdf') !== -1) {
        fireEvent('download_guide', '가이드_PDF다운', 'Download');
      } else if (h.indexOf('blog.naver.com') !== -1) {
        fireEvent('click_blog', '코디포트폴리오_블로그', 'External');
      } else if (h.indexOf('youtube.com') !== -1 || h.indexOf('youtu.be') !== -1) {
        fireEvent('click_youtube', '촌닭건축_유튜브', 'External');
      }
    }

    // 인쇄 버튼 (prepare.html)
    var btn = e.target.closest && e.target.closest('.btn-print');
    if (btn) fireEvent('print_prepare', '사전준비_인쇄', 'Engagement');
  }, false);

  // 페이지 진입 후 30초 — 깊은 인게이지먼트 marker
  setTimeout(function(){
    fireEvent('engaged_30s', location.pathname, 'Engagement');
  }, 30000);
})();
