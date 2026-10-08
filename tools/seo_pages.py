# -*- coding: utf-8 -*-
"""검색 유입용 자동 쪽 생성기 (2026-10-09)
실견적(data/real-quotes.json)과 산출 사례(cases/index.html)를 모아
  region/<지역>.html  지역별 인테리어 비용      (예: region/gg-gimpo.html)
  py/<평형>py.html     평형별 인테리어 비용      (예: py/32py.html)
  trade/<공종>.html    공종별 비용·상표          (예: trade/dobae.html)
  region/ py/ trade/ 의 index.html 묶음 쪽
을 만든다. 표는 전부 글자(검색 로봇이 읽음), 쪽마다 자주 묻는 질문·위치 경로 구조화 데이터를 넣는다.
사용: python3 tools/seo_pages.py   (gen_real_quotes.py 다음에 실행)
"""
import os, re, json, html, datetime, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_real_quotes import CSS, head, faq_ld, crumb_ld, won, man, esc, ROMA, norm_region, region_slug, SITE, ROOT, TODAY, pyt

YEAR = TODAY.year
PRICE = SITE + "interior-price-table.html"

# ───────── 자료 읽기 ─────────
def load_real():
    p = os.path.join(ROOT, "data", "real-quotes.json")
    if not os.path.exists(p): return []
    out = []
    for c in json.load(open(p, encoding="utf-8"))["cases"]:
        c["region"] = norm_region(c["region"]); c["kind"] = "real"; out.append(c)
    return out

def load_synthetic():
    p = os.path.join(ROOT, "cases", "index.html")
    if not os.path.exists(p): return []
    s = open(p, encoding="utf-8").read(); out = []
    for f, t in re.findall(r'<li><a href="((?:gg|seoul|incheon)-\d+py-\w+\.html)">([^<]+)</a>', s):
        m = re.match(r"(.+?) (\d+)평 (.+?) 견적 — ([\d,]+)만원", html.unescape(t))
        if not m: continue
        out.append({"kind": "synth", "file": "cases/" + f, "region": norm_region(m.group(1)), "py": int(m.group(2)), "scope": m.group(3),
                    "total": int(m.group(4).replace(",", "")) * 10000, "title": html.unescape(t)})
    return out

# ───────── 공통 조각 ─────────
NAV = '<nav class="bc"><a href="../">집지니</a> › <a href="./">{hub}</a> › {here}</nav>'
CTA = '''<div class="cta"><div style="font-size:17px;font-weight:600">{t}</div>
<a href="https://jipjini.com/request.html">무료 견적 신청 (5분)</a><a href="https://pf.kakao.com/_NjpxhC/chat">카톡 문의</a></div>'''
HOW = '''<h2>진행 방법</h2>
<p>① 홈페이지 의뢰서(5분) → ② 코디가 자재·단가·공정이 줄마다 적힌 견적서를 보내 드립니다(무료) → ③ 진행을 정하시면 계약 후 자재상·기술자와 직거래로 시공합니다. 집지니는 자재·인건비에 마진을 붙이지 않고 정찰제 코디비만 받습니다.</p>'''
FOOT_NOTE = '<p class="note">※ 실견적은 집지니가 고객에게 실제로 보낸 견적서(개인정보 제거), 산출 사례는 같은 단가표로 평형·범위별로 계산한 표준 견적입니다. 금액은 공급가액(부가세 별도)이며 실측 후 달라질 수 있습니다.</p>'

def faq_html(qas): return '<h2>자주 묻는 질문</h2><div class="faq">' + "".join(f'<div class="q">{esc(q)}</div><div class="a">{esc(a)}</div>' for q, a in qas) + "</div>"

def real_rows(rs, rel="../"):
    if not rs: return ""
    tr = "".join(f'<tr><td><a href="{rel}{c["file"]}">{esc(c["region"])} {pyt(c)}{esc(c.get("type") or "")}</a></td><td>{c["ymd"][:4]}.{c["ymd"][4:6]}</td><td class="r">{len(c["sections"])}개</td><td class="r">{won(c["total"])}</td><td class="r">{man(c["total"] / c["py"]) if c.get("py") else "-"}</td></tr>' for c in rs)
    return f'<table><tr><th>실견적</th><th>작성</th><th class="r">공종</th><th class="r">시공총액</th><th class="r">평당</th></tr>{tr}</table>'

