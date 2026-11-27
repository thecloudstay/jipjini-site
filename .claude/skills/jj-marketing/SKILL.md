---
name: jj-marketing
description: 집지니 마케팅 자동화 팀을 돌린다 — 소재(jj-scout) → 기획(jj-strategist) → 글·카드(jj-writer) → 검수(jj-inspector) → 내보내기·합치기. 「/jj-marketing auto」 또는 주제를 주면 그 주제로.
---
# 집지니 마케팅 팀 (2026-11-28 대표 지시: 100% 자동 · 훅킹 · 자극적 · 초간단)

흐름 — 사람 손 없음:
1. 저장소 최신으로: `git pull`.
2. **소재** jj-scout: `python3 tools/mk/scout.py` → mk/facts.json.
3. **기획** jj-strategist: 다음 월요일~일요일 7편(19:30). 인자가 주제면 그 주제 위주.
4. **글·카드** jj-writer: mk/queue/<연도>-W<주>.json 작성 → `python3 tools/mk/cards.py <파일>`.
5. **검수** jj-inspector: `python3 tools/mk/check.py <파일>` 통과 + 카드 눈 검사.
6. **내보내기**: `python3 tools/mk/build_queue.py` → mk/queue.json.
7. **올리기**: 새 갈래(mk-<주>)로 커밋 → 변경 요청 → 바로 합치기(대표 지시: 합치기 승인 기다리지 않음). 합쳐지면 jipjini.com/mk/queue.json 이 바뀌고,
   콘솔 mkImportQueue_ 가 한 시간 안에 「마케팅 자료」 시트에 「게시 예정」으로 넣고, pubTick_ 이 예약시각에 인스타그램·스레드에 올린다(게시·실패 모두 텔레그램).

지킬 선: 숫자는 facts.json 만 · 고객 개인정보·특정 단지 망신 금지 · 공사비 글은 「부가세 10% 별도」 · 이모지·영어·과장어 금지 · 당근·네이버 카페는 초안만(자동 게시 안 함).
