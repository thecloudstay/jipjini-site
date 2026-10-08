# -*- coding: utf-8 -*-
"""집지니 실견적 공개 자동 생성기 (2026-10-08)
카카오봇 웹앱 ?cases=1 (이미 이름·주소를 가린 자료)을 읽어
  ① cases/q-YYYYMMDD-지역-NNpy.html  실견적 1건당 1쪽
  ② interior-price-table.html       실견적 시세표 (지역·평형·공종별 평균과 범위)
  ③ cases/index.html · 지역 안내 쪽 · sitemap.xml · rss.xml 자동 연결
을 만든다. 자료를 못 읽으면 아무것도 바꾸지 않는다.
사용: python3 tools/gen_real_quotes.py            (웹앱에서 읽기)
      python3 tools/gen_real_quotes.py 자료.json  (시험용 파일)
"""
import os, re, sys, json, html, datetime, urllib.request

BOT = "https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec?cases=1"
SITE = "https://jipjini.com/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.date.today()

ROMA = {"김포시":"gimpo","인천":"incheon","강화군":"ganghwa","서구":"seogu","연수구":"yeonsu","부평구":"bupyeong","남동구":"namdong","미추홀구":"michuhol","계양구":"gyeyang","중구":"junggu","동구":"donggu",
        "강서구":"gangseo","노원구":"nowon","은평구":"eunpyeong","송파구":"songpa","마포구":"mapo","강남구":"gangnam","서초구":"seocho","양천구":"yangcheon","영등포구":"yeongdeungpo","관악구":"gwanak","구로구":"guro","동작구":"dongjak","성북구":"seongbuk","강동구":"gangdong","광진구":"gwangjin","도봉구":"dobong","중랑구":"jungnang","용산구":"yongsan","성동구":"seongdong","종로구":"jongno","금천구":"geumcheon","서대문구":"seodaemun","동대문구":"dongdaemun","강북구":"gangbuk",
        "고양시":"goyang","용인시":"yongin","성남시":"seongnam","부천시":"bucheon","수원시":"suwon","파주시":"paju","시흥시":"siheung","안산시":"ansan","화성시":"hwaseong","남양주시":"namyangju","하남시":"hanam","광명시":"gwangmyeong","김포":"gimpo","서울":"seoul","경기":"gg"}
REGION_PAGE = {"김포시": ("gimpo-interior.html", "김포"), "인천": ("incheon-interior.html", "인천"), "강화군": ("incheon-interior.html", "인천·강화")}

def won(n): return f"{int(round(n)):,}원"
def man(n):
    n = int(round(n / 10000))
    return (f"{n // 10000}억 {n % 10000:,}만원" if n % 10000 else f"{n // 10000}억원") if n >= 10000 else f"{n:,}만원"
def esc(s): return html.escape(str(s if s is not None else ""), quote=True)
def rfc(d, h=20):
    return d.strftime(f"%a, %d %b %Y {h:02d}:00:00 +0900")

def slug(c):
    parts = c["region"].split()
    rs = [ROMA.get(p, "") for p in parts[1:]] or [ROMA.get(parts[0], "sudogwon")]
    rs = [x for x in rs if x] or [ROMA.get(parts[0], "sudogwon")]
    return f"q-{c['ymd']}-{'-'.join(rs)}-{int(c['py'] or 0)}py"

def py_band(py):
    py = int(py or 0)
    return "10평대 이하" if py < 20 else f"{py // 10 * 10}평대" if py < 50 else "50평 이상"

def short_region(r):
    p = r.split()
    return " ".join(p[1:]) if len(p) > 1 else r