def synth_rows(ss, rel="../"):
    if not ss: return ""
    tr = "".join(f'<tr><td><a href="{rel}{c["file"]}">{esc(c["region"])} {c["py"]}평 {esc(c["scope"])}</a></td><td class="r">{man(c["total"])}</td><td class="r">{man(c["total"] / c["py"])}</td></tr>' for c in ss)
    return f'<table><tr><th>산출 사례</th><th class="r">시공총액</th><th class="r">평당</th></tr>{tr}</table>'

def stat(vals):
    vals = [v for v in vals if v]
    return (sum(vals) / len(vals), min(vals), max(vals), len(vals)) if vals else None

def page(url, title, desc, ld_extra, h1, hub, here, body, eb="JIPJINI · 비용 안내"):
    ld = {"@context": "https://schema.org", "@graph": ld_extra}
    return head(url, title, desc, ld) + f"""
<body><div class="wrap">
<header><div class="eb">{eb}</div><h1>{h1}</h1></header>
{NAV.format(hub=hub, here=here)}
<main>
{body}
</main></div></body></html>
"""

def write(path, content):
    fp = os.path.join(ROOT, path); os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, "w", encoding="utf-8").write(content)

# ───────── 지역 쪽 ─────────
SIDO_NOTE = {"서울": "서울은 구마다 아파트 연식과 평형 분포가 달라 같은 공사도 금액 차이가 큽니다. 집지니는 자재상·기술자 직거래 단가를 그대로 적용하므로 지역에 따른 추가 요금이 없습니다.",
             "경기": "경기권은 신도시 입주 물량과 구축 단지가 섞여 있어 「입주 전 기본」과 「올수리」 문의가 함께 많습니다. 수도권 전역 같은 단가표로 견적합니다.",
             "인천": "인천·강화는 집지니 사무실(강화)에서 가장 가까운 핵심 지역입니다. 지역 자재상·기술자 직거래로 운반·이동 비용까지 아낍니다.",
             "충북": "수도권 밖 지역은 일정과 기술자 이동을 먼저 확인한 뒤 견적합니다. 복합 공사(3개 공종 이상)부터 받습니다."}

