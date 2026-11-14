// 감정평가서 읽기 시험: node tools/test_appraisal.js
const A = require('../assets/fix/appraisal.js'); let bad = 0;
const eq = (a, b, m) => { if (a !== b) { bad++; console.log('틀림', m, JSON.stringify(a), '기대', JSON.stringify(b)); } };
const s1 = `감 정 평 가 표
사건번호 2026타경 12345
감정평가액 일금오억이천삼백만원정 (₩523,000,000)
소재지 인천광역시 부평구 삼산동 456 삼산타운3단지 제301동 제12층 제1203호
건물 철근콘크리트구조 84.97㎡ 대지권 42.11㎡
사용승인일 : 1999. 05. 20.
본건은 폐문으로 내부 확인 불가하여 외관 및 관리사무소 탐문으로 평가함`;
let f = A.parse(s1);
eq(f.caseNo, '2026타경12345', '사건'); eq(f.price, 523000000, '감정가'); eq(f.dong, '301', '동'); eq(f.floor, 12, '층'); eq(f.ho, '1203', '호');
eq(f.area, 84.97, '전용'); eq(f.year, 1999, '연도'); eq(f.name, '삼산타운3단지', '단지'); eq(f.gu, '부평구', '구'); eq(f.cond, 3, '상태');
const s2 = `물건의 표시
경기도 김포시 장기동 1890 한강신도시 반도유보라 2차 제205동 제7층 제702호
전유부분 건물의 표시 철근콘크리트벽식구조 59.9㎡
공용부분 21.3㎡
사용승인 2012년 3월
관리상태 양호함`;
f = A.parse(s2); eq(f.area, 59.9, '전용2'); eq(f.year, 2012, '연도2'); eq(f.dong, '205', '동2'); eq(f.ho, '702', '호2'); eq(f.cond, 1, '상태2'); eq(f.gu, '김포시', '구2'); console.log('단지2', f.name);
console.log(bad ? '실패 ' + bad : '통과'); process.exit(bad ? 1 : 0);
