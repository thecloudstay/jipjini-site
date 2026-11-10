// 집지니 안내서 PDF 만들기 (2026-11-10) — node assets/guide-src/build.js  →  files/jipjini-guide.pdf  (Playwright 필요)
const path = require('path'), { chromium } = require('playwright');
(async () => { const b = await chromium.launch(), p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'guide.html')); await p.waitForLoadState('networkidle');
  const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((el, i) => { const f = el.querySelector('.foot'); if (!f) return ''; const fb = f.getBoundingClientRect().top; let mx = 0; [...el.children].forEach(c => { if (c === f || getComputedStyle(c).position === 'absolute') return; mx = Math.max(mx, c.getBoundingClientRect().bottom); }); return mx > fb - 4 ? (i + 1) + '쪽 넘침 ' + Math.round(mx - fb) + 'px' : ''; }).filter(Boolean));
  if (over.length) console.log('주의: ' + over.join(', '));
  await p.pdf({ path: path.join(__dirname, '../../files/jipjini-guide.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (process.env.SHOT) { await p.setViewportSize({ width: 794, height: 1123 }); const n = await p.evaluate(() => document.querySelectorAll('.page').length); for (let i = 0; i < n; i++) await (await p.$$('.page'))[i].screenshot({ path: path.join(process.env.SHOT, 'g' + (i + 1) + '.png') }); }
  await b.close(); console.log('안내서 PDF 완성'); })();
