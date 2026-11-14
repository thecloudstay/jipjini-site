// 견적서 비교 읽기 시험: node tools/test_quote_parse.js
const Q = require('../assets/fix/quote_parse.js');
const P = require('../data/repair-prices.json');
const RQ = require('../data/real-quotes.json');
let bad = 0;
const eq = (a, b, m) => { if (a !== b) { bad++; console.log('틀림', m, '→', a, '기대', b); } };
// 1) 엑셀 붙여넣기(탭)
let L = Q.parseLine('실크 도배\t85\t㎡\t42,000\t3,570,000'); eq(L.item, '실크 도배', 'item'); eq(L.qty, 85, 'qty'); eq(L.unit, '㎡', 'unit'); eq(L.price, 42000, 'price'); eq(L.amount, 3570000, 'amt');
// 2) 이름 안 규격 숫자
L = Q.parseLine('욕실 600×600 포세린 타일 28 박스 18,000 504,000'); eq(L.qty, 28, 'qty2'); eq(L.unit, '박스', 'unit2'); eq(L.item, '욕실 600×600 포세린 타일', 'item2');
// 3) 한 줄 금액
L = Q.parseLine('욕실 리모델링 1식 4,500,000'); eq(L.amount, 4500000, 'amt3'); eq(L.qty, 1, 'qty3');
L = Q.parseLine('주방 가구 일체   7,800,000원'); eq(L.amount, 7800000, 'amt4'); eq(L.qty, 0, 'qty4');
// 4) 번호 붙은 줄
L = Q.parseLine('3. 강마루 시공 70 m2 58,000 4,060,000'); eq(L.item, '강마루 시공', 'item5'); eq(L.unit, 'm2', 'unit5');
// 5) 합계·이윤
const text = ['[견적서] ○○인테리어 010-1234-5678', '실크 도배 85 ㎡ 42,000 3,570,000', '강마루 70 ㎡ 72,000 5,040,000', '욕실 리모델링 1식 9,500,000', '도배 기술자 4 품 280,000 1,120,000', '기업이윤 1 식 2,000,000', '합계 21,230,000'].join('\n');
const R = Q.analyze(text, P, 32);
eq(R.lines.length, 5, 'lines'); eq(R.sum, 21230000, 'sum'); eq(R.statedTotal, 21230000, 'stated');
eq(R.lines.find(l => /강마루/.test(l.item)).mark, 'hi', 'maru hi');
eq(R.lines.find(l => /실크/.test(l.item)).mark, 'ok', 'silk ok');
console.log(R.flags.map(f => '· ' + f.t).join('\n'));
// 6) 실견적을 글로 되돌려 다시 읽기 — 줄 금액이 맞게 읽히는 비율
let tot = 0, ok = 0;
RQ.cases.forEach(c => c.sections.forEach(s => s.lines.forEach(l => { if (!l.amount) return; tot++;
  const t = `${l.item}\t${l.qty}\t${l.unit}\t${l.price.toLocaleString('en-US')}\t${l.amount.toLocaleString('en-US')}`;
  const x = Q.parseLine(t); if (x && x.amount === l.amount && x.price === l.price) ok++; else if (tot - ok < 6) console.log('  못 읽음:', t, JSON.stringify(x && { q: x.qty, p: x.price, a: x.amount, i: x.item })); })));
console.log('실견적 줄 되읽기', ok + '/' + tot, Math.round(ok / tot * 100) + '%');
if (ok / tot < .95) bad++;
console.log(bad ? '실패 ' + bad : '통과'); process.exit(bad ? 1 : 0);