def region_pages(real, synth):
    groups = {}
    for c in real + synth: groups.setdefault(c["region"], []).append(c)
    # 「경기 용인시」 쪽에는 「경기 용인시 수지구」 자료도, 수지구 쪽에는 용인시 자료도 함께 보인다
    merged = {}
    for region in groups:
        items = []
        for r2, its in groups.items():
            if r2 == region or r2.startswith(region + " ") or region.startswith(r2 + " "): items += its
        merged[region] = items
    made = []
    for region, items in sorted(merged.items()):
        slug = region_slug(region); url = f"{SITE}region/{slug}.html"
        rs = sorted([c for c in items if c["kind"] == "real"], key=lambda c: c["ymd"], reverse=True)
        ss = sorted([c for c in items if c["kind"] == "synth"], key=lambda c: c["py"])
        per = stat([c["total"] / c["py"] for c in rs if c.get("py")]) or stat([c["total"] / c["py"] for c in ss])
        n = len(items); sido = region.split()[0]
        title = f"{region} 인테리어 비용 ({YEAR}) — 실견적 {len(rs)}건·산출 사례 {len(ss)}건 공개 · 집지니"
        desc = f"{region} 인테리어 비용을 실제 견적서로 공개합니다. " + (f"평당 시공비 평균 {man(per[0])}(범위 {man(per[1])}~{man(per[2])}), " if per else "") + f"올수리·부분수리·욕실 등 {n}건의 공종별 금액과 상표를 줄마다 볼 수 있습니다. 마진 0 코디, 무료 견적 5분."
        qas = [(f"{region} 인테리어 평당 비용은 얼마인가요?", (f"집지니 자료 {per[3]}건 기준 평당 시공비(자재+인건비)는 평균 {man(per[0])}, 범위 {man(per[1])}~{man(per[2])}입니다. 공사 범위(도배·바닥만 / 욕실 포함 / 올수리)에 따라 차이가 큽니다." if per else "무료 견적으로 확인할 수 있습니다.")),
               (f"{region}도 서비스 지역인가요?", f"네. 집지니는 수도권 전역을 같은 단가표로 코디합니다. {region}에서 실제로 보낸 견적이 {len(rs)}건 있습니다." if rs else f"네. 집지니는 수도권 전역을 같은 단가표로 코디합니다. 부분 수리는 3개 공종 이상부터 받습니다."),
               ("일반 업체보다 얼마나 싼가요?", "자재상·기술자 직거래라 자재·인건비 마진이 0원이고 정찰제 코디비만 더해집니다. 같은 범위 턴키 대비 보통 20~30% 낮습니다.")]
        ld = [{"@type": "Service", "name": f"{region} 인테리어 코디", "serviceType": "인테리어 코디네이션", "provider": {"@type": "Organization", "name": "집지니", "url": SITE}, "areaServed": {"@type": "AdministrativeArea", "name": region}, "url": url},
              crumb_ld([("집지니", SITE), ("지역별 비용", SITE + "region/"), (region, url)]), faq_ld(qas)]
        sizes = sorted(set(int(c["py"]) for c in items if c.get("py")))
        size_links = " ".join(f'<a href="../py/{p}py.html">{p}평</a>' for p in sizes)
        body = f"""<p>{esc(region)} 아파트·빌라 인테리어 비용을 실제 견적서 기준으로 정리했습니다. {esc(SIDO_NOTE.get(sido, SIDO_NOTE['경기']))}</p>
{f'<div class="kv"><div>평당 시공비 평균<b>{man(per[0])}</b></div>' + (f'<div>범위<b>{man(per[1])} ~ {man(per[2])}</b></div>' if per[3] >= 2 else '') + f'<div>자료<b>{n}건</b></div></div>' if per else ''}
{('<h2>' + esc(region) + ' 실견적 — 실제로 보낸 견적서</h2><p>개인정보만 가리고 상표·규격·수량·단가를 그대로 공개합니다.</p>' + real_rows(rs)) if rs else ''}
{('<h2>' + esc(region) + ' 평형·범위별 산출 사례</h2>' + synth_rows(ss)) if ss else ''}
{HOW}
{faq_html(qas)}
<h2>함께 보기</h2>
<ul class="rel"><li><a href="../interior-price-table.html">실견적 시세표 — 지역·평형·공종별 평균</a></li><li><a href="../trade/">공종별 비용 (도배·바닥·욕실·창호…)</a></li>{('<li>평형별: ' + size_links + '</li>') if sizes else ''}{'<li><a href="../gimpo-interior.html">김포 인테리어 안내</a></li>' if '김포' in region else ''}{'<li><a href="../incheon-interior.html">인천·강화 인테리어 안내</a></li>' if sido == '인천' else ''}{'<li><a href="../ganghwa-interior.html">강화 인테리어 안내 — 강화 사무실 기반</a></li>' if '강화' in region else ''}</ul>
{CTA.format(t=esc(region) + ' 우리 집 견적, 줄마다 공개로 받아 보세요')}
{FOOT_NOTE}"""
        write(f"region/{slug}.html", page(url, title, desc, ld, f"{esc(region)} 인테리어 비용<br>— 실견적 {len(rs)}건 · 산출 사례 {len(ss)}건", "지역별 비용", esc(region), body, "JIPJINI · 지역별 비용"))
        made.append((slug, region, len(rs), len(ss), per))
    # 묶음 쪽
    url = SITE + "region/"
    lis = "".join(f'<li><a href="{s}.html">{esc(r)} 인테리어 비용</a> <span style="color:#6B6B6B;font-size:13px">— 실견적 {a}건 · 사례 {b}건{(" · 평당 " + man(p[0])) if p else ""}</span></li>' for s, r, a, b, p in made)
    qas = [("지역마다 인테리어 비용이 다른가요?", "집지니는 수도권 전역에 같은 단가표를 적용합니다. 지역별 차이는 단지 연식·평형 분포·공사 범위에서 나옵니다."), ("우리 지역이 목록에 없으면요?", "수도권이면 받습니다. 의뢰서를 보내 주시면 같은 단가표로 견적해 드립니다.")]
    ld = [crumb_ld([("집지니", SITE), ("지역별 비용", url)]), faq_ld(qas)]
    body = f"<p>집지니가 실제로 보낸 견적서와 산출 사례를 지역(시·구)별로 모았습니다. 지역을 누르면 평당 시세와 사례 목록이 나옵니다.</p><ul class=\"rel\">{lis}</ul>{HOW}{faq_html(qas)}{CTA.format(t='우리 지역 견적 받기')}{FOOT_NOTE}"
    write("region/index.html", page(url, f"지역별 인테리어 비용 ({YEAR}) — 서울·경기·인천 시·구별 실견적 · 집지니", f"서울·경기·인천 {len(made)}개 지역의 인테리어 비용을 실제 견적서로 공개합니다. 지역별 평당 시세와 사례 목록.", ld, f"지역별 인테리어 비용<br>— {len(made)}개 시·구 실견적·사례", "지역별 비용", "전체", body, "JIPJINI · 지역별 비용").replace(NAV.format(hub="지역별 비용", here="전체"), '<nav class="bc"><a href="../">집지니</a> › 지역별 비용</nav>'))
    return made

