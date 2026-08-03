# -*- coding: utf-8 -*-
# 2026-07-31 GSC 진단 반영: cases 고아 페이지 해소 (전 페이지 푸터 + 홈 가이드 라인에 링크)
import io, glob, re

CASES_LINK = '<a href="cases/index.html">견적 사례 모음</a>'
CASES_LINK_ROOT = '<a href="/cases/">견적 사례 모음</a>'
changed = []

for p in glob.glob("*.html"):
    if p == "request.html":
        continue
    s = io.open(p, encoding="utf-8").read()
    orig = s

    # 1) 푸터 "인테리어 가이드" 라인에 사례 모음 추가
    if "인테리어 가이드" in s and "cases/" not in s:
        s = s.replace(
            '<b>인테리어 가이드</b>',
            '<b>인테리어 가이드</b> · <a href="/cases/">견적 사례 모음 (20건)</a>',
            1)

    # 2) 상단 내비 "가격·견적" 드롭다운에 사례 항목 추가
    if 'pricing.html#sample' in s and 'cases/' not in s:
        s = s.replace(
            '<a href="pricing.html#sample">견적서 샘플</a>',
            '<a href="pricing.html#sample">견적서 샘플</a>\n        <a href="/cases/">견적 사례 모음</a>',
            1)

    if s != orig:
        io.open(p, "w", encoding="utf-8").write(s)
        changed.append(p)

# 3) 홈 하단 CTA 위에 사례 섹션 삽입 (색인 유도 핵심 — 실제 앵커 텍스트)
p = "index.html"
s = io.open(p, encoding="utf-8").read()
if "case-teaser" not in s:
    teaser = '''
<section id="case-teaser" style="max-width:1100px;margin:0 auto;padding:56px 24px;text-align:center">
  <div style="font-size:12px;letter-spacing:3px;color:#C98E7E">REAL ESTIMATES</div>
  <h2 style="font-size:26px;margin:14px 0 10px;color:#1a2a20">실제 산출한 견적, 명세까지 공개합니다</h2>
  <p style="color:#5a6b60;margin-bottom:22px">평형·공정별 견적 사례 20건. 공종별 수량·단가와 턴키 대비 절감액을 그대로 열어뒀습니다.</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;font-size:14px">
    <a href="/cases/seoul-18py-full.html" style="padding:8px 14px;background:#F1EDE3;border-radius:18px;color:#274434;text-decoration:none">서울 18평 올수리 1,449만</a>
    <a href="/cases/gg-25py-partial.html" style="padding:8px 14px;background:#F1EDE3;border-radius:18px;color:#274434;text-decoration:none">김포 25평 부분 올수리 1,379만</a>
    <a href="/cases/incheon-25py-bath.html" style="padding:8px 14px;background:#F1EDE3;border-radius:18px;color:#274434;text-decoration:none">인천 25평 욕실 244만</a>
    <a href="/cases/seoul-38py-full.html" style="padding:8px 14px;background:#F1EDE3;border-radius:18px;color:#274434;text-decoration:none">서울 38평 올수리 2,789만</a>
  </div>
  <p style="margin-top:20px"><a href="/cases/" style="display:inline-block;background:#1a472a;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:800">견적 사례 20건 전부 보기</a></p>
</section>
'''
    # 마지막 CTA 섹션 앞에 삽입 (없으면 </body> 앞)
    m = re.search(r'<div class="foot">', s)
    if m:
        s = s[:m.start()] + teaser + s[m.start():]
    else:
        s = s.replace("</body>", teaser + "</body>", 1)
    io.open(p, "w", encoding="utf-8").write(s)
    changed.append("index.html:teaser")

print("patched:", changed)
