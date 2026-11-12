# 원본 평면도 → 읽고(직선 토막) → 다듬고(가로·세로, 합치기) → 가려내고(싱크대·붙박이장·신발장·샷시) → 집지니 기호로 다시 그릴 자료
import os, json, cv2, numpy as np
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
JJ_WALL_MM=200   # 집지니 표준 벽 두께(mm)
def clean_walls(wall, mm):
    """2026-11-12 대표 지시: 원본 외곽(벽)은 자리만 참고하고 집지니식으로 다시 그린다 — 가로·세로 곧은 띠, 두께는 두 가지(바깥·안)로 통일, 희끗한 점 없이"""
    H,W=wall.shape; w8=wall.astype(np.uint8)
    w8=cv2.morphologyEx(w8,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    L=max(8,int(450/mm)); out=[]
    hh=cv2.morphologyEx(w8,cv2.MORPH_OPEN,np.ones((1,L),np.uint8)); vv=cv2.morphologyEx(w8,cv2.MORPH_OPEN,np.ones((L,1),np.uint8))
    for m,ax in ((hh,'h'),(vv,'v')):
        n,lab,st,_=cv2.connectedComponentsWithStats(m,connectivity=4)
        for j in range(1,n):
            x,y,w_,h_,a_=st[j]; sub=(lab[y:y+h_,x:x+w_]==j)
            if ax=='h':
                cols=sub.sum(0); ok=cols>0; ys=np.arange(h_)[:,None]
                top=np.argmax(sub,0)[ok]; t=np.median(cols[ok]); c=np.median(top+cols[ok]/2.0)+y
                out.append(['h',x,x+w_,c,t])
            else:
                rows=sub.sum(1); ok=rows>0; left=np.argmax(sub,1)[ok]; t=np.median(rows[ok]); c=np.median(left+rows[ok]/2.0)+x
                out.append(['v',y,y+h_,c,t])
    if not out: return wall
    ts=np.array([o[4] for o in out]); tin=np.percentile(ts,25); tex=np.percentile(ts,90)
    tin=tex=JJ_WALL_MM/mm   # 2026-11-12 대표 지시 「집지니 타입 하나로 모두 통일」: 벽 두께는 모든 평면·모든 벽 같은 값
    clean_walls.T=(tin,tex)
    canvas=np.zeros((H,W),np.uint8); covered=(hh>0)|(vv>0)
    for ax,a,b,c,t in out:
        T=tex if abs(t-tex)<abs(t-tin) else tin; hT=T/2.0
        if ax=='h': cv2.rectangle(canvas,(int(round(a)),int(round(c-hT))),(int(round(b-1)),int(round(c+hT-1))),1,-1)
        else: cv2.rectangle(canvas,(int(round(c-hT)),int(round(a))),(int(round(c+hT-1)),int(round(b-1))),1,-1)
    rest=(w8>0)&~(cv2.dilate(covered.astype(np.uint8),np.ones((3,3),np.uint8))>0)   # 짧은 토막·기둥은 네모로
    n,lab,st,_=cv2.connectedComponentsWithStats(rest.astype(np.uint8),connectivity=4)
    for j in range(1,n):
        x,y,w_,h_,a_=st[j]
        if a_>=(JJ_WALL_MM/mm)**2*0.8 and min(w_,h_)>=JJ_WALL_MM/mm*0.6 and a_>=w_*h_*0.5: cv2.rectangle(canvas,(int(x),int(y)),(int(x+w_-1),int(y+h_-1)),1,-1)
    return canvas>0
def trace(path, plan):
    bgr=cv2.imread(path); H,W=bgr.shape[:2]; mm=plan.get('mmpp') or 23.0
    hsv=cv2.cvtColor(bgr,cv2.COLOR_BGR2HSV); v=hsv[...,2].astype(int); s=hsv[...,1].astype(int)
    rooms=plan['rooms']; house=np.zeros((H,W),np.uint8)
    for r in rooms: cv2.fillPoly(house,[np.array(r['pts'],np.int32)],1)
    house=cv2.dilate(house,np.ones((25,25),np.uint8))>0
    wall=cv2.morphologyEx((v<100).astype(np.uint8),cv2.MORPH_OPEN,np.ones((4,4),np.uint8))>0
    # 2026-11-12 대표 지시 「검정 선은 공용부까지 전부 따라 그린다」: 집 범위로 자르지 않고 건물 전체(가장 큰 벽 덩어리의 네모 안)를 딴다 — 집 범위로 자르면 벽이 잘려 튀어나간 토막이 생겼다
    nb0,lb0,sb0,_=cv2.connectedComponentsWithStats(wall.astype(np.uint8),connectivity=8)
    # 건물 범위(2026-11-12 점검기에서 원인 확인: 문·창에 끊겨 벽이 여러 덩어리인 평면은 「가장 큰 덩어리」만으로는 벽 대부분을 놓쳤다 — 84%까지)
    # → 방 범위(+1.2m)에 닿는 벽 덩어리에서 시작해, 그 네모(+0.3m)에 닿는 덩어리를 차례로 더한다. 치수선·글자는 그 바깥에 떨어져 있어 안 붙는다
    hb=cv2.dilate(house.astype(np.uint8),np.ones((max(3,int(1200/mm)),)*2,np.uint8))>0
    sel=np.zeros(nb0,bool)
    for j in range(1,nb0):
        x,y,w_,h_,a_=sb0[j]
        if a_>=30 and hb[y:y+h_,x:x+w_].any() and (lb0[y:y+h_,x:x+w_]==j)[hb[y:y+h_,x:x+w_]].any(): sel[j]=True
    if not sel.any(): sel[1+int(np.argmax(sb0[1:,4]))]=True
    for _ in range(3):
        ks=np.where(sel)[0]; X0=sb0[ks,0].min(); Y0=sb0[ks,1].min(); X1=(sb0[ks,0]+sb0[ks,2]).max(); Y1=(sb0[ks,1]+sb0[ks,3]).max(); e=int(300/mm)
        for j in range(1,nb0):
            x,y,w_,h_,a_=sb0[j]
            if not sel[j] and a_>=30 and x<X1+e and x+w_>X0-e and y<Y1+e and y+h_>Y0-e and min(w_,h_)>=3: sel[j]=True
    ks=np.where(sel)[0]; bx=int(sb0[ks,0].min()); by=int(sb0[ks,1].min()); bw0=int((sb0[ks,0]+sb0[ks,2]).max()-bx); bh0=int((sb0[ks,1]+sb0[ks,3]).max()-by)
    bld=np.zeros((H,W),bool); bld[max(0,by-6):by+bh0+7, max(0,bx-6):bx+bw0+7]=True
    wall&=bld
    # 2026-11-12 대원칙 「검정선은 똑같이 카피한다」: 건물 네모 안의 검은 선(굵은 벽·가는 선·문 호·샷시·계단)을 모두 그대로 딴다. 글자 조각과 욕실 기구만 뺀다
    ink=(((v<135)&((s<70)|(v<75)))|((v<205)&(s<30)))&bld   # 가는 회색 선(창·문 호)도 검정선. 아주 어두운 곳은 JPEG 번짐으로 채도가 높게 읽혀도 검정선
    ni,li,si,_=cv2.connectedComponentsWithStats(ink.astype(np.uint8),connectivity=8); ki=np.zeros(ni,bool)
    for j in range(1,ni):
        w_,h_,a_=si[j,2],si[j,3],si[j,4]
        fr=a_/float(w_*h_)
        ki[j]=not(a_<6 or (fr<0.62 and (max(w_,h_)*mm<500 or (min(w_,h_)*mm<480 and max(w_,h_)*mm<2000 and fr>=0.12))))   # 글자 조각(성긴 작은 덩어리)만 뺀다 — 꽉 찬 벽 토막·기둥은 남긴다
    ink=ki[li]
    ink=ink|((cv2.morphologyEx(ink.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((2,2),np.uint8))>0)&bld)   # 글자를 뺀 뒤, 가는 호의 끊긴 점을 잇는다
    for r in rooms:
        if r.get('kind')!='욕실': continue
        m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(r['pts'],np.int32)],1); m=cv2.erode(m,np.ones((9,9),np.uint8))>0
        ink&=~m
    # 방 한가운데 떠 있는 작은 덩어리(방 이름·면적 글자)는 뺀다 — 벽에 닿은 선(문·창·붙박이장)은 남는다
    inner=np.zeros((H,W),np.uint8)
    for r in rooms: cv2.fillPoly(inner,[np.array(r['pts'],np.int32)],1)
    inner=cv2.erode(inner,np.ones((11,11),np.uint8))>0
    nf,lf,sf,_=cv2.connectedComponentsWithStats(ink.astype(np.uint8),connectivity=8)
    out=np.bincount(lf[~inner].ravel(),minlength=nf)
    kf=np.ones(nf,bool); kf[0]=False
    for j in range(1,nf):
        if out[j]==0 and max(sf[j,2],sf[j,3])*mm<1500: kf[j]=False
    ink=kf[lf]
    meok=rect_path(ink,eps=0.5,snap=False)
    nw,lw,sw,_=cv2.connectedComponentsWithStats(wall.astype(np.uint8),connectivity=8); kw=np.ones(nw,bool); kw[0]=False
    for j in range(1,nw):
        w_,h_,a_=sw[j,2],sw[j,3],sw[j,4]
        if max(w_,h_)*mm<1200 and a_<w_*h_*0.55: kw[j]=False   # 굵은 글자
        if max(w_,h_)*mm<400: kw[j]=False   # 기구 그림 속 작은 검은 점
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
    # 문 읽기(대표 지적 2026-11-12 「문 방향이 완전히 다르다」): 원본의 4분의 1 원 + 문짝 선을 찾아 경첩 자리·여는 쪽을 그대로 가져온다
    doors=[]
    # 네이버 양식의 문: 흰 4분의 1 원(문이 쓸고 가는 자리) — 경첩은 원이 꽉 찬 모서리, 여는 쪽 변은 바깥이 벽 틈(흰색)인 변
    wh=((v>=245)&(s<=12)&house).astype(np.uint8)
    wh=cv2.morphologyEx(wh,cv2.MORPH_OPEN,np.ones((7,7),np.uint8))
    nd,ld,sd,_=cv2.connectedComponentsWithStats(wh,connectivity=4)
    darkish=(v<120)
    for j in range(1,nd):
        x,y,w_,h_,a_=sd[j]; Wm,Hm=w_*mm,h_*mm
        if not(520<=Wm<=1250 and 520<=Hm<=1250 and abs(w_-h_)<=0.22*max(w_,h_)): continue
        fr=a_/(w_*h_)
        if not(0.6<=fr<=0.9): continue
        reg=(ld[y:y+h_,x:x+w_]==j); q=max(2,int(min(w_,h_)*0.18))
        cor=[reg[:q,:q].mean(),reg[:q,-q:].mean(),reg[-q:,-q:].mean(),reg[-q:,:q].mean()]   # 왼위 오른위 오른아래 왼아래
        fc=int(np.argmin(cor)); hc=(fc+2)%4   # 가장 빈 모서리(호 바깥) 맞은편이 경첩
        if cor[fc]>0.3 or sorted(cor)[1]<0.6: continue
        C=[(x,y),(x+w_,y),(x+w_,y+h_),(x,y+h_)]
        n1,n2=(hc+1)%4,(hc+3)%4      # 경첩에 붙은 두 모서리
        def outside_white(k):        # 경첩→k 변의 바깥쪽(원 반대편) 3~8화소가 흰 틈인가
            (hx,hy),(kx,ky)=C[hc],C[k]; mx,my=(hx+kx)/2,(hy+ky)/2; fx,fy=C[fc]; dx,dy=(mx-((hx+kx+fx*0)/2)),0
            if hy==ky: sgn=-1 if fy>hy else 1; ys_=[int(hy+sgn*t) for t in range(3,9)]; xs_=[int(mx)]*6
            else: sgn=-1 if fx>hx else 1; xs_=[int(hx+sgn*t) for t in range(3,9)]; ys_=[int(my)]*6
            vals=[(0<=yy<H and 0<=xx<W and v[yy,xx]>=225) for xx,yy in zip(xs_,ys_)]
            return sum(vals)
        o1,o2=outside_white(n1),outside_white(n2)
        ac,bc=(n1,n2) if o1>=o2 else (n2,n1)
        doors.append({'x1':int(C[hc][0]),'y1':int(C[hc][1]),'x2':int(C[ac][0]),'y2':int(C[ac][1]),'cx':int(C[bc][0]),'cy':int(C[bc][1])})
    # 방 칸: 벽+가는 선으로 막힌 빈 곳. 방마다 가장 큰 칸 = 방 바닥, 방 안에서 바닥과 안 닿는 막힌 덩어리 = 가구·기구
    bar=(wall|cv2.dilate(thin.astype(np.uint8),np.ones((2,2),np.uint8)).astype(bool)|~house).astype(np.uint8)
    # 2026-11-12 대표 지시 「공용부는 도형을 그리지 말고 '공용부'라고만 적고 비워 둔다」: 공용부(집 범위 밖, 건물 안)에서는 건물 바깥 테두리 벽만 남긴다
    # 공용부 = 건물 네모 안이면서 집 범위 밖. 그 안의 벽은 건물 네모 가장자리(바깥 테두리)에 붙은 것만 남긴다
    pubzone=bld&~house
    cw=clean_walls(wall,mm); tin,tex=clean_walls.T
    edge=np.zeros((H,W),bool); e=12; edge[by-6:by+e, :]=True; edge[by+bh0-e:by+bh0+7, :]=True; edge[:, bx-6:bx+e]=True; edge[:, bx+bw0-e:bx+bw0+7]=True
    # 2026-11-12 대표 지시 「공용부 외곽선은 그대로 다 넣어라」: 공용부 굵은 벽은 모두 남긴다(계단·승강기 가는 선만 뺀다)
    # 승강기(EV) 찾기: 공용부 안의 대각선 두 줄이 엇갈린 네모(원본 X 표시)
    rawp=((((v<135)&((s<70)|(v<75)))|((v<205)&(s<30)))&pubzone).astype(np.uint8)*255
    LL=cv2.HoughLinesP(rawp,1,np.pi/180,threshold=20,minLineLength=int(700/mm),maxLineGap=4); dg=[]
    if LL is not None:
        for x1_,y1_,x2_,y2_ in LL.reshape(-1,4):
            ang=np.degrees(np.arctan2(y2_-y1_,x2_-x1_))%180
            if 30<=ang<=60: dg.append(('+',min(x1_,x2_),min(y1_,y2_),max(x1_,x2_),max(y1_,y2_)))
            elif 120<=ang<=150: dg.append(('-',min(x1_,x2_),min(y1_,y2_),max(x1_,x2_),max(y1_,y2_)))
    ev=[]
    for a in dg:
        if a[0]!='+': continue
        for b in dg:
            if b[0]!='-': continue
            ix=min(a[3],b[3])-max(a[1],b[1]); iy=min(a[4],b[4])-max(a[2],b[2])
            if ix<=0 or iy<=0: continue
            if ix*iy<0.6*max((a[3]-a[1])*(a[4]-a[2]),(b[3]-b[1])*(b[4]-b[2])): continue
            box=[int(min(a[1],b[1])),int(min(a[2],b[2])),int(max(a[3],b[3])),int(max(a[4],b[4]))]
            if not(1000<=(box[2]-box[0])*mm<=3200 and 1000<=(box[3]-box[1])*mm<=3200): continue
            if any(min(e[2],box[2])>max(e[0],box[0]) and min(e[3],box[3])>max(e[1],box[1]) for e in ev): continue
            ev.append(box)
    # 승강기 둘째 방법: 문 틈을 메운 벽으로 닫히는 작은 네모 칸(공용부 안)
    k2=max(5,int(1100/mm))
    for cwc in (cw.astype(np.uint8),cv2.morphologyEx(cw.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((k2,k2),np.uint8))):
     n2,l2,s2,_=cv2.connectedComponentsWithStats((1-cwc).astype(np.uint8),connectivity=4)
     for jj in range(1,n2):
        x,y,w_,h_,a_=s2[jj]
        if not(900<=w_*mm<=3200 and 900<=h_*mm<=3200 and 0.7<=w_/h_<=1.43 and a_>=w_*h_*0.75): continue
        if pubzone[y:y+h_,x:x+w_].mean()<0.6: continue
        if any(min(e[2],x+w_)>max(e[0],x) and min(e[3],y+h_)>max(e[1],y) for e in ev): continue
        ev.append([int(x),int(y),int(x+w_),int(y+h_)])
    # 공용부 이름: 벽으로 둘러싸인 공용 칸(건물 네모 가장자리에 닿는 바깥 빈 곳·승강기 칸은 뺀다), 칸에서 가장 넓은 자리에 하나씩
    pz=(pubzone&~(cv2.dilate(cw.astype(np.uint8),np.ones((3,3),np.uint8))>0)).astype(np.uint8)
    kk=max(5,int(1300/mm)); seal=cv2.dilate(cw.astype(np.uint8),np.ones((kk,kk),np.uint8))   # 문·창 틈을 막고 바깥에서 물 붓기 = 건물 바깥
    ff=(1-seal).astype(np.uint8); msk=np.zeros((H+2,W+2),np.uint8); cv2.floodFill(ff,msk,(0,0),2); outside=cv2.dilate((ff==2).astype(np.uint8),np.ones((kk,kk),np.uint8))>0
    npz,lpz,spz,cpz=cv2.connectedComponentsWithStats(pz,connectivity=4); publab=[]
    for jj in range(1,npz):
        x,y,w_,h_,a_=spz[jj]
        if a_*mm*mm/1e6<3: continue
        m=(lpz==jj)&~outside
        if m.sum()*mm*mm/1e6<3: continue   # 건물 바깥 빈 곳
        if 1000<=w_*mm<=3200 and 1000<=h_*mm<=3200 and 0.7<=w_/h_<=1.43 and a_>=w_*h_*0.7 and not any(min(e[2],x+w_)>max(e[0],x) and min(e[3],y+h_)>max(e[1],y) for e in ev):
            ev.append([int(x),int(y),int(x+w_),int(y+h_)]); continue   # 벽으로 닫힌 작은 네모 칸 = 승강기
        if any(m[e[1]:e[3],e[0]:e[2]].mean()>0.5 and m[e[1]:e[3],e[0]:e[2]].sum()>=a_*0.6 for e in ev): continue
        for e in ev: m[e[1]-3:e[3]+4,e[0]-3:e[2]+4]=False
        dt=cv2.distanceTransform(m.astype(np.uint8),cv2.DIST_L2,5); yy,xx=np.unravel_index(np.argmax(dt),dt.shape)
        publab.append([int(xx),int(yy),int(round(dt[yy,xx]*2))])
    pubd=''
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
    # 문 더 찾기(2026-11-12 「도어 위치·방향은 원본 그대로」): 흰 4분의 1 원으로 못 찾은 문을 가는 선(호 + 문짝 선)에서 찾는다
    raw=(((v<135)&((s<70)|(v<75)))|((v<205)&(s<30)))&bld
    tl=raw&~(cv2.dilate(wall.astype(np.uint8),np.ones((5,5),np.uint8))>0)
    tl=cv2.morphologyEx(tl.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    na,la,sa,_=cv2.connectedComponentsWithStats(tl,connectivity=8)
    def near_door(x0,y0,x1,y1):
        for dd in doors:
            ax0,ax1=sorted([dd['x1'],dd['x2'],dd['cx']])[0::2]; ay0,ay1=sorted([dd['y1'],dd['y2'],dd['cy']])[0::2]
            if x0<ax1+4 and x1>ax0-4 and y0<ay1+4 and y1>ay0-4: return True
        return False
    for j in range(1,na):
        x,y,w_,h_,a_=sa[j]
        if not(520<=w_*mm<=1300 and 520<=h_*mm<=1300 and 0.75<=w_/h_<=1.33): continue
        if a_>w_*h_*0.35: continue
        if near_door(x,y,x+w_,y+h_): continue
        ys,xs=np.where(la[y:y+h_,x:x+w_]==j); xs=xs+x; ys=ys+y; R=(w_+h_)/2.0
        C=[(x,y),(x+w_-1,y),(x+w_-1,y+h_-1),(x,y+h_-1)]; best=None
        for k,(cx0,cy0) in enumerate(C):
            dist=np.hypot(xs-cx0,ys-cy0); arc=np.mean(np.abs(dist-R)<=max(2.5,R*0.08))
            if best is None or arc>best[0]: best=(arc,k)
        if best[0]<0.35: continue
        hc=best[1]; a1,a2=(hc+1)%4,(hc+3)%4
        def edge_cnt(k):
            (px,py),(qx,qy)=C[hc],C[k]
            if py==qy: return np.sum((np.abs(ys-py)<=2))
            return np.sum((np.abs(xs-px)<=2))
        leaf,op=(a1,a2) if edge_cnt(a1)>=edge_cnt(a2) else (a2,a1)
        doors.append({'x1':int(C[hc][0]),'y1':int(C[hc][1]),'x2':int(C[op][0]),'y2':int(C[op][1]),'cx':int(C[leaf][0]),'cy':int(C[leaf][1]),'호':1})
    # 샷시·창(대표 지적 2026-11-12 「샷시가 빠졌다」): 벽 줄 안의 끊긴 틈 = 창. 벽을 가로·세로로 이어 붙여 메운 뒤 원래 벽을 빼면 틈만 남는다
    K=max(9,int(2600/mm)); sash=[]
    dz=np.zeros((H,W),bool)
    for dd in doors:
        x0_,x1_=sorted([dd['x1'],dd['x2']]); y0_,y1_=sorted([dd['y1'],dd['y2']]); dz[max(0,y0_-6):y1_+7,max(0,x0_-6):x1_+7]=True
    for ax in ('h','v'):
        ker=np.ones((1,K),np.uint8) if ax=='h' else np.ones((K,1),np.uint8)
        gap=(cv2.morphologyEx(wall.astype(np.uint8),cv2.MORPH_CLOSE,ker)>0)&~wall&~dz
        ng,lg,sg,_=cv2.connectedComponentsWithStats(gap.astype(np.uint8),connectivity=4)
        for j in range(1,ng):
            x,y,w_,h_,a_=sg[j]; Lp,Sp=(w_,h_) if ax=='h' else (h_,w_)
            if Lp*mm<400 or Sp<3 or Sp*mm>400 or a_<w_*h_*0.7: continue
            T=tex if abs(Sp-tex)<abs(Sp-tin) else tin   # 샷시 두께를 붙은 벽 두께로 통일(깔끔하게)
            if ax=='h': c=y+h_/2.0; sash.append([ax,int(x),int(round(c-T/2)),int(x+w_),int(round(c+T/2))])
            else: c=x+w_/2.0; sash.append([ax,int(round(c-T/2)),int(y),int(round(c+T/2)),int(y+h_)])
    # 2026-11-12 대표 지시 「백색 실선 상자(샷시) 싹 지우고 집지니식 외곽선만」: 샷시 자리는 벽으로 메워 외곽선을 잇는다(자료로는 남김)
    # 2026-11-12 대표 지시 「문 개구부 처리 하지 말고 그냥 삭제」: 문 자리도 벽으로 메워 외곽선만 남기고, 메운 벽까지 한 번 더 곧게 다듬는다
    w2=wall.copy(); T2=int(round(JJ_WALL_MM/mm/2))
    for q in sash: w2[q[2]:q[4],q[1]:q[3]]=True
    for d_ in doors:
        x0_,x1_=sorted([d_['x1'],d_['x2']]); y0_,y1_=sorted([d_['y1'],d_['y2']])
        if x1_-x0_>=y1_-y0_: w2[max(0,y0_-T2):y0_+T2+1,x0_:x1_+1]=True
        else: w2[y0_:y1_+1,max(0,x0_-T2):x0_+T2+1]=True
    cw=clean_walls(w2,mm)
    # 2026-11-12 대표 지시 「주방 도어·싱크대 박스·샷시 모두 삭제」: 주방 칸(+벽 두께)에 걸친 문·샷시는 그리지 않는다
    kz=np.zeros((H,W),np.uint8)
    for r in rooms:
        if r.get('kind')=='주방' or '주방' in str(r.get('name','')): cv2.fillPoly(kz,[np.array(r['pts'],np.int32)],1)
    kz=cv2.dilate(kz,np.ones((max(3,int(300/mm)),)*2,np.uint8))>0
    def inK(x0,y0,x1,y1):
        x0,x1=sorted([int(x0),int(x1)]); y0,y1=sorted([int(y0),int(y1)]); sub=kz[max(0,y0):y1+1,max(0,x0):x1+1]
        return sub.size>0 and sub.mean()>0.5
    sash=[q for q in sash if not inK(q[1],q[2],q[3],q[4])]
    doors=[d_ for d_ in doors if not inK(min(d_['x1'],d_['x2'],d_['cx']),min(d_['y1'],d_['y2'],d_['cy']),max(d_['x1'],d_['x2'],d_['cx']),max(d_['y1'],d_['y2'],d_['cy']))]
    # 2026-11-12 대표 지시(10:45) 「네이버 평면도의 검정선만 따서 반영, 나머지는 집지니식」: 벽 그림은 원본 검정 굵은 선 그대로(다듬지 않음). cw는 공용부·승강기 찾기에만 쓴다: 굵은 벽 전부(문·샷시 자리는 메움), 가는 선·문·샷시 기호는 없음
    return {'샷시':sash,'문':doors,'공용칸':publab,'EV':ev,'틀':[int(bx),int(by),int(bx+bw0),int(by+bh0)],'공용':pubd,'벽':rect_path(wall,0.8),'칸':cells,'창선':win,'기구':objs}
