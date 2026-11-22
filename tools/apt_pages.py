# -*- coding: utf-8 -*-
"""단지별·평형별 인테리어 비용 쪽 (2026-11-16 대표 「평형별 단지별 아파트별 견적 주면 되겠다. 노출시키게」)

도면이 열린 단지(data/plans/open.json)마다
  apt/index.html                 아파트별 공사비 — 시·구별 단지 목록
  apt/<단지번호>/index.html       단지 쪽 — 평형마다 올수리 예상 금액
  apt/<단지번호>/<평형>.html      평형 쪽 — 집지니 도면 + 공종별 금액 + 코디비 + 견적서 받기
를 만든다. 금액은 첫 화면 계산기와 같은 규칙(집지니 실견적 평당 중위값 × 공급 평수, data/repair-prices.json).
글·표는 전부 글자(검색 로봇이 읽음), 쪽마다 위치 경로·자주 묻는 질문 구조화 자료. 도면이 새로 열리면 매일 저절로 늘어난다.
사용: python3 tools/apt_pages.py
"""
import os, re, json, html, datetime, math, csv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://jipjini.com/"
OUT = os.path.join(ROOT, "apt")
TODAY = (datetime.datetime.utcnow() + datetime.timedelta(hours=9)).date().isoformat()   # 한국 날짜(러너는 UTC)
ORDER = ['철거·준비', '샷시', '설비', '전기·조명', '목공', '욕실·타일', '도장', '필름', '도배', '바닥', '주방', '문·현관', '베란다']
BASE_OFF = {'샷시', '필름', '베란다'}   # 첫 화면과 같은 「올수리 기본」
FILL = {'거실': '#F6F7F4', '방': '#FFFFFF', '주방': '#F6F7F4', '욕실': '#EAF2E6', '발코니': '#EEF0EB', '현관': '#EEF0EB'}
CODI = [(5e6, .15), (1e7, .11), (2e7, .085), (3e7, .07), (4e7, .06), (5e7, .05), (7e7, .045), (1e8, .04)]
SIDO = {'서울': '서울특별시', '인천': '인천광역시', '경기': '경기도'}
esc = lambda s: html.escape(str(s if s is not None else ''), quote=True)


def man(v):
    v = int(round(v / 10000.0))
    return f"{v:,}만 원"


def codi_rate(total):
    for lim, r in CODI:
        if total <= lim:
            return r
    return .035


def supply(t):
    m = re.match(r"^([0-9.]+)", str(t.get('이름', '')))
    n = float(m.group(1)) if m else 0
    e = float(t.get('전용') or 0)
    return n if (n and e and e < n < e * 1.7) else (e * 1.32 if e else n)


def slug(name):
    s = re.sub(r"[^0-9A-Za-z가-힣]+", "-", str(name)).strip("-").lower()
    return s or "t"


def cost(t, pr):
    py = supply(t) / 3.3058
    T = pr['trades']
    rows, base, full = [], [0, 0, 0], [0, 0, 0]
    for k in ORDER:
        if k not in T:
            continue
        a = [T[k]['p25'] * py, T[k]['p50'] * py, T[k]['p75'] * py]
        rows.append((k, T[k]['p50'], a[1], k in BASE_OFF))
        for i in range(3):
            full[i] += a[i]
            if k not in BASE_OFF:
                base[i] += a[i]
    return py, rows, base, full


NOW_Y = datetime.date.today().year
H_CEIL = 2.3
SKIP_LEAK = re.compile(r"피트|발코니|실외기")


def half(n):
    return math.ceil(n * 2) / 2


def r1(n):
    return round(n * 10) / 10


def rooms_of(t):
    return [r for r in (t.get('plan') or {}).get('rooms') or [] if r.get('area', 0) >= 1.5 and not SKIP_LEAK.search(str(r.get('kind', '')) + str(r.get('name', '')))]


def leak_calc(sel, I, lvl, cause, wp='silk', fl='maru'):
    """leak/index.html calc() 와 같은 규칙. sel = [(방, {'ceil','wall','floor'})]"""
    sec = {}
    def add(sname, qty, price):
        if qty > 0:
            sec[sname] = sec.get(sname, 0) + round(qty * price)
    ceil = wall = floorA = perimC = perimF = gyp = 0.0
    bathCeil = n = 0
    for r, parts in sel:
        if not parts:
            continue
        n += 1
        a = r1(r['area']); per = 4.03 * math.sqrt(a)
        if r.get('kind') == '욕실':
            if 'ceil' in parts:
                bathCeil += 1
            continue
        if 'ceil' in parts:
            ceil += a; perimC += per; gyp += a if lvl == 3 else max(3, a * .4) if lvl == 2 else 0
        if 'wall' in parts:
            wall += per * H_CEIL * .85
        if 'floor' in parts:
            floorA += a; perimF += per
    if not n:
        return None
    add('사전준비', 1, I['protect']['price'])
    if cause == 'unknown':
        add('사전준비', 1, I['leak_find']['price'])
    dry = 5 if lvl == 3 else 3 if lvl == 2 else 0
    if dry:
        add('건조·곰팡이', n * dry, I['dry_day']['price'])
    if lvl == 3:
        add('건조·곰팡이', n, I['mold_fix']['price'])
    gyp = r1(gyp)
    if gyp:
        if gyp * I['gypsum_m2']['price'] < I['carp_day']['price']:
            add('목공', 1, I['carp_day']['price'])
        else:
            add('목공', gyp, I['gypsum_m2']['price'])
        if lvl >= 2:
            add('목공', math.ceil(perimC), I['molding']['price'])
    if lvl == 3:
        add('목공', r1(wall * .3), I['putty_m2']['price'])
    surf = ceil + wall
    if surf:
        rolls = math.ceil(surf / 10.5); days = max(1, half(rolls / 6))
        rollP = round(I['wall_roll']['price'] * .55 / 100) * 100 if wp == 'hap' else I['wall_roll']['price']
        add('도배', rolls, rollP)
        add('도배', 1, max(50000, round(rolls * rollP * .15 / 1000) * 1000))
        add('도배', days, I['wallpaper_day']['price'])
    if floorA:
        floorA = r1(floorA)
        if fl == 'maru':
            add('바닥', floorA, I['maru_demo']['price']); add('바닥', r1(floorA * 1.05), I['floor_maru']['price']); add('바닥', math.ceil(perimF), I['baseboard']['price'])
        else:
            add('바닥', r1(floorA * 1.1), I['floor_vinyl']['price'])
    if bathCeil:
        add('욕실', bathCeil, 230000)
    ton = half(gyp * .012 + floorA * .015 + (.5 if cause == 'mybath' else 0))
    if ton:
        add('철거·폐기물', max(.5, ton), I['waste_ton']['price'])
    if cause == 'mybath':
        add('욕실 방수(원인)', 1, I['demo_day']['price']); add('욕실 방수(원인)', 1, I['bath_wp']['price']); add('욕실 방수(원인)', 1, 250000)
        add('욕실 방수(원인)', 1.5, I['tile_day']['price']); add('욕실 방수(원인)', 1, I['helper_day']['price'])
    days = dry + (1 if gyp else 0) + (1 if surf else 0) + (1 if floorA else 0) + (4 if cause == 'mybath' else 0) + (1 if cause == 'unknown' else 0)
    return {'tot': sum(sec.values()), 'sec': sec, 'days': max(1, days)}


