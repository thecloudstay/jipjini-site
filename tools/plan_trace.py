# 원본 평면도 → 읽고(직선 토막) → 다듬고(가로·세로, 합치기) → 가려내고(싱크대·붙박이장·신발장·샷시) → 집지니 기호로 다시 그릴 자료
import json, cv2, numpy as np
def rect_path(mask, eps=1.2, snap=True):
    cs,_=cv2.findContours(mask.astype(np.uint8),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE); d=[]
    for c in cs:
        if cv2.contourArea(c)<4: continue
        a=cv2.approxPolyDP(c,eps,True).reshape(-1,2).astype(float)
        if len(a)<3: continue
        if snap:   # 가로·세로로 펴기: 거의 수평/수직인 변은 끝점을 맞춘다
            for k in range(len(a)):
                p,q=a[k],a[(k+1)%len(a)]
                if abs(p[0]-q[0])<=2.5 and abs(p[1]-q[1])>abs(p[0]-q[0]): q[0]=p[0]
                elif abs(p[1]-q[1])<=2.5: q[1]=p[1]
        d.append('M'+'L'.join('%.1f %.1f'%(x,y) for x,y in a)+'Z')
    return ''.join(d)
def segs(mask, minlen):
    L=cv2.HoughLinesP(mask.astype(np.uint8)*255,1,np.pi/180,threshold=max(8,int(minlen*0.6)),minLineLength=int(minlen),maxLineGap=3)
    H,V=[],[]
    if L is None: return []
    for x1,y1,x2,y2 in L.reshape(-1,4):
        if abs(y1-y2)<=2: H.append([round((y1+y2)/2),min(x1,x2),max(x1,x2)])
        elif abs(x1-x2)<=2: V.append([round((x1+x2)/2),min(y1,y2),max(y1,y2)])
    def merge(S):
        S.sort(); out=[]
        for c,a,b in S:
            for o in out:
                if abs(o[0]-c)<=2 and a<=o[2]+3 and b>=o[1]-3: o[1]=min(o[1],a); o[2]=max(o[2],b); o[3].append(c); break
            else: out.append([c,a,b,[c]])
        return [[round(sum(o[3])/len(o[3]),1),o[1],o[2]] for o in out]
    return [('h',float(s[0]),int(s[1]),int(s[2])) for s in merge(H)]+[('v',float(s[0]),int(s[1]),int(s[2])) for s in merge(V)]
def trace(path, plan):
    bgr=cv2.imread(path); H,W=bgr.shape[:2]; mm=plan.get('mmpp') or 23.0
    hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV); v=hsv[...,2].astype(int); s=hsv[...,1].astype(int)
    rooms=plan['rooms']; house=np.zeros((H,W),np.uint8)
    for r in rooms: cv2.fillPoly(house,[np.array(r['pts'],np.int32)],1)
    house=cv2.dilate(house,np.ones((25,25),np.uint8))>0
    wall=cv2.morphologyEx((v<100).astype(np.uint8),cv2.MORPH_OPEN,np.ones((4,4),np.uint8))>0
    wall&=house
    nw,lw,sw,_=cv2.connectedComponentsWithStats(wall.astype(np.uint8),connectivity=8); kw=np.ones(nw,bool); kw[0]=False
    for j in range(1,nw):
        w_,h_,a_=sw[j,2],sw[j,3],sw[j,4]
        if max(w_,h_)*mm<1200 and a_<w_*h_*0.55: kw[j]=False   # 굵은 글자
    wall=kw[lw]
    # 욕실 안 지저분한 것 정리(대표 지적 2026-11-12): 욕실 칸 안쪽(벽에서 조금 떨어진 곳)의 검은 덩어리는 기구 그림이다 — 지운다
    for r in rooms:
        if r.get('kind')!='욕실': continue
        m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(r['pts'],np.int32)],1); m=cv2.erode(m,np.ones((7,7),np.uint8))>0
        wall&=~m
    thin=(v<175)&(s<70)&~cv2.dilate(wall.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)&house
    n,lab,st,_=cv2.connectedComponentsWithStats(thin.astype(np.uint8),connectivity=8); keep=np.zeros(n,bool)
    for j in range(1,n):
        w_,h_,a_=st[j,2],st[j,3],st[j,4]
        keep[j]=not(max(w_,h_)*mm<450 or (h_*mm<350 and w_*mm<1500 and a_>=w_*h_*0.18))   # 글자 지우기
    thin=keep[lab]
    # 방 칸: 벽+가는 선으로 막힌 빈 곳. 방마다 가장 큰 칸 = 방 바닥, 방 안에서 바닥과 안 닿는 막힌 덩어리 = 가구·기구
    bar=(wall|cv2.dilate(thin.astype(np.uint8),np.ones((2,2),np.uint8)).astype(bool)|~house).astype(np.uint8)
    cells=[]; objs=[]
    white=(v>=225)&(s<=25)
    for i,r in enumerate(rooms):
        m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(r['pts'],np.int32)],1)
        md=cv2.dilate(m,np.ones((9,9),np.uint8))>0
        # 칠하기: 방 다각형을 조금 넓힌 곳 가운데 벽이 아닌 곳 — 벽 쪽 가장자리는 원본 벽에 딱 붙는다
        fill=md&~wall
        cells.append({'i':i,'d':rect_path(fill,1.0)})
        kind=r.get('kind') or ''
        if kind not in ('주방','방','드레스룸'): continue
        inside=(m>0)
        if white[inside].mean()>0.45: continue        # 바닥이 흰 방은 가구를 색으로 가려낼 수 없다
        blk=white&md&~wall
        blk=cv2.morphologyEx(blk.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
        nb,lb,sb,_=cv2.connectedComponentsWithStats(blk,connectivity=4)
        for j in range(1,nb):
            x,y,w_,h_,a_=sb[j]; Lm=max(w_,h_)*mm; Sm=min(w_,h_)*mm
            if a_<w_*h_*0.6: continue
            box={'x0':int(x),'y0':int(y),'x1':int(x+w_),'y1':int(y+h_)}
            if kind=='주방' and Lm>=900 and 380<=Sm<=850: objs.append(dict(box,k='싱크대'))
            elif kind in('방','드레스룸') and Lm>=1200 and 400<=Sm<=850 and Lm/Sm>=1.6: objs.append(dict(box,k='붙박이장'))
    # 샷시·창: 벽 띠 안(벽에서 8화소 이내)에 놓인 가로·세로 직선 가운데 400mm 넘는 것
    band=cv2.dilate(wall.astype(np.uint8),np.ones((17,17),np.uint8))>0
    win=[]; bathmask=np.zeros((H,W),bool)
    for r in rooms:
        if r.get('kind')=='욕실':
            mb=np.zeros((H,W),np.uint8); cv2.fillPoly(mb,[np.array(r['pts'],np.int32)],1); bathmask|=cv2.erode(mb,np.ones((5,5),np.uint8))>0
    for t,c,a,b in segs(thin&band,400/mm):
        if t=='h': pts=band[int(c),int(a):int(b)+1]
        else: pts=band[int(a):int(b)+1,int(c)]
        if bathmask[int((c if t=='h' else (a+b)/2)), int(((a+b)/2) if t=='h' else c)]: continue
        if pts.mean()>0.9: win.append([t,float(c),int(a),int(b)])
    return {'벽':rect_path(wall,1.0),'칸':cells,'창선':win,'기구':objs}
