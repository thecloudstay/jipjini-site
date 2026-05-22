// =============================================================
// 집지니 코디 웹앱 v4 — Stage 2 백엔드 API + 인증
// =============================================================
// 박 대표 액션:
//   1. Apps Script 편집기 좌측 파일 패널 → + 버튼 → 스크립트
//   2. 새 파일명: "Webapp" → 생성
//   3. 이 코드 통째 붙여넣기 → Ctrl+S
//   4. 함수 드롭다운 → ensureCoordinatorWhitelist → ▶ 실행
//      (박 대표 이메일 자동 시드됨)
//   5. 배포 → 새 배포 → 유형: 웹앱
//      · 다음 사용자로 실행: 나(thecloudstay@gmail.com)
//      · 액세스 권한: 모든 Google 계정 보유자
//      · 배포 → URL 복사
//   6. 복사한 URL이 코디 콘솔 진입점 (북마크 추천)
//   7. 박 대표 외 추가 코디 등록: 시트 "_코디 화이트리스트"에 직접 추가
// =============================================================

const WHITELIST_SHEET = '_코디 화이트리스트';
const OWNER_EMAIL = 'thecloudstay@gmail.com';  // 박 대표 (자동 시드용)

// =============================================================
// 웹앱 진입점 — 인증 + HTML 반환
// =============================================================
function doGet(e) {
  const email = getCurrentUserEmail();
  if (!isCoordinatorAuthorized(email)) {
    return HtmlService.createHtmlOutput(deniedHtml(email))
      .setTitle('집지니 코디 콘솔 — 접근 거부')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const tmpl = HtmlService.createTemplateFromFile('CoordiApp');
  tmpl.currentEmail = email;
  tmpl.currentRole = getCoordinatorRole(email);
  return tmpl.evaluate()
    .setTitle('집지니 코디 콘솔')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =============================================================
// 인증 + 화이트리스트
// =============================================================
function getCurrentUserEmail() {
  try {
    return String(Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (e) { return ''; }
}

function getCoordinatorRole(email) {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName(WHITELIST_SHEET);
  if (!sh) return null;
  const data = sh.getDataRange().getValues().slice(1);
  const row = data.filter(function(r){ return String(r[0]).toLowerCase() === email; })[0];
  return row ? String(row[1] || '코디') : null;
}

function isCoordinatorAuthorized(email) {
  if (!email) return false;
  if (email === OWNER_EMAIL) return true;  // 박 대표 항상 허용
  return !!getCoordinatorRole(email);
}

function ensureCoordinatorWhitelist() {
  const ss = SpreadsheetApp.openById(MASTER_ID);
  let sh = ss.getSheetByName(WHITELIST_SHEET);
  if (!sh) {
    sh = ss.insertSheet(WHITELIST_SHEET);
    sh.getRange(1, 1, 1, 4).setValues([['이메일','역할','등록일','비고']])
      .setBackground('#2A2A2A').setFontColor('#FFFFFF').setFontWeight('bold')
      .setHorizontalAlignment('center');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 240); sh.setColumnWidth(2, 100);
    sh.setColumnWidth(3, 110); sh.setColumnWidth(4, 240);
    // 역할 드롭다운
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['관리자','코디','읽기전용'], true).setAllowInvalid(false).build();
    sh.getRange('B2:B500').setDataValidation(rule);
  }
  // 박 대표 자동 시드
  const data = sh.getDataRange().getValues().slice(1);
  const has = data.some(function(r){ return String(r[0]).toLowerCase() === OWNER_EMAIL; });
  if (!has) {
    sh.appendRow([OWNER_EMAIL, '관리자', Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd'), '박 대표']);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('화이트리스트 시트 준비 완료', '집지니', 5);
}

function deniedHtml(email) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Pretendard,-apple-system,sans-serif;background:#F5F1E8;color:#2A2A2A;margin:0;padding:60px 20px;text-align:center;}' +
    '.box{max-width:480px;margin:0 auto;background:#fff;padding:40px 32px;border-radius:14px;border:0.5px solid #C8C4BC;}' +
    'h1{font-size:24px;font-weight:700;letter-spacing:-0.5px;margin:0 0 16px 0;}' +
    '.email{display:inline-block;background:#F5F1E8;padding:6px 14px;border-radius:8px;font-family:monospace;font-size:13px;margin:10px 0;}' +
    'p{color:#6B6B6B;line-height:1.7;margin:14px 0;font-size:14px;}' +
    '.note{font-size:12px;color:#9A9A9A;margin-top:20px;}' +
    '</style></head><body><div class="box">' +
    '<h1>접근 권한이 없습니다</h1>' +
    '<div class="email">' + (email || '로그인 안 됨') + '</div>' +
    '<p>이 이메일은 집지니 코디 콘솔 화이트리스트에 등록되어 있지 않습니다.</p>' +
    '<p>박 대표(' + OWNER_EMAIL + ')에게 등록 요청하세요.</p>' +
    '<div class="note">© 2026 집지니 (JIPJINI) · Direct Coordi</div>' +
    '</div></body></html>';
}

// =============================================================
// API: 부트스트랩 (앱 시작 시 모든 마스터 한 번에 로드)
// =============================================================
function api_bootstrap() {
  return {
    user: { email: getCurrentUserEmail(), role: getCoordinatorRole(getCurrentUserEmail()) || '관리자' },
    requests: api_getRequests(),
    quotes: api_getQuotes(),
    bundles: api_getBundles(),
    materials: api_getMaterials(),
    vendors: api_getVendors(),
    technicians: api_getTechnicians(),
    tradeColors: TRADE_COLORS,
    tradeList: GJ_LIST,
    unitList: UNIT_LIST,
    statusList: STATUS_LIST,
    lineKindList: LINE_KIND_LIST
  };
}

// =============================================================
// API: 의뢰
// =============================================================
function api_getRequests(filter) {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('의뢰 목록');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    const o = {};
    headers.forEach(function(h, i){ o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i],'Asia/Seoul','yyyy-MM-dd') : r[i]; });
    return o;
  }).filter(function(r){
    if (!filter) return true;
    if (filter.status && r['상태'] !== filter.status) return false;
    if (filter.q) {
      const q = String(filter.q).toLowerCase();
      return [r['의뢰ID'], r['고객명'], r['연락처'], r['주소']].some(function(v){ return String(v || '').toLowerCase().indexOf(q) >= 0; });
    }
    return true;
  });
}

