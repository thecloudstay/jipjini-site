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
//  6) 높은 음의 소리는 쓰지 않는다(2026-11-28 대표 「높은 피치 사운드 다 빼, 거북하다」). 금지: riser·rise·qup·pluck·pop·key1·key2·ding·glitch·hat·coins·chips·airhorn·scratch·reveal·m_ah·m_woo·m_hehe·m_gah·whoosh_a/b/c
//  7) 밈·반응 소리는 적극적으로(대표 「와우·박수 등 밈 사운드 적극, 필요하면 만들어 써」): 박수·환호·관중 「오~」·두구두구·짜잔·웃음·실망 트롬본·브루·바인 붐 (tools/music/memes.py 로 직접 만든 것 + 밈 원본)
export const PEAK: Record<string, number> = {whoosh: 2, drumroll: 27, timp: 8, tada: 5};
type Pal = {cut: string | null; tap: string; tapV: number; hit: [string, number][]; voice: [string, number] | null; pre: string | null; shake: boolean; punch: number};
export const PAL: Record<Mood, Pal> = {
  up:    {cut: 'whoosh', tap: 'tok', tapV: 0.45, hit: [['thud', 0.7], ['tada', 0.6]],    voice: ['cheer', 0.6],      pre: 'drumroll', shake: false, punch: 1.06},
  talk:  {cut: 'whoosh', tap: 'tok', tapV: 0.45, hit: [['thud', 0.55], ['tada', 0.45]],  voice: ['crowd_oh', 0.7],   pre: null,       shake: false, punch: 1.05},
  calm:  {cut: null,     tap: 'tok', tapV: 0.35, hit: [['thud', 0.45]],                  voice: ['clap_small', 0.5], pre: null,       shake: false, punch: 1.035},
  tense: {cut: 'whoosh', tap: 'tok', tapV: 0.45, hit: [['m_vine', 0.6]],                 voice: ['crowd_oh', 0.7],   pre: 'timp',     shake: true,  punch: 1.07},
  warm:  {cut: null,     tap: 'tok', tapV: 0.35, hit: [['thud', 0.45], ['tada', 0.4]],   voice: ['applause', 0.55],  pre: null,       shake: false, punch: 1.035},
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
