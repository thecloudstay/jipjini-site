// 고객 입장에서 본 집지니 진행 과정: 비교 견적 → 계약 → 코디 → 시공 → 입주 (2026-11-28 대표 요청)
// v2 (대표 「AI 티가 너무 난다」 → mk/research/2026-11-28-AI티-없애기.md):
//   둥근 자막 상자·알약 머리말·3D 이모지·통통 튀는 글자 빼고 → 쇼츠 기본 자막(흰 글씨+검은 테두리), 손으로 그은 동그라미,
//   손가락으로 넘기는 듯한 스크롤, 컷 편집, 살짝 손 흔들림, 대표 말투 1인칭 자막
// 화면은 실제 고객 진행표(progress/?demo=1)에 예시 자료를 넣어 찍은 것(tools/proc/rec.js) — 「예시 고객·예시 단지」 그대로 보임
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, staticFile, Easing} from 'remotion';
import {INK, useFonts, css} from './Maru';
import {Mark, MarkKind, Cap, shake} from './Marks';

const LIME = '#8FD19E', YEL = '#FFD43B';
const KIND: MarkKind[] = ['hl', 'circle', 'arrow', 'underline', 'star', 'bracket', 'circle', 'box', 'arrow', 'star', 'check'];
const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const snd = (n: string, at: number, v = 0.7) => <Sequence key={n + at} from={Math.max(0, Math.round(at))}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v * 0.7} /></Sequence>;

// 그림 배율: 진행표 사진은 css 1px = 2.5px, 사용법 영상 사진(cost·compare)은 이미 1080 폭
const SC: Record<string, number> = {cost: 1, compare: 1, contract: 2.5, codi: 2.5, build: 2.5, movein: 2.5};
type Key = {at: number; img: string; mark: number[]; cap: string; sub?: string};
type Ch = {no: string; name: string; from: number; keys: Key[]};
const HOOK = 78;
const CH: Ch[] = [
  {no: '①', name: '비교 견적', from: HOOK, keys: [
    {at: HOOK, img: 'cost', mark: [50, 740, 980, 135], cap: '견적 받으면\n턴키랑 나란히 비교돼요', sub: '84㎡ 예시 · 1,200만 원 차이'},
    {at: HOOK + 80, img: 'compare', mark: [40, 960, 1000, 170], cap: '다른 업체 견적서도 넣어 보세요\n비싼 줄 짚어 드려요'}]},
  {no: '②', name: '계약', from: 240, keys: [
    {at: 240, img: 'contract', mark: [20, 1396, 392, 50], cap: '계약은 휴대폰으로 서명해요'},
    {at: 305, img: 'contract', mark: [20, 1589, 392, 70], cap: '추가 공사는\n고객님이 동의 눌러야 들어가요'}]},
  {no: '③', name: '코디', from: 385, keys: [
    {at: 385, img: 'codi', mark: [20, 1340, 392, 50], cap: '공정마다 어떤 기사님이\n언제 오는지 미리 나와요'},
    {at: 465, img: 'codi', mark: [20, 2996, 392, 70], cap: '저희한테 내시는 건 코디비 하나', sub: '자재비·인건비는 직접 내세요 · 마진 0원'}]},
  {no: '④', name: '시공', from: 560, keys: [
    {at: 560, img: 'build', mark: [16, 1044, 110, 66], cap: '진행률은 매일 바뀌어요'},
    {at: 620, img: 'build', mark: [16, 2700, 400, 120], cap: '저녁마다 현장 일보 올려 드려요'},
    {at: 690, img: 'build', mark: [16, 3500, 130, 46], cap: '돈 더 드는 일 생기면\n먼저 여쭤봐요'}]},
  {no: '⑤', name: '입주', from: 770, keys: [
    {at: 770, img: 'movein', mark: [16, 1069, 120, 66], cap: '다 끝나면 7일 점검하고 입주'},
    {at: 835, img: 'movein', mark: [16, 3112, 400, 56], cap: '살다가 문제 생기면 여기서 접수', sub: '12개월 동안 기사님 연결해 드려요'}]},
];
const ENDAT = 925;
export const JOURNEY_LEN = ENDAT + 105;
const KS = CH.flatMap((c) => c.keys);

// 화면 위치: 표시한 곳 가운데가 화면 y=700 에 오게, 같은 사진이면 손가락으로 쓸어 올리듯(빠르게 출발, 천천히 멈춤)
const view = (f: number) => {
  let i = 0; for (let k = 0; k < KS.length; k++) if (f >= KS[k].at) i = k;
  const cur = KS[i], prev = KS[Math.max(0, i - 1)];
  const s = SC[cur.img];
  const yOf = (k: Key) => (k.mark[1] + k.mark[3] / 2) * SC[k.img];
  const same = i > 0 && prev.img === cur.img;
  const p = same ? interpolate(f - cur.at, [0, 22], [0, 1], {...C, easing: Easing.out(Easing.poly(5))}) : 1;
  const y = same ? yOf(prev) + (yOf(cur) - yOf(prev)) * p : yOf(cur);
  return {cur, i, s, top: 700 - y, swipe: same ? f - cur.at : -1};
};

