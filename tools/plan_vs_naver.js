// 단지 평면(집지니) 대 원본(네이버) 나란히: node cmpnaver.js 단지코드 평형순번 원본그림 출력
const { chromium } = require('playwright');
(async()=>{ const [code, idx, out]=process.argv.slice(2); const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:900}}); p.on('pageerror',e=>console.log('PE',e.message));
 await p.goto('http://localhost:8765/cad.html?apt='+code+'&n=x'); await p.waitForTimeout(1800); const bs=await p.$$('#cadApt button[data-i]'); await bs[+idx||0].click(); await p.waitForTimeout(1500); await (await p.$('text=이 도면으로 공사 계획 시작')).click(); await p.waitForTimeout(2500);
 const r=await p.evaluate(()=>{const c=document.querySelector('#jjeBg')||document.querySelector('#jjeCv'); const q=c.getBoundingClientRect(); return [q.x,q.y,q.width,q.height];});
 await p.screenshot({path:out, clip:{x:330,y:165,width:530,height:680}}); await b.close(); })();
