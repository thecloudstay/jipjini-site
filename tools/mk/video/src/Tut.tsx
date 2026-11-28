// 집지니 사이트 사용법 영상 틀 (2026-11-28 대표 「사이트 들어가서 사용법도 올리자 — 튜토리얼」)
// v2 (대표 「왜 다 똑같은 폼?」): 편마다 갈고리 형식·바탕색·자막 모양·배경음이 다름 → src/tut/fmt.ts
// 공통: 누를 곳 확대·손가락 표시 → 결과에서 멈춤 → 큰 로고 + jipjini.com
import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, useCurrentFrame, staticFile, Easing} from 'remotion';
import {INK, useFonts, css} from './Maru';
import {Fmt} from './tut/fmt';
import {Mark, MARK_ORDER, Cap, shake} from './Marks';
import {PAL, PEAK, MEME, HOOK_LINE, pick, moodOf, musicStart, musicVol, punchZ, hitShake} from './fx';

// 같은 곡을 쓰는 편은 곡의 다른 구간에서 시작한다(마디 수)
const EXTRA_BARS: Record<string, number> = {kitchen: 4, acb: 4, auction: 3, disaster: 4};
const GREEN = '#1F5E2E', LIME = '#8FD19E', YEL = '#FFD43B';
const S = 2.5;            // 화면 사진 배율(432×768 → 1080×1920)
const ZIN = 14, END = 105;
const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Fr = {img: string; kind: 'tap' | 'type' | 'shot'; cap: string | null; step: number | null; focus: number[] | null; tapAt: number[] | null; hold: number; result: boolean};
export type TutData = {id: string; title: string; hook: string; end: string; frames: Fr[]; fmt: Fmt};

const len = (f: Fr, m: Fmt) => f.kind === 'type' ? 8 : Math.round((f.result && m.resultHold ? m.resultHold : f.hold) * 30);
export const tutLength = (d: TutData) => d.fmt.hook + d.frames.reduce((a, f) => a + len(f, d.fmt), 0) + END;

const cam = (f: Fr) => {
  if (!f.focus) return {z: 1, cx: 540, cy: 960};
  const [x, y, w, h] = f.focus.map((v) => v * S);
  let z = Math.min(1000 / w, 1350 / Math.max(h, 1), 1.45);
  z = Math.max(1, z);
  const hw = 540 / z, hh = 960 / z;
  const cx = Math.min(Math.max(x + w / 2, hw), 1080 - hw);
  const cy = Math.min(Math.max(y + h / 2 + 220 / z, hh), 1920 - hh);   // 자막(아래 가운데) 위쪽에 보이게
  return {z, cx, cy};
};
const pop = (f: number, at: number, _k = 1.8) => interpolate(f - at, [0, 5], [0, 1], {...C, easing: Easing.out(Easing.cubic)});   // 튀지 않게(v3)
const fade = (f: number, at: number, d = 6) => interpolate(f - at, [0, d], [0, 1], C);
const snd = (name: string, at: number, v = 0.7, key = name + at) => <Sequence key={key} from={Math.max(0, Math.round(at))}><Audio src={staticFile(`sfx/${name}.wav`)} volume={v * 0.7} /></Sequence>;

const Logo: React.FC<{at: number; fg: string; light: boolean}> = ({at, fg, light}) => {
  const f = useCurrentFrame();
  const k = interpolate(f - at, [0, 8], [0.6, 1], {...C, easing: Easing.out(Easing.back(2))});
  return <div style={{display: 'flex', alignItems: 'center', gap: 34, transform: `scale(${k})`, transformOrigin: 'left center', opacity: f >= at ? 1 : 0}}>
    <span style={{width: 190, height: 190, background: light ? GREEN : YEL, color: light ? '#fff' : INK, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 120, fontWeight: 700}}>집</span>
    <div><div style={{fontSize: 170, fontWeight: 700, color: fg, letterSpacing: -5, lineHeight: 1}}>집지니</div>
      <div style={{marginTop: 18, fontSize: 66, fontWeight: 700, color: light ? GREEN : LIME}}>jipjini.com</div></div></div>;
};

