# -*- coding: utf-8 -*-
"""시공 포트폴리오 쪽 자동 만들기 (2026-10-23)
콘솔(portfolio.gs)이 매일 올리는 공개 목록 marketing/portfolio/index.json 을 받아
  portfolio/index.html          현장 모음 (공간·공정으로 거르기)
  portfolio/<번호>.html          현장 하나 (전·중·후 순 사진, 크게 보기)
  portfolio/img/<번호>/<n>.jpg   사진 사본 (큰 그림 1600 · 작은 그림 640) — 저장소에 두어 빠르고 오래 간다
를 만든다. 고객 이름·번지는 목록에 애초에 없다(콘솔에서 지역은 시·군·구까지만 내보냄).
사용: python3 tools/portfolio_build.py            (인터넷에서 받기)
      python3 tools/portfolio_build.py --local 목록.json   (시험용)
"""
import os, sys, json, html, io, hashlib, urllib.request, datetime, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "https://pnqyysuyrovgnmrchrrg.supabase.co/storage/v1/object/public/marketing/portfolio/index.json"
OUT = os.path.join(ROOT, "portfolio")
SITE = "https://jipjini.com/portfolio/"
GA = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-35EM7T3M9W"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-35EM7T3M9W');</script>"""
BA_ORDER = {"전": 0, "중": 1, "후": 2, "": 1}
STAGE_KO = {"시공중": "시공 중", "완공": "완공", "계약": "착공 준비"}
e = lambda s: html.escape(str(s if s is not None else ""), quote=True)


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "jipjini-portfolio/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def load(argv):
    if "--local" in argv:
        return json.load(open(argv[argv.index("--local") + 1], encoding="utf-8"))
    return json.loads(fetch(SRC + "?t=" + str(int(datetime.datetime.now().timestamp()))).decode("utf-8"))


def save_img(src, dest_big, dest_small):
    """사진 사본 — 이미 있으면 건너뜀. 실패하면 False."""
    if os.path.exists(dest_big) and os.path.exists(dest_small):
        return True
    try:
        from PIL import Image, ImageOps
        raw = open(src, "rb").read() if os.path.exists(src) else fetch(src)
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
        os.makedirs(os.path.dirname(dest_big), exist_ok=True)
        b = im.copy(); b.thumbnail((1600, 1600)); b.save(dest_big, "JPEG", quality=82, optimize=True, progressive=True)
        s = im.copy(); s.thumbnail((640, 640)); s.save(dest_small, "JPEG", quality=78, optimize=True, progressive=True)
        return True
    except Exception as ex:
        print("사진 실패", src[:80], ex)
        return False


def title_of(g):
    works = [w for w in (g.get("공정") or []) if w and not re.search(r"착공|준공|청소|입주|완공|점검", w)]
    head = g.get("지역") or "집지니"
    return head + " " + ("·".join(works[:3]) + " 시공" if works else "시공 현장")


def head(title, desc, canon, img):
    return f"""<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(canon)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="집지니"><meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}"><meta property="og:image" content="{e(img)}"><meta property="og:url" content="{e(canon)}"><meta name="twitter:card" content="summary_large_image">
{GA}
<style>
:root{{--bg:#F5F1E8;--ink:#2A2A2A;--sub:#6B6B6B;--line:#DDD5C4;--card:#FFFDF8}}
*{{box-sizing:border-box}}body{{margin:0;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:var(--bg);color:var(--ink);line-height:1.7}}
a{{color:inherit}}.wrap{{max-width:1080px;margin:0 auto;padding:36px 18px 60px}}
.top{{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:26px;font-size:14px}}
.top a{{text-decoration:none}}.top .home{{font-weight:700;font-size:17px}}
h1{{font-size:28px;margin:0 0 6px;letter-spacing:-.3px}}.sub{{color:var(--sub);font-size:15px;margin:0 0 22px}}
.chips{{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}}.chip{{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 13px;font-size:13.5px;cursor:pointer}}
.chip.on{{background:var(--ink);color:var(--bg);border-color:var(--ink)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;text-decoration:none;display:block}}
.card img{{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#e9e3d6}}
.card .b{{padding:13px 15px 15px}}.card h2{{font-size:17px;margin:0 0 4px}}.meta{{color:var(--sub);font-size:13px}}
.tag{{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 7px;margin:6px 4px 0 0;color:var(--sub)}}
.st{{display:inline-block;font-size:12px;font-weight:700;border-radius:6px;padding:1px 8px;background:var(--ink);color:var(--bg);margin-left:6px;vertical-align:2px}}
.sec{{margin:30px 0 10px;font-size:18px;display:flex;align-items:center;gap:8px}}.sec small{{color:var(--sub);font-weight:400;font-size:13px}}
.photos{{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}}
.photos figure{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;cursor:zoom-in}}
.photos img{{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}}.photos figcaption{{font-size:12.5px;color:var(--sub);padding:6px 9px}}
.cta{{background:var(--ink);color:var(--bg);border-radius:14px;padding:26px 20px;text-align:center;margin-top:40px}}
.cta p{{margin:0 0 12px}}.cta a{{display:inline-block;margin:4px;background:var(--bg);color:var(--ink);padding:11px 22px;border-radius:9px;text-decoration:none;font-weight:700}}
#lb{{position:fixed;inset:0;background:rgba(20,20,20,.92);display:none;align-items:center;justify-content:center;z-index:50}}#lb.on{{display:flex}}
#lb img{{max-width:94vw;max-height:84vh;border-radius:6px}}#lb .cap{{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:#eee;font-size:14px}}
#lb button{{position:absolute;background:none;border:0;color:#fff;font-size:34px;cursor:pointer;padding:14px}}#lb .x{{top:6px;right:8px}}#lb .p{{left:4px}}#lb .n{{right:4px}}
.ico{{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}}
.empty{{color:var(--sub);padding:30px 0}}
@media(max-width:560px){{h1{{font-size:23px}}.grid{{grid-template-columns:1fr}}.photos{{grid-template-columns:repeat(2,1fr)}}}}
</style></head><body><div class="wrap">
<div class="top"><a class="home" href="/">집지니</a><span><a href="/portfolio/">포트폴리오</a> · <a href="/cases/">견적 사례</a> · <a href="/request.html">의뢰하기</a></span></div>
"""


