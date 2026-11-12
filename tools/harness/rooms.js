// 표본 그림 → 누리집과 같은 길(cad.html 그림 읽기)로 방·축척을 꺼낸다 — 하네스 측정 앞 단계
// 쓰는 법: (저장소 뿌리에서 python3 -m http.server 8765 를 띄운 뒤) node tools/harness/rooms.js <그림폴더> <방자료.json> [이미 있는 것 건너뜀]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const dir = process.argv[2], outf = process.argv[3]; const out = fs.existsSync(outf) ? JSON.parse(fs.readFileSync(outf, 'utf8')) : {};
  const b = await chromium.launch();
  for (const f of fs.readdirSync(dir).filter((x) => /\.jpe?g$|\.png$/i.test(x))) {
    const k = f.replace(/\.[^.]+$/, ''); if (out[k]) continue;
    const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
    await pg.route(/googletagmanager|fonts\.googleapis|kakao|script\.google|jsdelivr|unpkg|cdnjs/, (r) => r.abort());
    try {
      await pg.goto('http://localhost:8765/cad.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(500);
      await pg.setInputFiles('#cadFile', path.join(dir, f)); await pg.waitForSelector('#cadStart:visible', { timeout: 150000 }); await pg.click('#cadStart'); await pg.waitForTimeout(2000);
      const st = await pg.evaluate(() => JJCadEditor.getState()); const sc = st.shapes.find((q) => q.t === 'scale');
      const mm = sc ? sc.mm / Math.hypot(sc.x2 - sc.x1, sc.y2 - sc.y1) : 0;
      out[k] = { mmpp: mm, W: st.W, H: st.H, rooms: st.shapes.filter((q) => q.t === 'room').map((q) => ({ name: q.name, kind: q.kind, pts: q.pts })) };
      console.log(k, '방', out[k].rooms.length, '축척', mm.toFixed(1));
    } catch (e) { console.log(k, '실패', String(e.message).split('\n')[0]); }
    await pg.close(); fs.writeFileSync(outf, JSON.stringify(out));
  }
  await b.close();
})();
