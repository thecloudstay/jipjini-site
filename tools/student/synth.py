# -*- coding: utf-8 -*-
r"""합성 정답지(2026-11-13 대표 승인 「묶음안 + 합성 정답지」).

우리가 바꾼 집지니 도면(D:\croll\자료\변환\도면\*.json)을 네이버 평면도 그리기 양식대로 그림으로 찍어 낸다.
그림을 우리가 그렸으니 정답(벽·창·문·방 종류)이 화소 하나까지 정확하고, 조건 걱정 없는 우리 자료다.
네이버 양식: 흰 바탕 · 벽 검정 고정 두께 · 창 = 흰 띠 + 가는 회색 선 두 줄 · 문 = 문짝 선 + 4분의 1 호 · 방 바닥 색(거실·방 나무색,
욕실 하늘색 타일, 발코니·다용도 옅은 베이지 타일, 현관 회색 바둑판) · 방 이름 글자.
평면 하나로 양식(요즘 네이버 / 예전 비즈니스 플랫폼 / 무채색) · 벽 두께 · 회전 · 축척 · 압축 화질을 바꿔 여러 장을 만든다.
도면이 틀렸어도 그 도면 그대로 그린 그림이라 정답은 맞다 — 그래서 변환한 도면 전부를 쓸 수 있다.

  python synth.py [평면당 장수=3] [최대 평면 수=0(전부)]
결과: D:\croll\학습\합성\<키>_s<n>.jpg + .json (train_student.py 가 정답지와 같이 읽는다)
"""
import glob, json, math, os, random, sys
import numpy as np, cv2
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:   # 글자 없이도 그린다
    Image = None

