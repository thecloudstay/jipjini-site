// 손으로 그은 표시 7가지 + 쇼츠 기본 자막 (2026-11-28 대표 「동그라미 별표 등 다양하게」 「AI 티 안 나게」)
// 모두 살짝 삐뚤게, 긋는 순서대로 나타남. 소리는 낮은 「슥」(mk1~3) — 높은 끼익 소리 금지.
import React from 'react';
import {interpolate, Easing} from 'remotion';

export const RED = '#E5392C', YEL = '#FFD43B';
const C = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export type MarkKind = 'circle' | 'underline' | 'arrow' | 'star' | 'check' | 'bracket' | 'hl' | 'box';
export const MARK_ORDER: MarkKind[] = ['circle', 'arrow', 'underline', 'star', 'hl', 'check', 'bracket', 'box'];

const j = (k: number, seed: number, a = 1) => (Math.sin(k * 1.7 + seed * 3.1) * 0.6 + Math.cos(k * 0.9 + seed * 5.3) * 0.4) * a;
const P = (pts: number[][]) => pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

// x,y,w,h = 영상 좌표의 대상 상자. t = 긋기 시작 뒤 지난 프레임
export const Mark: React.FC<{kind: MarkKind; x: number; y: number; w: number; h: number; t: number; seed?: number; color?: string}> = ({kind, x, y, w, h, t, seed = 1, color = RED}) => {
  if (t < 0) return null;
  const p = interpolate(t, [0, kind === 'star' ? 12 : 9], [0, 1], {...C, easing: Easing.out(Easing.quad)});
  const sw = 9, cx = x + w / 2, cy = y + h / 2;
  const line = (d: string, key: string | number = 0, from = 0, to = 1, width = sw, col = color, op = 0.92) => {
    const q = interpolate(p, [from, to], [0, 1], C);
    return <path key={key} d={d} fill="none" stroke={col} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - q} opacity={q > 0 ? op : 0} />;
  };
  let body: React.ReactNode = null;
  if (kind === 'circle') {
    const pts: number[][] = [];
    for (let k = 0; k <= 46; k++) {const a = -1.9 + (k / 46) * Math.PI * 2.18, r = 1 + j(k, seed, 0.05); pts.push([cx + Math.cos(a) * (w / 2 + 26) * r, cy + Math.sin(a) * (h / 2 + 22) * r]);}
    body = line(P(pts));
  } else if (kind === 'underline') {
    const mk = (dy: number, s: number) => {const pts: number[][] = []; for (let k = 0; k <= 24; k++) pts.push([x - 6 + (w + 12) * k / 24, y + h + dy + j(k, s, 5)]); return P(pts);};
    body = <>{line(mk(12, seed), 'a', 0, 0.55)}{line(mk(30, seed + 2), 'b', 0.45, 1)}</>;
  } else if (kind === 'arrow') {
    // 오른쪽 위에서 휘어 들어와 대상의 오른쪽 끝을 가리킴(대상이 넓으면 위에서 아래로)
    const tx = Math.min(x + w + 14, 1000), ty = cy, sx = Math.min(tx + 150, 1050), sy = ty - 190;
    const pts: number[][] = []; for (let k = 0; k <= 20; k++) {const u = k / 20; pts.push([sx + (tx + 40 - sx) * u + Math.sin(u * Math.PI) * 60 + j(k, seed, 3), sy + (ty - 8 - sy) * u * u + j(k + 5, seed, 3)]);}
    const e = pts[pts.length - 1];
    body = <>{line(P(pts), 'a', 0, 0.7)}{line(`M${e[0] + 6} ${e[1] - 52} L${e[0]} ${e[1]} L${e[0] + 54} ${e[1] - 22}`, 'b', 0.7, 1)}</>;
  } else if (kind === 'star') {
    const sx = Math.max(70, x - 20), sy = Math.max(70, y - 30), R = 58;
    const pts: number[][] = []; for (let k = 0; k <= 5; k++) {const a = -Math.PI / 2 + k * (Math.PI * 4 / 5); pts.push([sx + Math.cos(a) * R * (1 + j(k, seed, 0.06)), sy + Math.sin(a) * R * (1 + j(k + 2, seed, 0.06))]);}
    const u: number[][] = []; for (let k = 0; k <= 20; k++) u.push([x + w * 0.02 + (w * 0.5) * k / 20, y + h + 14 + j(k, seed, 4)]);
    body = <>{line(P(pts), 'a', 0, 0.75, 8)}{line(P(u), 'b', 0.7, 1)}</>;
  } else if (kind === 'check') {
    const bx = Math.min(x + w + 20, 930), by = cy;
    body = line(`M${bx} ${by - 6} L${bx + 34} ${by + 34} L${bx + 112} ${by - 62}`, 0, 0, 1, 12);
  } else if (kind === 'bracket') {
    const l = x - 18, r = x + w + 18, tp = y - 14, bt = y + h + 14;
    body = <>{line(`M${l + 30} ${tp} L${l + j(1, seed, 3)} ${tp + 4} L${l + 3} ${bt - 3} L${l + 30} ${bt}`, 'a', 0, 0.5)}{line(`M${r - 30} ${tp} L${r} ${tp + 3} L${r - 3 + j(2, seed, 3)} ${bt - 4} L${r - 30} ${bt}`, 'b', 0.5, 1)}</>;
  } else if (kind === 'hl') {
    body = line(`M${x - 4} ${cy + j(1, seed, 3)} L${x + w + 4} ${cy + j(2, seed, 3)}`, 0, 0, 1, Math.min(h + 10, 90), YEL, 0.42);
  } else if (kind === 'box') {
    const l = x - 16, r = x + w + 16, tp = y - 14, bt = y + h + 14;
    body = line(`M${l} ${tp + j(1, seed, 4)} L${r + j(2, seed, 4)} ${tp} L${r} ${bt + j(3, seed, 4)} L${l + j(4, seed, 4)} ${bt} L${l - 2} ${tp - 10}`);
  }
  return <svg style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, overflow: 'visible', pointerEvents: 'none'}}>{body}</svg>;
};

// 쇼츠 기본 자막: 흰 글씨 + 검은 테두리, 상자 없음
export const Cap: React.FC<{text: string; size?: number; color?: string; align?: 'center' | 'left'}> = ({text, size = 68, color = '#fff', align = 'center'}) =>
  <div style={{fontSize: size, fontWeight: 700, color, lineHeight: 1.28, letterSpacing: -1, textAlign: align, whiteSpace: 'pre-line',
    WebkitTextStroke: `${Math.round(size / 9)}px #000`, paintOrder: 'stroke fill', textShadow: '0 4px 10px rgba(0,0,0,.35)'}}>{text}</div>;

// 손 흔들림(아주 살짝)
export const shake = (f: number) => `translate(${(Math.sin(f * 0.21) * 3 + Math.sin(f * 0.53) * 1.5).toFixed(2)}px, ${(Math.cos(f * 0.17) * 3).toFixed(2)}px) rotate(${(Math.sin(f * 0.11) * 0.25).toFixed(3)}deg) scale(1.03)`;
