#!/usr/bin/env python3
"""분위기별 배경음 작곡(미디) — 재즈 힙합(로파이·붐뱁) 풍 (2026-11-28 대표 「중국풍 말고 재지 힙합·재즈 섞어 힙하게」)
5음 음계 가락을 버리고: 9도·13도 화음(2-5-1 진행), 뒤로 밀리는 16분 스윙 북, 통 베이스의 반음 접근, 화음 음+반음 꾸밈 가락.
"""
import mido, random, math, sys, os
random.seed(23)
# 화음: (건반 짚는 음, 가락 A, 가락 B) — 모두 밑음 기준 반음 수. 가락은 (박, 음, 길이)
Q = {
 'maj9': ((4, 7, 11, 14), [(0.5,7,.5),(1,11,.5),(1.5,14,1.0),(2.75,13,.25),(3,14,.5),(3.5,11,.5)], [(0,16,.75),(1,14,.5),(1.5,11,.5),(2.5,8,.25),(2.75,9,.5),(3.5,7,.5)]),
 'min9': ((3, 7, 10, 14), [(0.5,3,.5),(1,7,.5),(1.5,10,.5),(2,14,1.0),(3.25,13,.25),(3.5,12,.5)], [(0,15,.5),(0.5,14,.5),(1,10,1.0),(2.5,6,.25),(2.75,7,.75),(3.5,3,.5)]),
 'dom13': ((10, 14, 16, 21), [(0.5,4,.5),(1,7,.5),(1.5,10,.5),(2,14,.75),(3,13,.5),(3.5,9,.5)], [(0,21,.5),(0.5,19,.5),(1,16,.5),(1.5,14,1.0),(3,10,.5),(3.5,8,.5)]),
 'dom#9': ((4, 10, 15, 20), [(0,16,.5),(0.5,15,.5),(1,13,.5),(1.5,10,1.0),(3,8,.5),(3.5,7,.5)], [(0.5,10,.5),(1,15,.25),(1.25,16,.75),(2.5,13,.5),(3,10,.5),(3.5,8,.5)]),
}
D = 9
class Song:
    def __init__(s, name, bpm, bars, sw=0.07):
        s.name, s.bpm, s.bars, s.sw, s.ev, s.pg = name, bpm, bars, sw, [], {}
    def inst(s, ch, prog, vol=100, pan=64, rev=40, cho=0): s.pg[ch] = (prog, vol, pan, rev, cho)
    def n(s, ch, note, beat, dur, vel, late=0.0):
        if int(round(beat * 4)) % 2 == 1 and abs(beat * 4 - round(beat * 4)) < 0.01: beat += s.sw      # 16분 뒷박을 뒤로 민다
        beat += late + random.uniform(-0.01, 0.012); vel += random.randint(-7, 7)
        s.ev.append((max(0, beat), ch, int(note), max(1, min(127, int(vel))), dur))
    def segs(s, b):
        bar = s.bars[b % len(s.bars)]; out = []
        for i, (st, r, q) in enumerate(bar):
            en = bar[i + 1][0] if i + 1 < len(bar) else 4
            out.append((st, en - st, r, q))
        return out
    def nextroot(s, b, i):
        sg = s.segs(b)
        return sg[i + 1][2] if i + 1 < len(sg) else s.segs(b + 1)[0][2]
    def save(s, d):
        m = mido.MidiFile(ticks_per_beat=480); t = mido.MidiTrack(); m.tracks.append(t)
        t.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(s.bpm), time=0))
        for ch, (p, v, pan, rev, cho) in s.pg.items():
            t.append(mido.Message('program_change', channel=ch, program=p, time=0))
            for cc, val in ((7, v), (10, pan), (91, rev), (93, cho)): t.append(mido.Message('control_change', channel=ch, control=cc, value=val, time=0))
        evs = []
        for b, ch, note, vel, dur in s.ev:
            evs.append((int(b * 480) + 120, 1, ch, note, vel)); evs.append((int((b + dur) * 480) + 120, 0, ch, note, 0))
        evs.sort(key=lambda e: (e[0], e[1])); last = 0
        for tk, on, ch, note, vel in evs:
            t.append(mido.Message('note_on' if on else 'note_off', channel=ch, note=note, velocity=vel, time=tk - last)); last = tk
        m.save(os.path.join(d, f'mood_{s.name}.mid'))
