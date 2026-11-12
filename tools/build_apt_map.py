# -*- coding: utf-8 -*-
"""아파트 지도 자료 만들기 (집지니 /apt/ 쪽).

입력(대표 컴퓨터 D:\\croll\\자료): public_complex_master.json(공동주택 공개 목록), plan_ledger.json(평면 수집 대장)
     + 시군구 경계(통계청 2018, southkorea-maps) + 있으면 좌표 파일 apt_coords.json({단지코드: [위도, 경도]})
출력: data/apt/index.json(시군구 경계·숫자), data/apt/<구역번호>.json(구역별 단지 목록)
쓰는 법: python3 tools/build_apt_map.py <자료 폴더> <시군구 경계 파일> [도면 준비 목록.json]
상태: 2 도면 준비됨(집지니 도면으로 바꿔 둠) · 1 준비 중(평면은 받음) · 0 예정
네이버 번호·원본 그림 주소는 싣지 않는다.
"""
import json, os, sys, time, collections
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

SRC, GEO = sys.argv[1], sys.argv[2]
_rp = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "plans", "index.json")
READY = set(json.load(open(_rp, encoding="utf-8"))) if os.path.exists(_rp) else set()      # 도면 준비됨: data/plans 에 집지니 도면이 있는 단지
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "apt")
SD = {"서울특별시": "11", "인천광역시": "23", "경기도": "31"}
SHORT = {"서울특별시": "서울", "인천광역시": "인천", "경기도": "경기"}
# 2018년 경계에 없는 요즘 이름 → 그 자리의 옛 구역. 경계 파일이 새로 나오면 이 표를 지운다.
ALIAS = {("23", "미추홀구"): "남구", ("23", "제물포구"): "동구", ("23", "영종구"): "중구", ("23", "서해구"): "서구", ("23", "검단구"): "서구",
         ("31", "부천원미구"): "부천시", ("31", "부천소사구"): "부천시", ("31", "부천오정구"): "부천시",
         ("31", "화성만세구"): "화성시", ("31", "화성효행구"): "화성시", ("31", "화성병점구"): "화성시", ("31", "화성동탄구"): "화성시"}
LABEL = {("23", "남구"): "미추홀구", ("23", "동구"): "제물포구", ("23", "중구"): "영종구", ("23", "서구"): "서해구·검단구"}
CITY = ["수원", "성남", "안양", "안산", "고양", "용인"]


def geo_name(sd, name):
    n = name.replace(" ", "")
    if (sd, n) in ALIAS:
        return ALIAS[(sd, n)]
    for c in CITY:
        if n.startswith(c) and not n.startswith(c + "시") and n.endswith("구"):
            return c + "시" + n[len(c):]
    return n


def rings(geom, tol):
    g = geom.simplify(tol, preserve_topology=True)
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    out = []
    for p in polys:
        if p.area < 2e-5:      # 작은 섬은 뺀다
            continue
        out.append([[round(x, 4), round(y, 4)] for x, y in p.exterior.coords])
    return out


geo = json.load(open(GEO, encoding="utf-8"))
regions = {}
for f in geo["features"]:
    c = f["properties"]["code"]
    if c[:2] not in ("11", "23", "31"):
        continue
    nm = f["properties"]["name"].replace(" ", "")
    g = shape(f["geometry"]).buffer(0)
    regions[(c[:2], nm)] = {"id": c, "sd": c[:2], "name": LABEL.get((c[:2], nm), f["properties"]["name"]), "g": g, "rows": []}

master = json.load(open(os.path.join(SRC, "public_complex_master.json"), encoding="utf-8"))
ledger = {r["단지코드"]: r for r in json.load(open(os.path.join(SRC, "plan_ledger.json"), encoding="utf-8"))}
coords = {}
cp = next((q for q in (os.path.join(SRC, "jipjini_apt_coords.json"), os.path.join(SRC, "apt_coords.json")) if os.path.exists(q)), "")
if cp:
    coords = json.load(open(cp, encoding="utf-8"))
miss = collections.Counter()
for m in master:
    code = str(m.get("complexNo"))
    sd = SD.get(m.get("sido"))
    reg = regions.get((sd, geo_name(sd, m.get("sigungu") or "")))
    led = ledger.get(code) or {}
    if led.get("상태") == "제외":
        continue
    if not reg:
        miss[(m.get("sido"), m.get("sigungu"))] += 1
        continue
    st = 2 if code in READY else 1 if led.get("상태") == "받음" else 0
    hh = m.get("households") or led.get("세대수") or 0
    row = {"c": code, "n": m.get("complexName") or "", "g": (m.get("sigungu") or ""), "d": m.get("eupmyeon") or "", "s": st,
           "h": int(hh or 0), "y": str(m.get("useApprovalDay") or led.get("사용승인") or "")[:4], "p": int(led.get("평형수") or 0) if st else 0}
    if st == 2:
        row["r"] = len(json.load(open(os.path.join(os.path.dirname(_rp), code + ".json"), encoding="utf-8"))["평형"])
    if m.get("roadAddress"):
        row["a"] = m["roadAddress"]
    if code in coords:
        row["ll"] = [round(coords[code][0], 5), round(coords[code][1], 5)]
    reg["rows"].append(row)

os.makedirs(OUT, exist_ok=True)
idx = {"만든날": time.strftime("%Y-%m-%d"), "판": time.strftime("%m%d%H%M"), "출처": "국토교통부 공동주택 단지 목록(공개 자료) · 경계 통계청 2018", "합계": [0, 0, 0], "좌표있음": 0, "구역": []}
for key, r in sorted(regions.items(), key=lambda kv: kv[1]["id"]):
    rows = sorted(r["rows"], key=lambda x: (-x["s"], -x["h"], x["n"]))
    cnt = [sum(1 for x in rows if x["s"] == k) for k in (0, 1, 2)]
    for k in range(3):
        idx["합계"][k] += cnt[k]
    idx["좌표있음"] += sum(1 for x in rows if "ll" in x)
    c = r["g"].representative_point()
    idx["구역"].append({"id": r["id"], "시도": [k for k, v in SD.items() if v == r["sd"]][0], "짧은시도": SHORT[[k for k, v in SD.items() if v == r["sd"]][0]],
                       "이름": r["name"], "수": cnt, "가운데": [round(c.x, 4), round(c.y, 4)], "경계": rings(r["g"], 0.0012)})
    json.dump(rows, open(os.path.join(OUT, r["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(idx, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("구역", len(idx["구역"]), "합계(예정·준비 중·준비됨)", idx["합계"], "좌표", idx["좌표있음"], "못 넣음", dict(miss))
