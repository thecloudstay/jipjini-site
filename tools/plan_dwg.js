// 집지니 평면 자료(data/plans/*.json) → 오토캐드 고유 형식(data/cad/<단지>_<평형>.dwg)
//   node tools/plan_dwg.js            모든 단지
// 누리집 편집기와 같은 길(cad_editor.fromPlan → cad_io.model → cad_dwg.write)을 써서, 내려받는 파일과 편집기에서 저장한 파일이 똑같은 규격이 되게 한다.
global.window = global;
global.document = { createElement: () => ({ style: {}, getContext: () => null, addEventListener() {} }), addEventListener() {}, querySelector: () => null, getElementById: () => null, body: { appendChild() {} } };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
require(R + '/assets/cad_editor.js'); require(R + '/assets/cad_io.js'); require(R + '/assets/cad_dwg.js');
let n = 0;
for (const f of fs.readdirSync(R + '/data/plans').filter((x) => /^A.*\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(R + '/data/plans/' + f, 'utf8')), code = f.slice(0, -5);
  for (const t of d.평형 || []) {
    if (!t.plan || !t.plan.그림) continue;
    const st = window.JJCadEditor.fromPlan(Object.assign({ name: (d.단지명 || code) + ' ' + t.이름 }, t.plan));
    const M = window.JJCadIO.model(st, { title: (d.단지명 || code) + ' ' + t.이름 });
    if (!M) { console.log('척도 없음', code, t.이름); continue; }
    const out = R + '/data/cad/' + code + '_' + t.이름 + '.dwg';
    try { fs.writeFileSync(out, window.JJDwgLib.write(M, window.JJCadIO.LAYERS, window.JJCadIO.BLOCKS)); n++; } catch (e) { console.log('실패', code, t.이름, String(e.message).slice(0, 80)); }
  }
}
console.log('오토캐드 파일', n, '개');
