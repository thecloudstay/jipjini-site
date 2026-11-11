# -*- coding: utf-8 -*-
"""집지니 CAD 물량 산출용 대응표 내보내기.
콘솔 저장소의 「정밀 의뢰서 선택지」(intake_labels.gs)와 「물량 묶음표」(sku_bundle.gs · sku_bundle_extended.gs)를 읽어
사이트의 data/takeoff-map.json 을 만든다. 단가는 내보내지 않는다(수량 계수와 이름·단위만).
콘솔에서 묶음표를 고치면 이 파일을 다시 돌려 사이트에 올린다 — 표는 콘솔 한 곳에만 둔다.

쓰는 법:  python tools/takeoff_export.py <콘솔 저장소의 console/src 경로>
"""
import json, os, re, sys, time

SRC = sys.argv[1] if len(sys.argv) > 1 else "../jipjini-console/console/src"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "takeoff-map.json")


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


labels = read("intake_labels.gs")
# 공사(16) 이름
works = {}
for wid, lab in re.findall(r"\{ id: '([a-z]+)',\s*label: '([^']+)'", labels[: labels.index("var INTAKE_WORK_CATEGORIES")]):
    works[wid] = re.sub(r"\s*\(.*\)$", "", lab)
# 묶음(01~12)
cats = []
for name, ids in re.findall(r"\{ name: '([^']+)', workIds: \[([^\]]*)\] \}", labels):
    no, nm = name.split(None, 1)
    cats.append({"no": no, "name": re.sub(r"\s+", " ", nm.strip()), "works": re.findall(r"'([a-z]+)'", ids)})
# 선택지
tree = labels[labels.index("var INTAKE_OPTION_TREE"):]
items, cur, grp = {}, None, ""
for line in tree.splitlines():
    m = re.match(r"\s*'([a-zA-Z가-힣]+)':\s*\{", line)
    if m:
        cur = m.group(1) if re.match(r"[a-z]", m.group(1)) else None
    g = re.search(r"\{ name: '([^']+)'", line)
    if g:
        grp = re.sub(r"\s*\(.*\)$", "", g.group(1))
    if not cur:
        continue
    for oid, lab in re.findall(r"\{ id: '([^']+)',\s*label: '([^']+)'", line):
        items[cur + "." + oid] = {"work": cur, "group": grp, "label": lab, "measure": None, "unit": "", "mats": [], "labor": []}

# 자재 이름·규격·단위 (단가는 버린다)
ext = read("sku_bundle_extended.gs")
mats = {}
for k, n, spec, _price, u in re.findall(r"\[\s*'((?:mat|hw|demo|prep|svc)\.[A-Za-z0-9.]+)',\s*'([^']*)',\s*'([^']*)',\s*([0-9.]+),\s*'([^']*)'\s*\]", ext):
    mats[k] = {"n": re.sub(r"\s*\[도급재\]", "", n), "spec": spec, "u": u}

# 묶음표: [키, 이름, 재는 방법, 단위, 자재 키, 자재 수량, 자재 단위, 품 종류, 품(일), 비고, 활성]
row = re.compile(r"\[\s*'([a-zA-Z]+\.[A-Za-z0-9.]+)',\s*'([^']*)',\s*'(area|count|perim|flag|volume)',\s*'([^']*)',\s*'([^']*)',\s*([0-9.]+|''|null),\s*'([^']*)',\s*'([^']*)',\s*([0-9.]+|''|null),\s*'([^']*)',\s*'([YN])'")
extra = {}
for src in (read("sku_bundle.gs"), ext):
    for k, lab, mv, u, sub, q, su, lb, ld, note, act in row.findall(src):
        if act != "Y" or re.search(r"OLD|DEPRECATED|deprecated", lab):
            continue
        it = items.get(k)
        if it is None:      # 의뢰서에는 없지만 묶음표에 있는 키(견적에서만 쓰는 것)도 실어 둔다
            it = extra.setdefault(k, {"work": k.split(".")[0], "group": "", "label": re.sub(r"\s*\[도급재\]|\s*1(㎡|m|개|개소|식|대|짝|회|톤)\b.*$", "", lab), "measure": None, "unit": "", "mats": [], "labor": [], "extra": True})
        it["measure"] = {"area": "면적", "perim": "길이", "count": "개수", "volume": "부피", "flag": "식"}[mv]
        it["unit"] = u
        if sub and q not in ("''", "null") and float(q) > 0 and not any(x["k"] == sub for x in it["mats"]):
            mm = mats.get(sub, {})
            it["mats"].append({"k": sub, "n": mm.get("n", sub), "spec": mm.get("spec", ""), "q": float(q), "u": su or mm.get("u", "")})
        if lb and ld not in ("''", "null") and float(ld) > 0 and not any(x["n"] == lb for x in it["labor"]):
            it["labor"].append({"n": lb, "d": float(ld)})
items.update(extra)
out = {"ver": time.strftime("%Y-%m-%d"), "note": "콘솔 물량 묶음표에서 단가를 빼고 내보낸 것. 고치려면 콘솔 묶음표를 고친 뒤 tools/takeoff_export.py 를 다시 돌린다.",
       "cats": cats, "works": works, "items": items}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
n_req = sum(1 for v in items.values() if not v.get("extra"))
print(f"묶음 {len(cats)} · 공사 {len(works)} · 의뢰서 선택지 {n_req} (물량 기준 있는 것 {sum(1 for v in items.values() if not v.get('extra') and v['measure'])}) · 그 밖 {len(extra)} → {OUT} {os.path.getsize(OUT)}바이트")
