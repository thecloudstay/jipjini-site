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
import os, re, json, html, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://jipjini.com/"
OUT = os.path.join(ROOT, "apt")
TODAY = datetime.date.today().isoformat()
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
<meta property="og:type" content="website"><meta property="og:site_name" content="집지니 · 인테리어 데이터 솔루션">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}og-cover.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FFFFFF">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{up}assets/home/home.css?v=20261116c">
<link rel="stylesheet" href="{up}assets/apt/apt.css?v=20261117b">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-35EM7T3M9W"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());(function(){{try{{if(localStorage.getItem('jj_staff'))window['ga-disable-G-35EM7T3M9W']=true}}catch(e){{}}}})();gtag('config','G-35EM7T3M9W');</script>
{"".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)}
</head>
<body>
<header class="top">
  <a href="{up}" class="brand"><span class="mark">집</span>집지니<small class="btag">인테리어 데이터 솔루션</small></a>
  <nav class="links"><a href="{up}#f1">우리 집 공사비</a><a href="{up}apt/">아파트별 공사비</a><a href="{up}compare/">견적서 검토</a><a href="{up}req/" class="go">무료 견적</a></nav>
</header>
"""


def foot(depth):
    up = "../" * depth
    return f"""<footer class="foot">
  <div class="fl"><a href="{up}apt/">아파트별 공사비</a><a href="{up}pricing.html">가격</a><a href="{up}cases/">견적 사례</a><a href="{up}showroom.html">샘플실</a><a href="{up}faq.html">자주 묻는 질문</a></div>
  <p class="fid"><b>집지니 — 인테리어 데이터 솔루션 기업.</b> 아파트 평면도를 도면·공정별 물량·공사 자료로 바꾸고, 그 자료로 견적부터 시공 관리까지 합니다.</p>
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


