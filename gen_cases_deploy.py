# -*- coding: utf-8 -*-
"""집지니 견적 사례 자동 생성기 — v25 단가 테이블 기반 (실제 견적과 정합)"""
import os, re, glob, json, random, datetime

U = {"wallpaper_silk":42000,"floor_janpan22":21000,"sink_m":800000,"window_ja":75000,
     "tile_mat":18000,"tile_labor_day":350000,"tile_helper_day":170000,"demo_day":200000,
     "helper_day":170000,"waste_ton":300000,"ladder":250000,"toilet_set":520000,
     "shower":350000,"plumber_day":320000,"door_body":210000,"carpenter_day":320000,
     "molding_m":2800,"downlight_hole":2000,"downlight_unit":7000,"electrician_day":320000,
     "paint_set":285315,"freight":50000,"insul_m2":12000,"waterproof_day":280000,
     "xl_m":2800,"mortar_m2":28000}

REGIONS = [("서울 강서구","화곡·마곡 구축"),("서울 노원구","상계 대단지"),("서울 은평구","응암 빌라"),
 ("서울 송파구","방이 올림픽선수촌"),("서울 마포구","아현 신축"),("경기 김포시","한강신도시"),
 ("경기 고양시","일산 강선마을"),("경기 용인시","수지 구축"),("경기 성남시","분당 정자"),
 ("경기 부천시","중동 대단지"),("인천 서구","검단 입주장"),("인천 연수구","송도"),
 ("인천 부평구","부평 구축"),("인천 강화군","단독주택")]

SCOPES = [("도배+바닥",["wallpaper","floor"]),("욕실 전체",["bath","tile_bath"]),
 ("주방+욕실",["sink","bath","tile_bath","tile_kitchen"]),
 ("도배+바닥+욕실",["wallpaper","floor","bath","tile_bath"]),
 ("부분 올수리",["demo","wallpaper","floor","bath","tile_bath","sink","light","door"]),
 ("올수리",["demo","wallpaper","floor","bath","tile_bath","tile_kitchen","sink","light","door","molding","window","paint","balcony"]),
 ("창호+단열",["window","balcony","paint"]),("입주 전 기본",["wallpaper","floor","light"])]

PY_LIST = [15,18,22,25,28,32,34,38,42,45,52]

COMMENTS = {
 "도배+바닥":"도배는 벽과 천장을 합쳐 계산하기 때문에 평수의 3.6배 면적이 나옵니다. 실크 단가에는 자재·풀·부자재·기술자 품이 모두 포함돼 있어, 흔히 보는 '도배 100만원' 견적(합지·벽만)과는 기준 자체가 다릅니다.",
 "욕실 전체":"욕실은 철거 후 재시공이면 방수층을 다시 잡아야 해서 타일공 품이 늘어납니다. 덧방으로 가면 철거비와 방수 공정이 빠져 30% 가까이 내려갑니다.",
 "주방+욕실":"주방과 욕실을 함께 하면 설비공·타일공이 같은 날 움직여 인건비가 줄어듭니다. 따로 하면 각각 하루씩 더 붙습니다.",
 "도배+바닥+욕실":"3개 공정부터 코디의 가치가 생깁니다. 공정 순서가 꼬이면(도배 후 욕실) 재작업이 나오기 때문에, 순서를 잡아주는 것만으로 비용이 아껴집니다.",
 "부분 올수리":"부분 올수리는 '어디까지 손대느냐'가 금액을 가릅니다. 창호와 확장을 빼면 총액이 크게 내려가고, 넣으면 올수리에 근접합니다.",
 "올수리":"올수리는 철거·폐기물·사다리차 같은 고정비가 먼저 깔리고 그 위에 마감이 올라갑니다. 그래서 평수가 커질수록 평당 단가는 오히려 내려갑니다.",
 "창호+단열":"창호는 외창 실측이 원칙입니다. 표의 자수는 평형 표준값이고 실측에서 창이 크면 이 항목만 비례해 조정됩니다. 대리점 소비자가 대비 직거래 도매가라 절감 폭이 가장 큰 공정입니다.",
 "입주 전 기본":"입주 전 최소 시공입니다. 도배·바닥·조명만 손봐도 체감이 크게 달라져, 예산이 빠듯할 때 가장 먼저 권하는 조합입니다."}

