#!/usr/bin/env python3
"""밈·반응 소리를 직접 만든다(실제 악기·효과 음색) — 2026-11-28 대표 「높은 피치 다 빼, 와우·박수 등 밈 사운드 적극, 필요하면 만들어 써」
모두 낮은 음역으로 쓰고, 뽑은 뒤 3.2kHz 위를 깎는다."""
import mido, sys, os
out = sys.argv[1]
def song(name, bpm, tracks):
    m = mido.MidiFile(ticks_per_beat=480); t = mido.MidiTrack(); m.tracks.append(t)
    t.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm), time=0))
    ev = []
    for ch, prog, bank, notes, bends in tracks:
        if ch != 9: ev.append((0, 0, mido.Message('program_change', channel=ch, program=prog)))
        else: ev.append((0, 0, mido.Message('program_change', channel=9, program=prog)))
        ev.append((0, 0, mido.Message('control_change', channel=ch, control=91, value=30)))
        for b, n, d, v in notes:
            ev.append((int(b * 480) + 10, 2, mido.Message('note_on', channel=ch, note=n, velocity=v)))
            ev.append((int((b + d) * 480) + 10, 1, mido.Message('note_off', channel=ch, note=n, velocity=0)))
        for b, val in bends: ev.append((int(b * 480) + 10, 1, mido.Message('pitchwheel', channel=ch, pitch=val)))
    ev.sort(key=lambda e: (e[0], e[1])); last = 0
    for tk, _, msg in ev: msg.time = tk - last; last = tk; t.append(msg)
    m.save(os.path.join(out, name + '.mid'))
glide = lambda a, b, t0, t1, n=16: [(t0 + (t1 - t0) * i / n, int(a + (b - a) * i / n)) for i in range(n + 1)]
# 박수(관중): 박수 음색 2겹
song('applause', 120, [(0, 126, 0, [(0, 60, 5, 100), (0.1, 57, 5, 90)], [])])
song('clap_small', 120, [(0, 126, 0, [(0, 55, 2.4, 70)], [])])
# 관중 「오~」(감탄): 합창 아 음색을 아래에서 밀어 올렸다 내린다
song('crowd_oh', 120, [(0, 52, 0, [(0, 48, 2.6, 96), (0, 52, 2.6, 88), (0.05, 55, 2.6, 84)], glide(-5000, 1500, 0, 0.9) + glide(1500, -2500, 1.2, 2.6)),
                       (1, 53, 0, [(0, 43, 2.6, 80)], glide(-5000, 1500, 0, 0.9) + glide(1500, -2500, 1.2, 2.6))])
# 환호: 박수 + 「와~」
song('cheer', 120, [(0, 126, 0, [(0, 60, 5, 96)], []), (1, 52, 0, [(0.1, 50, 3, 90), (0.1, 53, 3, 84), (0.1, 57, 3, 80)], glide(-6000, 0, 0.1, 0.8) + glide(0, -1500, 2, 3.1))])
# 두구두구 → 쿵 (결과 직전)
song('drumroll', 120, [(9, 0, 0, [(i * 0.125, 38, 0.1, 40 + i * 4) for i in range(14)] + [(i * 0.25, 41, 0.2, 50 + i * 5) for i in range(7)] + [(1.75, 36, 0.4, 120), (1.75, 41, 0.5, 110)], [])])
# 짜잔: 낮은 금관 합주
song('tada', 120, [(0, 61, 0, [(0, 55, 0.22, 100), (0, 48, 0.22, 96), (0.25, 60, 1.6, 112), (0.25, 55, 1.6, 104), (0.25, 52, 1.6, 100), (0.25, 48, 1.6, 100)], []), (9, 0, 0, [(0.25, 36, 0.3, 110)], [])])
# 실망: 트롬본 「와 와 와 와~」
song('sad', 100, [(0, 57, 0, [(0, 58, 0.45, 100), (0.5, 57, 0.45, 100), (1, 56, 0.45, 100), (1.5, 55, 1.6, 104)], glide(0, -3500, 1.9, 3.0))])
# 웃음(효과 묶음) · 심장 소리(긴장) · 팀파니
song('laugh', 120, [(9, 56, 0, [(0, 52, 4, 100)], [])])
song('heart', 120, [(9, 56, 0, [(0, 55, 3, 110)], [])])
song('timp', 120, [(0, 47, 0, [(0, 41, 0.1, 60), (0.12, 41, 0.1, 70), (0.25, 41, 0.1, 80), (0.37, 41, 0.1, 90), (0.5, 36, 2.5, 120)], [])])
