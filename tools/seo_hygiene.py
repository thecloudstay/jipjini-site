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
SKIP_DIRS = ("admin", "console", "assets", "q", "node_modules", ".github")
SKIP_FILES = {"quote.html", "client-input.html", "schedule.html", "sign.html", "contract.html", "payment.html"}   # 고객 개인 화면
OG = '<meta property="og:image" content="https://jipjini.com/og-cover.png">'
TW = '<meta name="twitter:card" content="summary_large_image">'
PRE = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
START, END = "<!--SITENAV-->", "<!--/SITENAV-->"

def nav_block(depth):
    r = "../" * depth
    links = [("interior-price-table.html", "실견적 시세표"), ("region/", "지역별 비용"), ("py/", "평형별 비용"), ("trade/", "공종별 비용"),
             ("showroom.html", "샘플실"), ("cases/", "견적 사례"), ("faq.html", "자주 묻는 질문"), ("ganghwa-interior.html", "강화 인테리어"), ("interior-coordinator.html", "코디네이터란"), ("pricing.html", "가격·코디비"), ("workflow.html", "진행 방식"), ("request.html", "무료 견적 신청")]
    a = "".join(f'<a href="{r}{h}" style="display:inline-block;margin:4px 6px;padding:6px 12px;background:rgba(0,0,0,.05);border-radius:14px;color:inherit;text-decoration:none;font-size:13px">{t}</a>' for h, t in links)
    return (f'{START}<div style="max-width:780px;margin:28px auto 0;padding:18px 16px 26px;text-align:center;font-family:\'Apple SD Gothic Neo\',\'Noto Sans KR\',sans-serif;color:#555;border-top:1px solid rgba(0,0,0,.08)">'
            f'<div style="font-size:12px;letter-spacing:2px;color:#999;margin-bottom:8px">집지니 · 마진 0 인테리어 코디</div>{a}'
            f'<div style="font-size:12px;color:#999;margin-top:10px">서울·경기·인천 수도권 전역 · 자재상·기술자 직거래 · 정찰제 코디비</div>'
            f'<div style="font-size:12px;color:#999;margin-top:4px">샘플실: <a href="{r}showroom.html" style="color:inherit">서울 강서구 공항대로41길 66 세신종합상가 지하 1층 B156호</a> · 예약 상담</div></div>{END}')

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
