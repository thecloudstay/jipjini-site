// 웹툰 이야기형 영상 틀(2026-11-28 대표 「동영상 다 다시 만들자, 웹툰 스타일로. 모든 콘텐츠는 스토리보드를 구성하여 스토리텔링식으로」)
// 스토리보드 틀: mk/research/2026-11-28-스토리보드-짜는-법.md (갈고리 → 갈등 → 전환 → 증거 → 끝 문장), 소리 규칙: fx.ts
// 한 화 = 컷 목록(나레이션 한 줄 + 그림 한 컷). 나레이션 길이에 컷 길이를 맞춘다. 전환 컷부터 배경음이 밝은 곡으로 바뀐다.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, staticFile} from 'remotion';
import {INK, useFonts, css} from './Maru';
import {BPM} from './fx';
import {YEL, LIME, LINE, C, snd, P, PP, Bubble, Proof, Shot, PW, PH, WIFE, HUS} from './ToonKit';

export type Cut = {gap?: number; say?: string; sfx?: [string, number, number?][]; tag?: string; accent?: boolean; render: (lf: number, f: number) => React.ReactNode};
export type Ep = {id: string; series: string; tag: string; pre: string; narr: Record<string, {dur: number; text: string}>; cuts: Cut[]; turn: number};
const END = 72;
const plan = (ep: Ep) => { let t = 0; const from: number[] = []; ep.cuts.forEach((c, k) => { from.push(t); t += ep.narr[String(k + 1)].dur + (c.gap ?? 4); }); return {from, endAt: t}; };
export const epLen = (ep: Ep) => plan(ep).endAt + END;

// 증거 컷: 위는 집지니 실제 화면, 아래 띠는 부부 반응(화면 글자를 가리지 않게 자리를 나눔 — 검수 3번)
export const ProofCut: React.FC<{a: Shot; lf: number; wife: string; hus: string; say?: string; sayAt?: number; band?: string; zoom?: number}> = ({a, lf, wife, hus, say, sayAt = 18, band = '#FFF1D6', zoom = 1}) => <>
  <div style={{position: 'absolute', left: 0, top: 0, width: PW, height: 610, overflow: 'hidden', background: '#fff'}}><div style={{position: 'absolute', left: 0, top: 0, width: PW, transformOrigin: '50% 0', transform: `scale(${zoom})`}}><Proof a={a} lf={lf} /></div></div>
  <div style={{position: 'absolute', left: 0, top: 610, width: PW, height: PH - 610, background: band, borderTop: `8px solid ${LINE}`}} />
  <P who={WIFE} body="Sweater" face={wife} x={40} y={628} w={235} /><P who={HUS} body="Hoodie" face={hus} x={745} y={628} w={235} flip />
  {say && <Bubble text={say} x={300} y={670} f={lf} at={sayAt} size={46} shout />}
</>;
export const Duo: React.FC<{wife: string; hus: string; lf: number; bob?: number}> = ({wife, hus, lf, bob = 3}) => <>
  <P who={WIFE} body="Sweater" face={wife} x={50} y={330} w={520} bob={bob} f={lf} /><P who={HUS} body="Hoodie" face={hus} x={470} y={340} w={520} flip bob={bob} f={lf + 5} /></>;
export type {PP};

export const Toon: React.FC<{ep: Ep}> = ({ep}) => {
  useFonts();
  const f = useCurrentFrame();
  const {from, endAt} = plan(ep), total = endAt + END;
  let k = 0; from.forEach((s, i) => { if (f >= s) k = i; });
  const ended = f >= endAt, cut = ep.cuts[k], lf = f - from[k], N = ep.narr;
  const TURN = from[ep.turn - 1], beat = 1800 / BPM.up, lead = Math.round(beat * 0.25);
  const tenseV = (x: number) => 0.2 * interpolate(x, [0, 10, TURN - 12, TURN], [0, 1, 1, 0], C);
  const upV = (x: number) => 0.17 * interpolate(x, [TURN, TURN + 2, endAt, endAt + 20, total - 20, total], [0, 1.2, 1, 1.4, 1.4, 0], C);
  const sounds: JSX.Element[] = [];
  ep.cuts.forEach((c, i) => {
    const s = from[i], d = N[String(i + 1)].dur;
    sounds.push(<Sequence key={'n' + i} from={s}><Audio src={staticFile(`sfx/${ep.pre}${String(i + 1).padStart(2, '0')}.wav`)} volume={1} /></Sequence>);
    if (i > 0) sounds.push(snd('tok', s, 0.3));
    if (c.say) sounds.push(snd(c.say, s + d - 4, 0.85));
    (c.sfx ?? []).forEach(([n, a, v]) => sounds.push(snd(n, s + a, v ?? 0.5)));
  });
  sounds.push(snd('thud', TURN, 0.6), snd('whoosh', endAt - 2, 0.35), snd('thud', endAt + 8, 0.5));
  return <AbsoluteFill style={{background: '#FFF9EE', fontFamily: 'P', overflow: 'hidden'}}>
    <style>{css}</style>
    {!ended && <>
      <div style={{position: 'absolute', left: 40, top: 140, fontSize: 44, fontWeight: 700, color: LINE}}>{ep.series}</div>
      <div style={{position: 'absolute', left: 42, top: 204, fontSize: 28, color: '#6f675a'}}>{cut.tag ?? ep.tag}</div>
      {cut.render(lf, f)}
      <div style={{position: 'absolute', left: 50, right: 150, top: 1200, minHeight: 210, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: 62, fontWeight: 700, color: cut.accent ? '#C2410C' : LINE, lineHeight: 1.32, textAlign: 'center', whiteSpace: 'pre-line', letterSpacing: -1}}>{N[String(k + 1)].text}</div></div>
    </>}
    {ended && <AbsoluteFill style={{background: INK}}>
      <div style={{position: 'absolute', left: 90, top: 700, display: 'flex', alignItems: 'center', gap: 34}}>
        <span style={{width: 190, height: 190, background: YEL, color: INK, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, fontWeight: 700}}>집</span>
        <div><div style={{fontSize: 170, fontWeight: 700, color: '#fff', letterSpacing: -5, lineHeight: 1}}>집지니</div><div style={{marginTop: 18, fontSize: 66, fontWeight: 700, color: LIME}}>jipjini.com</div></div></div>
    </AbsoluteFill>}
    <Audio src={staticFile('sfx/mood_tense.wav')} startFrom={90} volume={tenseV} loop />
    <Sequence from={Math.max(0, TURN - lead)}><Audio src={staticFile('sfx/mood_up.wav')} startFrom={Math.round(beat * 4)} volume={(x) => upV(x + Math.max(0, TURN - lead))} loop /></Sequence>
    {sounds}
  </AbsoluteFill>;
};
