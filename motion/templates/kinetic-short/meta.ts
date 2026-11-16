// Editor metadata for the Kinetic Short template: one entry per scene, in timeline order.
import {CONTENT, SCENES, SHORT_LEN, type ShortContent} from './KineticShort';
import {MONEY_SUPPLY} from './presets/moneySupply';

export const KINETIC_SHORT = {
  id: 'kinetic-short',
  name: 'Kinetic Short (60s vertical)',
  width: 1080, height: 1920, fps: 30, durationInFrames: SHORT_LEN,
  scenes: [
    {key: 's1', name: 'Hook: wordmark, tiles, countdown, stamp'},
    {key: 's2', name: 'Reveal: icon, name, pill, two-tone line'},
    {key: 's3', name: 'Post card + highlight + video slot'},
    {key: 's4', name: 'Title × three swapping words over B-roll'},
    {key: 's5', name: 'Post card + image card + banner'},
    {key: 's6', name: 'Three stacked lines'},
    {key: 's7', name: 'Two-line title + reaction image'},
    {key: 's8', name: 'Article card → mono card + banner'},
    {key: 's9', name: 'Count up: A to B + unit'},
    {key: 's10', name: 'Tile ring + lock + big word'},
    {key: 's11', name: 'List card, lines highlighted'},
    {key: 's12', name: 'Seven rows: tile → word'},
    {key: 's13', name: 'Info card + highlight'},
    {key: 's14', name: 'Icon + big stat + image'},
    {key: 's15', name: 'A VS B'},
    {key: 's16', name: 'Closing question'},
  ].map((s, i) => ({...s, from: SCENES[i].from, to: SCENES[i].to})),
  presets: [
    {id: 'inflation', name: 'Inflation: what 2% does to savings', content: CONTENT},
    {id: 'money-supply', name: 'Inflation used to mean more money', content: MONEY_SUPPLY},
  ] as {id: string; name: string; content: ShortContent}[],
};
