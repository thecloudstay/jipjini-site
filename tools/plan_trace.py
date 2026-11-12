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
# 2026-11-12 대표 가정 「네이버도 캐드를 원칙대로 변환해 찍어 냈다」 역설계: 그림판 923×676 고정, 벽 5~6화소(둘째 양식 9·6화소), 문 반지름 23~30화소 — 축척과 무관한 화소 고정 값
NV_JOINT=12        # 이음·문틀 띠·창 끝 틈 허용(화소)
NV_DOOR_R=30       # 문 반지름 최대(화소)
JJ_WALL_MM=200   # 집지니 표준 벽 두께(mm) — 문·샷시 메움 등 보조용
JJ_EXT_MM,JJ_STR_MM,JJ_PART_MM=250,200,120   # 2026-11-12 캐드로 바꿔도 맞도록: 외벽 250 · 두꺼운 안벽(구조벽) 200 · 칸막이 120
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
            # 2026-11-12 고침(157·165·205TEA·94 놓친 굵은 벽 R6): 몇 화소 꺾여 이어진 벽(높이 다른 두 벽)이 한 덩어리로 묶여 중심선이 하나로 정해져
            #   소수 쪽 벽이 6~10화소 비켜 그려졌다 → 열(행)마다 중심을 재어 벽 두께 절반 넘게 바뀌는 곳에서 끊는다
            S_=sub if ax=='h' else sub.T; o0,o1=(x,y) if ax=='h' else (y,x)
            cols=S_.sum(0); ok=np.where(cols>0)[0]
            if not len(ok): continue
            top=np.argmax(S_,0); cen=top+cols/2.0; t=float(np.median(cols[ok])); groups=[]; g=[ok[0]]
            nz=[ok[0]]   # 기준 = 겹치지 않은 최근 200열의 중심(두 띠가 겹친 열 = 꺾인 자리는 기준에서 뺀다)
            for i in ok[1:]:
                if i==g[-1]+1 and (cols[i]>1.4*t or abs(cen[i]-np.median(cen[nz[-200:]]))<=max(2.0,t*0.5)):
                    g.append(i)
                    if cols[i]<=1.4*t: nz.append(i)
                else: groups.append(g); g=[i]; nz=[i]
            groups.append(g)
            for g in groups:
                if len(g)<min(L,len(ok)) and len(groups)>1: continue
                gi=np.array(g); out.append([ax,o0+gi[0],o0+gi[-1]+1,float(np.median(cen[gi]))+o1,float(np.median(cols[gi]))])
    # 2026-11-12 고침(111DT·120OT-5 외벽 샘): 창 사이·창과 문틀 사이 짧은 벽 토막(약 17화소)이 450mm 열기로 지워졌다
    #   → 가로·세로 열기에 안 걸린 덩어리 중 벽 두께(4~9화소)의 꽉 찬 직사각형이고 12화소 넘게 길면 그대로 벽 조각으로 넣는다
    #   (외따로 떨어진 덩어리 전체가 그 직사각형일 때만 — 두께 다른 벽 모서리의 남은 조각은 아니다: 108A 피트 상자, 첫 시도 R4 3→5 로 버림)
    n2,l2,s2,_=cv2.connectedComponentsWithStats(w8,connectivity=8)
    for j in range(1,n2):
        x,y,w_,h_,a_=s2[j]
        if 4<=min(w_,h_)<=9 and max(w_,h_)>=12 and max(w_,h_)<L and a_>=w_*h_*0.85:
            out.append(['h',x,x+w_,y+h_/2.0,float(h_)] if w_>=h_ else ['v',y,y+h_,x+w_/2.0,float(w_)])
    if not out: return wall
    ts=np.array([o[4] for o in out]); t_lo=np.percentile(ts,20); t_hi=np.percentile(ts,85); mid=(t_lo+t_hi)/2.0 if t_hi>t_lo*1.25 else t_lo*0.8
    # 벽 종류 정하기: 건물 바깥(빈 곳)과 맞닿으면 외벽, 아니면 원본 두께로 구조벽/칸막이
    body=cv2.morphologyEx(w8,cv2.MORPH_CLOSE,np.ones((max(5,int(1300/mm)),)*2,np.uint8)); ff=(1-body).astype(np.uint8); mk=np.zeros((H+2,W+2),np.uint8); cv2.floodFill(ff,mk,(0,0),2); outside=(ff==2)
    for o in out:
        ax,a,b,c,t=o; probe=[]
        for f_ in (0.25,0.5,0.75):
            q=a+(b-a)*f_; d0=t/2+max(3,int(400/mm))
            pts=[(q,c-d0),(q,c+d0)] if ax=='h' else [(c-d0,q),(c+d0,q)]
            for X,Y in pts:
                X=int(round(X)); Y=int(round(Y))
                if 0<=X<W and 0<=Y<H: probe.append(outside[Y,X] and not body[Y,X])
                else: probe.append(True)
        o.append(JJ_EXT_MM if sum(probe)>=2 else (JJ_STR_MM if t>=mid else JJ_PART_MM))
    tin=tex=JJ_WALL_MM/mm
    clean_walls.T=(tin,tex)
    # 끝 맞추기(2026-11-12 「벽 두께가 제각각·이음이 지저분」): 원본 두께로 잡힌 끝은 표준 두께로 줄인 맞은편 벽 바깥면에 맞춘다 — 튀어나온 꼬투리 없앰
    hs=[o for o in out if o[0]=='h']; vs=[o for o in out if o[0]=='v']
    def snap(A,B):
        for o in A:
            for k,sgn in ((1,-1),(2,1)):          # 1=시작 끝(왼/위), 2=끝(오른/아래)
                e=o[k]; best=None
                for q in B:
                    if q[1]-q[4]<=o[3]<=q[2]+q[4] and abs(q[3]-e)<=max(q[4],o[4])*0.9+2:
                        if best is None or abs(q[3]-e)<abs(best[3]-e): best=q
                if best is not None: o[k]=best[3]+sgn*best[5]/mm/2.0
    snap(hs,vs); snap(vs,hs)
    canvas=np.zeros((H,W),np.uint8); covered=(hh>0)|(vv>0)
    clean_walls.segs=[(o[0],o[1],o[2],o[3],o[5]) for o in out]   # 캐드 내보내기용: (방향, 시작, 끝, 중심선, 두께mm)
    for ax,a,b,c,t,Tm in out:
        T=Tm/mm; hT=T/2.0
        if ax=='h': cv2.rectangle(canvas,(int(round(a)),int(round(c-hT))),(int(round(b-1)),int(round(c+hT-1))),1,-1)
        else: cv2.rectangle(canvas,(int(round(c-hT)),int(round(a))),(int(round(c+hT-1)),int(round(b-1))),1,-1)
    rest=(w8>0)&~(cv2.dilate(covered.astype(np.uint8),np.ones((3,3),np.uint8))>0)   # 짧은 토막·기둥은 네모로
    n,lab,st,_=cv2.connectedComponentsWithStats(rest.astype(np.uint8),connectivity=4)
    for j in range(1,n):
        x,y,w_,h_,a_=st[j]
        if a_>=(JJ_WALL_MM/mm)**2*0.8 and min(w_,h_)>=JJ_WALL_MM/mm*0.6 and a_>=w_*h_*0.5: cv2.rectangle(canvas,(int(x),int(y)),(int(x+w_-1),int(y+h_-1)),1,-1)
    return canvas>0

# ── 창(샷시) 찾기 2026-11-12 3판 — 대표 지적 「안쪽 파란 줄 상자」 원인 분석 뒤 새로 짬(tools/naver_rules.md 「창」)
#   예전 방식(벽 틈 = 창, 2.6m 까지)은 ① 방-발코니 사이 긴 창(3~4m)을 놓치고 ② 방 사이 문·칸막이 틈을 창으로 잡았다.
#   네이버 창 기호 그대로 찾는다: 벽 줄 안의 띠(깊이 4~15화소), 위아래 가는 선 두 줄이 나란히, 사이에 검정이 없고 밝음이 30% 넘음,
#   양 끝이 검은 벽에 닿음, 600mm 넘음, 문 자리 아님, 방 한가운데(욕조 테두리·가구) 아님, 한쪽은 집 안·다른 쪽은 바깥이나 발코니.
#   창틀선은 옛 양식은 검정 1화소(바닥색 번짐으로 채도가 높게 읽힘), 새 양식은 옅은 회색 — 둘 다 받는다.
def runs(row, gapfill, minlen):
    r=row.astype(np.uint8)
    if gapfill>0: r=cv2.morphologyEx(r.reshape(1,-1),cv2.MORPH_CLOSE,np.ones((1,gapfill),np.uint8)).ravel()
    d=np.diff(np.concatenate([[0],r,[0]])); st=np.where(d==1)[0]; en=np.where(d==-1)[0]
    return [(a,b) for a,b in zip(st,en) if b-a>=minlen]
