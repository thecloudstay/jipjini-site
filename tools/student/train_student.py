# -*- coding: utf-8 -*-
r"""집지니 자체 모델 학습(2026-11-13 대표 지시 「자체 + 학습 + 선생 모두 통합해서 우리 엔진으로」).

정답지(D:\croll\학습\집지니\ — 세 의견이 합의한 평면, 합성 정답지가 생기면 D:\croll\학습\합성\ 도)로
작은 분할 모델을 처음부터 학습한다(남의 가중치를 이어 받지 않음). 머리가 둘:
  구조(str)  0 바탕 · 1 벽 · 2 문 · 3 창                     — 방 읽기 도구(plan_tools.js)의 학습 인식기 str 자리와 같은 약속
  공간(spa)  0 바탕 · 1 거실 · 2 방 · 3 주방 · 4 현관 · 5 발코니 · 6 욕실 · 7 드레스룸 · 8 실외기실 · 9 기타   — spa 자리와 같은 약속
입력은 512×512(흰 여백으로 줄여 넣음, 이미지넷 정규화), 출력은 128×128. 선생 모델과 같은 꽂는 방식이라 도구가 그대로 받는다.

  python train_student.py 학습 [에폭=40]     → D:\croll\학습\자체모델\<때>\ 에 모델·기록, 그리고 도구_후보\자체모델_<때>\ 에 후보로 넣음
  python train_student.py 점검               → 정답지 몇 장인지, 그래픽카드가 보이는지
학습 전용 파이썬(D:\croll\학습\환경)에서 돈다 — D:\croll\학습\학습환경_설치.bat 로 한 번 만든다.
"""
import json, os, random, sys, time, glob

HERE = os.path.dirname(os.path.abspath(__file__))
CROLL = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))       # D:\croll
SRC = [os.path.join(CROLL, "학습", "집지니"), os.path.join(CROLL, "학습", "합성")]
OUTROOT = os.path.join(CROLL, "학습", "자체모델")
CAND = os.path.join(CROLL, "코드", "도구_후보")
S, OS = 512, 128
SPA = {"거실": 1, "방": 2, "주방": 3, "현관": 4, "발코니": 5, "욕실": 6, "드레스룸": 7, "실외기실": 8, "기타": 9}
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import numpy as np, cv2


