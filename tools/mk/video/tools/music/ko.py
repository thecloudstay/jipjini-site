# 한국어 말하는 밈을 직접 만든다 (2026-11-28 대표 「가보자고·가즈아·이야야·오예·예쓰 같은 것, 말한 것만 쓰지 말고 다각도로」)
# 음성: 수퍼토닉 2(수퍼톤, 한국어 지원, 기기 안에서 합성) — 셰르파 오닉스로 돌림. 떼창은 세 목소리를 겹친다.
import subprocess, os, sys
from say import say
OUT = sys.argv[1]
P = {  # 이름: (문구, 목소리 번호, 빠르기, 떼창 여부)
 # 신남·성공
 'k_gabojago': ('가보자고!', 0, 1.15, True), 'k_gazua': ('가즈아!', 2, 1.1, True), 'k_iyaya': ('이야아아!', 1, 1.0, True), 'k_oye': ('오 예!', 6, 1.05, False),
 'k_yes': ('예쓰!', 3, 1.1, False), 'k_nice': ('나이스!', 0, 1.1, False), 'k_daebak': ('대박!', 7, 1.05, False), 'k_gaeideuk': ('개이득!', 4, 1.1, False),
 'k_haenaetda': ('해냈다!', 1, 1.1, True), 'k_deugaja': ('드가자!', 2, 1.15, True), 'k_dwaetda': ('됐다, 됐어!', 3, 1.15, False), 'k_jjeonda': ('와, 쩐다!', 5, 1.1, False),
 'k_ige_doene': ('이게 되네?', 8, 1.1, False), 'k_kkalkkeum': ('깔끔하네!', 9, 1.1, False), 'k_joasseo': ('좋았어!', 4, 1.1, False),
 # 놀람
 'k_heol': ('헐!', 6, 1.0, False), 'k_silhwa': ('이거 실화냐?', 0, 1.15, False), 'k_michyeotda': ('미쳤다!', 2, 1.1, False), 'k_eomeona': ('어머나!', 7, 1.05, False),
 'k_mwoya': ('아니, 이게 뭐야?', 3, 1.15, False), 'k_maldoandwae': ('말도 안 돼!', 5, 1.1, False), 'k_mworago': ('뭐라고?', 1, 1.1, False), 'k_jinjja': ('진짜?', 8, 1.05, False),
 'k_heok': ('헉!', 9, 1.0, False), 'k_eolma': ('얼마라고요?', 6, 1.15, False),
 # 황당·실망
 'k_seolma': ('에이, 설마.', 4, 1.05, False), 'k_aigo': ('아이고야.', 0, 0.95, False), 'k_manghaetda': ('망했다.', 2, 1.0, False), 'k_igeonjom': ('와, 이건 좀.', 7, 1.05, False),
 'k_nuntaengi': ('눈탱이 맞았네.', 3, 1.1, False), 'k_andwae': ('안 돼!', 5, 1.05, True), 'k_jamkkan': ('잠깐만요!', 8, 1.15, False),
}
FX = "highpass=f=90,acompressor=threshold=-20dB:ratio=4:attack=4:release=90:makeup=4,lowpass=f=4000,loudnorm=I=-17:TP=-1.5"
for name, (text, sid, sp, crowd) in P.items():
    tmp = f'/tmp/claude-0/tts/o/{name}_a.wav'; say(text, sid, sp, tmp)
    if crowd:  # 떼창: 다른 두 목소리를 살짝 어긋나게 겹친다
        b, c = tmp.replace('_a', '_b'), tmp.replace('_a', '_c'); say(text, (sid + 3) % 10, sp * 1.03, b); say(text, (sid + 6) % 10, sp * 0.98, c)
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', tmp, '-i', b, '-i', c, '-filter_complex',
          f"[1:a]adelay=35|35,volume=0.8[b];[2:a]adelay=70|70,volume=0.7[c];[0:a][b][c]amix=inputs=3:normalize=0,silenceremove=start_periods=1:start_threshold=-45dB,{FX},aecho=0.8:0.5:40:0.2", '-ar', '44100', '-ac', '2', f'{OUT}/{name}.wav'])
    else:
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', tmp, '-af', f"silenceremove=start_periods=1:start_threshold=-45dB,{FX}", '-ar', '44100', '-ac', '2', f'{OUT}/{name}.wav'])
print(len(P), '개')
