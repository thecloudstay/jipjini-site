# 문 찾기(틀 맞추기): 원본 문 = 흰 4분의1 원. 반지름·방향별 틀로 흰 바탕 지도를 훑어, 원 안은 희고 원 바깥 귀퉁이는 희지 않은 자리를 찾는다
import cv2, numpy as np
def quarter(R, o):
    T=np.zeros((R,R),np.float32); yy,xx=np.mgrid[0:R,0:R]+0.5
    # o: 경첩 귀퉁이 0=왼위 1=오른위 2=오른아래 3=왼아래
    hx=0 if o in (0,3) else R; hy=0 if o in (0,1) else R
    d=np.hypot(xx-hx,yy-hy); inside=d<=R-1.5; outside=d>=R+0.5
    return inside, outside
def find_doors(white, dark, mm, rmin=330, rmax=1150):
    H,W=white.shape; Wf=white.astype(np.float32); out=[]
    for R in range(max(10,int(rmin/mm)), int(rmax/mm)+1, 2):
        for o in range(4):
            ins,outs=quarter(R,o); n1=ins.sum(); n2=max(1,outs.sum())
            t=ins.astype(np.float32)/n1 - outs.astype(np.float32)/n2
            mi=cv2.filter2D(Wf,-1,ins.astype(np.float32)/n1,anchor=(0,0),borderType=cv2.BORDER_CONSTANT)
            mo=cv2.filter2D(Wf,-1,outs.astype(np.float32)/n2,anchor=(0,0),borderType=cv2.BORDER_CONSTANT)
            ys,xs=np.where((mi>0.88)&(mo<0.3))
            for y,x in zip(ys,xs):
                if y+R>H or x+R>W: continue
                out.append((round(float(mi[y,x]-mo[y,x]),1),R,int(x),int(y),o))
    out.sort(reverse=True); keep=[]   # 점수(0.1 단위)가 같으면 큰 반지름 먼저 — 원을 꽉 채우는 크기
    for s,R,x,y,o in out:
        if any(x<k[1]+k[3] and x+R>k[1] and y<k[2]+k[3] and y+R>k[2] for k in keep): continue
        keep.append((s,x,y,R,o))
    doors=[]
    for s,x,y,R,o in keep:
        C=[(x,y),(x+R-1,y),(x+R-1,y+R-1),(x,y+R-1)]; hc=o; a1,a2=(hc+1)%4,(hc+3)%4
        cxm,cym=x+R/2.0,y+R/2.0
        def wall_beyond(k):     # 경첩→k 변을 넘어선 곳(원 바깥쪽으로 0~10화소 비켜서)에 벽이 이어지는가 = 그 변이 벽 쪽(문 열린 자리)
            (px,py),(qx,qy)=C[hc],C[k]; dx=np.sign(qx-px); dy=np.sign(qy-py); hit=0
            nx,ny=(0,np.sign(qy-cym) or 1) if dy==0 else (np.sign(qx-cxm) or 1,0)
            for st in range(2,13):
                for off in range(0,11,2):
                    X=int(qx+dx*st+nx*off); Y=int(qy+dy*st+ny*off)
                    if 0<=X<W and 0<=Y<H and dark[Y,X]: hit+=1; break
            return hit
        def wall_near_hinge():
            (px,py)=C[hc]; y0,y1,x0,x1=max(0,py-10),py+11,max(0,px-10),px+11
            return dark[y0:y1,x0:x1].any()
        if not wall_near_hinge(): continue
        b1,b2=wall_beyond(a1),wall_beyond(a2)
        if max(b1,b2)==0: continue
        op,leaf=(a1,a2) if b1>=b2 else (a2,a1)
        # 문 열린 자리 확인: 여는 변 바로 바깥(벽 줄)은 비어 있고(벽 틈), 경첩 반대쪽 너머에도 벽이 이어진다 — 계단·욕조·창 띠 같은 흰 덩어리를 거른다
        (px,py),(qx,qy)=C[hc],C[op]; dx=np.sign(qx-px); dy=np.sign(qy-py)
        nx,ny=(0,np.sign(qy-cym) or 1) if dy==0 else (np.sign(qx-cxm) or 1,0)
        busy=0; tot=0
        for f_ in np.linspace(0.2,0.8,7):
            X0=px+(qx-px)*f_; Y0=py+(qy-py)*f_; tot+=1
            if any(0<=int(X0+nx*o_)<W and 0<=int(Y0+ny*o_)<H and dark[int(Y0+ny*o_),int(X0+nx*o_)] for o_ in range(2,9)): busy+=1
        if busy>tot*0.6: continue
        back=0
        for st in range(2,13):
            for off in range(0,11,2):
                X=int(px-dx*st+nx*off); Y=int(py-dy*st+ny*off)
                if 0<=X<W and 0<=Y<H and dark[Y,X]: back+=1; break
        if back==0 and busy>tot*0.15: continue
        doors.append({'x1':C[hc][0],'y1':C[hc][1],'x2':C[op][0],'y2':C[op][1],'cx':C[leaf][0],'cy':C[leaf][1],'틀':1})
    return doors
