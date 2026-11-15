// Remotion CLI entry for local renders of Flowstate motion projects.
//   npm run motion:studio
//   npx remotion render motion/remotion/index.ts KineticShort out/short.mp4 --props=./my-short.json
import {registerRoot} from 'remotion';
import {Root} from './Root';
registerRoot(Root);
