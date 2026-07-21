# -*- coding: utf-8 -*-
# A안 일괄 패치: C2 반셀프 어휘 / C3 숫자 통일 / C4 GAS URL 마스킹 / C6 FAQ 스키마 / C8 문구 완화 / 오타 fix
import re, io, glob

GAS = 'https://script.google.com/macros/s/AKfycbzxm4mmZs1yVJPa3T-wb0cdJbEUMPYl6dDKtQNSNmJy4nEsCholrEnPAN8e0JfAtOV99A/exec?type=request_form'

def load(p):
    return io.open(p, encoding='utf-8').read()

def save(p, s):
    io.open(p, 'w', encoding='utf-8').write(s)

changed = []

# --- C4: GAS URL -> request.html (request.html 자신 제외) ---
for p in glob.glob('*.html'):
    if p == 'request.html':
        continue
    s = load(p)
    if GAS in s:
        save(p, s.replace(GAS, 'request.html'))
        changed.append(p + ':C4')

# --- index.html ---
p = 'index.html'
s = load(p)
TITLE = '집지니 — 반셀프 인테리어 코디 | 마진 0 수도권'
DESC = '반셀프(직영) 인테리어 코디. 중간 마진 0원, 자재상·기술자 직거래로 같은 시공 20~30% 절감. 수도권 무료 가안 5분.'
s = re.sub(r'<title>.*?</title>', '<title>' + TITLE + '</title>', s, count=1, flags=re.S)
s = re.sub(r'<meta[^>]*name="description"[^>]*>', '<meta name="description" content="' + DESC + '">', s, count=1)
s = re.sub(r'<meta[^>]*property="og:title"[^>]*>', '<meta property="og:title" content="' + TITLE + '">', s, count=1)
s = re.sub(r'<meta[^>]*property="og:description"[^>]*>', '<meta property="og:description" content="' + DESC + '">', s, count=1)
s = re.sub(r'<meta[^>]*name="twitter:title"[^>]*>', '<meta name="twitter:title" content="' + TITLE + '">', s, count=1)
s = re.sub(r'<meta[^>]*name="twitter:description"[^>]*>', '<meta name="twitter:description" content="' + DESC + '">', s, count=1)
# C8: 업계 최초 문구 완화
s = re.sub(r'업계\s*최초[^<]{0,25}코디\s*시장\s*개설', '반셀프 인테리어 전문 · Direct Coordi', s)
# C2: 히어로 서브카피에 반셀프 삽입
s = s.replace('업체 마진 없이, 자재상·기술자와 직거래로 연결합니다',
              '반셀프(직영) 인테리어를 코디가 돕습니다. 업체 마진 없이 자재상·기술자와 직거래로 연결합니다')
# C3: 마진 46% 각주 명확화
s = s.replace('이 마진 안에 1,000~2,000만원이 숨어있습니다',
              '업체 마진 30~46%(영업·관리 포함 표시가, 실질 순마진 약 30%) — 이 안에 1,000~2,000만원이 숨어있습니다')
save(p, s)
changed.append('index.html:C2/C3/C8')

# --- C3: 턴키 기준가 표기 통일 ---
for p in ['apt-olsuri-cost.html']:
    s = load(p)
    s2 = s.replace('약 6,000~7,000만', '약 6,500만 (6,000~7,000만)')
    if s2 != s:
        save(p, s2)
        changed.append(p + ':C3')

# --- 오타 fix (banself) ---
p = 'banself-interior.html'
s = load(p)
s2 = re.sub(r'더 .?쌉니다', '더 쌉니다', s)
if s2 != s:
    save(p, s2)
    changed.append(p + ':typo')

# --- C6: about.html FAQPage JSON-LD ---
p = 'about.html'
s = load(p)
if 'FAQPage' not in s:
    faq = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"왜 부분 수리 3개 이상부터 받나요?","acceptedAnswer":{"@type":"Answer","text":"코디 비용이 절약 효과보다 작아야 의뢰가 의미 있기 때문입니다. 단일 공정은 인부에게 직접 의뢰하는 편이 저렴해 직영을 권합니다. 공정 간 순서·자재·인부 조율이 필요한 3개 공정 이상부터 코디의 가치가 발생합니다."}},{"@type":"Question","name":"진짜로 자재비를 안 받아가나요?","acceptedAnswer":{"@type":"Answer","text":"구조적으로 받을 수 없습니다. 자재상·기술자가 건축주와 직거래 계약을 체결하고 모든 영수증·세금계산서가 건축주 명의로 발행됩니다. 집지니는 코디·PM 수수료만 받습니다."}},{"@type":"Question","name":"자재상이 부실하면 누가 책임지나요?","acceptedAnswer":{"@type":"Answer","text":"1차 책임은 직거래 계약을 맺은 자재상에게 있습니다. 집지니는 평점·이력을 검증해 매칭하며, 분쟁 시 코디·PM이 1차 대응 후 책임 협상을 돕습니다."}},{"@type":"Question","name":"시공 중 추가비가 발생하면 어떻게 되나요?","acceptedAnswer":{"@type":"Answer","text":"코디표 외 추가는 건축주 사전 승인 후에만 진행됩니다. 추가 시 단가가 즉시 공개되고 기록이 남으며, 집지니 마진은 발생하지 않습니다."}},{"@type":"Question","name":"코디만 받고 직영 시공이 가능한가요?","acceptedAnswer":{"@type":"Answer","text":"가능합니다. 코디가 자재·기술자·공정 순서를 미리 잡아드리고 그 틀대로 직접 진행하시면 비용이 가장 적게 듭니다. 필요 시 관리대리인(PM) 선임을 선택할 수 있습니다."}},{"@type":"Question","name":"하자 보증 기간은 얼마인가요?","acceptedAnswer":{"@type":"Answer","text":"입주 후 12개월 통합 A/S입니다. 시공 책임은 기술자·자재상이 지고, 해결 조율(접수·기술자 호출·재시공 일정)은 코디가 끝까지 무상으로 진행합니다."}},{"@type":"Question","name":"다른 인테리어 업체와의 차이는 무엇인가요?","acceptedAnswer":{"@type":"Answer","text":"같은 스펙 기준 20~30% 이상 저렴합니다. 턴키 업체가 자재비·인건비에 얹는 약 30%의 중간 마진을 직거래 구조로 없애고, 공정별 단가를 100% 공개하기 때문입니다."}}]}</script>'
    s = s.replace('</head>', faq + '\n</head>', 1)
    save(p, s)
    changed.append('about.html:C6')

print('patched:', changed)