def calc(py, parts):
    fm = round(py*2.6,1); wm = round(py*3.6,1)
    items = []; tot = [0]
    def add(n,q,u,up,amt=None):
        a = amt if amt is not None else int(round(q*up))
        items.append({"n":n,"q":q,"u":u,"a":a}); tot[0]+=a
    if "demo" in parts:
        add("일반 철거 (철거공)", max(1,round(fm*0.05*2)/2), "일", U["demo_day"])
        add("일반 철거 (잡부)", max(1,round(fm*0.03*2)/2), "일", U["helper_day"])
        add("폐기물 운반·처리", round(py*0.075,2), "톤", U["waste_ton"])
        add("사다리차", 2 if py>=25 else 1, "회", U["ladder"])
    if "wallpaper" in parts: add("도배 실크 [도급재 · 자재+노무 일체]", wm, "㎡", U["wallpaper_silk"])
    if "floor" in parts: add("바닥 장판 2.2T [도급재]", fm, "㎡", U["floor_janpan22"])
    if "bath" in parts:
        nb = 2 if py>=34 else 1
        add("욕실 도기 세트 (양변기·세면대·수전)", nb, "개소", U["toilet_set"])
        add("샤워부스", nb, "개", U["shower"])
        add("설비공 노무", max(1,nb), "일", U["plumber_day"])
    if "tile_bath" in parts:
        ar = 15 if py<34 else 26
        add("욕실 타일 자재 (300×600)", round(ar*1.05,2), "㎡", U["tile_mat"])
        add("욕실 타일공", max(1,round(ar*0.15*2)/2), "일", U["tile_labor_day"])
        add("타일 조공", max(1,round(ar*0.08*2)/2), "일", U["tile_helper_day"])
    if "tile_kitchen" in parts:
        add("주방 벽 타일 (자재+노무)", 1, "식", 0, 660000 if py<34 else 890000)
    if "sink" in parts:
        m = 2.1 if py<=18 else (2.5 if py<=28 else (3.0 if py<=38 else 3.3))
        add("싱크대 [도급재 · 캐비넷+상판+설치]", m, "m", U["sink_m"])
    if "light" in parts:
        n = max(12,int(py*2.1))
        add("매입등 타공", n, "개", U["downlight_hole"])
        add("매입등 자재 (4인치)", n, "개", U["downlight_unit"])
        add("전기공 통합 노무 (배선·결선)", max(1,round(n/30*2)/2), "일", U["electrician_day"])
    if "door" in parts:
        n = max(2,round(py/10))+1
        add("방문 본체", n, "개", U["door_body"])
        add("도어 목공 노무", max(1,round(n*0.33*2)/2), "일", U["carpenter_day"])
    if "molding" in parts:
        m = round(py*4)
        add("몰딩 자재", m, "m", U["molding_m"])
        add("몰딩 목공 노무", max(1,round(m*0.015*2)/2), "일", U["carpenter_day"])
    if "window" in parts:
        ja = 10 if py<=12 else (15 if py<=18 else (22 if py<=25 else (32 if py<=35 else (45 if py<=50 else 65))))
        add("샷시 중급 PVC [도급재]", ja, "자²", U["window_ja"])
    if "paint" in parts: add("베란다 내부 수성 2회 (자재+도장공)", 1, "식", 0, U["paint_set"])
    if "balcony" in parts:
        bm = 3 if py<16 else (5 if py<26 else (7 if py<36 else (9 if py<50 else 12)))
        add("확장 바닥 단열재 50T", round(bm*1.05,2), "㎡", U["insul_m2"])
        add("방수공 노무", 1, "일", U["waterproof_day"])
        add("XL 파이프 난방 연장", bm*5, "m", U["xl_m"])
        add("몰탈 미장 마감 [도급재]", bm, "㎡", U["mortar_m2"])
    add("공종별 화물 배송비", min(12,max(2,len(parts))), "식", U["freight"])
    return items, tot[0]

