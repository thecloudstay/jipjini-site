# -*- coding: utf-8 -*-
"""네이버 블로그 초안 쪽 만들기 (2026-11-17)

  python3 tools/blog/blog_draft.py tools/blog/_post.json
_post.json (클로드가 _facts.json 을 보고 씀):
  {"글번호", "주제키", "종류", "제목", "태그": [...], "집지니주소": "...",
   "본문": [{"소제목": "..."}, {"글": "..."}, {"그림": "도면|공사비|공종표|누수표|경매표|단지", "설명": "..."}, {"표": [[머리...], [줄...]]}]}
결과: blog-draft/<글번호>/index.html (검색 제외) + 그림 PNG, 대장에 「초안」 기록 → 콘솔이 텔레그램으로 알림.
대표는 쪽에서 「제목 복사 → 본문 복사 → 붙여넣기 → 태그 → 발행」만 한다.
"""
import html
import json
import os
import subprocess
import sys
import threading
import functools
import http.server
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blog_ledger import BlogLedgerManager  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://jipjini.com/"
SHOT = {   # 그림 이름 → (쪽 고르기: 대표쪽/단지쪽/누수쪽/경매쪽/쪽, 잘라 낼 곳)
    "도면": ("대표쪽", ".ap .plan"), "공사비": ("대표쪽", ".ap .cost"), "공종표": ("대표쪽", ".ap section:nth-of-type(2) .tb"),
    "누수표": ("누수쪽", ".ap section"), "경매표": ("경매쪽", ".ap section .tb"), "단지": ("단지쪽", ".ap .tb"),
    "견적": ("쪽", "main"),
}


def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=str(ROOT))
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def shoot(jobs, port):
    """jobs: [(주소경로, 고르개, 저장경로)] — 우리 누리집 쪽을 그대로 찍는다(새로 그린 그림 아님)"""
    if not jobs:
        return []
    js = """
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:860,height:1100},deviceScaleFactor:2});
const jobs=JSON.parse(process.argv[2]);const ok=[];
for(const [u,sel,out] of jobs){try{await p.goto('http://127.0.0.1:%d/'+u,{waitUntil:'networkidle',timeout:30000});await p.waitForTimeout(500);
const el=await p.$(sel);if(el){await el.screenshot({path:out});ok.push(out);}}catch(e){}}
console.log(JSON.stringify(ok));await b.close();})();""" % port
    f = ROOT / "tools" / "blog" / "_shot.js"
    f.write_text(js, encoding="utf-8")
    r = subprocess.run(["node", str(f), json.dumps(jobs, ensure_ascii=False)], capture_output=True, text=True, timeout=300)
    f.unlink(missing_ok=True)
    try:
        return json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        print(r.stderr[-500:]); return []


def local(url):
    return url.replace(SITE, "") if url and url.startswith(SITE) else (url or "")


def build(post_path):
    post = json.loads(Path(post_path).read_text(encoding="utf-8"))
    facts = {}
    fp = ROOT / "tools" / "blog" / "_facts.json"
    if fp.exists():
        facts = json.loads(fp.read_text(encoding="utf-8"))
    pid = post["글번호"]
    out = ROOT / "blog-draft" / pid
    out.mkdir(parents=True, exist_ok=True)
    srv = serve()
    jobs, n = [], 0
    for blk in post["본문"]:
        if "그림" in blk:
            n += 1
            key, sel = SHOT.get(blk["그림"], ("대표쪽", "main"))
            page = local(facts.get(key) or post.get("집지니주소"))
            if page.endswith("/"):
                page += "index.html"
            blk["_파일"] = f"{n}.png"
            jobs.append([page, sel, str(out / f"{n}.png")])
    made = set(Path(x).name for x in shoot(jobs, srv.server_address[1]))
    srv.shutdown()

    body = []
    for blk in post["본문"]:
        if "소제목" in blk:
            body.append(f'<p style="font-size:19px;font-weight:700;margin:34px 0 10px">{html.escape(blk["소제목"])}</p>')
        elif "글" in blk:
            for para in str(blk["글"]).split("\n\n"):
                body.append(f'<p style="font-size:16px;line-height:1.9;margin:0 0 16px">{html.escape(para).replace(chr(10), "<br>")}</p>')
        elif "그림" in blk and blk.get("_파일") in made:
            src = f"{SITE}blog-draft/{pid}/{blk['_파일']}"
            body.append(f'<p style="margin:18px 0 6px"><img src="{src}" alt="{html.escape(blk.get("설명", ""))}" style="max-width:100%"></p>'
                        + (f'<p style="font-size:13px;color:#6B7067;margin:0 0 18px">{html.escape(blk["설명"])}</p>' if blk.get("설명") else ""))
        elif "표" in blk:
            rows = blk["표"]
            t = ['<table style="border-collapse:collapse;width:100%;font-size:15px;margin:10px 0 20px">']
            for i, r in enumerate(rows):
                tag = "th" if i == 0 else "td"
                t.append("<tr>" + "".join(f'<{tag} style="border-bottom:1px solid #DCDFD8;padding:8px 6px;text-align:{"left" if j == 0 else "right"}">{html.escape(str(c))}</{tag}>' for j, c in enumerate(r)) + "</tr>")
            t.append("</table>")
            body.append("".join(t))
    link = post.get("집지니주소") or facts.get("대표쪽") or SITE
    body.append(f'<p style="font-size:16px;line-height:1.9;margin:28px 0 0">우리 집 평형으로 바로 보기: <a href="{html.escape(link)}">{html.escape(link)}</a></p>')
    article = "\n".join(body)
    tags = " ".join("#" + t.replace(" ", "") for t in post.get("태그", []))
    imgs = "".join(f'<a href="{b["_파일"]}" download>{b["_파일"]}</a> ' for b in post["본문"] if b.get("_파일") in made)
    page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>블로그 초안 · {html.escape(post['제목'])}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap">
