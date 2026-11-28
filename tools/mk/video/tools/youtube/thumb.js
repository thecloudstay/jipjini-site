const {chromium}=require('playwright');const fs=require('fs');
const T=[
['matiz','마티즈 샀다<br>긔긔','1,189만 원 남음','#141613','#fff','#FFD43B'],
['cost','우리 집 공사비<br>검색 한 번','2,800만 원','#FFD43B','#141613','#1F5E2E'],
['cad','우리 집 도면<br>직접 열기','물량 자동','#1F5E2E','#fff','#FFD43B'],
['req','파일만 보내면<br>견적서 옴','24시간','#F3EFE6','#141613','#1F5E2E'],
['acb','관리비<br>옆 단지보다 비쌈?','10곳 비교','#2F3A8F','#fff','#8FD19E'],
['support','우리 아파트도<br>지원금?','최대 90%','#8FD19E','#141613','#1F5E2E'],
['disaster','물 샐 때<br>복구비 얼마?','1,158,200원','#1E5A8A','#fff','#FFD43B'],
['auction','낙찰 전<br>수리비부터','3,114만 원','#B3261E','#fff','#FFD43B'],
['compare','받은 견적서<br>비싼 줄 찾기','줄마다 대조','#FFFFFF','#141613','#B3261E'],
['kitchen','싱크대 설계<br>1분 컷','약 513만 원','#E8D5B5','#141613','#1F5E2E']];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
for(const [k,h,badge,bg,fg,ac] of T){
const img='data:image/jpeg;base64,'+fs.readFileSync(k+'.jpg').toString('base64');
const markBg=fg==='#fff'?'#FFD43B':'#1F5E2E',markFg=fg==='#fff'?'#141613':'#fff';
await p.setContent(`<html><head><style>
@font-face{font-family:P;font-weight:700;src:url(data:font/woff2;base64,${fs.readFileSync('ibm-plex-sans-kr-korean-700-normal.woff2').toString('base64')})}
@font-face{font-family:L;font-weight:700;src:url(data:font/woff2;base64,${fs.readFileSync('ibm-plex-sans-kr-latin-700-normal.woff2').toString('base64')})}
body{margin:0;width:1080px;height:1920px;background:${bg};color:${fg};font-family:L,P;font-weight:700;position:relative;overflow:hidden}
.lg{position:absolute;left:90px;top:400px;display:flex;align-items:center;gap:22px;font-size:64px;letter-spacing:-1px}
.lg i{font-style:normal;width:92px;height:92px;border-radius:12px;background:${markBg};color:${markFg};display:flex;align-items:center;justify-content:center;font-size:56px}
.lg span{font-size:40px;opacity:.75;margin-left:6px}
h1{position:absolute;left:90px;right:150px;top:540px;margin:0;font-size:${h.length>16?118:136}px;line-height:1.12;letter-spacing:-5px}
.sh{position:absolute;left:90px;right:150px;top:930px;height:520px;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);border:6px solid ${fg==='#fff'?'#fff':'#141613'};transform:rotate(-2deg);background:#fff}
.sh img{width:100%;height:100%;object-fit:cover;object-position:top}
.bd{position:absolute;right:130px;top:1380px;background:${ac};color:${ac==='#FFD43B'||ac==='#8FD19E'?'#141613':'#fff'};font-size:68px;padding:18px 34px;border-radius:14px;transform:rotate(3deg);box-shadow:0 12px 30px rgba(0,0,0,.3)}
</style></head><body><div class="lg"><i>집</i>집지니<span>jipjini.com</span></div><h1>${h}</h1><div class="sh"><img src="${img}"></div><div class="bd">${badge}</div></body></html>`);
await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);await p.screenshot({path:`/home/claude/yt/thumb_${k}.jpg`,type:'jpeg',quality:88});}
await b.close();})();