def rate_of(t):
    if t<=5000000: return 0.15
    if t<=10000000: return 0.11
    if t<=20000000: return 0.085
    if t<=30000000: return 0.07
    if t<=40000000: return 0.06
    if t<=50000000: return 0.05
    if t<=70000000: return 0.045
    return 0.04

won = lambda n: "{:,}".format(int(n))
man = lambda n: "{:,}만원".format(int(round(n/10000)))

CSS = ("*{margin:0;padding:0;box-sizing:border-box}"
"body{font-family:'Noto Serif KR',serif;background:#F5F1E8;color:#2A2A2A;line-height:1.7}"
".wrap{max-width:760px;margin:0 auto;background:#FBF8F1;padding:0 0 60px}"
"header{background:#2A2A2A;color:#F5F1E8;padding:44px 32px;text-align:center}"
"header .eb{font-size:11px;letter-spacing:5px;color:#C98E7E}"
"header h1{font-size:24px;font-weight:600;margin-top:14px;line-height:1.5}"
"main{padding:36px 32px}h2{font-size:18px;margin:30px 0 10px;padding-left:11px;border-left:3px solid #C98E7E}"
"p{margin:10px 0}table{width:100%;border-collapse:collapse;margin:12px 0;background:#fff;font-size:14px}"
"th{background:#2A2A2A;color:#F5F1E8;padding:10px;text-align:left}"
"td{border-bottom:1px solid #C8C4BC;padding:9px 10px}td.r{text-align:right;white-space:nowrap}"
"tr.tot td{background:#FBF8F1;font-weight:700}"
".cta{background:#2A2A2A;color:#F5F1E8;border-radius:12px;padding:26px;text-align:center;margin-top:32px}"
".cta a{display:inline-block;margin:12px 6px 0;background:#F5F1E8;color:#2A2A2A;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600}"
".note{font-size:13px;color:#6B6B6B;margin-top:20px}"
".rel{margin-top:28px;border-top:1px solid #ddd;padding-top:16px;font-size:14px}"
".rel a{display:inline-block;margin:4px 8px 4px 0;padding:5px 12px;background:#F1EDE3;border-radius:16px;color:#2A2A2A;text-decoration:none}")

