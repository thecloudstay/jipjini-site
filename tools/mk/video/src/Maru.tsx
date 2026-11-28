import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile, continueRender, delayRender, Easing} from 'remotion';
import plan from './plan.json';

const INK = '#141613', GREEN = '#1F5E2E', LIME = '#8FD19E', YEL = '#FFD43B', PAPER = '#FFFFFF';
const css = `
@font-face{font-family:P;font-weight:400;src:url(${staticFile('ibm-plex-sans-kr-korean-400-normal.woff2')})}
@font-face{font-family:P;font-weight:700;src:url(${staticFile('ibm-plex-sans-kr-korean-700-normal.woff2')})}
@font-face{font-family:P;font-weight:400;src:url(${staticFile('ibm-plex-sans-kr-latin-400-normal.woff2')});unicode-range:U+0000-00FF}
@font-face{font-family:P;font-weight:700;src:url(${staticFile('ibm-plex-sans-kr-latin-700-normal.woff2')});unicode-range:U+0000-00FF}
*{font-family:P,sans-serif;word-break:keep-all}`;

const useFonts = () => {
  const [h] = useState(() => delayRender('fonts'));
  useEffect(() => { (document as any).fonts.ready.then(() => continueRender(h)); }, [h]);
};

const Pop: React.FC<{at: number; children: React.ReactNode; size?: number; color?: string; wobble?: boolean}> = ({at, children, size = 150, color = '#fff', wobble}) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const s = spring({frame: f - at, fps, config: {damping: 9, stiffness: 220, mass: 0.6}});
  const rot = wobble ? Math.sin((f - at) / 2.2) * 6 * Math.max(0, 1 - (f - at) / 40) : 0;
  return <div style={{fontSize: size, fontWeight: 700, color, lineHeight: 1.08, letterSpacing: -4, opacity: f < at ? 0 : 1,
    transform: `translateY(${(1 - s) * 60}px) scale(${0.55 + 0.45 * s}) rotate(${rot}deg)`, transformOrigin: 'left center'}}>{children}</div>;
};

const PlanBg: React.FC<{dark?: boolean}> = ({dark}) => {
  const f = useCurrentFrame();
  const [x, y, w, h] = plan.vb.split(' ').map(Number);
  const p = interpolate(f, [0, 50], [1, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return <svg viewBox={plan.vb} style={{position: 'absolute', right: -120, top: 260, height: 1500, opacity: 0.22, transform: `rotate(-6deg) scale(${1 + f / 900})`}}>
    {plan.s.map(([k, v]: any, i: number) => k === 'poly'
      ? <polyline key={i} points={v} pathLength={1} fill="none" stroke={dark ? '#fff' : INK} strokeWidth={3} strokeDasharray={1} strokeDashoffset={p} />
      : <path key={i} d={v} pathLength={1} fill="none" stroke={dark ? '#fff' : INK} strokeWidth={3} strokeDasharray={1} strokeDashoffset={p} />)}
  </svg>;
};

const Punch: React.FC<{children: React.ReactNode; bg: string}> = ({children, bg}) => {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, 6], [1.08, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  return <AbsoluteFill style={{background: bg, transform: `scale(${sc})`}}>{children}</AbsoluteFill>;
};

const Brand: React.FC<{dark?: boolean}> = ({dark}) => (
  <div style={{position: 'absolute', top: 120, left: 90, display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 700, color: dark ? '#fff' : INK}}>
    <span style={{width: 60, height: 60, background: dark ? YEL : GREEN, color: dark ? INK : '#fff', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 36}}>집</span>집지니</div>
);
const Foot: React.FC<{dark?: boolean; t: string}> = ({dark, t}) => (
  <div style={{position: 'absolute', bottom: 150, left: 90, right: 90, fontSize: 32, color: dark ? '#A9AEA5' : '#6B7067'}}>{t}</div>
);

const Counter: React.FC<{from: number; to: number; at: number; dur: number; size: number; color: string; suffix: string}> = ({from, to, at, dur, size, color, suffix}) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + dur], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const done = f >= at + dur; const k = done ? interpolate(f, [at + dur, at + dur + 8], [1.18, 1], {extrapolateRight: 'clamp'}) : 1;
  return <div style={{fontSize: size, fontWeight: 700, color, letterSpacing: -8, fontVariantNumeric: 'tabular-nums', transform: `scale(${k})`, transformOrigin: 'left center'}}>
    {Math.round(v).toLocaleString('ko-KR')}<span style={{fontSize: size * 0.4, letterSpacing: -2}}>{suffix}</span></div>;
};

const Bar: React.FC<{label: string; val: number; max: number; at: number; color: string; text: string}> = ({label, val, max, at, color, text}) => {
  const f = useCurrentFrame();
  const w = interpolate(f, [at, at + 30], [0, val / max], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const n = interpolate(f, [at, at + 30], [0, val], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return <div style={{marginBottom: 80}}>
    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 52, color: INK, marginBottom: 22}}><span>{label}</span><b style={{fontSize: 72, color}}>{Math.round(n).toLocaleString('ko-KR')}{text}</b></div>
    <div style={{height: 70, background: '#E6E8E3', borderRadius: 6}}><div style={{height: 70, width: `${w * 100}%`, background: color, borderRadius: 6}} /></div>
  </div>;
};

