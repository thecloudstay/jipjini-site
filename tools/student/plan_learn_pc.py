# -*- coding: utf-8 -*-
r"""이어 돌리기 (2026-11-11 대표 지시): 컴퓨터가 켜져 있는 동안 「시험 → 고침 → 반영 → 다시 시험」을 쉬지 않고 되풀이한다.

  · 후보 도구가 있으면(D:\croll\코드\도구_후보)  빠른 판(plan_quick.py)으로 시험해 반영·버림
  · 없으면                                      자동 조정(plan_tune.py)으로 기준 숫자를 바꿔 가며 시험
  · 자동 조정도 더 시험할 값이 없으면(2026-11-13 원인: 11-12 17:29 이후 같은 「더 없습니다」만 2분마다 되풀이하며 놀고 있었음)
      ① 합성 정답지 만들기(변환\tools\student\synth.py — 변환한 집지니 도면을 네이버·예전·무채색 그림으로 다시 그려 정답과 짝)
      ② 정답지가 20장 넘으면 자체 모델 학습(train_student.py, 학습 전용 파이썬) — 끝나면 도구_후보 에 들어가 ①번 「빠른 판」이 지금 도구와 겨룬다
      ③ 그래도 할 일이 없으면 자동 조정 시험 기록을 비우고(이전 기록은 보관) 넓게 다시 — 시험 그림이 날마다 늘어 같은 값도 결과가 달라진다
  · 한 바퀴 돌고 2분 쉰 뒤 다시. 새벽에도 쉬지 않는다(2026-11-13 대표 지시 「켜져 있으면 쉬지 말고」 — 그림은 이 컴퓨터에 받아 둔 원본만 써서 네이버에 부담이 없다).

통합 실행(run_all.py)이 시작할 때 이것이 안 돌고 있으면 작은 창으로 띄운다. 그래서 컴퓨터를 켜면 한 시간 안에 스스로 시작한다.
멈추려면:  D:\croll\학습\이어돌리기_멈춤.txt 라는 빈 파일을 만들어 두면 다음 바퀴에서 멈춘다(지우면 다음 통합 실행 때 다시 시작).
기록:      D:\croll\기록\채점\빠른판.txt · 조정.txt · 이어돌리기.txt"""
import os, sys, time, traceback
import plan_score as ps

BEAT = os.path.join(ps.OUT_DIR, "이어돌리기_숨.txt")     # 살아 있다는 표시(바퀴마다 고쳐 씀)
STOP = os.path.join(ps.ROOT, "학습", "이어돌리기_멈춤.txt")
LOG = os.path.join(ps.OUT_DIR, "이어돌리기.txt")
REST = 120
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def alive():
    return os.path.exists(BEAT) and time.time() - os.path.getmtime(BEAT) < 50 * 60


def beat(text):
    os.makedirs(ps.OUT_DIR, exist_ok=True)
    with open(BEAT, "w", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + text)


def note(text):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M ") + text + "\n")


def has_cand():
    import plan_quick as pq
    return os.path.isdir(pq.CAND_DIR) and any(not n.startswith("_") and os.path.isdir(os.path.join(pq.CAND_DIR, n)) for n in os.listdir(pq.CAND_DIR))


CROLL = ps.ROOT
STU = os.path.join(CROLL, "코드", "변환", "tools", "student")
ENV_PY = os.path.join(CROLL, "학습", "환경", "Scripts", "python.exe")
SYN = os.path.join(CROLL, "학습", "합성")
KEYS = [os.path.join(CROLL, "학습", "집지니"), SYN]
DRAW = os.path.join(CROLL, "자료", "변환", "도면")
TRAIN_MARK = os.path.join(ps.OUT_DIR, "자체모델_학습중.txt")


def tune_left():
    """자동 조정에 아직 시험할 값이 있나"""
    try:
        import plan_tune as pt
        log = ps.read_json(pt.LOG, {}) or {}
        return pt.pick(ps.tune_now(), log)[0] is not None
    except Exception as e:
        note("조정 남음 확인 실패: " + str(e)[:200])
        return True


def count(d, pat=".json"):
    try:
        return sum(1 for n in os.listdir(d) if n.endswith(pat))
    except Exception:
        return 0


HARN = os.path.join(CROLL, "코드", "변환", "tools", "harness")