# ───────── 평형 쪽 ─────────
def py_pages(real, synth):
    sizes = sorted(set(int(c["py"]) for c in real + synth if c.get("py")))
    made = []
    for p in sizes:
        rs = sorted([c for c in real if int(c.get("py") or 0) == p], key=lambda c: c["ymd"], reverse=True)
        ss = sorted([c for c in synth if c["py"] == p], key=lambda c: c["total"])
        near_r = [c for c in real if c.get("py") and abs(int(c["py"]) - p) <= 3 and c not in rs]
        per = stat([c["total"] / c["py"] for c in rs + near_r]) or stat([c["total"] / c["py"] for c in ss])
        url = f"{SITE}py/{p}py.html"
        full = [c for c in ss if c["scope"] == "올수리"]; part = [c for c in ss if c["scope"] != "올수리"]
        title = f"{p}평 인테리어 비용 ({YEAR}) — 올수리·부분수리 실견적 {len(rs)}건·사례 {len(ss)}건 · 집지니"
        desc = f"{p}평 아파트 인테리어 비용을 공사 범위별로 정리했습니다. " + (f"올수리 약 {man(full[0]['total'])}, " if full else "") + (f"평당 시공비 평균 {man(per[0])}. " if per else "") + "실제 견적서의 공종별 금액과 상표를 줄마다 공개합니다."
        qas = [(f"{p}평 올수리 비용은 얼마인가요?", (f"표준(중급) 자재 기준 산출 사례로 시공총액 약 {man(full[0]['total'])}(평당 {man(full[0]['total'] / p)})이며, 코디비를 더해도 같은 범위 턴키보다 20~30% 낮습니다." if full else (f"평당 시공비 평균 {man(per[0])} 기준으로 약 {man(per[0] * p)} 안팎입니다. 창호·확장 포함 여부에 따라 달라집니다." if per else "무료 견적으로 확인할 수 있습니다."))),
               (f"{p}평 도배·바닥만 하면 얼마인가요?", next((f"산출 사례 기준 {man(c['total'])}입니다. 도배는 벽+천장 면적(평수의 약 3.6배), 바닥은 전용면적(약 2.6배)으로 계산합니다." for c in ss if c["scope"] == "도배+바닥"), "도배는 벽+천장 면적(평수의 약 3.6배), 바닥은 전용면적(약 2.6배)으로 계산합니다. 실견적 쪽에서 줄 단가를 확인할 수 있습니다.")),
               ("견적에 뭐가 포함되나요?", "철거·폐기물·사다리차 같은 준비 비용부터 공종별 자재(상표·규격)와 기술자 인건비까지 줄마다 적습니다. 숨은 「일식」 없이 수량·단가를 공개합니다.")]
        ld = [crumb_ld([("집지니", SITE), ("평형별 비용", SITE + "py/"), (f"{p}평", url)]), faq_ld(qas)]
        others = " ".join(f'<a href="{q}py.html">{q}평</a>' for q in sizes if q != p)
        body = f"""<p>{p}평(공급면적 기준, 전용 약 {round(p * 2.6)}㎡) 아파트의 인테리어 비용입니다. 같은 평수라도 「도배·바닥만」과 「올수리」는 금액이 5배 넘게 차이 나므로 범위별로 나눠 보여 드립니다.</p>
{f'<div class="kv"><div>평당 시공비 평균<b>{man(per[0])}</b></div>' + (f'<div>범위<b>{man(per[1])} ~ {man(per[2])}</b></div>' if per[3] >= 2 else '') + f'<div>자료<b>{len(rs) + len(ss)}건</b></div></div>' if per else ''}
{('<h2>' + str(p) + '평 실견적 — 실제로 보낸 견적서</h2>' + real_rows(rs)) if rs else ''}
{('<h2>' + str(p) + '평 범위별 산출 사례</h2>' + synth_rows(full + part)) if ss else ''}
{('<h2>비슷한 평형 실견적</h2>' + real_rows(sorted(near_r, key=lambda c: c["ymd"], reverse=True)[:6])) if near_r else ''}
{HOW}
{faq_html(qas)}
<h2>다른 평형</h2><p class="rel">{others}</p>
<ul class="rel"><li><a href="../interior-price-table.html">실견적 시세표</a></li><li><a href="../region/">지역별 비용</a></li><li><a href="../trade/">공종별 비용</a></li>{'<li><a href="../apt-olsuri-cost.html">32평 올수리 비용 — 방식별 비교</a></li>' if p == 32 else ''}</ul>
{CTA.format(t=str(p) + '평 우리 집 견적, 줄마다 공개로 받아 보세요')}
{FOOT_NOTE}"""
        write(f"py/{p}py.html", page(url, title, desc, ld, f"{p}평 인테리어 비용<br>— 올수리·부분수리 범위별 금액", "평형별 비용", f"{p}평", body, "JIPJINI · 평형별 비용"))
        made.append((p, len(rs), len(ss), per))
    url = SITE + "py/"
    lis = "".join(f'<li><a href="{p}py.html">{p}평 인테리어 비용</a> <span style="color:#6B6B6B;font-size:13px">— 실견적 {a}건 · 사례 {b}건{(" · 평당 " + man(s[0])) if s else ""}</span></li>' for p, a, b, s in made)
    qas = [("평당 인테리어 비용은 어떻게 계산하나요?", "시공총액(자재+인건비)을 공급면적 평수로 나눈 값입니다. 평수가 커질수록 철거·사다리차 같은 고정비 비중이 줄어 평당 단가는 내려갑니다."), ("평수를 모르면요?", "등기부등본·관리비 고지서의 공급면적(㎡)을 3.3으로 나누면 평수입니다. 의뢰서에 ㎡로 적으셔도 됩니다.")]
    ld = [crumb_ld([("집지니", SITE), ("평형별 비용", url)]), faq_ld(qas)]
    body = f"<p>평형별 인테리어 비용을 실견적과 산출 사례로 정리했습니다. 평형을 누르면 범위별 금액과 사례가 나옵니다.</p><ul class=\"rel\">{lis}</ul>{HOW}{faq_html(qas)}{CTA.format(t='우리 집 평형 견적 받기')}{FOOT_NOTE}"
    write("py/index.html", page(url, f"평형별 인테리어 비용 ({YEAR}) — 15평부터 60평까지 실견적·사례 · 집지니", f"{sizes[0]}평부터 {sizes[-1]}평까지 평형별 인테리어 비용을 실제 견적서와 산출 사례로 공개합니다.", ld, f"평형별 인테리어 비용<br>— {len(made)}개 평형 실견적·사례", "평형별 비용", "전체", body, "JIPJINI · 평형별 비용").replace(NAV.format(hub="평형별 비용", here="전체"), '<nav class="bc"><a href="../">집지니</a> › 평형별 비용</nav>'))
    return made