def fold(x, lo): return (x - lo) % 12 + lo

def make(name, bpm, bars, kit, comp, bassp, leads, style, sec=54, sw=0.07, lead_lo=62):
    s = Song(name, bpm, bars, sw)
    s.inst(0, comp, 88, 50, 45, 30); s.inst(1, bassp, 104, 64, 8); s.inst(2, leads[0], 100, 76, 50); s.inst(3, leads[1], 98, 56, 50)
    s.inst(4, 28 if style == 'funk' else 48, 70 if style == 'funk' else 52, 90, 55); s.inst(D, kit, 104, 64, 20)
    N = math.ceil(sec / (240 / bpm) / 4) * 4
    for b in range(N):
        t = b * 4; first = b == 0; last4 = b % 4 == 3
        for i, (st, ln, r, q) in enumerate(s.segs(b)):
            v = sorted(fold(60 + r + iv, 54) for iv in Q[q][0]); root = fold(r, 36 if r % 12 >= 4 else 40) ; nr = fold(s.nextroot(b, i), 36)
            appr = nr + (1 if (b + i) % 2 else -1)
            # 건반 화음
            if style == 'funk': hits = [(0, .3, 74), (1.5, .25, 60), (2.75, .2, 56), (3.5, .4, 66)] if ln == 4 else [(0, .3, 72), (1.5, .3, 60)]
            elif style == 'roll': hits = [(0, ln - .3, 62)]
            elif style == 'dark': hits = [(0, ln - .2, 54), (ln - .5, .3, 50)]
            else: hits = [(0, 1.4, 68), (2.5, 1.1, 58)] if ln == 4 else [(0, 1.4, 66)]
            for hb, hd, hv in hits:
                for k, x in enumerate(v): s.n(0, x, t + st + hb + (k * 0.03 if style in ('roll', 'laid') else 0), hd, hv - k * 2)
            if style == 'roll' and ln == 4: s.n(0, v[-1] + 12, t + st + 2.5, 1.2, 50); s.n(0, v[1] + 12, t + st + 3, .9, 44)
            # 베이스
            if first: pass
            elif ln < 4: s.n(1, root, t + st, 1.3, 96); s.n(1, appr, t + st + 1.5, .4, 78)
            elif style == 'funk':
                for bb, nn, d, vv in ((0, root, .7, 100), (1.5, root, .3, 80), (2, root + 7, .4, 84), (2.75, root + 12, .2, 74), (3.5, appr, .4, 84)): s.n(1, nn, t + bb, d, vv)
            elif style == 'roll': s.n(1, root, t, 2.6, 92); s.n(1, appr, t + 3.5, .4, 72)
            elif style == 'dark':
                for bb, nn, d, vv in ((0, root, .9, 98), (1.5, root, .4, 76), (2, root + 10, .8, 82), (3, root + 7, .4, 76), (3.5, appr, .4, 80)): s.n(1, nn, t + bb, d, vv)
            else:
                for bb, nn, d, vv in ((0, root, 1.3, 98), (1.75, root + 7, .25, 66), (2.5, root + (4 if 'maj' in q or 'dom' in q else 3), .9, 82), (3.5, appr, .4, 80)): s.n(1, nn, t + bb, d, vv)
            # 가락: 2마디 묻고 2마디는 짧게 받는다. 8마디마다 악기를 바꾼다
            if b >= 1:
                ch = 2 if ((b - 1) // 8) % 2 == 0 else 3
                lick = Q[q][1 + ((b + i) % 2)]
                call = (b - 1) % 4 in (0, 1)
                base = fold(60 + r, lead_lo - 5)
                for lb, iv, ld in lick:
                    if lb >= ln: continue
                    if not call and lb < 2: continue
                    s.n(ch, base + iv - (12 if base + iv > lead_lo + 22 else 0), t + st + lb, ld * 0.92, 84 + (8 if lb % 1 == 0 else 0), late=0.02)
        if first:
            continue
        # 북: 붐뱁
        if style == 'roll':
            kicks, sn, hv = [(0, 84), (2.5, 64)], 37, 34
        elif style == 'dark':
            kicks, sn, hv = [(0, 100), (1.75, 60), (2.5, 84)], 37, 30
        elif style == 'funk':
            kicks, sn, hv = [(0, 104), (0.75, 62), (2, 84), (2.5, 92), (3.75, 58)], 38, 46
        else:
            kicks, sn, hv = [(0, 100), (1.75, 58), (2.5, 88)], 38, 42
        for kb, kv in kicks: s.n(D, 36, t + kb, .2, kv)
        for sb in (1, 3): s.n(D, sn, t + sb, .2, 88 if sn == 38 else 72, late=0.025)
        if style == 'funk':
            for sb in (1, 3): s.n(D, 39, t + sb, .2, 54, late=0.03)
        for k in range(8): s.n(D, 42, t + k * .5, .1, hv + (14 if k % 2 == 0 else 0))
        for gb in ((1.75, 3.25) if b % 2 else (3.75,)): s.n(D, 42, t + gb, .1, hv - 8)
        if sn == 38 and b % 2: s.n(D, 38, t + 2.25, .1, 34)                      # 유령음
        if last4: s.n(D, 46, t + 3.5, .4, hv + 8)
        if style == 'funk':                                                       # 뮤트 기타 끊어치기
            v0 = sorted(fold(60 + s.segs(b)[0][2] + iv, 60) for iv in Q[s.segs(b)[0][3]][0])[:3]
            for gb in (0.5, 1.25, 2.5, 3.25):
                for x in v0: s.n(4, x, t + gb, .12, 52)
        elif style in ('dark', 'laid') and b >= 9:                                # 뒤쪽에 현을 얇게 깐다
            sg = s.segs(b)[0]; 
            for x in sorted(fold(60 + sg[2] + iv, 58) for iv in Q[sg[3]][0])[1:3]: s.n(4, x, t, 3.9, 40)
    s.save(sys.argv[1] if len(sys.argv) > 1 else '.')

B = lambda *x: [list(x[i:i + 1]) for i in range(len(x))]
c = lambda r, q, st=0: (st, r, q)
# 경쾌: 펑키한 재즈 힙합 — 전기 건반 끊어치기, 전기 베이스, 808 북+손뼉, 재즈 기타 → 뮤트 트럼펫
make('up', 96, [[c(0,'maj9')],[c(9,'dom#9')],[c(2,'min9')],[c(7,'dom13')],[c(4,'min9')],[c(9,'dom#9')],[c(2,'min9')],[c(7,'dom13'),c(1,'dom13',2)]], 25, 4, 33, (26, 59), 'funk', sw=0.06)
# 일상 대화: 느긋한 붐뱁 — 전기 건반, 통 베이스, 재즈 기타 → 피아노
make('talk', 90, [[c(5,'maj9')],[c(4,'dom#9')],[c(9,'min9')],[c(7,'min9'),c(0,'dom13',2)]], 8, 4, 32, (26, 0), 'laid', sw=0.08)
# 차분: 로파이 — 굴리는 피아노 화음, 통 베이스, 테두리 치기, 나일론 기타 → 전기 건반
make('calm', 76, [[c(3,'maj9')],[c(0,'min9')],[c(8,'maj9')],[c(10,'dom13')]], 32, 0, 32, (24, 4), 'roll', sec=56, sw=0.09)
# 긴장: 어두운 재즈 힙합 — 길게 누른 전기 건반, 베이스 반복, 뮤트 트럼펫 → 낮은 피아노
make('tense', 88, [[c(9,'min9')],[c(9,'min9')],[c(5,'maj9')],[c(4,'dom#9')]], 25, 4, 32, (59, 0), 'dark', sw=0.07, lead_lo=58)
# 따뜻: 네오 소울 — 전기 건반, 통 베이스, 테너 색소폰 → 재즈 기타
make('warm', 82, [[c(7,'maj9')],[c(4,'min9')],[c(9,'min9')],[c(2,'dom13')],[c(11,'min9')],[c(4,'dom#9')],[c(9,'min9')],[c(2,'dom13'),c(8,'dom13',2)]], 32, 4, 32, (66, 26), 'laid', sec=56, sw=0.08)
