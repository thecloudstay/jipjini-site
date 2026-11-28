// 웹툰 영상 공용 부품(인물·말풍선·컷 틀·증거 화면·반응 얼굴). ToonStory.tsx 에서 뽑아 옴.
// 인물 규칙(검수 13번): 한 영상 안에서 머리·안경·옷을 바꾸지 않는다. 아내 = Sweater, 남편 = Hoodie.
// 「Awe」「Fear」 표정은 눈이 안경처럼 보여 아내에게 쓰지 않는다.
import React from 'react';
import {Img, Sequence, Audio, interpolate, staticFile, Easing} from 'remotion';
import Peep from 'react-peeps';
import {Mark, MarkKind} from './Marks';
import {hitShake} from './fx';

export const YEL = '#FFD43B', LIME = '#8FD19E', LINE = '#1c1c1c', SKIN = '#FBE9D7';
export const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const snd = (n: string, at: number, v = 0.7) => <Sequence key={n + at} from={Math.max(0, Math.round(at))}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v * 0.7} /></Sequence>;
// 등장인물
export const WIFE = {hair: 'MediumBangsFilled', accessory: 'None', facialHair: 'None'};
export const HUS = {hair: 'ShortVolumed', accessory: 'GlassRound', facialHair: 'None'};
export const SELLER = {hair: 'Pomp', accessory: 'SunglassWayfarer', facialHair: 'MoustacheThin'};
export const CODI = {hair: 'Bun', accessory: 'None', facialHair: 'None'};
export const PRO = {hair: 'ShavedSides', accessory: 'None', facialHair: 'FullMedium'};
export type PP = {who: any; body: string; face: string; x: number; y: number; w: number; flip?: boolean; pose?: 'bust' | 'full'; bob?: number; f?: number};
export const P: React.FC<PP> = ({who, body, face, x, y, w, flip, pose = 'bust', bob = 0, f = 0}) =>
  <div style={{position: 'absolute', left: x, top: y + (bob ? Math.sin(f / 3.2) * bob : 0), width: w, transform: flip ? 'scale(-1,1)' : undefined}}>
    <Peep style={{width: w, height: pose === 'bust' ? w * 1.15 : w * 1.5, overflow: 'visible'}} accessory={who.accessory} facialHair={who.facialHair} body={body as any} face={face as any} hair={who.hair} strokeColor={LINE} backgroundColor={SKIN}
      viewBox={pose === 'bust' ? {x: '0', y: '0', width: '850', height: '1200'} : undefined as any} />
  </div>;
