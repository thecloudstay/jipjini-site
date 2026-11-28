// 1화 「옆집은 얼마 줬대?」 — 우리 집 공사비 보기
// 틀: ../Toon.tsx (끝 화면 큰 로고·jipjini.com 포함). 조사: mk/research/2026-11-28-스토리보드-짜는-법.md, mk/research/2026-11-28-효과-쓰는-법.md
// 스토리보드: ①갈고리(옆집 올수리, 물어볼 수 없는 값) → ②갈등(업체는 가 봐야 안다) → ③전환(아파트 이름 검색) → ④증거(우리 집 평면도) → ⑤증거(공사비 2,800만 원) → ⑥보상(턴키 추정보다 1,200만 원 적게) → ⑦끝 문장(기준이 생겼다)
// 숫자 근거: 사이트 실제 화면(래미안위브 111A · 전용 85㎡ 예시). 턴키 금액은 화면 표기대로 「추정」.
import React from 'react';
import {Ep, ProofCut, Duo} from '../Toon';
import {Panel, P, Bubble, Burst, WIFE, HUS, SELLER, YEL, LINE, PW} from '../ToonKit';
import {INK} from '../Maru';
import {punchZ} from '../fx';
import narr from './t1_narr.json';

const EX = '집지니 실제 화면 · 래미안위브 111A 예시';
export const ep1: Ep = {id: 'ep1', series: '신혼집 인테리어 분투기 · 1화', tag: '이야기로 보는 사용법', pre: 't1_', narr, turn: 3, cuts: [
  {gap: 4, say: 'k_eolma', render: (lf, f) => <Panel bg="#FFE1C4" f={f} lf={lf}>
    <svg width={PW} height={900} style={{position: 'absolute'}}><rect x={640} y={50} width={330} height={250} fill="#fff" stroke={LINE} strokeWidth={6} /><path d="M640 175 L970 175 M805 50 L805 300" stroke={LINE} strokeWidth={6} />
      {lf > 20 && <g fill="none" stroke={LINE} strokeWidth={6} strokeLinecap="round"><path d="M700 110 l40 -30 M860 120 l50 -20 M720 240 l30 30" /></g>}</svg>
    <Duo wife={lf < 80 ? 'Suspicious' : 'Concerned'} hus="Concerned" lf={lf} />
    <Bubble text={'옆집 올수리했대!\n얼마 줬을까?'} x={40} y={110} f={lf} at={8} size={52} />
    <Bubble text="물어보긴 좀…" x={560} y={330} f={lf} at={86} size={46} tail="r" /></Panel>},
  {gap: 6, say: 'm_bruh', render: (lf, f) => <Panel bg="#E3DDF2" f={f} lf={lf}>
    <P who={SELLER} body="BlazerBlackTee" face="Cheeky" x={-10} y={300} w={560} bob={2} f={lf} />
    <P who={WIFE} body="Sweater" face="Contempt" x={520} y={420} w={420} flip />
    <Bubble text={'가 봐야 알죠~\n일단 방문부터!'} x={330} y={90} f={lf} at={8} size={54} /></Panel>},
  {gap: 4, tag: EX, sfx: [['key3', 4, 0.3], ['key3', 12, 0.3], ['key3', 20, 0.3]], render: (lf, f) => <Panel bg="#F3EFE6" f={f} lf={lf}>
    <ProofCut a={{img: 'tut/cost/05.jpg', s: 2.5, mark: [27, 448, 378, 50], kind: 'box'}} lf={lf} wife="Driven" hus="Calm" say="아파트 이름만 쳤는데" sayAt={40} /></Panel>},
  {gap: 6, tag: EX, say: 'k_ige_doene', sfx: [['tada', 2, 0.45]], render: (lf, f) => <Panel bg="#F3EFE6" f={f} lf={lf}>
    <ProofCut a={{img: 'tut/cost/08.jpg', s: 2.5}} zoom={0.62} lf={lf} wife="SmileBig" hus="SmileTeeth" say="어? 우리 집이네?!" sayAt={10} /></Panel>},
  {gap: 6, tag: EX, sfx: [['mk1', 16, 0.5]], render: (lf, f) => <Panel bg="#F3EFE6" f={f} lf={lf}>
    <ProofCut a={{img: 'tut/cost/09.jpg', s: 2.5, mark: [14, 62, 160, 42], kind: 'circle'}} lf={lf} wife="SmileTeeth" hus="Smile" /></Panel>},
  {gap: 8, say: 'k_saratda', accent: true, tag: '래미안위브 111A · 전용 85㎡ 예시', sfx: [['drumroll', 3, 0.4], ['thud', 30, 0.65]], render: (lf, f) => <Panel bg={INK} f={f} lf={lf}>
    <div style={{position: 'absolute', left: 50, top: 70, fontSize: 56, fontWeight: 700, color: '#fff'}}>턴키 추정보다</div>
    {lf >= 30 && <div style={{position: 'absolute', left: 46, top: 150, fontSize: 190, fontWeight: 700, color: YEL, letterSpacing: -8, lineHeight: 1.1, transform: `scale(${punchZ(lf - 30, 1.08)})`, transformOrigin: 'left center'}}>1,200<span style={{fontSize: 90}}>만 원</span></div>}
    {lf >= 44 && <div style={{position: 'absolute', left: 54, top: 380, fontSize: 62, fontWeight: 700, color: '#fff'}}>적게</div>}
    <P who={WIFE} body="Sweater" face="LoveGrinTeeth" x={480} y={400} w={500} bob={3} f={lf} /></Panel>},
  {gap: 10, sfx: [['applause', 20, 0.35]], render: (lf, f) => <Panel bg="#FBEBD0" f={f} lf={lf}><Burst c1="#FBEBD0" c2="#FFE08A" />
    <Duo wife="SmileBig" hus="SmileBig" lf={lf} bob={4} />
    <Bubble text={'이제 견적서가\n무섭지 않다!'} x={300} y={90} f={lf} at={10} size={56} shout /></Panel>},
]};
