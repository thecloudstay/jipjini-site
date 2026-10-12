# -*- coding: utf-8 -*-
"""자주 묻는 질문 쪽 자동 생성 (2026-10-12)
카톡·사이트 챗봇과 같은 답(카카오봇 웹앱 ?faq=1)을 읽어 faq.html 을 만든다 — 챗봇 답을 고치면 다음 날 이 쪽도 저절로 바뀐다.
구조화 데이터(자주 묻는 질문·위치 경로)를 넣어 검색 결과에 질문·답이 펼쳐 보이게 한다. 못 읽으면 data/faq.json 그대로 쓴다.
사용: python3 tools/faq_page.py
"""
import os, sys, json, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_real_quotes import CSS, head, faq_ld, crumb_ld, esc, SITE, ROOT, TODAY

BOT = "https://script.google.com/macros/s/AKfycbyTMw196qwKBmpz_TA3erW4OcBsmRFWTYioecO5evjq4poPOEXpyqkSKZZ91eTHWUI-/exec?faq=1"
Q = {"평당 비용": "인테리어 비용은 평당 얼마인가요?", "진행 방식": "집지니는 어떻게 진행되나요?", "일반 업체와 차이": "일반 인테리어 업체와 무엇이 다른가요?",
     "거주 중 공사": "살면서 공사할 수 있나요?", "자재 선택": "자재·브랜드는 고를 수 있나요?", "환불·취소": "진행하지 않으면 환불되나요?",
     "코디와 현장관리": "코디와 현장관리(PM)는 무엇이 다른가요?", "하자 보수": "하자 보수(A/S) 기간은 얼마인가요?", "결제 방식": "공사비는 어떻게 결제하나요?",
     "코디비": "코디비는 얼마인가요?", "공사 기간": "공사 기간은 얼마나 걸리나요?", "시공 지역": "어느 지역까지 시공하나요?", "실측·방문": "현장 실측·방문을 하나요?", "견적 비용": "견적은 무료인가요?"}
ORDER = ["견적 비용", "평당 비용", "진행 방식", "일반 업체와 차이", "코디비", "코디와 현장관리", "결제 방식", "공사 기간", "실측·방문", "자재 선택", "거주 중 공사", "하자 보수", "환불·취소", "시공 지역"]

def load():
    p = os.path.join(ROOT, "data", "faq.json")
    try:
        raw = urllib.request.urlopen(urllib.request.Request(BOT, headers={"User-Agent": "jipjini-site"}), timeout=90).read().decode("utf-8")
        d = json.loads(raw)
        if d.get("ok") and d.get("faq"): open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1)); return d["faq"]
    except Exception as e: print("챗봇 답 못 읽음 → 저장본 사용:", e)
    return json.load(open(p, encoding="utf-8"))["faq"]

def main():
    faq = load()
    faq.sort(key=lambda f: ORDER.index(f["q"]) if f["q"] in ORDER else 99)
    qas = [(Q.get(f["q"], f["q"] + "은(는) 어떻게 되나요?"), f["a"]) for f in faq]
    url = SITE + "faq.html"
    ld = {"@context": "https://schema.org", "@graph": [faq_ld(qas), crumb_ld([("집지니", SITE), ("자주 묻는 질문", url)])]}
    items = "".join(f'<div class="q" id="q{i+1}">{esc(q)}</div><div class="a">{esc(a)}' + (f' <a href="{esc(f["link"]["url"])}">{esc(f["link"]["label"])}</a>' if f.get("link") else "") + "</div>" for i, ((q, a), f) in enumerate(zip(qas, faq)))
    body = f"""<p>집지니에 가장 많이 묻는 질문과 답입니다. 사이트 오른쪽 아래 「상담 도우미」나 카톡 채널에서도 같은 답을 바로 받으실 수 있습니다.</p>
<h2>질문 {len(qas)}가지</h2><div class="faq">{items}</div>
<div class="cta"><div style="font-size:17px;font-weight:600">더 궁금한 점은 코디가 직접 답해 드립니다</div>
<a href="https://jipjini.com/request.html">무료 견적 신청 (5분)</a><a href="https://pf.kakao.com/_NjpxhC/chat">카톡 문의</a><a href="faq.html?chat=1">상담 도우미 열기</a></div>
<p class="note">※ 이 쪽은 챗봇 답과 같은 자료로 매일 자동 갱신됩니다 (갱신 {TODAY.strftime('%Y-%m-%d')}).</p>"""
    html = head(url, "인테리어 자주 묻는 질문 — 비용·진행·코디비·하자 보수 | 집지니", "평당 비용, 진행 방식, 코디비, 현장관리, 결제, 공사 기간, 하자 보수, 환불까지 집지니에 가장 많이 묻는 " + str(len(qas)) + "가지 질문과 답.", ld) + f"""
<body><div class="wrap">
<header><div class="eb">JIPJINI · 자주 묻는 질문</div><h1>인테리어 자주 묻는 질문</h1></header>
<nav class="bc"><a href="./">집지니</a> › 자주 묻는 질문</nav>
<main>
{body}
</main></div></body></html>
"""
    open(os.path.join(ROOT, "faq.html"), "w", encoding="utf-8").write(html)
    print("faq.html", len(qas), "문항")

if __name__ == "__main__":
    main()
