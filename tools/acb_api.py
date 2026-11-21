"""아관비 — 국토교통부 공동주택 관리비 연결(오픈 API) 점검·견본 받기 (2026-11-21)
키: 깃허브 비밀값 DATA_GO_KR_KEY (대표가 넣음, 코드·기록에 값은 남기지 않는다)
지금은 1단계: 키가 살아 있는지, 각 기능이 무엇을 돌려주는지 단지 하나로 견본을 받아 data/acb/api_sample.json 에 남긴다.
이 견본으로 항목 이름을 맞춘 뒤, 다음 단계에서 새 달 자동 받기를 붙인다."""
import json, os, sys, urllib.request, urllib.parse, datetime

KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
B = "https://apis.data.go.kr/1613000"
CODE = "A10027118"  # 경희궁자이2단지 (시험용)
OPS = {
    "AptCmnuseManageCostServiceV3": ["getHsmpLaborCostInfoV3", "getHsmpCleaningCostInfoV3", "getHsmpGuardCostInfoV3", "getHsmpElevatorMntncCostInfoV3",
                                     "getHsmpRepairsCostInfoV3", "getHsmpConsignManageFeeInfoV3", "getHsmpTaxdueInfoV3", "getHsmpFacilityMntncCostInfoV3"],
    "AptIndvdlzManageCostServiceV3": ["getHsmpHeatCostInfoV3", "getHsmpHotWaterCostInfoV3", "getHsmpElectricityCostInfoV3", "getHsmpWaterCostInfoV3", "getHsmpGasRentalFeeInfoV3"],
}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "acb", "api_sample.json")


def call(svc, op, ym):
    q = urllib.parse.urlencode({"kaptCode": CODE, "searchDate": ym, "_type": "json"})
    url = f"{B}/{svc}/{op}?serviceKey={urllib.parse.quote(KEY, safe='')}&{q}"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            t = r.read().decode("utf-8", "replace")
    except Exception as e:
        return {"오류": str(e)[:200]}
    try:
        return json.loads(t)
    except Exception:
        return {"원문": t[:600]}


def main():
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
    res = {"때": now.strftime("%Y-%m-%d %H:%M"), "키": bool(KEY), "단지": CODE, "결과": {}}
    if not KEY:
        res["알림"] = "깃허브 비밀값 DATA_GO_KR_KEY 가 비어 있음"
    else:
        ym = "202609"
        for svc, ops in OPS.items():
            for op in ops:
                res["결과"][f"{svc}/{op}"] = call(svc, op, ym)
    s = json.dumps(res, ensure_ascii=False, indent=1)
    s = s.replace(KEY, "***") if KEY else s
    open(OUT, "w", encoding="utf-8").write(s)
    ok = sum(1 for v in res["결과"].values() if '"resultCode": "00"' in json.dumps(v) or '"00"' in json.dumps(v)[:300])
    print("키", bool(KEY), "응답", len(res["결과"]), "정상 추정", ok)


if __name__ == "__main__":
    main()
