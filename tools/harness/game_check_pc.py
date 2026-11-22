# -*- coding: utf-8 -*-
"""게임 중인지 한곳에서 판단한다 (2026-11-22 대표 「게임하다 끊긴다」).
원인: 예전에는 대전 화면(League of Legends.exe)이 떠 있는 순간만 게임으로 봤다. 판과 판 사이(대기실·챔피언 고르기)에는 그 프로그램이 없어서
      정시 통합 실행이 변환 4줄과 도면 학습을 다시 띄웠고, 다음 판이 시작될 때 처리기와 램을 다 쓰고 있었다.
지금: ① 게임모드.bat 이 남기는 game_on.txt 가 6시간 안이면 게임 중
      ② 대전 화면이 떠 있으면 게임 중
      ③ 대기실(LeagueClient.exe·Riot Client)이 켜져 있고, 최근 10분 안에 키보드·마우스를 만졌으면 게임 중
         (대기실을 켜 둔 채 자리를 비우면 10분 뒤부터 다시 일한다 — 밤새 9시간 멈추던 문제는 그대로 막는다)
"""
import os, subprocess, time
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN_GAME = ("league of legends.exe",)
LOBBY = ("leagueclient.exe", "leagueclientux.exe", "riotclientservices.exe", "riot client.exe")
IDLE_OK = 600


def idle_seconds():
    try:
        import ctypes
        class LII(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]
        x = LII(); x.cbSize = ctypes.sizeof(LII)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(x)): return 0
        return max(0, (ctypes.windll.kernel32.GetTickCount() - x.dwTime) / 1000.0)
    except Exception:
        return 0


def gaming(tasklist_out=None):
    if os.name != "nt": return False
    try:
        if time.time() - os.path.getmtime(os.path.join(BASE, "game_on.txt")) < 6 * 3600: return True
    except OSError:
        pass
    out = tasklist_out
    if out is None:
        try:
            out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, errors="ignore", creationflags=0x08000000).stdout
        except Exception:
            return False
    out = (out or "").lower()
    if any(('"' + g + '"') in out for g in IN_GAME): return True
    if any(('"' + g + '"') in out for g in LOBBY) and idle_seconds() < IDLE_OK: return True
    return False


if __name__ == "__main__":
    print("게임 중" if gaming() else "게임 아님", "· 손 뗀 지", round(idle_seconds()), "초")