function api_getRequest(reqId) {
  return api_getRequests().filter(function(r){ return r['의뢰ID'] === reqId; })[0] || null;
}

function api_updateRequest(reqId, updates) {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('의뢰 목록');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === reqId) {
      Object.keys(updates).forEach(function(k){
        const idx = headers.indexOf(k);
        if (idx !== -1) sh.getRange(r + 1, idx + 1).setValue(updates[k]);
      });
      return true;
    }
  }
  return false;
}

// =============================================================
// API: 견적서 (헤더 + 항목 + 의뢰 통합)
// =============================================================
function api_getQuotes(filter) {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('견적서');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    const o = {};
    headers.forEach(function(h, i){
      o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i],'Asia/Seoul','yyyy-MM-dd') : r[i];
    });
    return o;
  }).filter(function(q){
    if (!filter) return true;
    if (filter.status && q['상태'] !== filter.status) return false;
    if (filter.reqId && q['의뢰ID'] !== filter.reqId) return false;
    return true;
  });
}

function api_getQuote(quoteId) {
  const ss = SpreadsheetApp.openById(MASTER_ID);
  const qSh = ss.getSheetByName('견적서');
  const qData = qSh.getDataRange().getValues();
  const qHeaders = qData[0];
  const qRow = qData.slice(1).filter(function(r){ return r[0] === quoteId; })[0];
  if (!qRow) return null;
  const quote = {};
  qHeaders.forEach(function(h, i){
    quote[h] = qRow[i] instanceof Date ? Utilities.formatDate(qRow[i],'Asia/Seoul','yyyy-MM-dd') : qRow[i];
  });

  // 견적서 항목
  const iSh = ss.getSheetByName('견적서 항목');
  const iData = iSh.getDataRange().getValues();
  const iHeaders = iData[0];
  const lines = iData.slice(1).filter(function(r){ return r[1] === quoteId; }).map(function(r){
    const o = {};
    iHeaders.forEach(function(h, i){ o[h] = r[i]; });
    return o;
  });

  // 의뢰 정보
  let request = null;
  if (quote['의뢰ID']) {
    request = api_getRequest(quote['의뢰ID']);
  }

  return { quote: quote, lines: lines, request: request };
}

function api_updateQuoteHeader(quoteId, updates) {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('견적서');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === quoteId) {
      Object.keys(updates).forEach(function(k){
        const idx = headers.indexOf(k);
        if (idx !== -1) sh.getRange(r + 1, idx + 1).setValue(updates[k]);
      });
      return true;
    }
  }
  return false;
}