def strips_h(v, mm, wall, thin):
    H,W=v.shape; T=thin.copy(); T[1:]|=thin[:-1]   # 반 화소 어긋남 허용
    light=(v>200).astype(np.int32); cs=np.vstack([np.zeros((1,W),np.int32),np.cumsum(light,0)])
    blk=(v<100).astype(np.int32); cb=np.vstack([np.zeros((1,W),np.int32),np.cumsum(blk,0)])
    minlen=max(12,int(400/mm)); cand=[]
    for d in range(4,16):
        top=T[:-d]; bot=T[d:]
        n=max(1,d-3)
        frac=(cs[d-1:H][:H-d]-cs[2:H-d+2])/n     # 두 선 사이(y1+2 … y1+d-2) 밝은 비율 — 가운데 선이 있는 좁은 띠는 1/3 쯤
        blkf=(cb[d-1:H][:H-d]-cb[2:H-d+2])/n     # 두 선 사이 검정 비율 — 벽 속이면 높다
        M=top&bot&(frac>=0.3)&(blkf<=0.4)
        ys=np.where(M.sum(1)>=minlen)[0]
        for y in ys:
            for a,b in runs(M[y],6,minlen): cand.append([int(y),int(y+d),int(a),int(b)])
    # 같은 자리 겹친 것 → 가장 긴 것
    cand.sort(key=lambda q:-(q[3]-q[2])); keep=[]
    for q in cand:
        if any(abs(q[0]-k[0])<=6 and q[2]<k[3] and q[3]>k[2] for k in keep): continue
        keep.append(q)
    def touch(p,y0,y1):
        box=wall[max(0,y0-3):y1+4, max(0,p-8):p+9]; return box.size and box.mean()>0.08
    return [q for q in keep if touch(q[2],q[0],q[1]) and touch(q[3],q[0],q[1])]
def window_strips(img, mm, doors=None, rooms=None):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); v=hsv[:,:,2].astype(int); sat=hsv[:,:,1].astype(int)
    dark=v<110; wall=cv2.morphologyEx(dark.astype(np.uint8),cv2.MORPH_OPEN,np.ones((4,4),np.uint8))>0
    thin=(dark|((v<200)&(sat<45)))&~wall   # 검은 창틀선(옛 양식) + 옅은 회색 창틀선(새 양식) — 바닥 나뭇결은 채도가 높아 빠진다
    out=[['h',a,b,y0,y1] for y0,y1,a,b in strips_h(v,mm,wall,thin)]
    out+=[['v',a,b,x0,x1] for x0,x1,a,b in strips_h(v.T.copy(),mm,wall.T.copy(),thin.T.copy())]
    def on_door(t,a,b,c0,c1):
        for dd in doors or []:
            xs=sorted([dd['x1'],dd['x2'],dd['cx']]); ys=sorted([dd['y1'],dd['y2'],dd['cy']])
            X0,X1,Y0,Y1=(a,b,c0,c1) if t=='h' else (c0,c1,a,b)
            if X0<xs[2]-2 and X1>xs[0]+2 and Y0<ys[2]+3 and Y1>ys[0]-3: return True
        return False
    def side(x,y):
        for r in rooms or []:
            P=r['pts']; c=False
            for i in range(len(P)):
                (x1,y1),(x2,y2)=P[i],P[(i+1)%len(P)]
                if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/((y2-y1) or 1e-9)+x1: c=not c
            if c: return r.get('kind') or '?'
        return None
    def deep(x,y):
        for r in rooms or []:
            P=np.array(r['pts'],np.float32).reshape(-1,1,2)
            if len(P)>=3 and cv2.pointPolygonTest(P,(float(x),float(y)),True)>max(8,250.0/mm): return True
        return False
    off=600.0/mm; keep=[]
    for q in out:
        t,a,b,c0,c1=q
        if (b-a)*mm<600 or on_door(*q): continue
        m=(a+b)/2.0; cx,cy=(m,(c0+c1)/2.0) if t=='h' else ((c0+c1)/2.0,m)
        if deep(cx,cy): continue   # 방 한가운데 쪽(경계에서 멀리) = 욕조 테두리·가구
        A,B=(side(m,c0-off),side(m,c1+off)) if t=='h' else (side(c0-off,m),side(c1+off,m))
        # 한쪽은 집 안 공간, 다른 쪽은 바깥이나 발코니(발코니끼리·방끼리·둘 다 바깥은 창이 아니다)
        inside=lambda k: k is not None and k!='발코니'
        # 2026-11-12 고침(88 방2 창 빠짐 R8): 방 읽기가 타일 바닥 발코니를 「기타」로 이름 붙여 방-기타 사이 창을 버렸다
        #   → 창 띠 모양(가는 선 두 줄·사이 흼·양 끝 벽)이 이미 확인된 것이므로 방·거실·주방과 「기타」 사이도 창으로 본다
        live=lambda k: k in ('방','거실','주방')
        if (inside(A) and (B is None or B=='발코니')) or (inside(B) and (A is None or A=='발코니')) or (A=='발코니' and B is None) or (B=='발코니' and A is None) \
           or (live(A) and B=='기타') or (live(B) and A=='기타'): keep.append(q)
    return keep

# ── 문 안전 거르기(2026-11-12 대표 지시 「외벽에 창호를 문으로 그려 창문에 떨어지는 현상 — 사람이 떨어져 죽을 수도 있으니 잘못 그리면 안 된다」)
#   문 양쪽(문 가운데에서 벽에 수직으로 600mm)이 건물 밖이면 그 문은 그리지 않는다. 예외 하나: 안쪽이 현관인 문(공용 복도로 나가는 현관문).
#   건물 밖 = 그림 가장자리에서 벽·창·문 자리·방(+벽 두께)을 넘지 않고 닿는 곳.
def _inpoly(x,y,P):
    c=False
    for i in range(len(P)):
        (x1,y1),(x2,y2)=P[i],P[(i+1)%len(P)]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/((y2-y1) or 1e-9)+x1: c=not c
    return c
def outside_mask(rooms, wseg, sash, doors, mm, H, W):
    m=np.zeros((H,W),np.uint8)
    for ax,a,b,c,t in wseg:
        h=max(1.5,t/mm/2)
        if ax=='h': cv2.rectangle(m,(int(a)-1,int(c-h)),(int(b)+1,int(c+h)),1,-1)
        else: cv2.rectangle(m,(int(c-h),int(a)-1),(int(c+h),int(b)+1),1,-1)
    for ax,x0,y0,x1,y1 in sash: cv2.rectangle(m,(int(x0),int(y0)),(int(x1),int(y1)),1,-1)
    for d in doors: cv2.line(m,(int(d['x1']),int(d['y1'])),(int(d['x2']),int(d['y2'])),1,5)
    for r in rooms:
        if len(r['pts'])>=3: cv2.fillPoly(m,[np.array(r['pts'],np.int32)],1)
    m=cv2.dilate(m,np.ones((max(5,int(2*250/mm)),)*2,np.uint8))
    ff=m*255; mk=np.zeros((H+2,W+2),np.uint8); cv2.floodFill(ff,mk,(0,0),128)
    return ff==128
def safe_doors(doors, rooms, wseg, sash, mm, H, W):
    out=outside_mask(rooms,wseg,sash,doors,mm,H,W); off=600.0/mm; keep=[]
    kind=lambda x,y: next((r.get('kind') for r in rooms if len(r['pts'])>=3 and _inpoly(x,y,r['pts'])),None)
    isout=lambda x,y: not(0<=int(x)<W and 0<=int(y)<H) or bool(out[int(y),int(x)])
    for d in doors:
        L=((d['x2']-d['x1'])**2+(d['y2']-d['y1'])**2)**.5 or 1; ux,uy=(d['x2']-d['x1'])/L,(d['y2']-d['y1'])/L; mx,my=(d['x1']+d['x2'])/2,(d['y1']+d['y2'])/2
        P=[(mx-uy*off,my+ux*off),(mx+uy*off,my-ux*off)]; o=[isout(*P[0]),isout(*P[1])]
        if not(o[0] or o[1]): keep.append(d); continue
        inner=P[1] if o[0] else P[0]
        if not(o[0] and o[1]) and kind(*inner)=='현관': keep.append(d)   # 현관문만 예외
    return keep