export const Bubble: React.FC<{text: string; x: number; y: number; f: number; at?: number; tail?: 'l' | 'r'; size?: number; shout?: boolean}> = ({text, x, y, f, at: a = 6, tail = 'l', size = 52, shout}) => {
  if (f < a) return null;
  const k = interpolate(f - a, [0, 4], [0.7, 1], {...C, easing: Easing.out(Easing.back(2))});
  return <div style={{position: 'absolute', left: x, top: y, transform: `scale(${k}) rotate(${shout ? -3 : 0}deg)`, transformOrigin: tail === 'l' ? '20% 100%' : '80% 100%'}}>
    <div style={{background: shout ? YEL : '#fff', border: `6px solid ${LINE}`, borderRadius: 44, padding: '14px 34px', fontSize: size, fontWeight: 700, color: LINE, whiteSpace: 'pre-line', lineHeight: 1.25, textAlign: 'center'}}>{text}</div>
    <svg width={60} height={40} style={{position: 'absolute', bottom: -32, left: tail === 'l' ? 60 : undefined, right: tail === 'r' ? 60 : undefined}}><path d={tail === 'l' ? 'M4 0 L10 36 L48 0' : 'M56 0 L50 36 L12 0'} fill={shout ? YEL : '#fff'} stroke={LINE} strokeWidth={6} strokeLinejoin="round" /><path d="M2 0 L58 0" stroke={shout ? YEL : '#fff'} strokeWidth={8} /></svg>
  </div>;
};
export const PW = 1020, PH = 900, PX = 30, PY = 250;
export const Panel: React.FC<{bg: string; f: number; lf: number; quake?: number; children: React.ReactNode}> = ({bg, f, lf, quake = -1, children}) =>
  <div style={{position: 'absolute', left: PX, top: PY, width: PW, height: PH, background: bg, border: `8px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box',
    transform: `scale(${interpolate(lf, [0, 3], [0.96, 1], C)})${quake >= 0 ? hitShake(lf - quake) : ''}`}}>
    <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 60%', transform: `scale(${1 + Math.min(lf, 200) * 0.00035})`}}>{children}</div>
  </div>;
export const Burst: React.FC<{c1: string; c2: string}> = ({c1, c2}) =>
  <svg width={PW} height={PH} style={{position: 'absolute', left: 0, top: 0}}><rect width={PW} height={PH} fill={c1} />{Array.from({length: 14}, (_, k) => { const a = k / 14 * Math.PI * 2, b = (k + 0.5) / 14 * Math.PI * 2; return <path key={k} d={`M510 480 L${510 + Math.cos(a) * 1200} ${480 + Math.sin(a) * 1200} L${510 + Math.cos(b) * 1200} ${480 + Math.sin(b) * 1200} Z`} fill={c2} />; })}</svg>;
export const Sheet: React.FC<{x: number; y: number; rot?: number; s?: number; hl?: boolean; total?: boolean}> = ({x, y, rot = -5, s = 1, hl, total}) =>
  <div style={{position: 'absolute', left: x, top: y, width: 420, transform: `rotate(${rot}deg) scale(${s})`, transformOrigin: '0 0', background: '#FBFAF6', border: `5px solid ${LINE}`, padding: '18px 22px', color: LINE, boxShadow: '10px 12px 0 rgba(0,0,0,.18)'}}>
    <div style={{fontSize: 34, fontWeight: 700, textAlign: 'center', letterSpacing: 6, borderBottom: `3px solid ${LINE}`, paddingBottom: 8}}>견 적 서</div>
    {[['철거·설비', '620만'], ['주방 일식', '1,200만'], ['욕실 일식', '1,600만'], ['기타 일식', '900만']].map(([a, b]) => <div key={a} style={{display: 'flex', justifyContent: 'space-between', fontSize: 28, padding: '9px 2px', borderBottom: '1px solid #cfcabd'}}>
      <span>{a.replace('일식', '')}{a.includes('일식') && <b style={{background: hl ? YEL : 'transparent', padding: '0 4px'}}>일식</b>}</span><span>{b}</span></div>)}
    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 36, fontWeight: 700, paddingTop: 12, color: total ? '#D9342B' : LINE}}><span>합계</span><span>6,800만 원</span></div>
    <div style={{fontSize: 18, color: '#888', textAlign: 'right'}}>이야기용 예시</div>
  </div>;
export type Shot = {img: string; s: number; mark?: number[]; kind?: MarkKind};
export const Proof: React.FC<{a: Shot; lf: number}> = ({a, lf}) => {
  const k = PW / 1080, y = a.mark ? (a.mark[1] + a.mark[3] / 2) * a.s : 760;
  return <div style={{position: 'absolute', left: 0, top: Math.min(0, 330 - y * k), width: PW}}>
    <div style={{width: 1080, transformOrigin: '0 0', transform: `scale(${k})`, position: 'relative'}}><Img src={staticFile(a.img)} style={{width: 1080, display: 'block'}} />
      {a.mark && <Mark kind={a.kind ?? 'circle'} x={a.mark[0] * a.s} y={a.mark[1] * a.s} w={a.mark[2] * a.s} h={a.mark[3] * a.s} t={lf - 12} seed={a.mark[1]} />}</div>
  </div>;
};
export const Sticker: React.FC<PP & {bg?: string}> = ({bg = '#fff', ...p}) =>
  <div style={{position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.w, borderRadius: '50%', background: bg, border: `7px solid ${LINE}`, overflow: 'hidden', boxShadow: '8px 10px 0 rgba(0,0,0,.2)'}}><P {...p} x={-p.w * 0.12} y={p.w * 0.05} w={p.w * 1.25} /></div>;
