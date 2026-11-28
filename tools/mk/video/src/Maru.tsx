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


// 2026-11-28 대표 「이펙트가 더 과하게 — 강조 메시지마다」: 강조 순간마다 번쩍 + 흔들림 + 튀는 확대 + 색 갈라짐 + 빛줄기 터짐
const Hit: React.FC<{at: number; children: React.ReactNode; color?: string; rays?: string; pre?: boolean}> = ({at, children, color = '#fff', rays = YEL, pre = true}) => {
  const f = useCurrentFrame(); const d = f - at;
  if (d < 0) return <div style={{opacity: pre ? 1 : 0, color}}>{children}</div>;
  const k = interpolate(d, [0, 4, 10], [1.45, 0.94, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  const sh = d < 14 ? Math.sin(d * 4.7) * (14 - d) * 2.6 : 0;
  const sp = interpolate(d, [0, 10], [14, 0], {extrapolateRight: 'clamp'});
  return <div style={{position: 'relative', transform: `translate(${sh}px, ${-sh * 0.5}px) scale(${k})`, transformOrigin: 'left center',
    textShadow: sp > 0.5 ? `${sp}px 0 rgba(255,40,90,.85), ${-sp}px 0 rgba(0,220,255,.85)` : 'none', color}}>
    <Rays d={d} color={rays} />{children}</div>;
};
const Rays: React.FC<{d: number; color: string}> = ({d, color}) => {
  if (d > 14) return null;
  const r = interpolate(d, [0, 14], [40, 520]); const o = interpolate(d, [0, 14], [1, 0]);
  return <svg style={{position: 'absolute', left: 120, top: '50%', width: 0, height: 0, overflow: 'visible', zIndex: -1}}>
    {Array.from({length: 14}).map((_, i) => { const a = (i / 14) * Math.PI * 2; return <line key={i} x1={Math.cos(a) * r * 0.45} y1={Math.sin(a) * r * 0.45} x2={Math.cos(a) * r} y2={Math.sin(a) * r} stroke={color} strokeWidth={18} strokeLinecap="round" opacity={o} />; })}
  </svg>;
};
const Flash: React.FC<{at: number[]}> = ({at}) => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...at.map(a => (f >= a && f < a + 5 ? 1 - (f - a) / 5 : 0)));
  return o > 0 ? <AbsoluteFill style={{background: '#fff', opacity: o * 0.85, pointerEvents: 'none'}} /> : null;
};
const Coins: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame(); const d = f - at; if (d < 0 || d > 40) return null;
  return <AbsoluteFill style={{pointerEvents: 'none'}}>{Array.from({length: 26}).map((_, i) => {
    const a = (i * 137.5) % 360 * Math.PI / 180, v = 18 + (i % 7) * 4;
    const x = 540 + Math.cos(a) * v * d, y = 960 + Math.sin(a) * v * d + 0.9 * d * d;
    return <div key={i} style={{position: 'absolute', left: x, top: y, width: 46, height: 46, borderRadius: 23, background: i % 3 ? YEL : '#fff', border: `5px solid ${GREEN}`,
      opacity: interpolate(d, [26, 40], [1, 0], {extrapolateLeft: 'clamp'}), transform: `rotate(${d * 20 + i * 30}deg) scaleX(${Math.cos(d / 3 + i)})`}} />; })}</AbsoluteFill>;
};


// 2026-11-28 대표 「내용 구성·색상 다 따로 놀아 — 하나의 일련의 시나리오, 스토리로」
// 한 화면·한 배경(먹색 + 평면도 선)·한 색 규칙(흰 글, 종이 견적서, 초록 = 아낀 돈, 노랑 = 도장 한 번)으로 끝까지 이어 간다.
// 이야기: 견적서 받음(3,964만) → 헐 미친 → 단지 이름 넣어 봄 → 줄 긋고 2,775만 → 1,189만 남음 → 그 돈 동전이 차로 → 마티즈 샀다 긔긔 → 우리 집은 얼마?
const T = {recv: 0, shock: 50, try_: 95, strike: 120, newv: 135, save: 190, car: 255, maru: 300, cta: 360, end: 450};

const Cap: React.FC<{lines: [number, number, React.ReactNode][]}> = ({lines}) => {
  const f = useCurrentFrame();
  const cur = lines.filter(([a, b]) => f >= a && f < b);
  return <div style={{position: 'absolute', left: 90, right: 90, top: 300, height: 360}}>{cur.map(([a, , node], i) => {
    const d = f - a; const s = interpolate(d, [0, 8], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2))});
    return <div key={a} style={{fontSize: 112, fontWeight: 700, color: '#fff', letterSpacing: -3, lineHeight: 1.12, opacity: s, transform: `translateY(${(1 - s) * 40}px)`}}>{node}</div>; })}</div>;
};

