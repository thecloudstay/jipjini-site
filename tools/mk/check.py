"""집지니 마케팅 팀 ④ 검수 — 통과(PASS) 못 하면 올라가지 않는다.
쓰임: python3 tools/mk/check.py mk/queue/<주>.json   (실패 시 종료 코드 1, 무엇이 왜 틀렸는지 줄마다)
규칙: 숫자는 mk/facts.json 에 있는 것만 · 공사비 글은 「부가세 10% 별도」 · 이모지·과장 금지어 없음 · 길이 · 카드 3~7장(첫 장 hook, 끝 장 cta) · 링크는 jipjini.com · 사진 파일 있음"""
import json, re, sys, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
BAN = ["보장합니다", "최저가 보장", "무조건 싸", "100%", "업계 1위"]   # 2026-11-28 대표 「헐 미친 대박 등 … 더욱더 쌔고 자극적으로」 — 감탄·병맛은 허용, 사실을 장담하는 말만 막음
EMOJI = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u2B55]")
OK_N = {"1", "2", "3", "10", "30", "2026", "2027"}

def nums(s):
    return {re.sub(r"[,]", "", m).rstrip(".") for m in re.findall(r"\d[\d,]*(?:\.\d+)?", s or "")}

def main(qf):
    q = json.load(open(qf, encoding="utf-8")); fx = json.load(open(ROOT / "mk" / "facts.json", encoding="utf-8"))["소재"]
    allow = set(OK_N)
    for f in fx:
        allow |= nums(f["한줄"]) | nums(json.dumps(f["숫자"], ensure_ascii=False))
    bad = []
    for it in q.get("글", []):
        i = it.get("id", "?"); cs = it.get("카드") or []
        txt = " ".join([it.get("제목", ""), it.get("본문", ""), it.get("스레드", "")] + [" ".join(str(c.get(k, "")) for k in ("t", "s", "n", "u")) + " " + " ".join(" ".join(map(str, b)) for b in c.get("bars", []) + c.get("chat", []) + c.get("rows", [])) for c in cs])
        if not re.match(r"^\d{4}-\d\d-\d\d \d\d:\d\d$", it.get("예약시각", "")): bad.append(f"{i}: 예약시각 형식(yyyy-MM-dd HH:mm)")
        if not (3 <= len(cs) <= 7): bad.append(f"{i}: 카드 {len(cs)}장 (3~7장)")
        elif cs[0].get("k", "hook") not in ("hook", "chat", "bill") or cs[-1].get("k") != "cta": bad.append(f"{i}: 첫 장은 hook, 끝 장은 cta")
        if len(it.get("본문", "")) > 2000: bad.append(f"{i}: 인스타 본문 2,000자 넘음")
        if not it.get("스레드") or len(it["스레드"]) > 450: bad.append(f"{i}: 스레드 글 없음 또는 450자 넘음")
        if not str(it.get("링크", "")).startswith("https://jipjini.com"): bad.append(f"{i}: 링크는 jipjini.com 깊은 쪽으로")
        extra = sorted(n for n in nums(txt) - allow if not re.fullmatch(r"\d{1,2}", n) or int(n) > 12)
        if extra: bad.append(f"{i}: 소재에 없는 숫자 {extra} — facts.json 숫자만 쓴다")
        for w in BAN:
            if w in txt: bad.append(f"{i}: 금지어 「{w}」")
        if EMOJI.search(txt): bad.append(f"{i}: 이모지")
        if re.search(r"[A-Za-z]{3,}", re.sub(r"https?://\S+|jipjini\.com\S*|CAD", "", txt)): bad.append(f"{i}: 영어 낱말")
        if any(f.startswith("cost") for f in it.get("소재", [])) and "부가세 10% 별도" not in txt: bad.append(f"{i}: 공사비 글은 「부가세 10% 별도」")
        for u in it.get("사진", []):
            if not (ROOT / "mk" / "img" / u.rsplit("/", 1)[-1]).exists(): bad.append(f"{i}: 사진 파일 없음 {u}")
    print("\n".join(["검수 실패 " + str(len(bad)) + "건"] + bad) if bad else f"검수 통과 — {len(q.get('글', []))}편")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
