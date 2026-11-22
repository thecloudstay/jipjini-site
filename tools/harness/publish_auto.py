# -*- coding: utf-8 -*-
r"""통과 도면 누리집 자동 공개 — 대표 컴퓨터가 스스로 깃허브에 올리고 합친다(2026-11-14 대표 「컴퓨터에 깃허브 올리기 설정, 너가 다 셋팅해」).
   클로드 점검이 도면 파일을 옮기던 일을 없애 토큰을 아낀다. 매시간 예약(croll_publish)이 부른다.
   1 누리집 저장소(D:\croll\누리집\jipjini-site)를 최신으로 2 상태.json(+변환 중인 줄의 조각)에서 기준을 넘은 평형만
   저장소의 publish_pc.py 로 data/plans 에 더함(원본 그림은 싣지 않음 — 다시 그린 도면만) 3 apt_ready.py 로 합계 갱신
   4 바뀐 게 있으면 가지 → 올림 → 끌어오기 요청 → 합치기 5 공개목록.json 갱신 · 결과는 D:\croll\기록\공개_자동.txt"""
import json, os, subprocess, sys, time, glob

CROLL = r"D:\croll"
REPO = os.path.join(CROLL, "site", "jipjini-site")
OUT = os.path.join(CROLL, "자료", "변환")
LIST = os.path.join(CROLL, "자료", "원본_목록.csv")
LOG = os.path.join(CROLL, "기록", "공개_자동.txt")
LOCK = os.path.join(CROLL, "기록", "공개_자동.잠금")
ENV = dict(os.environ, PATH=os.environ.get("PATH", "") + r";C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI",
           GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="never", GH_PROMPT_DISABLED="1")   # 2026-11-17 창 없이 돌 때 로그인 묻기로 영원히 멈추던 것 막음
NOWIN = 0x08000000 if os.name == "nt" else 0


def log(s):
    line = time.strftime("%Y-%m-%d %H:%M ") + s
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def sh(args, check=True, t=240):
    # 2026-11-17 11/17 00:30 뒤 공개 올리기가 소식 없이 멈춤 — git·gh 가 네트워크에서 끝없이 기다리면 이 작업이 영영 안 끝났다. 모든 명령에 시간 제한
    try:
        p = subprocess.run(args, cwd=REPO, env=ENV, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=t, creationflags=NOWIN)
    except subprocess.TimeoutExpired:
        raise RuntimeError(" ".join(args[:3]) + " → 시간 초과 %d초(네트워크·깃허브 응답 없음)" % t)
    if check and p.returncode:
        raise RuntimeError(" ".join(args[:3]) + " → " + (p.stderr or p.stdout)[-300:])
    return p.stdout


