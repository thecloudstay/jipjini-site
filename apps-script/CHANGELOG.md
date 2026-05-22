# 집지니 Apps Script 변경 이력

## 2026-05-22

### 톱니 4 강화 — 견적서 검색·이력·복제
- `jipjini_quote_search_v5.gs` (NEW)
  - `api_searchQuotesAdvanced(q)` 다중 필드 검색 + 페이지네이션
  - `api_getQuoteHistory(quoteId)` 변경·발송 타임라인
  - `api_cloneQuote(sourceQuoteId, options)` 과거 견적 새 ID로 복제
  - `api_recentQuotes(limit)` 최근 N건
  - `api_quoteStats()` 매출·고객별 통계
  - `logQuoteSent` / `_logQuoteChange` 자동 기록 helper
- 자동 생성 시트: `견적서_발송이력`, `견적서_변경이력`

### 톱니 7→8 사이트 UX
- `jipjini_contract_load_v5.gs` (NEW) — 사이트 contract.html 백엔드
  - `api_loadQuoteForContract`, `api_buildContractFromQuote`, `api_saveContractDraft`, `api_loadContractDraft`, `api_searchQuotesForContract`
- `jipjini_router_patch_v5.gs` (NEW) — type 분기 통합 라우터
  - `_handleRouterRequest(e)` 호출 한 줄로 톱니 4·7·8·9 모든 사이트 API 처리

### 톱니 7 통합 발송 자동 기록
- `jipjini_contract_v5.gs` 패치
  - `sendUnifiedPackage` 끝에 `logQuoteSent` 호출 (메일 발송 시 자동 이력)
  - `api_generateProposal`, `api_registerContract` wrapper 추가

## 박 대표 액션 (배포)
1. FIX-AND-DEPLOY.bat 더블클릭 (clasp push + 재배포)
2. Apps Script editor → Webapp.gs doGet/doPost 첫 줄에 `const r = _handleRouterRequest(e); if (r) return r;` 추가