CSS = """*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Serif KR',sans-serif;background:#F5F1E8;color:#2A2A2A;line-height:1.7}
.wrap{max-width:760px;margin:0 auto;background:#FBF8F1;padding:0 0 60px}
header{background:#2A2A2A;color:#F5F1E8;padding:44px 28px;text-align:center}
header .eb{font-size:11px;letter-spacing:5px;color:#C98E7E}
header h1{font-size:24px;font-weight:600;margin-top:14px;line-height:1.5}
nav.bc{font-size:12px;color:#6B6B6B;padding:14px 28px 0}nav.bc a{color:#6B6B6B}
main{padding:28px 28px}
h2{font-size:19px;margin:32px 0 12px;padding-left:11px;border-left:3px solid #C98E7E}
p{margin:10px 0}
table{width:100%;border-collapse:collapse;margin:12px 0;background:#fff;font-size:14px}
th{background:#2A2A2A;color:#F5F1E8;padding:10px;text-align:left}
td{border-bottom:1px solid #C8C4BC;padding:9px 10px}
td.r,th.r{text-align:right;white-space:nowrap}
tr.tot td{background:#FBF8F1;font-weight:700}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:14px 0}
.kv div{background:#fff;border:1px solid #C8C4BC;border-radius:8px;padding:10px 12px;font-size:13px;color:#6B6B6B}
.kv b{display:block;color:#2A2A2A;font-size:16px}
details{background:#fff;border:1px solid #C8C4BC;border-radius:8px;margin:8px 0;overflow:hidden}
details summary{cursor:pointer;padding:12px 14px;font-weight:600;font-size:15px}
details[open] summary{border-bottom:1px solid #C8C4BC;background:#FBF8F1}
summary .sum{float:right;font-weight:700}
table.dl{font-size:12.5px;margin:0}table.dl th{padding:7px 8px;font-size:12px}table.dl td{padding:6px 8px}
table.dl td.d{color:#6B6B6B;font-size:12px}
.okbox{background:#fff;border-left:3px solid #C98E7E;padding:14px 16px;font-size:14px;margin:12px 0;border-radius:0 8px 8px 0}
.faq .q{font-weight:700;margin-top:14px}.faq .a{margin:4px 0 0}
.cta{background:#2A2A2A;color:#F5F1E8;border-radius:12px;padding:28px;text-align:center;margin-top:36px}
.cta a{display:inline-block;margin:12px 5px 0;background:#F5F1E8;color:#2A2A2A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600}
.note{font-size:13px;color:#6B6B6B;margin-top:24px}
ul.rel{padding-left:18px}ul.rel li{margin:6px 0}
@media(max-width:520px){main{padding:22px 16px}header{padding:36px 16px}nav.bc{padding:12px 16px 0}table{font-size:13px}}"""

GTAG = """<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-35EM7T3M9W"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-35EM7T3M9W');
</script>"""

