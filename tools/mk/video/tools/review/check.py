#!/usr/bin/env python3
"""영상 자체 평가 1단계: 기계 검사 (2026-11-28 대표 「네가 만든 것 자체 평가·검증하도록 시스템 구성」)
근거: mk/research/2026-11-28-자체평가-체계.md — 값싼 기계 검사를 먼저 돌리고, 기계 검사의 탈락은 뒤 단계(검수 담당·제작자)의 「괜찮다」보다 항상 우선한다.

쓰는 법
  python3 tools/review/check.py --type tutorial out/v3/집지니_사용법_*.mp4
  python3 tools/review/check.py --type story --src src/ToonStory.tsx --narr src/story_narr.json out/v3/집지니_웹툰_*.mp4
  python3 tools/review/check.py --selftest          # 일부러 망친 영상이 탈락하는지(검사기가 살아 있는지) 확인
결과: 표 + mk/review/<날짜>-<파일>.json (상태 통과/수정/차단, 걸린 항목, 시간, 가장 작은 고칠 점)
"""
import argparse, json, os, re, subprocess, sys, datetime, difflib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.abspath(os.path.join(HERE, '..', '..'))
REPO = os.path.abspath(os.path.join(VIDEO, '..', '..', '..'))
LIMIT = {'tutorial': (15, 45), 'story': (35, 65), 'meme': (12, 30)}
# 대표가 싫다고 한 높은 음 소리(fx.ts 머리말과 같은 목록)
BAN = {'riser', 'rise', 'qup', 'pluck', 'pop', 'key1', 'key2', 'ding', 'glitch', 'hat', 'coins', 'chips', 'chips2', 'airhorn', 'scratch', 'reveal', 'm_ah', 'm_woo', 'm_hehe', 'm_gah', 'whoosh_a', 'whoosh_b', 'whoosh_c', 'pen', 'paper', 'carhorn'}

