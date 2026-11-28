#!/usr/bin/env python3
"""나레이션 한 파일(문단 사이에 쉼)을 줄별 소리로 나눈다.
쓰기: narr_split.py 입력.mp3 대본.json 출력접두(예: public/sfx/t1_) 결과.json
대본.json = ["첫 줄 자막", ...]  (자막 줄 수만큼 가장 긴 쉼 N-1 곳에서 자른다)
줄마다 앞뒤 쉼 제거 → 1.1배 → 치찰음 줄임 → 6.5kHz 위 깎기 → 음량 -16 맞춤. 대본 한 줄은 한 문장으로 쓴다(줄 안에 마침표가 있으면 그 쉼이 문단 쉼만큼 길어져 잘못 잘린다). 어긋나면 다섯째 인자로 자를 시각을 준다.
결과.json = {"1": {"dur": 프레임, "text": 자막}}"""
import sys, json, re, subprocess as sp
src, script, pre, out = sys.argv[1:5]
manual = [float(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else None   # 자를 시각을 직접 줄 때(초, 쉼표로)
lines = json.load(open(script)); n = len(lines)
log = sp.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
dur = float(sp.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
gaps = [(e - s, s, e) for s, e in zip(st, en) if s > 0.3 and e < dur - 0.2]
gaps = sorted(sorted(gaps, reverse=True)[:n - 1], key=lambda g: g[1])
if manual: gaps = [(0, c, c) for c in manual]
if len(gaps) != n - 1: sys.exit(f'쉼 {len(gaps)}곳뿐(필요 {n - 1}) — 문단 쉼을 못 찾음')
cuts = [0.0] + [(s + e) / 2 for _, s, e in gaps] + [dur]
res = {}
for k in range(n):
    f = f'{pre}{k + 1:02d}.wav'
    af = ('silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse,'
          'atempo=1.1,deesser=i=0.6,lowpass=f=6500,loudnorm=I=-16:TP=-1.5:LRA=11')
    sp.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(cuts[k]), '-to', str(cuts[k + 1]), '-i', src, '-af', af, '-ar', '48000', '-ac', '1', f], check=True)
    d = float(sp.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
    res[str(k + 1)] = {'dur': round(d * 30) + 3, 'text': lines[k]}
    print(k + 1, f'{d:.2f}초', f'쉼 {gaps[k][0]:.2f}' if k < n - 1 else '', lines[k].replace('\n', ' / '))
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