def main():
    if os.path.exists(LOCK) and time.time() - os.path.getmtime(LOCK) < 3600:
        log("건너뜀: 앞 회차가 아직 도는 중(잠금 %d분째)" % ((time.time() - os.path.getmtime(LOCK)) // 60)); return 0
    open(LOCK, "w").write(str(os.getpid()))
    try:
        if not os.path.isdir(os.path.join(REPO, ".git")):
            log("설정 필요: 누리집 저장소가 없습니다 — D:\\croll\\실행\\깃허브_설정.bat 을 한 번 실행"); return 1
        try:
            _auth = subprocess.run(["gh", "auth", "status"], env=ENV, capture_output=True, timeout=60, creationflags=NOWIN).returncode
        except subprocess.TimeoutExpired:
            log("오류: 깃허브 확인 시간 초과(인터넷 끊김?) — 다음 시간에 다시"); return 1
        if _auth:
            log("설정 필요: 깃허브 로그인이 안 됐습니다 — D:\\croll\\실행\\깃허브_설정.bat 을 한 번 실행"); return 1
        sh(["git", "checkout", "-q", "main"]); sh(["git", "reset", "-q", "--hard", "origin/main"]); sh(["git", "pull", "-q", "--ff-only"])
        # 변환 중인 여러 줄의 조각 결과까지 합친 상태로 고른다(원본 상태.json 은 건드리지 않음)
        st = json.load(open(os.path.join(OUT, "상태.json"), encoding="utf-8"))
        for f in glob.glob(os.path.join(OUT, "상태_조각*.json")):
            try: st.update(json.load(open(f, encoding="utf-8")))
            except Exception: pass
        tmp = os.path.join(CROLL, "자료", "변환_공개준비"); os.makedirs(tmp, exist_ok=True)
        json.dump(st, open(os.path.join(tmp, "상태.json"), "w", encoding="utf-8"), ensure_ascii=False)
        link = os.path.join(tmp, "도면")
        if not os.path.exists(link):
            subprocess.run(["cmd", "/c", "mklink", "/J", link, os.path.join(OUT, "도면")], capture_output=True)
        py = sys.executable
        out = subprocess.run([py, os.path.join(REPO, "tools", "harness", "publish_pc.py"), tmp, LIST], cwd=REPO, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800, creationflags=NOWIN)
        if out.returncode:
            log("공개 고르기 실패: " + (out.stderr or out.stdout)[-300:]); return 1
        # 2026-11-16 대표 「왜 아직 1205개밖에」: 지도 「평면 확보」가 대장을 안 따라가던 것 — 수집 대장으로 먼저 매기고(apt_have 가 apt_ready 까지 부름) 없으면 예전대로
        _led = os.path.join(CROLL, "자료", "plan_ledger.json"); _have = os.path.join(REPO, "tools", "apt_have.py")
        if os.path.exists(_led) and os.path.exists(_have):
            subprocess.run([py, _have, _led], cwd=REPO, capture_output=True, timeout=900, creationflags=NOWIN)
        else:
            subprocess.run([py, os.path.join(REPO, "tools", "apt_ready.py")], cwd=REPO, capture_output=True, timeout=900, creationflags=NOWIN)
        if not sh(["git", "status", "--porcelain", "data"]).strip():
            log("새로 열 도면 없음"); return 0
        sys.path.insert(0, os.path.join(REPO, "tools", "harness")); import publish_pc
        keys = sorted(k for k, v in st.items() if publish_pc.ok(v))
        tot = json.load(open(os.path.join(REPO, "data", "apt", "index.json"), encoding="utf-8")).get("합계")
        summ = (out.stdout.strip().splitlines() or [""])[-1]
        br = "plans-auto-" + time.strftime("%Y%m%d%H%M")
        sh(["git", "checkout", "-q", "-b", br]); sh(["git", "add", "data"])
        msg = "도면 자동 공개 · %s · 합계 %s\n\n대표 컴퓨터 일괄 변환에서 기준(85점 이상·통과/예외·주방 과대/창 없는 방/욕실 놓침 없음)을 넘은 평형만. 원본 그림은 싣지 않음.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" % (summ, tot)
        sh(["git", "-c", "user.name=jipjini-bot", "-c", "user.email=thecloudstay@gmail.com", "commit", "-q", "-m", msg])
        sh(["git", "push", "-q", "origin", br])
        sh(["gh", "pr", "create", "--title", "도면 자동 공개 " + time.strftime("%m-%d %H:%M"), "--body", summ + "\n\n🤖 대표 컴퓨터 자동 공개(publish_auto.py)", "--base", "main", "--head", br])
        sh(["gh", "pr", "merge", br, "--squash", "--delete-branch"])
        sh(["git", "checkout", "-q", "main"]); sh(["git", "pull", "-q", "--ff-only"])
        json.dump(keys, open(os.path.join(OUT, "공개목록.json"), "w", encoding="utf-8"), ensure_ascii=False)
        log("공개 · %s · 합계 %s" % (summ, tot))
        return 0
    except Exception as e:
        log("오류: " + str(e)[:300]); return 1
    finally:
        try: os.remove(LOCK)
        except OSError: pass


def hide_once():
    """2026-11-14 대표 「게임하다가 자꾸 튕김」: 매시간 이 작업이 명령 창을 앞으로 띄운다. 예약 작업 셋을 창 없이 다시 거는 run_all.hide_tasks 를
    통합 실행이 오래 걸려 못 부르고 있었다 → 이 작업(매시간 확실히 도는 것)에서도 한 번 부른다. 한 번 성공하면 표시 파일이 남아 다시 안 한다."""
    try:
        sys.path.insert(0, os.path.join(CROLL, "코드"))
        import run_all
        run_all.hide_tasks()
    except Exception as e:
        try:
            with open(os.path.join(CROLL, "기록", "예약_숨김_시도.txt"), "a", encoding="utf-8") as f:
                f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + "공개 작업에서 부름 실패: " + str(e)[:200] + "\n")
        except Exception:
            pass


def onbid_once():
    """2026-11-14 대표 「공매는 공식 연동창구로 바로 — 고고」: 온비드 공매 아파트 감시를 하루 한 번(onbid_watch.py 가 날짜 표시로 스스로 거름).
    창 없이 따로 띄우고 바로 돌아온다 — 공개 작업 시간을 잡아먹지 않게."""
    try:
        import subprocess
        code = os.path.join(CROLL, "코드", "onbid_watch.py")
        if os.path.exists(code):
            subprocess.Popen([sys.executable, code], cwd=os.path.join(CROLL, "자료"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             creationflags=(0x08000000 | 0x00000008) if os.name == "nt" else 0)
    except Exception:
        pass


if __name__ == "__main__":
    hide_once()
    onbid_once()
    sys.exit(main())
