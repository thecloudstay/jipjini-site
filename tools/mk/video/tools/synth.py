# 집지니 쇼츠 소리 합성 (2026-11-28 v6) — 종소리 같은 사인 아르페지오 제거, 효과음은 장면 뜻마다 다른 소리
import numpy as np, wave, os
SR=48000; OUT=os.path.join(os.path.dirname(__file__),'..','public','sfx')
rng=np.random.default_rng(7)
def save(n,x):
    x=np.clip(x/ (np.abs(x).max()+1e-9)*0.89,-1,1)
    with wave.open(os.path.join(OUT,n+'.wav'),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype(np.int16).tobytes())
def t(d): return np.arange(int(SR*d))/SR
def env(d,a=0.005,r=None):
    n=int(SR*d);e=np.ones(n);ka=max(1,int(SR*a));e[:ka]=np.linspace(0,1,ka)
    if r: e*=np.exp(-np.arange(n)/SR/r)
    return e
def lp(x,c):  # one-pole lowpass, c may be array
    y=np.zeros_like(x);a=np.broadcast_to(np.exp(-2*np.pi*np.asarray(c,dtype=float)/SR),x.shape);s=0.
    for i in range(len(x)): s=(1-a[i])*x[i]+a[i]*s;y[i]=s
    return y
def saw(f,d): ph=np.cumsum(np.broadcast_to(f,(int(SR*d),))/SR);return 2*(ph%1)-1
def sq(f,d): return np.sign(np.sin(2*np.pi*np.cumsum(np.broadcast_to(f,(int(SR*d),))/SR)))
def noise(d): return rng.standard_normal(int(SR*d))

# ── 배경음: 120BPM 16초. 킥·클랩·하이햇·808 베이스·오프비트 코드 찍기(톱니+저역통과, 종소리 없음)
L=16.0;N=int(SR*L);M=np.zeros(N);B=0.5
def put(x,at,v=1):
    i=int(at*SR);j=min(N,i+len(x));M[i:j]+=x[:j-i]*v
kick=np.sin(2*np.pi*np.cumsum(np.linspace(150,45,int(SR*.25)))/SR)*env(.25,.001,.08)
clap=lp(noise(.18),3500)*env(.18,.001,.045)
hat=(noise(.05)-lp(noise(.05),6000))*env(.05,.001,.012)
roots=[55,43.65,65.4,49]  # A1 F1 C2 G1
chords=[[220,261.6,329.6],[174.6,220,261.6],[261.6,329.6,392],[196,246.9,293.7]]
HITS=[2,6,8,10,10.5,12]
for bar in range(8):
    ch=bar%4;b0=bar*4*B
    for k in range(4):
        at=b0+k*B
        put(kick,at,0.9)
        if k in(1,3): put(clap,at,0.45)
        put(hat,at+B/2,0.25);put(hat,at+B/4,0.1);put(hat,at+3*B/4,0.1)
        # 808 베이스
        f=roots[ch];bs=np.sin(2*np.pi*f*t(.42))*env(.42,.004,.25);put(np.tanh(bs*2.2),at,0.5)
        # 오프비트 코드 찍기
        st=sum(saw(fr*(1+0.004*i),.16) for i,fr in enumerate(chords[ch]))
        st=lp(st,np.linspace(2600,700,len(st)))*env(.16,.003,.06);put(st,at+B/2,0.22)
# 강조 직전 비우기·강조 때 덕킹
g=np.ones(N)
for h in HITS:
    i0=int((h-.14)*SR);i1=int(h*SR);g[i0:i1]=0.05
    k=int(.6*SR);g[i1:i1+k]=np.minimum(g[i1:i1+k],np.linspace(0.56,1,k))
M*=g;M[-int(SR*.5):]*=np.linspace(1,0,int(SR*.5));save('music',M)

# ── 효과음
def whoosh(d,f0,f1):
    x=noise(d);c=np.geomspace(f0,f1,len(x));y=lp(x,c)-lp(x,c*0.35)
    return y*np.sin(np.linspace(0,np.pi,len(x)))**1.5
save('whoosh_a',whoosh(.28,400,5000));save('whoosh_b',whoosh(.4,6000,600));save('whoosh_c',whoosh(.2,900,9000))
# 레코드 긁힘(「끼익」): 톱니 소리 높낮이 앞뒤로 흔들기 + 잡음
d=.5;tt=t(d);f=900+700*np.sin(2*np.pi*7*tt)*np.exp(-tt*2);s=lp(saw(f,d),3000)+0.4*lp(noise(d),2500)
save('scratch',s*env(d,.002,.25))
# 저음 쿵(808 떨어짐)
d=1.1;f=np.geomspace(120,32,int(SR*d));save('drop808',np.tanh(2.5*np.sin(2*np.pi*np.cumsum(f)/SR))*env(d,.002,.5))
# 에어혼(밈 「빠바밤」) 3번
def horn(d): f=np.array([370,466,554]);x=sum(lp(saw(np.full(int(SR*d),fr)*(1+0.01*np.sin(2*np.pi*6*t(d))),d),2200) for fr in f);return x*env(d,.01)*np.linspace(1,.7,int(SR*d))
h=np.concatenate([horn(.12),np.zeros(int(SR*.04)),horn(.12),np.zeros(int(SR*.04)),horn(.5)*np.linspace(1,0,int(SR*.5))]);save('airhorn',h)
# 만화 「띠용」
d=.6;tt=t(d);f=260+180*np.sin(2*np.pi*11*tt)*np.exp(-tt*4)+np.linspace(0,140,len(tt));save('boing',np.sin(2*np.pi*np.cumsum(f)/SR)*env(d,.003,.25))
# 자동차 경적 「빵빵」
def bp(d): return lp(sq(np.full(int(SR*d),415),d)+sq(np.full(int(SR*d),523),d),1800)*env(d,.005)
save('carhorn',np.concatenate([bp(.11),np.zeros(int(SR*.06)),bp(.22)*np.linspace(1,.3,int(SR*.22))]))
# 테이프 멈춤(내려가는 소리)
d=.45;f=np.geomspace(500,40,int(SR*d));save('tapestop',lp(saw(f,d),1500)*np.linspace(1,0,int(SR*d)))
# 물음표 「뿅?」 올라가는 소리
d=.22;f=np.geomspace(500,1300,int(SR*d));save('qup',np.sin(2*np.pi*np.cumsum(f)/SR)*env(d,.003,.12))
print('ok')
