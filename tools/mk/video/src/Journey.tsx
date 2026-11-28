// 고객 입장에서 본 집지니 진행 과정: 비교 견적 → 계약 → 코디 → 시공 → 입주 (2026-11-28 대표 요청)
// 조사 반영(mk/research/2026-11-28-고객여정영상.md): 단계마다 「고객이 받는 것」 한 줄 + 안심 장치(돈 흐름·동의·하자)를 숫자로, 위쪽에 여정 지도 고정
// 화면은 실제 고객 페이지(progress/?demo=1)에 예시 자료를 넣어 찍은 것 — 예시 고객·예시 단지 표시
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, staticFile, Easing} from 'remotion';
import {INK, useFonts, css} from './Maru';

const GREEN = '#1F5E2E', LIME = '#8FD19E', YEL = '#FFD43B', PAPER = '#F3EFE6';
const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const S = 2.5;
const snd = (n: string, at: number, v = 0.7) => <Sequence key={n + at} from={Math.max(0, Math.round(at))}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v} /></Sequence>;
const pop = (f: number, at: number, k = 1.8) => interpolate(f - at, [0, 9], [0, 1], {...C, easing: Easing.out(Easing.back(k))});
const fade = (f: number, at: number, d = 6) => interpolate(f - at, [0, d], [0, 1], C);

type Key = {at: number; img: string; cy: number; z: number; cap: string; sub?: string};
type Ch = {name: string; icon: string; from: number; to: number; keys: Key[]};
const HOOK = 84;
const CH: Ch[] = [
  {name: '비교 견적', icon: 'magnifying_glass_tilted_left', from: HOOK, to: 270, keys: [
    {at: HOOK, img: 'cost', cy: 290, z: 1.0, cap: '턴키 견적과 나란히 놓고 봅니다', sub: '84㎡ 올수리 예시 · 차이 1,200만 원'},
    {at: HOOK + 95, img: 'compare', cy: 400, z: 1.0, cap: '받은 견적서도 줄마다 짚어 드려요', sub: '비싼 줄 · 빠진 공사 · 부가세 표기'}]},
  {name: '계약', icon: 'clipboard', from: 270, to: 430, keys: [
    {at: 270, img: 'contract', cy: 420, z: 1.0, cap: '계약은 휴대폰으로, 손가락 서명', sub: '지금 단계 · 다음 단계가 한눈에'},
    {at: 340, img: 'contract', cy: 1640, z: 1.0, cap: '추가 공사는 동의해야만 진행', sub: '공사 전 취소하면 코디비 전액 환불'}]},
  {name: '코디', icon: 'light_bulb', from: 430, to: 610, keys: [
    {at: 430, img: 'codi', cy: 1480, z: 1.0, cap: '공정마다 담당 기술자와 날짜를 미리', sub: '고객님이 준비할 일까지 적어 드려요'},
    {at: 520, img: 'codi', cy: 2960, z: 1.0, cap: '집지니에 내는 돈은 코디비뿐', sub: '자재·인건비는 직접 거래 · 마진 0원'}]},
  {name: '시공', icon: 'hammer', from: 610, to: 830, keys: [
    {at: 610, img: 'build', cy: 1080, z: 1.0, cap: '진행률이 휴대폰에 실시간으로', sub: '공정 7개 중 4개 완료 · 57%'},
    {at: 680, img: 'build', cy: 2780, z: 1.0, cap: '매일 저녁 현장 일보', sub: '오늘 한 일 · 내일 할 일 · 특이사항'},
    {at: 755, img: 'build', cy: 3430, z: 1.0, cap: '돈이 더 들면, 먼저 묻습니다', sub: '「동의합니다」를 누르기 전엔 진행 안 함'}]},
  {name: '입주', icon: 'house', from: 830, to: 980, keys: [
    {at: 830, img: 'movein', cy: 1090, z: 1.0, cap: '공정 7개 모두 완료, 입주', sub: '완공 7일 점검 뒤 들어가세요'},
    {at: 900, img: 'movein', cy: 3080, z: 1.0, cap: '입주 뒤 12개월, 하자는 여기서 접수', sub: '시공한 기술자 연결 · 방문 일정까지'}]},
];
const ENDAT = 980;
export const JOURNEY_LEN = ENDAT + 110;