def leak_cases(t, I):
    """평형 도면으로 흔한 누수 네 경우를 계산"""
    R = rooms_of(t)
    pick = lambda k: sorted([r for r in R if r.get('kind') == k], key=lambda r: -r['area'])
    lv, kt, bd, ba = pick('거실'), pick('주방'), pick('방'), pick('욕실')
    out = []
    if lv:
        x = leak_calc([(lv[0], {'ceil'})], I, 2, 'up')
        if x: out.append(('윗집 물이 거실 천장으로 번짐', '거실 천장 · 보통', x))
    if lv:
        sel = [(lv[0], {'ceil', 'wall'})] + ([(kt[0], {'ceil'})] if kt else [])
        x = leak_calc(sel, I, 3, 'unknown')
        if x: out.append(('원인 모를 누수 · 거실' + ('·주방' if kt else '') + ' 천장과 벽', '탐지 포함 · 심함', x))
    if bd:
        x = leak_calc([(bd[0], {'wall', 'floor'})], I, 2, 'up')
        if x: out.append((f"{bd[0]['name']} 벽·마루 바닥까지 젖음", '강마루 교체 · 보통', x))
    if ba:
        x = leak_calc([(ba[0], {'ceil'})], I, 2, 'mybath')
        if x: out.append(('우리 욕실 방수 불량 · 아랫집 욕실 천장', '방수 재시공 포함', x))
    return out


A_SETS = {
    'rent': [('도배', 1), ('바닥', .5), ('전기·조명', .4), ('욕실·타일', .15), ('도장', .5)],
    'basic': [('철거·준비', 1), ('도배', 1), ('바닥', 1), ('욕실·타일', 1), ('주방', 1), ('전기·조명', 1), ('필름', 1), ('도장', 1)],
    'full': [('철거·준비', 1), ('샷시', 1), ('설비', 1), ('전기·조명', 1), ('목공', 1), ('욕실·타일', 1), ('도장', 1), ('도배', 1), ('바닥', 1), ('주방', 1), ('문·현관', 1), ('필름', 1), ('베란다', 1)],
}
A_GOAL = {'rent': '임대 놓기', 'basic': '기본 수리', 'full': '올수리'}
A_DAYS = {'rent': '5~7일', 'basic': '3~4주', 'full': '5~6주'}


def auction_calc(t, pr, year, goal, cond=2):
    """auction/index.html calc() 와 같은 규칙"""
    A = max(20, float(t.get('전용') or 84)); py = round(A / 2.5 * 10) / 10; age = max(0, NOW_Y - int(year or 2000))
    T = pr['trades']; st = list(A_SETS[goal])
    if goal == 'basic' and age >= 25: st.append(('설비', 1))
    if goal == 'rent' and age >= 20: st.append(('욕실·타일', .25))
    nb = ((t.get('plan') or {}).get('sum') or {}).get('욕실') or len([r for r in rooms_of(t) if r.get('kind') == '욕실'])
    lo = mid = hi = 0
    for k, m in st:
        if k not in T: continue
        if k == '욕실·타일' and nb: m *= min(1.5, max(.5, nb / 2))
        x = T[k]
        q = [x['p25'] * .85, x['p25'], x['p50']] if cond == 1 else [x['p50'], x['p75'], x['p75'] * 1.15] if cond == 3 else [x['p25'], x['p50'], x['p75']]
        lo += q[0] * m * py; mid += q[1] * m * py; hi += q[2] * m * py
    lo += py * 15000; mid += py * 20000; hi += py * 25000
    sash = T['샷시']['p50'] * py if (goal == 'basic' and age >= 25 and '샷시' in T) else 0
    return {'lo': lo, 'mid': mid, 'hi': hi, 'py': py, 'age': age, 'sash': sash}


def age_notes(year, hh):
    """연식·세대 수로 이 단지에서 먼저 볼 곳 — 단지마다 다른 글"""
    try: y = int(year)
    except Exception: y = 0
    age = NOW_Y - y if y else 0
    n = []
    if age >= 30:
        n += [f"{y}년 사용승인, {age}년 차 단지입니다. 급수·난방 배관이 처음 그대로인 집이 많아 올수리 때 설비(배관 교체)와 전기 배선 점검을 같이 보는 편이 안전합니다.",
              "이 연식의 샷시는 단열이 약해 결로·곰팡이가 잦습니다. 샷시를 바꾸지 않으면 베란다 쪽 벽 곰팡이 처리부터 확인하세요.",
              "욕실은 바닥 방수층이 낡아 아랫집 누수 민원이 나기 쉬운 시기입니다. 욕실을 뜯는다면 방수를 새로 하고 물 채움 시험까지 받으세요.",
              "1990년대 중반 이전 단지는 천장·벽 마감재에 석면이 쓰였을 수 있어, 철거 전에 관리사무소에 석면 조사 이력을 물어보세요."]
    elif age >= 20:
        n += [f"{y}년 사용승인, {age}년 차 단지입니다. 욕실·주방 같은 물 쓰는 곳이 손볼 때가 됐고, 난방 분배기와 보일러 교체 시기도 겹칩니다.",
              "샷시는 상태를 보고 정합니다. 바꾸면 위 금액에 샷시 금액이 더해집니다.",
              "욕실을 뜯는 공사라면 방수를 새로 하는 편이 아랫집 누수 분쟁을 막는 길입니다."]
    elif age >= 10:
        n += [f"{y}년 사용승인, {age}년 차 단지입니다. 배관·샷시는 대개 쓸 만해 도배·바닥·조명·주방 위주의 부분 수리로도 충분한 집이 많습니다.",
              "욕실은 타일 위 덧방이나 도기 교체로 비용을 줄일 수 있는지 먼저 보세요."]
    elif y:
        n += [f"{y}년 사용승인, {age}년 차 신축급 단지입니다. 하자 보수 기간(마감 2년, 방수 3년 등)이 남았을 수 있으니 공사 전에 하자 접수부터 하세요.",
              "새 아파트는 철거가 적어 도배·바닥 교체보다 조명·가구·필름 위주로 꾸미는 경우가 많습니다."]
    try: h = int(hh or 0)
    except Exception: h = 0
    if h >= 1000:
        n.append(f"{h:,}세대 대단지라 관리사무소 공사 신고, 엘리베이터 보양, 이웃 동의서 절차가 정해져 있는 경우가 많습니다. 공사 시간(보통 평일 9~18시)도 미리 확인하세요.")
    elif h:
        n.append("공사 전 관리사무소에 공사 신고와 엘리베이터 사용 신고를 하고, 같은 라인 이웃에게 공사 안내문을 붙이세요.")
    return n


def near_cases(loc, cases):
    sido, rest = (loc.split(" ", 1) + [""])[:2]
    key = rest[:2]
    hit = [c for c in cases if c['region'].startswith(sido) and c['region'].split(" ", 1)[-1][:2] == key and c.get('file')]
    return hit[:3]