def run_rescreen():
    r"""실제 네이버 평면도 정답지(세 의견 합의: 우리 규칙 검수 깨끗 · 원본 대조 90점·벽 재현 97%·정밀 93% · 선생 모델 벽 합의 80%)
    옛 93점 자료(학습\네이버)를 새 기준으로 다시 골라 학습\집지니 에 넣는다 — 한 번만(끝나면 학습\네이버\_재선별.txt)"""
    old = os.path.join(CROLL, "학습", "네이버")
    if not os.path.isdir(old) or os.path.exists(os.path.join(old, "_재선별.txt")):
        return False
    import subprocess
    beat("실제 평면도 정답지 고르기(세 의견 합의)")
    print("=== 실제 네이버 평면도 정답지 고르기 — 우리 도구·원본 대조·선생 모델 세 의견이 맞는 것만 ===", flush=True)
    code = "import sys; sys.path.insert(0, r'%s'); import pc_convert as p; import os; p.rescreen(p.rj(os.path.join(p.HERE, '알려진모양.json'), {}))" % HARN
    subprocess.call([sys.executable, "-u", "-c", code], cwd=HARN)
    try:
        note(open(os.path.join(old, "_재선별.txt"), encoding="utf-8").read().strip())
    except Exception:
        note("실제 평면도 정답지 고르기: 끝 표시가 없음(오류) — 다음 바퀴에 다시")
    return True


def run_synth():
    """변환한 도면 1장당 3장까지 합성 정답지. 새로 만들 것이 있을 때만 돈다."""
    if count(DRAW) * 3 <= count(SYN) + 3:
        return False
    import subprocess
    beat("합성 정답지 만들기")
    print("=== 합성 정답지 만들기 (변환한 집지니 도면 → 네이버·예전·무채색 그림 + 정답) ===", flush=True)
    subprocess.call([sys.executable, "-u", os.path.join(STU, "synth.py"), "3"], cwd=STU)
    note("합성 정답지: 모두 %d장" % count(SYN))
    return True


def run_student():
    """정답지 20장 이상 · 학습 전용 파이썬 있음 · 지금 학습 중 아님 · 마지막 학습 뒤 정답지가 30% 넘게 늘었거나 하루 지남 → 작은 창으로 학습 시작"""
    n = sum(count(d) for d in KEYS)
    if n < 20 or not os.path.exists(ENV_PY):
        return False
    st = ps.read_json(TRAIN_MARK, {}) or {}
    logf0 = os.path.join(ps.OUT_DIR, "자체모델_학습.txt")
    if os.path.exists(logf0) and time.time() - os.path.getmtime(logf0) < 10 * 60:      # 학습 중이면 바퀴마다 기록이 고쳐진다
        return False
    if st.get("정답지") and n < st["정답지"] * 1.3 and time.time() - st.get("시작", 0) < 24 * 3600:
        return False
    import subprocess, json
    kw = {}
    if os.name == "nt":
        si = subprocess.STARTUPINFO(); si.dwFlags |= subprocess.STARTF_USESHOWWINDOW; si.wShowWindow = 7
        kw = {"creationflags": subprocess.CREATE_NEW_CONSOLE, "startupinfo": si}
    global PROC
    logf = os.path.join(ps.OUT_DIR, "자체모델_학습.txt")
    lf = open(logf, "a", encoding="utf-8"); lf.write("\n=== %s 시작 ===\n" % time.strftime("%Y-%m-%d %H:%M")); lf.flush()
    kw.pop("creationflags", None); kw.pop("startupinfo", None)      # 창 없이 뒤에서, 글은 기록 파일로
    if os.name == "nt":
        kw["creationflags"] = 0x08000000                             # 창 안 띄움
    PROC = subprocess.Popen([ENV_PY, "-u", os.path.join(STU, "train_student.py"), "학습", "40"], cwd=STU, stdout=lf, stderr=subprocess.STDOUT,
                            env=dict(os.environ, PYTHONIOENCODING="utf-8"), **kw)
    json.dump({"상태": "학습중", "시작": time.time(), "정답지": n}, open(TRAIN_MARK, "w", encoding="utf-8"), ensure_ascii=False)
    note("자체 모델 학습 시작 (정답지 %d장, 기록 %s)" % (n, logf))
    print("자체 모델 학습을 뒤에서 시작했습니다(기록: D:\\croll\\기록\\채점\\자체모델_학습.txt) — 정답지 %d장. 끝나면 도구_후보 에 들어가 빠른 판으로 겨룹니다." % n, flush=True)
    return True


PROC = None


def train_done():
    """학습이 끝났으면 표시를 고친다"""
    if PROC is not None and PROC.poll() is not None:
        st = ps.read_json(TRAIN_MARK, {}) or {}
        st["상태"] = "끝남"
        import json
        json.dump(st, open(TRAIN_MARK, "w", encoding="utf-8"), ensure_ascii=False)
        note("자체 모델 학습 끝남 (끝난 코드 %s)" % PROC.returncode)


