// 고객 진행 과정 영상용: progress/?demo=1 에 단계별 예시 자료를 넣어 찍는다 (실제 고객 자료 아님)
const {chromium}=require('playwright');
const base={ok:true,고객:'예시 고객',현장:'예시 단지 101동 1001호 (보기용)'};
const ST=(cur)=>{const L=[['의뢰','상담·의뢰 접수','의뢰서를 받고 담당 코디가 정해집니다.'],['견적','견적 비교','시공비와 코디비를 나눠 적은 견적서를 보내 드립니다.'],['샘플실','샘플실 상담','견본을 직접 보고 고릅니다.'],['계약','계약·서명','휴대폰으로 계약서를 확인하고 손가락으로 서명합니다.'],['입금','코디비 입금','코디비만 집지니에 냅니다. 자재비·인건비는 직접 거래합니다.'],['착공','착공 준비','기술자·자재 날짜를 맞추고 공정표를 드립니다.'],['시공','시공','매일 저녁 현장 일보와 사진이 올라옵니다.'],['입주','완공·입주','7일 점검 뒤 입주, 하자는 여기서 접수합니다.']];
 const ds=['11월 9일','11월 10일','11월 12일','11월 14일','11월 14일','11월 20일','12월 1일 ~ 12월 21일','12월 22일'];
 const i=L.findIndex(x=>x[0]===cur);
 return {단계:L.map((x,k)=>({키:x[0],이름:x[1],설명:x[2],날짜:k<=i?ds[k]:'',상태:k<i?'끝남':k===i?'지금':k===i+1?'다음':'앞으로'})),지금:L[i][1],다음:i+1<L.length?L[i+1][1]:'마무리'};};
const phases=(n)=>{const P=[['철거','2026-12-01','2026-12-02'],['설비·전기','2026-12-03','2026-12-05'],['목공','2026-12-06','2026-12-09'],['타일·욕실','2026-12-10','2026-12-13'],['도배·바닥','2026-12-14','2026-12-17'],['주방·가구','2026-12-18','2026-12-19'],['마무리·청소','2026-12-20','2026-12-21']];
 return P.map((p,k)=>({단계명:p[0],시작:p[1],종료:p[2],상태:k<n?'완료':k===n?'진행 중':'예정'}));};