def plan_svg(p):
    g = p.get('그림') or {}
    f = g.get('틀')
    if f:
        x0, y0, w, h = f[0] - 12, f[1] - 12, f[2] - f[0] + 24, f[3] - f[1] + 24
    else:
        x0, y0, w, h = 0, 0, p.get('W', 800), p.get('H', 600)
    s = [f'<svg viewBox="{x0:.0f} {y0:.0f} {w:.0f} {h:.0f}" role="img" aria-label="평면도">']
    for r in p.get('rooms') or []:
        pts = " ".join(f"{q[0]},{q[1]}" for q in r['pts'])
        s.append(f'<polygon points="{pts}" fill="{FILL.get(r.get("kind"), "#FFFFFF")}" stroke="#DCDFD8" stroke-width="1"/>')
    if g.get('벽'):
        s.append(f'<path d="{esc(g["벽"])}" fill="#1C1F1B" fill-rule="{esc(g.get("벽채움") or "nonzero")}"/>')
    for a in g.get('샷시') or []:
        s.append(f'<rect x="{min(a[1], a[3])}" y="{min(a[2], a[4])}" width="{abs(a[3] - a[1])}" height="{abs(a[4] - a[2])}" fill="#fff" stroke="#6B7067" stroke-width="1.5"/>')
    fs = w / 46
    for r in p.get('rooms') or []:
        if not (r.get('area', 0) > 3):
            continue
        xs = [q[0] for q in r['pts']]; ys = [q[1] for q in r['pts']]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        if len(r['pts']) > 4:
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        s.append(f'<text x="{cx:.0f}" y="{cy - 3:.0f}" text-anchor="middle" font-size="{fs:.1f}" font-weight="600" fill="#1C1F1B">{esc(r["name"])}</text>'
                 f'<text x="{cx:.0f}" y="{cy + w / 52 + 2:.0f}" text-anchor="middle" font-size="{fs * .8:.1f}" fill="#6B7067">{r["area"]:.1f}㎡</text>')
    s.append('</svg>')
    return "".join(s)


def head(url, title, desc, ld, depth, kw=""):
    up = "../" * depth
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="keywords" content="{esc(kw)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="집지니 · 집에서 나가는 돈을 줄입니다">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}og-cover.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFFFFF">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{up}assets/home/home.css?v=20261116c">
<link rel="stylesheet" href="{up}assets/apt/apt.css?v=20261117c">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-35EM7T3M9W"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());(function(){{try{{if(localStorage.getItem('jj_staff'))window['ga-disable-G-35EM7T3M9W']=true}}catch(e){{}}}})();gtag('config','G-35EM7T3M9W');</script>
{"".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)}
</head>
<body>
<header class="top">
  <a href="{up}" class="brand"><span class="mark">집</span>집지니<small class="btag">집에서 나가는 돈을 줄입니다</small></a>
  <nav class="links"><a href="{up}#f1">우리 집 공사비</a><a href="{up}apt/">아파트별 공사비</a><a href="{up}compare/">견적서 검토</a><a href="{up}req/" class="go">무료 견적</a></nav>
</header>
"""


def foot(depth):
    up = "../" * depth
    return f"""<footer class="foot">
  <div class="fl"><a href="{up}apt/">아파트별 공사비</a><a href="{up}pricing.html">가격</a><a href="{up}cases/">견적 사례</a><a href="{up}showroom.html">샘플실</a><a href="{up}faq.html">자주 묻는 질문</a></div>
  <p class="fid"><b>집지니 — 집에서 나가는 돈을 줄여 주는 지니.</b> 공사비·관리비·수선비를 데이터로 계산하고 비교해서 줄입니다. 평면도와 건물 도형에서 물량을 세고, 그 숫자대로 공사까지 진행합니다.</p>
  <p>© {TODAY[:4]} 집지니. 서울, 경기, 인천. 대표 박찬영, 사업자등록번호 874-10-00088</p>
