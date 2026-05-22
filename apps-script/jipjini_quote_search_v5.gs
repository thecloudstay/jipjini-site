// 사이트 미러본. 박 대표 PC의 jipjini_quote_search_v5.gs와 동일.
// 자세한 내용은 박 대표 PC C:\Users\NINE\Documents\Claude\Projects\집지니 운\jipjini_quote_search_v5.gs 참고.
// GitHub Actions clasp 자동 배포가 활성화되면 이 파일이 Apps Script 프로젝트로 push 됨.
// 현재는 박 대표가 FIX-AND-DEPLOY.bat 또는 Apps Script editor에서 직접 붙여넣기.

// 핵심 API 시그니처 (전체 구현은 PC 로컬 파일 참조):
//   api_searchQuotesAdvanced(query) → { total, page, totalPages, items: [...] }
//   api_getQuoteHistory(quoteId) → { quote, lines, sent, modified, contractInfo, totalRevenue, coordiFee }
//   api_cloneQuote(sourceQuoteId, options) → { newQuoteId, sourceQuoteId, lineCount, message }
//   api_recentQuotes(limit) → [...견적서 행]
//   api_quoteStats() → { totals, byMonth, byStatus, byCustomer }
//   logQuoteSent(quoteId, channel, recipient, pdfUrl, note) — 다른 모듈에서 호출
//   _logQuoteChange(quoteId, action, detail, by) — 변경이력 기록 helper
