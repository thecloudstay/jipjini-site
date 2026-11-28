#!/usr/bin/env python3
"""분위기별 배경음 작곡(미디) — 실제 악기 음색으로 연주시킬 악보를 만든다.
악기: 기타(나일론·쇠줄·뮤트), 베이스(통·전기), 북(일반·솔), 전기 건반, 피아노, 마림바, 현(뜯기·깔기·첼로), 클라리넷, 봉고·콩가·카바사
"""
import mido, random, math, sys, os
random.seed(11)
MAJ7=(0,4,7,11); MIN7=(0,3,7,10); MAJ=(0,4,7); MIN=(0,3,7); DOM=(0,4,7,10)
class Song:
    def __init__(s, name, bpm, key, prog, pent, swing=0.0):
        s.name, s.bpm, s.key, s.prog, s.ev, s.pg, s.swing = name, bpm, key, prog, [], {}, swing
        s.pent = pent
    def inst(s, ch, prog, vol=100, pan=64, rev=40): s.pg[ch] = (prog, vol, pan, rev)
    def n(s, ch, note, beat, dur, vel, human=True):
        fb = beat % 1
        if s.swing and abs(fb - 0.5) < 0.01: beat += s.swing
        if human: beat += random.uniform(-0.012, 0.012); vel += random.randint(-6, 6)
        s.ev.append((max(0, beat), ch, int(note), max(1, min(127, int(vel))), dur))
    def chord(s, bar, low):
        r, q = s.prog[bar % len(s.prog)]
        return sorted((s.key + r + iv - low) % 12 + low for iv in q)
    def root(s, bar, low=36):
        r, q = s.prog[bar % len(s.prog)]; return (s.key + r - low) % 12 + low
    def sc(s, i, base=60):
        return base + s.key % 12 + s.pent[i % 5] + 12 * (i // 5)
    def strum(s, ch, bar, beat, dur, vel, low=52, up=False):
        c = s.chord(bar, low); c = c[::-1] if up else c
        for i, x in enumerate(c): s.n(ch, x, bar * 4 + beat + i * 0.025, dur, vel - i * 3)
    def mel(s, ch, bar0, phrase, vel=84, base=60, harm=None):
        for b, i, d in phrase:
            s.n(ch, s.sc(i, base), bar0 * 4 + b, d * 0.95, vel + (6 if b % 4 == 0 else 0))
            if harm: s.n(ch, s.sc(i - harm, base), bar0 * 4 + b, d * 0.95, vel - 16)
    def save(s, d):
        m = mido.MidiFile(ticks_per_beat=480); t = mido.MidiTrack(); m.tracks.append(t)
        t.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(s.bpm), time=0))
        for ch, (p, v, pan, rev) in s.pg.items():
            t.append(mido.Message('program_change', channel=ch, program=p, time=0))
            for cc, val in ((7, v), (10, pan), (91, rev)): t.append(mido.Message('control_change', channel=ch, control=cc, value=val, time=0))
        evs = []
        for b, ch, note, vel, dur in s.ev:
            evs.append((int(b * 480) + 240, 1, ch, note, vel)); evs.append((int((b + dur) * 480) + 240, 0, ch, note, 0))
        evs.sort(key=lambda e: (e[0], e[1])); last = 0
        for tk, on, ch, note, vel in evs:
            t.append(mido.Message('note_on' if on else 'note_off', channel=ch, note=note, velocity=vel, time=tk - last)); last = tk
        m.save(os.path.join(d, f'mood_{s.name}.mid'))
D = 9
def bars_for(bpm, sec=54): return math.ceil(sec / (240 / bpm) / 4) * 4