</footer>
</body>
</html>
"""


def crumb(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}


def faq(qa):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qa]}


def complex_ld(name, loc, dong, hh, url):
    sido, rest = (loc.split(" ", 1) + [""])[:2]
    x = {"@context": "https://schema.org", "@type": "ApartmentComplex", "name": name, "url": url,
         "address": {"@type": "PostalAddress", "addressCountry": "KR", "addressRegion": SIDO.get(sido, sido), "addressLocality": rest, "streetAddress": dong}}
    try:
        if int(hh or 0): x["numberOfAccommodationUnits"] = int(hh)
    except Exception: pass
    return x


def type_page(code, row, d, t, pr, nq, siblings, cases=()):
    name, loc, dong, year, hh = d['단지'], row[2], row[3], row[4], row[5]
    tn = str(t['이름']); e = float(t.get('전용') or 0); sm = (t.get('plan') or {}).get('sum') or {}
    py, rows, base, full = cost(t, pr)
    turn = base[1] / 0.7
    rate = codi_rate(base[1]); codi = max(750000, base[1] * rate) if base[1] <= 5e6 else base[1] * rate
    url = f"{SITE}apt/{code}/{slug(tn)}.html"
    # 2026-11-17 대표 「셀인 반셀인 등 주요 키워드 넣어서」 — 제목·설명·검색어·소제목·자주 묻는 질문에 셀인·반셀인·직영·셀프 인테리어·올수리·리모델링
    title = f"{name} {tn} 인테리어 비용 {man(base[1])} — 셀인대행·반셀프 인테리어·올수리 | 집지니"
    desc = f"{loc} {dong} {name} {tn}(전용 {e:.1f}㎡) 올수리 리모델링 예상 {man(base[1])}(낮게 {man(base[0])} ~ 높게 {man(base[2])}, 부가세 별도). 셀인·셀인대행·반셀프 인테리어(반셀인)·직영 비용 비교, 누수 복구비·경매 수리비, 집지니 도면."
    kw = ", ".join([f"{name} 인테리어", f"{name} {tn} 인테리어 비용", f"{name} 올수리", f"{name} 리모델링", f"{name} 셀인", f"{name} 셀인대행", f"{name} 반셀인", f"{name} 반셀프 인테리어", f"{name} 셀프 인테리어", f"{name} 누수", f"{name} 경매 수리비", f"{name} 도면", f"{py:.0f}평 인테리어 비용", "셀인", "셀인대행", "반셀인", "반셀프 인테리어", "셀프 인테리어", "직영 인테리어", "올수리 비용", "누수 복구 비용", "경매 수리비", "인테리어 견적"])
    I = pr['items']; LK = leak_cases(t, I); AU = {g: auction_calc(t, pr, year, g) for g in ('rent', 'basic', 'full')}
    big = max([r for r in rows if not r[3]], key=lambda r: r[2]); share = big[2] / base[1] * 100 if base[1] else 0
    others = [x for x in siblings if x is not t]
    near = min(others, key=lambda x: abs(float(x.get('전용') or 0) - e)) if others else None
    notes = age_notes(year, hh)
    cs = near_cases(loc, cases)
    ans = (f"{name} {tn}(전용 {e:.1f}㎡, 공급 약 {py:.0f}평)을 샷시·필름·베란다 없이 올수리하면 약 {man(base[1])}, 샷시까지 하면 약 {man(full[1])}입니다(부가세 별도). "
           f"가장 큰 몫은 {big[0]}로 약 {man(big[2])}({share:.0f}%)입니다. "
           f"업체에 통째로 맡기는 턴키는 약 {man(turn)}로 추정되고, 셀인대행(반셀프 인테리어)으로 기술자·자재상과 직접 거래하면 공사비 {man(base[1])}에 코디비 약 {man(codi)}만 더 듭니다.")
    if LK: ans += f" 누수 복구는 {LK[0][0]} 기준 약 {man(LK[0][2]['tot'])}, 경매 낙찰 뒤 기본 수리는 약 {man(AU['basic']['mid'])}입니다."
    qa = [(f"{name} {tn} 올수리 인테리어 비용은 얼마인가요?", f"샷시·필름·베란다를 뺀 올수리 기본은 약 {man(base[1])}(낮게 {man(base[0])} ~ 높게 {man(base[2])}), 샷시까지 포함하면 약 {man(full[1])}입니다. 집지니 실제 견적 {nq}건의 평당 금액 가운데값에 공급 약 {py:.0f}평을 곱한 어림값이며 부가세 10% 별도입니다."),
          (f"{name} {tn} 도면은 어디서 보나요?", "이 쪽 위의 도면은 집지니가 단지 평면도를 다시 그린 것입니다. 집지니 CAD에서 같은 도면으로 도배·바닥·타일 물량을 직접 뽑아 볼 수 있습니다."),
          (f"{name} {tn} 셀인(셀프 인테리어)으로 하면 어떻게 하나요?", f"셀인은 기술자·자재를 직접 구해 진행하는 방식입니다. 집지니 CAD에서 이 집 도면으로 도배·바닥·타일 물량을 무료로 뽑고, 공종별 예상 금액({man(base[1])} 기준)을 보며 업체 견적과 비교할 수 있습니다."),
          (f"{name} {tn} 반셀인(반셀프)은 비용이 얼마인가요?", f"반셀인은 공사비를 기술자·자재상에게 직접 내고 집지니에는 코디비만 내는 방식입니다. 이 집 올수리 기본 {man(base[1])}이면 코디비는 정찰제로 약 {man(codi)}({rate * 100:.1f}%)입니다. 견적·업체 연결·공정표를 집지니가 맡습니다."),
          (f"{name} {tn} 셀인대행은 무엇이고 반셀프 인테리어와 같은가요?", "셀인대행은 셀프 인테리어를 대신 챙겨 주는 방식으로, 반셀프 인테리어(반셀인)와 같은 뜻으로 씁니다. 공사비는 기술자·자재상에게 바로 내고, 집지니는 견적 검증·업체 연결·공정 관리를 맡아 정찰제 코디비만 받습니다. 업체 마진(보통 30% 안팎)이 빠집니다."),
          ] + ([(f"{name} {tn} 누수 복구 비용은 얼마인가요?", f"이 평형 도면 기준으로 {LK[0][0]}이면 약 {man(LK[0][2]['tot'])}, " + (f"{LK[1][0]}이면 약 {man(LK[1][2]['tot'])}" if len(LK) > 1 else "") + "입니다(부가세 별도). 건조·석고·도배·바닥을 실제 단가로 계산한 값이며, 윗집 원인이면 그 집 보험(일상배상책임)으로 처리하는 경우가 많습니다.")] if LK else []) + [
          (f"{name} {tn} 경매로 낙찰받으면 수리비가 얼마나 드나요?", f"안을 못 본 상태(보통)로 잡으면 임대 놓기 {man(AU['rent']['lo'])}~{man(AU['rent']['hi'])}, 기본 수리 {man(AU['basic']['lo'])}~{man(AU['basic']['hi'])}, 올수리 {man(AU['full']['lo'])}~{man(AU['full']['hi'])}입니다(부가세 별도, 입주 청소 포함). 입찰 상한은 수리 뒤 시세에서 높은 쪽 수리비를 빼서 정하세요."),
          ("정확한 견적서는 어떻게 받나요?", "무료 견적을 신청하시면 이 집 도면 기준으로 공종별 견적서를 24시간 안에 보내 드립니다. 실측 뒤 금액을 확정합니다.")]
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", SITE + "apt/"), (name, f"{SITE}apt/{code}/"), (tn, url)]), faq(qa),
          complex_ld(name, loc, dong, hh, f"{SITE}apt/{code}/"),
          {"@context": "https://schema.org", "@type": "Service", "name": f"{name} {tn} 인테리어 올수리 (셀인대행·반셀프 인테리어)", "serviceType": "아파트 인테리어 리모델링",
           "provider": {"@type": "HomeAndConstructionBusiness", "name": "집지니", "url": SITE}, "areaServed": f"{loc} {dong}", "url": url, "description": ans,
           "offers": {"@type": "AggregateOffer", "priceCurrency": "KRW", "lowPrice": int(round(base[0], -4)), "highPrice": int(round(base[2], -4)), "offerCount": 3,
                      "priceSpecification": {"@type": "PriceSpecification", "priceCurrency": "KRW", "price": int(round(base[1], -4)), "valueAddedTaxIncluded": False}}}]
    tr = "".join(f'<tr{" class=off" if off else ""}><td>{esc(k)}{" <small>기본 제외</small>" if off else ""}</td><td class=n>{p50:,}원</td><td class=n><b>{man(v)}</b></td></tr>' for k, p50, v, off in rows)
    sib = "".join(f'<a href="{slug(x["이름"])}.html"{" aria-current=page" if x is t else ""}>{esc(x["이름"])} <small>{float(x.get("전용") or 0):.0f}㎡</small></a>' for x in siblings)
    w = lambda v: max(4, round(v / turn * 100))
    near_txt = ""
    if near is not None:
        nb = cost(near, pr)[2][1]; df = base[1] - nb
        near_txt = f' 같은 단지 <a href="{slug(near["이름"])}.html">{esc(near["이름"])}</a>(전용 {float(near.get("전용") or 0):.0f}㎡)는 약 {man(nb)}로 이 평형보다 {man(abs(df))} {"적게" if df > 0 else "더"} 듭니다.' if abs(df) >= 10000 else f' 같은 단지 <a href="{slug(near["이름"])}.html">{esc(near["이름"])}</a>와 금액이 거의 같습니다.'
    tq = esc(tn)
    leak_html = ""
    if LK:
        leak_html = (f'<section><h2>{esc(name)} {esc(tn)} 누수 복구 비용</h2>'
                     f'<p class="note" style="margin-top:0">이 평형 도면의 방 크기로 흔한 누수 네 경우를 계산했습니다. 건조·석고보드·도배·바닥·폐기물까지 집지니 실견적 단가, 부가세 별도.</p>'
                     '<table class="tb"><thead><tr><th>경우</th><th class=n>기간</th><th class=n>복구 비용</th></tr></thead><tbody>'
                     + "".join(f'<tr><td>{esc(a)} <small>{esc(b)}</small></td><td class=n>약 {x["days"]}일</td><td class=n><b>{man(x["tot"])}</b></td></tr>' for a, b, x in LK)
                     + f'</tbody></table><div class="cta"><a href="../../leak/?apt={code}&amp;t={tq}">우리 집 젖은 곳으로 다시 계산<small>누수 복구 공사비 산정서 · 무료</small></a><a href="leak.html">{esc(name)} 평형별 누수 비용</a></div></section>')
    auc_html = (f'<section><h2>{esc(name)} {esc(tn)} 경매 낙찰 전 수리비</h2>'
                f'<p class="note" style="margin-top:0">안을 못 본 경매 물건은 한 값이 아니라 범위로 봅니다. 상태 「보통」, 입주 청소 포함, 부가세 별도. {AU["basic"]["age"]}년 차 기준.</p>'
                '<table class="tb"><thead><tr><th>수리 단계</th><th class=n>기간</th><th class=n>가운데 값</th><th class=n>범위</th></tr></thead><tbody>'
                + "".join(f'<tr><td>{A_GOAL[g]}</td><td class=n>{A_DAYS[g]}</td><td class=n><b>{man(AU[g]["mid"])}</b></td><td class=n>{man(AU[g]["lo"])} ~ {man(AU[g]["hi"])}</td></tr>' for g in ('rent', 'basic', 'full'))
                + '</tbody></table>'
                + (f'<p class="note">{AU["basic"]["age"]}년 차라 기본 수리에 설비를 넣었습니다. 샷시를 바꾸면 약 {man(AU["basic"]["sash"])}이 더 듭니다.</p>' if AU['basic']['sash'] else '')
                + f'<div class="cta"><a href="../../auction/?apt={code}&amp;t={tq}">입찰 상한·총 취득원가 계산<small>감정평가서 올리면 자동 · 무료</small></a><a href="auction.html">{esc(name)} 평형별 경매 수리비</a></div></section>')
    case_html = ""
    if cs:
        case_html = ('<section><h2>가까운 지역 집지니 실제 견적</h2><table class="tb"><tbody>'
                     + "".join(f'<tr><td><a href="../../{esc(c["file"])}">{esc(c["region"])} {c["py"]}평 · {esc(c["method"])}</a></td><td class=n><b>{man(c["total"])}</b></td></tr>' for c in cs)
                     + '</tbody></table></section>')
    body = f"""<main class="ap">
