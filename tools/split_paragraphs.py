# -*- coding: utf-8 -*-
"""읽기 쉬움 기준: 세 문장 넘는 문단을 두 문장씩 나눈다. python3 tools/split_paragraphs.py 파일…  (--check 는 세기만)"""
import re, sys
CHECK = '--check' in sys.argv
SENT = re.compile(r'(?<=[다요죠]\.)(?:\s+)(?=[^\s<)」』])')
def split(inner):
    # 꼬리표 안에서 끊지 않도록, 꼬리표가 열려 있는 자리는 건너뛴다
    parts, last, depth = [], 0, 0
    for m in SENT.finditer(inner):
        seg = inner[last:m.start()]
        depth_here = len(re.findall(r'<(?!/|br|img|sup\b)[a-z][^>]*>', inner[:m.start()])) - len(re.findall(r'</(?!sup\b)[a-z]+>', inner[:m.start()]))
        if depth_here != 0:
            continue
        parts.append(seg.strip()); last = m.end()
    parts.append(inner[last:].strip())
    return [p for p in parts if p]
def run(path):
    s = open(path, encoding='utf-8').read(); n = 0
    def fix(m):
        nonlocal n
        attrs, inner = m.group(1) or '', m.group(2)
        if re.search(r'<(div|p|ul|ol|table|br|span style="display:block)', inner) or 'hero-lead' in attrs or 'data-keep' in attrs:
            return m.group(0)
        sents = split(inner)
        if len(sents) < 3:
            return m.group(0)
        n += 1
        groups = [' '.join(sents[i:i + 2]) for i in range(0, len(sents), 2)]
        if len(groups) > 1 and len(sents) % 2 == 1 and len(groups[-1]) < 40:      # 마지막 한 문장이 짧으면 앞 묶음에 붙인다
            tail = groups.pop(); groups[-1] += ' ' + tail
        return '\n'.join('<p%s>%s</p>' % (attrs, g) for g in groups)
    out = re.sub(r'<p(\s[^>]*)?>((?:(?!</?p[\s>]).)*?)</p>', fix, s, flags=re.S)
    if not CHECK and out != s:
        open(path, 'w', encoding='utf-8').write(out)
    return n
for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
    k = run(f)
    if k: print(f, k)