// 라인 일괄 저장 (UI에서 편집 후 한 번에 저장)
function api_saveQuoteLines(quoteId, lines) {
  const ss = SpreadsheetApp.openById(MASTER_ID);
  const sh = ss.getSheetByName('견적서 항목');
  if (!sh) throw new Error('견적서 항목 시트 없음');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const data = sh.getDataRange().getValues();

  // 기존 해당 견적서 라인 삭제 (역순)
  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][1] === quoteId) {
      sh.deleteRow(r + 1);
    }
  }

  if (!lines || lines.length === 0) return 0;

  // 신규 ID 할당
  const allData = sh.getDataRange().getValues();
  const existingIds = allData.slice(1).map(function(r){ return r[0]; }).filter(function(x){ return typeof x === 'number'; });
  let nextId = existingIds.length > 0 ? Math.max.apply(null, existingIds) + 1 : 1;

  const rows = lines.map(function(line){
    const row = headers.map(function(h){
      if (h === '항목ID') return nextId++;
      if (h === '견적서ID') return quoteId;
      return line[h] != null ? line[h] : '';
    });
    return row;
  });

  const startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, headers.length).setValues(rows);

  // 자동 수식 재적용
  applyFormulasToNewRows(sh, headers, startRow, rows.length);

  return rows.length;
}

function applyFormulasToNewRows(sh, headers, startRow, numRows) {
  const colMatSum = headers.indexOf('자재합계') + 1;
  const colLabSum = headers.indexOf('노무합계') + 1;
  const colTotal = headers.indexOf('소계') + 1;
  const colQty = headers.indexOf('수량') + 1;
  const colMat = headers.indexOf('자재단가') + 1;
  const colLab = headers.indexOf('노무단가') + 1;
  for (let i = 0; i < numRows; i++) {
    const r = startRow + i;
    const qC = columnToLetter(colQty), mpC = columnToLetter(colMat), lpC = columnToLetter(colLab);
    const msC = columnToLetter(colMatSum), lsC = columnToLetter(colLabSum);
    sh.getRange(r, colMatSum).setFormula('=IF(AND(' + qC + r + '="",' + mpC + r + '=""),"",IFERROR(' + qC + r + '*' + mpC + r + ',0))');
    sh.getRange(r, colLabSum).setFormula('=IF(AND(' + qC + r + '="",' + lpC + r + '=""),"",IFERROR(' + qC + r + '*' + lpC + r + ',0))');
    sh.getRange(r, colTotal).setFormula('=IF(AND(' + msC + r + '="",' + lsC + r + '=""),"",IFERROR(N(' + msC + r + ')+N(' + lsC + r + '),0))');
  }
}

function api_addBundleToQuote(quoteId, bundleId, area) {
  return insertBundleLines(quoteId, bundleId, area);
}

// 단일 라인 추가
function api_addLine(quoteId, line) {
  const ss = SpreadsheetApp.openById(MASTER_ID);
  const sh = ss.getSheetByName('견적서 항목');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const existingIds = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 1).getValues().flat()
    .filter(function(x){ return typeof x === 'number'; });
  const nextId = existingIds.length > 0 ? Math.max.apply(null, existingIds) + 1 : 1;
  const row = headers.map(function(h){
    if (h === '항목ID') return nextId;
    if (h === '견적서ID') return quoteId;
    return line[h] != null ? line[h] : '';
  });
  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, 1, 1, headers.length).setValues([row]);
  applyFormulasToNewRows(sh, headers, newRow, 1);
  return nextId;
}

// 의뢰에서 신규 견적서 생성
function api_createQuoteFromRequest(reqId) {
  createDraftQuote(reqId);
  // 새로 만든 견적서 ID 반환
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('견적서');
  const data = sh.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][1] === reqId) return data[r][0];
  }
  return null;
}

// =============================================================
// API: 자재·번들·자재상·기술자
// =============================================================
function api_getMaterials() {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('자재 마스터');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    const o = {};
    headers.forEach(function(h, i){ o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i],'Asia/Seoul','yyyy-MM-dd') : r[i]; });
    return o;
  });
}

function api_searchMaterials(query, trade) {
  const q = String(query || '').toLowerCase();
  return api_getMaterials().filter(function(m){
    if (trade && m['공종'] !== trade) return false;
    if (!q) return true;
    return [m['자재명'], m['규격'], m['모델명'], m['자재코드']].some(function(v){
      return String(v || '').toLowerCase().indexOf(q) >= 0;
    });
  });
}

