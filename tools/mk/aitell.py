#!/usr/bin/env python3
"""「AI 티」 글 점검기 (2026-11-28 대표 「AI 티가 너무 난다, 티 안 나게 하는 것 서치해서 싹 다 스킬 적용」)
조사: mk/research/2026-11-28-AI티-없애기.md (위키백과 「AI 글의 징후」, 한국어 AI 글 85패턴 분류, 숏폼 'AI 슬롭' 징후)
쓰는 법: python3 tools/mk/aitell.py 파일...  또는  echo "글" | python3 tools/mk/aitell.py -
걸린 줄을 보여 주고, 심각(S1)이 하나라도 있으면 끝 상태 1.
"""
import re, sys

RULES = [
    # (등급, 이름, 정규식, 고칠 방향)
    ('S1', '이중 피동', r'(되어지|되어진|보여지|보여진|만들어지게|생각되어)', '「됩니다」「보입니다」로'),
    ('S1', '번역투', r'(에 있어서|에 있어|를 통해|을 통해|에 의해|로 인해|라고 볼 수 있|하는 데 있어)', '주어·동사를 바로 쓰기'),
    ('S1', 'AI 상투 종결', r'(시사하는 바가|의미가 있습니다|중요한 역할을|핵심입니다|게임 체인저|새로운 지평|한 단계 끌어올)', '사실 한 줄로'),
    ('S1', '부풀린 꾸밈말', r'(혁신적|완벽한|완벽하게|획기적|압도적|놀라운|최고의 경험|한눈에|손쉽게|간편하게|스마트한|차원이 다른)', '숫자·이름으로 바꾸기'),
    ('S1', '대구 구호', r'[^.\n]{0,30}(가|이) 아니라[^.\n]{0,30}(입니다|이다|예요|이에요|합니다)', '대구를 깨고 사실만'),
    ('S2', '줄표(—) 남발', r'—', '마침표·쉼표로'),
    ('S2', '셋 묶음 나열', r'[가-힣A-Za-z0-9]+(,|·) ?[가-힣A-Za-z0-9]+(,|·) ?(그리고 )?[가-힣A-Za-z0-9]+(까지|를 모두|을 모두)', '가장 센 하나만'),
    ('S2', '얼버무림', r'(것 같습니다|수도 있습니다|라고 할 수 있|일 수 있습니다)', '단정하거나 지우기'),
    ('S2', '접속사 남발', r'(^|\n|\. )(또한|게다가|더불어|뿐만 아니라|이처럼|결론적으로|요약하자면)', '지우기'),
    ('S2', '형식 명사', r'(하는 것이 (중요|필요)|라는 점|하는 부분)', '동사로'),
    ('S2', '느낌표', r'!', '마침표로'),
    ('S3', '이모지·장식', r'[\U0001F300-\U0001FAFF☀-➿]', '선 아이콘 하나만, 아니면 지우기'),
    ('S3', '영어 낱말', r'\b(?!jipjini|com|PDF|dwg|CAD)[A-Za-z]{4,}\b', '한국어 낱말로'),
]

def check(text):
    hits = []
    for n, line in enumerate(text.splitlines(), 1):
        for lv, name, pat, fix in RULES:
            for m in re.finditer(pat, line):
                hits.append((lv, n, name, m.group(0), fix))
    # 문장 길이 단조로움: 연속 4문장 길이 차이 20% 안쪽
    sents = [s for s in re.split(r'(?<=[.?!다요])\s+', text) if len(s) > 8]
    lens = [len(s) for s in sents]
    for i in range(len(lens) - 3):
        w = lens[i:i + 4]
        if max(w) - min(w) <= 0.2 * max(w):
            hits.append(('S3', 0, '리듬 단조로움', ' / '.join(s[:12] for s in sents[i:i + 4]), '짧은 문장 하나 섞기'))
            break
    # 같은 문장 시작 3번 이상
    heads = {}
    for s in sents:
        h = s[:4]; heads[h] = heads.get(h, 0) + 1
    for h, c in heads.items():
        if c >= 3:
            hits.append(('S2', 0, '같은 시작 반복', f'「{h}…」 {c}번', '시작을 바꾸기'))
    return hits

if __name__ == '__main__':
    srcs = sys.argv[1:] or ['-']
    bad = 0
    for s in srcs:
        text = sys.stdin.read() if s == '-' else open(s, encoding='utf-8').read()
        if s.endswith('.json'):   # 제이슨이면 사람에게 보이는 글(한글 들어간 값)만
            import json
            vals = []
            def walk(o):
                if isinstance(o, dict): [walk(v) for v in o.values()]
                elif isinstance(o, list): [walk(v) for v in o]
                elif isinstance(o, str) and re.search('[가-힣]', o): vals.append(re.sub(r'https?://\S+', '', o))
            walk(json.loads(text)); text = '\n'.join(vals)
        for lv, n, name, got, fix in sorted(check(text)):
            print(f'{lv} {s}:{n} {name}: 「{got}」 → {fix}')
            bad += lv == 'S1'
    sys.exit(1 if bad else 0)
