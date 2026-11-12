# 원본 평면도를 벡터로 따라 그린다: 벽(굵은 검정) · 선(문·창·기구 같은 가는 선). 글자·치수·공용부 바깥은 뺀다.
import sys, json, cv2, numpy as np, subprocess, io, csv
def ocr_boxes(bgr):
    big=cv2.resize(bgr,None,fx=2.5,fy=2.5,interpolation=cv2.INTER_CUBIC); cv2.imwrite('/tmp/_t.png',big)
    t=subprocess.run(['tesseract','/tmp/_t.png','-','-l','kor+eng','--psm','11','tsv'],capture_output=True,text=True).stdout; out=[]
    for r in csv.DictReader(io.StringIO(t),delimiter='\t',quoting=csv.QUOTE_NONE):
        w=(r.get('text') or '').strip()
        import re as _re
        if w and float(r['conf'])>55 and _re.search(r'[가-힣0-9]',w) and len(w)>=1: out.append([int(r['left'])/2.5,int(r['top'])/2.5,int(r['width'])/2.5,int(r['height'])/2.5])
    return out
def paths(mask, eps):
    cs,hier=cv2.findContours(mask.astype(np.uint8),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE); d=[]
    for c in cs:
        if cv2.contourArea(c)<2 and len(c)<3: continue
        a=cv2.approxPolyDP(c,eps,True).reshape(-1,2)
        if len(a)<3: continue
        d.append('M'+'L'.join('%d %d'%(x,y) for x,y in a)+'Z')
    return ''.join(d)
def trace(path, rooms, scale=1.0):
    bgr=cv2.imread(path); H,W=bgr.shape[:2]
    hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV); v=hsv[...,2].astype(int); s=hsv[...,1].astype(int)
    dark=(v<100)
    wall=cv2.morphologyEx(dark.astype(np.uint8),cv2.MORPH_OPEN,np.ones((4,4),np.uint8))>0
    # 집 범위: 방 다각형을 합쳐 조금 키운 곳(바깥 치수·계단실 글자 빼기)
    house=np.zeros((H,W),np.uint8)
    for r in rooms: cv2.fillPoly(house,[np.array(r,np.int32)],1)
    house=cv2.dilate(house,np.ones((25,25),np.uint8))>0
    line=(v<165)&(s<60)&~cv2.dilate(wall.astype(np.uint8),np.ones((2,2),np.uint8)).astype(bool)&house
    # 글자 지우기
    for x,y,w,h in ocr_boxes(bgr):
        if h<28 and w<160: line[int(y)-2:int(y+h)+3,int(x)-2:int(x+w)+3]=False
    # 아주 작은 점(글자 조각·잡음) 빼기
    n,lab,st,_=cv2.connectedComponentsWithStats(line.astype(np.uint8),connectivity=8)
    keep=np.zeros(n,bool); keep[1:]=(np.maximum(st[1:,2],st[1:,3])>=9)
    line=keep[lab]
    wall=wall&house
    # 칸 채우기: 방마다 원본에서 벽·선으로 막힌 칸을 그대로 따서 그 모양으로 칠한다(방 다각형 대신)
    bar=(wall|cv2.dilate(line.astype(np.uint8),np.ones((2,2),np.uint8)).astype(bool)|~house).astype(np.uint8)
    n2,lab2=cv2.connectedComponents(1-bar,connectivity=4); used={}; cells=[]
    for i,r in enumerate(rooms):
        P=np.array(r,np.float32); m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[P.astype(np.int32)],1)
        ids,cnt=np.unique(lab2[(m>0)&(bar==0)],return_counts=True)
        tot=m.sum() or 1
        for lid,c in zip(ids,cnt):
            if lid==0 or c<tot*0.15 or lid in used: continue
            used[lid]=1; cm=(lab2==lid)
            if cm.sum()>tot*3: continue   # 집 바깥까지 샌 칸
            cm=cv2.dilate(cm.astype(np.uint8),np.ones((3,3),np.uint8))>0
            cells.append({'i':i,'d':paths(cm,0.8)})
    return {'벽':paths(wall,0.8),'선':paths(line,0.6),'칸':cells}
if __name__=='__main__':
    print(json.dumps(trace(sys.argv[1], json.loads(open(sys.argv[2]).read())))[:300])