function api_getBundles(trade) {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('Bundle_DB');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    return {
      번들ID: String(r[0]), 번들명: String(r[1]), 공종: String(r[2]),
      순번: Number(r[3]), 라인종류: String(r[4]), 참조코드: String(r[5] || ''),
      '자재명/세부작업': String(r[6] || ''), 규격: String(r[7] || ''),
      수량공식: String(r[8] || '1'), 단위: String(r[9] || ''),
      자재단가: Number(r[10] || 0), 노무단가: Number(r[11] || 0),
      비고: String(r[12] || '')
    };
  }).filter(function(b){ return !trade || b['공종'] === trade; });
}

function api_getVendors() {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('자재상 마스터');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    const o = {}; headers.forEach(function(h, i){ o[h] = r[i]; }); return o;
  });
}

function api_getTechnicians() {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('기술자 마스터');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    const o = {}; headers.forEach(function(h, i){ o[h] = r[i]; }); return o;
  });
}

// =============================================================
// API: PDF + 발송 패키지
// =============================================================
// v4.1 이원화: clientMode 옵션 — true=고객용(묶음만), false=내부용(낱개 단위)
function api_generatePdf(quoteId, clientMode) {
  const file = generateQuoteFromSheet(quoteId, clientMode);
  return { url: file.getUrl(), name: file.getName(), id: file.getId(), clientMode: !!clientMode };
}
function api_generatePdfClient(quoteId) {
  return api_generatePdf(quoteId, true);
}
function api_generatePdfInternal(quoteId) {
  return api_generatePdf(quoteId, false);
}

function api_sendQuotePackage(quoteId) {
  // 견적서 상태를 "발송 준비"로 변경 → onSheetEdit이 자동 트리거되어 발송 패키지 메일 발송
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName('견적서');
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === quoteId) {
      sh.getRange(r + 1, 12).setValue('발송 준비');
      Utilities.sleep(1000);  // 트리거 작동 대기
      return { ok: true, message: 'PDF 생성 + 발송 패키지가 박 대표 Gmail로 도착했습니다.' };
    }
  }
  throw new Error('견적서 ' + quoteId + ' 찾을 수 없음');
}

// =============================================================
// API: 코디 관리
// =============================================================
function api_listCoordinators() {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName(WHITELIST_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(function(r){ return r[0]; }).map(function(r){
    const o = {}; headers.forEach(function(h, i){
      o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i],'Asia/Seoul','yyyy-MM-dd') : r[i];
    }); return o;
  });
}

function api_addCoordinator(email, role, note) {
  if (!email) throw new Error('이메일 필수');
  // 관리자만 추가 가능
  const me = getCurrentUserEmail();
  const myRole = getCoordinatorRole(me);
  if (me !== OWNER_EMAIL && myRole !== '관리자') throw new Error('관리자만 추가 가능');
  const ss = SpreadsheetApp.openById(MASTER_ID);
  let sh = ss.getSheetByName(WHITELIST_SHEET);
  if (!sh) { ensureCoordinatorWhitelist(); sh = ss.getSheetByName(WHITELIST_SHEET); }
  // 중복 체크
  const data = sh.getDataRange().getValues().slice(1);
  if (data.some(function(r){ return String(r[0]).toLowerCase() === email.toLowerCase(); })) {
    throw new Error('이미 등록됨: ' + email);
  }
  sh.appendRow([email.toLowerCase(), role || '코디', Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd'), note || '']);
  return true;
}

function api_removeCoordinator(email) {
  const me = getCurrentUserEmail();
  if (me !== OWNER_EMAIL && getCoordinatorRole(me) !== '관리자') throw new Error('관리자만 삭제 가능');
  if (email.toLowerCase() === OWNER_EMAIL) throw new Error('박 대표 삭제 불가');
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName(WHITELIST_SHEET);
  const data = sh.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][0]).toLowerCase() === email.toLowerCase()) {
      sh.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

// =============================================================
// 유틸 — 수량공식 평가 (서버 측에서도)
// =============================================================
function evalQtyFormula(formula, py) {
  if (!formula) return 0;
  try {
    const expr = String(formula).replace(/py/g, String(py));
    return Number(Function('"use strict";return (' + expr + ')')()) || 0;
  } catch (e) { return 0; }
}