const sigong=(n)=>phases(n).map((p,k)=>({...p,기사:[['철거팀 김 기사'],['설비 이 기사','전기 박 기사'],['목수 최 기사'],['타일 정 기사'],['도배 한 기사','마루 오 기사'],['싱크대 윤 기사'],['청소팀']][k],준비:['엘리베이터 보양 신청 — 관리사무소','욕실 물 사용 중지 안내','','욕실 사용 불가 4일','가구 들어낼 짐 정리','','입주 청소 뒤 짐 들이기'][k]}));
const pay=(done)=>({약정:1960000,입금:done?1960000:0,잔액:done?0:1960000,줄:[{내용:'코디비 (시공 2,800만 원 기준 7%)',약정액:1960000,상태:done?'완납':'대기',기한:'2026-11-16'}]});
const S={
 contract:{...base,진행률:0,공정:[],포털:{체인:ST('계약'),서류:[{키:'quote',이름:'견적서',설명:'시공비 · 코디비 나눠 적음',있음:true},{키:'contract',이름:'계약서',설명:'휴대폰으로 서명',있음:true}],
  계약요약:{계약일:'2026-11-14',착공:'2026-12-01',완공:'2026-12-21',서명링크:'https://jipjini.com/contract.html',서명됨:false},
  계약예시:[{제목:'돈은 어디로 가나요',내용:'집지니에는 코디비만 냅니다. 자재비·인건비는 자재상·기술자에게 직접 냅니다.'},{제목:'추가 공사',내용:'금액을 먼저 알려 드리고, 고객님이 「동의합니다」를 누른 뒤에만 진행합니다.'},{제목:'안 하게 되면',내용:'공사 시작 전에 그만두시면 코디비는 전액 돌려 드립니다.'},{제목:'하자',내용:'완공 뒤 12개월, 접수부터 기술자 연결·재시공 일정까지 코디가 맡습니다.'}],AS가능:false,AS목록:[]}},
 codi:{...base,진행률:0,공정:phases(-1),착공일:'2026-12-01',완공예정일:'2026-12-21',입금:pay(true),
  포털:{체인:ST('착공'),계약요약:{계약일:'2026-11-14',착공:'2026-12-01',완공:'2026-12-21',서명:'완료',서명됨:true},시공:sigong(-1),서류:[{키:'quote',이름:'견적서',설명:'시공비 · 코디비 나눠 적음',있음:true},{키:'contract',이름:'계약서',설명:'서명 완료',있음:true},{키:'schedule',이름:'공정표',설명:'날짜 · 담당 기술자',있음:true},{키:'workorder',이름:'작업 지시 도면',설명:'공정별 14장',있음:true}],AS가능:false,AS목록:[]}},
 build:{...base,진행률:57,공정:phases(4),착공일:'2026-12-01',완공예정일:'2026-12-21',단계:'도배·바닥',다음:{단계명:'주방·가구',시작:'2026-12-18'},입금:pay(true),
  일보:[{날짜:'2026-12-14',오늘한일:'거실·안방 초배지, 작은방 도배 마감',내일할일:'거실 도배 마감, 마루 자재 들어옴(오전 10시)',특이사항:'안방 창 아래 벽 곰팡이 — 사진 첨부, 방수 처리 뒤 도배했습니다'},{날짜:'2026-12-13',오늘한일:'욕실 벽·바닥 타일 줄눈 마감',내일할일:'도배 시작',특이사항:'없음'}],
  추가공사:[{구분:'추가',내용:'안방 창 아래 벽 방수 처리',공급가:180000,상태:'동의 대기'}],
  포털:{체인:ST('시공'),계약요약:{계약일:'2026-11-14',착공:'2026-12-01',완공:'2026-12-21',서명:'완료',서명됨:true},시공:sigong(4),서류:[],AS가능:false,AS목록:[]}},
 movein:{...base,진행률:100,공정:phases(7),착공일:'2026-12-01',완공예정일:'2026-12-21',입금:pay(true),
  포털:{체인:ST('입주'),계약요약:{계약일:'2026-11-14',착공:'2026-12-01',완공:'2026-12-21',서명:'완료',서명됨:true},서류:[{키:'quote',이름:'견적서',설명:'최종 금액',있음:true},{키:'contract',이름:'계약서',설명:'서명 완료',있음:true},{키:'schedule',이름:'공정표',설명:'완공',있음:true}],AS가능:true,
  AS목록:[{상태:'처리 끝남',접수일:'2026-12-28',공종:'도배',방문:'2026-12-30',내용:'작은방 창문 쪽 도배지 들뜸 — 도배 기사 방문, 다시 붙임'}]}},
};
(async()=>{const b=await chromium.launch();
for(const [k,D] of Object.entries(S)){
 const c=await b.newContext({viewport:{width:432,height:768},deviceScaleFactor:2.5});const p=await c.newPage();
 await p.route('**/progress/**',async r=>{const res=await r.fetch();let t=await res.text();t=t.replace("render(DEMO); return;","render(window.__D||DEMO); return;");r.fulfill({response:res,body:t,headers:{...res.headers(),'content-type':'text/html; charset=utf-8'}});});
 await p.addInitScript(d=>{window.__D=d;},D);
 await p.goto('http://localhost:8765/progress/?demo=1',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
 // 미리보기 띠 숨김
 await p.addStyleTag({content:'.pvbar,#pv,.preview-bar{display:none!important}'});await p.evaluate(()=>document.querySelectorAll('details.sample').forEach(d=>d.open=true));
 await p.screenshot({path:`/tmp/claude-0/rm/public/proc/${k}.jpg`,fullPage:true,type:'jpeg',quality:88});
 const secs=await p.evaluate(()=>[...document.querySelectorAll('section.card')].map(s=>{const r=s.getBoundingClientRect();return [s.querySelector('h2')?.innerText||'',Math.round(r.top+scrollY),Math.round(r.height)]}));
 console.log(k,JSON.stringify(secs));await c.close();}
await b.close();})();