def head(url, title, desc, ld):
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="{url}">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="집지니">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{GTAG}
</head>"""

def faq_ld(qas): return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qas]}
def crumb_ld(items): return {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

def case_title(c):
    trades = [s["trade"] for s in c["sections"]]
    scope = "올수리" if len(trades) >= 8 else "·".join(trades[:3]) + (" 등" if len(trades) > 3 else "")
    return f"{c['region']} {int(c['py'])}평 {c['type'] or '아파트'} {scope} 실견적 — 시공총액 {man(c['total'])}"

def case_page(c, fname, others):
    url = SITE + "cases/" + fname
    d = datetime.datetime.strptime(c["ymd"], "%Y%m%d").date()
    py = c["py"] or 0
    secs = sorted(c["sections"], key=lambda s: -s["subtotal"])
    trades = [s["trade"] for s in c["sections"]]
    nlines = sum(len(s["lines"]) for s in c["sections"])
    per_py = c["total"] / py if py else 0
    extra = c["codi"] + (c["pm"] or 0)
    grand = c["total"] + extra
    title = case_title(c) + " · 집지니"
    desc = (f"{c['region']} {int(py)}평 {c['type'] or '아파트'} 실제 견적서를 개인정보만 가리고 공개합니다. "
            f"{len(trades)}개 공종 {nlines}줄, 시공총액 {won(c['total'])}" + (f"(평당 {man(per_py)})" if per_py else "") +
            f", 코디비 포함 {won(grand)}(공급가액). 상표·규격·수량·단가 전부 공개.")
    qas = [
        (f"{short_region(c['region'])} {int(py)}평 인테리어 비용은 얼마인가요?",
         f"{d.year}년 {d.month}월 집지니 실견적 기준 시공총액(자재+인건비)은 {won(c['total'])}" + (f", 평당 약 {man(per_py)}" if per_py else "") +
         f"입니다. 집지니 코디비" + (" ·현장관리비" if c['pm'] else "") + f"를 더한 총액은 {won(grand)}(부가세 별도)입니다."),
        ("어떤 공사가 포함됐나요?", f"{', '.join(trades)} — 총 {len(trades)}개 공종, {nlines}줄입니다. 공종마다 자재(상표·규격)와 인건비를 나눠 적었습니다."),
        ("일반 인테리어 업체보다 왜 싼가요?", "집지니는 자재상·기술자와 직접 거래하고 자재·인건비에 마진을 붙이지 않습니다. 정찰제 코디비만 받기 때문에 같은 범위라도 업체 이윤·관리비(보통 15~20%)만큼 낮아집니다."),
    ]
    if c.get("days"):
        qas.append(("공사 기간은 얼마나 걸리나요?", f"이 견적의 예상 공정은 약 {c['days']}일({c['phases']}단계)입니다. 착공일과 실측 결과에 따라 달라질 수 있습니다."))
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": case_title(c), "description": desc, "datePublished": d.isoformat(), "dateModified": TODAY.isoformat(),
         "author": {"@type": "Organization", "name": "집지니", "url": SITE}, "publisher": {"@type": "Organization", "name": "집지니", "url": SITE},
         "mainEntityOfPage": url, "about": f"{c['region']} 인테리어 비용"},
        crumb_ld([("집지니", SITE), ("견적 사례", SITE + "cases/"), (f"{c['region']} {int(py)}평 실견적", url)]),
        faq_ld(qas)]}
    rows = "\n".join(f'<tr><td>{esc(s["trade"])}</td><td class="r">{won(s["subtotal"])}</td></tr>' for s in secs)
    det = []
    for s in c["sections"]:
        lr = "\n".join(f'<tr><td>{esc(l["item"])}' + (f'<br><span class="d" style="color:#6B6B6B;font-size:12px">{esc(l["spec"])}</span>' if l.get("spec") else "") +
                       f'</td><td class="r">{l["qty"]:g} {esc(l["unit"])}</td><td class="r">{won(l["price"])}</td><td class="r">{won(l["amount"])}</td></tr>' for l in s["lines"])
        det.append(f'<details><summary>{esc(s["trade"])} <span style="color:#6B6B6B;font-weight:400;font-size:12px">{len(s["lines"])}줄</span><span class="sum">{won(s["subtotal"])}</span></summary>'
                   f'<table class="dl"><tr><th>품목 · 상표·규격</th><th class="r">수량</th><th class="r">단가</th><th class="r">금액</th></tr>{lr}</table></details>')
    meta = [("작성", f"{d.year}년 {d.month}월"), ("지역", c["region"]), ("평형", f"{int(py)}평 {esc(c['type'] or '')}"),
            ("구조", (f"방 {int(c['rooms'])} · 욕실 {int(c['baths'])}" if c.get("rooms") else "실측 기준")), ("준공", (c["built"] + "년") if c.get("built") else "구축"),
            ("공사 방식", c["method"]), ("공정", f"약 {c['days']}일" if c.get("days") else "착공 후 확정"), ("평당 시공비", man(per_py) if per_py else "-")]
    kv = "".join(f"<div>{k}<b>{v}</b></div>" for k, v in meta)
    rp = REGION_PAGE.get(c["region"].split()[-1]) or REGION_PAGE.get(c["region"].split()[0])
    rel = "".join(f'<li><a href="{o[0]}">{esc(o[1])}</a></li>' for o in others[:5])
    region_link = f'<li><a href="../{rp[0]}">{rp[1]} 인테리어 안내 — 마진 0 코디</a></li>' if rp else ""
    status = "계약 진행" if c.get("contracted") else "견적 발송"
    return head(url, title, desc, ld) + f"""
