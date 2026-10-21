// 2026-10-22 고객 진행 현황 링크의 카톡·문자 미리보기 카드 — 현장마다 제목·설명·사진이 다르게
//   /p/<토큰>  카드(og 태그) + 곧바로 jipjini.com/progress/?k=<토큰> 으로 넘김
//   자료는 콘솔이 링크를 만들 때 슈퍼베이스 공개 저장소 marketing/cards/<토큰>.json(+.jpg) 에 올려 둔다 → 여기서 바로 읽음(0.1초대).
//   없으면 앱스 스크립트에 2.5초까지만 묻고, 늦으면 기본 카드(카톡은 몇 초 안에 못 받으면 미리보기를 포기함).
const EXEC = 'https://script.google.com/macros/s/AKfycbzxm4mmZs1yVJPa3T-wb0cdJbEUMPYl6dDKtQNSNmJy4nEsCholrEnPAN8e0JfAtOV99A/exec';
const SB = 'https://pnqyysuyrovgnmrchrrg.supabase.co/storage/v1/object/public/marketing/cards/';
const FALLBACK_IMG = 'https://jipjini.com/og-cover.png';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
async function fromStore(k) {
  const r = await fetch(SB + k + '.json?t=' + Math.floor(Date.now() / 60000)); if (!r.ok) return null;
  return await r.json();
}
async function fromGas(k) {
  const r = await fetch(EXEC + '?type=progress&pv=1&k=' + encodeURIComponent(k), { redirect: 'follow' });
  const j = await r.json(); if (!j || j.ok === false) return null;
  const d = j.data || j; return { 고객: d.고객, 현장: d.현장, 단계: d.단계, 진행률: d.진행률, 다음: d.다음, 사진: '' };
}
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.searchParams.get('probe')) return new Response('ok');
    const m = u.pathname.match(/^\/p\/([A-Za-z0-9_-]{16,64})\/?$/);
    if (!m) return Response.redirect('https://jipjini.com/', 302);
    const k = m[1], dest = 'https://jipjini.com/progress/?k=' + encodeURIComponent(k);
    let d = null; try { d = await timeout(fromStore(k), 2000); } catch (_e) {}
    if (!d) { try { d = await timeout(fromGas(k).catch(() => null), 2500); } catch (_e) {} }
    const site = d ? [d.현장, d.고객 ? d.고객 + ' 고객님' : ''].filter(Boolean).join(' · ') : '';
    const title = site ? '공사 진행 현황 · ' + site : '공사 진행 현황 | 집지니';
    const desc = d ? [d.진행률 != null ? '진행률 ' + d.진행률 + '%' : '', d.단계 ? '지금 ' + d.단계 : '', d.다음 && d.다음.단계명 ? '다음 ' + d.다음.단계명 + (d.다음.시작 ? ' (' + d.다음.시작 + ')' : '') : ''].filter(Boolean).join(' · ') || '공정·일보·사진을 확인하세요.' : '여기를 눌러 공정·일보·사진을 확인하세요.';
    const img = d && d.사진 ? d.사진 : FALLBACK_IMG;
    const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>' + esc(title) + '</title>' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="집지니"><meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
      '<meta property="og:image" content="' + esc(img) + '"><meta property="og:url" content="' + esc(u.origin + u.pathname) + '"><meta name="twitter:card" content="summary_large_image">' +
      '<meta http-equiv="refresh" content="0;url=' + esc(dest) + '"><script>location.replace(' + JSON.stringify(dest) + ')</script></head><body style="font-family:sans-serif;padding:24px;">' +
      '<a href="' + esc(dest) + '">' + esc(title) + ' 보기</a></body></html>';
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
  }
};
