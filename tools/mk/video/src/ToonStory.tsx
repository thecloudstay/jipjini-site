// 신혼부부 이야기 웹툰판 (2026-11-28 대표 「웹툰처럼, 부부 형식」 → 오픈 핍스 그림체 「마음에 들어」)
// 그림: 오픈 핍스·오픈 두들스(파블로 스탠리, CC0 — react-peeps / react-open-doodles), 배경·소품·말풍선은 직접 그림. 증거 장면은 집지니 실제 화면.
// 이야기 틀·나레이션·소리 규칙은 mk/research/2026-11-28-스토리보드-짜는-법.md, fx.ts
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, staticFile, Easing, OffthreadVideo} from 'remotion';
import Peep from 'react-peeps';
import {LayingDoodle} from 'react-open-doodles';
import {INK, useFonts, css} from './Maru';
import {Mark, MarkKind, Cap} from './Marks';
import {punchZ, hitShake, BPM} from './fx';
import NARR from './story_narr.json';

const YEL = '#FFD43B', LIME = '#8FD19E', LINE = '#1c1c1c', SKIN = '#FBE9D7';
const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const snd = (n: string, at: number, v = 0.7) => <Sequence key={n + at} from={Math.max(0, Math.round(at))}><Audio src={staticFile(`sfx/${n}.wav`)} volume={v * 0.7} /></Sequence>;
const ORDER: [number, number, string?][] = [[1, 2], [2, 2], [3, 9, 'k_eolma'], [4, 8, 'm_bruh'], [5, 9, 'k_gabojago'], [6, 8, 'k_manghaetda'], [12, 14],
  [7, 2], [8, 9, 'k_ige_doene'], [9, 2], [10, 2], [11, 3], [13, 7, 'k_heok'], [14, 2], [15, 8, 'k_saratda'], [16, 2], [17, 4], [18, 6]];
const N = NARR as Record<string, {dur: number; text: string}>;
const SC: {n: number; from: number; dur: number; say?: string}[] = [];
let t0 = 0;
for (const [n, gap, say] of ORDER) { const d = N[String(n)].dur; SC.push({n, from: t0, dur: d + gap, say}); t0 += d + gap; }
const ENDAT = t0;
export const TOON_LEN = ENDAT + 72;
const at = (n: number) => SC.find((s) => s.n === n)!.from;

// 등장인물
const WIFE = {hair: 'MediumBangsFilled', accessory: 'None', facialHair: 'None'};
const HUS = {hair: 'ShortVolumed', accessory: 'GlassRound', facialHair: 'None'};
const SELLER = {hair: 'Pomp', accessory: 'SunglassWayfarer', facialHair: 'MoustacheThin'};
const CODI = {hair: 'Bun', accessory: 'None', facialHair: 'None'};
const PRO = {hair: 'ShavedSides', accessory: 'None', facialHair: 'FullMedium'};
type PP = {who: any; body: string; face: string; x: number; y: number; w: number; flip?: boolean; pose?: 'bust' | 'full'; bob?: number; f?: number};
const P: React.FC<PP> = ({who, body, face, x, y, w, flip, pose = 'bust', bob = 0, f = 0}) =>
  <div style={{position: 'absolute', left: x, top: y + (bob ? Math.sin(f / 3.2) * bob : 0), width: w, transform: flip ? 'scale(-1,1)' : undefined}}>
    <Peep style={{width: w, height: pose === 'bust' ? w * 1.15 : w * 1.5, overflow: 'visible'}} accessory={who.accessory} facialHair={who.facialHair} body={body as any} face={face as any} hair={who.hair} strokeColor={LINE} backgroundColor={SKIN}
      viewBox={pose === 'bust' ? {x: '0', y: '0', width: '850', height: '1200'} : undefined as any} />
  </div>;
