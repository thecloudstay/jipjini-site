// 신혼부부 이야기 v2 (2026-11-28 대표 「흥미진진하게: 발품 → 비싸고 못 믿음 → 셀프 포기 → 집지니 → 평면도·물량 → 가양동 사무실 → 전자계약 → 공사 일보·카톡 → 추가 비용 설명 → 13년」
//  + 「스토리보드는 전문가 방식 조사 후」) — 근거: mk/research/2026-11-28-스토리보드-짜는-법.md
// 틀: 줄인 영웅의 여정(고객이 주인공, 집지니는 길잡이). 갈등은 7~21초 안, 방향 전환은 절반 전, 절정 앞에 정적, 끝은 구호 대신 여운 한 문장.
// 1인칭 나레이션(감정 지시 음성)에 장면 길이를 맞춘다. 금액·대화는 이야기용 예시라고 화면에 적는다.
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, staticFile, Easing} from 'remotion';
import {INK, useFonts, css} from './Maru';
import {Mark, MarkKind, Cap, shake} from './Marks';
import {punchZ, hitShake, BPM} from './fx';
import NARR from './story_narr.json';

const YEL = '#FFD43B', LIME = '#8FD19E';
const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const snd = (n: string, at: number, v = 0.7) => <Sequence key={n + at} from={Math.max(0, Math.round(at))}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v * 0.7} /></Sequence>;

// 장면 순서(나레이션 줄 번호)와 줄 뒤 쉼(프레임), 쉼에 넣는 한마디
const ORDER: [number, number, string?][] = [[1, 2], [2, 2], [3, 9, 'k_eolma'], [4, 8, 'm_bruh'], [5, 9, 'k_gabojago'], [6, 8, 'k_manghaetda'], [12, 14],
  [7, 2], [8, 9, 'k_ige_doene'], [9, 2], [10, 2], [11, 3], [13, 7, 'k_heok'], [14, 2], [15, 8, 'k_saratda'], [16, 2], [17, 4], [18, 6]];
const N = NARR as Record<string, {dur: number; text: string}>;
const SC: {n: number; from: number; dur: number; say?: string}[] = [];
let t0 = 0;
for (const [n, gap, say] of ORDER) { const d = N[String(n)].dur; SC.push({n, from: t0, dur: d + gap, say}); t0 += d + gap; }
const ENDAT = t0;
export const STORY_LEN = ENDAT + 72;
const at = (n: number) => SC.find((s) => s.n === n)!.from;

const ROWS: [string, string][] = [['철거·설비', '620만'], ['목공·도배·바닥', '2,480만'], ['주방 공사 일식', '1,200만'], ['욕실 2곳 일식', '1,600만'], ['기타 일식', '900만']];
const Paper: React.FC<{f: number; hl?: number; markTotal?: number; zoom?: number}> = ({f, hl = -1, markTotal = -1, zoom = 1}) =>
  <div style={{position: 'absolute', left: 90, right: 90, top: 250, transformOrigin: '400px 500px', transform: `scale(${zoom * 0.92}) rotate(-1.2deg)`, background: '#FBFAF6', padding: '54px 56px 60px', boxShadow: '0 30px 80px rgba(0,0,0,.5)', color: '#1c1c1c'}}>
    <div style={{fontSize: 52, fontWeight: 700, letterSpacing: 8, textAlign: 'center', borderBottom: '4px solid #1c1c1c', paddingBottom: 22}}>견 적 서</div>
    <div style={{fontSize: 28, color: '#666', marginTop: 16, display: 'flex', justifyContent: 'space-between'}}><span>○○인테리어 · 32평 올수리</span><span>이야기용 예시</span></div>
    {ROWS.map(([a, b], k) => <div key={a} style={{display: 'flex', justifyContent: 'space-between', fontSize: 44, padding: '22px 6px', borderBottom: '1px solid #cfcabd'}}>
      <span>{a.split('일식').map((s, q, arr) => <React.Fragment key={q}>{s}{q < arr.length - 1 && <span style={{background: hl >= 0 && f >= hl + k * 6 ? YEL : 'transparent', padding: '0 6px', fontWeight: 700}}>일식</span>}</React.Fragment>)}</span><span>{b}</span></div>)}
    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 58, fontWeight: 700, padding: '30px 6px 0'}}><span>합계</span><span>6,800만 원</span></div>
    {markTotal >= 0 && <div style={{position: 'absolute', right: 20, bottom: 30, width: 520, height: 120}}><Mark kind="circle" x={0} y={0} w={520} h={120} t={f - markTotal} seed={3} /></div>}
  </div>;

