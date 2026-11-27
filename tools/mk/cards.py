"""집지니 마케팅 팀 ③ 카드 그리기 — mk/queue/<주>.json 의 「카드」를 1080×1350 JPEG 로 (인스타그램은 JPEG 만 받음)
쓰임: python3 tools/mk/cards.py mk/queue/2026-W48.json   → mk/img/<글ID>-<번호>.jpg
모양: 흰 종이 · 먹색 큰 글씨 · 초록은 숫자에만 · 가는 선 · 출처 한 줄 (집지니 문서 양식, AI 티 나는 상자·그림자·이모지 없음)
카드 종류: hook(첫 장 큰 글) · num(큰 숫자) · bars(두세 값 비교 막대) · cta(마지막 장)"""
import json, os, sys, html, pathlib, asyncio
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
FD = (ROOT / "tools" / "mk" / "fonts").as_uri()
E = html.escape

CSS = f"""
@font-face{{font-family:P;font-weight:400;src:url({FD}/ibm-plex-sans-kr-korean-400-normal.woff2)}}
@font-face{{font-family:P;font-weight:700;src:url({FD}/ibm-plex-sans-kr-korean-700-normal.woff2)}}
@font-face{{font-family:P;font-weight:400;src:url({FD}/ibm-plex-sans-kr-latin-400-normal.woff2);unicode-range:U+0000-00FF}}
@font-face{{font-family:P;font-weight:700;src:url({FD}/ibm-plex-sans-kr-latin-700-normal.woff2);unicode-range:U+0000-00FF}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;height:1350px;background:#fff;color:#1C1F1B;font-family:P,sans-serif;word-break:keep-all}}
.c{{position:relative;width:1080px;height:1350px;padding:96px 92px 0;display:flex;flex-direction:column}}
.m{{flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:150px}}
.hook{{background:#1C1F1B;color:#fff}} .hook .top{{border-color:#fff;color:#B9BDB5}} .hook .top b{{color:#fff}} .hook .h em{{color:#7FC98B}} .hook .s{{color:#C9CCC5}} .hook .foot{{color:#9BA097;border-color:#3A3E38}}
.top{{display:flex;justify-content:space-between;align-items:center;font-size:30px;color:#6B7067;border-bottom:2px solid #1C1F1B;padding-bottom:26px}}
.top b{{color:#1C1F1B;font-size:34px}} .top b i{{font-style:normal;display:inline-block;width:46px;height:46px;line-height:46px;text-align:center;background:#1F5E2E;color:#fff;border-radius:4px;margin-right:14px;font-size:28px;vertical-align:middle}}
.h{{font-size:128px;line-height:1.2;font-weight:700;letter-spacing:-4px}}
.h em,.t em{{font-style:normal;color:#1F5E2E}}
.s{{font-size:40px;line-height:1.6;color:#6B7067;margin-top:56px}}
.n{{font-size:250px;font-weight:700;color:#1F5E2E;letter-spacing:-8px;line-height:1.05}}
.n small{{font-size:84px;letter-spacing:-2px;margin-left:6px}}
.t{{font-size:76px;font-weight:700;line-height:1.3;margin-top:40px;letter-spacing:-2px}}
.bars{{margin-top:56px}}
.bar{{margin-bottom:38px}}
.bar p{{display:flex;justify-content:space-between;font-size:42px;margin-bottom:18px}}
.bar p b{{font-size:56px}}
.bar div{{height:44px;background:#DCDFD8;border-radius:4px}}
.bar div i{{display:block;height:44px;background:#1C1F1B;border-radius:4px}}
.bar.g div i{{background:#1F5E2E}} .bar.g p b{{color:#1F5E2E}}
.foot{{position:absolute;left:92px;right:92px;bottom:70px;display:flex;justify-content:space-between;font-size:26px;color:#6B7067;border-top:1px solid #DCDFD8;padding-top:22px}}

.url{{align-self:flex-start;display:inline-block;margin-top:70px;font-size:52px;font-weight:700;border-bottom:6px solid #1F5E2E;padding-bottom:8px}}
/* 2026-11-28 대표 「글만 있는 것보다 배경 화면이나 이미지 등 다르게, 최신식으로 계속 변경하면서」 */
.t-paper .c{{background:#F3EFE6}} .t-paper .hook{{background:#F3EFE6;color:#1C1F1B}} .t-paper .hook .top{{border-color:#1C1F1B;color:#6B7067}} .t-paper .hook .top b{{color:#1C1F1B}} .t-paper .hook .h em{{color:#1F5E2E}} .t-paper .hook .s{{color:#6B7067}}
.t-yellow .hook{{background:#FFD43B;color:#1C1F1B}} .t-yellow .hook .top{{border-color:#1C1F1B;color:#3A3E38}} .t-yellow .hook .top b{{color:#1C1F1B}} .t-yellow .hook .h em{{color:#1C1F1B;background:#fff;padding:0 10px}} .t-yellow .hook .s{{color:#3A3E38}} .t-yellow .hook .foot{{color:#3A3E38;border-color:#1C1F1B}}
.t-green .hook{{background:#1F5E2E;color:#fff}} .t-green .hook .h em{{color:#FFD43B}} .t-green .hook .s{{color:#D6E5D8}} .t-green .hook .top{{border-color:#fff;color:#D6E5D8}} .t-green .hook .foot{{color:#B9D3BE;border-color:#3E7A4C}}
.bgplan{{position:absolute;inset:180px -60px 90px 160px;opacity:.16;z-index:0}} .bgplan svg{{width:100%;height:100%}} .bgplan svg *{{stroke:#fff!important;fill:none!important}} .bgplan svg text{{display:none}} .c>.top,.c>.m{{position:relative;z-index:1}} .c>.foot{{z-index:1}}
.t-paper .bgplan svg *,.t-yellow .bgplan svg *{{stroke:#1C1F1B!important}}
.bgimg{{position:absolute;inset:0;background-size:cover;background-position:center;z-index:0}} .bgimg:after{{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,22,19,.55),rgba(20,22,19,.85))}}
.chatbox{{display:flex;flex-direction:column;gap:34px}} .chatbox p{{max-width:78%;font-size:58px;line-height:1.35;padding:30px 40px;border-radius:44px;font-weight:700}}
.chatbox p.l{{align-self:flex-start;background:#EDEFEA;color:#1C1F1B;border-bottom-left-radius:10px}} .chatbox p.r{{align-self:flex-end;background:#1F5E2E;color:#fff;border-bottom-right-radius:10px}}
.chatbox small{{font-size:30px;color:#6B7067;align-self:center}}
.billbox{{border:3px solid #1C1F1B;border-radius:4px;padding:40px 48px;background:#fff}} .billbox h4{{font-size:46px;margin-bottom:24px;border-bottom:3px double #1C1F1B;padding-bottom:18px}}
.billbox div{{display:flex;justify-content:space-between;font-size:44px;padding:16px 0;border-bottom:1px dashed #C9CCC5;color:#6B7067}}
.billbox div.hi{{color:#1C1F1B;font-weight:700;background:#FFD43B;margin:0 -20px;padding:16px 20px;border-bottom:0}}
"""