// 큰 글자 줄들(위에서 튀어 들어옴)
const Lines: React.FC<{f: number; at: number; lines: string[]; size: number; color: string; last?: string; gap?: number}> = ({f, at, lines, size, color, last, gap = 6}) => <>
  {lines.map((l, k) => <div key={k} style={{fontSize: size, fontWeight: 700, color: last && k === lines.length - 1 ? last : color, letterSpacing: -size / 32, lineHeight: 1.16,
    transform: `translateY(${(1 - pop(f, at + k * gap)) * 60}px)`, opacity: fade(f, at + k * gap)}}>{l}</div>)}
</>;

// ── 갈고리 9가지 ──
const Hook: React.FC<{d: TutData; f: number; bgImg: string}> = ({d, f, bgImg}) => {
  const m = d.fmt, H = m.hook;
  const label = <div style={{fontSize: 46, color: m.acc, fontWeight: 700, marginBottom: 30, opacity: fade(f, 0)}}>집지니 사용법 · {d.title}</div>;
  const dim = (b = 0.22) => <Img src={staticFile(bgImg)} style={{position: 'absolute', width: 1080, height: 1920, filter: `brightness(${b}) blur(8px)`, transform: `scale(${1.05 + f * 0.001})`}} />;
  const box = (top: number, kids: React.ReactNode) => <div style={{position: 'absolute', left: 90, right: 90, top}}>{kids}</div>;
  switch (m.kind) {
    case 'count': {
      const p = interpolate(f, [8, 50], [0, 1], {...C, easing: Easing.out(Easing.cubic)});
      const n = Math.round(2800 * p).toLocaleString('ko-KR');
      const land = pop(f, 50, 3);
      return <AbsoluteFill>{dim(0.1)}{box(520, <>{label}
        <div style={{fontSize: 60, color: '#fff', fontWeight: 700, opacity: fade(f, 0)}}>우리 집 올수리 공사비</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16, transform: `scale(${1 + land * 0.06 - (f > 58 ? 0.06 : 0)})`, transformOrigin: 'left bottom'}}>
          <span style={{fontSize: 250, fontWeight: 700, color: m.acc, letterSpacing: -10, fontVariantNumeric: 'tabular-nums'}}>{n}</span>
          <span style={{fontSize: 100, fontWeight: 700, color: m.acc}}>만 원</span></div>
        <div style={{marginTop: 30}}><Lines f={f} at={58} lines={['아파트 검색 한 번으로 나왔어요', '턴키보다 1,200만 원 적게']} size={62} color="#fff" last={LIME} gap={10} /></div></>)}
      </AbsoluteFill>;
    }
    case 'taps': {
      const ring = (f % 30) / 30;
      return <AbsoluteFill style={{background: m.bg}}>{box(500, <>{label}
        <Lines f={f} at={4} lines={['우리 집 도면 열고', '물량까지 뽑는 데']} size={104} color="#fff" />
        <div style={{marginTop: 30}}><Lines f={f} at={30} lines={['몇 번 누르면 될까?']} size={118} color={m.acc} /></div></>)}
        <div style={{position: 'absolute', left: 540 - 90, top: 1380, width: 180, height: 180, borderRadius: 90, background: 'rgba(111,211,255,.35)', border: '8px solid #fff', opacity: fade(f, 40)}} />
        <div style={{position: 'absolute', left: 540 - 90, top: 1380, width: 180, height: 180, borderRadius: 90, border: `8px solid ${m.acc}`, opacity: f > 40 ? 1 - ring : 0, transform: `scale(${1 + ring * 1.2})`}} />
      </AbsoluteFill>;
    }
    case 'versus': {
      const bad = ['업체마다 전화 돌리기', '실측 날짜 맞추기', '견적서 오기까지 며칠'], good = ['사진·도면 파일만 보내면', '24시간 안에 견적서'];
      const row = (t: string, at: number, ok: boolean) => <div key={t} style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: 22, opacity: fade(f, at), transform: `translateX(${(1 - pop(f, at)) * -50}px)`}}>
        <span style={{width: 74, height: 74, borderRadius: 37, background: ok ? LIME : '#E5484D', color: INK, fontSize: 52, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>{ok ? '✓' : '✕'}</span>
        <span style={{fontSize: 64, fontWeight: 700, color: ok ? '#fff' : 'rgba(255,255,255,.75)', textDecoration: ok ? 'none' : 'line-through', textDecorationThickness: 6}}>{t}</span></div>;
      return <AbsoluteFill>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 960, background: '#3A1B1B', padding: '300px 90px 0'}}>
          <div style={{fontSize: 46, color: '#FF9A9A', fontWeight: 700}}>그동안 견적 받기</div>
          {bad.map((t, k) => row(t, 1 + k * 10, false))}</div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 960, height: 960, background: m.bg, padding: '80px 90px 0', borderTop: `10px solid ${m.acc}`, transform: `translateY(${(1 - pop(f, 50, 1.2)) * 960}px)`}}>
          <div style={{fontSize: 46, color: m.acc, fontWeight: 700}}>집지니로 견적 받기</div>
          {good.map((t, k) => row(t, 62 + k * 14, true))}</div>
      </AbsoluteFill>;
    }
    case 'chat': {
      const msgs: [string, boolean, number][] = [['이번 달 관리비 왜 이렇게 나왔지?', false, 0], ['옆 단지랑 비교해 봐', true, 28], ['그걸 어떻게 해?', false, 48], ['아파트 이름만 치면 돼', true, 66]];
      return <AbsoluteFill style={{background: m.bg}}>
        <div style={{position: 'absolute', left: 70, top: 300, fontSize: 46, color: GREEN, fontWeight: 700}}>집지니 사용법 · {d.title}</div>
        <div style={{position: 'absolute', left: 60, right: 60, top: 460}}>
          {msgs.map(([t, me, at]) => <div key={t} style={{display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginTop: 34, opacity: fade(f, at, 4), transform: `scale(${pop(f, at, 2.2)})`, transformOrigin: me ? 'right bottom' : 'left bottom'}}>
            <div style={{maxWidth: 820, padding: '30px 42px', borderRadius: 48, borderBottomRightRadius: me ? 10 : 48, borderBottomLeftRadius: me ? 48 : 10, background: me ? m.acc : '#fff', color: INK, fontSize: 70, fontWeight: 700, lineHeight: 1.25, boxShadow: '0 4px 0 rgba(0,0,0,.08)'}}>{t}</div></div>)}
        </div>
      </AbsoluteFill>;
    }
    case 'myth': {
      const st = pop(f, 46, 1.4);
      return <AbsoluteFill style={{background: m.bg}}>{box(480, <>{label}
        <Lines f={f} at={4} lines={['아파트 지원금,', '우리 단지랑은', '상관없다?']} size={120} color="#fff" /></>)}
        {f >= 46 && <div style={{position: 'absolute', left: 520, top: 840, padding: '10px 46px', border: `14px solid ${m.acc}`, borderRadius: 24, color: m.acc, fontSize: 190, fontWeight: 700, transform: `rotate(-12deg) scale(${2.4 - st * 1.4})`, opacity: st}}>땡!</div>}
        {box(1400, <Lines f={f} at={64} lines={['단지마다 받을 수 있는', '사업이 따로 있어요']} size={66} color={LIME} gap={8} />)}
      </AbsoluteFill>;
    }
    case 'pov': {
      const drops = Array.from({length: 9}, (_, k) => {const x = 160 + ((k * 389) % 760), per = 34 + (k % 4) * 7, t = ((f + k * 11) % per) / per; return <div key={k} style={{position: 'absolute', left: x, top: 120 + t * 1700, width: 26, height: 40, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: m.acc, opacity: 0.75 * (1 - t * 0.6)}} />;});
      return <AbsoluteFill style={{background: m.bg}}>
        <div style={{position: 'absolute', left: -80, right: -80, top: -60, height: 220, background: 'radial-gradient(ellipse at 50% 0%, rgba(140,110,70,.75), rgba(0,0,0,0) 70%)'}} />
        {drops}{box(560, <>
        <div style={{fontSize: 90, color: m.acc, fontWeight: 700, opacity: fade(f, 0)}}>POV:</div>
        <Lines f={f} at={6} lines={['윗집에서', '물이 샌다']} size={150} color="#fff" />
        <div style={{marginTop: 50}}><Lines f={f} at={52} lines={['복구비, 얼마 나올까?']} size={86} color={m.acc} /></div></>)}
      </AbsoluteFill>;
    }
    case 'list': {
      const items = ['수리비', '공사 기간', '감정가 대비 비율'];
      return <AbsoluteFill>{dim(0.16)}{box(460, <>{label}
        <Lines f={f} at={2} lines={['경매 낙찰 전', '꼭 볼 것 3가지']} size={124} color="#fff" last={m.acc} />
        <div style={{marginTop: 60}}>{items.map((t, k) => <div key={t} style={{display: 'flex', alignItems: 'center', gap: 30, marginTop: 26, opacity: fade(f, 30 + k * 10), transform: `translateX(${(1 - pop(f, 30 + k * 10)) * 80}px)`}}>
          <span style={{width: 90, height: 90, borderRadius: 45, border: `6px solid ${m.acc}`, color: m.acc, fontSize: 54, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>{k + 1}</span>
          <span style={{fontSize: 72, fontWeight: 700, color: '#fff'}}>{t}</span></div>)}</div></>)}
      </AbsoluteFill>;
    }
    case 'marker': {
      const sw = interpolate(f, [26, 46], [0, 1], {...C, easing: Easing.inOut(Easing.cubic)});
      const z = 1.18;
      return <AbsoluteFill style={{background: m.bg}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '540px 1050px', transform: `scale(${z})`}}>
          <Img src={staticFile(bgImg)} style={{width: 1080, height: 1920, filter: 'brightness(.5)'}} />
          <div style={{position: 'absolute', left: 84, top: 990, height: 120, width: 920 * sw, background: 'rgba(255,225,77,.55)', borderRadius: 8}} />
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, padding: '230px 80px 60px', background: `linear-gradient(${m.bg} 75%, rgba(0,0,0,0))`}}>
          {label}
          <Lines f={f} at={4} lines={['받은 견적서,']} size={104} color="#fff" />
          {['이 줄,', '비싼 거 맞아요?'].map((l, k) => <div key={l} style={{marginTop: 14}}><span style={{fontSize: 108, fontWeight: 700, letterSpacing: -3, color: INK, opacity: fade(f, 46 + k * 8), background: `linear-gradient(${m.acc}, ${m.acc}) no-repeat`, backgroundSize: `${interpolate(f, [46 + k * 8, 58 + k * 8], [0, 100], C)}% 100%`, padding: '0 16px'}}>{l}</span></div>)}
        </div>
      </AbsoluteFill>;
    }
    case 'challenge': {
      const go = pop(f, 34, 2.4);
      return <AbsoluteFill style={{background: m.bg}}>{box(420, <>{label}
        <Lines f={f} at={2} lines={['싱크대 설계', '60초 도전']} size={130} color="#fff" last={m.acc} /></>)}
        <div style={{position: 'absolute', left: 540 - 210, top: 1030, width: 420, height: 420, borderRadius: 210, border: `22px solid ${m.acc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 200, fontWeight: 700, transform: `scale(${pop(f, 14, 2)})`}}>{f < 34 ? '60' : '시작'}</div>
        {f >= 34 && <div style={{position: 'absolute', left: 0, right: 0, top: 1030, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{width: 420, height: 420, borderRadius: 210, background: m.acc, opacity: (1 - go) * 0.8, transform: `scale(${1 + go * 0.5})`}} /></div>}
      </AbsoluteFill>;
    }
  }
};
// 첫 장면 소리: 형식마다 다르게, 높은 음 없이. 사람이 말하는 밈을 뜻에 맞춰 하나씩(편마다 다른 것)
const hookSounds = (m: Fmt, id: string): JSX.Element[] => {
  const v = (_pool: string[], at: number, vol = 0.8) => snd(HOOK_LINE[m.kind], at, vol, 'hv' + at);
  switch (m.kind) {
    case 'count': return [snd('drumroll', 50 - 27, 0.55), snd('slam', 50, 0.7), v(MEME.shock, 56)];
    case 'taps': return [snd('tok', 30, 0.6), snd('tok', 44, 0.6), snd('tok', 74, 0.6), v(MEME.yay, 56)];
    case 'versus': return [1, 11, 21].map((a) => snd('thud', a, 0.6)).concat([snd('whoosh', 48, 0.4), v(MEME.nope, 60)]);
    case 'chat': return [0, 28, 48, 66].map((a) => snd('tok', a, 0.6)).concat([v(MEME.lol, 70, 0.6)]);
    case 'myth': return [snd('slam', 46, 0.8), snd('boing', 48, 0.6), v(MEME.nope, 56)];
    case 'pov': return [snd('drop_low', 20, 0.7), snd('drop_low', 40, 0.6), snd('heart', 30, 0.6), v(MEME.shock, 54)];
    case 'list': return [30, 40, 50].map((a) => snd('punch', a, 0.45)).concat([v(MEME.shock, 56)]);
    case 'marker': return [snd('whoosh', 24, 0.4), snd('mk2', 46, 0.7), v(MEME.nope, 50)];
    case 'challenge': return [snd('tapestop', 14, 0.4), snd('drop808', 34, 0.6), v(MEME.shock, 40)];
  }
};

export const Tut: React.FC<{d: TutData}> = ({d}) => {
  useFonts();
  const f = useCurrentFrame();
  const m = d.fmt, HOOK = m.hook, light = m.fg !== '#fff';
  const base = `tut/${d.id}/`;
  const starts: number[] = []; let t = HOOK;
  d.frames.forEach((fr) => {starts.push(t); t += len(fr, m);});
  const endAt = t, total = t + END;
  const i = starts.findIndex((s, k) => f >= s && f < s + len(d.frames[k], m));
  const fr = i >= 0 ? d.frames[i] : null;
  let capIdx = -1;
  if (i >= 0) for (let k = i; k >= 0; k--) if (d.frames[k].cap) {capIdx = k; break;}
  const cap = capIdx >= 0 ? d.frames[capIdx] : null;
  let view = {z: 1, cx: 540, cy: 960};
  if (fr) {
    const tgt = cam(fr.kind === 'type' && capIdx >= 0 ? d.frames[capIdx] : fr);
    const from = fr.kind === 'type' || fr.cap === null && i > 0 && d.frames[i - 1].kind !== 'shot' ? tgt : {z: 1, cx: 540, cy: 960};
    const p = fr.kind === 'type' ? 1 : interpolate(f - starts[i], [4, 4 + ZIN], [0, 1], {...C, easing: Easing.inOut(Easing.cubic)});
    view = {z: from.z + (tgt.z - from.z) * p, cx: from.cx + (tgt.cx - from.cx) * p, cy: from.cy + (tgt.cy - from.cy) * p};
  }
  const tf = `translate(${540 - view.cx * view.z}px, ${960 - view.cy * view.z}px) scale(${view.z})`;
  const resultIdx = d.frames.findIndex((x) => x.result);
  const resImg = base + d.frames[resultIdx >= 0 ? resultIdx : d.frames.length - 1].img;

  // 소리 — 효과 감독(fx.ts) 규칙: 결정 지점에만, 분위기에 맞는 소리만
  const mood = moodOf(m.music), pal = PAL[mood];
  const hits = d.frames.map((x, k) => x.result ? starts[k] : -1).filter((x) => x >= 0);
  const sounds: JSX.Element[] = [snd(m.start, 0, 0.8, 'start'), ...hookSounds(m, d.id)];
  const tapMoments: number[] = [];
  let lastCut = -99, lastStep = -1, typeN = 0;
  d.frames.forEach((x, k) => {
    const s = starts[k];
    // 단계가 바뀔 때만 휙(가장 큰 순간이 컷에 닿게), 2초 안에 또 넣지 않는다
    if (pal.cut && x.cap && !x.result && x.step !== lastStep && s - lastCut >= 60) {sounds.push(snd(pal.cut, s - (PEAK[pal.cut] ?? 2), 0.3, 'w' + k)); lastCut = s;}
    if (x.step) lastStep = x.step;
    // 누르는 소리는 화면 속 소리라 남기되 작게
    if (x.kind === 'tap' && x.tapAt) {const tm = s + Math.round(len(x, m) * 0.45); tapMoments.push(tm); sounds.push(snd(pal.tap, tm, pal.tapV, 't' + k));}
    if (x.kind === 'type' && typeN++ % 2 === 0) sounds.push(snd('key3', s + 1, 0.25, 'k' + k));
    if (x.focus && (x.result || x.kind === 'shot') && x.cap) sounds.push(snd(['mk1', 'mk2', 'mk3'][k % 3], s + ZIN + 2, 0.5, 'mk' + k));
    if (x.result) {
      if (pal.pre) sounds.push(snd(pal.pre, s - (PEAK[pal.pre] ?? 0), 0.4, 'pre' + k));
      pal.hit.forEach(([n, v], q) => sounds.push(snd(n, s, v, 'hit' + k + q)));
      sounds.push(snd(pick(MEME.yay, d.id, k), s + 5, 0.8, 'rv' + k));      // 결과엔 말하는 밈 하나
      if (pal.voice) sounds.push(snd(pal.voice[0], s + 12, pal.voice[1], 'r' + k));   // 그 뒤로 관중 반응을 작게
    }
  });
  if (m.kind === 'list' && resultIdx >= 0) [20, 44, 68].forEach((a, k) => sounds.push(snd('tok', starts[resultIdx] + a, 0.5, 'l' + k)));
  if (m.kind === 'challenge') sounds.push(snd('cheer', endAt - 4, 0.55, 'win'));
  // 결과 순간 화면 효과
  const lfHit = fr && fr.result ? f - starts[i] : -1;
  const pz = punchZ(lfHit, pal.punch), hs = pal.shake ? hitShake(lfHit) : '';

  // 손가락 자국(휴대폰 화면 녹화의 터치 표시처럼 회색 점)
  let tapEl = null;
  if (fr && fr.kind === 'tap' && fr.tapAt) {
    const L = len(fr, m), lf = f - starts[i];
    const px = 540 + (fr.tapAt[0] * S - view.cx) * view.z, py = 960 + (fr.tapAt[1] * S - view.cy) * view.z;
    const show = interpolate(lf, [L * 0.25, L * 0.32, L * 0.6, L * 0.7], [0, 1, 1, 0], C);
    const press = interpolate(lf, [L * 0.4, L * 0.45, L * 0.55], [1, 0.78, 1], C);
    tapEl = <div style={{position: 'absolute', left: px - 44, top: py - 44, width: 88, height: 88, borderRadius: 44, background: 'rgba(110,110,110,.5)', border: '3px solid rgba(255,255,255,.85)', opacity: show, transform: `scale(${press})`}} />;
  }
  // 결과·누를 곳에 손으로 그은 표시(장면마다 다른 모양)
  let markEl = null;
  if (fr && fr.focus && (fr.result || fr.kind === 'shot') && fr.cap && fr.focus[3] * S * view.z < 620) {
    const [x, y, w, h] = fr.focus.map((v) => v * S);
    const kinds = MARK_ORDER, kd = kinds[(i + d.id.length) % kinds.length];
    markEl = <Mark kind={fr.result && kd === 'check' ? 'circle' : kd} x={540 + (x - view.cx) * view.z} y={960 + (y - view.cy) * view.z} w={w * view.z} h={h * view.z} t={f - starts[i] - ZIN - 2} seed={i + 1} />;
  }

  // 단계 자막: 쇼츠 기본 모양(상자 없음). 번호는 앞에 작은 노란 글자로
  const NO = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
  const capEl = cap ? <div style={{position: 'absolute', left: 60, right: 150, top: 1200, opacity: fade(f, starts[capIdx], 3)}}>
    {!cap.result && cap.step ? <div style={{marginBottom: 8}}><Cap text={NO[(cap.step - 1) % 8]} size={62} color={YEL} /></div> : null}
    <Cap text={cap.cap || ''} size={70} color={cap.result ? YEL : '#fff'} />
  </div> : null;

  // 단계 중 따라다니는 표시(상자 없이 글자만)
  let side = null;
  if (fr) {
    if (m.kind === 'taps') {
      const n = tapMoments.filter((tm) => f >= tm).length;
      side = <div style={{position: 'absolute', right: 150, top: 300}}><Cap text={`누른 횟수 ${n}`} size={56} color={YEL} /></div>;
    }
    if (m.kind === 'challenge') {
      const left = Math.max(0, 60 - Math.floor((f - HOOK) / 30));
      side = <div style={{position: 'absolute', right: 150, top: 300}}><Cap text={`${left}초 남음`} size={60} color={YEL} /></div>;
    }
    if (m.kind === 'list' && fr.result) {
      const lf = f - starts[i];
      const items = ['수리비 3,114만 원', '공사 기간 3~4주', '감정가 대비 5.5%'];
      side = <div style={{position: 'absolute', left: 60, right: 150, top: 880}}>
        {items.map((a, k) => lf >= 20 + k * 24 ? <div key={a} style={{marginTop: 14}}><Cap text={`✓ ${a}`} size={60} color={k === 0 ? YEL : '#fff'} align="left" /></div> : null)}</div>;
    }
  }

  const endLines = (m.end ?? d.end).split('\n');
  return <AbsoluteFill style={{background: m.bg, fontFamily: 'P', overflow: 'hidden'}}>
    <style>{css}</style>
    {f < HOOK && <Hook d={d} f={f} bgImg={resImg} />}
    {fr && <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '540px 800px', transform: `${shake(f)}${hs} scale(${pz})`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: tf}}>
        <Img src={staticFile(base + fr.img)} style={{width: 1080, height: 1920}} />
      </div>
      {markEl}{tapEl}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: m.kind === 'list' ? 1200 : 960, background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.6) 35%, rgba(0,0,0,.72))'}} />
      {(m.kind === 'taps' || m.kind === 'challenge') && <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 460, background: 'linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.4) 60%, rgba(0,0,0,0))'}} />}
      {capEl}{side}
    </AbsoluteFill>}
    {f >= endAt && <AbsoluteFill style={{background: m.bg}}>
      <div style={{position: 'absolute', left: 90, top: 620}}>
        {m.kind === 'challenge' && <div style={{fontSize: 56, fontWeight: 700, color: m.acc, marginBottom: 24}}>성공 · {Math.max(0, 60 - Math.floor((endAt - HOOK) / 30))}초 남음</div>}
        {endLines.map((l, k) => <div key={k} style={{fontSize: 124, fontWeight: 700, color: m.fg, letterSpacing: -4, lineHeight: 1.12}}>{l}</div>)}
        <div style={{marginTop: 90}}><Logo at={endAt + 10} fg={m.fg} light={light} /></div>
      </div>
    </AbsoluteFill>}
    <Audio src={staticFile(`sfx/${m.music}.wav`)} startFrom={musicStart(mood, hits[0] ?? endAt, EXTRA_BARS[d.id] ?? 0)} volume={(x) => musicVol(x, total, hits)} />
    {sounds}
    {snd('whoosh', endAt - 2, 0.4, 'e1')}{snd('thud', endAt + 10, 0.5, 'e2')}
  </AbsoluteFill>;
};
