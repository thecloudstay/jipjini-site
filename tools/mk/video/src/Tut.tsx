// 집지니 사이트 사용법 영상 틀 (2026-11-28 대표 「사이트 들어가서 사용법도 올리자 — 튜토리얼」)
// 조사 반영: 결과 먼저(갈고리) → 번호 단계 자막 → 누를 곳 확대·손가락 표시 → 결과에서 멈춤 → 큰 로고 + jipjini.com
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, staticFile, Easing} from 'remotion';
import {INK, useFonts} from './Maru';

const GREEN = '#1F5E2E', LIME = '#8FD19E', YEL = '#FFD43B';
const S = 2.5;            // 화면 사진 배율(432×768 → 1080×1920)
const HOOK = 75, END = 105, ZIN = 14;

type Fr = {img: string; kind: 'tap' | 'type' | 'shot'; cap: string | null; step: number | null; focus: number[] | null; tapAt: number[] | null; hold: number; result: boolean};
export type TutData = {id: string; title: string; hook: string; end: string; frames: Fr[]};

const len = (f: Fr) => f.kind === 'type' ? 8 : Math.round(f.hold * 30);
export const tutLength = (d: TutData) => HOOK + d.frames.reduce((a, f) => a + len(f), 0) + END;

// 확대 배율과 중심(영상 좌표)
const cam = (f: Fr) => {
  if (!f.focus) return {z: 1, cx: 540, cy: 960};
  const [x, y, w, h] = f.focus.map((v) => v * S);
  let z = Math.min(1000 / w, 1350 / Math.max(h, 1), 1.45);
  z = Math.max(1, z);
  const hw = 540 / z, hh = 960 / z;
  const cx = Math.min(Math.max(x + w / 2, hw), 1080 - hw);
  const cy = Math.min(Math.max(y + h / 2 + 60 / z, hh), 1920 - hh);   // 위 자막 띠만큼 살짝 아래로
  return {z, cx, cy};
};

