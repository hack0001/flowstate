import React from 'react';
import {Composition, Folder} from 'remotion';
import {KineticShort, ShortSegment, SCENES, CONTENT, type ShortContent} from '../templates/kinetic-short/KineticShort';
import {KINETIC_SHORT} from '../templates/kinetic-short/meta';

// --props JSON exported from Flowstate's Motion Studio: {"content": {...}}
export const Root: React.FC = () => (
  <>
    <Composition id="KineticShort" component={KineticShort as React.FC<{content: ShortContent}>} durationInFrames={KINETIC_SHORT.durationInFrames}
      fps={30} width={1080} height={1920} defaultProps={{content: CONTENT}} />
    <Folder name="KineticShort-Segments">
      {SCENES.map((s, i) => (
        <Composition key={i} id={`KS-${String(i + 1).padStart(2, '0')}`} component={ShortSegment as React.FC<{content: ShortContent; index: number}>}
          durationInFrames={s.to - s.from} fps={30} width={1080} height={1920} defaultProps={{content: CONTENT, index: i}} />
      ))}
    </Folder>
  </>
);
