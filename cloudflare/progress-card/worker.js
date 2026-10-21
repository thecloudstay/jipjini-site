// 2026-10-22 고객 진행 현황 링크의 카톡·문자 미리보기 카드 — 현장마다 제목·설명·사진이 다르게
//   /p/<토큰>     카드(og 태그) + 곧바로 jipjini.com/progress/?k=<토큰> 으로 넘김
//   /warm/<토큰>  링크를 만들 때 콘솔(앱스 스크립트)이 부른다 — 바로 답하고 뒤에서 카드 자료를 미리 받아 둔다 (카톡은 몇 초 안에 못 받으면 미리보기를 포기함)
//   /i/<토큰>     카드 사진 (구글 드라이브 미리보기 그림을 이 주소로 대신 줌 — 카톡이 바로 읽게)
//   자료·사진은 앱스 스크립트 progress(pv=1, 열람 수 안 셈)에서 받아 KV(CARD)에 30일 보관 (workers.dev 주소에선 캐시가 안 먹어서 KV 사용), 10분 지나면 뒤에서 새로 받는다.
const EXEC = 'https://script.google.com/macros/s/AKfycbzxm4mmZs1yVJPa3T-wb0cdJbEUMPYl6dDKtQNSNmJy4nEsCholrEnPAN8e0JfAtOV99A/exec';
const FALLBACK_IMG = 'https://jipjini.com/og-cover.png';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function loadFresh(k) {
  const r = await fetch(EXEC + '?type=progress&pv=1&k=' + encodeURIComponent(k), { redirect: 'follow' });
  const j = await r.json(); if (!j || j.ok === false) return null;
  const d = j.data || j;
  const slim = { 고객: d.고객, 현장: d.현장, 단계: d.단계, 진행률: d.진행률, 다음: d.다음, 사진: d.사진 && d.사진[0] ? String(d.사진[0].썸네일 || '') : '', t: Date.now() };
  await KV.put('d:' + k, JSON.stringify(slim), { expirationTtl: 2592000 });
  if (slim.사진) { try { const ir = await fetch(slim.사진.replace(/sz=w\d+/, 'sz=w800'), { redirect: 'follow' }); const ct = ir.headers.get('content-type') || ''; if (ir.ok && /^image\//.test(ct)) await KV.put('i:' + k, await ir.arrayBuffer(), { expirationTtl: 2592000, metadata: { ct } }); } catch (_e) {} }
  return slim;
}
let KV;
async function getData(k, ctx, waitMs) {
  const d = await KV.get('d:' + k, 'json');
  if (d) { if (Date.now() - (d.t || 0) > 600000) ctx.waitUntil(loadFresh(k).catch(() => {})); return d; }
  const p = loadFresh(k).catch(() => null); ctx.waitUntil(p);
  return await Promise.race([p, new Promise(r => setTimeout(() => r(null), waitMs))]);
}
export default {
  async fetch(req, env, ctx) {
    KV = env.CARD;
    const u = new URL(req.url);
    if (u.searchParams.get('probe')) return new Response('ok');
    const m = u.pathname.match(/^\/(p|warm|i)\/([A-Za-z0-9_-]{16,64})\/?$/);
    if (!m) return Response.redirect('https://jipjini.com/', 302);
    const kind = m[1], k = m[2], dest = 'https://jipjini.com/progress/?k=' + encodeURIComponent(k);
    if (kind === 'warm') { ctx.waitUntil(loadFresh(k).catch(() => {})); return new Response('ok', { status: 202 }); }
    if (kind === 'i') {
      const hit = await KV.getWithMetadata('i:' + k, 'arrayBuffer');
      if (hit && hit.value) return new Response(hit.value, { headers: { 'content-type': (hit.metadata && hit.metadata.ct) || 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
      const d = await getData(k, ctx, 3000); const src = d && d.사진 ? d.사진.replace(/sz=w\d+/, 'sz=w800') : FALLBACK_IMG;
      try { const ir = await fetch(src, { redirect: 'follow' }); if (ir.ok && /^image\//.test(ir.headers.get('content-type') || '')) return new Response(ir.body, { headers: { 'content-type': ir.headers.get('content-type'), 'cache-control': 'public, max-age=86400' } }); } catch (_e) {}
      return Response.redirect(FALLBACK_IMG, 302);
    }
    const d = await getData(k, ctx, 2500);
    const site = d ? [d.현장, d.고객 ? d.고객 + ' 고객님' : ''].filter(Boolean).join(' · ') : '';
    const title = site ? '공사 진행 현황 · ' + site : '공사 진행 현황 | 집지니';
    const desc = d ? [d.진행률 != null ? '진행률 ' + d.진행률 + '%' : '', d.단계 ? '지금 ' + d.단계 : '', d.다음 && d.다음.단계명 ? '다음 ' + d.다음.단계명 + (d.다음.시작 ? ' (' + d.다음.시작 + ')' : '') : ''].filter(Boolean).join(' · ') || '공정·일보·사진을 확인하세요.' : '여기를 눌러 공정·일보·사진을 확인하세요.';
    const img = d && d.사진 ? u.origin + '/i/' + k : FALLBACK_IMG;
    const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>' + esc(title) + '</title>' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="집지니"><meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
      '<meta property="og:image" content="' + esc(img) + '"><meta property="og:image:width" content="800"><meta property="og:image:height" content="600"><meta property="og:url" content="' + esc(u.origin + u.pathname) + '"><meta name="twitter:card" content="summary_large_image">' +
      '<meta http-equiv="refresh" content="0;url=' + esc(dest) + '"><script>location.replace(' + JSON.stringify(dest) + ')</script></head><body style="font-family:sans-serif;padding:24px;">' +
      '<a href="' + esc(dest) + '">' + esc(title) + ' 보기</a></body></html>';
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
  }
};