def type_page(code, row, d, t, pr, nq, siblings):
    name, loc, dong, year, hh = d['단지'], row[2], row[3], row[4], row[5]
    tn = str(t['이름']); e = float(t.get('전용') or 0); sm = (t.get('plan') or {}).get('sum') or {}
    py, rows, base, full = cost(t, pr)
    turn = base[1] / 0.7
    rate = codi_rate(base[1]); codi = max(750000, base[1] * rate) if base[1] <= 5e6 else base[1] * rate
    url = f"{SITE}apt/{code}/{slug(tn)}.html"
    # 2026-11-17 대표 「셀인 반셀인 등 주요 키워드 넣어서」 — 제목·설명·검색어·소제목·자주 묻는 질문에 셀인·반셀인·직영·셀프 인테리어·올수리·리모델링
    title = f"{name} {tn} 인테리어 비용 {man(base[1])} — 셀인·반셀인·직영 올수리 | 집지니"
    desc = f"{loc} {dong} {name} {tn}(전용 {e:.1f}㎡) 올수리 리모델링 예상 {man(base[1])}(낮게 {man(base[0])} ~ 높게 {man(base[2])}, 부가세 별도). 셀인(셀프 인테리어)·반셀인(반셀프)·직영 인테리어 비용 비교와 집지니 도면, 공종별 금액."
    kw = ", ".join([f"{name} 인테리어", f"{name} {tn} 인테리어 비용", f"{name} 올수리", f"{name} 리모델링", f"{name} 셀인", f"{name} 반셀인", f"{name} 셀프 인테리어", f"{name} 도면", f"{py:.0f}평 인테리어 비용", "셀인", "반셀인", "셀프 인테리어", "반셀프 인테리어", "직영 인테리어", "올수리 비용", "인테리어 견적"])
    qa = [(f"{name} {tn} 올수리 인테리어 비용은 얼마인가요?", f"샷시·필름·베란다를 뺀 올수리 기본은 약 {man(base[1])}(낮게 {man(base[0])} ~ 높게 {man(base[2])}), 샷시까지 포함하면 약 {man(full[1])}입니다. 집지니 실제 견적 {nq}건의 평당 금액 가운데값에 공급 약 {py:.0f}평을 곱한 어림값이며 부가세 10% 별도입니다."),
          (f"{name} {tn} 도면은 어디서 보나요?", "이 쪽 위의 도면은 집지니가 단지 평면도를 다시 그린 것입니다. 집지니 CAD에서 같은 도면으로 도배·바닥·타일 물량을 직접 뽑아 볼 수 있습니다."),
          (f"{name} {tn} 셀인(셀프 인테리어)으로 하면 어떻게 하나요?", f"셀인은 기술자·자재를 직접 구해 진행하는 방식입니다. 집지니 CAD에서 이 집 도면으로 도배·바닥·타일 물량을 무료로 뽑고, 공종별 예상 금액({man(base[1])} 기준)을 보며 업체 견적과 비교할 수 있습니다."),
          (f"{name} {tn} 반셀인(반셀프)은 비용이 얼마인가요?", f"반셀인은 공사비를 기술자·자재상에게 직접 내고 집지니에는 코디비만 내는 방식입니다. 이 집 올수리 기본 {man(base[1])}이면 코디비는 정찰제로 약 {man(codi)}({rate * 100:.1f}%)입니다. 견적·업체 연결·공정표를 집지니가 맡습니다."),
          ("정확한 견적서는 어떻게 받나요?", "무료 견적을 신청하시면 이 집 도면 기준으로 공종별 견적서를 24시간 안에 보내 드립니다. 실측 뒤 금액을 확정합니다.")]
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", SITE + "apt/"), (name, f"{SITE}apt/{code}/"), (tn, url)]), faq(qa)]
    tr = "".join(f'<tr{" class=off" if off else ""}><td>{esc(k)}{" <small>기본 제외</small>" if off else ""}</td><td class=n>{p50:,}원</td><td class=n><b>{man(v)}</b></td></tr>' for k, p50, v, off in rows)
    sib = "".join(f'<a href="{slug(x["이름"])}.html"{" aria-current=page" if x is t else ""}>{esc(x["이름"])} <small>{float(x.get("전용") or 0):.0f}㎡</small></a>' for x in siblings)
    w = lambda v: max(4, round(v / turn * 100))
    body = f"""<main class="ap">
<nav class="crumb"><a href="../">아파트별 공사비</a> › <span>{esc(loc)}</span> › <a href="./">{esc(name)}</a> › <span>{esc(tn)}</span></nav>
<h1>{esc(name)} {esc(tn)} 인테리어 비용</h1>
<p class="kw">올수리 · 리모델링 · 셀인 · 반셀인 · 직영 인테리어 견적</p>
<p class="sub">{esc(loc)} {esc(dong)} · {esc(year)}년 · {int(hh or 0):,}세대 · 전용 {e:.1f}㎡ · 공급 약 {py:.0f}평 · 방 {sm.get('방', '-')} · 욕실 {sm.get('욕실', '-')}</p>
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
</section>
<section>
  <h2>셀인·반셀인·직영 인테리어 비용 비교</h2>
  <table class="tb way"><tbody>
    <tr><th>셀인 (셀프 인테리어)</th><td>집지니 CAD로 이 도면의 도배·바닥·타일 물량을 직접 뽑고 자재를 사서 진행합니다. 도구는 무료입니다.</td></tr>
    <tr><th>반셀인 (반셀프 · 코디)</th><td>공사비 {man(base[1])}은 기술자·자재상에게 직접 내고, 집지니에는 코디비 약 {man(codi)}({rate * 100:.1f}%, 정찰제)만 냅니다. 견적·업체 연결·공정표를 집지니가 맡습니다.</td></tr>
    <tr><th>직영 인테리어 (맡기기)</th><td>현장관리(PM)까지 맡기시면 공사 기간 매일 현장을 챙깁니다. 금액은 견적서에서 따로 보여 드립니다.</td></tr>
  </tbody></table>
</section>
<section class="qa"><h2>자주 묻는 질문</h2>{"".join(f"<h3>{esc(q)}</h3><p>{esc(a)}</p>" for q, a in qa)}</section>
<p class="note">금액은 집지니 실제 견적 {nq}건의 공종별 평당 금액 가운데값에 이 집 공급 평수(공급 면적 또는 전용 × 1.32)를 곱한 어림값입니다. 자재 등급·현장 상태에 따라 달라지며 실측 뒤 확정합니다. 턴키 금액은 같은 범위를 업체에 맡길 때를 30% 높게 본 추정입니다. 도면은 단지 평면도를 집지니 방식으로 다시 그린 것입니다. {TODAY} 기준.</p>
</main>
"""
    return url, head(url, title, desc, ld, 2, kw) + body + foot(2), base[1]


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
    title = f"{name} 인테리어 비용 {rng} — 평형별 셀인·반셀인·올수리 | 집지니"
    desc = f"{loc} {dong} {name}({year}년, {int(hh or 0):,}세대) 평형별 올수리 리모델링 예상 공사비 {rng}(부가세 별도). 셀인(셀프 인테리어)·반셀인·직영 인테리어 비용과 집지니 도면."
    kw = ", ".join([f"{name} 인테리어", f"{name} 인테리어 비용", f"{name} 올수리", f"{name} 리모델링", f"{name} 셀인", f"{name} 반셀인", f"{name} 도면", f"{name} 평면도"] + [f"{name} {t['이름']} 인테리어" for t in ts[:6]] + ["셀인", "반셀인", "셀프 인테리어", "직영 인테리어", "올수리 비용"])
    ld = [crumb([("집지니", SITE), ("아파트별 공사비", SITE + "apt/"), (name, url)])]
    tr = "".join(f'<tr><td><a href="{slug(t["이름"])}.html"><b>{esc(t["이름"])}</b></a></td><td class=n>{float(t.get("전용") or 0):.1f}㎡</td><td class=n>{sm.get("방", "-")} / {sm.get("욕실", "-")}</td><td class=n><b>{man(b[1])}</b></td><td class=n>{man(f[1])}</td></tr>' for t, b, f, sm in items)
    body = f"""<main class="ap">
<nav class="crumb"><a href="../">아파트별 공사비</a> › <span>{esc(loc)}</span> › <span>{esc(name)}</span></nav>
<h1>{esc(name)} 인테리어 비용</h1>
<p class="kw">평형별 올수리 · 리모델링 · 셀인 · 반셀인 · 직영 인테리어 견적</p>
<p class="sub">{esc(loc)} {esc(dong)} · {esc(year)}년 · {int(hh or 0):,}세대 · 집지니 도면 {len(ts)}개 평형</p>
<section>
  <table class="tb"><thead><tr><th>평형</th><th class=n>전용</th><th class=n>방 / 욕실</th><th class=n>올수리 기본</th><th class=n>샷시 포함</th></tr></thead><tbody>{tr}</tbody></table>
  <p class="note">올수리 기본은 샷시·필름·베란다를 뺀 금액, 부가세 10% 별도. 평형을 누르면 도면과 공종별 금액, 셀인(셀프 인테리어)·반셀인(반셀프)·직영 인테리어로 할 때의 비용이 나옵니다.</p>
  <div class="cta"><a class="go" href="../../req/?apt={code}">우리 집 견적서 받기<small>무료 · 24시간 안에</small></a><a href="../../?apt={code}#f1">첫 화면 계산기에서 공사 빼 보기</a></div>
</section>
</main>
"""
    return url, head(url, title, desc, ld, 1, kw) + body + foot(1)


