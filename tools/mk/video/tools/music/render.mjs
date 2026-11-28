// 미디 → 소리: 스페사신스(깃허브 spessasus/spessasynth_core) + 제너럴유저 지에스 음색 모음(실제 악기 녹음)
import * as fs from "node:fs/promises";
import {audioToWav, BasicMIDI, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer} from "spessasynth_core";
const [sfp, ...mids] = process.argv.slice(2);
const sf = await fs.readFile(sfp);
for (const mp of mids) {
  const mid = await fs.readFile(mp);
  const midi = BasicMIDI.fromArrayBuffer(mid.buffer.slice(mid.byteOffset, mid.byteOffset + mid.byteLength));
  const sr = 44100, synth = new SpessaSynthProcessor(sr, {eventsEnabled: false});
  synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.byteLength)), "main");
  await synth.ready;
  const seq = new SpessaSynthSequencer(synth); seq.loadNewSongList([midi]); seq.play();
  const n = Math.ceil(sr * (midi.duration + 2)), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += 128) { seq.processTick(); synth.process(L, R, i, Math.min(128, n - i)); }
  await fs.writeFile(mp.replace(/\.mid$/, ".wav"), new Uint8Array(audioToWav([L, R], sr)));
  console.log("ok", mp, midi.duration.toFixed(1));
}