def sh(*a): return subprocess.run(a, capture_output=True)
def probe(f):
    j = json.loads(sh('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f).stdout)
    v = [s for s in j['streams'] if s['codec_type'] == 'video'][0]
    return float(j['format']['duration']), int(v['width']), int(v['height'])
def pcm(f, sr=22050):
    return np.frombuffer(sh('ffmpeg', '-loglevel', 'error', '-i', f, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-').stdout, dtype=np.int16).astype(np.float32) / 32768
def lufs_peak(f):
    e = sh('ffmpeg', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-').stderr.decode('utf8', 'ignore')
    i = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); p = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', e)
    return (float(i[-1]) if i else -99, float(p[-1]) if p else 0)
def tc(s): return f'{int(s // 60)}:{s % 60:04.1f}'

def audio_checks(f, x, sr=22050):
    out = []
    n, hop = 2048, 512
    if len(x) < n: return [('소리', '차단', '소리가 없음', '', '')]
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2; fq = np.fft.rfftfreq(n, 1 / sr)
    en = S.sum(1) + 1e-12; hi = S[:, fq > 3000].sum(1) / en; db = 10 * np.log10(en / en.max())
    # ① 높은 음이 튀는 구간: 3kHz 위가 40% 넘고 소리가 큰 상태가 0.15초 이상
    bad = (hi > 0.40) & (db > -22); t = np.arange(len(bad)) * hop / sr; runs = []; i = 0
    while i < len(bad):
        if bad[i]:
            j = i
            while j < len(bad) and bad[j]: j += 1
            if (j - i) * hop / sr >= 0.15: runs.append((t[i], (j - i) * hop / sr))
            i = j
        else: i += 1
    if runs: out.append(('높은 음', '수정', f'{len(runs)}곳', ', '.join(tc(a) for a, _ in runs[:6]), '그 시각의 효과음을 낮은 소리로 바꾸거나 3kHz 위를 깎는다'))
    # ② 어색한 정적: -45dB 아래가 1.2초 넘게(끝 0.6초 제외)
    q = db < -45; i = 0; sil = []
    while i < len(q):
        if q[i]:
            j = i
            while j < len(q) and q[j]: j += 1
            d = (j - i) * hop / sr
            if d >= 1.2 and t[j - 1] < len(x) / sr - 0.6: sil.append((t[i], d))
            i = j
        else: i += 1
    if sil: out.append(('정적', '수정', f'{len(sil)}곳', ', '.join(f'{tc(a)}({d:.1f}초)' for a, d in sil[:5]), '배경음을 깔거나 장면을 줄인다(일부러 넣은 정적이면 1.2초 안으로)'))
    X = np.abs(np.fft.rfft(x)) ** 2; F = np.fft.rfftfreq(len(x), 1 / sr); share = float(X[F > 4000].sum() / X.sum())
    if share > 0.12: out.append(('높은 소리 비중', '수정', f'{share * 100:.0f}%', '', '전체 소리에서 4kHz 위를 줄인다'))
    return out

def asr_check(f, narr):
    D = os.path.join(os.environ.get('JJ_ASR', '/tmp/claude-0/tts/sherpa-onnx-zipformer-korean-2024-06-24'), '')   # 끝에 빗금이 없어도 되게
    try:
        import sherpa_onnx
        g = lambda p: [D + x for x in os.listdir(D) if x.startswith(p) and x.endswith('.onnx') and 'int8' not in x][0]
        r = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=g('encoder'), decoder=g('decoder'), joiner=g('joiner'), tokens=D + 'tokens.txt', num_threads=2)
    except Exception as e:
        return [('말 알아듣기', '건너뜀', '음성 인식 모형 없음', '', 'tools/review/읽어보기.md 의 준비 단계를 따른다')]
    x = pcm(f, 16000); s = r.create_stream(); s.accept_waveform(16000, x); r.decode_stream(s)
    heard = re.sub(r'[^가-힣0-9]', '', s.result.text)
    lines = [re.sub(r'[^가-힣0-9]', '', v['text']) for v in json.load(open(narr)).values()]
    miss = []
    for k, ln in enumerate(lines):
        if len(ln) < 4: continue
        best = max((difflib.SequenceMatcher(None, ln, heard[i:i + len(ln) + 4]).ratio() for i in range(0, max(1, len(heard) - len(ln) + 1), 2)), default=0)
        if best < 0.55: miss.append(f'{k + 1}번 문장({best:.2f})')
    total = difflib.SequenceMatcher(None, ''.join(lines), heard).ratio()
    if miss: return [('말 알아듣기', '수정', f'{len(miss)}문장이 안 들림', ', '.join(miss[:6]), '그 문장에서 배경음·효과음을 줄이거나 음성을 다시 만든다')]
    return [('말 알아듣기', '통과', f'전체 일치 {total:.2f}', '', '')]

def source_checks(src, kind):
    out = []; s = open(src, encoding='utf8').read(); head = '\n'.join(s.split('\n')[:8])
    used = set(re.findall(r"snd\('([a-z_0-9]+)'", s)); bad = sorted(used & BAN)
    if bad: out.append(('금지 소리', '차단', ', '.join(bad), '', '높은 음 금지 목록에 있는 소리를 다른 소리로 바꾼다'))
    if 'mk/research/' not in head: out.append(('조사 먼저', '수정', '머리말에 조사 문서가 없음', '', '어떤 조사(mk/research/…)에 근거했는지 파일 머리말에 적는다'))
    if kind == 'story':
        if '재구성' not in s: out.append(('표기', '차단', '「재구성한 이야기」 표기 없음', '', '실제 후기로 보이지 않게 화면에 표기한다'))
        if re.search(r'[0-9,]+만', s) and '예시' not in s: out.append(('표기', '차단', '금액에 「예시」 표기 없음', '', '이야기용 금액·대화에 「예시」를 붙인다'))
    if 'jipjini.com' not in s and 'Logo' not in s: out.append(('끝 화면', '수정', '로고·jipjini.com 없음', '', '끝 화면에 큰 로고와 주소를 넣는다'))
    if re.search(r'jipjini\.com/[a-z]', s): out.append(('주소', '수정', '뒤 경로가 붙은 주소', '', 'jipjini.com 만 적는다'))
    caps = re.findall(r"cap: '([^']+)'|text=\{?'([^']+)'", s); words = ' '.join(a or b for a, b in caps)
    for w in ['한눈에', '혁신', '완벽', '놀라운', '스마트']:
        if w in words: out.append(('글', '수정', f'꾸밈말 「{w}」', '', '구체적인 사실 문장으로 바꾼다'))
    return out

def batch_checks(fmt):
    """묶음 검사(대표 지적 「왜 다 똑같은 폼?」 「동그라미만」 「하나만 전체에 다 적용」): 형식·표시·곡이 고루 쓰였는지"""
    out = []; s = open(fmt, encoding='utf8').read(); from collections import Counter
    kinds = re.findall(r"\{kind: '([a-z]+)'", s); music = Counter(re.findall(r"music: '([a-z_]+)'", s))
    dup = [k for k, c in Counter(kinds).items() if c > 1]
    if dup: out.append(('형식 다양성', '수정', '같은 형식이 두 편 이상: ' + ', '.join(dup), '', '편마다 갈고리 형식을 다르게'))
    over = [f'{k}({c}편)' for k, c in music.items() if c > 3]
    if over: out.append(('곡 쏠림', '수정', ', '.join(over), '', '한 곡은 한 묶음에 3편까지'))
    if len(music) < min(3, len(kinds)): out.append(('곡 쏠림', '수정', f'곡이 {len(music)}가지뿐', '', '분위기에 맞춰 곡을 나눠 쓴다'))
    marks = os.path.join(os.path.dirname(os.path.dirname(fmt)), 'Marks.tsx')
    if os.path.exists(marks):
        m = re.search(r"MARK_ORDER[^=]*=\s*\[([^\]]+)\]", open(marks, encoding='utf8').read())
        n = len(set(re.findall(r"'([a-z]+)'", m.group(1)))) if m else 0
        if n < 4: out.append(('표시 다양성', '수정', f'손 표시가 {n}가지뿐', '', '동그라미·별표·밑줄·화살표 등 4가지 이상을 돌려 쓴다'))
    return out

def first_frame(f):
    a = np.frombuffer(sh('ffmpeg', '-loglevel', 'error', '-ss', '0.5', '-i', f, '-frames:v', '1', '-vf', 'scale=90:160,format=gray', '-f', 'rawvideo', '-').stdout, dtype=np.uint8).astype(float)
    return float(a.std()) if len(a) else 0

def sheet(f, d, outdir):
    os.makedirs(outdir, exist_ok=True); p = os.path.join(outdir, os.path.splitext(os.path.basename(f))[0] + '_장면표.jpg'); n = 12
    sh('ffmpeg', '-loglevel', 'error', '-y', '-i', f, '-vf', f'fps={n / d:.4f},scale=270:-1,tile=6x2', '-frames:v', '1', '-q:v', '4', p)
    return p

def review(f, kind, src=None, narr=None, outdir=None):
    d, w, h = probe(f); l, pk = lufs_peak(f); x = pcm(f); lo, hi = LIMIT[kind]; items = []
    if not lo <= d <= hi: items.append(('길이', '수정', f'{d:.1f}초(기준 {lo}~{hi})', '', '장면 쉼을 줄이거나 문장을 덜어낸다'))
    if (w, h) != (1080, 1920): items.append(('크기', '차단', f'{w}x{h}', '', '1080x1920 으로 뽑는다'))
    if not -15.5 <= l <= -12.5: items.append(('음량', '수정', f'{l:.1f} LUFS', '', '-14 LUFS 로 맞춘다'))
    if pk > -0.8: items.append(('소리 깨짐', '수정', f'최대 {pk:.1f}dB', '', '최대값을 -1.2dB 아래로'))
    if first_frame(f) < 14: items.append(('첫 화면', '수정', '0.5초에 화면이 비어 있음', '0:00.5', '첫 장면에 그림·글자를 바로 넣는다'))
    items += audio_checks(f, x)
    if narr: items += asr_check(f, narr)
    if src: items += source_checks(src, kind)
    fails = [i for i in items if i[1] in ('수정', '차단')]
    status = '차단' if any(i[1] == '차단' for i in fails) else '수정' if fails else '통과'
    rec = {'파일': os.path.basename(f), '종류': kind, '검사한 때': datetime.datetime.now().isoformat(timespec='seconds'), '길이': round(d, 1), '음량': l, '상태': status,
           '항목': [dict(zip(('항목', '판정', '내용', '시각', '가장 작은 고칠 점'), i)) for i in items]}
    if outdir:
        rec['장면표'] = sheet(f, d, outdir)
        json.dump(rec, open(os.path.join(outdir, datetime.date.today().isoformat() + '-' + os.path.splitext(os.path.basename(f))[0] + '.json'), 'w'), ensure_ascii=False, indent=1)
    return rec

def selftest():
    """일부러 망친 영상 3개가 탈락하는지 본다. 하나라도 통과하면 검사기가 고장 난 것."""
    tmp = '/tmp/jj_canary'; os.makedirs(tmp, exist_ok=True); base = ['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:d=20:r=30']
    cases = {'높은음': ['-f', 'lavfi', '-i', 'sine=f=6000:d=20', '-af', 'volume=0.5'], '너무큼': ['-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink', '-af', 'volume=4,alimiter=limit=1'], '정적': ['-f', 'lavfi', '-i', 'sine=f=220:d=20', '-af', "volume='if(between(t,5,9),0,0.3)':eval=frame"]}
    ok = True
    for name, a in cases.items():
        p = f'{tmp}/{name}.mp4'; subprocess.run(base + a + ['-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', p])
        r = review(p, 'tutorial'); print(f'  망친 영상 「{name}」 → {r["상태"]}: {[i["항목"] for i in r["항목"]]}')
        if r['상태'] == '통과': ok = False
    print('검사기 자체 시험:', '정상(망친 영상을 모두 걸러 냄)' if ok else '고장(망친 영상이 통과함)'); return ok

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='*'); ap.add_argument('--type', default='tutorial', choices=list(LIMIT)); ap.add_argument('--src'); ap.add_argument('--narr'); ap.add_argument('--selftest', action='store_true'); ap.add_argument('--batch', help='묶음 형식 파일(src/tut/fmt.ts)')
    ap.add_argument('--out', default=os.path.join(REPO, 'mk', 'review')); a = ap.parse_args()
    if a.selftest: sys.exit(0 if selftest() else 1)
    bad = 0
    if a.batch:
        b = batch_checks(a.batch); bad += bool(b); print('[묶음]', '통과' if not b else '수정')
        for i in b: print(f'    - {i[1]} · {i[0]}: {i[2]} → {i[4]}')
    for f in a.files:
        r = review(f, a.type, a.src, a.narr, a.out); bad += r['상태'] != '통과'
        print(f"[{r['상태']}] {r['파일']}  {r['길이']}초  {r['음량']} LUFS")
        for i in r['항목']:
            if i['판정'] != '통과': print(f"    - {i['판정']} · {i['항목']}: {i['내용']} {('@ ' + i['시각']) if i['시각'] else ''} → {i['가장 작은 고칠 점']}")
    sys.exit(1 if bad else 0)
