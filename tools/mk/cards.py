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
.bars{{margin-top:80px}}
.bar{{margin-bottom:64px}}
.bar p{{display:flex;justify-content:space-between;font-size:42px;margin-bottom:18px}}
.bar p b{{font-size:56px}}
.bar div{{height:44px;background:#DCDFD8;border-radius:4px}}
.bar div i{{display:block;height:44px;background:#1C1F1B;border-radius:4px}}
.bar.g div i{{background:#1F5E2E}} .bar.g p b{{color:#1F5E2E}}
.foot{{position:absolute;left:92px;right:92px;bottom:70px;display:flex;justify-content:space-between;font-size:26px;color:#6B7067;border-top:1px solid #DCDFD8;padding-top:22px}}

.url{{align-self:flex-start;display:inline-block;margin-top:70px;font-size:52px;font-weight:700;border-bottom:6px solid #1F5E2E;padding-bottom:8px}}
"""

def slide(x, i, n):
    k = x.get("k", "hook"); top = '<div class="top"><b><i>집</i>집지니</b><span>%s</span></div>' % E(x.get("tag", "집에서 나가는 돈을 줄입니다"))
    hl = lambda s: E(s).replace("[[", "<em>").replace("]]", "</em>").replace("\n", "<br>")
    if k == "num":
        body = f'<div class="n">{E(x["n"])}<small>{E(x.get("u", ""))}</small></div><div class="t">{hl(x.get("t", ""))}</div><div class="s">{hl(x.get("s", ""))}</div>'
    elif k == "bars":
        mx = max(float(b[1]) for b in x["bars"]) or 1
        body = f'<div class="t" style="margin-top:0">{hl(x.get("t", ""))}</div><div class="bars">' + "".join(
            f'<div class="bar{" g" if j == len(x["bars"]) - 1 else ""}"><p><span>{E(b[0])}</span><b>{E(b[2] if len(b) > 2 else b[1])}</b></p><div><i style="width:{float(b[1]) / mx * 100:.1f}%"></i></div></div>'
            for j, b in enumerate(x["bars"])) + f'</div><div class="s">{hl(x.get("s", ""))}</div>'
    elif k == "cta":
        body = f'<div class="h">{hl(x.get("t", "우리 단지는?"))}</div><div class="s">{hl(x.get("s", "단지 이름만 넣으면 30초"))}</div><span class="url">{E(x.get("url", "jipjini.com"))}</span>'
    else:
        body = f'<div class="h">{hl(x.get("t", ""))}</div><div class="s">{hl(x.get("s", ""))}</div>'
    foot = f'<div class="foot"><span>{E(x.get("src", ""))}</span><span>{i}/{n}</span></div>'
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="c {k}">{top}<div class="m">{body}</div>{foot}</div></body></html>'

async def main(qf):
    q = json.load(open(qf, encoding="utf-8")); out = ROOT / "mk" / "img"; out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1080, "height": 1350})
        for it in q["글"]:
            cs = it.get("카드") or []; it["사진"] = []
            for i, x in enumerate(cs, 1):
                await pg.set_content(slide(x, i, len(cs))); await pg.evaluate("document.fonts.ready")
                f = out / f'{it["id"]}-{i}.jpg'; await pg.screenshot(path=str(f), type="jpeg", quality=90)
                it["사진"].append(f"https://jipjini.com/mk/img/{f.name}")
        await b.close()
    json.dump(q, open(qf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("카드", sum(len(it.get("사진", [])) for it in q["글"]), "장")

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