def imread_u(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


def items():
    out = []
    for d in SRC:
        if not os.path.isdir(d):
            continue
        for j in sorted(glob.glob(os.path.join(d, "*.json"))):
            im = j[:-5] + ".jpg"
            if not os.path.exists(im):
                im = j[:-5] + ".png"
            if os.path.exists(im):
                out.append((im, j))
    return out


def labels(js, H, W):
    """정답지 → 원본 크기 라벨(구조, 공간)"""
    d = json.load(open(js, encoding="utf-8")); G = d.get("그림") or {}; mm = d.get("mmpp") or 23.0
    st = np.zeros((H, W), np.uint8); sp = np.zeros((H, W), np.uint8)
    for r in d.get("rooms") or []:
        k = r.get("k") or "기타"; c = SPA.get(k, 0 if k in ("피트", "공용") else 9)
        if c and r.get("p") and len(r["p"]) >= 3:
            cv2.fillPoly(sp, [np.array(r["p"], np.int32)], c)
    for ax, a, b, c, t in G.get("벽선") or []:
        h = max(1.5, t / mm / 2)
        if ax == "h": cv2.rectangle(st, (int(a), int(round(c - h))), (int(b), int(round(c + h))), 1, -1)
        else: cv2.rectangle(st, (int(round(c - h)), int(a)), (int(round(c + h)), int(b)), 1, -1)
    for P in G.get("벽윤곽") or []:
        cv2.fillPoly(st, [np.array(P, np.int32)], 1)
    for q in G.get("사선벽") or []:
        x1, y1, x2, y2, t = q; cv2.line(st, (int(x1), int(y1)), (int(x2), int(y2)), 1, max(2, int(round(t / mm))))
    for q in G.get("샷시") or []:
        ax, x0, y0, x1, y1 = q; cv2.rectangle(st, (int(x0), int(y0)), (int(x1), int(y1)), 3, -1)
    for q in G.get("사선창") or []:
        x1, y1, x2, y2, t = q; cv2.line(st, (int(x1), int(y1)), (int(x2), int(y2)), 3, max(2, int(round(t / mm))))
    for q in G.get("문") or []:
        if isinstance(q, dict):
            cv2.line(st, (int(q["x1"]), int(q["y1"])), (int(q["x2"]), int(q["y2"])), 2, max(3, int(round(150 / mm))))
    sp[st == 1] = 0
    return st, sp


def letterbox(img, st, sp, aug=False):
    H, W = img.shape[:2]
    if aug:
        if random.random() < 0.5: img, st, sp = img[:, ::-1], st[:, ::-1], sp[:, ::-1]
        if random.random() < 0.5: img, st, sp = img[::-1], st[::-1], sp[::-1]
        if random.random() < 0.5: img, st, sp = np.rot90(img), np.rot90(st), np.rot90(sp)
        H, W = img.shape[:2]
    k = S / max(H, W) * (random.uniform(0.8, 1.0) if aug else 1.0)
    nw, nh = max(1, int(round(W * k))), max(1, int(round(H * k)))
    ox = random.randint(0, S - nw) if aug else (S - nw) // 2; oy = random.randint(0, S - nh) if aug else (S - nh) // 2
    X = np.full((S, S, 3), 255, np.uint8); X[oy:oy + nh, ox:ox + nw] = cv2.resize(np.ascontiguousarray(img), (nw, nh), interpolation=cv2.INTER_AREA)
    if aug:
        X = np.clip(X.astype(np.float32) * random.uniform(0.85, 1.1) + random.uniform(-12, 12), 0, 255).astype(np.uint8)
        if random.random() < 0.3: X = cv2.GaussianBlur(X, (3, 3), 0)
    Ys = np.zeros((S, S), np.uint8); Ys[oy:oy + nh, ox:ox + nw] = cv2.resize(np.ascontiguousarray(st), (nw, nh), interpolation=cv2.INTER_NEAREST)
    Yp = np.zeros((S, S), np.uint8); Yp[oy:oy + nh, ox:ox + nw] = cv2.resize(np.ascontiguousarray(sp), (nw, nh), interpolation=cv2.INTER_NEAREST)
    # 128 칸으로: 구조는 「칸 안에 한 화소라도 있으면」(가는 창·문이 사라지지 않게, 창>문>벽 순), 공간은 가장 많은 것
    Ysm = np.zeros((OS, OS), np.uint8)
    blk = Ys.reshape(OS, 4, OS, 4)
    for c in (1, 2, 3):
        Ysm[(blk == c).any(axis=(1, 3))] = c
    Ypm = cv2.resize(Yp, (OS, OS), interpolation=cv2.INTER_NEAREST)
    x = (X[..., ::-1].astype(np.float32) / 255 - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)   # 도구와 같게 RGB
    return x.transpose(2, 0, 1).copy(), Ysm, Ypm


def build():
    import torch, torch.nn as nn

    def cbr(i, o, s=1):
        return nn.Sequential(nn.Conv2d(i, o, 3, s, 1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))

    class Net(nn.Module):
        def __init__(self, c=(24, 48, 96, 192)):
            super().__init__()
            self.e0 = nn.Sequential(cbr(3, c[0], 2), cbr(c[0], c[0]))            # 256
            self.e1 = nn.Sequential(cbr(c[0], c[1], 2), cbr(c[1], c[1]))         # 128
            self.e2 = nn.Sequential(cbr(c[1], c[2], 2), cbr(c[2], c[2]))         # 64
            self.e3 = nn.Sequential(cbr(c[2], c[3], 2), cbr(c[3], c[3]), cbr(c[3], c[3]))   # 32
            self.u2 = cbr(c[3] + c[2], c[2]); self.u1 = cbr(c[2] + c[1], c[1])
            self.hs = nn.Conv2d(c[1], 4, 1); self.hp = nn.Conv2d(c[1], 10, 1)
            self.up = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)

        def forward(self, x):
            a = self.e0(x); b = self.e1(a); c = self.e2(b); d = self.e3(c)
            u = self.u2(torch.cat([self.up(d), c], 1)); u = self.u1(torch.cat([self.up(u), b], 1))
            return self.hs(u), self.hp(u)
    return Net()