const cam = (f: number) => {
  const ks = CH.flatMap((c) => c.keys);
  let i = 0; for (let k = 0; k < ks.length; k++) if (f >= ks[k].at) i = k;
  const cur = ks[i], prev = ks[Math.max(0, i - 1)];
  const sameImg = prev.img === cur.img && i > 0;
  const p = sameImg ? interpolate(f - cur.at, [0, 16], [0, 1], {...C, easing: Easing.inOut(Easing.cubic)}) : 1;
  const cy = sameImg ? prev.cy + (cur.cy - prev.cy) * p : cur.cy;
  const z0 = sameImg ? prev.z : 1.0;
  const zin = sameImg ? p : interpolate(f - cur.at, [0, 18], [0, 1], {...C, easing: Easing.out(Easing.cubic)});
  const z = 1; const slide = sameImg ? 0 : (1 - zin) * 120;
  return {cur, cy, z, i, sameImg, slide};
};

const Logo: React.FC<{at: number}> = ({at}) => {
  const f = useCurrentFrame();
  const k = interpolate(f - at, [0, 8], [0.6, 1], {...C, easing: Easing.out(Easing.back(2))});
  return <div style={{display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${k})`, transformOrigin: 'left center', opacity: f >= at ? 1 : 0}}>
    <span style={{width: 190, height: 190, background: YEL, color: INK, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, fontWeight: 700}}>집</span>
    <div><div style={{fontSize: 170, fontWeight: 700, color: '#fff', letterSpacing: -5, lineHeight: 1}}>집지니</div>
      <div style={{marginTop: 18, fontSize: 66, fontWeight: 700, color: LIME}}>jipjini.com</div></div></div>;
};

export const Journey: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const chi = CH.findIndex((c) => f >= c.from && f < c.to);
  const {cur, cy, z, slide} = cam(f);
  // 장면 이미지: 위 여정 지도(240) 아래부터, 자막 상자 위까지 보이게
  const top = 880 - cy * S * z + slide;

  // 소리
  const sounds: JSX.Element[] = [snd('m_vine', 0, 0.85), snd('pop', 22, 0.6), snd('pop', 40, 0.6), snd('rise', 52, 0.4)];
  CH.forEach((c, k) => {
    sounds.push(snd(['whoosh_a', 'whoosh_b', 'whoosh_c', 'whoosh_a', 'whoosh_b'][k], c.from - 4, 0.5));
    sounds.push(snd(['chips', 'pen', 'pluck', 'punch', 'reveal'][k], c.from + 8, 0.6));
    c.keys.slice(1).forEach((q) => sounds.push(snd('qup', q.at, 0.45)));
  });
  sounds.push(snd('m_woo', CH[4].keys[0].at + 10, 0.7), snd('tapestop', ENDAT - 6, 0.4), snd('reveal', ENDAT + 10, 0.6));

  const capKey = cur; const capAt = capKey.at;
  const capIn = pop(f, capAt, 1.6);

  return <AbsoluteFill style={{background: INK, fontFamily: 'P', overflow: 'hidden'}}>
    <style>{css}</style>
    {/* 갈고리 */}
    {f < HOOK && <AbsoluteFill style={{background: INK}}>
      <div style={{position: 'absolute', left: 90, right: 90, top: 470}}>
        {['인테리어 계약하고 나면', '연락 끊길까 봐', '걱정되시죠?'].map((l, k) => <div key={l} style={{fontSize: k === 0 ? 74 : 128, fontWeight: 700, color: k === 2 ? YEL : '#fff', letterSpacing: -4, lineHeight: 1.18, opacity: fade(f, k * 8), transform: `translateY(${(1 - pop(f, k * 8)) * 60}px)`}}>{l}</div>)}
        <div style={{marginTop: 70, fontSize: 64, fontWeight: 700, color: LIME, opacity: fade(f, 40)}}>집지니는 계약 뒤가 다 보입니다</div>
      </div>
      <div style={{position: 'absolute', left: 60, right: 60, top: 1380, display: 'flex', justifyContent: 'space-between'}}>
        {CH.map((c, k) => <div key={c.name} style={{textAlign: 'center', opacity: fade(f, 50 + k * 4), transform: `scale(${pop(f, 50 + k * 4, 2.4)})`}}>
          <Img src={staticFile(`img3d/${c.icon}.png`)} style={{width: 150, height: 150}} />
          <div style={{fontSize: 38, fontWeight: 700, color: '#fff', marginTop: 10}}>{c.name}</div></div>)}
      </div>
    </AbsoluteFill>}
    {/* 단계 화면 */}
    {f >= HOOK && f < ENDAT && <AbsoluteFill style={{background: PAPER}}>
      <div style={{position: 'absolute', left: 540 - 540 * z, top, width: 1080 * z, transformOrigin: '0 0'}}>
        <Img src={staticFile(`proc/${cur.img}.jpg`)} style={{width: 1080 * z, display: 'block', boxShadow: '0 0 0 2px #DCDFD8'}} />
      </div>
      {/* 여정 지도 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 300, background: `linear-gradient(${INK} 82%, rgba(20,22,19,0))`, padding: '96px 56px 0'}}>
        <div style={{position: 'relative', height: 140}}>
          <div style={{position: 'absolute', left: 50, right: 50, top: 44, height: 8, background: '#3A3E37', borderRadius: 4}} />
          <div style={{position: 'absolute', left: 50, top: 44, height: 8, background: LIME, borderRadius: 4, width: `${Math.max(0, chi) / 4 * (968 - 100) + interpolate(f - (CH[chi]?.from ?? 0), [0, 12], [-(968 - 100) / 4, 0], C) * (chi > 0 ? 1 : 0)}px`}} />
          {CH.map((c, k) => {
            const on = k <= chi, now = k === chi;
            return <div key={c.name} style={{position: 'absolute', left: 50 + k * (968 - 100) / 4 - 60, width: 120, top: 0, textAlign: 'center'}}>
              <div style={{width: 96, height: 96, margin: '0 auto', borderRadius: 48, background: now ? YEL : on ? LIME : '#2A2D27', border: `4px solid ${now ? '#fff' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${now ? 1 + 0.12 * pop(f, c.from, 3) - (f > c.from + 9 ? 0.12 : 0) + 0.12 : 1})`}}>
                <Img src={staticFile(`img3d/${c.icon}.png`)} style={{width: 66, height: 66, opacity: on ? 1 : 0.45}} /></div>
              <div style={{marginTop: 8, fontSize: 32, fontWeight: 700, color: now ? YEL : on ? '#fff' : '#7C8177', whiteSpace: 'nowrap'}}>{c.name}</div></div>;
          })}
        </div>
      </div>
      {/* 자막 */}
      <div style={{position: 'absolute', left: 44, right: 44, top: 1470, padding: '34px 40px 38px', background: INK, borderRadius: 20, boxShadow: '0 16px 48px rgba(0,0,0,.4)', opacity: capIn, transform: `translateY(${(1 - capIn) * 70}px)`}}>
        <div style={{fontSize: 38, fontWeight: 700, color: YEL, marginBottom: 10}}>{chi + 1} / 5 · {CH[Math.max(0, chi)].name}</div>
        <div style={{fontSize: 66, fontWeight: 700, color: '#fff', letterSpacing: -1.5, lineHeight: 1.2}}>{capKey.cap}</div>
        {capKey.sub && <div style={{marginTop: 14, fontSize: 44, fontWeight: 700, color: LIME, opacity: fade(f, capAt + 8)}}>{capKey.sub}</div>}
      </div>
      <div style={{position: 'absolute', right: 50, top: 1880, fontSize: 28, color: '#6B7067'}}>실제 고객 화면 · 예시 자료</div>
    </AbsoluteFill>}
    {/* 끝 */}
    {f >= ENDAT && <AbsoluteFill style={{background: INK}}>
      <div style={{position: 'absolute', left: 90, top: 560}}>
        {['계약 뒤가', '더 편한 인테리어'].map((l, k) => <div key={l} style={{fontSize: 124, fontWeight: 700, color: k ? YEL : '#fff', letterSpacing: -4, lineHeight: 1.12, opacity: fade(f, ENDAT + k * 6)}}>{l}</div>)}
        <div style={{marginTop: 100}}><Logo at={ENDAT + 14} /></div>
      </div>
    </AbsoluteFill>}
    <div style={{position: 'absolute', top: 0, left: 0, height: 12, width: `${(f / JOURNEY_LEN) * 100}%`, background: LIME}} />
    <Audio src={staticFile('sfx/music_c.wav')} volume={(x) => interpolate(x, [0, 10, JOURNEY_LEN - 20, JOURNEY_LEN], [0, 0.3, 0.3, 0], C)} />
    {sounds}
  </AbsoluteFill>;
};