# ── 경쾌: 뮤트 기타 리프 + 전기 베이스 + 콩가 + 전기 건반, 가락은 재즈 기타 → 마림바
def up():
    s = Song('up', 104, 0, [(0, MAJ7), (9, MIN7), (5, MAJ7), (7, DOM)], [0, 2, 4, 7, 9])
    s.inst(0, 28, 92, 40); s.inst(1, 33, 92, 64, 10); s.inst(2, 4, 84, 84, 50); s.inst(3, 26, 104, 70, 45); s.inst(4, 12, 100, 54, 45); s.inst(D, 0, 100, 64, 25)
    A1 = [(0.5,2,.5),(1,3,.5),(1.5,4,1),(3,3,.5),(3.5,2,.5),(4.5,4,.5),(5,5,.75),(6,4,.5),(6.5,3,1),(8.5,2,.5),(9,3,.5),(9.5,4,.5),(10,5,1),(11.5,4,.5),(12,3,1),(13.5,2,.5),(14,1,.5),(14.5,2,1)]
    A2 = [(0.5,2,.5),(1,3,.5),(1.5,4,1),(3,3,.5),(3.5,4,.5),(4,5,.5),(5,5,.5),(5.5,6,1),(7,5,.5),(8,7,.75),(9,6,.5),(9.5,5,.5),(10.5,4,.5),(11,3,1),(12.5,2,.5),(13,1,.5),(13.5,0,2)]
    N = bars_for(104)
    for b in range(N):
        t = b * 4; intro = b < 1; fill = b % 4 == 3
        c = s.chord(b, 55)
        for k, i in enumerate([0, None, 1, 2, None, 1, 0, None, 2, None, 1, 2, None, 0, 1, None]):       # 뮤트 기타 16분
            if i is not None: s.n(0, c[i % len(c)], t + k * 0.25, 0.14, 62 + (14 if k % 4 == 0 else 0))
        if not intro:
            r = s.root(b)
            for bt, nn, d, v in ((0, r, .9, 96), (1.5, r, .4, 80), (2, r + 12, .4, 78), (2.5, r + 7, .9, 86), (3.5, r + (10 if fill else 7), .4, 78)): s.n(1, nn, t + bt, d, v)
            for bt in (1.5, 3): s.strum(2, b, bt, 0.3, 58, 60)
            for bt, v in ((0, 96), (1.5, 70), (2, 88)): s.n(D, 36, t + bt, .2, v)
            for bt in (1, 3): s.n(D, 37, t + bt, .2, 70)
            for k in range(8): s.n(D, 69, t + k * .5, .1, 30 + (14 if k % 2 else 0))
            for bt, nn, v in ((0.75, 63, 52), (1.75, 63, 46), (2.5, 64, 58), (3.25, 63, 50), (3.75, 64, 56)): s.n(D, nn, t + bt, .2, v)
            if fill:
                for bt in (3.5, 3.75): s.n(D, 38, t + bt, .1, 54)
        sec = (b - 1) // 4
        if b >= 1 and (b - 1) % 4 == 0:
            ph = A1 if sec % 2 == 0 else A2
            if (sec // 2) % 2 == 0: s.mel(3, b, ph, 86)
            else: s.mel(4, b, ph, 88, base=60, harm=None)
    return s

# ── 일상 대화: 나일론 기타 스트럼 + 현 뜯기 + 통 베이스 + 봉고, 가락은 클라리넷 → 기타
def talk():
    s = Song('talk', 112, 5, [(0, MAJ), (9, MIN), (5, MAJ), (7, MAJ)], [0, 2, 4, 7, 9], swing=0.08)
    s.inst(0, 24, 96, 44); s.inst(1, 32, 110, 64, 10); s.inst(2, 45, 86, 88, 50); s.inst(3, 71, 92, 70, 55); s.inst(4, 24, 108, 76, 45); s.inst(D, 0, 100, 64, 25)
    A1 = [(0,2,1),(1,3,.5),(1.5,4,.5),(2,3,1.5),(4,4,.5),(4.5,5,.5),(5,4,.5),(5.5,3,.5),(6,2,1.5),(8,0,.5),(8.5,1,.5),(9,2,1),(10,4,1),(11,3,.5),(11.5,2,.5),(12,1,1.5),(14,0,.5),(14.5,1,1)]
    A2 = [(0,2,1),(1,3,.5),(1.5,4,.5),(2,5,1.5),(4,6,.5),(4.5,5,.5),(5,4,1),(6,3,.5),(6.5,4,1),(8,5,1),(9,4,.5),(9.5,3,.5),(10,2,1),(11,1,.5),(11.5,2,.5),(12,3,1),(13,1,1),(14,0,1.8)]
    N = bars_for(112)
    for b in range(N):
        t = b * 4; intro = b < 1
        for bt, up_, v in ((0, 0, 78), (1, 0, 64), (1.5, 1, 52), (2.5, 1, 56), (3, 0, 68), (3.5, 1, 50)): s.strum(0, b, bt, 0.45, v, 55, up_)
        if not intro:
            r = s.root(b, 41)
            s.n(1, r, t, 1.4, 96); s.n(1, r + 7 if r + 7 < 55 else r - 5, t + 2, 1.2, 88); s.n(1, r, t + 3.5, .4, 70)
            c = s.chord(b, 60)
            for bt, i in ((0.5, 0), (1.5, 1), (2.5, 2), (3.5, 1)): s.n(2, c[i], t + bt, .3, 62)
            for bt, nn, v in ((0, 61, 60), (0.5, 60, 44), (1, 60, 62), (2, 61, 56), (2.5, 60, 46), (3, 60, 64), (3.5, 61, 48)): s.n(D, nn, t + bt, .2, v)
            for bt in (1, 3): s.n(D, 37, t + bt, .2, 56)
            for k in range(8): s.n(D, 70, t + k * .5, .1, 26 + (10 if k % 2 else 0))
        sec = (b - 1) // 4
        if b >= 1 and (b - 1) % 4 == 0:
            ph = A1 if sec % 2 == 0 else A2
            if (sec // 2) % 2 == 0: s.mel(3, b, ph, 80, base=60)
            else: s.mel(4, b, ph, 88, base=60, harm=2)
    return s

# ── 차분: 나일론 기타 아르페지오 + 현 깔기 + 통 베이스 + 솔 북, 가락은 피아노 → 첼로
def calm():
    s = Song('calm', 78, 2, [(0, MAJ7), (7, MAJ), (9, MIN7), (5, MAJ7)], [0, 2, 4, 7, 9])
    s.inst(0, 24, 100, 50); s.inst(1, 32, 104, 64, 10); s.inst(2, 48, 62, 64, 70); s.inst(3, 0, 92, 72, 60); s.inst(4, 42, 86, 58, 60); s.inst(D, 40, 84, 64, 35)
    A1 = [(0,4,2),(2,3,1),(3,2,1),(4,3,3),(8,2,1.5),(9.5,3,.5),(10,4,1),(11,5,1),(12,4,2),(14,2,1.5)]
    A2 = [(0,5,2),(2,4,1),(3,3,1),(4,4,2),(6,2,1.5),(8,3,1.5),(9.5,4,.5),(10,5,1),(11,6,1),(12,5,3.5)]
    N = bars_for(78, 56)
    for b in range(N):
        t = b * 4; intro = b < 1
        c = s.chord(b, 50); r = s.root(b, 40)
        for k, i in enumerate([0, 2, 1, 3, 2, 1, 3, 2]):
            s.n(0, c[i % len(c)] + (12 if i == 3 and len(c) < 4 else 0), t + k * .5, 1.2, 64 + (10 if k == 0 else 0))
        s.n(1, r, t, 3.4, 84)
        if not intro:
            for x in s.chord(b, 60)[:3]: s.n(2, x, t, 3.9, 44, False)
            for bt in (1, 3): s.n(D, 38, t + bt, .3, 34)
            for k in range(4): s.n(D, 44, t + k + .5, .1, 28)
            s.n(D, 36, t, .2, 54)
        sec = (b - 1) // 4
        if b >= 1 and (b - 1) % 4 == 0:
            ph = A1 if sec % 2 == 0 else A2
            if (sec // 2) % 2 == 0: s.mel(3, b, ph, 76, base=60)
            else: s.mel(4, b, ph, 78, base=48)
    return s

# ── 긴장: 현 뜯기 반복 + 낮은 마림바 + 첼로 + 나무토막 똑딱, 가락은 낮은 피아노 → 클라리넷 낮은 음
def tense():
    s = Song('tense', 92, 9, [(0, MIN), (0, MIN), (8, MAJ), (10, MAJ)], [0, 3, 5, 7, 10])
    s.inst(0, 45, 96, 44, 50); s.inst(1, 33, 86, 64, 10); s.inst(2, 12, 84, 86, 40); s.inst(3, 0, 94, 68, 55); s.inst(4, 42, 78, 60, 65); s.inst(5, 71, 92, 72, 55); s.inst(D, 0, 100, 64, 30)
    A1 = [(0,0,1),(1.5,1,.5),(2,2,1),(3,1,.5),(3.5,0,2),(6.5,-1,.5),(7,0,1),(8,2,1),(9.5,3,.5),(10,2,1),(11,1,1),(12,2,1.5),(13.5,1,.5),(14,0,1.8)]
    A2 = [(0,3,1),(1.5,2,.5),(2,3,1),(3,4,.5),(3.5,3,2),(6,2,.5),(6.5,1,.5),(7,0,1),(8,2,1.5),(9.5,3,.5),(10,5,1.5),(12,4,1),(13,3,1),(14,2,1.8)]
    N = bars_for(92)
    for b in range(N):
        t = b * 4; intro = b < 1
        c = s.chord(b, 57); r = s.root(b, 33)
        for k, i in enumerate([0, 2, 1, 2, 0, 2, 1, 2]): s.n(0, c[i], t + k * .5, .25, 66 + (12 if k % 4 == 0 else 0))
        for k in range(8): s.n(D, 76, t + k * .5, .1, 34 + (10 if k % 2 == 0 else 0))
        if not intro:
            for k in range(8): s.n(1, r + (12 if k == 7 else 0), t + k * .5, .35, 84 if k % 2 == 0 else 62)
            s.n(4, r + 12, t, 3.9, 60, False)
            for bt, i in ((0.75, 0), (1.75, 1), (2.75, 0), (3.25, 2)): s.n(2, c[i] - 12, t + bt, .3, 60)
            for bt, v in ((0, 96), (2.5, 78)): s.n(D, 36, t + bt, .2, v)
            for bt in (1, 3): s.n(D, 37, t + bt, .2, 58)
            if b % 4 == 3:
                for bt, nn in ((3, 45), (3.5, 43), (3.75, 41)): s.n(D, nn, t + bt, .2, 66)
        sec = (b - 1) // 4
        if b >= 1 and (b - 1) % 4 == 0:
            ph = A1 if sec % 2 == 0 else A2
            if (sec // 2) % 2 == 0: s.mel(3, b, ph, 82, base=48)
            else: s.mel(5, b, ph, 80, base=48)
    return s

# ── 따뜻: 쇠줄 기타 스트럼 + 현 깔기 + 통 베이스 + 솔 북, 가락은 피아노 → 나일론 기타(3도 화음)
def warm():
    s = Song('warm', 84, 7, [(0, MAJ7), (4, MIN7), (5, MAJ7), (7, DOM)], [0, 2, 4, 7, 9])
    s.inst(0, 25, 84, 42); s.inst(1, 32, 96, 64, 10); s.inst(2, 48, 60, 70, 70); s.inst(3, 0, 96, 72, 60); s.inst(4, 24, 108, 76, 50); s.inst(D, 40, 88, 64, 35)
    A1 = [(0,2,1.5),(1.5,3,.5),(2,4,2),(4,3,1),(5,2,1),(6,3,2),(8,4,1.5),(9.5,5,.5),(10,4,1),(11,3,1),(12,2,2),(14,1,1.5)]
    A2 = [(0,4,1.5),(1.5,5,.5),(2,6,2),(4,5,1),(5,4,1),(6,5,2),(8,7,1.5),(9.5,6,.5),(10,5,1),(11,4,1),(12,3,1),(13,2,1),(14,2,1.8)]
    N = bars_for(84, 56)
    for b in range(N):
        t = b * 4; intro = b < 1
        for bt, up_, v in ((0, 0, 70), (1, 0, 54), (1.5, 1, 44), (2, 0, 62), (3, 0, 52), (3.5, 1, 44)): s.strum(0, b, bt, 0.9, v, 52, up_)
        r = s.root(b, 40)
        if not intro:
            s.n(1, r, t, 1.8, 92); s.n(1, r, t + 2.5, .5, 70); s.n(1, r + 7 if r + 7 < 53 else r - 5, t + 3, .9, 78)
            for x in s.chord(b, 60)[:3]: s.n(2, x, t, 3.9, 42, False)
            s.n(D, 36, t, .2, 70); s.n(D, 36, t + 2.5, .2, 54)
            for bt in (1, 3): s.n(D, 38, t + bt, .3, 44)
            for k in range(8): s.n(D, 44 if k % 2 else 42, t + k * .5, .1, 24 + (8 if k % 2 else 0))
        sec = (b - 1) // 4
        if b >= 1 and (b - 1) % 4 == 0:
            ph = A1 if sec % 2 == 0 else A2
            if (sec // 2) % 2 == 0: s.mel(3, b, ph, 80, base=60)
            else: s.mel(4, b, ph, 86, base=60, harm=2)
    return s
out = sys.argv[1] if len(sys.argv) > 1 else '.'
for f in (up, talk, calm, tense, warm): f().save(out)