def index_page(groups, n_apt, n_type):
    url = SITE + "apt/"
    title = f"아파트별 인테리어 비용 — 셀인·반셀인·올수리 {n_apt:,}개 단지 | 집지니"
    desc = f"서울·경기·인천 {n_apt:,}개 단지, {n_type:,}개 평형의 집지니 도면과 올수리 리모델링 예상 공사비. 셀인(셀프 인테리어)·반셀인(반셀프)·직영 인테리어 비용을 우리 아파트 평형으로 확인하세요."
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
    return head(url, title, desc, ld, 1, "아파트 인테리어 비용, 아파트 올수리 비용, 아파트 리모델링 비용, 셀인, 반셀인, 셀프 인테리어, 반셀프 인테리어, 직영 인테리어, 아파트 평면도, 인테리어 견적") + body + foot(1)


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
    groups, keep, changed, n_type, made = {}, set(), 0, 0, []
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
        seen = set()
        for t in ts:
            s = slug(t['이름'])
            if s in seen:
                continue
            seen.add(s)
            url, txt, mid = type_page(code, row, d, t, pr, nq, ts)
            changed += write(os.path.join(OUT, code, s + ".html"), txt); keep.add(os.path.join(code, s + ".html")); n_type += 1
        url, txt = apt_page(code, row, d, pr, nq)
        changed += write(os.path.join(OUT, code, "index.html"), txt); keep.add(os.path.join(code, "index.html"))
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
    print(f"아파트별 쪽: 단지 {len(made):,} · 평형 {n_type:,} · 바뀜 {changed:,} · 지움 {gone}")


if __name__ == "__main__":
    main()