const Logo: React.FC = () =>
  <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
    <span style={{width: 190, height: 190, background: YEL, color: INK, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, fontWeight: 700}}>집</span>
    <div><div style={{fontSize: 170, fontWeight: 700, color: '#fff', letterSpacing: -5, lineHeight: 1}}>집지니</div>
      <div style={{marginTop: 18, fontSize: 66, fontWeight: 700, color: LIME}}>jipjini.com</div></div></div>;

export const Journey: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const chi = CH.reduce((a, c, k) => (f >= c.from ? k : a), -1);
  const {cur, i, s, top, swipe} = view(f);
  // 손 흔들림(아주 살짝)
  const markT = f - cur.at - (swipe >= 0 ? 16 : 8);

  const sounds: JSX.Element[] = [snd('m_vine', 2, 0.8), snd('scratch', 44, 0.5)];
  KS.forEach((k, n) => {
    const newImg = n === 0 || KS[n - 1].img !== k.img;
    sounds.push(newImg ? snd(['whoosh_a', 'whoosh_b', 'whoosh_c'][n % 3], k.at - 2, 0.45) : snd('key2', k.at, 0.5));
    sounds.push(snd(['mk1', 'mk2', 'mk3'][n % 3], k.at + (newImg ? 8 : 16), 0.7));
  });
  sounds.push(snd('m_ah', 700, 0.6), snd('m_woo', 840, 0.6), snd('tapestop', ENDAT - 6, 0.4), snd('reveal', ENDAT + 8, 0.6));

  return <AbsoluteFill style={{background: '#000', fontFamily: 'P', overflow: 'hidden'}}>
    <style>{css}</style>
    {/* 갈고리: 실제 진행표 화면 위에 그냥 자막 */}
    {f < HOOK && <AbsoluteFill style={{transform: shake(f)}}>
      <Img src={staticFile('proc/contract.jpg')} style={{position: 'absolute', left: 0, top: -120, width: 1080}} />
      <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)'}} />
      <div style={{position: 'absolute', left: 50, right: 50, top: 760}}>
        {f < 44 ? <Cap text={'인테리어 계약하고 나면\n연락 끊길까 봐\n걱정되시죠?'} size={92} /> : <Cap text={'저희 고객님 휴대폰엔\n이렇게 떠요'} size={92} color={YEL} />}
      </div>
    </AbsoluteFill>}
    {/* 단계 화면 */}
    {f >= HOOK && f < ENDAT && <AbsoluteFill style={{background: '#F3EFE6', transform: shake(f)}}>
      <div style={{position: 'absolute', left: 0, top, width: 1080}}>
        <Img src={staticFile(`proc/${cur.img}.jpg`)} style={{width: 1080, display: 'block'}} />
        {markT >= 0 && <Mark kind={KIND[i % KIND.length]} x={cur.mark[0] * s} y={cur.mark[1] * s} w={cur.mark[2] * s} h={cur.mark[3] * s} t={markT} seed={i * 1.3} />}
      </div>
      {/* 쓸어 올리는 손가락 자국(휴대폰 화면 녹화의 터치 표시처럼) */}
      {swipe >= 0 && swipe < 14 && <div style={{position: 'absolute', left: 620, top: interpolate(swipe, [0, 12], [1350, 700], C), width: 84, height: 84, borderRadius: 42, background: 'rgba(120,120,120,.45)', border: '3px solid rgba(255,255,255,.8)', opacity: interpolate(swipe, [0, 2, 10, 14], [0, 1, 1, 0], C)}} />}
    </AbsoluteFill>}
    {f >= HOOK && f < ENDAT && <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 460, background: 'linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.4) 60%, rgba(0,0,0,0))'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 960, background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.6) 35%, rgba(0,0,0,.72))'}} />
      <div style={{position: 'absolute', left: 60, top: 300}}><Cap text={`${CH[chi].no} ${CH[chi].name}`} size={58} color={YEL} /></div>
      <div style={{position: 'absolute', left: 60, right: 150, top: 1200}}>
        <Cap text={cur.cap} size={70} />
        {cur.sub && <div style={{marginTop: 18}}><Cap text={cur.sub} size={46} color={YEL} /></div>}
      </div>
      <div style={{position: 'absolute', left: 60, top: 1500, fontSize: 28, color: '#fff', opacity: 0.85, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>실제 고객 화면 · 예시 자료</div>
    </>}
    {/* 끝: 큰 로고 + 주소 */}
    {f >= ENDAT && <AbsoluteFill style={{background: INK}}>
      <div style={{position: 'absolute', left: 90, top: 620}}>
        <div style={{fontSize: 84, fontWeight: 700, color: '#fff', lineHeight: 1.25, letterSpacing: -2}}>궁금한 건<br />카톡으로 물어보세요</div>
        <div style={{marginTop: 90}}><Logo /></div>
      </div>
    </AbsoluteFill>}
    <Audio src={staticFile('sfx/mood_warm.wav')} startFrom={308} volume={(x) => interpolate(x, [0, 10, JOURNEY_LEN - 20, JOURNEY_LEN], [0, 0.24, 0.24, 0], C)} />
    {sounds}
  </AbsoluteFill>;
};