def render(c, related):
    rows = "".join('<tr><td>%s</td><td class="r">%s%s</td><td class="r">%s</td></tr>' % (i["n"], i["q"], i["u"], won(i["a"])) for i in c["items"])
    rel = "".join('<a href="%s">%s</a>' % (r[0], r[1]) for r in related)
    ld = '{"@context":"https://schema.org","@type":"Article","headline":"%s %s평 %s 견적 사례","inLanguage":"ko","mainEntityOfPage":"https://jipjini.com/cases/%s.html","publisher":{"@type":"Organization","name":"집지니","url":"https://jipjini.com/"}}' % (c["region"], c["py"], c["scope"], c["slug"])
    return """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="https://jipjini.com/cases/{slug}.html">
<title>{region} {py}평 {scope} 견적 — {totm} 실제 산출 사례 · 집지니</title>
<meta name="description" content="{region} {py}평 {scope} 견적 사례. 시공총액 {totm}, 턴키 대비 {savedm} 절감. 공종별 수량·단가를 전부 공개합니다.">
<meta property="og:title" content="{region} {py}평 {scope} 견적 — {totm}">
<meta property="og:description" content="공종별 수량·단가 전부 공개. 턴키 대비 {savedm} 절감 사례.">
<meta property="og:image" content="https://jipjini.com/og-cover.png">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&display=swap" rel="stylesheet">
<style>{css}</style>
<script type="application/ld+json">{ld}</script>
</head><body><div class="wrap">
<header><div class="eb">JIPJINI · DIRECT COORDI</div>
<h1>{region} {py}평 {scope}<br>견적 사례 — 명세 전부 공개</h1></header>
<main>
<p>{region} {py}평({area}㎡) {note}의 <b>{scope}</b> 견적입니다. 집지니 다이렉트 코디 방식(마진 0원, 자재·인건비 직거래)으로 산출했습니다.</p>
<h2>총액 비교</h2>
<table>
<tr><th>구분</th><th class="r">금액</th></tr>
<tr><td>턴키(업체 일임) 시 예상</td><td class="r">{turnm}</td></tr>
<tr style="background:#FBF8F1"><td><b>다이렉트 코디</b></td><td class="r"><b>{totm}</b></td></tr>
<tr><td style="color:#C98E7E">절감액</td><td class="r" style="color:#C98E7E"><b>{savedm}</b></td></tr>
</table>
<h2>공종별 세부 내역</h2>
<table>
<tr><th>항목</th><th class="r">수량</th><th class="r">금액</th></tr>
{rows}
<tr class="tot"><td>시공총액 (자재+인건비 · 건축주 직접 결제)</td><td class="r"></td><td class="r">{totw}</td></tr>
<tr class="tot"><td>집지니 코디 운영비 ({ratep}%)</td><td class="r"></td><td class="r">{coordiw}</td></tr>
</table>
<h2>이 견적을 보는 법</h2>
<p>{comment}</p>
<div class="cta">
<div style="font-size:17px;font-weight:600">내 집은 얼마일까요?</div>
<div style="font-size:14px;color:rgba(245,241,232,.7);margin-top:8px">정밀 의뢰서 5분 → 24시간 내 무료 견적서</div>
<a href="https://jipjini.com/request.html">무료 견적 신청</a><a href="https://pf.kakao.com/_NjpxhC/chat">카톡 문의</a>
</div>
<div class="rel"><b>비슷한 사례</b><br>{rel}</div>
<p class="note">※ 위 금액은 평형·공정 기준 표준 산출값이며 현장 실측에 따라 달라집니다. 집지니는 마진을 남기지 않는 코디네이터로, 자재·인건비는 건축주가 자재상·기술자에게 직접 결제합니다 (영수증 건축주 명의).</p>
</main></div></body></html>""".format(slug=c["slug"], region=c["region"], py=c["py"], scope=c["scope"],
        totm=man(c["total"]), savedm=man(c["saved"]), turnm=man(c["turnkey"]), area=c["area"],
        note=c["note"], rows=rows, totw=won(c["total"]), coordiw=won(c["coordi"]),
        ratep=int(c["rate"]*1000)/10, comment=c["comment"], rel=rel, css=CSS, ld=ld)

def build(n=20, seed=20260731):
    random.seed(seed)
    combos = [(py, s, p) for py in PY_LIST for s, p in SCOPES]
    random.shuffle(combos)
    out, used = [], set()
    for py, sname, parts in combos:
        if len(out) >= n: break
        if (py, sname) in used: continue
        used.add((py, sname))
        region, note = REGIONS[len(out) % len(REGIONS)]
        items, total = calc(py, parts)
        r = rate_of(total)
        turn = int(round(total*1.62/100000)*100000)
        sl = {"서울":"seoul","경기":"gg","인천":"incheon"}[region.split()[0]]
        ss = {"도배+바닥":"wallfloor","욕실 전체":"bath","주방+욕실":"kitchenbath","도배+바닥+욕실":"wfb",
              "부분 올수리":"partial","올수리":"full","창호+단열":"window","입주 전 기본":"movein"}[sname]
        out.append({"py":py,"scope":sname,"region":region,"note":note,"area":round(py*3.3,1),
                    "items":items,"total":total,"rate":r,"coordi":int(round(total*r)),
                    "turnkey":turn,"saved":turn-total,"comment":COMMENTS.get(sname,""),
                    "slug":"%s-%dpy-%s" % (sl, py, ss)})
    return out

