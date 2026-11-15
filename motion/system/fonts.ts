// Fonts for motion templates. Files live in public/motion/fonts, so they load the same way in the
// Flowstate preview (Remotion Player) and in local renders (Remotion CLI, publicDir = ./public).
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

const FACES: [family: string, file: string, weight: string, style: 'normal' | 'italic'][] = [
  ['Inter', 'inter-latin-600-normal', '600', 'normal'], ['Inter', 'inter-latin-700-normal', '700', 'normal'],
  ['Inter', 'inter-latin-800-normal', '800', 'normal'], ['Inter', 'inter-latin-900-normal', '900', 'normal'],
  ['Inter', 'inter-latin-800-italic', '800', 'italic'], ['Inter', 'inter-latin-900-italic', '900', 'italic'],
  ['IBM Plex Mono', 'ibm-plex-mono-latin-400-normal', '400', 'normal'],
  ['Cormorant Garamond', 'cormorant-garamond-latin-600-normal', '600', 'normal'],
];
let loaded = false;
export const ensureFonts = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  for (const [family, file, weight, style] of FACES) loadFont({family, url: staticFile(`motion/fonts/${file}.woff2`), weight, style}).catch(() => {});
};
export const F = {inter: 'Inter', plex: 'IBM Plex Mono', cormorant: 'Cormorant Garamond'};