def widen_tune():
    """자동 조정 기록을 보관하고 비워 다시 넓게 — 하루에 한 번까지"""
    import plan_tune as pt, shutil
    mark = os.path.join(ps.OUT_DIR, "조정_다시_한날.txt")
    today = time.strftime("%Y-%m-%d")
    try:
        if open(mark, encoding="utf-8").read().strip() == today:
            return False
    except Exception:
        pass
    if os.path.exists(pt.LOG):
        shutil.copy(pt.LOG, pt.LOG + "." + time.strftime("%Y%m%d_%H%M") + ".보관")
        os.remove(pt.LOG)
    open(mark, "w", encoding="utf-8").write(today)
    note("자동 조정 기록을 보관하고 처음부터 다시 시험")
    return True


def run_harness():
    """2026-11-13 하네스 점검 — 30분마다 약속(공개 도면 최신 판·속도·받기 멈춤·자체 모델 패배 등)을 검사해 기록\하네스_점검.txt 에"""
    try:
        f = os.path.join(ps.ROOT, "기록", "하네스_점검.txt")
        if os.path.exists(f) and time.time() - os.path.getmtime(f) < 30 * 60:
            return
        import subprocess
        subprocess.call([sys.executable, os.path.join(ps.ROOT, "코드", "변환", "tools", "harness", "harness_check.py")], timeout=600)
    except Exception as e:
        note("하네스 점검 오류: " + str(e)[:200])


def run_ocr_trial():
    """2026-11-13 한국어 글자 인식 시험 한 번(결과 파일이 없을 때만) — 학습 환경 파이썬으로, 뒤에서"""
    try:
        out = os.path.join(ps.ROOT, "기록", "채점", "글자인식_시험.txt"); flag = out + ".돌림"
        if os.path.exists(out) or (os.path.exists(flag) and time.time() - os.path.getmtime(flag) < 3 * 3600):
            return
        py = os.path.join(ps.ROOT, "학습", "환경", "Scripts", "python.exe")
        if not os.path.exists(py): py = sys.executable
        open(flag, "w", encoding="utf-8").write(time.strftime("%Y-%m-%d %H:%M"))
        import subprocess
        lf = open(os.path.join(ps.ROOT, "기록", "채점", "글자인식_시험_log.txt"), "a", encoding="utf-8")
        subprocess.Popen([py, "-u", os.path.join(ps.ROOT, "코드", "변환", "tools", "harness", "ocr_trial.py"), "60"], stdout=lf, stderr=subprocess.STDOUT)
        note("한국어 글자 인식 시험 시작 (60장, 결과 기록\\채점\\글자인식_시험.txt)")
    except Exception as e:
        note("글자 인식 시험 못 띄움: " + str(e)[:200])


def prep():
    """바퀴마다 먼저 — 정답지(실제·합성)를 늘리고, 늘었으면 자체 모델을 뒤에서 학습. 할 것이 없으면 바로 지나간다"""
    run_harness()
    run_ocr_trial()
    try:
        train_done()
        a = run_rescreen()
        b = run_synth()
        c = run_student()
        return a or b or c
    except Exception as e:
        note("정답지·학습 준비 오류: " + str(e)[:200])
        return False


def idle():
    """조정할 값이 없을 때 할 일 — 이미 돌고 있던 옛 이어 돌리기도 plan_tune 을 거쳐 이것을 부른다"""
    note("조정할 값 없음 → 합성 정답지 %d장 · 변환 도면 %d장 · 학습 환경 %s" % (count(SYN), count(DRAW), "있음" if os.path.exists(ENV_PY) else "없음"))
    train_done()
    if run_rescreen() or run_synth() or run_student():
        return 0
    if widen_tune():
        return 0
    beat("할 일 없음 — 자체 모델 학습 중이거나 새 도면을 기다림")
    return 0


def main():
    if alive() and "force" not in sys.argv:
        print("이미 돌고 있습니다.")
        return 0
    global _IN_LOOP
    _IN_LOOP = True
    print("도면 인식 이어 돌리기를 시작합니다. 이 창은 작게 두셔도 됩니다. (멈춤: D:\\croll\\학습\\이어돌리기_멈춤.txt 만들기)")
    note("시작")
    fails = 0
    while True:
        if os.path.exists(STOP):
            note("멈춤 파일이 있어 끝냄")
            break
        try:
            import importlib, plan_quick, plan_tune
            importlib.reload(ps)            # 채점 단계·도구가 바뀌면 다음 바퀴부터 따라간다
            importlib.reload(plan_quick)
            importlib.reload(plan_tune)
            sys.argv = [sys.argv[0]]
            prep()
            if has_cand():
                beat("빠른 판"); plan_quick.main()
            elif tune_left():
                beat("자동 조정"); plan_tune.main()
            else:
                idle()
            fails = 0
        except Exception as e:
            fails += 1
            note("오류: " + str(e)[:200])
            traceback.print_exc()
            if fails >= 5:
                note("오류가 연달아 5번 나서 끝냄(다음 통합 실행 때 다시 시작)")
                break
        beat("쉼")
        time.sleep(REST)
    try:
        os.remove(BEAT)
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
