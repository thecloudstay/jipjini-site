/* 감정평가서 읽기 (경매) — 2026-11-14 대표 「감정평가서를 분석하는 기법부터 먼저」
   PDF 글자층을 읽고, 글자층이 없으면(스캔본) 집지니 글자 인식으로 쪽마다 읽는다.
   뽑는 것: 사건번호 · 소재지 · 단지 이름 · 동 · 층 · 호 · 전용면적 · 사용승인 연도 · 감정가 · 상태 말(누수·노후·내부 미확인) · 내부 구조도 쪽
   올린 파일은 이 기기 안에서만 읽고 밖으로 보내지 않는다(원본 도면을 공개하지 않는 집지니 원칙과 같음).
   parse() 는 노드 시험(tools/test_appraisal.js)에서도 쓴다. */
(function (root) {
  var MAXP = 30;
  function toN(s) { return Number(String(s).replace(/[,\s]/g, '')); }
  function norm(t) { return String(t || '').replace(/\u0000/g, '').replace(/[ \t 　]+/g, ' ').replace(/㎡|m²|M2|m2/g, '㎡'); }

  function parse(textIn) {
    var t = norm(textIn), one = t.replace(/\n/g, ' '), f = { notes: [] }, m;
    if ((m = one.match(/(20\d{2})\s*타\s*경\s*(\d{2,7})/))) f.caseNo = m[1] + '타경' + m[2];
    // 감정가: 「감정평가액」 다음 큰 숫자(원) — 「일금 … 원정(₩523,000,000)」 꼴도
    if ((m = one.match(/감\s*정\s*평\s*가\s*액[^0-9₩]{0,40}₩?\s*([\d,]{9,})/)) || (m = one.match(/₩\s*([\d,]{9,})/))) f.price = toN(m[1]);
    // 소재지: 시·도로 시작해 「호」로 끝나는 가장 긴 덩어리
    var addrRe = /((?:서울|인천|경기|부산|대구|대전|광주|울산|세종|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)[가-힣]*\s[^\n]{4,120}?제?\s*\d{1,4}\s*층\s*제?\s*\d{1,5}\s*호)/g, addrs = [];
    while ((m = addrRe.exec(t))) addrs.push(m[1].replace(/\s+/g, ' ').trim());
    if (!addrs.length) { addrRe = /((?:서울|인천|경기)[가-힣]*\s[^\n]{4,100}?\d{1,4}\s*동\s*\d{1,5}\s*호)/g; while ((m = addrRe.exec(t))) addrs.push(m[1].replace(/\s+/g, ' ').trim()); }
    if (addrs.length) {
      addrs.sort(function (a, b) { return b.length - a.length; }); f.addr = addrs[0].slice(0, 140);
      var a = f.addr;
      if ((m = a.match(/제?\s*(\d{1,4})\s*동\s/))) f.dong = m[1];
      if ((m = a.match(/제?\s*(\d{1,3})\s*층/))) f.floor = +m[1];
      if ((m = a.match(/제?\s*(\d{1,5})\s*호/))) f.ho = m[1];
      if ((m = a.match(/^(\S+)\s+(\S+[시군구])(?:\s+(\S+구))?/))) f.gu = (m[3] || m[2]);
      // 단지 이름: 「제○동」 바로 앞 낱말들 가운데 번지·도로명이 아닌 것(글자층이 「삼산동456삼산타운3단지」처럼 붙어 오면 앞 번지를 떼어 냄)
      var head = a.replace(/제?\s*\d{1,4}\s*동\s.*$/, '').trim().split(' '), nm = [];
      for (var i = head.length - 1; i >= 0 && nm.length < 3; i--) { var w = head[i].replace(/^[가-힣]*[동리가]\s*\d[\d\-,]*(?:번지)?(?=[가-힣A-Za-z])/, ''); if (/^[\d\-,]+$|번지$|[로길]\d*$|[동리가]$|^\(|\)$/.test(w) && nm.length) break; if (/^[\d\-,]+$|번지$|[로길]$|[시군구도]$|[동리가로길]\d[\d\-,]*$/.test(w)) { if (nm.length) break; else continue; } nm.unshift(w.replace(/[(),]/g, '')); }
      f.name = nm.join(' ').replace(/아파트$/, '').trim();
    }
    // 전용면적: 20~250㎡ 숫자 가운데 「전유·전용·건물·구조」 가까이 있는 것, 없으면 가장 자주 나온 것
    var cand = {}, re = /(\d{2,3}\.\d{1,4})\s*㎡/g;
    while ((m = re.exec(one))) { var v = +m[1]; if (v < 20 || v > 250) continue; var ctx = one.slice(Math.max(0, m.index - 40), m.index); var w8 = /전\s*유|전\s*용|구\s*조|건\s*물|철근/.test(ctx) ? 3 : 1; if (/대지|토지|공용|공급|계약|지분/.test(ctx)) w8 = .3; cand[v] = (cand[v] || 0) + w8; }
    var best = Object.keys(cand).sort(function (x, y) { return cand[y] - cand[x]; })[0]; if (best) f.area = +best;
    if ((m = one.match(/사\s*용\s*승\s*인\s*(?:일|일자)?\s*[:：]?\s*((?:19|20)\d{2})\s*[.\-년\s]\s*(\d{1,2})/)) || (m = one.match(/(?:준\s*공|사\s*용\s*검\s*사|보\s*존\s*등\s*기)\s*(?:일|일자)?\s*[:：]?\s*((?:19|20)\d{2})/))) f.year = +m[1];
    // 상태 말
    var bad = [], k = [['누수', /누\s*수/], ['곰팡이', /곰\s*팡/], ['균열', /균\s*열/], ['노후', /노\s*후/], ['내부 미확인', /내부\s*(?:확인|열람|진입)\s*(?:불가|못|하지\s*못|안\s*됨)|폐\s*문|부\s*재\s*로|미\s*확\s*인/], ['관리 불량', /관리\s*(?:상태)?\s*(?:불량|미흡)/]];
    k.forEach(function (x) { if (x[1].test(one)) bad.push(x[0]); });
    f.notes = bad;
    f.cond = /내부 미확인|누수|관리 불량/.test(bad.join(' ')) ? 3 : /관리\s*(?:상태)?\s*(?:양호|보통\s*이상)|상태\s*양호/.test(one) && !bad.length ? 1 : 2;
    return f;
  }

  /* ── 파일 읽기 ── */
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function planTools() {
    root.JJ_ASSET_BASE = root.JJ_ASSET_BASE || '/assets/';
    var p = root.JJPlanAuto ? Promise.resolve() : loadScript('/assets/plan_auto.js?v=20261114f');
    return p.then(function () { return root.JJPlanTools ? null : loadScript('/assets/plan_tools.js?v=20261114f'); })
      .then(function () { return root.JJPlanStyle ? null : loadScript('/assets/plan_style.js?v=20261114f'); });
  }
  function slow(pr, ms, v) { return Promise.race([pr, new Promise(function (ok) { setTimeout(function () { ok(v); }, ms); })]); }
  function rowsText(items) {
    items.sort(function (a, b) { return a.y - b.y || a.x - b.x; }); var rows = [], cur = null;
    items.forEach(function (it) { if (cur && Math.abs(it.y - cur.y) <= Math.max(3, (it.h || 10) * .55)) cur.items.push(it); else { cur = { y: it.y, items: [it] }; rows.push(cur); } });
    return rows.map(function (r) { r.items.sort(function (a, b) { return a.x - b.x; }); var s = '', end = null; r.items.forEach(function (i) { var h = i.h || 10, gap = end == null ? 0 : i.x - end; s += end == null ? i.text : gap > h * .25 ? ' ' + i.text : i.text; end = i.x + (i.w || i.text.length * h * .6); }); return s; }).join('\n');
  }
  function render(doc, n, scale) {
    return doc.getPage(n).then(function (pg) { var vp = pg.getViewport({ scale: scale || 2 }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); return pg.render({ canvasContext: g, viewport: vp }).promise.then(function () { return c; }); });
  }
  var PLAN_WORD = /내\s*부\s*구\s*조\s*도|평\s*면\s*도|건\s*물\s*개\s*황\s*도|구\s*조\s*도/;

  function readPdf(file, step) {
    step = step || function () {};
    return import('/assets/vendor/pdf/pdf.min.mjs').then(function (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdf/pdf.worker.min.mjs';
      return file.arrayBuffer().then(function (buf) { return pdfjs.getDocument({ data: buf }).promise; }).then(function (doc) {
        var N = Math.min(doc.numPages, MAXP), pages = [], p = Promise.resolve();
        step('감정평가서 ' + doc.numPages + '쪽의 글자를 읽고 있습니다');
        for (var i = 1; i <= N; i++) (function (n) { p = p.then(function () { return doc.getPage(n).then(function (pg) { return slow(pg.getTextContent(), 8000, { items: [] }); }).then(function (tc) {
          var its = tc.items.filter(function (x) { return String(x.str).replace(/\u0000/g, '').trim(); }).map(function (x) { return { text: x.str.replace(/\u0000/g, '').trim(), x: x.transform[4], y: -x.transform[5], h: Math.abs(x.transform[3]) || 10, w: x.width }; });
          var txt = rowsText(its); pages.push({ n: n, text: txt, scanned: txt.replace(/\s/g, '').length < 40 });
        }); }); })(i);
        return p.then(function () {
          var scanned = pages.filter(function (x) { return x.scanned; }).length > N * .6;
          if (!scanned) return { doc: doc, pages: pages, scanned: false };
          // 스캔본: 앞 6쪽을 그림으로 펴 글자 인식(쪽마다 수십 초) — 구조도 쪽도 이때 찾는다
          step('스캔본이라 그림에서 글자를 읽고 있습니다 (쪽마다 20초 안팎)');
          return planTools().then(function () {
            var q = Promise.resolve();
            pages.slice(0, 6).forEach(function (pg) { q = q.then(function () { return render(doc, pg.n, 1.6).then(function (c) { return root.JJPlanTools.readText(c); }).then(function (items) { pg.text = rowsText((items || []).filter(function (i) { return !i.v; })); step('스캔본 ' + pg.n + '쪽 읽음'); }).catch(function () {}); }); });
            return q.then(function () { return { doc: doc, pages: pages, scanned: true }; });
          });
        });
      });
    });
  }

  /* 감정평가서 한 개 → { fields, planCanvas(내부 구조도 쪽 그림, 없으면 null), pages, scanned } */
  function read(file, step) {
    return readPdf(file, step).then(function (R) {
      var all = R.pages.map(function (p) { return p.text; }).join('\n'), f = parse(all);
      var pp = R.pages.filter(function (p) { return PLAN_WORD.test(p.text) && !/위\s*치\s*도|지\s*적\s*도|배\s*치\s*도/.test(p.text.slice(0, 60)); })[0];
      if (!pp && R.scanned) pp = null;
      if (!pp) return { fields: f, planCanvas: null, planPage: 0, pages: R.pages.length, scanned: R.scanned };
      return render(R.doc, pp.n, 2.2).then(function (c) { return { fields: f, planCanvas: c, planPage: pp.n, pages: R.pages.length, scanned: R.scanned }; });
    });
  }
  /* 구조도 그림 → 집지니 엔진으로 방 나누기(다시 그린 도면) */
  function redraw(canvas, areaM2, step) {
    return planTools().then(function () { return root.JJPlanTools.analyze(canvas, { areaM2: areaM2 || 0, onStep: step }); });
  }

  var api = { parse: parse, read: read, redraw: redraw, planTools: planTools };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JJAppraisal = api;
})(typeof window !== 'undefined' ? window : this);
