// 2026-10-22 고객 진행 현황 링크의 카톡·문자 미리보기 카드 — 현장마다 제목·설명·사진이 다르게 보이게
//   /p/<토큰> → 앱스 스크립트 progress(미리보기 표시 pv=1, 열람 수 안 셈)에서 가린 이름·현장·진행률·첫 사진을 받아
//   og 태그를 채운 짧은 페이지를 주고, 사람은 곧바로 jipjini.com/progress/?k=<토큰> 으로 넘어간다.
const EXEC = 'https://script.google.com/macros/s/AKfycbzxm4mmZs1yVJPa3T-wb0cdJbEUMPYl6dDKtQNSNmJy4nEsCholrEnPAN8e0JfAtOV99A/exec';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.searchParams.get('probe')) return new Response('ok');
    const m = u.pathname.match(/^\/p\/([A-Za-z0-9_-]{16,64})\/?$/);
    if (!m) return Response.redirect('https://jipjini.com/', 302);
    const k = m[1], dest = 'https://jipjini.com/progress/?k=' + encodeURIComponent(k);
    const cache = caches.default, ck = new Request('https://card.cache/' + k);
    let hit = await cache.match(ck); if (hit) return hit;
    let d = null;
    try { const r = await fetch(EXEC + '?type=progress&pv=1&k=' + encodeURIComponent(k), { redirect: 'follow' }); const j = await r.json(); d = j && (j.data || (j.ok !== false ? j : null)); } catch (_e) {}
    const site = d ? [d.현장, d.고객 ? d.고객 + ' 고객님' : ''].filter(Boolean).join(' · ') : '';
    const title = site ? '공사 진행 현황 · ' + site : '공사 진행 현황 | 집지니';
    const pct = d && d.진행률 != null ? '진행률 ' + d.진행률 + '%' : '';
    const desc = d ? [pct, d.단계 ? '지금 ' + d.단계 : '', d.다음 && d.다음.단계명 ? '다음 ' + d.다음.단계명 + (d.다음.시작 ? ' (' + d.다음.시작 + ')' : '') : ''].filter(Boolean).join(' · ') || '공정·일보·사진을 확인하세요.' : '여기를 눌러 진행 현황을 확인하세요.';
    const img = d && d.사진 && d.사진[0] && d.사진[0].썸네일 ? String(d.사진[0].썸네일).replace(/sz=w\d+/, 'sz=w800') : 'https://jipjini.com/og-cover.png';
    const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>' + esc(title) + '</title>' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="집지니"><meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
      '<meta property="og:image" content="' + esc(img) + '"><meta property="og:url" content="' + esc(u.origin + u.pathname) + '"><meta name="twitter:card" content="summary_large_image">' +
      '<meta http-equiv="refresh" content="0;url=' + esc(dest) + '"><script>location.replace(' + JSON.stringify(dest) + ')</script></head><body style="font-family:sans-serif;padding:24px;">' +
      '<a href="' + esc(dest) + '">' + esc(title) + ' 보기</a></body></html>';
    const res = new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600' } });
    if (d) ctx.waitUntil(cache.put(ck, res.clone()));
    return res;
  }
};
