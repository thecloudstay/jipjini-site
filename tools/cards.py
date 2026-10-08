# -*- coding: utf-8 -*-
"""실견적 카드 그림 생성 (2026-10-09) — 인스타그램·스레드·네이버 블로그·카카오 채널에 바로 올릴 1080×1350 그림과 글 초안.
data/real-quotes.json → cards/<파일>.png + cards/index.json (콘솔이 매일 9시 새 카드를 텔레그램으로 보낸다)
사용: python3 tools/cards.py
"""
import os, re, json, glob, datetime
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://jipjini.com/"
W, H = 1080, 1350
BG, INK, ACC, SUB, CARD = "#F5F1E8", "#2A2A2A", "#C98E7E", "#6B6B6B", "#FBF8F1"

def font(size, bold=False):
    cands = ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
             "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
             "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf", "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"]
    cands = [c for c in cands if ("Bold" in c) == bold] + [c for c in cands if ("Bold" in c) != bold]
    for c in cands + glob.glob("/usr/share/fonts/**/*CJK*.tt[cf]", recursive=True):
        if os.path.exists(c):
            try: return ImageFont.truetype(c, size, index=2 if c.endswith(".ttc") else 0)   # ttc 안의 2번 = KR
            except Exception:
                try: return ImageFont.truetype(c, size)
                except Exception: pass
    return ImageFont.load_default()

def man(n):
    n = int(round(n / 10000)); return (f"{n // 10000}억 {n % 10000:,}만원" if n % 10000 else f"{n // 10000}억원") if n >= 10000 else f"{n:,}만원"

def card(c):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 300], fill=INK)
    d.text((72, 70), "JIPJINI · 실견적 공개", font=font(26), fill=ACC)
    py = f"{int(c['py'])}평 " if c.get("py") else ""
    d.text((72, 118), f"{c['region']} {py}{c.get('type') or '아파트'}", font=font(54, True), fill="#F5F1E8")
    d.text((72, 200), f"{c['ymd'][:4]}.{c['ymd'][4:6]} 실제로 보낸 견적서 · 개인정보만 가림", font=font(28), fill="#C8C4BC")
    d.text((72, 350), "시공총액 (자재+인건비 · 마진 0)", font=font(30), fill=SUB)
    d.text((72, 395), man(c["total"]), font=font(110, True), fill=INK)
    sub = f"{len(c['sections'])}개 공종 · {sum(len(s['lines']) for s in c['sections'])}줄 공개"
    if c.get("py"): sub = f"평당 {man(c['total'] / c['py'])} · " + sub
    d.text((72, 535), sub, font=font(32), fill=SUB)
    secs = sorted(c["sections"], key=lambda s: -s["subtotal"])[:6]
    top = max(s["subtotal"] for s in secs) or 1
    y = 640
    d.text((72, y - 50), "공종별 금액", font=font(30, True), fill=INK)
    for s in secs:
        d.rounded_rectangle([72, y, 1008, y + 70], 12, fill=CARD, outline="#C8C4BC")
        bw = int(900 * s["subtotal"] / top)
        d.rounded_rectangle([80, y + 54, 80 + max(bw, 8), y + 62], 4, fill=ACC)
        d.text((92, y + 12), s["trade"][:16], font=font(30), fill=INK)
        t = f"{int(s['subtotal']):,}원"; tw = d.textlength(t, font=font(30, True))
        d.text((988 - tw, y + 12), t, font=font(30, True), fill=INK)
        y += 86
    extra = c["codi"] + (c.get("pm") or 0)
    d.text((72, 1190), f"코디비{'·현장관리비' if c.get('pm') else ''} {man(extra)} 별도 · 부가세 별도", font=font(28), fill=SUB)
    d.rectangle([0, 1260, W, H], fill=INK)
    d.text((72, 1288), "줄마다 상표·수량·단가 공개 → jipjini.com", font=font(32, True), fill="#F5F1E8")
    return im

def caption(c, url):
    py = f"{int(c['py'])}평 " if c.get("py") else ""
    trades = " · ".join(s["trade"] for s in sorted(c["sections"], key=lambda s: -s["subtotal"])[:4])
    per = f"평당 {man(c['total'] / c['py'])}, " if c.get("py") else ""
    tags = "#인테리어비용 #인테리어견적 #반셀프인테리어 #아파트인테리어 #" + c["region"].split()[-1].replace("시", "").replace("구", "") + "인테리어 " + (f"#{int(c['py'])}평인테리어 " if c.get("py") else "") + "#집지니"
    return (f"[{c['region']} {py}실견적 공개] 시공총액 {man(c['total'])}\n"
            f"{c['ymd'][:4]}년 {int(c['ymd'][4:6])}월에 실제로 보낸 견적서입니다. {per}{len(c['sections'])}개 공종({trades}) {sum(len(s['lines']) for s in c['sections'])}줄의 상표·수량·단가를 개인정보만 가리고 전부 공개했습니다.\n"
            f"자재·인건비 마진 0, 코디비 정찰제. 같은 범위 일반 업체 대비 20~30% 낮습니다.\n\n"
            f"줄마다 보기 → {url}\n무료 견적(5분) → jipjini.com/request.html\n\n{tags}")

def main():
    p = os.path.join(ROOT, "data", "real-quotes.json")
    if not os.path.exists(p): print("자료 없음"); return
    cases = json.load(open(p, encoding="utf-8"))["cases"]
    os.makedirs(os.path.join(ROOT, "cards"), exist_ok=True)
    idx = []
    for c in cases:
        name = os.path.basename(c["file"]).replace(".html", "")
        png = os.path.join(ROOT, "cards", name + ".png")
        if not os.path.exists(png): card(c).save(png, optimize=True)
        url = SITE + c["file"]
        idx.append({"key": c["key"], "ymd": c["ymd"], "title": f"{c['region']} {(str(int(c['py'])) + '평 ') if c.get('py') else ''}실견적 {man(c['total'])}", "image": SITE + "cards/" + name + ".png", "page": url, "caption": caption(c, url)})
    keep = {os.path.basename(x["image"]) for x in idx}
    for f in glob.glob(os.path.join(ROOT, "cards", "*.png")):
        if os.path.basename(f) not in keep: os.remove(f)
    json.dump({"updated": datetime.date.today().isoformat(), "cards": idx}, open(os.path.join(ROOT, "cards", "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"카드 {len(idx)}장")

if __name__ == "__main__":
    main()
