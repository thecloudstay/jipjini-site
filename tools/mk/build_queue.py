"""집지니 마케팅 팀 ⑤ 내보내기 — 검수 통과한 주간 글(mk/queue/*.json)을 jipjini.com/mk/queue.json 하나로 묶는다.
콘솔(앱스 스크립트 mkImportQueue_)이 이 파일을 한 시간마다 읽어 「마케팅 자료」 시트에 「게시 예정」으로 넣고,
pubTick_ 이 예약시각(09~20시)에 인스타그램·스레드에 올린다. 사람 손 없음."""
import json, glob, os, datetime, subprocess, sys
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
out, cut = [], (datetime.datetime.now() - datetime.timedelta(days=2)).strftime("%Y-%m-%d")
for f in sorted(glob.glob(os.path.join(ROOT, "mk", "queue", "*.json"))):
    if subprocess.run([sys.executable, os.path.join(ROOT, "tools", "mk", "check.py"), f], capture_output=True).returncode:
        print("검수 실패라 뺌:", f); continue
    for it in json.load(open(f, encoding="utf-8"))["글"]:
        if it["예약시각"][:10] < cut: continue
        out.append({k: it.get(k) for k in ("id", "예약시각", "제목", "본문", "스레드", "링크", "사진")})
json.dump({"만든시각": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "글": out}, open(os.path.join(ROOT, "mk", "queue.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("내보냄", len(out), "편")
