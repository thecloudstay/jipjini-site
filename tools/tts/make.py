"""mk/tts/jobs/*.json → mk/tts/out/<이름>/<목소리>/<줄 번호>.mp3 (이미 있으면 건너뜀)
깃허브에서 돈다(.github/workflows/tts.yml). 목소리는 마이크로소프트 신경망 음성(무료) 이름."""
import asyncio, glob, json, os
import edge_tts

async def say(text, voice, rate, out):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)

for jf in sorted(glob.glob('mk/tts/jobs/*.json')):
    job = json.load(open(jf, encoding='utf-8')); name = os.path.basename(jf)[:-5]
    for voice in job['voices']:
        d = f'mk/tts/out/{name}/{voice}'; os.makedirs(d, exist_ok=True)
        for ln in job['lines']:
            out = f"{d}/{ln['id']}.mp3"
            if os.path.exists(out): continue
            try:
                asyncio.run(say(ln['text'], voice, ln.get('rate', job.get('rate', '+0%')), out)); print('만듦', out)
            except Exception as e:
                print('실패', out, e)
