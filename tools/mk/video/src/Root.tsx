import React from 'react';
import {Composition} from 'remotion';
import {Maru} from './Maru';
import {Tut, tutLength, TutData} from './Tut';
import {FMT} from './tut/fmt';
// 사이트 사용법 영상: src/tut/<이름>.json (tools/record.js 로 찍은 화면 정보)
const T: TutData[] = ['cost', 'cad', 'req', 'acb', 'support', 'disaster', 'auction', 'compare', 'kitchen'].map((k) => ({...require(`./tut/${k}.json`), fmt: FMT[k]}));
export const Root: React.FC = () => (
  <>
    <Composition id="Maru" component={Maru} durationInFrames={480} fps={30} width={1080} height={1920} />
    {T.map((d) => <Composition key={d.id} id={'Tut-' + d.id} component={Tut} defaultProps={{d}} durationInFrames={tutLength(d)} fps={30} width={1080} height={1920} />)}
  </>
);