def check():
    it = items(); print("정답지", len(it), "장 ·", ", ".join("%s %d" % (os.path.basename(d), len(glob.glob(os.path.join(d, "*.json")))) for d in SRC if os.path.isdir(d)))
    try:
        import torch
        print("파이토치", torch.__version__, "· 그래픽카드", torch.cuda.is_available() and torch.cuda.get_device_name(0))
    except Exception as e:
        print("파이토치 없음:", e)


def weights(tr):
    """2026-11-13 대표 「거시적으로 본 장점을 학습 모델에도」: 약한 묶음을 더 자주 보여 준다.
       묶음 = 네이버 등록 연도(양식 시대) × 전용면적 구간. 묶음 통과율은 일괄 변환 결과(자료\변환\상태.json)에서 센다.
       무게 = 1 + 2 × (그 묶음의 탈락률), 실제 정답지(학습\집지니)는 합성보다 2배 — 합성만 많아 실제 도면과 결이 달라 지던 것(두 번 패배)도 함께 줄인다."""
    import csv, re, collections
    D = os.path.join(CROLL, "자료"); A = {}; grp = {}
    try:
        for r in csv.DictReader(open(os.path.join(D, "원본_목록.csv"), encoding="utf-8-sig")):
            if str(r.get("순서")) != "1": continue
            m = re.search(r"/(20\d\d)\d{4}_", r.get("원래주소", "")); yr = int(m.group(1)) if m else 0
            try: ar = float(r.get("전용면적") or 0)
            except ValueError: ar = 0
            A["%s_%s" % (r["단지코드"], r["평형"])] = ("~12" if yr and yr <= 2012 else "13~19" if yr and yr <= 2019 else "20~" if yr else "?",
                                                      "~40" if ar < 40 else "~85" if ar <= 85 else "~135" if ar <= 135 else "135~")
        st = json.load(open(os.path.join(D, "변환", "상태.json"), encoding="utf-8"))
        cnt = collections.defaultdict(lambda: [0, 0])
        for k, v in st.items():
            g = A.get(k)
            if not g or v.get("판정") == "오류": continue
            cnt[g][0] += 1; cnt[g][1] += 1 if (v.get("판정") == "통과" or (v.get("판정") == "예외" and (v.get("점수") or 0) >= 85)) else 0
        grp = {g: 1 - (b / a) for g, (a, b) in cnt.items() if a >= 5}
    except Exception as e:
        print("묶음 무게를 못 셌습니다(고르게 학습):", str(e)[:80], flush=True)
    out = []
    for im, j in tr:
        k = re.sub(r"_s\d+$", "", os.path.basename(j)[:-5])
        w = 1 + 2 * grp.get(A.get(k), 0.5)
        if os.path.basename(os.path.dirname(j)) == "집지니": w *= 2
        out.append(w)
    return out