CAM = '<svg class="ico" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
CTA = """<div class="cta"><p>같은 방식으로 우리 집도 맡겨 보세요 — 공종별 실제 단가 그대로, 마진 없는 코디</p>
<a href="/request.html">무료 견적 의뢰</a><a href="/cases/">견적 사례 보기</a></div>"""
FOOT = "</div></body></html>\n"


def build(data):
    sites = []
    for g in data.get("현장") or []:
        num = re.sub(r"[^0-9a-f]", "", str(g.get("번호", "")))[:12]
        if not num or not g.get("사진"):
            continue
        ph = sorted(g["사진"], key=lambda p: (BA_ORDER.get(p.get("전후", ""), 1), p.get("날짜", "")))
        kept = []
        for i, p in enumerate(ph):
            key = hashlib.md5(p["주소"].split("?")[0].encode()).hexdigest()[:10]
            big = os.path.join(OUT, "img", num, key + ".jpg"); small = os.path.join(OUT, "img", num, key + "_s.jpg")
            if save_img(p["주소"], big, small):
                kept.append(dict(p, big=f"img/{num}/{key}.jpg", small=f"img/{num}/{key}_s.jpg"))
        if kept:
            sites.append(dict(g, 번호=num, 사진=kept))
    if not sites:
        print("현장 없음 — 쪽을 바꾸지 않음"); return 0
    os.makedirs(OUT, exist_ok=True)
    rooms = sorted({p["공간"] for s in sites for p in s["사진"] if p.get("공간")})
    works = []
    for s in sites:
        for w in s.get("공정") or []:
            if w not in works: works.append(w)
    # ── 현장 하나 ──
    for s in sites:
        t = title_of(s); st = STAGE_KO.get(s.get("상태", ""), "")
        period = " ~ ".join([x for x in [s.get("착공", ""), s.get("완공", "") if st == "완공" else ""] if x])
        desc = f"{t} — 현장 사진 {len(s['사진'])}장" + (f" · {', '.join(s.get('공정', [])[:6])}" if s.get("공정") else "") + ". 집지니 다이렉트 코디로 진행한 실제 현장입니다."
        h = [head(t + " · 집지니 포트폴리오", desc, SITE + s["번호"] + ".html", SITE + s["사진"][-1]["big"])]
        h.append(f'<h1>{e(t)}{"<span class=st>" + e(st) + "</span>" if st else ""}</h1>')
        h.append(f'<p class="sub">{e(s.get("지역", ""))}{" · " + e(period) if period else ""} · 사진 {len(s["사진"])}장</p>')
        if s.get("공정"):
            h.append('<div>' + "".join(f'<span class="tag">{e(w)}</span>' for w in s["공정"]) + "</div>")
        groups = [("전", "시공 전"), ("중", "시공 과정"), ("후", "시공 후"), ("", "현장 사진")]
        n = 0; js = []
        for k, label in groups:
            ps = [p for p in s["사진"] if (p.get("전후") or "") == k]
            if not ps: continue
            h.append(f'<div class="sec">{CAM}{e(label)} <small>{len(ps)}장</small></div><div class="photos">')
            for p in ps:
                cap = " · ".join([x for x in [p.get("공간", ""), p.get("단계", "") if p.get("단계") not in ("기타", "") else "", p.get("설명", ""), p.get("날짜", "")] if x])
                alt = f'{t} {p.get("공간", "")} {label}'.strip()
                h.append(f'<figure onclick="lb({n})"><img loading="lazy" src="{e(p["small"])}" alt="{e(alt)}"><figcaption>{e(cap)}</figcaption></figure>')
                js.append([p["big"], cap]); n += 1
            h.append("</div>")
        h.append(CTA)
        h.append('<div id="lb" onclick="if(event.target===this)lbx()"><button class="x" onclick="lbx()" aria-label="닫기">&times;</button><button class="p" onclick="lbs(-1)" aria-label="앞">&#8249;</button><img id="lbi" alt=""><button class="n" onclick="lbs(1)" aria-label="뒤">&#8250;</button><div class="cap" id="lbc"></div></div>')
        h.append("<script>var P=" + json.dumps(js, ensure_ascii=False) + ",I=0;function lb(i){I=i;var x=P[i];document.getElementById('lbi').src=x[0];document.getElementById('lbc').textContent=x[1];document.getElementById('lb').classList.add('on')}function lbx(){document.getElementById('lb').classList.remove('on')}function lbs(d){lb((I+d+P.length)%P.length)}document.addEventListener('keydown',function(k){if(!document.getElementById('lb').classList.contains('on'))return;if(k.key==='Escape')lbx();if(k.key==='ArrowLeft')lbs(-1);if(k.key==='ArrowRight')lbs(1)});</script>")
        ld = {"@context": "https://schema.org", "@type": "ImageGallery", "name": t, "description": desc, "url": SITE + s["번호"] + ".html",
              "image": [SITE + p["big"] for p in s["사진"][:20]], "provider": {"@type": "HomeAndConstructionBusiness", "name": "집지니", "url": "https://jipjini.com/"}}
        h.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>")
        h.append(FOOT)
        open(os.path.join(OUT, s["번호"] + ".html"), "w", encoding="utf-8").write("".join(h))
    # ── 모음 ──
    total = sum(len(s["사진"]) for s in sites)
    desc = f"집지니가 직접 코디한 실제 시공 현장 {len(sites)}곳, 사진 {total}장. 시공 전·과정·후를 공간·공정별로 모았습니다."
    h = [head("시공 포트폴리오 — 실제 현장 사진 · 집지니", desc, SITE, SITE + sites[0]["사진"][-1]["big"])]
    h.append("<h1>시공 포트폴리오</h1>")
    h.append(f'<p class="sub">실제 현장 {len(sites)}곳 · 사진 {total}장 · 현장 사진이 쌓이면 매일 자동으로 늘어납니다</p>')
    labels = []
    for x in rooms + works[:14]:
        if x not in labels: labels.append(x)
    chips = ['<button class="chip on" data-f="">전체</button>'] + [f'<button class="chip" data-f="{e(x)}">{e(x)}</button>' for x in labels]
    if len(chips) > 1:
        h.append('<div class="chips">' + "".join(chips) + "</div>")
    h.append('<div class="grid">')
    for s in sites:
        t = title_of(s); st = STAGE_KO.get(s.get("상태", ""), "")
        tags = "|".join(sorted({p["공간"] for p in s["사진"] if p.get("공간")} | set(s.get("공정") or [])))
        cover = next((p for p in reversed(s["사진"]) if p.get("전후") == "후"), s["사진"][-1])
        h.append(f'<a class="card" href="{e(s["번호"])}.html" data-t="{e(tags)}"><img loading="lazy" src="{e(cover["small"])}" alt="{e(t)}"><div class="b"><h2>{e(t)}{"<span class=st>" + e(st) + "</span>" if st else ""}</h2>'
                 f'<div class="meta">{e(s.get("지역", ""))} · 사진 {len(s["사진"])}장{" · " + e(s.get("최근", "")) if s.get("최근") else ""}</div>'
                 + "".join(f'<span class="tag">{e(w)}</span>' for w in (s.get("공정") or [])[:5]) + "</div></a>")
    h.append('</div><p class="empty" id="none" style="display:none">이 조건의 현장이 아직 없습니다.</p>')
    h.append("<script>document.querySelectorAll('.chip').forEach(function(c){c.onclick=function(){document.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on')});c.classList.add('on');var f=c.dataset.f,n=0;document.querySelectorAll('.card').forEach(function(k){var ok=!f||('|'+k.dataset.t+'|').indexOf('|'+f+'|')>=0;k.style.display=ok?'':'none';if(ok)n++});document.getElementById('none').style.display=n?'none':''}})</script>")
    h.append(CTA + FOOT)
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write("".join(h))
    print(f"포트폴리오: 현장 {len(sites)}곳 · 사진 {total}장")
    return len(sites)


if __name__ == "__main__":
    try:
        d = load(sys.argv)
    except Exception as ex:
        print("목록을 받지 못함 — 쪽을 바꾸지 않음:", ex); sys.exit(0)
    build(d)