<body><div class="wrap">
<header><div class="eb">JIPJINI · 실견적 공개</div><h1>{esc(c['region'])} {int(py)}평 {esc(c['type'] or '아파트')}<br>— 시공총액 {man(c['total'])} · {len(trades)}개 공종 {nlines}줄</h1></header>
<nav class="bc"><a href="../">집지니</a> › <a href="./">견적 사례</a> › {esc(c['region'])} {int(py)}평</nav>
<main>
<p>{d.year}년 {d.month}월 {esc(c['name'] or '')} 고객님께 실제로 보낸 견적서({status})를 개인정보만 가리고 그대로 공개합니다.
이름은 성만 남겼고, 단지명·동호수·연락처는 별표(***)로 가렸습니다. 금액은 모두 공급가액(부가세 별도)이며 수량은 실측 후 정산합니다.</p>
<div class="kv">{kv}</div>

<h2>공종별 금액</h2>
<table><tr><th>공종</th><th class="r">금액</th></tr>
{rows}
<tr class="tot"><td>시공총액 (자재+인건비 · 마진 0)</td><td class="r">{won(c['total'])}</td></tr>
<tr><td>집지니 코디비</td><td class="r">{won(c['codi'])}</td></tr>
{f'<tr><td>현장관리(PM 파견)</td><td class="r">{won(c["pm"])}</td></tr>' if c.get('pm') else ''}
<tr class="tot"><td>총 예상액 (공급가액 · 부가세 별도)</td><td class="r">{won(grand)}</td></tr></table>

<h2>상세 명세 — 상표·규격·수량·단가</h2>
<p>공종을 누르면 줄마다 자재 상표와 규격, 수량, 단가가 펼쳐집니다.</p>
{''.join(det)}

<div class="okbox"><b>이 견적을 읽는 법</b> — 「인건비」 줄은 기술자 하루 품(일) 단위이고, 자재 줄은 자재상 직거래 단가입니다.
집지니는 두 줄 어디에도 마진을 붙이지 않고, 위 표의 코디비만 받습니다.</div>

<h2>자주 묻는 질문</h2>
<div class="faq">{''.join(f'<div class="q">{esc(q)}</div><div class="a">{esc(a)}</div>' for q, a in qas)}</div>

<h2>함께 보면 좋은 실견적</h2>
<ul class="rel"><li><a href="../interior-price-table.html">실견적 인테리어 시세표 — 지역·평형·공종별 평균</a></li>{region_link}{rel}</ul>