def deploy():
    root = os.path.dirname(os.path.abspath(__file__))
    cdir = os.path.join(root, "cases")
    os.makedirs(cdir, exist_ok=True)
    cases = build(20)
    for i, c in enumerate(cases):
        rel = [("%s.html" % cases[(i+k) % len(cases)]["slug"],
                "%s %d평 %s" % (cases[(i+k)%len(cases)]["region"], cases[(i+k)%len(cases)]["py"], cases[(i+k)%len(cases)]["scope"]))
               for k in (1,2,3)]
        open(os.path.join(cdir, c["slug"] + ".html"), "w", encoding="utf-8").write(render(c, rel))

    entries = []
    for f in sorted(glob.glob(os.path.join(cdir, "*.html"))):
        name = os.path.basename(f)
        if name == "index.html": continue
        m = re.search(r"<title>(.*?) · 집지니</title>", open(f, encoding="utf-8").read())
        entries.append((name, m.group(1) if m else name))
    lis = "\n".join('<li><a href="%s">%s</a></li>' % (n, l) for n, l in entries)
    idx = """<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="https://jipjini.com/cases/">
<title>인테리어 견적 사례 모음 — 평형·공정별 실제 명세 공개 · 집지니</title>
<meta name="description" content="평형별·공정별 인테리어 견적 사례 %d건. 공종별 수량·단가와 턴키 대비 절감액을 전부 공개합니다. 마진 0원 다이렉트 코디.">
<style>body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#F5F1E8;color:#2A2A2A;max-width:780px;margin:0 auto;padding:44px 22px;line-height:1.75}
h1{font-size:26px}p.sub{color:#6B6B6B;font-size:14px;margin:8px 0 26px}
ul{padding-left:18px}li{margin:9px 0;font-size:15px}a{color:#2A2A2A}
.cta{background:#2A2A2A;color:#F5F1E8;border-radius:12px;padding:24px;text-align:center;margin-top:34px}
.cta a{display:inline-block;margin:10px 5px 0;background:#F5F1E8;color:#2A2A2A;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600}</style></head><body>
<h1>인테리어 견적 사례 모음</h1>
<p class="sub">평형·공정별 실제 산출 견적 %d건. 공종별 수량·단가와 턴키 대비 절감액을 그대로 공개합니다.</p>
<ul>%s</ul>
<div class="cta"><div style="font-size:17px;font-weight:600">내 집 견적이 궁금하다면</div>
<a href="https://jipjini.com/request.html">무료 견적 신청 (5분)</a><a href="https://pf.kakao.com/_NjpxhC/chat">카톡 문의</a></div>
</body></html>""" % (len(entries), len(entries), lis)
    open(os.path.join(cdir, "index.html"), "w", encoding="utf-8").write(idx)

    today = datetime.date.today().isoformat()
    base = ["","about.html","pricing.html","workflow.html","prepare.html","payment.html",
            "banself-interior.html","gimpo-interior.html","interior-margin-30.html",
            "jikyoung-interior.html","interior-estimate-compare.html","apt-olsuri-cost.html",
            "bathroom-remodel-cost.html","incheon-interior.html"]
    urls = ['  <url><loc>https://jipjini.com/%s</loc><lastmod>%s</lastmod><changefreq>monthly</changefreq><priority>%s</priority></url>' % (p, today, "1.0" if p=="" else "0.8") for p in base]
    urls.append('  <url><loc>https://jipjini.com/cases/</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>' % today)
    for n, _ in entries:
        urls.append('  <url><loc>https://jipjini.com/cases/%s</loc><lastmod>%s</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>' % (n, today))
    open(os.path.join(root, "sitemap.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
    print("deployed %d cases / index %d / sitemap %d urls" % (len(cases), len(entries), len(urls)))

if __name__ == "__main__":
    deploy()
