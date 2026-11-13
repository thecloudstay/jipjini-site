# -*- coding: utf-8 -*-
r"""한국어 글자 인식 시험(2026-11-13 대표 「그래픽 카드를 최대한」 → 1순위: 방 이름 글자 읽기, 고정 표본 100장 중 83장 감점).
   공개 프로그램 조사 결과: PaddleOCR PP-OCRv5 한국어 인식(Apache-2.0, 상업 사용 가능, 인식 13MB, 한국어 정확도 88%)을
   onnxruntime 으로 돌리는 rapidocr. 지금 쓰는 글자 읽기와 같은 그림에서 견줘, 방 이름을 몇 개나 더 읽는지 잰다.
   결과: D:\croll\기록\채점\글자인식_시험.txt  (원본 그림은 이 컴퓨터 밖으로 나가지 않는다)
   학습 환경 파이썬으로 한 번 돈다: D:\croll\학습\환경\Scripts\python.exe ocr_trial.py [장수=60]"""
import csv, glob, json, os, random, subprocess, sys, time

CROLL = r"D:\croll"
OUTF = os.path.join(CROLL, "기록", "채점", "글자인식_시험.txt")
READ = os.path.join(CROLL, "자료", "변환", "방읽기")
WORDS = ["거실", "주방", "식당", "침실", "안방", "욕실", "화장실", "현관", "발코니", "드레스", "실외기", "다용도", "팬트리", "알파룸", "서재", "파우더", "창고", "취사", "부엌", "방"]


def need(pkgs):
    for p in pkgs:
        try:
            __import__(p[0])
        except ImportError:
            subprocess.call([sys.executable, "-m", "pip", "install", "-q", p[1]])


def main(n=60):
    t0 = time.time(); lines = []
    need([("rapidocr_onnxruntime", "rapidocr-onnxruntime"), ("huggingface_hub", "huggingface_hub"), ("cv2", "opencv-python-headless")])
    from huggingface_hub import hf_hub_download
    from rapidocr_onnxruntime import RapidOCR
    import numpy as np, cv2
    det = hf_hub_download("monkt/paddleocr-onnx", "detection/v5/det.onnx")
    rec = hf_hub_download("monkt/paddleocr-onnx", "languages/korean/rec.onnx")
    keys = hf_hub_download("monkt/paddleocr-onnx", "languages/korean/dict.txt")
    ocr = RapidOCR(det_model_path=det, rec_model_path=rec, rec_keys_path=keys)
    rows = [r for r in csv.DictReader(open(os.path.join(CROLL, "자료", "원본_목록.csv"), encoding="utf-8-sig")) if str(r.get("순서")) == "1" and os.path.exists(r.get("파일") or "")]
    random.seed(11); random.shuffle(rows)
    tot_new = tot_old = imgs = 0; per = []
    for r in rows:
        if imgs >= n: break
        k = "%s_%s" % (r["단지코드"], r["평형"]); c = os.path.join(READ, k + ".json")
        if not os.path.exists(c): continue
        try:
            old = json.load(open(c, encoding="utf-8")).get("읽기") or {}
            oldn = [q.get("name") or "" for q in old.get("rooms") or []]
            old_named = sum(1 for nm in oldn if any(w in nm for w in WORDS if w != "방") or nm.startswith("침실") or nm.startswith("안방"))
            img = cv2.imdecode(np.fromfile(r["파일"], np.uint8), cv2.IMREAD_COLOR)
            t1 = time.time(); res, _ = ocr(img); dt = time.time() - t1
            got = [x[1] for x in (res or [])]
            hit = [g for g in got if any(w in g for w in WORDS)]
            imgs += 1; tot_new += len(hit); tot_old += old_named
            per.append("%s · 지금 읽기 방 이름 %d · 새 글자 인식 방 이름 %d (%.1f초) · %s" % (k, old_named, len(hit), dt, " ".join(hit)[:80]))
        except Exception as e:
            per.append("%s 오류 %s" % (k, str(e)[:60]))
    lines.append("한국어 글자 인식 시험 · %s · 그림 %d장 · %.0f초" % (time.strftime("%Y-%m-%d %H:%M"), imgs, time.time() - t0))
    lines.append("방 이름 찾은 수: 지금 읽기 %d개 → 새 글자 인식 %d개 (그림당 %.1f → %.1f)" % (tot_old, tot_new, tot_old / max(1, imgs), tot_new / max(1, imgs)))
    lines.append("")
    lines += per
    os.makedirs(os.path.dirname(OUTF), exist_ok=True)
    open(OUTF, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines[:3]))
    return 0


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 60))
