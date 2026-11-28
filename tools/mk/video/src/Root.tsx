import React from 'react';
import {Composition} from 'remotion';
import {ToonStory, TOON_LEN} from './ToonStory';
import {Toon, epLen} from './Toon';
import {ep1} from './toon/ep1';
const EPS = [ep1];
// 컷 그림이 함수라 속성으로 넘기면 사라진다 → 화마다 감싼 구성 요소를 만든다
const EPC: Record<string, React.FC> = Object.fromEntries(EPS.map((e) => [e.id, () => <Toon ep={e} />]));
import {Story, STORY_LEN} from './Story';
import {Maru} from './Maru';
import {Tut, tutLength, TutData} from './Tut';
import {FMT} from './tut/fmt';
import {Journey, JOURNEY_LEN} from './Journey';
// 사이트 사용법 영상: src/tut/<이름>.json (tools/record.js 로 찍은 화면 정보)
const T: TutData[] = ['cost', 'cad', 'req', 'acb', 'support', 'disaster', 'auction', 'compare', 'kitchen'].map((k) => ({...require(`./tut/${k}.json`), fmt: FMT[k]}));
export const Root: React.FC = () => (
  <>
    <Composition id="Story" component={Story} durationInFrames={STORY_LEN} fps={30} width={1080} height={1920} />
    {EPS.map((e) => <Composition key={e.id} id={'Toon-' + e.id} component={EPC[e.id]} durationInFrames={epLen(e)} fps={30} width={1080} height={1920} />)}
    <Composition id="ToonStory" component={ToonStory} durationInFrames={TOON_LEN} fps={30} width={1080} height={1920} />
    <Composition id="Journey" component={Journey} durationInFrames={JOURNEY_LEN} fps={30} width={1080} height={1920} />
    <Composition id="Maru" component={Maru} durationInFrames={480} fps={30} width={1080} height={1920} />
    {T.map((d) => <Composition key={d.id} id={'Tut-' + d.id} component={Tut} defaultProps={{d}} durationInFrames={tutLength(d)} fps={30} width={1080} height={1920} />)}
  </>
);