<style>
:root{{--ink:#1C1F1B;--pencil:#6B7067;--rule:#DCDFD8;--g:#1F5E2E}}
body{{margin:0;background:#fff;color:var(--ink);font-family:'IBM Plex Sans KR',sans-serif;word-break:keep-all}}
.w{{max-width:760px;margin:0 auto;padding:24px 16px 60px}}
.bar{{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--ink);padding:12px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;z-index:2}}
.bar b{{margin-right:auto;font-size:14px}}
button{{font:600 14px 'IBM Plex Sans KR',sans-serif;padding:10px 14px;border:1px solid var(--ink);background:#fff;border-radius:4px;cursor:pointer}}
button.go{{background:var(--g);border-color:var(--g);color:#fff}}
.k{{font-size:13px;color:var(--pencil);margin:18px 0 4px}}
.t{{font-size:22px;font-weight:700;line-height:1.4;margin:0}}
.tags{{font-size:14px;color:var(--pencil)}}
article{{border-top:1px solid var(--rule);margin-top:18px;padding-top:8px}}
.steps{{font-size:14px;color:var(--pencil);line-height:1.8;margin:14px 0 0;padding-left:18px}}
.ok{{color:var(--g);font-size:13px;margin-left:6px}}
</style></head><body><div class="w">
<div class="bar"><b>네이버 블로그 초안</b>
<button onclick="cp('t')">제목 복사</button><button class="go" onclick="cpHtml()">본문 복사</button><button onclick="cp('tags')">태그 복사</button>
<a href="https://blog.naver.com/GoBlogWrite.naver" target="_blank"><button>글쓰기 열기</button></a><span id="ok" class="ok"></span></div>
<ol class="steps"><li>「글쓰기 열기」 → 제목 칸에 제목 붙여넣기</li><li>본문 칸에 본문 붙여넣기(그림·표 그대로 들어감 · 그림이 빠지면 아래 그림을 끌어다 놓기)</li><li>발행 창 태그 칸에 태그 붙여넣기 → 발행. 발행하면 집지니가 스스로 확인해 대장에 적습니다.</li></ol>
<p class="k">제목</p><p class="t" id="t">{html.escape(post['제목'])}</p>
<p class="k">태그</p><p class="tags" id="tags">{html.escape(tags)}</p>
<p class="k">그림 내려받기</p><p class="tags">{imgs}</p>
<article id="a">{article}</article>
</div>
<script>
function done(m){{var e=document.getElementById('ok');e.textContent=m;setTimeout(function(){{e.textContent=''}},2500)}}
function cp(id){{var t=document.getElementById(id).innerText;navigator.clipboard.writeText(t).then(function(){{done('복사함')}},function(){{sel(id)}})}}
function sel(id){{var r=document.createRange();r.selectNodeContents(document.getElementById(id));var s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();done('복사함')}}
function cpHtml(){{var a=document.getElementById('a');try{{navigator.clipboard.write([new ClipboardItem({{'text/html':new Blob([a.innerHTML],{{type:'text/html'}}),'text/plain':new Blob([a.innerText],{{type:'text/plain'}})}})]).then(function(){{done('본문 복사함')}},function(){{sel('a')}})}}catch(e){{sel('a')}}}}
</script></body></html>"""
    (out / "index.html").write_text(page, encoding="utf-8")
    m = BlogLedgerManager()
    url = f"{SITE}blog-draft/{pid}/"
    rec = next((r for r in m.records if r.get("글번호") == pid), None)
    if not rec:
        m.add(**{"글번호": pid, "종류": post.get("종류") or facts.get("종류", ""), "주제키": post.get("주제키") or facts.get("주제키", pid),
                 "제목": post["제목"], "태그": post.get("태그", []), "초안주소": url, "집지니주소": link})
    m.update_record_status(pid, "초안", 제목=post["제목"], 초안주소=url, 태그=post.get("태그", []))
    print(f"초안 쪽: {out / 'index.html'} · 그림 {len(made)}/{len(jobs)} · 주소 {url}")
    return 0


if __name__ == "__main__":
    sys.exit(build(sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent / "_post.json")))