const Bubble: React.FC<{text: string; x: number; y: number; f: number; at?: number; tail?: 'l' | 'r'; size?: number; shout?: boolean}> = ({text, x, y, f, at: a = 6, tail = 'l', size = 52, shout}) => {
  if (f < a) return null;
  const k = interpolate(f - a, [0, 4], [0.7, 1], {...C, easing: Easing.out(Easing.back(2))});
  return <div style={{position: 'absolute', left: x, top: y, transform: `scale(${k}) rotate(${shout ? -3 : 0}deg)`, transformOrigin: tail === 'l' ? '20% 100%' : '80% 100%'}}>
    <div style={{background: shout ? YEL : '#fff', border: `6px solid ${LINE}`, borderRadius: 44, padding: '14px 34px', fontSize: size, fontWeight: 700, color: LINE, whiteSpace: 'pre-line', lineHeight: 1.25, textAlign: 'center'}}>{text}</div>
    <svg width={60} height={40} style={{position: 'absolute', bottom: -32, left: tail === 'l' ? 60 : undefined, right: tail === 'r' ? 60 : undefined}}><path d={tail === 'l' ? 'M4 0 L10 36 L48 0' : 'M56 0 L50 36 L12 0'} fill={shout ? YEL : '#fff'} stroke={LINE} strokeWidth={6} strokeLinejoin="round" /><path d="M2 0 L58 0" stroke={shout ? YEL : '#fff'} strokeWidth={8} /></svg>
  </div>;
};
const PW = 1020, PH = 900, PX = 30, PY = 250;
const Panel: React.FC<{bg: string; f: number; lf: number; quake?: number; children: React.ReactNode}> = ({bg, f, lf, quake = -1, children}) =>
  <div style={{position: 'absolute', left: PX, top: PY, width: PW, height: PH, background: bg, border: `8px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', boxSizing: 'border-box',
    transform: `scale(${interpolate(lf, [0, 3], [0.96, 1], C)})${quake >= 0 ? hitShake(lf - quake) : ''}`}}>
    <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 60%', transform: `scale(${1 + Math.min(lf, 200) * 0.00035})`}}>{children}</div>
  </div>;
const Burst: React.FC<{c1: string; c2: string}> = ({c1, c2}) =>
  <svg width={PW} height={PH} style={{position: 'absolute', left: 0, top: 0}}><rect width={PW} height={PH} fill={c1} />{Array.from({length: 14}, (_, k) => { const a = k / 14 * Math.PI * 2, b = (k + 0.5) / 14 * Math.PI * 2; return <path key={k} d={`M510 480 L${510 + Math.cos(a) * 1200} ${480 + Math.sin(a) * 1200} L${510 + Math.cos(b) * 1200} ${480 + Math.sin(b) * 1200} Z`} fill={c2} />; })}</svg>;
const Sheet: React.FC<{x: number; y: number; rot?: number; s?: number; hl?: boolean; total?: boolean}> = ({x, y, rot = -5, s = 1, hl, total}) =>
  <div style={{position: 'absolute', left: x, top: y, width: 420, transform: `rotate(${rot}deg) scale(${s})`, transformOrigin: '0 0', background: '#FBFAF6', border: `5px solid ${LINE}`, padding: '18px 22px', color: LINE, boxShadow: '10px 12px 0 rgba(0,0,0,.18)'}}>
    <div style={{fontSize: 34, fontWeight: 700, textAlign: 'center', letterSpacing: 6, borderBottom: `3px solid ${LINE}`, paddingBottom: 8}}>견 적 서</div>
    {[['철거·설비', '620만'], ['주방 일식', '1,200만'], ['욕실 일식', '1,600만'], ['기타 일식', '900만']].map(([a, b]) => <div key={a} style={{display: 'flex', justifyContent: 'space-between', fontSize: 28, padding: '9px 2px', borderBottom: '1px solid #cfcabd'}}>
      <span>{a.replace('일식', '')}{a.includes('일식') && <b style={{background: hl ? YEL : 'transparent', padding: '0 4px'}}>일식</b>}</span><span>{b}</span></div>)}
    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 36, fontWeight: 700, paddingTop: 12, color: total ? '#D9342B' : LINE}}><span>합계</span><span>6,800만 원</span></div>
    <div style={{fontSize: 18, color: '#888', textAlign: 'right'}}>이야기용 예시</div>
  </div>;
type Shot = {img: string; s: number; mark?: number[]; kind?: MarkKind};
const Proof: React.FC<{a: Shot; lf: number}> = ({a, lf}) => {
  const k = PW / 1080, y = a.mark ? (a.mark[1] + a.mark[3] / 2) * a.s : 760;
  return <div style={{position: 'absolute', left: 0, top: Math.min(0, 330 - y * k), width: PW}}>
    <div style={{width: 1080, transformOrigin: '0 0', transform: `scale(${k})`, position: 'relative'}}><Img src={staticFile(a.img)} style={{width: 1080, display: 'block'}} />
      {a.mark && <Mark kind={a.kind ?? 'circle'} x={a.mark[0] * a.s} y={a.mark[1] * a.s} w={a.mark[2] * a.s} h={a.mark[3] * a.s} t={lf - 12} seed={a.mark[1]} />}</div>
  </div>;
};
const Sticker: React.FC<PP & {bg?: string}> = ({bg = '#fff', ...p}) =>
  <div style={{position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.w, borderRadius: '50%', background: bg, border: `7px solid ${LINE}`, overflow: 'hidden', boxShadow: '8px 10px 0 rgba(0,0,0,.2)'}}><P {...p} x={-p.w * 0.12} y={p.w * 0.05} w={p.w * 1.25} /></div>;
const SHOTS: Record<number, Shot> = {
  8: {img: 'tut/cost/08.jpg', s: 2.5}, 9: {img: 'tut/cad/06.jpg', s: 2.5},
  11: {img: 'proc/contract.jpg', s: 2.5, mark: [20, 1396, 392, 50], kind: 'underline'},
  14: {img: 'proc/build.jpg', s: 2.5, mark: [16, 3500, 130, 46], kind: 'box'},
  16: {img: 'proc/build.jpg', s: 2.5, mark: [16, 2700, 400, 120], kind: 'bracket'},
};

export const ToonStory: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const cur = SC.reduce((a, s) => (f >= s.from ? s : a), SC[0]);
  const n = f >= ENDAT ? 0 : cur.n, lf = f - cur.from;
  const DROP = at(8) + 96, QUIET = at(12), TROUBLE = at(13), RELIEF = at(15);
  const tenseV = (x: number) => 0.2 * interpolate(x, [0, 10, QUIET - 10, QUIET], [0, 1, 1, 0], C) + 0.17 * interpolate(x, [TROUBLE, TROUBLE + 6, RELIEF - 8, RELIEF + 6], [0, 1, 1, 0], C);
  const upV = (x: number) => 0.17 * interpolate(x, [DROP, DROP + 2, TROUBLE - 10, TROUBLE], [0, 1.25, 1, 0], C) + 0.17 * interpolate(x, [RELIEF, RELIEF + 14, ENDAT, ENDAT + 20, TOON_LEN - 20, TOON_LEN], [0, 1, 1, 1.4, 1.4, 0], C);
  const beat = 1800 / BPM.up;
  const sounds: JSX.Element[] = [];
  SC.forEach((s) => { sounds.push(<Sequence key={'n' + s.n} from={s.from}><Audio src={staticFile(`sfx/n_${String(s.n).padStart(2, '0')}.wav`)} volume={1} /></Sequence>); if (s.say) sounds.push(snd(s.say, s.from + N[String(s.n)].dur - 4, 0.85)); sounds.push(snd('tok', s.from, 0.35)); });
  sounds.push(snd('thud', at(3) + 20, 0.6), snd('mk2', at(4) + 20, 0.5), snd('drumroll', at(5) + 34 - 27, 0.4), snd('thud', at(5) + 34, 0.6), snd('sad', at(6) + 30, 0.4), snd('heart', at(12) + 4, 0.7),
    ...[0, 6, 12, 18, 24].map((a) => snd('key3', at(7) + a, 0.3)), snd('thud', DROP, 0.75), snd('tada', DROP, 0.5), snd('mk1', at(9) + 16, 0.5), snd('mk3', at(11) + 14, 0.5), snd('clap_small', at(11) + 70, 0.4),
    snd('timp', TROUBLE + 30 - 8, 0.6), snd('m_vine', at(14) + 6, 0.5), snd('tok', at(15) + 30, 0.5), snd('tok', at(15) + 62, 0.5), snd('mk2', at(16) + 14, 0.5), snd('thud', at(17) + 30, 0.6),
    snd('tada', at(18) + 4, 0.45), snd('applause', at(18) + 20, 0.4), snd('whoosh', ENDAT - 2, 0.35), snd('thud', ENDAT + 8, 0.5));
  const q = {f: lf};
  let panel: React.ReactNode = null;
  if (n === 1) panel = <Panel bg="#FFE1C4" f={f} lf={lf}><Sheet x={560} y={60} rot={7} total />
    <P who={WIFE} body="Paper" face="Concerned" x={40} y={300} w={560} bob={3} {...q} /><P who={HUS} body="Hoodie" face="ConcernedFear" x={470} y={330} w={520} flip />
    <Bubble text={'나 진짜\n울 것 같아…'} x={60} y={60} f={lf} at={14} /></Panel>;
  else if (n === 2) panel = <Panel bg="#CFE8F5" f={f} lf={lf}>
    <svg width={PW} height={PH} style={{position: 'absolute'}}><rect y={640} width={PW} height={260} fill="#D8D2C4" /><path d={`M0 640 L${PW} 640`} stroke={LINE} strokeWidth={6} />
      {[0, 1, 2, 3].map((k) => <g key={k} transform={`translate(${k * 262 - (lf * 2.2) % 262},0)`} stroke={LINE} strokeWidth={6} strokeLinejoin="round"><rect x={20} y={300} width={220} height={340} fill={['#fff', '#FCEFD2', '#E9F4E4', '#F9E4EA'][k]} /><path d="M10 300 L250 300 L230 370 L30 370 Z" fill={['#E8743B', '#3B7A57', '#3F6FB5', '#C0392B'][k]} /><rect x={70} y={430} width={120} height={210} fill="#BFD9E6" /></g>)}</svg>
    <P who={WIFE} body="WalkingBW" face="Tired" x={160} y={150} w={430} pose="full" bob={6} {...q} /><P who={HUS} body="WalkingWB" face="Hectic" x={470} y={130} w={450} pose="full" bob={6} f={lf + 5} />
    <Bubble text="다음 집 또 가 보자…" x={470} y={40} f={lf} at={20} tail="r" /></Panel>;
  else if (n === 3) panel = <Panel bg="#FFD43B" f={f} lf={lf} quake={20}><Burst c1="#FFD43B" c2="#FFE98A" />
    <P who={WIFE} body="Paper" face="Fear" x={30} y={320} w={540} /><P who={HUS} body="Hoodie" face="Hectic" x={470} y={330} w={520} flip />
    {lf >= 20 && <div style={{position: 'absolute', left: 250, top: 40, fontSize: 150, fontWeight: 700, color: '#D9342B', WebkitTextStroke: `10px ${LINE}`, paintOrder: 'stroke fill', transform: `rotate(-6deg) scale(${punchZ(lf - 20, 1.12)})`, letterSpacing: -6}}>6,800만?!</div>}</Panel>;
  else if (n === 4) panel = <Panel bg="#CFC6DA" f={f} lf={lf}><Sheet x={40} y={470} rot={-8} s={0.86} hl />
    <P who={SELLER} body="BlazerBlackTee" face="Cheeky" x={-10} y={40} w={500} bob={2} {...q} /><P who={WIFE} body="ArmsCrossed" face="Suspicious" x={430} y={370} w={420} flip /><P who={HUS} body="Whatever" face="Contempt" x={640} y={340} w={420} flip />
    <Bubble text={'일단 계약부터\n하시죠~'} x={420} y={50} f={lf} at={12} /></Panel>;
  else if (n === 5) panel = <Panel bg="#FF8A3D" f={f} lf={lf} quake={34}><Burst c1="#FF8A3D" c2="#FFB25E" />
    <P who={WIFE} body="PointingUp" face="Driven" x={60} y={320} w={540} bob={4} {...q} /><P who={HUS} body="Explaining" face="Rage" x={480} y={330} w={520} flip bob={4} f={lf + 4} />
    <Bubble text="그래, 셀프로 하자!" x={210} y={70} f={lf} at={34} size={64} shout /></Panel>;
  else if (n === 6) panel = <Panel bg="#26324A" f={f} lf={lf}>
    <div style={{position: 'absolute', left: 40, top: 40 - lf * 5, fontSize: 60, fontWeight: 700, color: '#51618a', lineHeight: 1.5}}>{['철거', '설비·배관', '전기', '목공', '타일', '방수', '도배', '바닥', '필름', '주방', '욕실', '조명', '폐기물', '자재 발주', '기사님 섭외', '일정 조율', '입주 청소'].map((s) => <div key={s}>□ {s}</div>)}</div>
    <P who={WIFE} body="CrossedLegs" face="Tired" x={330} y={170} w={380} pose="full" /><P who={HUS} body="MediumBW" face="EyesClosed" x={620} y={150} w={400} pose="full" flip />
    <Bubble text="…이걸 언제 다 해" x={470} y={50} f={lf} at={16} tail="r" /></Panel>;
  else if (n === 12) panel = <Panel bg="#101010" f={f} lf={lf}><div style={{position: 'absolute', left: 160, top: 250, width: 700, opacity: 0.55}}><LayingDoodle ink="#d8d8d8" accent="#444" /></div></Panel>;
  else if (n === 7) panel = <Panel bg="#F4F1E8" f={f} lf={lf}>
    <div style={{position: 'absolute', left: 60, right: 60, top: 60, height: 110, border: '6px solid #1F5E2E', borderRadius: 55, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 40px', fontSize: 50, color: LINE}}>{'인테리어 견적 비교'.slice(0, Math.floor(lf / 3))}<span style={{opacity: lf % 16 < 8 ? 1 : 0}}>|</span></div>
    {lf >= 34 && <div style={{position: 'absolute', left: 80, top: 200}}><div style={{fontSize: 60, fontWeight: 700, color: '#1F5E2E'}}>집지니</div><div style={{fontSize: 34, color: '#555'}}>jipjini.com · 아파트 이름으로 도면·공사비</div></div>}
    <P who={WIFE} body="Device" face="Awe" x={80} y={360} w={520} bob={2} {...q} /><P who={HUS} body="Coffee" face="Calm" x={500} y={380} w={480} flip /></Panel>;
  else if (n === 10) panel = <Panel bg="#EFEBE3" f={f} lf={lf}>
    <Sequence from={cur.from} layout="none"><OffthreadVideo src={staticFile('toon/office.mp4')} muted style={{position: 'absolute', left: 0, top: 0, width: PW, height: PH, objectFit: 'cover'}} /></Sequence>
    <div style={{position: 'absolute', left: 16, top: 12, fontSize: 28, color: '#fff', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>집지니 가양동 사무실 · 실제 영상</div>
    <Sticker who={WIFE} body="Sweater" face="Awe" x={30} y={560} w={310} bg="#FFF6E0" />
    <Sticker who={HUS} body="Hoodie" face="Smile" x={680} y={560} w={310} flip bg="#E6F0FF" /></Panel>;
  else if (n === 13) panel = <Panel bg="#5A2A2A" f={f} lf={lf} quake={30}>
    <svg width={PW} height={PH} style={{position: 'absolute'}}><rect width={PW} height={520} fill="#D9D2C2" /><path d="M0 520 L1020 520" stroke={LINE} strokeWidth={6} /><path d="M520 60 L960 40 L990 470 L560 500 Z" fill="#B9B09C" stroke={LINE} strokeWidth={6} strokeLinejoin="round" />
      {lf >= 30 && <g fill="#2f3a2d">{[[640, 200, 60], [720, 260, 80], [800, 180, 50], [760, 360, 70], [880, 300, 60], [680, 380, 45]].map(([x, y, r], k) => <circle key={k} cx={x} cy={y} r={r * punchZ(lf - 30, 1.1)} opacity={0.85} />)}</g>}</svg>
    <P who={WIFE} body="PointingUp" face="Fear" x={40} y={360} w={470} /><P who={HUS} body="Hoodie" face="Hectic" x={400} y={380} w={450} flip />
    <Bubble text="곰팡이?!" x={80} y={90} f={lf} at={34} size={70} shout /></Panel>;
  else if (n === 15) panel = <Panel bg="#B2C7D9" f={f} lf={lf}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 100, background: '#A9BDCE', display: 'flex', alignItems: 'center', padding: '0 34px', fontSize: 40, fontWeight: 700, color: LINE}}>집지니 코디 <span style={{fontSize: 24, fontWeight: 400, marginLeft: 14, color: '#555'}}>이야기용 예시</span></div>
    {([['철거해 보니 안방 창 아래 벽에\n곰팡이가 있습니다. 사진 보내 드려요.', 2], ['방수 처리를 해야 해서 18만 원이\n추가됩니다. 동의 누르시면 진행할게요.', 30]] as [string, number][]).map(([s, a], k) => lf >= a ? <div key={k} style={{position: 'absolute', left: 30, top: 130 + k * 190, maxWidth: 760, background: '#fff', color: LINE, fontSize: 40, padding: '22px 30px', borderRadius: 28, lineHeight: 1.35, whiteSpace: 'pre-line'}}>{s}</div> : null)}
    <Sticker who={WIFE} body="Sweater" face={lf < 50 ? 'Concerned' : 'Smile'} x={660} y={530} w={330} bg="#FFF6E0" /></Panel>;
  else if (n === 17) panel = <Panel bg={INK} f={f} lf={lf}>
    <div style={{position: 'absolute', left: 50, top: 60, fontSize: 250, fontWeight: 700, color: YEL, letterSpacing: -8, lineHeight: 1, transform: `scale(${punchZ(lf - 30, 1.08)})`, transformOrigin: 'left center'}}>13년</div>
    <div style={{position: 'absolute', left: 60, top: 330, fontSize: 60, fontWeight: 700, color: '#fff'}}>고심해서 만든 프로그램</div>
    <P who={WIFE} body="Sweater" face="Awe" x={470} y={370} w={520} /></Panel>;
  else if (n === 18) panel = <Panel bg="#FBEBD0" f={f} lf={lf}>
    <svg width={PW} height={PH} style={{position: 'absolute'}}><rect y={620} width={PW} height={280} fill="#D9B48A" /><path d="M0 620 L1020 620" stroke={LINE} strokeWidth={6} /><rect x={60} y={70} width={330} height={380} fill="#CFEAF7" stroke={LINE} strokeWidth={6} /><path d="M225 70 L225 450 M60 260 L390 260" stroke={LINE} strokeWidth={6} /><circle cx={150} cy={160} r={44} fill="#FFE27A" /><path d="M60 70 L390 70 L620 620 L130 620 Z" fill="#FFF7C2" opacity={0.5} />
      <rect x={720} y={120} width={220} height={150} fill="#fff" stroke={LINE} strokeWidth={6} /><path d="M745 245 L800 190 L845 222 L890 176 L915 245 Z" fill={LIME} stroke={LINE} strokeWidth={4} strokeLinejoin="round" /></svg>
    <P who={WIFE} body="Sweater" face="LoveGrinTeeth" x={120} y={360} w={500} bob={4} {...q} /><P who={HUS} body="Hoodie" face="SmileBig" x={470} y={350} w={500} flip bob={4} f={lf + 5} />
    <Bubble text="우리 집이다!" x={430} y={90} f={lf} at={10} size={62} shout tail="r" /></Panel>;
  else if (SHOTS[n]) { const lff = n === 8 ? f - DROP + 30 : lf; panel = <Panel bg="#F3EFE6" f={f} lf={lf} quake={n === 14 ? 6 : -1}><Proof a={SHOTS[n]} lf={lff} />
    <Sticker who={WIFE} body={n === 9 ? 'PointingUp' : n === 11 ? 'Device' : 'Sweater'} face={n === 8 ? 'Awe' : n === 9 ? 'Cheeky' : n === 11 ? 'SmileBig' : n === 14 ? 'Suspicious' : 'SmileLol'} x={30} y={560} w={310} bg={n === 14 ? '#F4D6D0' : '#FFF6E0'} />
    {n !== 11 && <Sticker who={HUS} body={n === 16 ? 'Coffee' : 'Hoodie'} face={n === 8 ? 'SmileBig' : n === 14 ? 'Concerned' : n === 16 ? 'Calm' : 'Smile'} x={680} y={560} w={310} flip bg={n === 14 ? '#F4D6D0' : '#E6F0FF'} />}
    {n === 8 && <Bubble text="어? 우리 집이네?!" x={300} y={440} f={f - DROP + 8} at={8} size={54} shout />}
    <div style={{position: 'absolute', right: 14, top: 10, fontSize: 24, color: '#fff', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>집지니 실제 화면 · 예시 자료</div></Panel>; }
  return <AbsoluteFill style={{background: '#FFF9EE', fontFamily: 'P', overflow: 'hidden'}}>
    <style>{css}</style>
    {n !== 0 && <>
      <div style={{position: 'absolute', left: 40, top: 150, fontSize: 40, fontWeight: 700, color: LINE}}>신혼집 인테리어 분투기</div>
      <div style={{position: 'absolute', right: 150, top: 160, fontSize: 26, color: '#8a8275'}}>고객 여정을 재구성한 이야기</div>
      {panel}
      <div style={{position: 'absolute', left: 50, right: 150, top: 1200, minHeight: 210, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: 62, fontWeight: 700, color: n === 12 || n === 18 ? '#C2410C' : LINE, lineHeight: 1.32, textAlign: 'center', whiteSpace: 'pre-line', letterSpacing: -1}}>{N[String(n)].text}</div></div>
    </>}
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
