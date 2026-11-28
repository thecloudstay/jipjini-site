// 튜토리얼 화면 찍기: 시나리오(JSON) → 화면 사진(1080×1920) + 장면 정보(tut.json)
const {chromium}=require('playwright');const fs=require('fs');
const [,,scenFile,outDir]=process.argv;const S=JSON.parse(fs.readFileSync(scenFile,'utf8'));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:432,height:768},deviceScaleFactor:2.5,isMobile:true,hasTouch:true});
fs.mkdirSync(outDir,{recursive:true});const F=[];let n=0,step=0;
const L=s=>s.startsWith('text=')?p.locator(s).first():p.locator(s).first();
const rect=async s=>{if(!s)return null;const r=await L(s).boundingBox({timeout:4000}).catch(()=>null);return r?[r.x,r.y,r.width,r.height]:null};
const snap=async(o)=>{const f=String(++n).padStart(2,'0')+'.jpg';await p.screenshot({path:outDir+'/'+f,type:'jpeg',quality:86});F.push(Object.assign({img:f},o));};
for(const a of S.steps){
 if(a.go!==undefined){await p.goto('http://localhost:8765/'+a.go,{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await p.waitForTimeout(a.wait||1800);continue}
 if(a.eval){await p.evaluate(a.eval);await p.waitForTimeout(a.wait||600);continue}
 if(a.scroll){await p.evaluate(([s,off])=>{const e=document.querySelector(s);if(e)window.scrollTo(0,e.getBoundingClientRect().top+scrollY-(off||90))},[a.scroll,a.off]);await p.waitForTimeout(700)}
 if(a.cap)step++;
 const base={cap:a.cap||null,step:a.cap?step:null,big:a.big||null,hold:a.hold||1.6,result:!!a.result};
 if(a.tap||a.point){const s=a.tap||a.point;const r=await rect(s);await p.waitForTimeout(300);const fr=a.focus?await rect(a.focus):r;
   await snap(Object.assign(base,{kind:'tap',focus:fr,tapAt:r?[r[0]+r[2]/2,r[1]+r[3]/2]:null}));
   if(a.tap){await L(s).click({timeout:8000}).catch(async()=>{await L(s).tap().catch(e=>console.log('tap fail',s))});await p.waitForTimeout(a.wait||1800)}}
 else if(a.type){await L(a.type).fill('').catch(()=>{});const r=await rect(a.type);await L(a.type).click().catch(()=>{});await snap(Object.assign(base,{kind:'tap',focus:r,tapAt:r?[r[0]+r[2]/2,r[1]+r[3]/2]:null}));
   const t=a.text;for(let i=0;i<t.length;i++){await p.keyboard.type(t[i]);if(i%2==1||i==t.length-1){await p.waitForTimeout(120);await snap({kind:'type',focus:r,hold:0.25,cap:null,step:null})}}
   await p.waitForTimeout(a.wait||1500)}
 else if(a.fill){await L(a.fill).fill(a.text);await p.waitForTimeout(300)}
 else {const r=a.focus?await rect(a.focus):null;if(a.scroll)await p.evaluate(([s,off])=>{const e=document.querySelector(s);if(e)window.scrollTo(0,e.getBoundingClientRect().top+scrollY-(off||90))},[a.scroll,a.off]);await p.waitForTimeout(400);const r2=a.focus?await rect(a.focus):null;await snap(Object.assign(base,{kind:'shot',focus:r2}))}
}
fs.writeFileSync(outDir+'/tut.json',JSON.stringify({id:S.id,title:S.title,hook:S.hook,end:S.end,frames:F},null,1));
console.log(S.id,F.length,'장');await b.close();})();
