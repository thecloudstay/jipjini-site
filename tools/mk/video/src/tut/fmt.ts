// 배경음은 편의 분위기에 맞춰 고른다(2026-11-28 대표 「하나만 전체에 다 적용하지 말 것」): 경쾌=bgm_jackal(실제 곡) · 차분·긴장=music_a · 일상 대화=music_c · 반전=music_b · 정보=music_tut
// 편마다 다른 형식 (mk/research/2026-11-28-사용법영상-형식다양화.md)
export type Fmt = {
  kind: 'count' | 'taps' | 'versus' | 'chat' | 'myth' | 'pov' | 'list' | 'marker' | 'challenge';
  hook: number;              // 갈고리 길이(프레임)
  bg: string; fg: string; acc: string;
  cap: 'band' | 'chip' | 'bubble' | 'marker';
  music: string; start: string;
  end?: string;
  resultHold?: number;       // 결과 장면 길이(초) 덮어쓰기
};
const INK = '#141613';
export const FMT: Record<string, Fmt> = {
  cost:      {kind: 'count',     hook: 96,  bg: INK,       fg: '#fff', acc: '#FFD43B', cap: 'band',   music: 'bgm_jackal',   start: 'chips'},
  cad:       {kind: 'taps',      hook: 80,  bg: '#0F2236', fg: '#fff', acc: '#6FD3FF', cap: 'band',   music: 'bgm_jackal', start: 'whoosh_a', end: '4번 누르면\n도면·물량까지'},
  req:       {kind: 'versus',    hook: 110, bg: '#22170F', fg: '#fff', acc: '#FFB547', cap: 'chip',   music: 'music_a',   start: 'scratch'},
  acb:       {kind: 'chat',      hook: 100, bg: '#EFE8DA', fg: INK,    acc: '#FFD43B', cap: 'bubble', music: 'music_c',   start: 'pop', resultHold: 4.6},
  support:   {kind: 'myth',      hook: 96,  bg: '#2A0F14', fg: '#fff', acc: '#FF5A5F', cap: 'chip',   music: 'music_b',   start: 'm_vine', resultHold: 3.6},
  disaster:  {kind: 'pov',       hook: 90,  bg: '#0B1E2E', fg: '#fff', acc: '#5CB8FF', cap: 'band',   music: 'music_a',   start: 'drop'},
  auction:   {kind: 'list',      hook: 80,  bg: '#1D1A2E', fg: '#fff', acc: '#C9B8FF', cap: 'band',   music: 'music_tut',   start: 'punch', resultHold: 5.6},
  compare:   {kind: 'marker',    hook: 96,  bg: '#13261A', fg: '#fff', acc: '#FFE14D', cap: 'marker', music: 'music_c', start: 'mk2'},
  kitchen:   {kind: 'challenge', hook: 66,  bg: '#1B1410', fg: '#fff', acc: '#FF8A3D', cap: 'chip',   music: 'bgm_jackal',   start: 'airhorn', end: '60초 안에\n싱크대 설계 끝'},
};