<nav class="crumb"><a href="../">아파트별 공사비</a> › <span>{esc(loc)}</span> › <a href="./">{esc(name)}</a> › <span>{esc(tn)}</span></nav>
<h1>{esc(name)} {esc(tn)} 인테리어 비용</h1>
<p class="kw">올수리 · 리모델링 · 셀인 · 셀인대행 · 반셀프 인테리어 · 직영 · 누수 복구 · 경매 수리비</p>
<p class="sub">{esc(loc)} {esc(dong)} · {esc(year)}년 · {int(hh or 0):,}세대 · 전용 {e:.1f}㎡ · 공급 약 {py:.0f}평 · 방 {sm.get('방', '-')} · 욕실 {sm.get('욕실', '-')}</p>
<p class="ans">{esc(ans)}</p>
<div class="types">{sib}</div>
<section class="hero">
  <figure class="plan">{plan_svg(t['plan'])}<figcaption>집지니가 다시 그린 {esc(name)} {esc(tn)} 도면</figcaption></figure>
  <div class="cost">
    <p class="k">올수리 기본 예상 공사비 <small>샷시·필름·베란다 제외 · 부가세 10% 별도</small></p>
    <p class="big">{man(base[1])}</p>
    <p class="rng">낮게 {man(base[0])} ~ 높게 {man(base[2])} · 샷시까지 하면 약 {man(full[1])}</p>
    <ul class="bars">
      <li><span>같은 범위를 턴키 업체에 맡기면 (추정)</span><b>{man(turn)}</b><i style="width:100%"></i></li>
      <li class="me"><span>집지니로 직접 거래하면</span><b>{man(base[1])}</b><i style="width:{w(base[1])}%"></i></li>
    </ul>
    <div class="cta"><a class="go" href="../../req/?apt={code}&amp;t={esc(tn)}">이 집 도면으로 견적서 받기<small>무료 · 24시간 안에</small></a><a href="../../cad.html?apt={code}">도면에서 물량 직접 뽑기<small>집지니 CAD · 무료</small></a></div>
  </div>
</section>
<section>
  <h2>공종별 예상 금액</h2>
  <table class="tb"><thead><tr><th>공종</th><th class=n>평당 (실견적 가운데값)</th><th class=n>이 집 (공급 {py:.0f}평)</th></tr></thead><tbody>{tr}</tbody></table>
  <p class="note">이 집에서 가장 큰 몫은 {esc(big[0])} 약 {man(big[2])}로 올수리 기본의 {share:.0f}%입니다.{near_txt}</p>
</section>
<section>
  <h2>{esc(name)} 공사 전에 먼저 볼 곳</h2>
  <ul class="pts">{"".join(f"<li>{esc(x)}</li>" for x in notes)}</ul>
</section>
{leak_html}
{auc_html}
{case_html}
<section>
  <h2>셀인·셀인대행(반셀프 인테리어)·직영 비용 비교</h2>
  <table class="tb way"><tbody>
    <tr><th>셀인 (셀프 인테리어)</th><td>집지니 CAD로 이 도면의 도배·바닥·타일 물량을 직접 뽑고 자재를 사서 진행합니다. 도구는 무료입니다.</td></tr>
    <tr><th>셀인대행 · 반셀인 (반셀프 인테리어)</th><td>공사비 {man(base[1])}은 기술자·자재상에게 직접 내고, 집지니에는 코디비 약 {man(codi)}({rate * 100:.1f}%, 정찰제)만 냅니다. 견적·업체 연결·공정표를 집지니가 맡습니다.</td></tr>
    <tr><th>직영 인테리어 (맡기기)</th><td>현장관리(PM)까지 맡기시면 공사 기간 매일 현장을 챙깁니다. 금액은 견적서에서 따로 보여 드립니다.</td></tr>
  </tbody></table>
