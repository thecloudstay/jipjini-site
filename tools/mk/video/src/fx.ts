// 효과 감독: 「어느 순간에 어떤 소리·화면 효과를 쓰는가」를 한곳에서 정한다 (2026-11-28 대표 「이펙트·상황별 삽입을 레퍼런스 검토 후 업그레이드」)
// 근거: mk/research/2026-11-28-효과-쓰는-법.md
//  1) 소리는 「결정 지점」에만: 첫 장면·단계가 바뀔 때·결과가 드러날 때·끝. 컷마다 넣으면 아무것도 놀랍지 않다.
//  2) 휙 소리는 가장 큰 순간이 컷에 닿게 앞당겨 놓는다(PEAK).
//  3) 결과 직전에 배경음을 잠깐 내리고(숨 고르기), 결과와 함께 낮은 쿵+반짝을 겹쳐 치고 배경음을 살짝 올린다.
//  4) 결과가 배경음의 마디 첫 박에 떨어지게 곡의 시작 지점을 맞춘다.
//  5) 분위기에 안 맞는 소리는 뺀다(차분·따뜻한 편에는 밈 외침·경적 없음). 흔들림은 놀람·사고 편에서만 짧게.
export type Mood = 'up' | 'talk' | 'calm' | 'tense' | 'warm';
export const BPM: Record<Mood, number> = {up: 96, talk: 90, calm: 76, tense: 88, warm: 82};
export const moodOf = (music: string) => (music.replace('mood_', '') as Mood);
export const PEAK: Record<string, number> = {whoosh_a: 4, whoosh_b: 6, whoosh_c: 2, whoosh: 2, riser: 26, rise: 8};
type Pal = {cut: string | null; tap: string; tapV: number; hit: [string, number][]; voice: string | null; pre: string | null; shake: boolean; punch: number};
export const PAL: Record<Mood, Pal> = {
  up:    {cut: 'whoosh_a', tap: 'tok',  tapV: 0.45, hit: [['thud', 0.75], ['reveal', 0.55]], voice: 'm_woo', pre: 'rise',  shake: false, punch: 1.06},
  talk:  {cut: 'whoosh_c', tap: 'pop',  tapV: 0.5,  hit: [['pluck', 0.6], ['reveal', 0.5]],  voice: 'm_ah',  pre: null,    shake: false, punch: 1.05},
  calm:  {cut: null,       tap: 'tok',  tapV: 0.35, hit: [['reveal', 0.45]],                 voice: null,    pre: null,    shake: false, punch: 1.035},
  tense: {cut: 'whoosh_b', tap: 'key2', tapV: 0.5,  hit: [['boom', 0.4], ['reveal', 0.5]],   voice: null,    pre: 'riser', shake: true,  punch: 1.07},
  warm:  {cut: null,       tap: 'tok',  tapV: 0.35, hit: [['pluck', 0.5], ['reveal', 0.45]], voice: null,    pre: null,    shake: false, punch: 1.035},
};
// 결과 장면(hitAt)이 마디 첫 박에 오도록 곡 시작 지점(프레임)을 구한다. extraBars 로 같은 곡을 쓰는 편끼리 구간을 달리한다.
export const musicStart = (mood: Mood, hitAt: number, extraBars = 0) => {
  const beat = 1800 / BPM[mood], bar = beat * 4, lead = beat * 0.25;
  const base = (((lead - hitAt) % bar) + bar) % bar;
  return Math.round(base + bar * (1 + extraBars));
};
// 배경음 크기: 결과 10프레임 전부터 내렸다가, 결과에서 1초쯤 살짝 키운다
export const musicVol = (x: number, total: number, hits: number[], base = 0.24) => {
  let v = base;
  for (const h of hits) {
    if (x >= h - 12 && x < h) v = base * (0.3 + 0.7 * Math.max(0, (h - 4 - x) / 8));
    else if (x >= h && x < h + 36) v = base * (1.3 - 0.3 * (x - h) / 36);
  }
  const fadeIn = Math.min(1, x / 12), fadeOut = Math.min(1, Math.max(0, (total - x) / 25));
  return v * fadeIn * fadeOut;
};
// 결과 순간 화면: 살짝 당겨 잡기(4프레임), 놀람 편은 8프레임만 흔든다
export const punchZ = (lf: number, punch: number) => lf < 0 ? 1 : 1 + (punch - 1) * Math.min(1, lf / 4);
export const hitShake = (lf: number) => lf < 0 || lf > 8 ? '' : ` translate(${Math.sin(lf * 2.6) * (8 - lf) * 1.6}px, ${Math.cos(lf * 3.1) * (8 - lf) * 1.2}px)`;
