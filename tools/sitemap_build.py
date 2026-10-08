# -*- coding: utf-8 -*-
"""사이트 지도 다시 만들기 (2026-10-09)
공개 쪽 전부를 넣고, 마지막 수정일은 저장소 기록(git)에서 가져온다. 고객 개인 화면·관리 화면은 뺀다.
사용: python3 tools/sitemap_build.py
"""
import os, re, glob, subprocess, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://jipjini.com/"
SKIP_DIRS = ("admin", "console", "assets", "q", "node_modules", ".github", "cards", "data")
SKIP_FILES = {"quote.html", "client-input.html", "schedule.html", "sign.html", "contract.html", "payment.html"}
PRIO = [("index.html", "1.0"), ("request.html", "0.9"), ("interior-price-table.html", "0.9"), ("pricing.html", "0.8"), ("region/index.html", "0.8"), ("py/index.html", "0.8"), ("trade/index.html", "0.8")]

DIRTY = set()
try:
    for ln in subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.splitlines():
        DIRTY.add(ln[3:].strip().strip('"'))
except Exception: pass

def lastmod(rel):
    if rel in DIRTY: return datetime.date.today().isoformat()   # 아직 반영 전인 변경은 오늘
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", out): return out
    except Exception: pass
    return datetime.date.fromtimestamp(os.path.getmtime(os.path.join(ROOT, rel))).isoformat()

def main():
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True)):
        rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
        if rel.split("/")[0] in SKIP_DIRS or os.path.basename(rel) in SKIP_FILES or rel.startswith("naver"): continue
        s = open(f, encoding="utf-8", errors="ignore").read(2000)
        if 'name="robots"' in s and "noindex" in s: continue
        loc = SITE + (rel[:-10] if rel.endswith("index.html") else rel)   # cases/index.html → cases/
        pr = dict(PRIO).get(rel) or ("0.7" if rel.startswith(("region/", "py/", "trade/")) else "0.6" if rel.startswith("cases/q-") else "0.5" if rel.startswith("cases/") else "0.7")
        cf = "weekly" if rel.startswith(("region/", "py/", "trade/")) or rel in ("interior-price-table.html", "cases/index.html", "index.html") else "monthly"
        rows.append(f"  <url><loc>{loc}</loc><lastmod>{lastmod(rel)}</lastmod><changefreq>{cf}</changefreq><priority>{pr}</priority></url>")
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    p = os.path.join(ROOT, "sitemap.xml")
    old = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
    if xml != old: open(p, "w", encoding="utf-8").write(xml)
    print(f"사이트 지도 {len(rows)}쪽" + ("" if xml != old else " (변경 없음)"))

if __name__ == "__main__":
    main()