const Type: React.FC<{t: string; at: number}> = ({t, at}) => {
  const f = useCurrentFrame(); const n = Math.max(0, Math.floor((f - at) / 2));
  return <span>{t.slice(0, n)}<span style={{opacity: f % 16 < 8 ? 1 : 0}}>|</span></span>;
};

export const Maru: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const shake = f >= 135 && f < 160 ? Math.sin(f * 3.1) * (160 - f) * 1.4 : 0;
  return <AbsoluteFill style={{background: INK}}>
    <style>{css}</style>
    <Audio src={staticFile('sfx/beat.wav')} volume={0.35} />
    {/* 1 갈고리 */}
    <Sequence durationInFrames={60}><Punch bg={INK}><PlanBg dark /><Brand dark />
      <div style={{position: 'absolute', left: 90, top: 620}}><Pop at={4}>인테리어비</Pop><Pop at={22}>아껴서</Pop></div></Punch>
      <Sequence from={4}><Audio src={staticFile('sfx/pop.wav')} /></Sequence><Sequence from={22}><Audio src={staticFile('sfx/pop.wav')} /></Sequence></Sequence>
    {/* 2 숫자 */}
    <Sequence from={60} durationInFrames={75}><Punch bg={PAPER}><Brand />
      <div style={{position: 'absolute', left: 90, top: 640}}>
        <div style={{fontSize: 60, color: '#6B7067', marginBottom: 20}}>84㎡ 같은 집, 차이</div>
        <Counter from={0} to={1189} at={4} dur={44} size={250} color={GREEN} suffix="만 원" /></div>
      <Foot t="집지니 실견적 가운데값 · 부가세 10% 별도" /></Punch>
      <Sequence from={4}><Audio src={staticFile('sfx/coins.wav')} /></Sequence><Sequence from={48}><Audio src={staticFile('sfx/ding.wav')} /></Sequence></Sequence>
    {/* 3 반전 */}
    <Sequence from={135} durationInFrames={60}><Punch bg={YEL}><Brand />
      <div style={{position: 'absolute', left: 90, top: 620, transform: `translateX(${shake}px)`}}>
        <div style={{fontSize: 190, fontWeight: 700, color: INK, letterSpacing: -6, lineHeight: 1.05, transform: `scale(${interpolate(f - 135, [0, 8], [2.6, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6))})})`, transformOrigin: 'left center'}}>마티즈<br />샀다</div>
        <div style={{marginTop: 30}}><Pop at={22} size={170} color={GREEN} wobble>긔긔</Pop></div></div></Punch>
      <Audio src={staticFile('sfx/slam.wav')} /><Sequence from={22}><Audio src={staticFile('sfx/pop.wav')} /></Sequence></Sequence>
    {/* 4 비교 */}
    <Sequence from={195} durationInFrames={105}><Punch bg={PAPER}><Brand />
      <div style={{position: 'absolute', left: 90, right: 90, top: 560}}>
        <div style={{fontSize: 84, fontWeight: 700, color: INK, marginBottom: 90, letterSpacing: -2}}>같은 84㎡ 올수리</div>
        <Bar label="턴키 추정" val={3964} max={3964} at={10} color={INK} text="만" />
        <Bar label="집지니" val={2775} max={3964} at={34} color={GREEN} text="만" /></div>
      <Foot t="수도권 2,026개 단지 84㎡ 가운데값 · 부가세 10% 별도" /></Punch>
      <Audio src={staticFile('sfx/whoosh.wav')} /><Sequence from={10}><Audio src={staticFile('sfx/rise.wav')} volume={0.6} /></Sequence><Sequence from={64}><Audio src={staticFile('sfx/ding.wav')} /></Sequence></Sequence>
    {/* 5 행동 */}
    <Sequence from={300} durationInFrames={75}><Punch bg={GREEN}><Brand dark />
      <div style={{position: 'absolute', left: 90, top: 640}}><Pop at={2} size={170}>우리 집은</Pop><Pop at={14} size={170} color={YEL}>얼마?</Pop>
        <div style={{marginTop: 80, fontSize: 64, fontWeight: 700, color: '#fff', borderBottom: `8px solid ${YEL}`, display: 'inline-block', paddingBottom: 10}}><Type t="jipjini.com/apt" at={26} /></div></div>
      <Foot dark t="아파트 이름만 넣으면 30초" /></Punch>
      <Audio src={staticFile('sfx/whoosh.wav')} /><Sequence from={14}><Audio src={staticFile('sfx/pop.wav')} /></Sequence></Sequence>
    {/* 진행 막대 */}
    <div style={{position: 'absolute', top: 0, left: 0, height: 12, width: `${(f / 375) * 100}%`, background: YEL}} />
  </AbsoluteFill>;
};
