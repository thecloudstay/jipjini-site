# -*- coding: utf-8 -*-
r"""하네스 점검(2026-11-13 대표 「꼭 내가 지시해야만 반영되는 게 문제 — 루프 엔지니어링 하네스」).
   점수만 보던 고리에 「지켜져야 할 약속」을 더한다. 통합 실행이 30분마다 부르고, 결과를 D:\croll\기록\하네스_점검.txt 에 쓴다.
   클로드 점검은 이 파일 하나부터 읽는다. 어긴 약속은 「고칠 것」 줄로 남기고, 컴퓨터가 고칠 수 있는 것은 여기서 바로 한다.
   약속
     1 손님이 보는 도면(공개목록)이 최신 판 — 아니면 일괄 변환이 그것부터 다시 그린다(pc_convert 순서)
     2 전체 변환이 3일 안에 끝나는 속도 — 아니면 느린 단계(읽기·변환)를 적는다
     3 통합 실행 한 회차가 12시간을 넘지 않음
     4 평면도 받기가 3시간 넘게 멈추지 않음
     5 자체 모델이 두 번 넘게 잇달아 지지 않음 — 지면 원인 후보를 적는다
     6 원본 대비 변환 진행률, 공개 기준 통과율을 숫자로 남긴다"""
import json, os, re, sys, time, statistics

CROLL = r"D:\croll"
LOG = os.path.join(CROLL, "기록"); DATA = os.path.join(CROLL, "자료"); OUT = os.path.join(DATA, "변환")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def rj(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def age_h(p):
    return (time.time() - os.path.getmtime(p)) / 3600 if os.path.exists(p) else None


def main():
    L, fix = [], []
    st = rj(os.path.join(OUT, "상태.json"), {})
    try:
        sys.path.insert(0, os.path.join(CROLL, "코드", "변환", "tools", "harness"))
        import pc_convert; ver = pc_convert.version()
    except Exception:
        ver = None
    # 1 공개 도면 최신 판
    pub = rj(os.path.join(OUT, "공개목록.json"), [])
    if ver and pub:
        old = [k for k in pub if (st.get(k) or {}).get("판") != ver]
        L.append("1 공개 도면 최신 판: %d/%d" % (len(pub) - len(old), len(pub)))
        if old: fix.append("공개 도면 %d개가 옛 판 — 일괄 변환이 맨 먼저 다시 그림, 통과하면 다음 공개 때 바꿔 끼움" % len(old))
    # 2 속도
    try:
        import csv
        rows = [r for r in csv.DictReader(open(os.path.join(DATA, "원본_목록.csv"), encoding="utf-8-sig")) if str(r.get("순서")) == "1"]
        left = sum(1 for r in rows if (st.get("%s_%s" % (r["단지코드"], r["평형"])) or {}).get("판") != ver)
        T = [v["초"] for v in st.values() if isinstance(v.get("초"), list) and len(v["초"]) == 2][-300:]
        if T:
            rd = statistics.median([t[0] for t in T]); cv = statistics.median([t[1] for t in T]); eta = left * (rd + cv) / 3600
            L.append("2 속도: 한 장 읽기 %.1f초 + 변환 %.1f초 · 남은 %d장 · 끝까지 약 %.0f시간" % (rd, cv, left, eta))
            if eta > 72: fix.append("끝까지 %.0f시간 — 느린 쪽(%s)부터 줄이거나 여러 줄로 동시 변환" % (eta, "읽기" if rd > cv else "변환"))
        else:
            L.append("2 속도: 시간 기록 아직 없음 · 남은 %d장" % left)
        ok = sum(1 for v in st.values() if isinstance(v.get("점수"), (int, float)) and v["점수"] >= 85 and v.get("판정") in ("통과", "예외"))
        L.append("6 진행: 원본 %d장 중 변환 %d장 · 공개 기준 통과 %d장" % (len(rows), len(st), ok))
    except Exception as e:
        L.append("2 속도: 셀 수 없음 " + str(e)[:60])
    # 3 회차 길이
    try:
        ends = [ln for ln in open(os.path.join(LOG, "통합_log.txt"), encoding="utf-8", errors="replace") if "끝" in ln]
        a = age_h(os.path.join(LOG, "통합_log.txt"))
        L.append("3 통합 실행: 마지막 회차 끝 %.1f시간 전" % a if a is not None else "3 통합 실행: 기록 없음")
        if a is not None and a > 12: fix.append("통합 실행 한 회차가 %.0f시간째 — 일괄 변환이 끝까지 도는 중이면 정상, 아니면 멈춤 확인" % a)
    except Exception:
        pass
    # 4 평면도 받기
    a = age_h(os.path.join(LOG, "원본_log.txt"))
    if a is not None:
        L.append("4 평면도 원본 보관: 마지막 %.1f시간 전" % a)
        if a > 3: fix.append("평면도 받기·보관이 %.0f시간째 없음 — 받기 한도·막힘·회차 확인" % a)
    # 5 자체 모델
    try:
        q = open(os.path.join(LOG, "채점", "빠른판.txt"), encoding="utf-8", errors="replace").read().splitlines()
        sm = [ln for ln in q if "자체모델_" in ln]
        lose = 0
        for ln in reversed(sm):
            if "버림" in ln: lose += 1
            else: break
        L.append("5 자체 모델: 시험 %d번 · 최근 잇단 패배 %d번" % (len(sm), lose))
        if lose >= 2: fix.append("자체 모델 %d번 잇달아 패배 — 실제 정답지 비중·약한 묶음 가중 학습(11-13 넣음) 효과 확인, 계속 지면 공간 분할 경로·축척 점검" % lose)
    except Exception:
        pass
    # 7 그래픽 카드 — 놀고 있으면 일을 더 준다(2026-11-13 대표 「그래픽 카드를 최대한 뽑아 먹을 방법」)
    try:
        import torch
        if torch.cuda.is_available():
            fr, tot = torch.cuda.mem_get_info(); nm = torch.cuda.get_device_name(0)
            L.append("7 그래픽 카드: %s · 메모리 %.1f/%.1fGB 여유" % (nm, fr / 1e9, tot / 1e9))
            if fr / tot > 0.8: fix.append("그래픽 카드가 거의 놀고 있음 — 학습 후보 동시 학습·글자 인식·변환 가속에 쓸 것")
        else:
            L.append("7 그래픽 카드: 이 파이썬에서는 안 보임(학습 환경 파이썬으로 돌리면 보임)")
    except Exception as e:
        L.append("7 그래픽 카드: 확인 못 함 " + str(e)[:40])
    txt = "하네스 점검 · %s · 판 %s\n\n지킨 것·숫자\n  %s\n\n고칠 것 (%d)\n  %s\n" % (
        time.strftime("%Y-%m-%d %H:%M"), ver, "\n  ".join(L), len(fix), "\n  ".join(fix) if fix else "없음")
    open(os.path.join(LOG, "하네스_점검.txt"), "w", encoding="utf-8").write(txt)
    print(txt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