# ── 벽 그림 = 벽선 그대로(2026-11-12 대표 지적 「이상한데」 157 평형 발코니 윗벽 빠짐·없는 벽 생김)
#   원인: 그림용 벽을 문·창을 메운 벽(w2)으로 한 번 더 다듬으며(clean_walls) 벽이 옮겨지거나 사라졌다(24평형 중 21곳, 빠진 벽 최대 11%).
#   → 캐드 파일이 쓰는 벽선을 그대로 그리고, 창 띠·문 자리만 옆 벽 두께로 메워 외곽선을 잇는다. 화면과 캐드가 같은 자료 한 벌에서 나온다.
def wall_path_from_segs(wseg, sash, doors, mm):
    R=[]
    def near(ax, c, a, b):   # 같은 방향 벽선 중 가까운 것(중심선·두께)
        best=None
        for s in wseg:
            if s[0]!=ax: continue
            d=abs(s[3]-c)
            if d<=14 and min(b,s[2])-max(a,s[1])>-12 and (best is None or d<best[0]): best=(d,s[3],s[4])
        return best
    for ax,a,b,c,t in wseg:
        h=t/mm/2.0; R.append((ax,a,b,c,h))
    for ax,x0,y0,x1,y1 in sash:
        if ax=='h': c=(y0+y1)/2.0; n=near('h',c,x0,x1); R.append(('h',x0,x1,n[1] if n else c,(n[2] if n else 200)/mm/2.0))
        else: c=(x0+x1)/2.0; n=near('v',c,y0,y1); R.append(('v',y0,y1,n[1] if n else c,(n[2] if n else 200)/mm/2.0))
    for d in doors:
        if abs(d['y1']-d['y2'])<=2:   # 가로 문 자리
            a,b=sorted([d['x1'],d['x2']]); n=near('h',d['y1'],a,b)
            if n: R.append(('h',a,b,n[1],n[2]/mm/2.0))
        elif abs(d['x1']-d['x2'])<=2:
            a,b=sorted([d['y1'],d['y2']]); n=near('v',d['x1'],a,b)
            if n: R.append(('v',a,b,n[1],n[2]/mm/2.0))
    out=[]
    for ax,a,b,c,h in R:
        if ax=='h': out.append('M%.1f %.1fH%.1fV%.1fH%.1fZ'%(a-0.6,c-h,b+0.6,c+h,a-0.6))   # 끝은 늘리지 않는다 — 벽선 끝이 이미 맞닿는 벽 바깥면까지 와 있다(늘리면 모서리에 혹이 생김)
        else: out.append('M%.1f %.1fH%.1fV%.1fH%.1fZ'%(c-h,a-0.6,c+h,b+0.6,c-h))   # 이음매 실선이 안 보이게 0.6화소만 겹침
    return ''.join(out)

# ── 사선벽(2026-11-12 대표 지적 「테라스 대각선 미인식」): 벽선은 가로·세로만 담는다 → 가로·세로 벽으로 설명되지 않는
#   검은 벽 덩어리 중 비스듬하고 길쭉한 것(최소 둘레 네모가 15~75도, 1m 넘게, 두께 400mm 아래)을 [x1,y1,x2,y2,두께mm] 로 남긴다
def diag_walls(wall, wseg, mm, bld=None):
    H,W=wall.shape; cov=np.zeros((H,W),np.uint8)
    for ax,a,b,c,t in wseg:
        h=t/mm/2.0+2
        if ax=='h': cv2.rectangle(cov,(int(a)-2,int(c-h)),(int(b)+2,int(c+h)),1,-1)
        else: cv2.rectangle(cov,(int(c-h),int(a)-2),(int(c+h),int(b)+2),1,-1)
    res=(wall&~(cov>0)).astype(np.uint8)
    if bld is not None: res&=bld.astype(np.uint8)
    res=cv2.morphologyEx(res,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(res,connectivity=8); out=[]
    for j in range(1,n):
        if st[j,4]<20: continue
        ys,xs=np.where(lab==j); pts=np.stack([xs,ys],1).astype(np.float32)
        (cx,cy),(rw,rh),ang=cv2.minAreaRect(pts)
        L,T=(rw,rh) if rw>=rh else (rh,rw)
        if L*mm<400 or L<12 or T*mm>400 or T<2: continue   # 2026-11-12 하네스 학습(162·125TB 외벽 터짐): 비스듬한 벽이 창·이음에 끊겨 1m 아래 토막이 많다 → 400mm(12화소)부터
        a=ang if rw>=rh else ang+90   # 긴 쪽 방향
        a=((a%180)+180)%180
        # 가로·세로는 벽선이 맡는다. 2026-11-12 고침(103 외벽 샘): 15도 안쪽을 다 버려 세로에서 10도쯤 기운 벽(피트 옆 사다리꼴 벽)을 아무도 안 맡았다
        #   → 여기 남은 덩어리는 이미 벽선으로 안 덮인 것이므로 5도 안쪽만 버린다
        if min(abs(a-0),abs(a-90),abs(a-180))<5: continue
        if st[j,4] < L*T*(0.4 if 25<=a<=65 else 0.55): continue   # 속이 빈 것(글자·기호)은 버린다 — 45도 근처는 직각 벽 토막이 붙어 채움이 낮아도 벽(125TB)
        r=np.deg2rad(a); dx,dy=np.cos(r)*L/2,np.sin(r)*L/2
        tm=250 if T*mm>=170 else 200 if T*mm>=110 else 120
        out.append([round(cx-dx,1),round(cy-dy,1),round(cx+dx,1),round(cy+dy,1),tm])
    return out

# ── 사선창: 가는 선 두 줄이 비스듬히 나란히(간격 3~15화소), 양 끝이 벽에 닿음 — 실외기실·테라스의 비스듬한 창
def diag_windows(img, mm):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); v=hsv[:,:,2].astype(int); sat=hsv[:,:,1].astype(int)
    dark=v<110; wall=cv2.morphologyEx(dark.astype(np.uint8),cv2.MORPH_OPEN,np.ones((4,4),np.uint8))>0
    thin=((dark|((v<200)&(sat<45)))&~wall).astype(np.uint8)*255
    L=cv2.HoughLinesP(thin,1,np.pi/360,threshold=max(10,int(500/mm)),minLineLength=int(800/mm),maxLineGap=4)
    if L is None: return []
    segs=[]
    for x1,y1,x2,y2 in L.reshape(-1,4):
        a=np.degrees(np.arctan2(y2-y1,x2-x1))%180
        if min(a,abs(a-90),180-a)<15: continue
        segs.append((x1,y1,x2,y2,a))
    out=[]; tb=thin>0
    # 2026-11-12 하네스 학습 2판: 네이버 창 기호는 가는 선 두 줄(화소 고정 간격) — 허프는 두 줄을 한 줄로 합쳐 버린다(106A)
    #   → 찾은 비스듬한 선을 따라 수직 단면을 잘라 「가는 선이 두 줄 이상 지나가는가」를 본다. 단면의 6할 넘게 두 줄이면 창.
    def profile(px,py,nx,ny):
        runs=[]; cur=None
        for o in range(-10,11):
            x,y=int(round(px+nx*o)),int(round(py+ny*o))
            on=0<=x<tb.shape[1] and 0<=y<tb.shape[0] and tb[y,x]
            if on and cur is None: cur=[o,o]
            elif on: cur[1]=o
            elif cur is not None: runs.append(cur); cur=None
        if cur is not None: runs.append(cur)
        return runs
    for (x1,y1,x2,y2,a) in segs:
        dx,dy=x2-x1,y2-y1; Ln=np.hypot(dx,dy) or 1; ux,uy=dx/Ln,dy/Ln; nx,ny=-uy,ux
        good=[]
        for t in np.linspace(2,Ln-2,max(8,int(Ln/3))):
            r=profile(x1+ux*t,y1+uy*t,nx,ny)
            if len(r)>=2 and r[-1][1]-r[0][0]>=3: good.append((r[0][0],r[-1][1]))
        if len(good)<0.6*max(8,int(Ln/3)): continue
        lo=float(np.median([g[0] for g in good])); hi=float(np.median([g[1] for g in good])); mid=(lo+hi)/2.0
        p0=(x1+nx*mid,y1+ny*mid); p1=(x2+nx*mid,y2+ny*mid)
        def touch(p):
            x,y=int(p[0]),int(p[1]); b=wall[max(0,y-9):y+10,max(0,x-9):x+10]; return b.size and b.mean()>0.05
        if not(touch(p0) or touch(p1)) or Ln*mm<600: continue
        if any(np.hypot(o[0]-p0[0],o[1]-p0[1])<12 and np.hypot(o[2]-p1[0],o[3]-p1[1])<12 for o in out): continue
        out.append([round(float(p0[0]),1),round(float(p0[1]),1),round(float(p1[0]),1),round(float(p1[1]),1),int(round(max(3,hi-lo)*mm))])
    return out