def train(epochs=40):
    import torch, torch.nn.functional as F
    it = items()
    if len(it) < 20:
        print("정답지가 %d장뿐이라 학습을 미룹니다(20장 이상부터)." % len(it)); return 1
    random.seed(7); random.shuffle(it); nv = max(4, len(it) // 10); va, tr = it[:nv], it[nv:]
    dev = "cuda" if torch.cuda.is_available() else "cpu"; net = build().to(dev)
    cache = {}
    def load(p):
        if p[1] not in cache:
            img = imread_u(p[0]); st, sp = labels(p[1], img.shape[0], img.shape[1]); cache[p[1]] = (img, st, sp)
        return cache[p[1]]
    # 드문 구조(문·창)에 무게를 더 준다
    ws = torch.tensor([0.3, 1.0, 3.0, 3.0], device=dev)
    opt = torch.optim.AdamW(net.parameters(), 2e-3, weight_decay=1e-4); sched = torch.optim.lr_scheduler.OneCycleLR(opt, 2e-3, total_steps=epochs * max(1, len(tr) // 4 + 1))
    scaler = torch.amp.GradScaler(enabled=dev == "cuda"); B = 4; t0 = time.time(); log = []
    wt = weights(tr); print("묶음 무게: 평균 %.2f · 최소 %.2f · 최대 %.2f (약한 묶음·실제 정답지를 더 자주)" % (sum(wt) / len(wt), min(wt), max(wt)), flush=True)
    for ep in range(epochs):
        net.train(); tr_e = random.choices(tr, weights=wt, k=len(tr)); tot = 0
        for i in range(0, len(tr), B):
            xs, ys, yp = zip(*[letterbox(*load(p), aug=True) for p in tr_e[i:i + B]])
            x = torch.tensor(np.stack(xs), device=dev); a = torch.tensor(np.stack(ys), device=dev).long(); b = torch.tensor(np.stack(yp), device=dev).long()
            with torch.autocast(dev, enabled=dev == "cuda"):
                os_, op = net(x); loss = F.cross_entropy(os_.float(), a, weight=ws) + 0.7 * F.cross_entropy(op.float(), b)
            opt.zero_grad(); scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); sched.step(); tot += float(loss)
        m = evaluate(net, va, load, dev)
        line = "에폭 %2d · 손실 %.3f · 검증 벽 %.2f 문 %.2f 창 %.2f 공간 %.2f · %.0f초" % (ep + 1, tot / max(1, len(tr) / B), m[1], m[2], m[3], m["공간"], time.time() - t0)
        print(line, flush=True); log.append(line)
    stamp = time.strftime("%Y%m%d_%H%M"); od = os.path.join(OUTROOT, stamp); os.makedirs(od, exist_ok=True)
    torch.save(net.state_dict(), os.path.join(od, "student.pt")); export(net, od, dev)
    open(os.path.join(od, "기록.txt"), "w", encoding="utf-8").write("정답지 %d장(검증 %d) · %s\n" % (len(it), len(va), dev) + "\n".join(log) + "\n")
    cd = os.path.join(CAND, "자체모델_" + stamp, "models"); os.makedirs(cd, exist_ok=True)
    for n in ("student_str.onnx", "student_spa.onnx"):
        import shutil; shutil.copy2(os.path.join(od, n), os.path.join(cd, n))
    json.dump({"str": "student_str.onnx", "spa": "student_spa.onnx", "size": S, "norm": "imagenet", "strMap": {"wall": 1, "door": 2, "window": 3}, "ver": "자체 " + stamp},
              open(os.path.join(cd, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False)
    open(os.path.join(os.path.dirname(cd), "메모.txt"), "w", encoding="utf-8").write(
        "자체 모델 %s | 정답지 %d장으로 처음부터 학습한 구조·공간 분할 모델을 학습 인식기 자리에 | %s\n" % (stamp, len(it), log[-1] if log else ""))
    print("후보로 넣었습니다:", os.path.dirname(cd)); return 0


def evaluate(net, va, load, dev):
    import torch
    net.eval(); I = np.zeros(4); U = np.zeros(4); ip = up = 0
    with torch.no_grad():
        for p in va:
            x, ys, yp = letterbox(*load(p)); a, b = net(torch.tensor(x[None], device=dev))
            ps_ = a.argmax(1)[0].cpu().numpy(); pp = b.argmax(1)[0].cpu().numpy()
            for c in (1, 2, 3):
                I[c] += ((ps_ == c) & (ys == c)).sum(); U[c] += ((ps_ == c) | (ys == c)).sum()
            m = yp > 0; ip += ((pp == yp) & m).sum(); up += m.sum()
    r = {c: I[c] / max(1, U[c]) for c in (1, 2, 3)}; r["공간"] = ip / max(1, up); return r


def export(net, od, dev):
    import torch
    net.eval().cpu()

    class Head(torch.nn.Module):
        def __init__(self, n, i): super().__init__(); self.n = n; self.i = i
        def forward(self, x): return self.n(x)[self.i]
    x = torch.zeros(1, 3, S, S)
    for i, name in ((0, "student_str.onnx"), (1, "student_spa.onnx")):
        torch.onnx.export(Head(net, i), x, os.path.join(od, name), input_names=["input"], output_names=["out"], opset_version=17, dynamo=False)
    net.to(dev)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "점검"
    if cmd == "학습": sys.exit(train(int(sys.argv[2]) if len(sys.argv) > 2 else 40))
    check()
