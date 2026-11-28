import React from 'react';
import {Composition} from 'remotion';
import {Maru} from './Maru';
export const Root: React.FC = () => (
  <Composition id="Maru" component={Maru} durationInFrames={480} fps={30} width={1080} height={1920} />
);