# ── 모서리 잇기(2026-11-12 대표 지시 「조금씩 문제 있는 것 싹 다 분석」 — 205TEA·157 모서리 네모 구멍): 짧은 벽 조각을 버리며
#   벽 끝이 직각으로 만나는 벽 바로 앞에서 멈춘 곳이 있다 → 끝에서 (상대 벽 두께/2 + 8화소) 안에 직각 벽이 지나가면 그 벽 바깥면까지만 늘린다(지나쳐 혹을 만들지 않음)
def snap_corners(wseg, mm):
    W=[list(w) for w in wseg]
    for w in W:
        ax,a,b,c,t=w
        for e in (0,1):
            p=w[1+e]; best=None
            for u in W:
                if u[0]==ax: continue
                hu=u[4]/mm/2.0; hw=t/mm/2.0
                if not(u[1]-hw-2<=c<=u[2]+hw+2): continue        # 직각 벽이 이 줄을 지나야 한다
                far=u[3]+hu if e==1 else u[3]-hu                  # 넘어설 수 있는 끝 = 상대 벽 바깥면
                near=u[3]-hu if e==1 else u[3]+hu
                gap=(near-p) if e==1 else (p-near)
                if -0.5<gap<=max(8,350.0/mm) and ((far>p) if e==1 else (far<p)):   # 2026-11-12 역설계: 이음 틈은 그리기 프로그램의 화소 고정 값(축척과 무관)
                    if best is None or abs(gap)<abs(best[0]): best=(gap,far)
            if best: w[1+e]=round(float(best[1]),1)
    return W

# ── 문틀 틈 메우기(2026-11-12 하네스 첫 바퀴 — 외벽 닫힘 R1 위반 44·94·101 평형의 공통 원인)
#   원인: 네이버 문·창은 벽과 문짝 사이에 흰 문틀 띠(5~7화소)를 그린다 → 문 자리 선·창 끝이 옆 벽 바깥면보다 그만큼 모자라 실금 같은 틈이 남고,
#         그 틈으로 「바깥」이 집 안까지 이어졌다. → 문·창 끝에서 같은 방향으로 벽(같은 줄 벽 끝 또는 직각 벽 바깥면)이 가까이(350mm·8화소 안) 있으면
#         그 사이를 같은 두께의 벽 조각(문틀 자리)으로 메운다. 문·창 기호는 그대로 둔다.
def fill_jambs(wseg, sash, doors, mm):
    tol=max(8.0,350.0/mm); add=[]
    ops=[]
    for q in sash:
        ax=q[0]; ops.append((ax,q[1],q[3],(q[2]+q[4])/2.0) if ax=='h' else (ax,q[2],q[4],(q[1]+q[3])/2.0))
    for d in doors:
        if abs(d['y1']-d['y2'])<=2: a,b=sorted([d['x1'],d['x2']]); ops.append(('h',a,b,(d['y1']+d['y2'])/2.0))
        elif abs(d['x1']-d['x2'])<=2: a,b=sorted([d['y1'],d['y2']]); ops.append(('v',a,b,(d['x1']+d['x2'])/2.0))
    for ax,a,b,c in ops:
        for e,sgn in ((a,-1),(b,1)):
            best=None
            for w in wseg:
                if w[0]==ax:
                    if abs(w[3]-c)>4: continue
                    stop=w[2] if sgn<0 else w[1]; t=w[4]
                    if (sgn<0 and w[1]>=e) or (sgn>0 and w[2]<=e): continue
                else:
                    hw=w[4]/mm/2.0
                    if not(w[1]-3<=c<=w[2]+3): continue
                    stop=w[3]+hw if sgn<0 else w[3]-hw; t=None
                g=(e-stop) if sgn<0 else (stop-e)
                if 0.5<g<=tol and (best is None or g<best[0]): best=(g,stop,t)
            if best:
                tt=best[2]
                if tt is None:
                    nb=[w for w in wseg if w[0]==ax and abs(w[3]-c)<=4]
                    tt=min((w[4] for w in nb),default=JJ_PART_MM)
                lo,hi=sorted([e,best[1]]); add.append([ax,round(float(lo),1),round(float(hi),1),round(float(c),1),int(tt)])
    return wseg+add

# ── 현관문 되살리기(2026-11-12 대표 지적 「현관은 현관문이 필수 요소인데 창으로 만들어 버렸다」 81평형)
#   원인: 현관문은 밖으로 열려 호가 집 밖에 그려지고, 문틀이 흰 띠(가는 선 두 줄)라 창 찾기가 먼저 창으로 잡았다.
#   규칙: 현관 둘레에 붙어 한쪽이 건물 밖인 「창」(600~1300mm)은 창이 아니라 현관문이다 → 문으로 바꾼다.
#   경첩 = 바깥쪽으로 곧은 문짝 선이 뻗은 끝(호는 휘어 나가므로 곧게 이어지는 선이 적다)
def entry_doors(img, sash, doors, rooms, wseg, mm, H, W):
    ent=[r for r in rooms if r.get('kind')=='현관' and len(r['pts'])>=3]
    if not ent: return sash, doors
    v=cv2.cvtColor(img,cv2.COLOR_BGR2HSV)[...,2]
    out=outside_mask(rooms,wseg,sash,doors,mm,H,W)
    ring=np.zeros((H,W),np.uint8)
    for r in ent: cv2.fillPoly(ring,[np.array(r['pts'],np.int32)],1)
    ring=cv2.dilate(ring,np.ones((int(500/mm)|1,)*2,np.uint8))>0
    keep=[]
    for q in sash:
        ax,x0,y0,x1,y1=q; mx,my=(x0+x1)//2,(y0+y1)//2; L=(x1-x0) if ax=='h' else (y1-y0)
        if not(0<=mx<W and 0<=my<H and ring[my,mx] and 600<=L*mm<=1300): keep.append(q); continue
        o=int((x1-x0 if ax=='v' else y1-y0)/2)+int(400/mm)
        pts=[(mx,my-o),(mx,my+o)] if ax=='h' else [(mx-o,my),(mx+o,my)]
        isout=[not(0<=x<W and 0<=y<H) or bool(out[y,x]) for x,y in pts]
        if isout[0]==isout[1]: keep.append(q); continue
        sg=-1 if isout[0] else 1   # 바깥 쪽 방향
        ends=[(x0,my),(x1,my)] if ax=='h' else [(mx,y0),(mx,y1)]
        def straight(e):
            n=0
            for t in range(4,int(L)):
                X,Y=(e[0],e[1]+sg*t) if ax=='h' else (e[0]+sg*t,e[1])
                if 0<=X<W and 0<=Y<H and v[max(0,Y-1):Y+2,max(0,X-1):X+2].min()<225: n+=1
            return n
        hi=0 if straight(ends[0])>=straight(ends[1]) else 1; hg,ot=ends[hi],ends[1-hi]
        lf=(hg[0],hg[1]+sg*int(L)) if ax=='h' else (hg[0]+sg*int(L),hg[1])
        doors.append({'x1':int(hg[0]),'y1':int(hg[1]),'x2':int(ot[0]),'y2':int(ot[1]),'cx':int(lf[0]),'cy':int(lf[1]),'현관':1})
    return keep, doors

