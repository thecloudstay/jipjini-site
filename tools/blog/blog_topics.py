# -*- coding: utf-8 -*-
"""다음 블로그 글 주제 고르기 + 글감(숫자·사실) 묶음 만들기 (2026-11-17)

주 2편 번갈아: 도면견적(도면 한 장 → 물량 → 견적 → 턴키 대비 절감) ↔ 셀인대행 → 실견적 → 누수 → 경매 차례
같은 주제는 다시 쓰지 않는다(대장의 주제키). 고른 결과를 글감 파일로 남긴다:
  python3 tools/blog/blog_topics.py [종류]   → tools/blog/_facts.json (클로드가 이것만 보고 글을 쓴다)
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from blog_ledger import BlogLedgerManager, ErrorCode  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
KST = timezone(timedelta(hours=9))
FACTS = Path(__file__).resolve().parent / "_facts.json"
FRI_ROT = ["셀인대행", "실견적", "누수", "경매"]   # 2026-11-17 대표 「비용 해설보다 셀인·셀인대행 + 도면 자동화 + 30% 절감으로 다각화」


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def won(n):
    n = int(round(n / 10000.0))
    return f"{n:,}만 원"


def pick_kind(m, arg=None):
    """주 2편을 번갈아: 단지 공사비 → (누수 → 경매 → 실견적 차례) → 단지 공사비 …(요일과 무관)"""
    if arg:
        return arg
    live = [r for r in m.records if r.get("상태") != "보류"]
    if not live or live[-1].get("종류") not in ("도면견적", "단지공사비"):
        return "도면견적"
    done_rot = [r for r in live if r.get("종류") in FRI_ROT]
    return FRI_ROT[len(done_rot) % len(FRI_ROT)]


def complexes():
    d = load("data/apt-costs.json")["목록"]
    g = {}
    for r in d:
        g.setdefault(r["단지번호"], []).append(r)
    return g


def age_of(y):
    try:
        return datetime.now(KST).year - int(y)
    except Exception:
        return 0


def pick_complex(m, prefix, prefer_old=False):
    used = m.used_keys()
    used_codes = {k.split(":", 1)[1] for k in used if k and ":" in k}   # 한 단지는 어떤 주제로든 한 번만(글이 겹치지 않게)
    g = complexes()
    cand = []
    for code, ts in g.items():
        if f"{prefix}:{code}" in used or code in used_codes:
            continue
        r0 = ts[0]
        hh = int(r0.get("세대") or 0)
        age = age_of(r0.get("사용승인"))
        score = hh + (age * 80 if prefer_old else 0)
        cand.append((score, code))
    cand.sort(reverse=True)
    return (cand[0][1], g[cand[0][1]]) if cand else (None, None)


def takeoff(code, type_name):
    """집지니 도면(data/plans/<단지>.json)에서 공사 물량을 바로 뽑는다 — 「도면 한 장으로 견적까지」 글의 근거"""
    import math
    try:
        d = json.loads((ROOT / "data" / "plans" / f"{code}.json").read_text(encoding="utf-8"))
        t = next(x for x in d["평형"] if str(x["이름"]) == str(type_name))
        p = t["plan"]; mmpp = float(p.get("mmpp") or 0)
    except Exception:
        return None
    if not mmpp:
        return None
    def per(pts):
        return sum(math.dist(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))) * mmpp / 1000.0
    dry = wet = 0.0; dry_per = wet_per = 0.0; nb = nr = 0
    for r in p.get("rooms", []):
        k = r.get("kind", ""); a = float(r.get("area") or 0); pr = per(r.get("pts") or [])
        if k == "욕실":
            wet += a; wet_per += pr; nb += 1
        elif k in ("발코니", "실외기", "피트"):
            continue
        else:
            dry += a; dry_per += pr; nr += k == "방"
    doors = len(p.get("문") or [])
    wall = dry_per * 2.3 * 0.85               # 창·문 자리 15% 뺌
    return {"바닥 마루(㎡)": round(dry, 1), "도배 벽(㎡)": round(wall, 1), "도배 천장(㎡)": round(dry, 1),
            "실크 벽지(롤)": math.ceil((wall + dry) / 10.5), "걸레받이(m)": round(max(0, dry_per - doors * 0.9), 1),
            "욕실 수": nb, "욕실 바닥 타일(㎡)": round(wet, 1), "욕실 벽 타일(㎡)": round(wet_per * 2.3 * 0.9, 1),
            "방 수": nr, "문 수(도면)": doors,
            "설명": "집지니가 다시 그린 도면의 방 둘레·넓이로 셈(천장 높이 2.3m, 창·문 자리 15% 뺌, 벽지 1롤 10.5㎡)"}


def facts_complex(kind, code, ts):
    r0 = ts[0]
    try:
        sys.path.insert(0, str(ROOT / "tools"))
        from apt_pages import age_notes
        notes = age_notes(r0.get("사용승인"), r0.get("세대"))
    except Exception:
        notes = []
    types = []
    for t in sorted(ts, key=lambda x: x["전용"]):
        types.append({
            "평형": t["평형"], "전용㎡": t["전용"], "공급평": t["공급평"], "쪽": t["url"],
            "올수리기본": won(t["올수리기본"]), "범위": f"{won(t['낮게'])} ~ {won(t['높게'])}",
            "샷시포함": won(t["샷시포함"]), "코디비": won(t["코디비"]), "턴키추정": won(t["턴키추정"]),
            "누수": [[a, won(b)] for a, b in t.get("누수", [])],
            "경매": {k: [won(x) for x in v] for k, v in t.get("경매", {}).items()},
        })
    main = max(ts, key=lambda x: -abs(x["전용"] - 84))     # 84㎡에 가장 가까운 평형을 대표로
    return {
        "종류": kind, "단지": r0["단지"], "단지번호": code, "지역": r0["지역"], "사용승인": r0.get("사용승인"),
        "연차": age_of(r0.get("사용승인")), "세대": r0.get("세대"), "대표평형": main["평형"],
        "대표쪽": main["url"], "단지쪽": f"https://jipjini.com/apt/{code}/",
        "누수쪽": f"https://jipjini.com/apt/{code}/leak.html", "경매쪽": f"https://jipjini.com/apt/{code}/auction.html",
        "평형들": types, "먼저볼곳": notes, "도면물량": takeoff(code, main["평형"]),
        "절감": {"턴키추정": won(main["턴키추정"]), "직접거래+코디비": won(main["올수리기본"] + main["코디비"]),
                 "아끼는 돈": won(main["턴키추정"] - main["올수리기본"] - main["코디비"]),
                 "공사비만 비교(%)": round((1 - main["올수리기본"] / main["턴키추정"]) * 100),
                 "코디비까지 넣어(%)": round((1 - (main["올수리기본"] + main["코디비"]) / main["턴키추정"]) * 100)},
        "그림": {"도면": main["url"], "단지": f"https://jipjini.com/apt/{code}/"},
    }


def facts_case(m):
    used = m.used_keys()
    cs = [c for c in load("data/real-quotes.json")["cases"] if f"case:{c['key']}" not in used and c.get("file")]
    if not cs:
        return None
    c = sorted(cs, key=lambda x: x.get("ymd", ""), reverse=True)[0]
    secs = []
    for s in c.get("sections", [])[:16]:
        if not isinstance(s, dict): continue
        lines = [[x.get("item", ""), won(x.get("amount") or 0)] for x in (s.get("lines") or []) if isinstance(x, dict)]
        secs.append({"공종": s.get("trade") or s.get("name") or "", "줄": lines[:8],
                     "합계": won(sum((x.get("amount") or 0) for x in (s.get("lines") or []) if isinstance(x, dict)))})
    return {"종류": "실견적", "주제키": f"case:{c['key']}", "지역": c["region"], "평": c["py"], "주거": c.get("type"),
            "방식": c.get("method"), "계약": c.get("contracted"), "총액": won(c["total"]), "코디비": won(c.get("codi") or 0),
            "현장관리": won(c.get("pm") or 0), "공종": secs, "쪽": "https://jipjini.com/" + c["file"], "날짜": c.get("ymd")}


def main():
    m = BlogLedgerManager()
    kind = pick_kind(m, sys.argv[1] if len(sys.argv) > 1 else None)
    out = None
    if kind in ("도면견적", "단지공사비", "셀인대행"):
        code, ts = pick_complex(m, "apt")
        if code: out = facts_complex(kind, code, ts); out["주제키"] = f"apt:{code}"
    elif kind == "누수":
        code, ts = pick_complex(m, "leak")
        if code: out = facts_complex(kind, code, ts); out["주제키"] = f"leak:{code}"
    elif kind == "경매":
        code, ts = pick_complex(m, "auction", prefer_old=True)
        if code: out = facts_complex(kind, code, ts); out["주제키"] = f"auction:{code}"
    elif kind == "실견적":
        out = facts_case(m)
        if not out:   # 실견적이 바닥나면 누수로
            code, ts = pick_complex(m, "leak")
            if code: out = facts_complex("누수", code, ts); out["주제키"] = f"leak:{code}"
    if not out:
        print(f"[{ErrorCode.ERR_NO_TOPIC.value}] {kind}: 쓸 주제가 없습니다"); return 1
    day = datetime.now(KST).strftime("%Y-%m-%d")
    out["글번호"] = f"{day}-{out['주제키'].replace(':', '-')}"
    FACTS.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"주제: {out['종류']} · {out.get('단지') or out.get('지역')} · 글번호 {out['글번호']} → {FACTS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