</section>
<section class="qa"><h2>자주 묻는 질문</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)}</p>" for q, a in qa)}</section>
<p class="note"><a href="../../self-interior-agency.html">셀인대행이란</a> · <a href="../../pricing.html">코디비 정찰가</a><br>금액은 집지니 실제 견적 {nq}건의 공종별 평당 금액 가운데값에 이 집 공급 평수(공급 면적 또는 전용 × 1.32)를 곱한 어림값입니다. 자재 등급·현장 상태에 따라 달라지며 실측 뒤 확정합니다. 턴키 금액은 같은 범위를 업체에 맡길 때를 30% 높게 본 추정입니다. 도면은 단지 평면도를 집지니 방식으로 다시 그린 것입니다. {TODAY} 기준.</p>
</main>
"""
    rec = {"url": url, "단지": name, "평형": tn, "전용": e, "공급평": round(py, 1), "올수리기본": int(round(base[1], -4)), "낮게": int(round(base[0], -4)), "높게": int(round(base[2], -4)),
           "샷시포함": int(round(full[1], -4)), "코디비": int(round(codi, -4)), "턴키추정": int(round(turn, -4)),
           "누수": [[a, int(round(x["tot"], -4))] for a, _b, x in LK], "경매": {A_GOAL[g]: [int(round(AU[g]["lo"], -4)), int(round(AU[g]["mid"], -4)), int(round(AU[g]["hi"], -4))] for g in AU}}
    return url, head(url, title, desc, ld, 2, kw) + body + foot(2), rec


ACB = None
def acb_key(code):
    """아관비(관리비 비교) 자료 파일 이름 — data/acb/index.json (2026-11-21)"""
    global ACB
    if ACB is None:
        p = os.path.join(ROOT, "data", "acb", "index.json")
        ACB = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    e = ACB.get(code)
    return e[5] if e else None


def acb_html(code, depth):
    k = acb_key(code)
    if not k:
        return ""
    up = "../" * depth
    return (f'<section class="acb" data-c="{code}" data-f="{esc(k)}" data-root="{up}"></section>'
            f'<link rel="stylesheet" href="{up}assets/acb/acb.css?v=20261122d"><script src="{up}assets/acb/acb.js?v=20261122d" defer></script>')


def apt_page(code, row, d, pr, nq):
    name, loc, dong, year, hh = d['단지'], row[2], row[3], row[4], row[5]
    ts = d['평형']
    items = []
    for t in ts:
        py, rows, base, full = cost(t, pr)
        sm = (t.get('plan') or {}).get('sum') or {}
        items.append((t, base, full, sm))
    lo = min(b[1] for _, b, _, _ in items); hi = max(b[1] for _, b, _, _ in items)
    url = f"{SITE}apt/{code}/"
    rng = man(lo) if lo == hi else f"{man(lo)} ~ {man(hi)}"
    title = f"{name} 인테리어 비용 {rng} — 평형별 셀인대행·반셀프 인테리어 | 집지니"
    desc = f"{loc} {dong} {name}({year}년, {int(hh or 0):,}세대) 평형별 올수리 리모델링 예상 공사비 {rng}(부가세 별도). 셀인·셀인대행·반셀프 인테리어·직영 비용, 누수 복구비·경매 수리비와 집지니 도면."
    kw = ", ".join([f"{name} 인테리어", f"{name} 인테리어 비용", f"{name} 올수리", f"{name} 리모델링", f"{name} 셀인", f"{name} 셀인대행", f"{name} 반셀인", f"{name} 반셀프 인테리어", f"{name} 누수", f"{name} 경매", f"{name} 도면", f"{name} 평면도"] + [f"{name} {t['이름']} 인테리어" for t in ts[:6]] + ["셀인", "셀인대행", "반셀인", "반셀프 인테리어", "셀프 인테리어", "직영 인테리어", "올수리 비용"])
    ans = f"{name}({loc} {dong}, {year}년, {int(hh or 0):,}세대)은 집지니 도면이 있는 평형 {len(ts)}개의 올수리 기본 예상 공사비가 {rng}입니다(샷시·필름·베란다 제외, 부가세 별도). 셀인대행(반셀프 인테리어)으로 직접 거래하면 업체 턴키보다 약 30% 적게 듭니다."
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", SITE + "apt/"), (name, url)]), complex_ld(name, loc, dong, hh, url)]
    tr = "".join(f'<tr><td><a href="{slug(t["이름"])}.html"><b>{esc(t["이름"])}</b></a></td><td class=n>{float(t.get("전용") or 0):.1f}㎡</td><td class=n>{sm.get("방", "-")} / {sm.get("욕실", "-")}</td><td class=n><b>{man(b[1])}</b></td><td class=n>{man(f[1])}</td></tr>' for t, b, f, sm in items)
    body = f"""<main class="ap">
<nav class="crumb"><a href="../">아파트별 공사비</a> › <span>{esc(loc)}</span> › <span>{esc(name)}</span></nav>
<h1>{esc(name)} 인테리어 비용</h1>
<p class="kw">평형별 올수리 · 리모델링 · 셀인 · 셀인대행 · 반셀프 인테리어 · 직영 · 누수 · 경매 수리비</p>
<p class="sub">{esc(loc)} {esc(dong)} · {esc(year)}년 · {int(hh or 0):,}세대 · 집지니 도면 {len(ts)}개 평형</p>
<p class="ans">{esc(ans)}</p>
<section>
  <table class="tb"><thead><tr><th>평형</th><th class=n>전용</th><th class=n>방 / 욕실</th><th class=n>올수리 기본</th><th class=n>샷시 포함</th></tr></thead><tbody>{tr}</tbody></table>
  <p class="note">올수리 기본은 샷시·필름·베란다를 뺀 금액, 부가세 10% 별도. 평형을 누르면 도면과 공종별 금액, 셀인(셀프 인테리어)·반셀인(반셀프)·직영 인테리어로 할 때의 비용이 나옵니다.</p>
  <div class="cta"><a class="go" href="../../req/?apt={code}">우리 집 견적서 받기<small>무료 · 24시간 안에</small></a><a href="../../?apt={code}#f1">첫 화면 계산기에서 공사 빼 보기</a></div>
</section>
{acb_html(code, 2)}
<section>
  <h2>{esc(name)} 공사 전에 먼저 볼 곳</h2>
  <ul class="pts">{"".join(f"<li>{esc(x)}</li>" for x in age_notes(year, hh))}</ul>
</section>
<section>
  <h2>누수 · 경매</h2>
  <table class="tb way"><tbody>
    {('<tr><th><a href="leak.html">누수 복구 비용</a></th><td>' + esc(name) + ' 평형마다 윗집 누수, 원인 모를 누수, 마루까지 젖은 경우, 우리 욕실 방수 불량일 때의 복구 비용.</td></tr>') if has_leak(d, pr) else ""}
    <tr><th><a href="auction.html">경매 수리비</a></th><td>{esc(name)}을 경매로 낙찰받을 때 임대 놓기·기본 수리·올수리 단계별 수리비 범위.</td></tr>
  </tbody></table>
</section>
</main>
"""
    return url, head(url, title, desc, ld, 2, kw) + body + foot(2)


def has_leak(d, pr):
    """이 단지에 누수 쪽(leak.html)이 만들어지는가 — 없으면 링크도 걸지 않는다."""
    return any(leak_cases(t, pr['items']) for t in d['평형'])


def leak_apt_page(code, row, d, pr):
    name, loc, dong, year, hh = d['단지'], row[2], row[3], row[4], row[5]
    I = pr['items']; url = f"{SITE}apt/{code}/leak.html"
    rows, allv = [], []
    for t in d['평형']:
        LK = leak_cases(t, I)
        if not LK: continue
        allv += [x['tot'] for _a, _b, x in LK]
        rows.append((t, LK))
    if not rows: return None
    lo, hi = min(allv), max(allv)
    title = f"{name} 누수 복구 비용 {man(lo)}~{man(hi)} — 평형별 천장·벽·바닥·욕실 방수 | 집지니"
    desc = f"{loc} {dong} {name} 누수 복구 공사비를 평형 도면으로 계산했습니다. 윗집 누수 천장 도배, 원인 모를 누수 탐지, 마루 교체, 욕실 방수 재시공 {man(lo)}~{man(hi)}(부가세 별도)."
    kw = ", ".join([f"{name} 누수", f"{name} 누수 비용", f"{name} 누수 복구", f"{name} 천장 누수", f"{name} 욕실 방수", "아파트 누수 복구 비용", "윗집 누수 도배", "누수 탐지 비용", "욕실 방수 비용", "누수 보험 견적"])
    ans = f"{name} 누수 복구 비용은 평형과 젖은 범위에 따라 약 {man(lo)}에서 {man(hi)}입니다(부가세 별도). 거실 천장만 젖은 보통 누수는 건조 3일과 석고·도배로 끝나고, 원인을 모르면 탐지비가, 욕실이 원인이면 방수 재시공비가 더해집니다."
    qa = [(f"{name} 윗집 누수로 천장이 젖으면 복구 비용은 누가 내나요?", "원인 세대가 내는 것이 원칙이고, 그 집의 일상생활배상책임 보험으로 처리하는 경우가 많습니다. 보험사에 낼 산정서는 집지니 누수 복구 공사비 산정서로 바로 만들 수 있습니다."),
          (f"{name} 누수 복구는 며칠 걸리나요?", "젖은 곳을 3~5일 말린 뒤 석고·도배·바닥을 합니다. 마르기 전에 도배하면 곰팡이가 다시 올라옵니다."),
          ("욕실 방수 재시공은 얼마인가요?", f"바닥 타일 철거·액체 방수 2회·타일 재시공·48시간 물 채움 시험까지 약 {man(I['demo_day']['price'] + I['bath_wp']['price'] + 250000 + I['tile_day']['price'] * 1.5 + I['helper_day']['price'])}입니다(욕실 1곳, 부가세 별도).")]
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", SITE + "apt/"), (name, f"{SITE}apt/{code}/"), ("누수 복구 비용", url)]), faq(qa), complex_ld(name, loc, dong, hh, f"{SITE}apt/{code}/")]
    parts = []
    for t, LK in rows:
        tn = str(t['이름'])
        parts.append(f'<h3><a href="{slug(tn)}.html">{esc(tn)}</a> <small>전용 {float(t.get("전용") or 0):.1f}㎡</small></h3><table class="tb"><tbody>'
                     + "".join(f'<tr><td>{esc(a)} <small>{esc(b)}</small></td><td class=n>약 {x["days"]}일</td><td class=n><b>{man(x["tot"])}</b></td></tr>' for a, b, x in LK)
                     + f'</tbody></table><p class="note" style="margin-top:6px"><a href="../../leak/?apt={code}&amp;t={esc(tn)}">{esc(tn)} 도면으로 젖은 곳 골라 산정서 만들기</a></p>')
    body = f"""<main class="ap">