# ── 현관문 호 찾기 2판(2026-11-12 하네스 학습 — 예외함 「현관문 R10」 17평면 공통 원인, 1판은 관문에서 버림)
#   원인: 네이버 현관문은 밖(공용 복도 흰 바탕)으로 열려 호가 집 밖에 있고, 문틀 띠·문짝 선·현관 바둑판 줄이 호와 붙어 한 덩어리가 된다.
#   2판: ① 곧은 선(가로·세로로 10화소 넘게 곧은 것)을 먼저 빼 호만 남기고 ② 호의 네모 모서리를 경첩으로 맞춘 뒤(4분의 1 원 각도 채움 0.6 이상)
#        ③ 닫힌 쪽 = 두 끝 가운데 그 너머로 검은 벽 띠가 이어지는 끝(문틀 옆 벽). 문 자리와 겹치는 「창」(문틀 띠를 창으로 읽은 것)은 지운다.
def front_doors(img, rooms, doors, sash, wall, mm, H, W):
    ent=[r for r in rooms if r.get('kind')=='현관' and len(r['pts'])>=3]; jw=[]
    if not ent: return doors, sash, jw
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); v=hsv[...,2].astype(int); s=hsv[...,1].astype(int)
    thin=((((v<135)&((s<70)|(v<75)))|((v<205)&(s<30)))&~(cv2.dilate(wall.astype(np.uint8),np.ones((3,3),np.uint8))>0)).astype(np.uint8)
    straight=cv2.morphologyEx(thin,cv2.MORPH_OPEN,np.ones((1,10),np.uint8))|cv2.morphologyEx(thin,cv2.MORPH_OPEN,np.ones((10,1),np.uint8))
    arc=thin&~(cv2.dilate(straight,np.ones((3,3),np.uint8))>0)
    def walled(p0,u):
        n=0
        for t in range(4,15):
            X,Y=int(round(p0[0]+u[0]*t)),int(round(p0[1]+u[1]*t))
            if 0<=X<W and 0<=Y<H and (v[max(0,Y-3):Y+4,max(0,X-3):X+4]<100).sum()>=6: n+=1
        return n
    for r in ent:
        P=np.array(r['pts'],np.float32).reshape(-1,1,2); rm=np.zeros((H,W),np.uint8); cv2.fillPoly(rm,[P.astype(np.int32)],1)
        near=cv2.dilate(rm,np.ones((int(500/mm)|1,)*2,np.uint8))>0
        # 2026-11-12 고침(93·105·101·205TEA 현관문 빠짐 R10): ① 현관 둘레에 방문 등 다른 문이 하나라도 있으면 건너뛰었다 → 같은 자리 문만 겹침으로 본다(아래)
        #   ② 찾는 띠가 현관 다각형 밖 40화소뿐이라 벽 두께·문틀 띠 너머 바깥으로 열린 호 끝이 잘려 원 맞추기에서 떨어졌다 → 벽·문틀 몫 25화소를 더 본다
        # 둘레에 이미 현관문(현관 밖으로 여는 문)이 있으면 새로 찾지는 않되, 아래 창 정리는 한다(205TEA)
        # 2026-11-12 고침(156B): 안으로 여는 옆방 문까지 「현관문 있음」으로 보고 건너뛰었다 → 문짝 끝이 현관 밖으로 나가는 문만 센다
        _dp=lambda x,y: cv2.pointPolygonTest(P,(float(x),float(y)),True)
        has=any(near[min(H-1,max(0,int((d['y1']+d['y2'])/2))),min(W-1,max(0,int((d['x1']+d['x2'])/2)))] and _dp(d.get('cx',0),d.get('cy',0))<_dp((d['x1']+d['x2'])/2.0,(d['y1']+d['y2'])/2.0)-8 for d in doors)
        zone=(cv2.dilate(rm,np.ones(((2*NV_DOOR_R+70)|1,)*2,np.uint8))>0)&~(cv2.erode(rm,np.ones((5,5),np.uint8))>0)
        if has: zone=np.zeros_like(zone)   # 둘레 문을 없애고 찾으면 108A·100A 에 엉뚱한 현관문이 들어가 외벽이 샜다(2026-11-12 시도 버림) — 156B 는 다음에
        n,lab,st,_=cv2.connectedComponentsWithStats((arc&zone).astype(np.uint8),connectivity=8); cands=[]
        for j in range(1,n):
            x,y,w_,h_,a_=st[j]
            if not(8<=max(w_,h_)<=50 and a_>=10): continue
            ys,xs=np.where(lab[y:y+h_,x:x+w_]==j); xs=(xs+x).astype(float); ys=(ys+y).astype(float)
            # 원 맞추기(최소 제곱): 네이버 호는 경첩까지 다 그리지 않아(문짝·문틀 선에 붙은 앞쪽이 빠짐) 덩어리 네모 모서리가 경첩이 아니다
            A_=np.stack([xs,ys,np.ones_like(xs)],1); b_=-(xs*xs+ys*ys)
            try: D,E,F=np.linalg.lstsq(A_,b_,rcond=None)[0]
            except Exception: continue
            hx,hy=-D/2,-E/2; R2=hx*hx+hy*hy-F
            if R2<=0: continue
            R=R2**0.5; err=np.abs(np.hypot(xs-hx,ys-hy)-R).mean()
            if not(15<=R<=48 and err<=1.6): continue
            ang=np.degrees(np.arctan2(ys-hy,xs-hx)); span=np.ptp(np.unwrap(np.radians(ang)))*57.3
            if span<35 or span>110: continue   # 4분의 1 원만(세면대·변기처럼 둥근 기구는 빼기)
            m=np.degrees(np.arctan2(np.sin(np.radians(ang)).mean(),np.cos(np.radians(ang)).mean()))
            sx=1 if np.cos(np.radians(m))>=0 else -1; sy=1 if np.sin(np.radians(m))>=0 else -1
            hx,hy=int(round(hx)),int(round(hy))
            if abs(cv2.pointPolygonTest(P,(float(hx),float(hy)),True))>25: continue   # 경첩은 현관 경계(벽·문틀) 위 — 넓힌 띠에서 남의 호를 줍지 않게
            cands.append((span,hx,hy,R,sx,sy))
        # 2026-11-12 고침: 가장 큰 호 하나만 보고 아래 확인에서 떨어지면 포기했다 → 큰 것부터 차례로 확인해 처음 통과한 것을 쓴다(131B·115 현관문을 넓힌 띠 때문에 잃던 것)
        for span,hx,hy,R,sx,sy in sorted(cands,reverse=True):
          if _front_one(P,hx,hy,R,sx,sy,v,W,H,doors): break
        # 현관문 자리의 창은 문 길이만큼만 잘라 낸다(통째로 지우면 긴 창의 나머지가 비어 외벽이 샌다 — 46A)
        for d in [d for d in doors if d.get('현관') or abs(cv2.pointPolygonTest(P,((d['x1']+d['x2'])/2.0,(d['y1']+d['y2'])/2.0),True))<=25]:   # 현관 경계 위 문이면 일반 호 문도(205TEA)
            dx0,dx1=sorted([d['x1'],d['x2']]); dy0,dy1=sorted([d['y1'],d['y2']]); out_=[]
            # 2026-11-12 고침(46A·93·205TEA·203A R10 「현관 창」): 문틀 띠는 문보다 길어 잘라 낸 나머지가 현관 바깥 경계 창으로 남았다
            #   → 현관 바깥 경계에는 창이 없다(R10) — 나머지는 벽(외벽 두께)으로 바꾼다
            for q in sash:
                if not(q[1]<dx1+4 and q[3]>dx0-4 and q[2]<dy1+4 and q[4]>dy0-4): out_.append(q); continue
                if q[0]=='h':
                    c_=(q[2]+q[4])/2.0
                    if dx0-q[1]>=2: jw.append(['h',float(q[1]),float(dx0),c_,JJ_EXT_MM])
                    if q[3]-dx1>=2: jw.append(['h',float(dx1),float(q[3]),c_,JJ_EXT_MM])
                else:
                    c_=(q[1]+q[3])/2.0
                    if dy0-q[2]>=2: jw.append(['v',float(q[2]),float(dy0),c_,JJ_EXT_MM])
                    if q[4]-dy1>=2: jw.append(['v',float(dy1),float(q[4]),c_,JJ_EXT_MM])
            sash=out_
    return doors, sash, jw