HERE = os.path.dirname(os.path.abspath(__file__))
CROLL = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
SRC = os.path.join(CROLL, "자료", "변환", "도면")
DST = os.path.join(CROLL, "학습", "합성")
FONTS = [r"C:\Windows\Fonts\malgun.ttf", r"C:\Windows\Fonts\gulim.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

STYLE = {   # 바닥 색(RGB) — 양식마다 조금씩
    "네이버": {"거실": (214, 160, 98), "방": (238, 220, 170), "주방": (214, 160, 98), "욕실": (205, 228, 240), "발코니": (246, 236, 214), "현관": (205, 205, 205),
              "드레스룸": (238, 220, 170), "실외기실": (225, 225, 225), "기타": (240, 236, 226), "피트": (225, 225, 225)},
    "예전": {"거실": (196, 132, 70), "방": (232, 206, 150), "주방": (196, 132, 70), "욕실": (200, 222, 236), "발코니": (248, 238, 222), "현관": (212, 212, 212),
            "드레스룸": (232, 206, 150), "실외기실": (210, 210, 210), "기타": (236, 230, 216), "피트": (215, 215, 215)},
    "무채색": {"거실": (245, 245, 245), "방": (250, 250, 250), "주방": (245, 245, 245), "욕실": (232, 238, 242), "발코니": (240, 240, 236), "현관": (228, 228, 228),
             "드레스룸": (250, 250, 250), "실외기실": (236, 236, 236), "기타": (246, 246, 246), "피트": (236, 236, 236)},
}
NAME = {"거실": "거실", "방": "침실", "주방": "주방/식당", "욕실": "욕실", "발코니": "발코니", "현관": "현관", "드레스룸": "드레스룸", "실외기실": "실외기실", "기타": "다용도"}


def font(sz):
    for f in FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def tiles(img, poly, step, color, checker=False):
    m = np.zeros(img.shape[:2], np.uint8); cv2.fillPoly(m, [np.array(poly, np.int32)], 1)
    ys, xs = np.where(m > 0)
    if not len(xs): return
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    if checker:
        for y in range(y0, y1, step):
            for x in range(x0 + ((y - y0) // step % 2) * step, x1, 2 * step):
                sub = m[y:y + step, x:x + step] > 0; img[y:y + step, x:x + step][sub] = (235, 235, 235)
    lines = np.zeros_like(m)
    for x in range(x0, x1, step): cv2.line(lines, (x, y0), (x, y1), 1, 1)
    for y in range(y0, y1, step): cv2.line(lines, (x0, y), (x1, y), 1, 1)
    img[(lines > 0) & (m > 0)] = color


def wood(img, poly, base):
    m = np.zeros(img.shape[:2], np.uint8); cv2.fillPoly(m, [np.array(poly, np.int32)], 1)
    noise = cv2.GaussianBlur(np.random.randint(0, 40, (img.shape[0], 1)).astype(np.float32), (1, 9), 0)
    tex = np.clip(np.array(base, np.float32)[None, None, :] + (noise[:, :, None] - 20) * 0.6, 0, 255).astype(np.uint8)
    tex = np.repeat(tex, img.shape[1], 1); img[m > 0] = tex[m > 0]


def names(img, rooms, mm, H):
    pil = Image.fromarray(img[..., ::-1]); dr = ImageDraw.Draw(pil); f = font(max(11, int(H / 48)))
    for r in rooms:
        k = r.get("kind") or "기타"; a = abs(cv2.contourArea(np.array(r["pts"], np.float32))) * mm * mm / 1e6
        if a < 2.5 or k not in NAME: continue
        xs = [p[0] for p in r["pts"]]; ys = [p[1] for p in r["pts"]]; tx, ty = sum(xs) / len(xs), sum(ys) / len(ys); s = NAME[k]
        bb = dr.textbbox((0, 0), s, font=f); dr.text((tx - (bb[2] - bb[0]) / 2, ty - (bb[3] - bb[1]) / 2), s, fill=(30, 30, 30), font=f)
    return np.array(pil)[..., ::-1].copy()


def render(d, style, wpx, rng):
    """도면 하나 → (그림 BGR, 정답 json). 좌표는 원래 도면 좌표 그대로(그림 크기도 같게)"""
    W, H = int(d["W"]), int(d["H"]); mm = d.get("mmpp") or 23.0; G = d["그림"]; pal = STYLE[style]
    img = np.full((H, W, 3), 255, np.uint8)
    rooms = [r for r in d.get("rooms") or [] if len(r.get("pts") or []) >= 3]
    for r in rooms:
        k = r.get("kind") or "기타"; c = pal.get(k, pal["기타"]); P = r["pts"]
        cv2.fillPoly(img, [np.array(P, np.int32)], c[::-1])
        if k in ("거실", "주방") and style != "무채색": wood(img, P, c[::-1])
        elif k == "욕실": tiles(img, P, max(5, int(300 / mm)), tuple(int(v * 0.88) for v in c[::-1]))
        elif k in ("발코니", "실외기실", "기타"): tiles(img, P, max(6, int(400 / mm)), tuple(int(v * 0.9) for v in c[::-1]))
        elif k == "현관": tiles(img, P, max(5, int(300 / mm)), (190, 190, 190), checker=True)
    # 벽: 네이버처럼 고정 두께(wpx) — 정답도 같은 두께로 적는다
    t = wpx * mm; h = wpx / 2.0; walls = []
    for ax, a, b, c, _ in G.get("벽선") or []:
        walls.append([ax, a, b, c, t])
        if ax == "h": cv2.rectangle(img, (int(a), int(round(c - h))), (int(b), int(round(c + h - 1))), (20, 20, 20), -1)
        else: cv2.rectangle(img, (int(round(c - h)), int(a)), (int(round(c + h - 1)), int(b)), (20, 20, 20), -1)
    for P in G.get("벽윤곽") or []: cv2.fillPoly(img, [np.array(P, np.int32)], (20, 20, 20))
    for x1, y1, x2, y2, _ in G.get("사선벽") or []: cv2.line(img, (int(x1), int(y1)), (int(x2), int(y2)), (20, 20, 20), wpx)
    sash = []
    for ax, x0, y0, x1, y1 in G.get("샷시") or []:   # 창: 벽 두께 띠를 희게 비우고 가는 선 두 줄
        if ax == "h":
            c = (y0 + y1) / 2.0; yy0, yy1 = int(round(c - h)), int(round(c + h - 1)); cv2.rectangle(img, (x0, yy0), (x1, yy1), (255, 255, 255), -1)
            for yy in (yy0, yy1): cv2.line(img, (x0, yy), (x1, yy), (120, 120, 120), 1)
            sash.append(["h", x0, yy0, x1, yy1])
        else:
            c = (x0 + x1) / 2.0; xx0, xx1 = int(round(c - h)), int(round(c + h - 1)); cv2.rectangle(img, (xx0, y0), (xx1, y1), (255, 255, 255), -1)
            for xx in (xx0, xx1): cv2.line(img, (xx, y0), (xx, y1), (120, 120, 120), 1)
            sash.append(["v", xx0, y0, xx1, y1])
    for q in G.get("문") or []:   # 문: 문 자리 흰색 + 문짝 선 + 4분의 1 호
        if not isinstance(q, dict): continue
        hx, hy, sx, sy = q["x1"], q["y1"], q["x2"], q["y2"]; lx, ly = q.get("cx", hx), q.get("cy", hy)
        cv2.line(img, (int(hx), int(hy)), (int(sx), int(sy)), (255, 255, 255), wpx + 1)
        R = int(round(math.hypot(lx - hx, ly - hy)))
        if R < 3: continue
        cv2.line(img, (int(hx), int(hy)), (int(lx), int(ly)), (60, 60, 60), 1)
        a1 = math.degrees(math.atan2(ly - hy, lx - hx)); a2 = math.degrees(math.atan2(sy - hy, sx - hx)); dd = (a2 - a1 + 540) % 360 - 180
        cv2.ellipse(img, (int(hx), int(hy)), (R, R), 0, a1, a1 + dd, (110, 110, 110), 1)
    # 방 이름 글자(방 가운데, 넓은 방만)
    if Image is not None:
        img = names(img, rooms, mm, H)
    lab = {"key": d.get("key"), "출처": "합성 " + style, "W": W, "H": H, "mmpp": mm,
           "rooms": [{"k": r.get("kind"), "n": r.get("name"), "p": r["pts"]} for r in rooms],
           "그림": {"벽선": walls, "샷시": sash, "문": G.get("문") or [], "사선벽": [[*q[:4], t] for q in G.get("사선벽") or []], "사선창": [], "벽윤곽": G.get("벽윤곽") or []}}
    return img, lab


def main(per=3, cap=0):
    os.makedirs(DST, exist_ok=True); rng = random.Random(1113); n = 0
    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    if cap: files = files[:cap]
    for fp in files:
        k = os.path.basename(fp)[:-5]
        try:
            d = json.load(open(fp, encoding="utf-8")); d["key"] = k
            if not d.get("그림") or not d.get("rooms"): continue
        except Exception:
            continue
        for i in range(per):
            out = os.path.join(DST, "%s_s%d" % (k, i))
            if os.path.exists(out + ".json"): continue
            style = ["네이버", "예전", "무채색"][i % 3]; wpx = rng.choice([4, 5, 5, 6, 7])
            try:
                img, lab = render(d, style, wpx, rng)
                q = rng.randint(55, 92); ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
                buf.tofile(out + ".jpg"); json.dump(lab, open(out + ".json", "w", encoding="utf-8"), ensure_ascii=False); n += 1
            except Exception as e:
                print(k, "합성 실패:", str(e)[:80], flush=True)
    print("합성 정답지 %d장 새로 만듦 · 모두 %d장 (%s)" % (n, len(glob.glob(os.path.join(DST, "*.json"))), DST), flush=True)
    return 0


if __name__ == "__main__":
    a = [int(x) for x in sys.argv[1:3]]
    sys.exit(main(*a))
