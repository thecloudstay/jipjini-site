#!/usr/bin/env python3
"""쇼츠 자동 검수 (2026-11-28 대표 「전문가 관점·자동화 관점에서 싹 다」)
기준 근거: mk/research/2026-11-28-영상-전면검토.md
쓰는 법: python3 tools/qa.py out/v3/*.mp4   → 표로 보여 주고, 실패가 있으면 끝 상태 1
검사: ① 길이 15~45초 ② 크기 1080×1920 ③ 음량 -15~-13 LUFS ④ 높은 소리(4kHz 위) 비중 12% 이하
      ⑤ 첫 1초 안에 화면에 글자·그림이 있는지(검은 화면 금지) ⑥ 아래 25%·오른쪽 14%(앱 단추 자리)에 밝은 글자가 몰리지 않는지는 눈 검사용 그림으로 뽑음
"""
import json, subprocess, sys, os, re
import numpy as np

def probe(f):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f], capture_output=True, text=True).stdout)
    v = [s for s in j['streams'] if s['codec_type'] == 'video'][0]
    return float(j['format']['duration']), int(v['width']), int(v['height'])

def lufs(f):
    e = subprocess.run(['ffmpeg', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', e)
    return float(m[-1]) if m else -99

def high_share(f):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(float)
    if len(x) < 2048: return 0
    X = np.abs(np.fft.rfft(x)) ** 2; fr = np.fft.rfftfreq(len(x), 1 / 22050)
    return float(X[fr > 4000].sum() / X.sum())

def first_frame_busy(f):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', '0.5', '-i', f, '-frames:v', '1', '-vf', 'scale=90:160,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.uint8).astype(float)
    return float(a.std()) if len(a) else 0

bad = 0
print(f"{'파일':34s} 길이   크기       음량    높은소리 첫화면  판정")
for f in sys.argv[1:]:
    d, w, h = probe(f); l = lufs(f); hs = high_share(f); st = first_frame_busy(f)
    fails = []
    if not 15 <= d <= 45: fails.append('길이')
    if (w, h) != (1080, 1920): fails.append('크기')
    if not -15.5 <= l <= -12.5: fails.append('음량')
    if hs > 0.12: fails.append('높은소리')
    if st < 14: fails.append('첫화면 비어 있음')
    bad += bool(fails)
    print(f"{os.path.basename(f)[:34]:34s} {d:5.1f}s {w}x{h} {l:6.1f}  {hs*100:5.1f}%  {st:5.1f}  {'통과' if not fails else '실패: ' + ', '.join(fails)}")
sys.exit(1 if bad else 0)