// 발품: 휴대폰 메모장에 하나씩 줄 긋기
const Legwork: React.FC<{f: number}> = ({f}) => {
  const items = ['셀인 카페 후기 정독', '동네 업체 방문 상담', '견적서 받아 오기', '또 다른 업체 방문', '견적서 또 받기', '주말마다 반복…'];
  return <AbsoluteFill style={{background: '#FFF9D9'}}>
    <div style={{position: 'absolute', left: 80, top: 260, fontSize: 54, fontWeight: 700, color: '#8a7a2a'}}>신혼집 인테리어 할 일</div>
    {items.map((s, k) => f >= k * 14 ? <div key={s} style={{position: 'absolute', left: 80, right: 80, top: 390 + k * 118, fontSize: 60, color: '#1c1c1c', borderBottom: '2px solid #e6dca0', paddingBottom: 18}}>
      <span style={{textDecoration: f >= k * 14 + 8 ? 'line-through' : 'none', textDecorationThickness: 5, textDecorationColor: '#D9342B'}}>{s}</span></div> : null)}
  </AbsoluteFill>;
};
// 셀프: 끝없이 올라가는 공정 목록
const SelfList: React.FC<{f: number}> = ({f}) => {
  const items = ['철거', '설비·배관', '전기', '목공', '타일', '방수', '도배', '바닥', '필름', '주방', '욕실', '조명', '입주 청소', '폐기물 처리', '자재 발주', '기사님 섭외', '일정 조율'];
  return <AbsoluteFill style={{background: '#1b1a18'}}>
    <div style={{position: 'absolute', left: 90, top: 300 - f * 16}}>
      {items.map((s, k) => <div key={s} style={{fontSize: 96, fontWeight: 700, color: k % 5 === 4 ? YEL : '#fff', lineHeight: 1.5, opacity: 0.92}}>□ {s}</div>)}</div>
  </AbsoluteFill>;
};
const Search: React.FC<{f: number}> = ({f}) => {
  const q = '인테리어 견적 비교'; const n = Math.min(q.length, Math.floor(f / 3));
  return <AbsoluteFill style={{background: '#fff'}}>
    <div style={{position: 'absolute', left: 60, right: 60, top: 560, height: 130, border: '5px solid #1F5E2E', borderRadius: 65, display: 'flex', alignItems: 'center', padding: '0 50px', fontSize: 60, color: '#1c1c1c'}}>{q.slice(0, n)}<span style={{opacity: f % 16 < 8 ? 1 : 0, marginLeft: 4}}>|</span></div>
    {f >= 34 && <div style={{position: 'absolute', left: 80, right: 80, top: 780}}><div style={{fontSize: 64, fontWeight: 700, color: '#1F5E2E'}}>집지니</div><div style={{fontSize: 42, color: '#555', marginTop: 12}}>jipjini.com · 아파트 이름으로 도면·공사비</div></div>}
  </AbsoluteFill>;
};
// 가양동 사무실: 자재를 고르는 장면(그림) — 실제 사무실 사진이 생기면 바꾼다
const Showroom: React.FC<{f: number}> = ({f}) => {
  const chips: [string, string][] = [['#E8E2D6', '도배 · 실크'], ['#C9A77C', '바닥 · 강마루'], ['#8E9AA0', '욕실 · 포세린'], ['#F4F4F2', '주방 · 상판'], ['#5B6B5A', '필름 · 문'], ['#D9CBB8', '타일 · 현관']];
  const pick = Math.min(5, Math.floor(f / 16));
  return <AbsoluteFill style={{background: '#EFEBE3'}}>
    <div style={{position: 'absolute', left: 70, top: 250, fontSize: 50, fontWeight: 700, color: '#1c1c1c'}}>집지니 가양동 사무실 · 자재 고르기</div>
    <div style={{position: 'absolute', left: 70, right: 70, top: 360, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36}}>
      {chips.map(([c, s], k) => <div key={s} style={{height: 250, background: c, border: k <= pick ? '8px solid #1F5E2E' : '2px solid #bbb', position: 'relative', boxShadow: '0 8px 20px rgba(0,0,0,.12)'}}>
        <div style={{position: 'absolute', left: 16, bottom: 14, fontSize: 36, fontWeight: 700, color: k === 2 || k === 4 ? '#fff' : '#1c1c1c'}}>{s}</div>
        {k <= pick && <div style={{position: 'absolute', right: 14, top: 8, fontSize: 60, fontWeight: 700, color: '#1F5E2E'}}>✓</div>}</div>)}
    </div>
  </AbsoluteFill>;
};
const Talk: React.FC<{f: number}> = ({f}) => {
  const msgs: [string, boolean, number][] = [['철거해 보니 안방 창 아래 벽에\n곰팡이가 있습니다. 사진 보내 드려요.', false, 2], ['방수 처리를 해야 해서 18만 원이 추가됩니다.\n내역 보시고 동의 누르시면 진행할게요.', false, 30], ['아 그래서 드는 거군요. 동의할게요!', true, 62]];
  return <AbsoluteFill style={{background: '#B2C7D9'}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 250, background: '#A9BDCE', display: 'flex', alignItems: 'flex-end', padding: '0 50px 36px', fontSize: 48, fontWeight: 700, color: '#1c1c1c'}}>집지니 코디 <span style={{fontSize: 28, fontWeight: 400, marginLeft: 16, color: '#555'}}>이야기용 예시</span></div>
    <div style={{position: 'absolute', left: 44, right: 44, top: 300}}>
      {msgs.map(([s, me, a]) => f >= a ? <div key={s} style={{display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginTop: 34}}>
        <div style={{maxWidth: 800, background: me ? '#FEE500' : '#fff', color: '#1c1c1c', fontSize: 46, padding: '26px 34px', borderRadius: 30, lineHeight: 1.36, whiteSpace: 'pre-line'}}>{s}</div></div> : null)}
    </div>
  </AbsoluteFill>;
};
type Shot = {img: string; s: number; mark?: number[]; kind?: MarkKind};
const Screen: React.FC<{f: number; lf: number; a: Shot; punch?: number; quake?: boolean; markAt?: number}> = ({f, lf, a, punch = 1.035, quake, markAt = 10}) => {
  const y = a.mark ? (a.mark[1] + a.mark[3] / 2) * a.s : 720;
  return <AbsoluteFill style={{background: '#F3EFE6', transformOrigin: '540px 800px', transform: `${shake(f)}${quake ? hitShake(lf) : ''} scale(${punchZ(lf, punch)})`}}>
    <div style={{position: 'absolute', left: 0, top: Math.min(0, 720 - y), width: 1080}}>
      <Img src={staticFile(a.img)} style={{width: 1080, display: 'block'}} />
      {a.mark && <Mark kind={a.kind ?? 'circle'} x={a.mark[0] * a.s} y={a.mark[1] * a.s} w={a.mark[2] * a.s} h={a.mark[3] * a.s} t={lf - markAt} seed={a.mark[1]} />}
    </div>
  </AbsoluteFill>;
};
const SHOTS: Record<number, Shot> = {
  8: {img: 'tut/cost/08.jpg', s: 2.5},
  9: {img: 'tut/cad/06.jpg', s: 2.5},
  11: {img: 'proc/contract.jpg', s: 2.5, mark: [20, 1396, 392, 50], kind: 'underline'},
  13: {img: 'proc/build.jpg', s: 2.5, mark: [16, 1044, 110, 66], kind: 'circle'},
  14: {img: 'proc/build.jpg', s: 2.5, mark: [16, 3500, 130, 46], kind: 'box'},
  16: {img: 'proc/build.jpg', s: 2.5, mark: [16, 2700, 400, 120], kind: 'bracket'},
  18: {img: 'proc/movein.jpg', s: 2.5, mark: [16, 1069, 120, 66], kind: 'star'},
};