# ───────── 공종 쪽 ─────────
TRADES = [("dobae", "도배", r"도배|벽지|실크|합지"), ("floor", "바닥(장판·마루)", r"바닥|장판|마루|강마루"), ("bath", "욕실", r"욕실|도기|양변기|세면|샤워|방수"),
          ("tile", "타일", r"타일"), ("window", "창호(샷시)", r"창호|샷시|새시|창문"), ("kitchen", "주방·싱크대", r"주방|싱크|씽크"),
          ("demo", "철거·폐기물", r"철거|폐기물|사다리차"), ("electric", "전기·조명", r"전기|조명|매입등|스위치|콘센트"), ("door", "방문·목공", r"방문|도어|목공|몰딩|걸레받이|문틀"),
          ("paint", "도장(페인트)", r"도장|페인트|수성|탄성"), ("insulation", "단열·확장", r"단열|확장|베란다|XL|난방"), ("film", "필름·시트", r"필름"), ("clean", "준비·청소·보양", r"보양|청소|측량|동의서|사전준비|기타")]

def trade_pages(real, synth_total_count):
    made = []
    for slug, name, rx in TRADES:
        r = re.compile(rx)
        hits = []
        for c in real:
            secs = [s for s in c["sections"] if r.search(s["trade"]) or any(r.search(l["item"]) for l in s["lines"])]
            if not secs: continue
            sub = sum(s["subtotal"] for s in secs)
            lines = [l for s in secs for l in s["lines"] if r.search(s["trade"]) or r.search(l["item"])]
            hits.append((c, sub, lines))
        if len(hits) < 2: continue
        hits.sort(key=lambda h: h[0]["ymd"], reverse=True)
        per = stat([h[1] / h[0]["py"] for h in hits if h[0].get("py")])
        tot = stat([h[1] for h in hits])
        url = f"{SITE}trade/{slug}.html"
        brands = {}
        for c, sub, lines in hits:
            for l in lines:
                sp = (l.get("spec") or "").strip()
                m = re.search(r"(KCC|LG|한샘|대림|아메리칸스탠다드|신한|개나리|서울벽지|LX|이건|동화|구정|노루|삼화|포세린|노브랜드|클렌체|베스띠|하우시스)[^·,()]*", (l["item"] + " " + sp))
                if m: brands[m.group(0).strip()] = brands.get(m.group(0).strip(), 0) + 1
        brand_txt = " · ".join(f"{k}({v})" for k, v in sorted(brands.items(), key=lambda x: -x[1])[:8])
        rows = "".join(f'<tr><td><a href="../{c["file"]}">{esc(c["region"])} {pyt(c)}</a></td><td>{c["ymd"][:4]}.{c["ymd"][4:6]}</td><td class="r">{len(lines)}줄</td><td class="r">{won(sub)}</td><td class="r">{man(sub / c["py"]) if c.get("py") else "-"}</td></tr>' for c, sub, lines in hits)
        # 대표 줄 (상표·규격·단가): 최근 3건에서 금액 큰 줄 순
        samp = []
        for c, sub, lines in hits[:3]:
            for l in sorted(lines, key=lambda l: -l["amount"])[:4]:
                spec_html = ('<br><span style="color:#6B6B6B;font-size:12px">' + esc(l["spec"]) + '</span>') if l.get("spec") else ""
                samp.append(f'<tr><td>{esc(l["item"])}{spec_html}</td><td class="r">{l["qty"]:g} {esc(l["unit"])}</td><td class="r">{won(l["price"])}</td><td class="r">{won(l["amount"])}</td><td><a href="../{c["file"]}" style="font-size:12px">{esc(c["region"])}</a></td></tr>')
        title = f"{name} 비용 ({YEAR}) — 실견적 {len(hits)}건 평당 단가·상표 공개 · 집지니"
        desc = f"{name} 공사 비용을 실제 견적서 {len(hits)}건으로 정리했습니다. " + (f"건당 평균 {man(tot[0])}(범위 {man(tot[1])}~{man(tot[2])})" if tot else "") + (f", 평당 {man(per[0])}" if per else "") + ". 자재 상표·규격·수량·단가를 줄마다 공개합니다."
        qas = [(f"{name} 비용은 얼마인가요?", (f"집지니 실견적 {len(hits)}건 기준 건당 평균 {man(tot[0])}, 범위 {man(tot[1])}~{man(tot[2])}입니다." if tot else "") + (f" 평당으로는 평균 {man(per[0])}입니다." if per else "") + " 평형·범위·자재 등급에 따라 달라집니다."),
               (f"{name} 자재는 어떤 상표를 쓰나요?", (f"실견적에 적힌 상표·제품: {brand_txt}. " if brand_txt else "") + "같은 등급 안에서 다른 상표로 바꾸셔도 금액 차이가 크지 않으며, 색상·품번은 착공 전 샘플로 고릅니다."),
               ("자재비와 인건비는 어떻게 나뉘나요?", "자재 줄은 자재상 직거래 단가, 인건비 줄은 기술자 하루 품(일) 단위입니다. 집지니는 두 줄 어디에도 마진을 붙이지 않습니다.")]
        ld = [crumb_ld([("집지니", SITE), ("공종별 비용", SITE + "trade/"), (name, url)]), faq_ld(qas)]
        body = f"""<p>{esc(name)} 공사 비용을 집지니가 실제로 보낸 견적서 {len(hits)}건에서 뽑아 정리했습니다. 개인정보는 가렸고, 상표·규격·수량·단가는 원본 그대로입니다.</p>
{f'<div class="kv"><div>건당 평균<b>{man(tot[0])}</b></div><div>범위<b>{man(tot[1])} ~ {man(tot[2])}</b></div>' + (f'<div>평당 평균<b>{man(per[0])}</b></div>' if per else '') + f'<div>자료<b>실견적 {len(hits)}건</b></div></div>' if tot else ''}
<h2>{esc(name)} 실견적별 금액</h2>
<table><tr><th>실견적</th><th>작성</th><th class="r">줄 수</th><th class="r">{esc(name)} 소계</th><th class="r">평당</th></tr>{rows}</table>
<h2>대표 줄 — 상표·규격·단가</h2>
<table class="dl"><tr><th>품목 · 상표·규격</th><th class="r">수량</th><th class="r">단가</th><th class="r">금액</th><th>출처</th></tr>{''.join(samp)}</table>
{HOW}
{faq_html(qas)}
<ul class="rel"><li><a href="../interior-price-table.html">실견적 시세표 — 공종별 평당 금액</a></li><li><a href="../region/">지역별 비용</a></li><li><a href="../py/">평형별 비용</a></li>{'<li><a href="../bathroom-remodel-cost.html">욕실 리모델링 비용 총정리</a></li>' if slug == 'bath' else ''}{'<li><a href="../cases/20260923-gangmaru-vs-jangpan-floor.html">강마루 vs 장판 2.2T 비교</a></li>' if slug == 'floor' else ''}{'<li><a href="../cases/20260826-dobae-partial-vs-full.html">부분 도배 vs 전체 도배</a></li>' if slug == 'dobae' else ''}</ul>
{CTA.format(t=esc(name) + ' 견적, 상표·단가까지 공개로 받아 보세요')}
{FOOT_NOTE}"""
        write(f"trade/{slug}.html", page(url, title, desc, ld, f"{esc(name)} 비용<br>— 실견적 {len(hits)}건 평당 단가·상표", "공종별 비용", esc(name), body, "JIPJINI · 공종별 비용"))
        made.append((slug, name, len(hits), tot, per))
    url = SITE + "trade/"
    lis = "".join(f'<li><a href="{s}.html">{esc(n)} 비용</a> <span style="color:#6B6B6B;font-size:13px">— 실견적 {k}건{(" · 건당 평균 " + man(t[0])) if t else ""}{(" · 평당 " + man(p[0])) if p else ""}</span></li>' for s, n, k, t, p in made)
    qas = [("공종이 뭔가요?", "도배·바닥·욕실·창호처럼 기술자와 자재가 다른 공사 단위입니다. 집지니 견적서는 공종마다 자재 줄과 인건비 줄을 나눠 적습니다."), ("한 공종만 해도 되나요?", "1~2개 단일 공종은 직영이 더 저렴해 정직하게 안내드립니다. 3개 공종 이상부터 코디의 가치가 생깁니다.")]
    ld = [crumb_ld([("집지니", SITE), ("공종별 비용", url)]), faq_ld(qas)]
    body = f"<p>공종별 인테리어 비용을 실제 견적서에서 뽑아 정리했습니다. 공종을 누르면 실견적별 금액과 상표·단가가 나옵니다.</p><ul class=\"rel\">{lis}</ul>{HOW}{faq_html(qas)}{CTA.format(t='공종별 견적 받기')}{FOOT_NOTE}"
    write("trade/index.html", page(url, f"공종별 인테리어 비용 ({YEAR}) — 도배·바닥·욕실·창호 실견적 단가 · 집지니", f"도배·바닥·욕실·타일·창호·주방 등 {len(made)}개 공종의 비용을 실제 견적서 단가로 공개합니다.", ld, f"공종별 인테리어 비용<br>— {len(made)}개 공종 실견적 단가", "공종별 비용", "전체", body, "JIPJINI · 공종별 비용").replace(NAV.format(hub="공종별 비용", here="전체"), '<nav class="bc"><a href="../">집지니</a> › 공종별 비용</nav>'))
    return made

def main():
    real, synth = load_real(), load_synthetic()
    if not real and not synth: print("자료 없음 — 변경 안 함"); return
    r = region_pages(real, synth); p = py_pages(real, synth); t = trade_pages(real, len(synth))
    print(f"지역 {len(r)}쪽 · 평형 {len(p)}쪽 · 공종 {len(t)}쪽 생성 (실견적 {len(real)} · 사례 {len(synth)})")

if __name__ == "__main__":
    main()