def theme_of(it, j):
    return it.get("테마") or ["", "t-paper", "t-yellow", "t-green"][j % 4]

PLAN_CACHE = {}
def plan_svg(code):
    if code in PLAN_CACHE: return PLAN_CACHE[code]
    try:
        import re as _re
        t = open(ROOT / "apt" / code / "index.html", encoding="utf-8").read()
        m = _re.search(r"<svg[^>]*>.*?</svg>", t, _re.S); PLAN_CACHE[code] = m.group(0) if m else ""
    except Exception: PLAN_CACHE[code] = ""
    return PLAN_CACHE[code]

def slide(x, i, n):
    k = x.get("k", "hook"); top = '<div class="top"><b><i>집</i>집지니</b><span>%s</span></div>' % E(x.get("tag", "집에서 나가는 돈을 줄입니다"))
    hl = lambda s: E(s).replace("[[", "<em>").replace("]]", "</em>").replace("\n", "<br>")
    if k == "num":
        body = f'<div class="n">{E(x["n"])}<small>{E(x.get("u", ""))}</small></div><div class="t">{hl(x.get("t", ""))}</div><div class="s">{hl(x.get("s", ""))}</div>'
    elif k == "bars":
        mx = max(float(b[1]) for b in x["bars"]) or 1
        body = f'<div class="t" style="margin-top:0;font-size:64px">{hl(x.get("t", ""))}</div><div class="bars">' + "".join(
            f'<div class="bar{" g" if j == len(x["bars"]) - 1 else ""}"><p><span>{E(b[0])}</span><b>{E(b[2] if len(b) > 2 else b[1])}</b></p><div><i style="width:{float(b[1]) / mx * 100:.1f}%"></i></div></div>'
            for j, b in enumerate(x["bars"])) + f'</div><div class="s">{hl(x.get("s", ""))}</div>'
    elif k == "chat":
        body = '<div class="chatbox">' + "".join(f'<p class="{"r" if w == "나" else "l"}">{hl(m)}</p>' for w, m in x["chat"]) + (f'<small>{E(x["s"])}</small>' if x.get("s") else "") + '</div>'
    elif k == "bill":
        body = f'<div class="t" style="margin:0 0 40px">{hl(x.get("t", ""))}</div><div class="billbox"><h4>관리비 고지서</h4>' + "".join(f'<div class="{"hi" if j == x.get("hi") else ""}"><span>{E(a)}</span><span>{E(b)}</span></div>' for j, (a, b) in enumerate(x["rows"])) + f'</div><div class="s">{hl(x.get("s", ""))}</div>'
    elif k == "cta":
        body = f'<div class="h">{hl(x.get("t", "우리 단지는?"))}</div><div class="s">{hl(x.get("s", "단지 이름만 넣으면 30초"))}</div><span class="url">{E(x.get("url", "jipjini.com"))}</span>'
    else:
        body = f'<div class="h">{hl(x.get("t", ""))}</div><div class="s">{hl(x.get("s", ""))}</div>'
    bg = ""
    if x.get("plan"): bg = f'<div class="bgplan">{plan_svg(x["plan"])}</div>'
    if x.get("bg"): bg = f'<div class="bgimg" style="background-image:url({E(x["bg"])})"></div>'
    foot = f'<div class="foot"><span>{E(x.get("src", ""))}</span><span>{i}/{n}</span></div>'
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body class="{x.get("_theme", "")}"><div class="c {k}">{bg}{top}<div class="m">{body}</div>{foot}</div></body></html>'

async def main(qf):
    q = json.load(open(qf, encoding="utf-8")); out = ROOT / "mk" / "img"; out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1080, "height": 1350})
        for j, it in enumerate(q["글"]):
            cs = it.get("카드") or []; it["사진"] = []; th = theme_of(it, j)
            for x in cs: x["_theme"] = th
            for i, x in enumerate(cs, 1):
                await pg.set_content(slide(x, i, len(cs))); await pg.evaluate("document.fonts.ready")
                f = out / f'{it["id"]}-{i}.jpg'; await pg.screenshot(path=str(f), type="jpeg", quality=90)
                it["사진"].append(f"https://jipjini.com/mk/img/{f.name}")
        await b.close()
    json.dump(q, open(qf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("카드", sum(len(it.get("사진", [])) for it in q["글"]), "장")

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
