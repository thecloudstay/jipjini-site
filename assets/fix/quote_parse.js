/* 견적서 글 → 줄(항목·물량·단위·단가·금액) → 집지니 실견적 단가와 맞대기 — 2026-11-14
   브라우저(JJQuoteParse)와 노드 시험(tools/test_quote_parse.js) 둘 다에서 쓴다. */
(function (root) {
  var UNIT = '(㎡|m2|M2|㎥|평|py|m|M|미터|EA|ea|Ea|개소|개|식|품|인|롤|R|톤|짝|조|세트|SET|set|자²|자|대|박스|BOX|box|일|회|본|장|매|곳|구|틀)';
  var TRADES = [
    ['철거·준비', /철거|폐기물|사다리|보양|양중|동의서|신고|운반/],
    ['샷시', /샷시|샤시|창호|이중창|유리|방충망/],
    ['욕실·타일', /욕실|화장실|타일|방수|변기|양변기|세면|욕조|도기|젠다이|유가|수납장|슬라이드장|샤워|환풍기|천장재|돔/],
    ['주방', /싱크|주방|상판|상부장|하부장|후드|아일랜드|인덕션|키큰장|냉장고장/],
    ['설비', /배관|설비|수전|보일러|급수|배수|분배기|가스/],
    ['전기·조명', /전기|조명|등기구|매입등|스위치|콘센트|배선|LED|led|간접등|차단기|분전반/],
    ['바닥', /마루|장판|강마루|바닥|걸레받이|데코타일|폴리싱/],
    ['도배', /도배|벽지|실크|합지|초배|퍼티/],
    ['목공', /목공|몰딩|석고|천장|우물|가벽|문틀|목수|평탄|아트월|각재/],
    ['문·현관', /중문|도어|방문|현관|신발장|문짝|손잡이/],
    ['필름', /필름|시트지|래핑/],
    ['도장', /도장|페인트|탄성/],
    ['베란다', /베란다|확장|발코니|단열/],
    ['기타', /./]
  ];
  // 맞댈 단가: [이름 무늬, 단위 무늬, 단가 열쇠, 단위 환산(평→㎡ 등)]
  var REF = [
    [/실크/, /^(㎡|m2|M2)$/, 'wall_silk', 1], [/실크/, /^평$/, 'wall_silk', 3.3058], [/실크|벽지/, /^(롤|R)$/, 'wall_roll', 1],
    [/강마루/, /^(㎡|m2|M2)$/, 'floor_maru', 1], [/강마루/, /^평$/, 'floor_maru', 3.3058],
    [/장판/, /^(㎡|m2|M2)$/, 'floor_vinyl', 1], [/장판/, /^평$/, 'floor_vinyl', 3.3058],
    [/걸레받이/, /^(m|M|미터)$/, 'baseboard', 1], [/몰딩/, /^(m|M|미터)$/, 'molding', 1],
    [/폐기물/, /^톤$/, 'waste_ton', 1], [/방수/, /^(개소|곳)$/, 'bath_wp', 1],
    [/샷시|샤시|이중창/, /^자²?$/, 'sash_ja', 1],
    [/도배.*(공|기술자|인건)|도배사/, /^(품|인|일)$/, 'wallpaper_day', 1], [/목수|목공.*(인건|기술자)/, /^(품|인|일)$/, 'carp_day', 1],
    [/철거.*(공|인부|인력|인건)/, /^(품|인|일)$/, 'demo_day', 1], [/타일.*(공|기술자|인건)/, /^(품|인|일)$/, 'tile_day', 1],
    [/설비.*(공|기술자)/, /^(품|인|일)$/, 'plumb_day', 1], [/조공|잡부|보조/, /^(품|인|일)$/, 'helper_day', 1],
    [/도장공|페인트공|도장.*인건/, /^(품|인|일)$/, 'paint_day', 1]
  ];
  var TOTAL = /합\s*계|총\s*계|총\s*액|소\s*계|공급\s*가|공급가액|견적\s*금액|부가\s*세|부가가치세|VAT|vat|계약\s*금|잔\s*금|중도\s*금/;
  var OVER = /이윤|기업\s*이윤|공과\s*잡비|일반\s*관리비|현장\s*관리비|관리비|잡비|경비|디자인비|감리비|설계비/;
  var NUM = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

  function toN(s) { return Number(String(s).replace(/,/g, '')); }
  function parseLine(raw) {
    var s = String(raw).replace(/[ 　]/g, ' ').replace(/[，]/g, ',').replace(/￦|₩|원(?![가-힣])/g, ' ').trim();
    // 전화·사업자번호·날짜·견적번호는 숫자로 보지 않는다
    s = s.replace(/0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g, ' ').replace(/\d{3}-\d{2}-\d{5}/g, ' ').replace(/(19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g, ' ').replace(/[A-Za-z]{1,4}-\d{4,}(-\d+)*/g, ' ').trim();
    if (!s) return null;
    var nums = [], m; NUM.lastIndex = 0;
    while ((m = NUM.exec(s))) nums.push({ v: toN(m[0]), i: m.index, t: m[0] });
    if (!nums.length) return null;
    // 항목 이름 = 처음 쓰인 「물량·금액 숫자」 앞 글자 (이름 안의 7T·600×600 같은 규격 숫자는 이름으로 남김)
    var big = nums.filter(function (n) { return n.v >= 1000; }); if (!big.length) return null;
    var vals = nums.map(function (n) { return n.v; }), qty = 0, price = 0, amount = 0, at = -1;
    for (var k = nums.length - 1; k >= 2 && at < 0; k--) for (var j = k - 1; j >= 1 && at < 0; j--) for (var i = j - 1; i >= 0; i--) {
      var a = vals[i], b = vals[j], c = vals[k]; if (c < 1000 || !a || !b) continue;
      if (Math.abs(a * b - c) <= Math.max(2, c * .015)) { qty = a; price = b; amount = c; at = i; break; }
    }
    if (at < 0) {
      var last = nums[nums.length - 1]; if (last.v < 1000) return null;
      amount = last.v; at = nums.indexOf(big[0]);
      // 「1 식 3,500,000」처럼 작은 수 다음 금액 하나
      var prev = nums[nums.length - 2]; if (prev && prev.v < 1000 && prev.v > 0) { qty = prev.v; price = amount / qty; at = nums.length - 2; }
    }
    var cut = nums[at].i, item = s.slice(0, cut).replace(/^[\s\d.\-)(가-하]\s*[.)]\s*/, '').replace(/^\d+[.)]\s*/, '').replace(/[\t|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    var tail = s.slice(cut), um = tail.match(new RegExp('(^|[\\s\\d,.])' + UNIT + '(?=$|[\\s\\d,.])'));
    var unit = um ? um[2] : '';
    if (!item) item = s.replace(NUM, '').replace(/\s{2,}/g, ' ').trim().slice(0, 40) || '(이름 없음)';
    return { item: item.slice(0, 80), qty: qty, unit: unit, price: Math.round(price), amount: Math.round(amount), raw: s };
  }
  function tradeOf(t) { for (var i = 0; i < TRADES.length; i++) if (TRADES[i][1].test(t)) return TRADES[i][0]; return '기타'; }
  function refOf(item, unit, P) {
    for (var i = 0; i < REF.length; i++) { var r = REF[i]; if (r[0].test(item) && r[1].test(unit || '') && P.items[r[2]]) return { key: r[2], price: P.items[r[2]].price * r[3], name: P.items[r[2]].name, n: P.items[r[2]].n }; }
    return null;
  }

  function analyze(text, P, py) {
    var lines = [], statedTotal = 0, over = [], vat = /부가\s*세|부가가치세|VAT|vat/.test(text);
    String(text).split(/\r?\n/).forEach(function (row) {
      var L = parseLine(row); if (!L) return;
      if (TOTAL.test(L.item) || (TOTAL.test(L.raw) && !L.qty)) { if (/합\s*계|총\s*계|총\s*액|공급\s*가|견적\s*금액/.test(L.raw)) statedTotal = Math.max(statedTotal, L.amount); return; }
      L.trade = OVER.test(L.item) ? '이윤·관리비' : tradeOf(L.item);
      L.lump = !L.qty || (/^(식|일식)$/.test(L.unit) && L.amount >= 1000000);
      var ref = refOf(L.item, L.unit, P);
      if (ref && L.price) { var r = L.price / ref.price; L.ratio = r; L.mark = r > 1.3 ? 'hi' : r < .7 ? 'lo' : 'ok'; L.why = '집지니 ' + ref.name + ' ' + Math.round(ref.price).toLocaleString('ko-KR') + '원/' + (L.unit || '') + ' 대비 ' + (r >= 1 ? '+' : '') + Math.round((r - 1) * 100) + '%'; }
      else { L.mark = 'na'; if (L.lump) L.why = '물량·단가 없이 한 줄 금액 — 무엇이 들어가는지 물어보세요'; }
      if (L.trade === '이윤·관리비') { over.push(L); L.why = '공사가 아닌 비용'; }
      lines.push(L);
    });
    var order = TRADES.map(function (t) { return t[0]; }).concat(['이윤·관리비']);
    lines.sort(function (a, b) { return order.indexOf(a.trade) - order.indexOf(b.trade); });
    var sum = 0, lump = 0, cnt = { hi: 0, ok: 0, lo: 0, na: 0 }, tmap = {};
    lines.forEach(function (l) { sum += l.amount; if (l.lump) lump += l.amount; cnt[l.mark]++; tmap[l.trade] = (tmap[l.trade] || 0) + l.amount; });
    var trades = Object.keys(tmap).map(function (k) { return { k: k, v: tmap[k] }; }).sort(function (a, b) { return b.v - a.v; });
    var flags = [], all = text, big = sum >= 15000000 || trades.length >= 6;
    var hiL = lines.filter(function (l) { return l.mark === 'hi'; }).sort(function (a, b) { return (b.amount - b.amount / b.ratio) - (a.amount - a.amount / a.ratio); });
    if (hiL.length) { var extra = hiL.reduce(function (s, l) { return s + (l.amount - l.amount / l.ratio); }, 0); flags.push({ t: '시세보다 30% 넘게 비싼 줄 ' + hiL.length + '개 — 집지니 단가로 바꾸면 약 ' + Math.round(extra / 10000).toLocaleString('ko-KR') + '만 원 차이 (' + hiL.slice(0, 3).map(function (l) { return l.item; }).join(', ') + ')' }); }
    if (lump && sum && lump / sum >= .2) flags.push({ t: '물량·단가 없이 「1식」 한 줄로 적힌 금액이 전체의 ' + Math.round(lump / sum * 100) + '% — 자재 이름·수량·인건비가 나뉘지 않으면 나중에 빠진 것을 따지기 어렵습니다' });
    if (over.length) { var ov = over.reduce(function (s, l) { return s + l.amount; }, 0); flags.push({ t: '이윤·관리비 성격의 줄 ' + over.length + '개, 전체의 ' + Math.round(ov / Math.max(1, sum) * 100) + '% (' + over.map(function (l) { return l.item; }).join(', ') + ')' }); }
    if (big) {
      var miss = [['보양', /보양/], ['폐기물 처리', /폐기물/], ['입주 청소', /청소/], ['실리콘 마감', /실리콘/], ['사다리차·자재 운반', /사다리|양중|운반/]].filter(function (x) { return !x[1].test(all); }).map(function (x) { return x[0]; });
      if (miss.length) flags.push({ t: '견적에 안 보이는 것: ' + miss.join(', ') + ' — 공사 중에 추가로 청구되기 쉬운 항목입니다' });
    }
    if (!vat) flags.push({ t: '부가세 포함인지 별도인지 적혀 있지 않습니다 — 10% 차이이니 꼭 물어보세요' });
    if (statedTotal && Math.abs(statedTotal - sum) > Math.max(10000, sum * .01)) flags.push({ t: '줄을 더한 값(' + sum.toLocaleString('ko-KR') + '원)과 적힌 합계(' + statedTotal.toLocaleString('ko-KR') + '원)가 다릅니다 — 빠진 줄이나 할인·추가가 있는지 확인하세요' });
    if (py && P.full_per_py && big) { var pp = sum / py; if (pp > P.full_per_py.p75 * 1.1) flags.push({ t: '평당 ' + Math.round(pp / 10000) + '만 원 — 집지니 올수리 실견적의 높은 쪽(' + Math.round(P.full_per_py.p75 / 10000) + '만 원)보다 높습니다' }); else if (pp < P.full_per_py.p25 * .8) flags.push({ t: '평당 ' + Math.round(pp / 10000) + '만 원 — 집지니 올수리 실견적의 낮은 쪽보다 낮습니다. 빠진 공정이 없는지 보세요' }); }
    var loL = lines.filter(function (l) { return l.mark === 'lo'; }); if (loL.length) flags.push({ t: '시세보다 30% 넘게 싼 줄 ' + loL.length + '개 — 자재 등급·물량이 맞는지 확인하세요 (' + loL.slice(0, 3).map(function (l) { return l.item; }).join(', ') + ')' });
    if (cnt.ok && !hiL.length) flags.push({ good: 1, t: '맞댈 수 있었던 ' + (cnt.ok + cnt.lo) + '줄은 시세 범위 안이거나 아래입니다' });
    return { lines: lines, sum: sum, statedTotal: statedTotal, lumpShare: sum ? lump / sum : 0, cnt: cnt, trades: trades, flags: flags };
  }
  // 보낼 때: 전화·메일·사업자번호 같은 것을 지우고 항목·숫자만
  function clean(lines) {
    return lines.slice(0, 300).map(function (l) {
      var t = String(l.item).replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '').replace(/\S+@\S+/g, '').replace(/\d{3}-\d{2}-\d{5}/g, '').replace(/\(주\)|주식회사|㈜/g, '').trim().slice(0, 60);
      return [l.trade, t, l.qty || 0, l.unit || '', l.price || 0, l.amount || 0];
    });
  }
  var api = { analyze: analyze, parseLine: parseLine, clean: clean, tradeOf: tradeOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JJQuoteParse = api;
})(typeof window !== 'undefined' ? window : this);