export const Story: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const cur = SC.reduce((a, s) => (f >= s.from ? s : a), SC[0]);
  const n = f >= ENDAT ? 0 : cur.n, lf = f - cur.from;
  const DROP = at(8) + 96;                              // 「평면도가 딱!」에서 경쾌한 곡이 들어온다
  const QUIET = at(12);                                 // 「포기할까」 앞에서 음악을 끊는다(절정 앞 정적)
  const TROUBLE = at(13), RELIEF = at(15);
  const tenseV = (x: number) => 0.2 * interpolate(x, [0, 10, QUIET - 10, QUIET], [0, 1, 1, 0], C) + 0.17 * interpolate(x, [TROUBLE, TROUBLE + 6, RELIEF - 8, RELIEF + 6], [0, 1, 1, 0], C);
  const upV = (x: number) => 0.17 * interpolate(x, [DROP, DROP + 2, TROUBLE - 10, TROUBLE], [0, 1.25, 1, 0], C) + 0.17 * interpolate(x, [RELIEF, RELIEF + 14, ENDAT, ENDAT + 20, STORY_LEN - 20, STORY_LEN], [0, 1, 1, 1.4, 1.4, 0], C);
  const beat = 1800 / BPM.up;
  const sounds: JSX.Element[] = [];
  SC.forEach((s) => { sounds.push(<Sequence key={'n' + s.n} from={s.from}><Audio src={staticFile(`sfx/n_${String(s.n).padStart(2, '0')}.wav`)} volume={1} /></Sequence>); if (s.say) sounds.push(snd(s.say, s.from + N[String(s.n)].dur - 4, 0.85)); });
  sounds.push(snd('thud', 6, 0.6), ...[0, 14, 28, 42, 56, 70].map((a) => snd('mk' + (1 + a % 3), at(2) + a + 8, 0.4)), snd('thud', at(3) + 22, 0.6), snd('mk2', at(4) + 20, 0.5),
    snd('drumroll', at(5) + 34 - 27, 0.4), snd('thud', at(5) + 34, 0.6), snd('sad', at(6) + 30, 0.4), snd('heart', at(12) + 4, 0.7),
    ...[0, 6, 12, 18, 24].map((a) => snd('key3', at(7) + a, 0.3)), snd('whoosh', at(8) - 2, 0.35), snd('thud', DROP, 0.75), snd('tada', DROP, 0.5),
    snd('mk1', at(9) + 16, 0.5), snd('tok', at(10) + 16, 0.45), snd('tok', at(10) + 48, 0.45), snd('tok', at(10) + 80, 0.45), snd('mk3', at(11) + 12, 0.5), snd('clap_small', at(11) + 70, 0.4),
    snd('timp', TROUBLE + 36 - 8, 0.6), snd('m_vine', at(14) + 6, 0.5), snd('tok', at(15) + 2, 0.5), snd('tok', at(15) + 30, 0.5), snd('tok', at(15) + 62, 0.5),
    snd('mk2', at(16) + 12, 0.5), snd('thud', at(17) + 30, 0.6), snd('tada', at(18) + 4, 0.45), snd('applause', at(18) + 20, 0.4), snd('whoosh', ENDAT - 2, 0.35), snd('thud', ENDAT + 8, 0.5));
  const dark = (ch: React.ReactNode) => <AbsoluteFill style={{background: '#2b2a27', transform: shake(f)}}>{ch}</AbsoluteFill>;
  let scene: React.ReactNode = null;
  if (n === 1) scene = dark(<Paper f={lf} markTotal={40} />);
  else if (n === 2) scene = <Legwork f={lf} />;
  else if (n === 3) scene = <AbsoluteFill style={{background: '#2b2a27', transform: `${shake(f)}${hitShake(lf - 22)}`}}><Paper f={lf} markTotal={22} zoom={interpolate(lf, [0, 10], [1, 1.12], C)} /></AbsoluteFill>;
  else if (n === 4) scene = dark(<Paper f={lf} hl={14} zoom={1.18} />);
  else if (n === 5) scene = <AbsoluteFill style={{background: '#1F5E2E', alignItems: 'center', justifyContent: 'center'}}><div style={{fontSize: 170, fontWeight: 700, color: '#fff', letterSpacing: -6, lineHeight: 1.1, transform: `scale(${punchZ(lf - 34, 1.1)})`}}>{lf < 34 ? '그래,' : '셀프로\n하자!'.split('\n').map((s) => <div key={s}>{s}</div>)}</div></AbsoluteFill>;
  else if (n === 6) scene = <SelfList f={lf} />;
  else if (n === 12) scene = <AbsoluteFill style={{background: '#000'}} />;
  else if (n === 7) scene = <Search f={lf} />;
  else if (n === 10) scene = <Showroom f={lf} />;
  else if (n === 15) scene = <Talk f={lf} />;
  else if (n === 17) scene = <AbsoluteFill style={{background: INK, justifyContent: 'center', padding: 90}}><div style={{fontSize: 240, fontWeight: 700, color: YEL, letterSpacing: -8, lineHeight: 1, transform: `scale(${punchZ(lf - 30, 1.08)})`, transformOrigin: 'left center'}}>13년</div><div style={{fontSize: 84, fontWeight: 700, color: '#fff', marginTop: 30}}>넘게 현장에서</div></AbsoluteFill>;
  else if (SHOTS[n]) scene = <Screen f={f} lf={n === 8 ? f - DROP : lf} a={SHOTS[n]} punch={n === 8 ? 1.07 : 1.035} quake={n === 13} markAt={n === 13 ? 40 : 10} />;
  const light = n === 2 || n === 6 || n === 7 || n === 10 || n === 15;
  const capTop = n === 5 || n === 17 || n === 12 || n === 1 || n === 3 || n === 4 ? 1340 : 1230;
  return <AbsoluteFill style={{background: '#141613', fontFamily: 'P', overflow: 'hidden'}}>
    <style>{css}</style>
    {scene}
    {n !== 0 && (SHOTS[n] || light) && <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 900, background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.55) 38%, rgba(0,0,0,.72))'}} />}
    {n !== 0 && <div style={{position: 'absolute', left: 60, right: 150, top: capTop}}><Cap text={N[String(n)].text} size={66} color={n === 12 || n === 18 ? YEL : '#fff'} /></div>}
    {n !== 0 && f < at(7) && <div style={{position: 'absolute', left: 60, top: 1570, fontSize: 28, color: '#fff', opacity: 0.8, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>고객 여정을 재구성한 이야기</div>}
    {SHOTS[n] && <div style={{position: 'absolute', left: 60, top: 1570, fontSize: 28, color: '#fff', opacity: 0.85, WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>집지니 실제 화면 · 예시 자료</div>}
    {n === 0 && <AbsoluteFill style={{background: INK}}>
      <div style={{position: 'absolute', left: 90, top: 700, display: 'flex', alignItems: 'center', gap: 34}}>
        <span style={{width: 190, height: 190, background: YEL, color: INK, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, fontWeight: 700}}>집</span>
        <div><div style={{fontSize: 170, fontWeight: 700, color: '#fff', letterSpacing: -5, lineHeight: 1}}>집지니</div><div style={{marginTop: 18, fontSize: 66, fontWeight: 700, color: LIME}}>jipjini.com</div></div></div>
    </AbsoluteFill>}
    <Audio src={staticFile('sfx/mood_tense.wav')} startFrom={90} volume={tenseV} loop />
    <Sequence from={DROP - Math.round(beat * 0.25)}><Audio src={staticFile('sfx/mood_up.wav')} startFrom={Math.round(beat * 4)} volume={(x) => upV(x + DROP - Math.round(beat * 0.25))} loop /></Sequence>
    {sounds}
  </AbsoluteFill>;
};
