// 집지니 캐드 — 오토캐드 고유 형식 읽기·쓰기 묶음(assets/cad_dwg.js 로 묶는다)
// 바탕 프로그램: acad-ts(ACadSharp 를 옮긴 것, MIT 사용 허락 — 상업 이용 자유). 묶기: tools/cad_dwg/build.sh
// write(M, LAYERS, BLOCKS): assets/cad_io.js 의 중립 도면 목록 → 오토캐드 2018 판 고유 형식 바이트
import * as A from '@node-projects/acad-ts';

const X = (p) => new A.XYZ(p[0], p[1], 0);
const RAD = Math.PI / 180;

function write(M, LAYERS, BLOCKS) {
  const doc = new A.CadDocument();
  doc.header.version = A.ACadVersion.AC1032;
  try { doc.header.insUnits = 4; } catch (e) {}
  const lay = {};
  LAYERS.forEach(([n, c]) => { const L = new A.Layer(n); L.color = new A.Color(c); doc.layers.add(L); lay[n] = L; });
  const getLay = (n) => (n && n !== '0' ? lay[n] : null);
  const ent = (e) => {
    let o = null;
    if (e.k === 'line') o = new A.Line(X(e.a), X(e.b));
    else if (e.k === 'arc') o = new A.Arc(X(e.c), e.r, e.a0 * RAD, e.a1 * RAD);
    else if (e.k === 'poly') { o = new A.LwPolyline(); o.vertices = e.pts.map((p) => new A.LwPolylineVertex(new A.XY(p[0], p[1]))); o.isClosed = !!e.closed; }
    else if (e.k === 'solid') { const q = e.q; o = new A.Solid(X(q[0]), X(q[1]), X(q[3]), X(q[2])); o.color = new A.Color(8); }
    else if (e.k === 'text') { o = new A.TextEntity(e.s); o.insertPoint = X(e.p); o.height = e.h;
      if (e.center) { o.horizontalAlignment = 1; o.verticalAlignment = 2; o.alignmentPoint = X(e.p); } }
    else if (e.k === 'attdef') { o = new A.AttributeDefinition(); o.tag = e.tag; o.prompt = e.prompt; o.value = ''; o.height = 80; o.insertPoint = X(e.p); try { o.flags = 1; } catch (er) {} }
    if (o && getLay(e.lay)) o.layer = getLay(e.lay);
    return o;
  };
  // 기호: 넣기 전에 속성 정의까지 다 채우고 나서 문서에 올린다(그래야 넣을 때 속성이 따라온다)
  const blk = {};
  Object.keys(BLOCKS).forEach((nm) => { const br = new A.BlockRecord(nm); BLOCKS[nm].forEach((e) => { const o = ent(e); if (o) br.entities.add(o); }); blk[nm] = br; });
  const inserts = [];
  M.ents.forEach((e) => { if (e.k === 'insert') { const ins = new A.Insert(blk[e.name]); inserts.push([ins, e]); } });
  Object.values(blk).forEach((br) => doc.blockRecords.add(br));
  M.ents.forEach((e) => { if (e.k !== 'insert') { const o = ent(e); if (o) doc.modelSpace.entities.add(o); } });
  inserts.forEach(([ins, e]) => {
    ins.insertPoint = X(e.p); ins.xScale = e.sx; ins.yScale = e.sy; ins.rotation = (e.rot || 0) * RAD; if (getLay(e.lay)) ins.layer = getLay(e.lay);
    let i = 0;
    for (const a of ins.attributes) { const v = e.attrs ? e.attrs[a.tag] : null; a.value = v == null ? '' : String(v); a.insertPoint = X([e.p[0], e.p[1] - 150 - i * 100]); a.height = 80; try { a.flags = 1; } catch (er) {} if (getLay(e.lay)) a.layer = getLay(e.lay); i++; }
    doc.modelSpace.entities.add(ins);
    // 속성은 문서 번호(핸들)를 따로 받아야 파일에 적힌다(acad-ts 3.8 — 넣기 뒤 속성이 문서에 안 올라감)
    for (const a of ins.attributes) { if (!a.document) { a.owner = ins; doc._addCadObject(a); } }
    if (!ins.attributes.seqend && A.Seqend && ins.attributes.length) ins.attributes.seqend = new A.Seqend();
    const sq = ins.attributes.seqend; if (sq && !sq.document) { sq.owner = ins; doc._addCadObject(sq); }
  });
  return A.DwgWriter.writeToBuffer(doc);
}

// read(bytes): 오토캐드 고유 형식·교환용 파일 → 같은 중립 목록(다시 읽기용, cad_io.js 가 편집기 도면으로 바꾼다)
function read(bytes, isDxf) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const doc = isDxf ? A.DxfReader.readFromStream(u8, () => {}) : A.DwgReader.readFromStream(u8, () => {});
  const units = (doc.header && doc.header.insUnits) || 0;
  const out = [];
  const P = (v) => [v.x, v.y];
  const walk = (e) => {
    const ln = (e.layer && e.layer.name) || '0', is = (C) => C && e instanceof C;   // 묶으면 이름이 줄어드니 종류는 instanceof 로 가린다
    if (is(A.Line)) out.push({ k: 'line', lay: ln, a: P(e.startPoint), b: P(e.endPoint) });
    else if (is(A.LwPolyline)) out.push({ k: 'poly', lay: ln, pts: e.vertices.map((v) => P(v.location)), closed: !!e.isClosed });
    else if (is(A.Polyline2D) || is(A.Polyline3D) || is(A.Polyline)) { const vs = [...(e.vertices || [])].map((v) => P(v.location)); if (vs.length) out.push({ k: 'poly', lay: ln, pts: vs, closed: !!e.isClosed }); }
    else if (is(A.Arc)) out.push({ k: 'arc', lay: ln, c: P(e.center), r: e.radius, a0: e.startAngle / RAD, a1: e.endAngle / RAD });
    else if (is(A.Circle)) out.push({ k: 'arc', lay: ln, c: P(e.center), r: e.radius, a0: 0, a1: 360 });
    else if (is(A.Solid)) out.push({ k: 'solid', lay: ln, q: [P(e.firstCorner), P(e.secondCorner), P(e.fourthCorner), P(e.thirdCorner)] });
    else if (is(A.MText) || is(A.TextEntity)) { const s = is(A.MText) ? (e.plainText || e.value || '') : e.value; out.push({ k: 'text', lay: ln, s: String(s).replace(/\{\\[^;]*;|\}|\\P/g, ' ').trim(), p: P(e.insertPoint), h: e.height || 0 }); }
    else if (is(A.Insert)) {
      const at = {}; for (const a of e.attributes || []) at[a.tag] = a.value;
      out.push({ k: 'insert', name: e.block ? e.block.name : '', lay: ln, p: P(e.insertPoint), sx: e.xScale, sy: e.yScale, rot: e.rotation / RAD, attrs: at });
      // 남의 도면: 기호 안 선도 펼쳐서 넘긴다(벽·문을 그림으로 읽을 때 필요)
      if (e.block && !/^JJ-/.test(e.block.name)) { try { for (const x of e.explode()) walk(x); } catch (er) {} }
    }
  };
  for (const e of doc.modelSpace.entities) walk(e);
  return { ents: out, units };
}

globalThis.JJDwgLib = { write, read, version: '20261112' };
