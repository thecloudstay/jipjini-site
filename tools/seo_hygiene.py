# -*- coding: utf-8 -*-
"""사이트 전체 검색 위생 (2026-10-09) — 공개 쪽 전부에
  · og:image / twitter:card 기본값 (없는 쪽만)
  · 글꼴 서버 미리 연결 (없는 쪽만)
  · 쪽 맨 아래 공통 안내 띠 (<!--SITENAV-->): 시세표·지역별·평형별·공종별·사례·무료 견적 링크 → 고아 쪽 없애고 내부 연결 강화
  · 이미지 alt 빠진 곳 보고
를 적용한다. 바뀐 쪽만 다시 쓴다.  사용: python3 tools/seo_hygiene.py
"""
import os, re, glob, sys, json
from html import unescape as html_unescape
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = ("admin", "console", "assets", "q", "node_modules", ".github", "progress", "measure", "wage")   # progress·measure·wage = 고객·기사 개인 화면 (2026-11-09)
SKIP_FILES = {"quote.html", "client-input.html", "schedule.html", "sign.html", "contract.html", "payment.html", "doc.html", "order.html"}   # 고객 개인 화면
OG = '<meta property="og:image" content="https://jipjini.com/og-cover.png">'
TW = '<meta name="twitter:card" content="summary_large_image">'
PRE = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
START, END = "<!--SITENAV-->", "<!--/SITENAV-->"

GROUPS = [
    ("시작하기", [("index.html", "홈"), ("self-interior-agency.html", "셀인대행이란"), ("request.html", "무료 견적 신청"), ("prepare.html", "사전 준비")]),
    ("집지니 CAD", [("cad.html", "집지니 CAD — 무료 공사 계획 도면")]),
    ("샘플실", [("showroom.html", "가양동 샘플실 · 상담 예약")]),
    ("진행 방식", [("workflow.html", "진행 방식 8단계"), ("interior-coordinator.html", "코디네이터란")]),
    ("가격·견적", [("pricing.html", "가격·코디비"), ("interior-price-table.html", "실견적 시세표"), ("cases/", "견적 사례"), ("py/", "평형별 비용"), ("trade/", "공종별 비용")]),
    ("가이드", [("banself-interior.html", "반셀프 코디"), ("jikyoung-interior.html", "직영 인테리어"), ("interior-margin-30.html", "마진 30%"), ("interior-estimate-compare.html", "견적서 비교"), ("apt-olsuri-cost.html", "32평 올수리"), ("bathroom-remodel-cost.html", "욕실 리모델링"), ("interior-scam-types.html", "사기 유형")]),
    ("회사", [("about.html", "회사소개"), ("faq.html", "자주 묻는 질문"), ("ai-answers.html", "AI에게 물어볼 때"), ("sitemap.html", "사이트 지도")]),
]
NAV_CSS = ('<style>.jj-map{max-width:900px;margin:32px auto 0;padding:22px 16px 26px;border-top:2px solid #d9d2c0;font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#2a2a2a;word-break:keep-all}'
           '.jj-map .ttl{font-size:14px;font-weight:800;letter-spacing:1px;color:#1e4d3a;margin-bottom:10px;text-align:center}'
           '.jj-map .grp{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:6px 0;font-size:14px}'
           '.jj-map .grp b{min-width:70px;color:#555;font-weight:700;font-size:13px}'
           '.jj-map .grp a{display:inline-block;padding:6px 12px;border:1px solid #cfc8b8;border-radius:16px;background:#fff;color:#2a2a2a;text-decoration:none;font-size:14px;font-weight:500}'
           '.jj-map .grp a:hover{border-color:#1e4d3a;color:#1e4d3a}'
           '.jj-map .grp a[aria-current=page]{background:#1e4d3a;color:#fff;border-color:#1e4d3a;font-weight:800}'
           '.jj-map .grp a[aria-current=page]::before{content:"▶ ";font-size:11px}'
           '.jj-map .ft{font-size:13px;color:#555;margin-top:12px;text-align:center;line-height:1.8}'
           '.jj-where{max-width:1200px;margin:0 auto;padding:8px 16px;font-size:14px;color:#2a2a2a;background:#efe9db;border-bottom:1px solid #d9d2c0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;word-break:keep-all}'
           '.jj-where a{color:#1e4d3a;text-decoration:none;font-weight:600}.jj-where .now{background:#1e4d3a;color:#fff;padding:2px 10px;border-radius:12px;font-weight:700;font-size:13px}'
           '.nav-item.is-current>.nav-top{color:#1e4d3a!important;font-weight:800!important;box-shadow:inset 0 -3px 0 #1e4d3a}'
           '.nav-dropdown a.is-current{background:#e6efe9!important;color:#1e4d3a!important;font-weight:700!important}'
           '@media(max-width:640px){.jj-map .grp b{min-width:100%}}</style>')
