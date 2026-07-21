# -*- coding: utf-8 -*-
# 1회용: index.html title/description/og/twitter 메타를 네이버 40/80자 기준으로 교체
import re, io

TITLE = '집지니 — 마진 0 인테리어 코디 | 수도권 견적'
DESC = '인테리어 중간 마진 0원. 자재상·기술자 직거래 코디로 같은 시공 20~30% 절감. 수도권 아파트·주택 무료 가안 5분.'

p = 'index.html'
s = io.open(p, encoding='utf-8').read()

s = re.sub(r'<title>.*?</title>', '<title>' + TITLE + '</title>', s, count=1, flags=re.S)
s = re.sub(r'<meta[^>]*name="description"[^>]*>', '<meta name="description" content="' + DESC + '">', s, count=1)
s = re.sub(r'<meta[^>]*property="og:title"[^>]*>', '<meta property="og:title" content="' + TITLE + '">', s, count=1)
s = re.sub(r'<meta[^>]*property="og:description"[^>]*>', '<meta property="og:description" content="' + DESC + '">', s, count=1)
s = re.sub(r'<meta[^>]*name="twitter:title"[^>]*>', '<meta name="twitter:title" content="' + TITLE + '">', s, count=1)
s = re.sub(r'<meta[^>]*name="twitter:description"[^>]*>', '<meta name="twitter:description" content="' + DESC + '">', s, count=1)

io.open(p, 'w', encoding='utf-8').write(s)
print('patched')
