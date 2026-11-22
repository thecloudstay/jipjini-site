// 단지 찾기 시험: node tools/test_aptsearch.js
const S = require('../assets/aptsearch.js'), fs = require('fs');
const I = JSON.parse(fs.readFileSync(__dirname + '/../data/acb/index.json', 'utf8'));
const rows = Object.keys(I).map(c => [c].concat(I[c])), pick = r => ({ n: r[1], g: r[6].replace('_', ' '), d: r[9] || '' });
let bad = 0;
const T = [['송파동 한양아파트', 'A13885102'], ['송파동한양아파트', 'A13885102'], ['한양아파트 송파', 'A13885102'], ['한양 송파동', 'A13885102'], ['송파 한양', 'A13885102'],
  ['용인죽전동부센트레빌', 'A44898513'], ['죽전 동부센트레빌', 'A44898513'], ['죽전동 동부 센트레빌', 'A44898513'], ['잠실엘스', 'A13822004'], ['잠실 엘스 아파트', 'A13822004'], ['엘스 송파구', 'A13822004'], ['서울 송파구 잠실엘스', 'A13822004']];
T.forEach(([q, want]) => { const r = S.rank(q, rows, pick, 5).map(x => x[0]); const at = r.indexOf(want); if (at < 0 || at > 2) { bad++; console.log('틀림', q, '→', S.rank(q, rows, pick, 5).map(x => x[1] + '/' + x[2]).join(', ')); } else console.log('맞음', q, '→', at + 1, '번째'); });
['없는단지이름zz', '강남 zz타운'].forEach(q => { if (S.rank(q, rows, pick, 5).length) { bad++; console.log('틀림(나오면 안 됨)', q); } });
console.log(bad ? '실패 ' + bad : '통과'); process.exit(bad ? 1 : 0);
