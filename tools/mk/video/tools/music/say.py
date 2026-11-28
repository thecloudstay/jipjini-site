import sherpa_onnx, wave, numpy as np, sys, json
D='/tmp/claude-0/tts/sherpa-onnx-supertonic-tts-int8-2026-03-06/'
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(duration_predictor=D+'duration_predictor.int8.onnx',text_encoder=D+'text_encoder.int8.onnx',vector_estimator=D+'vector_estimator.int8.onnx',vocoder=D+'vocoder.int8.onnx',tts_json=D+'tts.json',unicode_indexer=D+'unicode_indexer.bin',voice_style=D+'voice.bin'),num_threads=2))
tts=sherpa_onnx.OfflineTts(cfg)
print('화자 수', tts.num_speakers, tts.sample_rate)
def say(text, sid, speed, path, steps=8):
    g=sherpa_onnx.GenerationConfig(); g.sid=sid; g.speed=speed; g.num_steps=steps; g.extra={'lang':'ko'}
    a=tts.generate(text, g); x=np.array(a.samples)
    with wave.open(path,'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(a.sample_rate); w.writeframes((np.clip(x,-1,1)*32767).astype(np.int16).tobytes())
    return len(x)/a.sample_rate
if __name__=='__main__':
    for i in range(min(tts.num_speakers,10)): print(i, say('가즈아! 오 예! 대박!', i, 1.1, f'o/test_{i}.wav'))