def _front_one(P,hx,hy,R,sx,sy,v,W,H,doors):
    if True:
        e1=(int(round(hx+sx*R)),hy); e2=(hx,int(round(hy+sy*R)))
        # 닫힌 쪽 = 현관 경계(벽)를 따라가는 끝 → 현관 다각형까지 거리가 짧다. 문짝 끝은 밖으로 반지름만큼 떨어져 있다
        d1=abs(cv2.pointPolygonTest(P,(float(e1[0]),float(e1[1])),True)); d2=abs(cv2.pointPolygonTest(P,(float(e2[0]),float(e2[1])),True))
        if abs(d1-d2)<R*0.3: return False   # 가릴 수 없으면 넣지 않는다(문 안전)
        shut,leaf=(e1,e2) if d1<d2 else (e2,e1)
        # 원 맞춤 중심은 몇 화소 어긋난다 → 문 자리 선을 벽 띠 한가운데로 옮긴다(문짝 반대쪽 = 현관 쪽으로 0~20화소 안의 검은 띠)
        ux,uy=(np.sign(leaf[0]-hx),np.sign(leaf[1]-hy)); run=[]
        for t in range(-4,21):
            X,Y=int(hx-ux*t),int(hy-uy*t)
            if 0<=X<W and 0<=Y<H and v[Y,X]<100: run.append(t)
        if not run:   # 2026-11-12: 바깥여닫이 현관문 자리는 검은 벽 대신 흰 문틀 띠(테두리 두 줄)만 있다(93·105·101) → 테두리 두 줄 가운데
            ln_=[t for t in range(-4,21) if 0<=int(hx-ux*t)<W and 0<=int(hy-uy*t)<H and v[int(hy-uy*t),int(hx-ux*t)]<170]
            if len(ln_)<2 or not(4<=max([t for t in ln_ if t-min(ln_)<=16])-min(ln_)<=16): return False   # 문틀도 없으면 넣지 않는다(문 안전)
            run=[min(ln_),max([t for t in ln_ if t-min(ln_)<=16])]
        tc=(min(run)+max([t for t in run if t-min(run)<=16]))/2.0; dx,dy=int(round(-ux*tc)),int(round(-uy*tc))
        hx,hy=hx+dx,hy+dy; shut=(shut[0]+dx,shut[1]+dy); leaf=(leaf[0]+dx,leaf[1]+dy)
        mx_,my_=(hx+shut[0])/2.0,(hy+shut[1])/2.0
        # 같은 자리에 일반 호 문이 이미 있으면 벽 띠 가운데로 맞춘 현관문으로 바꿔 넣는다(131B: 9화소 어긋나 현관 경계 문으로 안 잡히던 것)
        doors[:]=[d for d in doors if np.hypot((d['x1']+d['x2'])/2.0-mx_,(d['y1']+d['y2'])/2.0-my_)>=R]
        doors.append({'x1':int(hx),'y1':int(hy),'x2':int(shut[0]),'y2':int(shut[1]),'cx':int(leaf[0]),'cy':int(leaf[1]),'현관':1})
        return True

# ── 창 자리 잇기(2026-11-12 대표 지적 「창문 쪽 외벽 끊김」 111평형, 「발코니 내부창 유실」 81평형)
#   원인: 창은 「가는 선 두 줄 사이가 밝은 띠」만 찾았다 → ① 검은 벽선에 흰 창틀 상자가 붙은 옛 양식(발코니 안쪽 창)은 한쪽 선이 벽으로 분류돼 못 찾고
#         ② 찾은 창도 창틀 두께(4~6화소)로만 남아 벽(250mm) 사이에 가는 선만 보여 외벽이 끊겨 보였다.
#   고침: 같은 줄(가로·세로, 중심선 ±3화소) 벽선 둘 사이 틈마다 — 문 자리가 아니고, 한쪽이 건물 밖이나 발코니이고, 틈을 따라 선(창틀)이 이어지면 창으로 본다.
#         모든 창은 양옆 벽의 중심선·두께에 맞추고 벽 끝에 딱 붙인다 → 외곽선이 끊기지 않는다.
def close_openings(img, wseg, sash, doors, rooms, mm, H, W):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); v=hsv[:,:,2].astype(int); s=hsv[:,:,1].astype(int)
    ln=(v<110)|((v<215)&(s<60))
    out=outside_mask(rooms,wseg,sash,doors,mm,H,W)
    kind=lambda x,y: next((r.get('kind') for r in rooms if len(r['pts'])>=3 and _inpoly(x,y,r['pts'])),None)
    def side(x,y):
        if not(0<=int(x)<W and 0<=int(y)<H) or out[int(y),int(x)]: return '밖'
        return kind(x,y)
    def door_in(ax,c,a,b):
        for d in doors:
            if ax=='h' and abs(d['y1']-d['y2'])<=3 and abs(d['y1']-c)<=10 and min(b,max(d['x1'],d['x2']))-max(a,min(d['x1'],d['x2']))>(b-a)*0.3: return True
            if ax=='v' and abs(d['x1']-d['x2'])<=3 and abs(d['x1']-c)<=10 and min(b,max(d['y1'],d['y2']))-max(a,min(d['y1'],d['y2']))>(b-a)*0.3: return True
        return False
    def sash_span(q): return ('h',q[1],q[3],(q[2]+q[4])/2.0) if q[0]=='h' else ('v',q[2],q[4],(q[1]+q[3])/2.0)
    # 같은 줄 벽선 묶기
    lines=[]
    for w in sorted(wseg,key=lambda w:(w[0],w[3])):
        for L in lines:
            if L['ax']==w[0] and abs(L['c']-w[3])<=3: L['s'].append(w); break
        else: lines.append({'ax':w[0],'c':w[3],'s':[w]})
    # 같은 줄 벽 끝뿐 아니라 이 줄을 가로지르는(또는 끝이 닿는) 직각 벽도 틈의 끝이 된다 — 모서리와 벽 사이의 창(93 외벽 창 등)
    for L in lines:
        hw=min(w[4] for w in L['s'])/mm/2.0
        for u in wseg:
            if u[0]==L['ax']: continue
            hu=u[4]/mm/2.0
            if u[1]-hw-3<=L['c']<=u[2]+hw+3: L['s'].append([L['ax'],u[3]-hu,u[3]+hu,L['c'],L['s'][0][4],'직각'])
    used=[False]*len(sash); res=[]
    for L in lines:
        ss=sorted(L['s'],key=lambda w:w[1])
        pairs=[]; cur=None   # 앞에서부터 덮인 끝을 이어 가며 틈만 뽑는다(겹친 조각 사이 가짜 틈 방지)
        for w in ss:
            if cur is not None and w[1]>cur[2]: pairs.append((cur,w))
            if cur is None or w[2]>cur[2]: cur=w
        for w1,w2 in pairs:
            a,b=w1[2],w2[1]
            # 직각 벽 둘 사이(이 줄에 벽이 하나도 없는 곳)는 보지 않는다
            # 2026-11-12 고침(131B 주방 외벽 창): 직각 벽 조각 끝이 같은 줄 진짜 벽 끝보다 0.05화소 길어 「직각 둘 사이」로 오판 → 진짜 벽 끝이 틈 끝에 닿아 있으면 본다
            #   (진짜 벽이 그 직각 조각 안으로 들어와 끝나야 — 162 피트 X 상자처럼 근처 아무 벽 끝으로는 안 됨)
            p1=len(w1)>5 and not any(len(r)==5 and r[1]<w1[1] and r[2]>=w1[1]-1 for r in ss)
            p2=len(w2)>5 and not any(len(r)==5 and r[2]>w2[2] and r[1]<=w2[2]+1 for r in ss)
            if b-a<3 or (p1 and p2): continue
            if len(w1)>5 and len(w2)>5:   # 새로 보게 된 틈: 12화소 안 나란한 다른 벽이 틈 절반 넘게 덮으면 구멍이 아니다(162 피트 상자)
                cv=sum(max(0.0,min(b,u[2])-max(a,u[1])) for u in wseg if u[0]==L['ax'] and 0<abs(u[3]-L['c'])<=12)
                if cv>(b-a)*0.5: continue
            ax=L['ax']; c=L['c']; t=min(w1[4],w2[4]); h=t/mm/2.0
            hit=[i for i,q in enumerate(sash) if sash_span(q)[0]==ax and abs(sash_span(q)[3]-c)<=12 and min(b,sash_span(q)[2])-max(a,sash_span(q)[1])>0]
            if not hit:
                if (b-a)*mm<300 or (b-a)*mm>16000 or door_in(ax,c,a,b): continue
                m=(a+b)/2.0; o=h+600.0/mm
                A,B=(side(m,c-o),side(m,c+o)) if ax=='h' else (side(c-o,m),side(c+o,m))
                if not({A,B}&{'밖','발코니'}) or A==B: continue
                band=ln[int(c-h)-2:int(c+h)+3,int(a)+1:int(b)] if ax=='h' else ln[int(a)+1:int(b),int(c-h)-2:int(c+h)+3].T
                if band.size==0 or band.any(0).mean()<0.75: continue
            if not hit: res.append([ax,a,b,c,h]); continue
            tol=450.0/mm   # 찾은 창 끝이 벽 끝에서 이만큼 안이면 벽 끝까지 붙인다(그보다 멀면 창은 제자리 — 틈 전체를 창으로 늘리지 않는다)
            for i in hit:
                used[i]=True; _,qa,qb,_c=sash_span(sash[i])
                lo=a if qa-a<=tol else max(a,qa); hi=b if b-qb<=tol else min(b,qb)
                if hi-lo>2: res.append([ax,lo,hi,c,h])
    for i,q in enumerate(sash):   # 같은 줄 벽 사이가 아닌 창은 가까운 벽 두께로만 맞춘다
        if used[i]: continue
        ax,a,b,c=sash_span(q); n=None
        for w in wseg:
            if w[0]==ax and abs(w[3]-c)<=12 and min(b,w[2])-max(a,w[1])>-12 and (n is None or abs(w[3]-c)<abs(n[3]-c)): n=w
        res.append([ax,a,b,n[3] if n else c,(n[4] if n else 200)/mm/2.0])
    # 2026-11-12 대표 지적 「창이 없는데 창을 만들고(화장실)」「외벽은 내력벽인데 발코니를 다 창으로」(81평형):
    #   원인 — 욕조 윗선·발코니 타일 줄눈처럼 벽 띠 옆의 나란한 가는 선 두 줄을 창틀로 읽었다. 네이버 창은 검은 벽이 끊긴 자리에만 있다
    #   → 같은 줄(중심선 ±벽 두께 반)에 원본 굵은 벽선이 창 길이의 30% 넘게 겹치면 창이 아니다(벽이 우선)
    def on_wall(ax,a,b,c,h):
        L=max(1.0,b-a); cov=0.0
        for w in wseg:
            if w[0]!=ax or abs(w[3]-c)>w[4]/mm/2.0+h+6: continue   # 같은 줄 또는 바로 옆에 나란히 붙은 벽(발코니 바깥 내력벽 옆 타일 줄눈)
            cov+=max(0.0,min(b,w[2])-max(a,w[1]))
        return cov/L>0.3
    res=[r for r in res if not on_wall(r[0],r[1],r[2],r[3],r[4])]
    outq=[]
    for ax,a,b,c,h in res:
        if ax=='h': outq.append(['h',int(round(a)),int(round(c-h)),int(round(b)),int(round(c+h))])
        else: outq.append(['v',int(round(c-h)),int(round(a)),int(round(c+h)),int(round(b))])
    return outq