const Receipt: React.FC = () => {
  const f = useCurrentFrame();
  const up = interpolate(f, [T.recv + 4, T.recv + 20], [900, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const shrink = interpolate(f, [T.save, T.save + 16], [1, 0.62], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const lift = interpolate(f, [T.save, T.save + 16], [0, -330], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const gone = interpolate(f, [T.car - 10, T.car + 6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const old = interpolate(f, [T.recv + 18, T.recv + 44], [0, 3964], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const strike = interpolate(f, [T.strike, T.strike + 10], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const nv = interpolate(f, [T.newv, T.newv + 30], [3964, 2775], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const stampK = interpolate(f - T.shock, [0, 6, 12], [2.4, 0.92, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  return <div style={{position: 'absolute', left: 110, right: 110, top: 760, opacity: gone, transform: `translateY(${up + lift}px) scale(${shrink}) rotate(-2deg)`}}>
    <div style={{background: '#fff', borderRadius: 6, padding: '50px 56px 56px', boxShadow: '0 30px 80px rgba(0,0,0,.45)'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 34, color: '#6B7067', borderBottom: '3px dashed #C9CCC5', paddingBottom: 22}}><span>견적서 · 84㎡ 올수리</span><span>턴키</span></div>
      <div style={{position: 'relative', fontSize: 150, fontWeight: 700, color: INK, letterSpacing: -6, marginTop: 30, fontVariantNumeric: 'tabular-nums', opacity: f >= T.newv ? 0.35 : 1}}>
        {Math.round(old).toLocaleString('ko-KR')}<span style={{fontSize: 60}}>만 원</span>
        <div style={{position: 'absolute', left: 0, top: '52%', height: 14, width: `${strike}%`, background: '#E0352B', borderRadius: 7}} /></div>
      {f >= T.newv && <div style={{fontSize: 40, color: '#6B7067', marginTop: 10}}>집지니로 바꾸면</div>}
      {f >= T.newv && <div style={{fontSize: 170, fontWeight: 700, letterSpacing: -6, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}><Hit at={T.newv + 30} color={GREEN} rays={GREEN}>{Math.round(nv).toLocaleString('ko-KR')}<span style={{fontSize: 64}}>만 원</span></Hit></div>}
    </div>
    {f >= T.shock && <div style={{position: 'absolute', right: -30, top: -70, transform: `rotate(12deg) scale(${stampK})`, border: `10px solid ${YEL}`, color: YEL, fontSize: 92, fontWeight: 700, padding: '6px 28px', borderRadius: 10, background: 'rgba(20,22,19,.85)'}}>헐 미친</div>}
  </div>;
};

const Saved: React.FC = () => {
  const f = useCurrentFrame(); if (f < T.save + 10 || f > T.car + 10) return null;
  const v = interpolate(f, [T.save + 10, T.save + 40], [0, 1189], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const o = interpolate(f, [T.car, T.car + 10], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <div style={{position: 'absolute', left: 90, top: 1060, opacity: o}}>
    <div style={{fontSize: 56, color: '#C9CCC5', marginBottom: 6}}>남은 돈</div>
    <div style={{fontSize: 240, fontWeight: 700, letterSpacing: -9, fontVariantNumeric: 'tabular-nums'}}><Hit at={T.save + 40} color={LIME}>{Math.round(v).toLocaleString('ko-KR')}<span style={{fontSize: 90}}>만 원</span></Hit></div></div>;
};

const Car: React.FC = () => {
  const f = useCurrentFrame(); if (f < T.car) return null;
  const draw = interpolate(f, [T.car, T.car + 30], [1, 0], {extrapolateRight: 'clamp'});
  const drive = interpolate(f, [T.cta + 10, T.cta + 40], [0, -1500], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic)});
  const bob = Math.sin(f / 3) * 4;
  const P = (d: string, w = 10) => <path d={d} pathLength={1} fill="none" stroke={LIME} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={draw} />;
  return <svg viewBox="0 0 600 300" style={{position: 'absolute', left: 140, top: 1080, width: 800, transform: `translate(${drive}px, ${bob}px)`}}>
    {P('M40 220 L60 150 Q80 90 150 85 L330 85 Q380 85 420 140 L520 160 Q560 170 560 215 L560 230 L40 230 Z')}
    {P('M170 95 L170 150 M300 95 L300 150 M120 150 L410 150')}
    <circle cx="150" cy="235" r="40" fill="#141613" stroke={LIME} strokeWidth="10" /><circle cx="450" cy="235" r="40" fill="#141613" stroke={LIME} strokeWidth="10" />
    {f > T.cta + 10 && [0, 1, 2].map(i => <line key={i} x1={600 + i * 10} y1={150 + i * 30} x2={700 + i * 40} y2={150 + i * 30} stroke="#fff" strokeWidth={8} strokeLinecap="round" opacity={0.6} />)}
  </svg>;
};

const Fly: React.FC = () => {
  const f = useCurrentFrame(); const d = f - T.car + 8; if (d < 0 || d > 34) return null;
  return <AbsoluteFill>{Array.from({length: 18}).map((_, i) => {
    const t = Math.min(1, Math.max(0, (d - i * 0.8) / 18)); const sx = 300 + (i % 6) * 90, sy = 1150, ex = 540, ey = 1330;
    const x = sx + (ex - sx) * t, y = sy + (ey - sy) * t - Math.sin(t * Math.PI) * 300;
    return <div key={i} style={{position: 'absolute', left: x, top: y, width: 50, height: 50, borderRadius: 25, background: YEL, border: `5px solid ${GREEN}`, opacity: t >= 1 ? 0 : 1}} />; })}</AbsoluteFill>;
};

export const Maru: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const hits = [T.shock, T.newv + 30, T.save + 40, T.maru, T.maru + 22, T.cta + 14];
  const cam = hits.reduce((acc, a) => acc + (f >= a && f < a + 10 ? Math.sin((f - a) * 5) * (10 - (f - a)) * 2.4 : 0), 0);
  const maruK = interpolate(f - T.maru, [0, 7], [2.6, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.8))});
  const A = (at: number, src: string, v = 1) => <Sequence from={at}><Audio src={staticFile('sfx/' + src + '.wav')} volume={v} /></Sequence>;
  return <AbsoluteFill style={{background: INK, transform: `translate(${cam}px, ${cam * 0.6}px)`}}>
    <style>{css}</style>
    <PlanBg dark />
    <Brand dark />
    <Cap lines={[
      [T.recv, T.shock, <>견적서 받았는데</>],
      [T.shock, T.try_, <>3,964만 원<span style={{color: YEL}}>?</span></>],
      [T.try_, T.save, <>단지 이름만<br />넣어 봤더니</>],
      [T.save, T.car, <>같은 집인데<br /><span style={{color: LIME}}>이만큼 남음</span></>],
      [T.car, T.maru, <>그 돈으로</>],
    ]} />
    <Receipt /><Saved /><Fly /><Car />
    {f >= T.maru && f < T.cta + 30 && <div style={{position: 'absolute', left: 90, top: 300, opacity: interpolate(f, [T.cta + 10, T.cta + 30], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
      <div style={{fontSize: 180, fontWeight: 700, color: '#fff', letterSpacing: -6, lineHeight: 1.05, transform: `scale(${maruK})`, transformOrigin: 'left center'}}>마티즈 샀다</div>
      <div style={{fontSize: 190, fontWeight: 700, letterSpacing: -4, marginTop: 20}}><Hit at={T.maru + 22} color={YEL} rays={LIME} pre={false}>긔긔</Hit></div></div>}
    {f >= T.cta + 14 && <div style={{position: 'absolute', left: 90, top: 640}}>
      <Pop at={T.cta + 14} size={170}>우리 집은</Pop>
      <div style={{fontSize: 190, fontWeight: 700, letterSpacing: -4, lineHeight: 1.08}}><Hit at={T.cta + 26} color={LIME} pre={false}>얼마?</Hit></div>
      <div style={{marginTop: 70, fontSize: 64, fontWeight: 700, color: '#fff', borderBottom: `8px solid ${LIME}`, display: 'inline-block', paddingBottom: 10}}><Type t="jipjini.com/apt" at={T.cta + 40} /></div></div>}
    <Foot dark t="84㎡ 수도권 2,026개 단지 가운데값 · 턴키는 추정 · 부가세 10% 별도" />
    <Flash at={hits} />
    <div style={{position: 'absolute', top: 0, left: 0, height: 12, width: `${(f / T.end) * 100}%`, background: LIME}} />
    <Audio src={staticFile('sfx/beat.wav')} volume={0.3} />
    <Sequence from={T.end - 390}><Audio src={staticFile('sfx/beat.wav')} volume={0.3} /></Sequence>
    {A(T.recv + 4, 'whoosh')}{A(T.recv + 18, 'coins', 0.5)}{A(T.shock, 'slam')}{A(T.shock, 'glitch', 0.7)}{A(T.try_, 'pop')}
    {A(T.strike, 'whoosh', 0.8)}{A(T.newv, 'rise', 0.5)}{A(T.newv + 30, 'ding')}{A(T.newv + 30, 'slam', 0.6)}
    {A(T.save + 10, 'coins')}{A(T.save + 40, 'slam', 0.7)}{A(T.car - 8, 'coins')}{A(T.car, 'rise', 0.6)}
    {A(T.maru, 'slam')}{A(T.maru + 22, 'glitch')}{A(T.maru + 22, 'pop')}{A(T.cta + 10, 'whoosh')}{A(T.cta + 26, 'slam')}{A(T.cta + 40, 'pop', 0.6)}
  </AbsoluteFill>;
};