<div class="cta"><div style="font-size:17px;font-weight:600">우리 집도 이렇게 줄마다 공개된 견적을 받아 보세요</div>
<a href="https://jipjini.com/request.html">무료 견적 신청 (5분)</a><a href="https://pf.kakao.com/_NjpxhC/chat">카톡 문의</a></div>
<p class="note">※ 실제 고객 견적서 원본에서 자동으로 만든 쪽입니다. 개인정보 보호를 위해 이름·주소·연락처는 별표로 가렸습니다. 자재 단가는 작성 시점 기준이며 시기·물량에 따라 달라질 수 있습니다.</p>
</main></div></body></html>
"""

def stat(vals):
    vals = [v for v in vals if v]
    if not vals: return None
    return (sum(vals) / len(vals), min(vals), max(vals), len(vals))

def table_page(cases, files):
    url = SITE + "interior-price-table.html"
    n = len(cases)
    per = stat([c["total"] / c["py"] for c in cases if c.get("py")])
    # 공종별 평당 금액
    tr = {}
    for c in cases:
        if not c.get("py"): continue
        for s in c["sections"]:
            tr.setdefault(s["trade"], []).append(s["subtotal"] / c["py"])
    trows = sorted(((t, stat(v)) for t, v in tr.items() if stat(v)), key=lambda x: -x[1][3] * 1e9 - x[1][0])
    # 지역·평형대
    rg = {}
    for c in cases:
        if not c.get("py"): continue
        rg.setdefault((c["region"], py_band(c["py"])), []).append(c)
    rrows = sorted(rg.items(), key=lambda x: (x[0][0], x[0][1]))
    title = f"실견적 인테리어 시세표 ({TODAY.year}) — 지역·평형·공종별 평균 · 집지니"
    desc = (f"집지니가 실제로 보낸 인테리어 견적 {n}건으로 만든 시세표입니다. " + (f"평당 시공비 평균 {man(per[0])}(범위 {man(per[1])}~{man(per[2])}). " if per else "") +
            "지역·평형·공종별 평균과 최저·최고를 공개하고, 견적이 쌓일 때마다 자동으로 갱신합니다.")
    qas = [("인테리어 평당 비용은 얼마인가요?", (f"집지니 실견적 {per[3]}건 기준 평당 시공비(자재+인건비)는 평균 {man(per[0])}, 범위 {man(per[1])}~{man(per[2])}입니다. 공사 범위에 따라 차이가 큽니다." if per else "견적이 쌓이는 대로 공개합니다.")),
           ("이 시세표는 어떻게 만들었나요?", "집지니가 고객에게 실제로 보낸 견적서를 공종별로 나눠 평수로 나눈 값입니다. 개인정보는 가렸고, 새 견적이 생기면 매일 자동으로 갱신됩니다."),
           ("공종별 금액은 왜 범위가 넓나요?", "같은 욕실이라도 철거 후 재시공인지 덧방인지, 욕실이 1개인지 2개인지에 따라 달라집니다. 각 실견적 쪽에서 줄마다 상표·수량을 확인할 수 있습니다.")]
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Dataset", "name": "집지니 실견적 인테리어 시세표", "description": desc, "url": url, "creator": {"@type": "Organization", "name": "집지니", "url": SITE},
         "dateModified": TODAY.isoformat(), "spatialCoverage": "대한민국 수도권", "variableMeasured": ["평당 시공비", "공종별 평당 금액", "시공총액"], "isAccessibleForFree": True,
         "license": "https://jipjini.com/"},
        crumb_ld([("집지니", SITE), ("실견적 시세표", url)]), faq_ld(qas)]}
    t1 = "\n".join(f'<tr><td>{esc(t)}</td><td class="r">{s[3]}건</td><td class="r">{man(s[0])}</td><td class="r">{man(s[1])} ~ {man(s[2])}</td></tr>' for t, s in trows)
    t2 = "\n".join(f'<tr><td>{esc(k[0])}</td><td>{k[1]}</td><td class="r">{len(v)}건</td><td class="r">{man(sum(x["total"] for x in v) / len(v))}</td><td class="r">{man(sum(x["total"] / x["py"] for x in v) / len(v))}</td></tr>' for k, v in rrows)
    t3 = "\n".join(f'<tr><td><a href="cases/{f}">{esc(c["region"])} {int(c["py"] or 0)}평</a></td><td>{c["ymd"][:4]}.{c["ymd"][4:6]}</td><td class="r">{len(c["sections"])}</td><td class="r">{man(c["total"])}</td><td class="r">{man(c["total"] / c["py"]) if c.get("py") else "-"}</td></tr>' for c, f in zip(cases, files))
    return head(url, title, desc, ld) + f"""
<body><div class="wrap">
<header><div class="eb">JIPJINI · 실견적 시세표</div><h1>실견적 인테리어 시세표<br>— 실제 견적 {n}건, 줄마다 공개</h1></header>
<nav class="bc"><a href="./">집지니</a> › 실견적 시세표</nav>
<main>
<p>광고용 「평당 얼마」가 아니라 집지니가 고객에게 실제로 보낸 견적서 {n}건을 모아 만든 표입니다.
모든 금액은 자재+인건비(시공총액) 기준 공급가액이며, 새 견적이 생기면 매일 자동으로 갱신됩니다. (마지막 갱신 {TODAY.year}년 {TODAY.month}월 {TODAY.day}일)</p>
{f'<div class="kv"><div>평당 시공비 평균<b>{man(per[0])}</b></div><div>최저 ~ 최고<b>{man(per[1])} ~ {man(per[2])}</b></div><div>표본<b>실견적 {per[3]}건</b></div></div>' if per else ''}

