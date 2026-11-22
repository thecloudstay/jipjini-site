# -*- coding: utf-8 -*-
"""자료 파일 엄격 검사 (2026-11-22): data/acb 의 지역 파일 24개에 NaN 이 들어 있어 그 구의 단지 화면이 통째로 비었다(11-21 공개 때부터).
파이썬은 NaN 을 읽어 주지만 브라우저는 못 읽는다. 브라우저와 같은 기준으로 data 아래 json 을 모두 읽어 보고, 깨진 것이 있으면 실패로 끝낸다."""
import glob, json, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def no(x): raise ValueError("숫자 아님 표시 " + x)
bad = []
for f in glob.glob(os.path.join(R, "data", "**", "*.json"), recursive=True):
    try: json.loads(open(f, encoding="utf-8").read(), parse_constant=no)
    except Exception as e: bad.append((os.path.relpath(f, R), str(e)[:80]))
for b in bad[:30]: print("깨짐", *b)
print("검사 끝 · 깨진 파일", len(bad))
sys.exit(1 if bad else 0)