NAV_JS = r"""<script>(function(){try{
var here=location.pathname.replace(/\/index\.html$/,"/");
var norm=function(h){var a=document.createElement("a");a.href=h;return a.pathname.replace(/\/index\.html$/,"/");};
var isCur=function(h){var p=norm(h);return p===here||(p!=="/"&&p.slice(-1)==="/"&&here.indexOf(p)===0);};
var map=document.querySelector(".jj-map"),curName="",grpName="";
if(map){map.querySelectorAll(".grp").forEach(function(g){g.querySelectorAll("a").forEach(function(a){if(isCur(a.getAttribute("href"))){a.setAttribute("aria-current","page");if(!curName){curName=a.textContent;var b=g.querySelector("b");grpName=b?b.textContent.replace(/\s*[·:]\s*$/,""):"";}}});});}
document.querySelectorAll(".nav-item").forEach(function(it){var top=it.querySelector(".nav-top"),hit=false;it.querySelectorAll("a").forEach(function(a){var h=a.getAttribute("href")||"";if(h.indexOf("http")===0)return;if(norm(h)===here){hit=true;if(a!==top)a.classList.add("is-current");}});it.classList.remove("active");if(hit)it.classList.add("is-current");});
if(here!=="/"&&!document.querySelector(".jj-where")){var ttl=curName||(document.title.split(/[|—–]/)[0]||"").trim();var up=location.pathname.split("/").length>2?"../":"";
var bar=document.createElement("div");bar.className="jj-where";bar.innerHTML='<a href="'+up+'index.html">홈</a><span>›</span>'+(grpName?'<span>'+grpName+'</span><span>›</span>':'')+'<span class="now">지금 보는 쪽 · '+ttl+'</span>';
var hdr=document.querySelector("header, .site-header, nav.site-nav, .navbar, .nav");if(hdr)hdr.insertAdjacentElement("afterend",bar);else document.body.insertBefore(bar,document.body.firstChild);}
}catch(e){}})();</script>"""

def nav_block(depth):
    r = "../" * depth
    rows = "".join('<div class="grp"><b>' + g + ' ·</b>' + "".join(f'<a href="{r}{h}">{t}</a>' for h, t in items) + '</div>' for g, items in GROUPS)
    return (f'{START}{NAV_CSS}<div class="jj-map"><div class="ttl">집지니 사이트 지도 — 지금 보는 쪽은 ▶ 짙은 녹색</div>{rows}'
            f'<div class="ft">서울·경기·인천 수도권 전역 · 자재상·기술자 직거래 · 정찰제 코디비 · 부가세 10% 별도<br>'
            f'샘플실: <a href="{r}showroom.html" style="color:#1e4d3a;font-weight:600">서울 강서구 공항대로41길 66 세신종합상가 지하 1층 B156호 (가양동)</a> · 상담 예약 010-9806-0422</div></div>{NAV_JS}{END}')

