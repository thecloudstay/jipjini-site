# -*- coding: utf-8 -*-
"""집지니 색·글꼴·모서리 통일 (2026-11-11). python3 tools/unify_brand.py
한 가지 초록(올리브 그린) 계열만 쓴다. 값을 다시 바꾸려면 PALETTE 의 오른쪽만 고치고 다시 돌린다.
  주색 #4F6B2C · 진한 #33491C · 가장 진한 #232F14 · 밝은(어두운 바탕 위) #B5CB85 · 옅은 #E8EEDC · 아주 옅은 #F3F6EC
"""
import re, glob
MAIN, DEEP, DARK, LIGHT, PALE, MIST, MID = '#4F6B2C', '#33491C', '#232F14', '#B5CB85', '#E8EEDC', '#F3F6EC', '#9DB36B'
PALETTE = {
 # 예전 숲색 초록
 '#1e4d3a': DEEP, '#1a472a': DEEP, '#1e5233': DEEP, '#274434': DEEP, '#1f5e46': MAIN, '#2f6b4f': MAIN,
 '#12351f': DARK, '#1a2a20': DARK,
 # 오늘 넣은 올리브
 '#5b6b2e': MAIN, '#3e4a1f': DEEP, '#b9c784': LIGHT, '#a9b67a': MID, '#e9ebdd': PALE,
 # 초록빛 회색 글씨 → 무채색
 '#5a6b60': '#6B6B6B', '#33413a': '#3D3D3D', '#3f5347': '#4F4F4F',
 # 초록빛 옅은 바탕
 '#f2f6f3': MIST, '#e6efe9': PALE, '#e3e8e4': PALE, '#d8e4dc': '#DDE6CB',
 # 종이색·선 계열 정리
 '#efe9db': '#EBE5D5', '#f1ede3': '#F5F1E8', '#cfc8b8': '#C8C4BC', '#cfc9bb': '#C8C4BC', '#e2dccd': '#D9D2C0',
 '#191919': '#1C1C1C',
}
DOCS = {'quote.html', 'contract.html', 'sign.html', 'doc.html', 'order.html', 'payment.html', 'client-input.html', 'schedule.html', 'visit.html'}
files = [f for f in glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('css/*.css') + glob.glob('assets/*.css') + glob.glob('assets/*.js') if 'naver' not in f]
rx = re.compile('|'.join(re.escape(k) for k in PALETTE), re.I)
n = 0
for f in files:
    s = open(f, encoding='utf-8').read(); o = s
    s = rx.sub(lambda m: PALETTE[m.group(0).lower()], s)
    if f.endswith(('.html', '.css')) and f.split('/')[-1] not in DOCS:
        # 글꼴: 제목은 명조(Noto Serif KR), 본문은 프리텐다드 한 가지
        s = re.sub(r"font-family:\s*'Noto Serif KR',\s*sans-serif", "font-family:'Noto Serif KR',serif", s)
        s = re.sub(r"font-family:\s*'Apple SD Gothic Neo',\s*'Noto Sans KR',\s*sans-serif", "font-family:Pretendard,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", s)
        s = re.sub(r"font-family:\s*-apple-system,\s*BlinkMacSystemFont,", "font-family:Pretendard,-apple-system,BlinkMacSystemFont,", s)
        s = s.replace("'Nanum Myeongjo',serif", "'Noto Serif KR',serif")
        # 모서리: 상자는 4px 로. 알약(999px)·동그라미(50%)는 그대로
        s = re.sub(r'border-radius:\s*(8|9|10|11|12|14|16|18|20|22|24)px', 'border-radius:4px', s)
    if s != o:
        open(f, 'w', encoding='utf-8').write(s); n += 1
print('고친 파일', n)