const Logo: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame();
  const k = interpolate(f - at, [0, 8], [0.6, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2))});
  return <div style={{display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${k})`, transformOrigin: 'left center', opacity: f >= at ? 1 : 0}}>
    <span style={{width: 190, height: 190, background: YEL, color: INK, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, fontWeight: 700}}>집</span>
    <div><div style={{fontSize: 170, fontWeight: 700, color: '#fff', letterSpacing: -5, lineHeight: 1}}>집지니</div>
      <div style={{marginTop: 18, fontSize: 66, fontWeight: 700, color: LIME}}>jipjini.com</div></div></div>;
};

export const Tut: React.FC<{d: TutData}> = ({d}) => {
  useFonts();
  const f = useCurrentFrame();
  const base = `tut/${d.id}/`;
  // 장면 시작 시각
  const starts: number[] = []; let t = HOOK;
  d.frames.forEach((fr) => {starts.push(t); t += len(fr);});
  const endAt = t, total = t + END;
  let i = starts.findIndex((s, k) => f >= s && f < s + len(d.frames[k]));
  const fr = i >= 0 ? d.frames[i] : null;
  // 지금 단계 자막(빈 자막이면 앞 장면 것을 이어 씀)
  let capIdx = -1;
  if (i >= 0) for (let k = i; k >= 0; k--) if (d.frames[k].cap) {capIdx = k; break;}
  const cap = capIdx >= 0 ? d.frames[capIdx] : null;
  // 확대: 같은 단계 안(타자 장면)은 그대로, 새 단계는 1배에서 들어감
  let view = {z: 1, cx: 540, cy: 960};
  if (fr) {
    const tgt = cam(fr.kind === 'type' && capIdx >= 0 ? d.frames[capIdx] : fr);
    const from = fr.kind === 'type' || fr.cap === null && i > 0 && d.frames[i - 1].kind !== 'shot' ? tgt : {z: 1, cx: 540, cy: 960};
    const p = fr.kind === 'type' ? 1 : interpolate(f - starts[i], [4, 4 + ZIN], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
    view = {z: from.z + (tgt.z - from.z) * p, cx: from.cx + (tgt.cx - from.cx) * p, cy: from.cy + (tgt.cy - from.cy) * p};
  }
  const tf = `translate(${540 - view.cx * view.z}px, ${960 - view.cy * view.z}px) scale(${view.z})`;
  const resultIdx = d.frames.findIndex((x) => x.result);
  const resImg = d.frames[resultIdx >= 0 ? resultIdx : d.frames.length - 1].img;

  // 소리
  const sounds: JSX.Element[] = [];
  const W = ['whoosh_a', 'whoosh_b', 'whoosh_c'], K = ['key1', 'key2', 'key3'];
  d.frames.forEach((x, k) => {
    const s = starts[k];
    if (x.cap && !x.result) sounds.push(<Sequence key={'w' + k} from={s - 3}><Audio src={staticFile(`sfx/${W[k % 3]}.wav`)} volume={0.35} /></Sequence>);
    if (x.kind === 'tap' && x.tapAt) sounds.push(<Sequence key={'t' + k} from={s + Math.round(len(x) * 0.45)}><Audio src={staticFile(`sfx/${K[k % 3]}.wav`)} volume={0.7} /></Sequence>);
    if (x.kind === 'type') sounds.push(<Sequence key={'k' + k} from={s + 1}><Audio src={staticFile(`sfx/${K[(k + 1) % 3]}.wav`)} volume={0.45} /></Sequence>);
    if (x.result) sounds.push(<Sequence key={'r' + k} from={s + 6}><Audio src={staticFile('sfx/m_ah.wav')} volume={0.8} /></Sequence>);
  });

  // 손가락 표시
  let tapEl = null;
  if (fr && fr.kind === 'tap' && fr.tapAt) {
    const L = len(fr), lf = f - starts[i];
    const px = 540 + (fr.tapAt[0] * S - view.cx) * view.z, py = 960 + (fr.tapAt[1] * S - view.cy) * view.z;
    const show = interpolate(lf, [L * 0.2, L * 0.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const press = interpolate(lf, [L * 0.4, L * 0.45, L * 0.55], [1, 0.8, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const rip = interpolate(lf, [L * 0.45, L * 0.75], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    tapEl = <>
      <div style={{position: 'absolute', left: px - 50, top: py - 50, width: 100, height: 100, borderRadius: 50, background: 'rgba(255,212,59,.55)', border: '6px solid #fff', boxShadow: '0 6px 24px rgba(0,0,0,.35)', opacity: show, transform: `scale(${press})`}} />
      {rip > 0 && rip < 1 && <div style={{position: 'absolute', left: px - 50, top: py - 50, width: 100, height: 100, borderRadius: 50, border: `8px solid ${YEL}`, opacity: 1 - rip, transform: `scale(${1 + rip * 1.8})`}} />}
    </>;
  }
  // 결과 테두리 반짝
  let resEl = null;
  if (fr && fr.result && fr.focus) {
    const [x, y, w, h] = fr.focus.map((v) => v * S);
    const lf = f - starts[i];
    const o = interpolate(lf, [ZIN, ZIN + 6, ZIN + 30], [0, 1, 0.75], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    resEl = <div style={{position: 'absolute', left: 540 + (x - view.cx) * view.z - 10, top: 960 + (y - view.cy) * view.z - 10, width: w * view.z + 20, height: h * view.z + 20, border: `8px solid ${YEL}`, borderRadius: 14, opacity: o}} />;
  }
  const capIn = cap ? interpolate(f - starts[capIdx], [0, 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6))}) : 0;
  const lines = d.hook.split('\n');

  return <AbsoluteFill style={{background: INK, fontFamily: 'P', overflow: 'hidden'}}>
    {/* 갈고리: 결과 화면을 깔고 큰 질문 */}
    {f < HOOK && <AbsoluteFill>
      <Img src={staticFile(base + resImg)} style={{width: 1080, height: 1920, filter: 'brightness(.22) blur(3px)', transform: `scale(${1.05 + f * 0.001})`}} />
      <div style={{position: 'absolute', left: 90, right: 90, top: 640}}>
        <div style={{fontSize: 46, color: LIME, fontWeight: 700, marginBottom: 28}}>집지니 사용법 · {d.title}</div>
        {lines.map((l, k) => <div key={k} style={{fontSize: 120, fontWeight: 700, color: k === lines.length - 1 ? YEL : '#fff', letterSpacing: -4, lineHeight: 1.15,
          transform: `translateY(${interpolate(f, [k * 6, k * 6 + 10], [60, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.8))})}px)`,
          opacity: interpolate(f, [k * 6, k * 6 + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{l}</div>)}
      </div>
    </AbsoluteFill>}
    {/* 단계 화면 */}
    {fr && <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: tf}}>
        <Img src={staticFile(base + fr.img)} style={{width: 1080, height: 1920}} />
      </div>
      {resEl}{tapEl}
      {cap && <div style={{position: 'absolute', left: 0, right: 0, top: 0, padding: '120px 70px 44px', background: 'linear-gradient(#141613 78%, rgba(20,22,19,0))', transform: `translateY(${(1 - capIn) * -40}px)`, opacity: capIn}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
          <span style={{flex: '0 0 auto', background: cap.result ? LIME : YEL, color: INK, fontSize: 44, fontWeight: 700, padding: '10px 22px', borderRadius: 10}}>{cap.result ? '끝' : `${cap.step}단계`}</span>
          <span style={{fontSize: 62, fontWeight: 700, color: '#fff', letterSpacing: -1.5, lineHeight: 1.2}}>{cap.cap}</span>
        </div>
      </div>}
    </AbsoluteFill>}
    {/* 끝 화면 */}
    {f >= endAt && <AbsoluteFill style={{background: INK}}>
      <div style={{position: 'absolute', left: 90, top: 660}}>
        <div style={{fontSize: 130, fontWeight: 700, color: '#fff', letterSpacing: -4, lineHeight: 1.1}}>{d.end}</div>
        <div style={{marginTop: 90}}><Logo at={endAt + 10} /></div>
      </div>
    </AbsoluteFill>}
    <div style={{position: 'absolute', top: 0, left: 0, height: 12, width: `${(f / total) * 100}%`, background: LIME}} />
    {/* 소리 */}
    <Audio src={staticFile('sfx/music_tut.wav')} volume={(fr) => interpolate(fr, [0, 10, total - 20, total], [0, 0.32, 0.32, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
    <Sequence from={0}><Audio src={staticFile('sfx/m_vine.wav')} volume={0.9} /></Sequence>
    {sounds}
    <Sequence from={endAt}><Audio src={staticFile('sfx/whoosh_b.wav')} volume={0.5} /></Sequence>
    <Sequence from={endAt + 10}><Audio src={staticFile('sfx/reveal.wav')} volume={0.6} /></Sequence>
  </AbsoluteFill>;
};
