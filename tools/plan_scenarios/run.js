// 도면 분석 실전 시나리오 10개 (2026-11-10) — node tools/plan_scenarios/run.js [--shots 폴더] [--write-baseline]
//   저장소를 그대로 띄워(assets/plan_*.js · 글자 인식 모델 포함) 합성 도면을 양식·전달 방식별로 분석하고 정답과 견준다.
//   끝 코드: 0 통과 · 1 기준(baseline.json)보다 나빠짐 또는 필수 시나리오 실패. 결과는 tools/plan_scenarios/last.json
const fs = require('fs'), path = require('path'), http = require('http'), { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../..'), DIR = __dirname, args = process.argv.slice(2), SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : '', WRITE = args.includes('--write-baseline');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/__t.html') { s.writeHead(200, { 'Content-Type': MIME['.html'] }); return s.end('<!doctype html><meta charset=utf-8><script>window.JJ_ASSET_BASE="/assets/"</script><script src="/assets/plan_auto.js"></script><script src="/assets/plan_tools.js"></script><script src="/assets/plan_style.js"></script><script src="/tools/plan_scenarios/fixtures.js"></script><body style="margin:0"><div id=o></div>'); }
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
function judge(sc, r, T) {   // → { 점수(0~100), 실패[] }
  const fail = [], R = r.rooms || [], cnt = k => R.filter(x => x.kind === k).length, big = k => R.filter(x => x.kind === k).sort((a, b) => b.area - a.area)[0], near = (v, t, tol) => t && Math.abs(v - t) / t <= tol;
  if (!r.ok) return { 점수: 0, 실패: ['분석 실패: ' + (r.why || '')] };
  let pts = 0, max = 0; const chk = (name, ok, w) => { max += w; if (ok) pts += w; else fail.push(name); };
  if (sc.한계) { chk('치수선 척도(가로 ' + T.가로m + 'm ±6%)', r.척도 && r.척도.방식 === '치수' && near(T.가로m * 1000 / (r.mmpp || 1), r.평면가로화소 || 0, 0.06), 100); return { 점수: Math.round(pts / max * 100), 실패: fail }; }
  const tol = sc.느슨 ? 0.25 : 0.15;
  chk('방 ' + T.방 + (sc.글자없음 ? '~' + (T.방 + 2) : '') + ' (찾음 ' + cnt('방') + ')', sc.글자없음 ? (cnt('방') >= T.방 && cnt('방') <= T.방 + 2) : cnt('방') === T.방, 20); chk('욕실 ' + T.욕실 + ' (찾음 ' + cnt('욕실') + ')', sc.글자없음 ? true : cnt('욕실') === T.욕실, sc.글자없음 ? 0 : 15); chk('발코니 1 이상 (찾음 ' + cnt('발코니') + ')', cnt('발코니') >= 1, 10); chk('거실 1 (찾음 ' + cnt('거실') + ')', cnt('거실') === 1, 10);
  if (!sc.글자없음) { chk('주방·현관' + (T.드레스룸 ? '·드레스룸' : '') + ' 이름', cnt('주방') >= 1 && cnt('현관') >= T.현관 && cnt('드레스룸') >= T.드레스룸, 10); chk('글자 기준 방식', r.engine === '글자 기준', 5); }
  const an = big('방'), lv = big('거실'), kt = big('주방');
  chk('안방 면적 ' + T.안방.toFixed(1) + '㎡ ±' + tol * 100 + '% (나옴 ' + (an ? an.area : '-') + ')', an && near(an.area, T.안방, tol), 10);
  if (!sc.글자없음) chk('거실+주방 ' + T.트인합.toFixed(1) + '㎡ ±' + tol * 100 + '% (나옴 ' + (((lv && lv.area) || 0) + ((kt && kt.area) || 0)).toFixed(1) + ')', lv && kt && near(lv.area + kt.area, T.트인합, tol), 10);
  if (sc.전용읽기) chk('그림 글자에서 전용 ' + sc.전용읽기 + ' 읽기', r.척도 && Math.abs((r.척도.도면전용 || 0) - sc.전용읽기) < 0.1, 10);
  if (sc.치수만 || sc.치수방식) chk('치수선 방식', r.척도 && r.척도.방식 === '치수', 10);
  if (sc.치수우선) { chk('치수선 방식', r.척도 && r.척도.방식 === '치수', 10); chk('다른 평형 경고', r.척도 && /다릅니다/.test(r.척도.안내 || ''), 5); }
  if (sc.방면적) chk('방마다 적힌 면적 사용(2곳 이상)', r.척도 && (r.척도.방면적 || 0) >= 2, 10);
  chk('창 1곳 이상', (r.창 || []).length >= 1, sc.글자없음 ? 0 : 5);
  if (sc.공용부) chk('공용부(계단·승강기)는 빼기 — 방이 늘지 않음', cnt('방') <= T.방 && (r.sum && r.sum.전용합 || 0) < T.전용 * 1.18, 10);
  chk('공간이 모두 직각(빗변 없음)', R.every(x => x.pts.every((p, i) => { const q = x.pts[(i + 1) % x.pts.length]; return p[0] === q[0] || p[1] === q[1]; })), 5);
  return { 점수: Math.round(pts / max * 100), 실패: fail };
}
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port, list = JSON.parse(fs.readFileSync(path.join(DIR, 'scenarios.json'), 'utf8'));
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1300, height: 950 } }), errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (/^색가름/.test(m.text())) console.log(m.text()); });
  await pg.goto('http://127.0.0.1:' + port + '/__t.html'); await pg.waitForFunction(() => window.JJPlanTools && window.JJFix);
  const out = [], ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
  for (const sc of list) { if (ONLY && !ONLY.includes(sc.id)) continue; if (ONLY) sc._dbg = 1; const T = await pg.evaluate((o) => JJFix.truth(o), sc.opt || {}); if (sc.면적 === 'auto') sc.면적 = Math.round(T.전용 * 100) / 100; if (sc.전용읽기 === 'auto') sc.전용읽기 = Math.round(T.전용 * 100) / 100; sc._가로m = T.가로m;
    const r = await pg.evaluate(async (sc) => { const src = JJFix.draw(sc.style, Object.assign({ ppm: sc.ppm, labels: sc.labels }, sc.opt || {})), cv = await JJFix.deliver(src, sc.deliver), t0 = performance.now(); window.JJ_PLAN_DEBUG = !!sc._dbg;
      let a; try { a = await JJPlanTools.analyze(cv, { areaM2: sc.면적 || 0 }); } catch (e) { a = { ok: false, why: String(e && e.message) }; }
      const o = document.getElementById('o'); o.innerHTML = ''; const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:8px;align-items:flex-start;background:#888;padding:6px'; cv.style.cssText = 'width:560px;height:auto;background:#fff'; wrap.appendChild(cv); const d2 = document.createElement('div'); d2.style.width = '620px'; try { d2.innerHTML = a.ok ? JJPlanStyle.svg(a, { title: sc.id }) : '<p style="color:#fff">' + (a.why || '실패') + '</p>'; } catch (e) { d2.textContent = '그리기 오류 ' + e.message; } wrap.appendChild(d2); o.appendChild(wrap);
      const k = (a.W || cv.width) / cv.width;
      return { ok: !!a.ok, why: a.why || '', ms: Math.round(performance.now() - t0), engine: a.engine, mmpp: a.mmpp, 평면가로화소: sc._가로m * sc.ppm * ((sc.deliver && sc.deliver.width) ? sc.deliver.width / src.width : 1) * k, 척도: a.척도, sum: a.sum, 창: (a.창 || []).map(w => ({ 종류: w.종류, w_m: w.w_m })), rooms: (a.rooms || []).map(x => ({ name: x.name, kind: x.kind, area: x.area, pts: x.pts })) }; }, sc);
    const j = judge(sc, r, T); out.push({ id: sc.id, 이름: sc.이름, 점수: j.점수, 실패: j.실패, ms: r.ms, engine: r.engine || '', 공간: (r.rooms || []).map(x => x.name + ' ' + x.area).join(', '), 한계: !!sc.한계 });
    console.log((j.점수 >= 80 ? '통과 ' : j.점수 >= 50 ? '미흡 ' : '실패 ') + sc.id + ' ' + j.점수 + '점 (' + r.ms + 'ms) ' + sc.이름 + (j.실패.length ? '\n      - ' + j.실패.join('\n      - ') : ''));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await (await pg.$('#o')).screenshot({ path: path.join(SHOTS, sc.id + '.png') }); }
  }
  await b.close(); srv.close(); if (ONLY) { out.forEach(x => console.log(x.id, x.공간)); process.exit(0); }
  const avg = Math.round(out.reduce((s, x) => s + x.점수, 0) / out.length), res = { 때: new Date().toISOString(), 평균: avg, 결과: out, 오류: errs.slice(0, 5) };
  fs.writeFileSync(path.join(DIR, 'last.json'), JSON.stringify(res, null, 1));
  const bp = path.join(DIR, 'baseline.json'); if (WRITE || !fs.existsSync(bp)) { fs.writeFileSync(bp, JSON.stringify({ 평균: avg, 점수: Object.fromEntries(out.map(x => [x.id, x.점수])) }, null, 1)); console.log('기준 저장: 평균 ' + avg); process.exit(0); }
  const base = JSON.parse(fs.readFileSync(bp, 'utf8')), worse = out.filter(x => x.점수 < (base.점수[x.id] || 0) - 8);
  console.log('\n평균 ' + avg + '점 (기준 ' + base.평균 + ')' + (worse.length ? ' — 기준보다 나빠진 시나리오: ' + worse.map(x => x.id + ' ' + (base.점수[x.id]) + '→' + x.점수).join(', ') : '') + (errs.length ? ' · 화면 오류 ' + errs.length + '개: ' + errs[0] : ''));
  const low = out.filter(x => x.점수 < 80 && !x.한계).map(x => x.id + ' ' + x.점수); if (low.length) console.log('80점 아래: ' + low.join(', '));
  process.exit(worse.length || avg < base.평균 - 4 || errs.length ? 1 : 0);
})().catch(e => { console.error('시험 틀 실패:', e.message); process.exit(2); });