def main():
    files = []
    for f in glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True):
        rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
        if rel.split("/")[0] in SKIP_DIRS or os.path.basename(rel) in SKIP_FILES or rel.startswith("naver"): continue
        files.append((f, rel))
    changed, noalt = 0, []
    for f, rel in files:
        s = open(f, encoding="utf-8").read(); o = s
        if "</head>" not in s or "<body" not in s: continue
        add = ""
        if "og:image" not in s: add += OG
        if "twitter:card" not in s: add += TW
        if "fonts.googleapis.com/css" in s and 'rel="preconnect"' not in s: add += PRE
        if add: s = s.replace("</head>", add + "\n</head>", 1)
        depth = rel.count("/")
        # 2026-10-12 견적 사례 글에 기사 구조화 데이터(제목·날짜·글쓴이) — 검색 결과에 날짜·출처가 붙게
        if rel.startswith("cases/") and "application/ld+json" not in s:
            mt = re.search(r"<title>(.*?)</title>", s, re.S); md = re.search(r'name="description" content="([^"]*)"', s); dt = re.match(r"cases/(\d{4})(\d{2})(\d{2})", rel)
            if mt:
                art = {"@context": "https://schema.org", "@type": "Article", "headline": html_unescape(mt.group(1).strip())[:110], "description": html_unescape(md.group(1))[:200] if md else "",
                       "author": {"@type": "Organization", "name": "집지니", "url": "https://jipjini.com/"}, "publisher": {"@type": "Organization", "name": "집지니"},
                       "mainEntityOfPage": "https://jipjini.com/" + rel.replace("index.html", ""), "inLanguage": "ko"}
                if dt: art["datePublished"] = f"{dt.group(1)}-{dt.group(2)}-{dt.group(3)}"
                s = s.replace("</head>", '<script type="application/ld+json">' + json.dumps(art, ensure_ascii=False) + "</script>\n</head>", 1)
        block = nav_block(depth)
        if START in s:
            s = re.sub(re.escape(START) + ".*?" + re.escape(END), lambda m: block, s, flags=re.S)
        else:
            i = s.rfind("</body>")
            if i > 0: s = s[:i] + block + "\n" + s[i:]
        # 2026-10-12 사이트 상담 도우미(카톡봇과 같은 두뇌) — 모든 공개 쪽에
        if "assets/chatbot.js" not in s:
            i2 = s.rfind("</body>")
            if i2 > 0: s = s[:i2] + f'<script src="{"../" * depth}assets/chatbot.js" defer></script>\n' + s[i2:]
        for img in re.findall(r"<img\b[^>]*>", s):
            if not re.search(r'\balt=', img): noalt.append(rel); break
        if s != o: open(f, "w", encoding="utf-8").write(s); changed += 1
    # 2026-10-12 없는 주소로 들어온 사람을 놓치지 않게 404 쪽 (안내 띠·상담 도우미 포함)
    p404 = os.path.join(ROOT, "404.html")
    if not os.path.exists(p404):
        open(p404, "w", encoding="utf-8").write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>찾는 쪽이 없습니다 · 집지니</title><meta name="robots" content="noindex">'
            '<style>body{margin:0;background:#FBF8F1;color:#2A2A2A;font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}main{max-width:640px;margin:0 auto;padding:64px 20px 24px;text-align:center}h1{font-size:24px;margin:0 0 10px}p{color:#5a6b60;line-height:1.7}a.b{display:inline-block;margin:6px;padding:11px 18px;border-radius:10px;background:#1a472a;color:#F5F1E8;text-decoration:none;font-weight:600}a.o{background:#fff;color:#1a472a;border:1px solid rgba(26,71,42,.3)}</style></head><body><main>'
            '<h1>찾으시는 쪽이 없거나 주소가 바뀌었습니다</h1><p>인테리어 비용·사례·진행 방식은 아래에서 바로 보실 수 있고, 오른쪽 아래 「상담 도우미」에 물어보셔도 됩니다.</p>'
            '<a class="b" href="/">첫 화면</a><a class="b o" href="/interior-price-table.html">실견적 시세표</a><a class="b o" href="/faq.html">자주 묻는 질문</a><a class="b o" href="/request.html">무료 견적 신청</a></main></body></html>')
    print(f"공개 쪽 {len(files)} · 바뀐 쪽 {changed}" + (f" · 대체 글 없는 그림 있는 쪽 {len(noalt)}: {', '.join(noalt[:8])}" if noalt else ""))

if __name__ == "__main__":
    main()
