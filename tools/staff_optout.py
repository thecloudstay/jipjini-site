# -*- coding: utf-8 -*-
"""대표·직원 방문은 방문 통계(GA4)에서 빼기 (2026-10-24)
콘솔에 한 번 로그인한 브라우저(또는 jipjini.com/?jj_staff=1 로 한 번 연 브라우저)는 「jj_staff」 표시가 남고,
모든 쪽의 통계 코드가 그 표시를 보면 통계를 보내지 않는다. 새로 생긴 쪽도 매일 자동으로 맞춘다(멱등).
사용: python3 tools/staff_optout.py
"""
import os, re, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUARD = "(function(){try{if(/[?&]jj_staff=1/.test(location.search))localStorage.setItem('jj_staff','1');if(/[?&]jj_staff=0/.test(location.search))localStorage.removeItem('jj_staff');if(localStorage.getItem('jj_staff'))window['ga-disable-G-35EM7T3M9W']=true}catch(e){}})();"
PAT = re.compile(r"gtag\((['\"])config\1,\s?(['\"])G-35EM7T3M9W\2")
n = 0
for f in glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True) + glob.glob(os.path.join(ROOT, "tools", "*.py")):
    if f.endswith("staff_optout.py"): continue
    s = open(f, encoding="utf-8", errors="ignore").read()
    if "G-35EM7T3M9W" not in s or GUARD in s: continue
    t = PAT.sub(lambda m: GUARD + m.group(0), s)
    if t != s:
        open(f, "w", encoding="utf-8").write(t); n += 1
print("통계 제외 표시 넣은 파일", n)