# 욕실 안 기구 지우기(2026-11-12 원인 확인 — 101평형 욕실 윗벽·피트 벽이 사라짐): 방 다각형(누리집 방 읽기)이 벽을 넘어 그려진 평면이 있어
#   「욕실 칸 안쪽 화소를 통째로 지우기」가 벽까지 지웠다 → 덩어리 단위로, 거의 전부(80%) 욕실 안에 있는 덩어리(기구 그림)만 지운다
def drop_inside(mask, m):
    n,lab,st,_=cv2.connectedComponentsWithStats(mask.astype(np.uint8),connectivity=8)
    if n<=1: return mask
    tot=np.bincount(lab.ravel(),minlength=n); ins=np.bincount(lab[m].ravel(),minlength=n)
    keep=ins<tot*0.8; keep[0]=False
    return keep[lab]

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
        ink=drop_inside(ink,m)
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
        if max(w_,h_)*mm<1200 and a_<w_*h_*0.55:   # 굵은 글자
            # 2026-11-12 하네스 학습(예외함 「놓친 벽 R6」 23평면): 창에 끊겨 외따로 떨어진 짧은 벽 토막(ㄱ·ㄷ자 피트 벽 등)도 채움이 낮아 글자로 지워졌다
            #   → 덩어리 안에 가로·세로로 400mm(최소 12화소) 넘게 곧게 이어진 검은 줄이 있으면 벽이다(글자 획은 짧다)
            sub=(lw[sw[j,1]:sw[j,1]+h_,sw[j,0]:sw[j,0]+w_]==j).astype(np.uint8); _L=max(12,int(400/mm))
            if not((w_>=_L and cv2.morphologyEx(sub,cv2.MORPH_OPEN,np.ones((1,_L),np.uint8)).any()) or (h_>=_L and cv2.morphologyEx(sub,cv2.MORPH_OPEN,np.ones((_L,1),np.uint8)).any())): kw[j]=False
        # 기구 그림 속 작은 검은 점. 2026-11-12 고침(111DT·120OT-5 외벽 샘): 창 사이·창과 문틀 사이 짧은 벽 토막(약 17화소)이 400mm 미만으로 지워졌다
        #   → 벽 두께(4~9화소)의 꽉 찬 직사각형이고 12화소 넘게 길면 벽 토막이다(네이버 벽 두께는 화소 고정)
        if max(w_,h_)*mm<400 and not(4<=min(w_,h_)<=9 and max(w_,h_)>=12 and a_>=w_*h_*0.85): kw[j]=False
    wall=kw[lw]
    # 욕실 안 지저분한 것 정리(대표 지적 2026-11-12): 욕실 칸 안쪽(벽에서 조금 떨어진 곳)의 검은 덩어리는 기구 그림이다 — 지운다
    for r in rooms:
        if r.get('kind')!='욕실': continue
        m=np.zeros((H,W),np.uint8); cv2.fillPoly(m,[np.array(r['pts'],np.int32)],1); m=cv2.erode(m,np.ones((7,7),np.uint8))>0
        wall=drop_inside(wall,m)
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
    # 2026-11-12: 7×7 깎기는 작은 문(끝이 좁은 호)의 문짝 끝을 깎아 모서리 시험을 망쳤다 → 가는 선 둘레 1화소를 떼어 흰 칸끼리 가른 뒤 3×3 만 깎는다
    edge_=cv2.dilate(((v<215)&(s<70)).astype(np.uint8),np.ones((3,3),np.uint8))>0
    wh=cv2.morphologyEx((wh>0)&~edge_ ,cv2.MORPH_OPEN,np.ones((3,3),np.uint8)) if False else cv2.morphologyEx(((wh>0)&~edge_).astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    nd,ld,sd,_=cv2.connectedComponentsWithStats(wh,connectivity=4)
    darkish=(v<120)
    for j in range(1,nd):
        x,y,w_,h_,a_=sd[j]; Wm,Hm=w_*mm,h_*mm
        # 2026-11-12 원인 확인: 네이버 문은 축척과 상관없이 화소 고정 크기(반지름 23~30화소, naver_rules.md)라 mm 기준(520~1250)으로는
        #   잘게 그린 평면(1화소 15~18mm)의 문을 전부 버렸다(93·101 평형 0개). 화소로 보고, mm 는 넉넉한 안전 범위로만 쓴다
        if not(16<=w_<=46 and 16<=h_<=46 and 330<=Wm<=1350 and 330<=Hm<=1350 and abs(w_-h_)<=0.34*max(w_,h_)): continue
        fr=a_/(w_*h_)
        if not(0.6<=fr<=0.9): continue
        reg=(ld[y:y+h_,x:x+w_]==j); q=max(2,int(min(w_,h_)*0.18))
        cor=[reg[:q,:q].mean(),reg[:q,-q:].mean(),reg[-q:,-q:].mean(),reg[-q:,:q].mean()]   # 왼위 오른위 오른아래 왼아래
        fc=int(np.argmin(cor)); hc=(fc+2)%4   # 가장 빈 모서리(호 바깥) 맞은편이 경첩
        # 문 모양: 경첩 모서리는 꽉 차고, 붙은 두 모서리 중 하나(벽 쪽)는 차고 다른 하나(문짝 끝, 호가 닿는 곳)는 반쯤 찬다 — 2026-11-12 반쯤 찬 쪽을 버리던 것 고침
        #   경첩 모서리도 문짝 선이 파고들어 반쯤만 찰 때가 있다(157 평형 침실) → 빈 모서리 하나 + 나머지 셋 평균 0.7·최소 0.35
        three=[cor[k] for k in range(4) if k!=fc]
        if cor[fc]>0.3 or sum(three)/3<0.7 or min(three)<0.25: continue
        C=[(x,y),(x+w_,y),(x+w_,y+h_),(x,y+h_)]
        n1,n2=(hc+1)%4,(hc+3)%4      # 경첩에 붙은 두 모서리
        def outside_white(k):        # 경첩→k 변의 바깥쪽(원 반대편) 3~8화소가 흰 틈인가
            (hx,hy),(kx,ky)=C[hc],C[k]; mx,my=(hx+kx)/2,(hy+ky)/2; fx,fy=C[fc]; dx,dy=(mx-((hx+kx+fx*0)/2)),0
            if hy==ky: sgn=-1 if fy>hy else 1; ys_=[int(hy+sgn*t) for t in range(3,9)]; xs_=[int(mx)]*6
            else: sgn=-1 if fx>hx else 1; xs_=[int(hx+sgn*t) for t in range(3,9)]; ys_=[int(my)]*6
            vals=[(0<=yy<H and 0<=xx<W and v[yy,xx]>=225) for xx,yy in zip(xs_,ys_)]
            return sum(vals)
        # 2026-11-12 규칙 점검 R5 로 찾은 원인(107·89·100A): 바닥이 밝은 발코니(타일)에선 두 변 바깥이 다 희어 문 방향(벽 쪽 변)을 반대로 읽었다
        #   → 먼저 「벽이 이어지는 쪽」을 본다: 벽 쪽 변은 경첩 뒤와 반대편 끝 너머로 검은 벽이 이어진다(문틀 양옆 벽)
        def wall_line(k):
            (hx,hy),(kx,ky)=C[hc],C[k]; L=max(1.0,np.hypot(kx-hx,ky-hy)); ux,uy=(kx-hx)/L,(ky-hy)/L; n=0
            for t in range(4,15):
                for px,py in ((kx+ux*t,ky+uy*t),):   # 반대편 끝 너머만 본다(경첩 뒤는 두 변 모두 벽 속이라 가릴 수 없다)
                    X,Y=int(round(px)),int(round(py))
                    if 0<=X<W and 0<=Y<H and (v[max(0,Y-3):Y+4,max(0,X-3):X+4]<100).sum()>=6: n+=1   # 문틀 옆 벽 띠(가는 선 하나는 안 셈)
            return n
        w1_,w2_=wall_line(n1),wall_line(n2)
        if abs(w1_-w2_)>=3: ac,bc=(n1,n2) if w1_>w2_ else (n2,n1)
        else:
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
    # 2026-11-12 대표 지적 「현관문은 필수 요소인데 창으로 만들어 버렸다」(81평형): 현관문은 밖으로 열려 호가 건물 네모 밖에 그려진다
    #   → 문 찾기 범위만 문 반지름(1.3m)만큼 넓힌다(벽·창 찾기 범위는 그대로)
    _e=NV_DOOR_R+12; bldd=np.zeros((H,W),bool); bldd[max(0,by-6-_e):by+bh0+7+_e, max(0,bx-6-_e):bx+bw0+7+_e]=True
    raw=(((v<135)&((s<70)|(v<75)))|((v<205)&(s<30)))&bldd
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
        if not(520<=w_*mm<=1400 and 520<=h_*mm<=1400 and 0.6<=w_/h_<=1.67): continue   # 2026-11-12 81평형 현관문: 문틀 띠가 붙어 가로세로 비가 1.33 을 넘었다
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
    # 바깥벽 창 자리(2026-11-12 대표 지적 「이상하지 않니」— 바깥선이 창마다 끊겨 보였다): 바깥과 맞닿은 벽 줄의 틈은 길어도(거실 큰 창) 메워 외곽선을 잇는다
    K6=max(9,int(6000/mm)); body0=cv2.morphologyEx(w2.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((max(5,int(1300/mm)),)*2,np.uint8))
    ff0=(1-body0).astype(np.uint8); mk0=np.zeros((H+2,W+2),np.uint8); cv2.floodFill(ff0,mk0,(0,0),2); out0=cv2.dilate((ff0==2).astype(np.uint8),np.ones((5,5),np.uint8))>0
    for ker in (np.ones((1,K6),np.uint8),np.ones((K6,1),np.uint8)):
        g=(cv2.morphologyEx(w2.astype(np.uint8),cv2.MORPH_CLOSE,ker)>0)&~w2
        ng,lg,sg,_=cv2.connectedComponentsWithStats(g.astype(np.uint8),connectivity=4)
        for j in range(1,ng):
            x,y,w_,h_,a_=sg[j]
            if min(w_,h_)*mm>450: continue
            if out0[y:y+h_,x:x+w_][lg[y:y+h_,x:x+w_]==j].mean()<=0.3: continue
            # 창 확인: 원본 창은 벽 줄 안에 길이 방향 가는 회색 선(창틀)이 그어져 있다 — 바깥 빈 곳(꺾인 자리)을 잇는 틈은 거른다
            gl=((v<215)&(v>=100)&(s<45))[max(0,y-2):y+h_+2,max(0,x-2):x+w_+2]
            prof=gl.mean(1) if ker.shape[0]==1 else gl.mean(0)
            if prof.size and prof.max()>=0.6: w2|=(lg==j)
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
    _ = clean_walls(wall, mm); wseg=[[a_, round(float(p0),1), round(float(p1),1), round(float(c_),1), int(t_)] for a_,p0,p1,c_,t_ in clean_walls.segs]   # 캐드용 벽선(문·창 자리는 비움)
    wseg=snap_corners(wseg,mm)
    _w = clean_walls(w2, mm)
    wins=window_strips(bgr,mm,doors,rooms)
    sash_out=[[t,int(a_),int(round(c0)),int(b_),int(round(c1))] if t=='h' else [t,int(round(c0)),int(a_),int(round(c1)),int(b_)] for t,a_,b_,c0,c1 in wins]
    sash_out=[q for q in sash_out if not inK(q[1],q[2],q[3],q[4])]
    doors=safe_doors(doors,rooms,wseg,sash_out,mm,H,W)   # 건물 밖으로 난 문(창을 문으로 잘못 읽은 것 포함)은 그리지 않는다 — 안전   # 주방 샷시는 그리지 않는다(대표 지시 2026-11-12 「주방 … 샷시 모두 삭제」)
    sash_out=close_openings(bgr,wseg,sash_out,doors,rooms,mm,H,W)
    sash_out,doors=entry_doors(bgr,sash_out,doors,rooms,wseg,mm,H,W)
    doors,sash_out,_jw=front_doors(bgr,rooms,doors,sash_out,wall,mm,H,W); wseg=wseg+_jw   # 밖으로 여는 현관문(호가 집 밖) — 하네스 학습 2판 2026-11-12   # 현관 둘레 「창」 = 현관문(2026-11-12)   # 창을 벽 사이에 딱 맞추고, 못 찾은 창(발코니 안쪽 창 등)을 틈에서 찾는다
    wseg=fill_jambs(wseg,sash_out,doors,mm)   # 문틀 띠 자리 틈 메우기(하네스 첫 바퀴 R1)
    _wall_d=wall_path_from_segs(wseg,sash_out,doors,mm)
    try: _diag=diag_walls(wall,wseg,mm,bld)
    except Exception: _diag=[]
    try: _dwin=diag_windows(bgr,mm)
    except Exception: _dwin=[]
    G_={'벽선':wseg,'샷시':sash_out,'문':doors,'틀':[int(bx),int(by),int(bx+bw0),int(by+bh0)]}
    try:   # 변환할 때마다 규칙 점검(tools/plan_check.py RULES) — 어긴 곳을 자료에 남긴다
        import plan_check; _chk=plan_check.rules(bgr,dict(plan,그림=G_,H=H,W=W))
    except Exception as e: _chk=[['오류',str(e)[:60],0,0]]
    return {'점검':_chk,'벽선':wseg,'샷시':sash_out,'문':doors,'공용칸':publab,'EV':ev,'틀':[int(bx),int(by),int(bx+bw0),int(by+bh0)],'공용':pubd,'벽':_wall_d,'벽채움':'nonzero','사선벽':_diag,'사선창':_dwin,'칸':cells,'창선':win,'기구':objs}