<h2>공종별 평당 금액</h2>
<table><tr><th>공종</th><th class="r">표본</th><th class="r">평균(평당)</th><th class="r">범위(평당)</th></tr>
{t1}</table>

<h2>지역·평형대별 평균</h2>
<table><tr><th>지역</th><th>평형대</th><th class="r">표본</th><th class="r">평균 시공총액</th><th class="r">평당</th></tr>
{t2}</table>

<h2>실견적 전체 목록</h2>
<table><tr><th>견적</th><th>작성</th><th class="r">공종</th><th class="r">시공총액</th><th class="r">평당</th></tr>
{t3}</table>

<h2>자주 묻는 질문</h2>
<div class="faq">{''.join(f'<div class="q">{esc(q)}</div><div class="a">{esc(a)}</div>' for q, a in qas)}</div>

<div class="cta"><div style="font-size:17px;font-weight:600">우리 집은 얼마일까요?</div>
<a href="https://jipjini.com/request.html">무료 견적 신청 (5분)</a><a href="https://jipjini.com/cases/">견적 사례 전체</a></div>
<p class="note">※ 표본이 적은 칸은 참고용입니다. 공사 범위·자재 등급·구조에 따라 실제 금액은 달라집니다. 개인정보는 모두 가렸습니다.</p>
</main></div></body></html>
"""

def put_block(path, start, end, block, anchor_re, before=True):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p): return False
    s = open(p, encoding="utf-8").read()
    full = f"{start}\n{block}\n{end}"
    if start in s:
        s2 = re.sub(re.escape(start) + r".*?" + re.escape(end), lambda m: full, s, flags=re.S)
    else:
        m = re.search(anchor_re, s)
        if not m: return False
        i = m.start() if before else m.end()
        s2 = s[:i] + full + "\n" + s[i:]
    if s2 != s: open(p, "w", encoding="utf-8").write(s2)
    return True

def main():
    if len(sys.argv) > 1:
        data = json.load(open(sys.argv[1], encoding="utf-8"))
    else:
        req = urllib.request.Request(BOT, headers={"User-Agent": "jipjini-site-bot"})
        data = json.loads(urllib.request.urlopen(req, timeout=120).read().decode("utf-8"))
    if not data.get("ok") or not isinstance(data.get("cases"), list):
        print("자료 없음 — 변경 안 함", str(data)[:200]); return
    cases = [c for c in data["cases"] if c.get("total") and c.get("sections")]
    if not cases: print("공개할 실견적 0건 — 변경 안 함"); return
    files, used = [], set()
    for c in cases:
        f = slug(c)
        if f in used: f += "-" + c["key"][:4]
        used.add(f); files.append(f + ".html")
    os.makedirs(os.path.join(ROOT, "cases"), exist_ok=True)
    titles = [case_title(c) for c in cases]
    for i, (c, f) in enumerate(zip(cases, files)):
        same = [(files[j], titles[j]) for j in range(len(cases)) if j != i and cases[j]["region"].split()[:2] == c["region"].split()[:2]]
        near = [(files[j], titles[j]) for j in sorted(range(len(cases)), key=lambda j: abs((cases[j]["py"] or 0) - (c["py"] or 0))) if j != i]
        others = []
        for o in same + near:
            if o not in others: others.append(o)
        open(os.path.join(ROOT, "cases", f), "w", encoding="utf-8").write(case_page(c, f, others))
    open(os.path.join(ROOT, "interior-price-table.html"), "w", encoding="utf-8").write(table_page(cases, files))

    # 사례 목록
    lis = "\n".join(f'<li><a href="{f}">{esc(t)}</a></li>' for f, t in zip(files, titles))
    put_block("cases/index.html", "<!--REALQ-START-->", "<!--REALQ-END-->",
              f'<h2 style="font-size:19px;margin:6px 0 8px">실견적 공개 — 실제 고객 견적서 {len(cases)}건</h2>\n<p class="sub" style="margin:0 0 8px">개인정보만 가리고 줄마다 공개합니다. <a href="../interior-price-table.html">실견적 시세표 보기 →</a></p>\n<ul>{lis}</ul>\n<h2 style="font-size:19px;margin:22px 0 8px">평형·공정별 산출 사례</h2>',
              r"<ul>", before=True)
    # 지역 안내 쪽
    for key, (page, label) in {"김포시": REGION_PAGE["김포시"], "인천": REGION_PAGE["인천"]}.items():
        mine = [(f, t) for c, f, t in zip(cases, files, titles) if key in c["region"].split() or (key == "인천" and c["region"].startswith("인천"))]
        if key == "인천": mine += [(f, t) for c, f, t in zip(cases, files, titles) if "강화군" in c["region"] and (f, t) not in mine]
        if not mine: continue
        block = f'<h2>{label} 실견적 공개</h2>\n<ul>' + "".join(f'<li><a href="cases/{f}">{esc(t)}</a></li>' for f, t in mine[:8]) + f'</ul>\n<p><a href="interior-price-table.html">실견적 시세표 전체 보기 →</a></p>\n'
        put_block(page, "<!--REALQ-START-->", "<!--REALQ-END-->", block, r"<h2>진행 방법</h2>", before=True)
    # 사이트 지도
    sp = os.path.join(ROOT, "sitemap.xml"); s = open(sp, encoding="utf-8").read()
    add = ""
    for u, pr in [("interior-price-table.html", "0.9")] + [("cases/" + f, "0.7") for f in files]:
        loc = SITE + u
        if loc in s:
            s = re.sub(r"(<loc>" + re.escape(loc) + r"</loc><lastmod>)[^<]+", lambda m: m.group(1) + TODAY.isoformat(), s) if u == "interior-price-table.html" else s
        else:
            add += f"  <url><loc>{loc}</loc><lastmod>{TODAY.isoformat()}</lastmod><changefreq>monthly</changefreq><priority>{pr}</priority></url>\n"
    s = s.replace("</urlset>", add + "</urlset>")
    open(sp, "w", encoding="utf-8").write(s)
    # 새 글 목록
    rp = os.path.join(ROOT, "rss.xml"); r = open(rp, encoding="utf-8").read(); items = ""
    for c, f, t in zip(cases, files, titles):
        loc = SITE + "cases/" + f
        if loc in r: continue
        d = datetime.datetime.strptime(c["ymd"], "%Y%m%d").date()
        items += f"""  <item>
    <title>{esc(t)}</title>
    <link>{loc}</link>
    <guid>{loc}</guid>
    <pubDate>{rfc(d)}</pubDate>
    <description>{esc(c['region'])} {int(c['py'] or 0)}평 실제 견적서 공개 — {len(c['sections'])}개 공종, 시공총액 {won(c['total'])}. 상표·규격·수량·단가 전부 공개.</description>
  </item>
"""
    if SITE + "interior-price-table.html" not in r:
        items += f"""  <item>
    <title>실견적 인테리어 시세표 — 지역·평형·공종별 평균</title>
    <link>{SITE}interior-price-table.html</link>
    <guid>{SITE}interior-price-table.html</guid>
    <pubDate>{rfc(TODAY, 19)}</pubDate>
    <description>집지니 실제 견적서로 만든 인테리어 시세표. 매일 자동 갱신.</description>
  </item>
"""
    if items:
        r = re.sub(r"<lastBuildDate>[^<]+", "<lastBuildDate>" + rfc(TODAY, 19), r)
        r = r.replace("</channel>", items + "</channel>")
        open(rp, "w", encoding="utf-8").write(r)
    print(f"실견적 {len(cases)}건 · 쪽 생성 완료")

if __name__ == "__main__":
    main()
