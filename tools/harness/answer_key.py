# -*- coding: utf-8 -*-
r"""집지니 정답지(2026-11-13 대표 지시 「자체 + 학습 + 선생 모두 통합해서 우리 엔진으로」 · 「93점 정답지도 미숙하다」).

옛 정답지(채점 93점 이상)는 벽만 보던 점수라 주방이 빠지거나 창이 없어도 들어갔다. 새 기준은 세 의견이 모두 맞다고 할 때만:
  ① 우리 규칙 엔진 검수가 깨끗함 — 판정 「통과」(R1~R17 중 경고 아닌 것 0개, 처음 보는 모양 3곳 미만), 창 없는 방(R8) 0곳
  ② 원본 대조 — 감점까지 넣은 점수 90점 이상, 네이버 규칙으로 다시 그려 겹친 벽 재현 97% · 벽 정밀 93% 이상
  ③ 선생 모델과 합의 — 선생이 본 벽을 우리가 덮은 비율과 우리 벽이 선생 구조(벽·문·창) 위에 있는 비율의 조화 평균(한 칸 어긋남 허용) 80% 이상(선생 결과가 없으면 ①②만)
통과한 평면만 D:\croll\학습\집지니\ 에 그림 + 정답(방 다각형·종류, 벽·창·문, 선생 칸)으로 남긴다. 이 컴퓨터 안에서만 쓴다.
"""
import base64, json, os, shutil
import cv2, numpy as np

CUT = {"점수": 90, "벽재현": 0.97, "벽정밀": 0.93, "벽합의": 0.80}


def teacher_grid(teach):
    """선생 결과(128×128 분류, 512 화면에 맞춰 넣은 것) → numpy 배열"""
    if not teach or not teach.get("b64"):
        return None
    raw = base64.b64decode(teach["b64"])
    return np.frombuffer(raw, np.uint8).reshape(teach["h"], teach["w"])


def agreement(G, plan, teach, struct_mask):
    """선생이 본 벽(2)과 우리 벽 구조가 얼마나 겹치나 — 같은 128 칸 위에서 잰다(합집합 대비 교집합)"""
    T = teacher_grid(teach)
    if T is None:
        return None
    h, w, S, k, ox, oy = teach["h"], teach["w"], teach["S"], teach["k"], teach["ox"], teach["oy"]
    H, W = struct_mask.shape[:2]
    big = np.zeros((S, S), np.uint8)
    nw, nh = max(1, int(round(W * k))), max(1, int(round(H * k)))
    big[oy:oy + nh, ox:ox + nw] = cv2.resize(struct_mask.astype(np.uint8), (nw, nh), interpolation=cv2.INTER_NEAREST)[:S - oy, :S - ox]
    ours = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA) > 0
    ts = (T == 2) | (T == 3) | (T == 4)            # 선생의 벽·문·창 = 구조(선생은 창 자리를 벽이 아니라 창으로 가른다)
    tw = T == 2
    k3 = np.ones((3, 3), np.uint8)
    rec = (tw & (cv2.dilate(ours.astype(np.uint8), k3) > 0)).sum() / max(1, tw.sum())      # 선생이 본 벽을 우리가 덮었나
    pre = (ours & (cv2.dilate(ts.astype(np.uint8), k3) > 0)).sum() / max(1, ours.sum())    # 우리 벽이 선생 구조 위에 있나
    return round(float(2 * rec * pre / max(1e-9, rec + pre)), 3)                          # 128 칸 한 칸 어긋남은 봐준다


def passes(rec):
    """판정·점수·겹침·합의로 정답지 자격을 본다. 돌려줌: (자격, 못 미친 이유 목록)"""
    why = []
    if rec.get("판정") != "통과": why.append("판정 " + str(rec.get("판정")))
    if sum(1 for x in rec.get("점검") or [] if x[0] == "R8"): why.append("창 없는 방")
    if not isinstance(rec.get("점수"), (int, float)) or rec["점수"] < CUT["점수"]: why.append("점수 %s" % rec.get("점수"))
    g = rec.get("겹침") or {}
    if g.get("벽재현", 0) < CUT["벽재현"]: why.append("벽 재현 %.3f" % g.get("벽재현", 0))
    if g.get("벽정밀", 0) < CUT["벽정밀"]: why.append("벽 정밀 %.3f" % g.get("벽정밀", 0))
    a = rec.get("벽합의")
    if a is not None and a < CUT["벽합의"]: why.append("선생과 벽 합의 %.2f" % a)
    return (not why), why


def save(dst, k, src_img, plan, G, rec, teach=None, origin="일괄 변환"):
    os.makedirs(dst, exist_ok=True)
    shutil.copyfile(src_img, os.path.join(dst, k + ".jpg"))
    keep = {n: G.get(n) for n in ("벽선", "샷시", "문", "벽", "벽채움", "사선벽", "사선창", "벽윤곽", "틀")}
    json.dump({"key": k, "출처": origin, "점수": rec.get("점수"), "겹침": rec.get("겹침"), "벽합의": rec.get("벽합의"),
               "W": plan.get("W"), "H": plan.get("H"), "mmpp": plan.get("mmpp"),
               "rooms": [{"k": r.get("kind"), "n": r.get("name"), "p": r.get("pts")} for r in plan.get("rooms") or []],
               "그림": keep, "선생": teach}, open(os.path.join(dst, k + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