<nav class="crumb"><a href="../">아파트별 공사비</a> › <span>{esc(loc)}</span> › <a href="./">{esc(name)}</a> › <span>누수 복구 비용</span></nav>
<h1>{esc(name)} 누수 복구 비용</h1>
<p class="kw">천장 누수 · 벽 곰팡이 · 마루 교체 · 욕실 방수 · 누수 탐지 · 보험 산정서</p>
<p class="sub">{esc(loc)} {esc(dong)} · {esc(year)}년 · {int(hh or 0):,}세대 · 평형 {len(rows)}개</p>
<p class="ans">{esc(ans)}</p>
<section>{"".join(parts)}</section>
<section class="qa"><h2>자주 묻는 질문</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)}</p>" for q, a in qa)}</section>
<div class="cta"><a class="go" href="../../leak/?apt={code}">누수 복구 공사비 산정서 만들기<small>무료 · 보험 제출용</small></a><a href="auction.html">{esc(name)} 경매 수리비</a></div>
<p class="note">집지니 실견적 단가(도배 기술자 {I['wallpaper_day']['price']:,}원/품, 강마루 {I['floor_maru']['price']:,}원/㎡, 건조기 {I['dry_day']['price']:,}원/일 등)로 이 단지 평형 도면의 방 크기를 넣어 계산했습니다. 현장 상태에 따라 달라지며 부가세 10% 별도. {TODAY} 기준.</p>
</main>
"""
    return url, head(url, title, desc, ld, 2, kw) + body + foot(2)


def auction_apt_page(code, row, d, pr):
    name, loc, dong, year, hh = d['단지'], row[2], row[3], row[4], row[5]
    url = f"{SITE}apt/{code}/auction.html"
    rows = [(t, {g: auction_calc(t, pr, year, g) for g in ('rent', 'basic', 'full')}) for t in d['평형']]
    b = [x['basic']['mid'] for _t, x in rows]; lo, hi = min(b), max(b); age = rows[0][1]['basic']['age']
    rng = man(lo) if man(lo) == man(hi) else f"{man(lo)}~{man(hi)}"
    title = f"{name} 경매 수리비 {rng} — 낙찰 전 임대·기본·올수리 비용 | 집지니"
    desc = f"{loc} {dong} {name}({year}년, {age}년 차) 경매 물건 낙찰 전 수리비. 평형별 임대 놓기·기본 수리·올수리 범위와 입찰 상한 계산(부가세 별도)."
    kw = ", ".join([f"{name} 경매", f"{name} 경매 수리비", f"{name} 낙찰", f"{name} 인테리어 비용", "경매 수리비", "낙찰 후 인테리어", "경매 아파트 수리비", "입찰가 계산", "명도 후 수리"])
    ans = f"{name}을 경매로 낙찰받아 기본 수리(도배·바닥·욕실·주방·전기·필름)를 하면 평형에 따라 약 {rng}입니다(상태 보통, 입주 청소 포함, 부가세 별도). 안을 못 봤다면 높은 쪽 값으로 입찰 상한을 잡으세요."
    qa = [(f"{name} 경매 물건은 수리비를 얼마로 잡아야 하나요?", "안을 볼 수 없으니 한 값이 아니라 임대 놓기·기본 수리·올수리 세 단계 범위로 보고, 입찰 상한에는 높은 쪽 값을 넣습니다."),
          ("입찰 상한은 어떻게 정하나요?", "수리 뒤 시세 − 수리비(높은 값) − 취득세·명도비 등 그 밖의 비용 − 남길 금액이 입찰 상한입니다. 집지니 경매 수리비 계산에서 감정평가서를 올리면 자동으로 계산됩니다."),
          ("밀린 관리비도 떠안나요?", "밀린 관리비 가운데 공용 부분은 낙찰자가 떠안을 수 있습니다. 입찰 전 관리사무소에 체납액을 확인하세요.")]
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", SITE + "apt/"), (name, f"{SITE}apt/{code}/"), ("경매 수리비", url)]), faq(qa), complex_ld(name, loc, dong, hh, f"{SITE}apt/{code}/")]
    tr = "".join(f'<tr><td><a href="{slug(t["이름"])}.html"><b>{esc(t["이름"])}</b></a> <small>{float(t.get("전용") or 0):.0f}㎡</small></td>'
                 + "".join(f'<td class=n>{man(x[g]["mid"])}<small>{man(x[g]["lo"])}~{man(x[g]["hi"])}</small></td>' for g in ('rent', 'basic', 'full'))
                 + f'<td class=n><a href="../../auction/?apt={code}&amp;t={esc(str(t["이름"]))}">계산</a></td></tr>' for t, x in rows)
    body = f"""<main class="ap">
<nav class="crumb"><a href="../">아파트별 공사비</a> › <span>{esc(loc)}</span> › <a href="./">{esc(name)}</a> › <span>경매 수리비</span></nav>
<h1>{esc(name)} 경매 수리비</h1>
<p class="kw">경매 낙찰 전 수리비 · 임대 놓기 · 기본 수리 · 올수리 · 입찰 상한 · 총 취득원가</p>
<p class="sub">{esc(loc)} {esc(dong)} · {esc(year)}년 사용승인 · {age}년 차 · {int(hh or 0):,}세대</p>
<p class="ans">{esc(ans)}</p>
<section>
  <table class="tb"><thead><tr><th>평형</th><th class=n>임대 놓기 · {A_DAYS['rent']}</th><th class=n>기본 수리 · {A_DAYS['basic']}</th><th class=n>올수리 · {A_DAYS['full']}</th><th class=n></th></tr></thead><tbody>{tr}</tbody></table>
  <p class="note">가운데 값 아래 작은 글씨는 범위입니다. 상태 「보통」 기준, 입주 청소 포함, 부가세 10% 별도.</p>
</section>
<section>
  <h2>이 단지 경매 물건에서 먼저 볼 곳</h2>
  <ul class="pts">{"".join(f"<li>{esc(x)}</li>" for x in age_notes(year, hh))}<li>밀린 관리비 가운데 공용 부분은 낙찰자가 떠안을 수 있습니다. 입찰 전 관리사무소에 체납액을 확인하세요.</li></ul>
</section>
<section class="qa"><h2>자주 묻는 질문</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)}</p>" for q, a in qa)}</section>
<div class="cta"><a class="go" href="../../auction/?apt={code}">입찰 상한·총 취득원가 계산<small>감정평가서 올리면 자동 · 무료</small></a>{('<a href="leak.html">' + esc(name) + ' 누수 복구 비용</a>') if has_leak(d, pr) else ""}</div>
<p class="note">집지니 실견적 공종별 평당 금액(낮은 4분의 1·가운데·높은 4분의 1)에 공급 평수(전용 ÷ 2.5)를 곱한 값입니다. {TODAY} 기준.</p>
</main>
"""
    return url, head(url, title, desc, ld, 2, kw) + body + foot(2)


def index_page(groups, n_apt, n_type):
    url = SITE + "apt/"
    title = f"아파트별 인테리어 비용 — 셀인대행·반셀프 인테리어·올수리 {n_apt:,}개 단지 | 집지니"
    desc = f"서울·경기·인천 {n_apt:,}개 단지, {n_type:,}개 평형의 집지니 도면과 올수리 리모델링 예상 공사비. 셀인·셀인대행(반셀프 인테리어)·직영 비용, 누수 복구비와 경매 수리비를 우리 아파트 평형으로 확인하세요."
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", url)])]
    parts = []
    for sido in ['서울', '경기', '인천']:
        gu = groups.get(sido) or {}
        if not gu:
            continue
        parts.append(f'<h2>{SIDO[sido]} <small>{sum(len(v) for v in gu.values()):,}개 단지</small></h2>')
        for g in sorted(gu):
            links = "".join(f'<a href="{c}/">{esc(n)}</a>' for c, n in sorted(gu[g], key=lambda x: x[1]))
            parts.append(f'<div class="gu"><h3>{esc(g)}</h3><p>{links}</p></div>')
    body = f"""<main class="ap">
<h1>아파트별 인테리어 비용</h1>
<p class="sub">서울·경기·인천 {n_apt:,}개 단지 · {n_type:,}개 평형 · 집지니가 다시 그린 도면과 올수리 예상 금액 · 날마다 늘어납니다</p>
<div class="cta"><a class="go" href="../#f1">아파트 이름으로 바로 찾기</a></div>
{"".join(parts)}
</main>
"""
    return head(url, title, desc, ld, 1, "아파트 인테리어 비용, 아파트 올수리 비용, 아파트 리모델링 비용, 셀인, 셀인대행, 반셀인, 셀프 인테리어, 반셀프 인테리어, 직영 인테리어, 아파트 누수 복구 비용, 경매 수리비, 아파트 평면도, 인테리어 견적") + body + foot(1)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old != text:
        open(path, "w", encoding="utf-8").write(text)
        return 1
    return 0


def main():
    op = json.load(open(os.path.join(ROOT, "data", "plans", "open.json"), encoding="utf-8"))
    pr = json.load(open(os.path.join(ROOT, "data", "repair-prices.json"), encoding="utf-8"))
    m = re.search(r"실견적\s*(\d+)건", str(pr.get("source", "")))
    nq = int(m.group(1)) if m else 0
    rq = os.path.join(ROOT, "data", "real-quotes.json")
    cases = json.load(open(rq, encoding="utf-8")).get("cases", []) if os.path.exists(rq) else []
    groups, keep, changed, n_type, made, recs = {}, set(), 0, 0, [], []
    for row in op['목록']:
        code = row[0]
        p = os.path.join(ROOT, "data", "plans", code + ".json")
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding="utf-8"))
        ts = [t for t in d.get('평형') or [] if t.get('plan') and t['plan'].get('rooms')]
        if not ts:
            continue
        d['평형'] = ts
        seen = {"leak", "auction", "index"}
        for t in ts:
            s = slug(t['이름'])
            if s in seen:
                continue
            seen.add(s)
            url, txt, rec = type_page(code, row, d, t, pr, nq, ts, cases)
            rec.update({"단지번호": code, "지역": f"{row[2]} {row[3]}", "사용승인": row[4], "세대": row[5]}); recs.append(rec)
            changed += write(os.path.join(OUT, code, s + ".html"), txt); keep.add(os.path.join(code, s + ".html")); n_type += 1
        url, txt = apt_page(code, row, d, pr, nq)
        changed += write(os.path.join(OUT, code, "index.html"), txt); keep.add(os.path.join(code, "index.html"))
        lp = leak_apt_page(code, row, d, pr)
        if lp:
            changed += write(os.path.join(OUT, code, "leak.html"), lp[1]); keep.add(os.path.join(code, "leak.html"))
        ap = auction_apt_page(code, row, d, pr)
        changed += write(os.path.join(OUT, code, "auction.html"), ap[1]); keep.add(os.path.join(code, "auction.html"))
        sido, gu = (row[2].split(" ", 1) + [""])[:2]
        groups.setdefault(sido, {}).setdefault(gu or sido, []).append((code, d['단지']))
        made.append(code)
    changed += write(os.path.join(OUT, "index.html"), index_page(groups, len(made), n_type)); keep.add("index.html")
    # 닫힌 단지·평형 쪽 지우기
    gone = 0
    for dp, _dn, fns in os.walk(OUT):
        for fn in fns:
            rel = os.path.relpath(os.path.join(dp, fn), OUT)
            if fn.endswith(".html") and rel not in keep:
                os.remove(os.path.join(dp, fn)); gone += 1
    # 기계가 읽는 표 — 인공지능 검색·데이터 인용용 (2026-11-17)
    meta = {"이름": "집지니 아파트별 인테리어 비용", "설명": "수도권 아파트 단지·평형별 올수리 예상 공사비, 셀인대행(반셀프 인테리어) 코디비, 누수 복구비, 경매 수리비. 집지니 실견적 평당 가운데값 × 공급 평수. 원, 부가세 별도.",
            "출처": SITE + "apt/", "기준일": TODAY, "실견적수": nq, "건수": len(recs), "목록": recs}
    changed += write(os.path.join(ROOT, "data", "apt-costs.json"), json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    import io
    b = io.StringIO(); w = csv.writer(b)
    w.writerow(["단지번호", "단지", "지역", "사용승인", "세대", "평형", "전용㎡", "공급평", "올수리기본", "낮게", "높게", "샷시포함", "코디비", "턴키추정", "경매_기본수리", "url"])
    for r in recs:
        w.writerow([r["단지번호"], r["단지"], r["지역"], r["사용승인"], r["세대"], r["평형"], r["전용"], r["공급평"], r["올수리기본"], r["낮게"], r["높게"], r["샷시포함"], r["코디비"], r["턴키추정"], r["경매"]["기본 수리"][1], r["url"]])
    changed += write(os.path.join(ROOT, "data", "apt-costs.csv"), "\ufeff" + b.getvalue())
    print(f"아파트별 쪽: 단지 {len(made):,} · 평형 {n_type:,} · 바뀜 {changed:,} · 지움 {gone}")


if __name__ == "__main__":
    main()
