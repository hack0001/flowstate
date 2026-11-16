// Kinetic Short template (1080x1920 @30fps, 60 s), Flowstate Motion Studio.
// Kinetic Short template (1080x1920 @30fps, 60 s). Timing, layout and motion rebuilt frame by frame from the
// reference Short (see style-system/projects/kinetic-short-template.md). Content is data: edit CONTENT below.
// Media: put files in public/assets and set `src` on a slot; empty slots render as labelled placeholders.
import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, interpolateColors, staticFile, useCurrentFrame} from 'remotion';
import {BRAND} from '../../system/brand';
import {F, ensureFonts} from '../../system/fonts';
import {Icon, IconName} from '../../system/icons';

// ───────── brand tokens for this template ─────────
const C = {bg: BRAND.base, white: BRAND.text, red: BRAND.red, grey: '#6E6E70', dim: '#2A2D33', card: '#FFFFFF', ink: '#1A1A1A', hl: 'rgba(193,80,73,0.38)', teal: BRAND.teal, gold: BRAND.gold};
const Y0 = 114; // reference layout was 1080x1692; centred in 1920
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const p = (f: number, s: number, d: number) => ease(interpolate(f, [s, s + d], [0, 1], clamp));
/** Auto-fit: shrink a heavy caps line so it never exceeds maxW px (Inter Black ≈ 0.66 em per glyph). */
export const fit = (text: string, size: number, maxW = 960) => Math.min(size, maxW / (Math.max(1, text.length) * 0.74));

type Slot = {label: string; src?: string; video?: boolean};

// ───────── CONTENT (swap this block per video) ─────────
export const CONTENT = {
  s1: {wordmark: 'THE DOLLAR', tiles: ['Rt', 'Fd', 'En', 'Cr', 'Hs', 'Ed', 'Hc'], from: 100, to: 50, suffix: '/35Y', stamp: 'HALVED'},
  s2: {icon: 'Landmark' as IconName, name: 'THE FED', pill: 'OFFICIAL TARGET', big: ['TARGET', '2%']},
  s3: {name: 'Sound Money', handle: '@soundmoney', lines: ['inflation isn\'t just prices going up anymore', 'it\'s your money buying less every year.'],
    body: 'at 2% a year, $100 of savings is worth about $82 after ten years and about $50 after thirty-five.', media: {label: 'VIDEO SLOT · 3-up clips', video: true} as Slot},
  s4: {title: 'PRICES', words: ['RENT', 'FOOD', 'ENERGY'], media: [{label: 'B-ROLL SLOT · rent'}, {label: 'B-ROLL SLOT · groceries'}, {label: 'B-ROLL SLOT · energy'}] as Slot[], credit: 'B-ROLL · YOUR SOURCE HERE'},
  s5: {name: 'Sound Money', handle: '@soundmoney', text: ['same basket of groceries.', 'bigger number every single year.'], hlWords: 'bigger number', card: {label: 'IMAGE SLOT · receipt'} as Slot, banner: 'EVERY SINGLE YEAR'},
  s6: {lines: ['IT\'S NOT', 'THE', 'PRICES...']},
  s7: {lines: ['IT\'S THE', 'RULER'], media: {label: 'IMAGE SLOT · reaction'} as Slot},
  s8: {kicker: 'EXPLAINER', title: 'What 2% Inflation Does to $100', sub: 'A plain guide to purchasing power over time',
    body: ['At a 2% annual rate, $100 today buys about', 'what $82 bought ten years ago, falling to about ', '$50', ' after thirty-five years.'], footer: 'SOUNDMONEY',
    mono: ['• 10 years:  $82.03', '• 20 years:  $67.30', '• 35 years:  $50.00', '• Rate: 2% a year, compounded'], monoHl: [1, 2], banner: 'SILENT TAX'},
  s9: {pill: '$10,000 IN SAVINGS', a: 10000, b: 5000, unit: 'IN 35 YEARS', media: [{label: 'IMAGE SLOT · empty wallet'}, {label: 'IMAGE SLOT · reaction'}] as Slot[]},
  s10: {pill: 'HOLDING CASH', word: 'STUCK'},
  s11: {pill: 'THE MATHS', head: 'Here is what $10,000 is worth at 2% a year:',
    lines: ['Year 0 ........ $10,000', 'Year 5 ......... $9,057', 'Year 10 ........ $8,203', 'Year 15 ........ $7,430', 'Year 20 ........ $6,730', 'Year 25 ........ $6,095', 'Year 30 ........ $5,521', 'Year 35 ........ $5,000'],
    foot: ['Same notes in the drawer. Half the shopping.', 'Calculation: $10,000 ÷ 1.02ⁿ'], hl: [0, 1, 2, 3, 4, 5, 6, 7]},
  s12: {items: ['RENT', 'FOOD', 'ENERGY', 'CARS', 'HOUSES', 'STOCKS', 'GOLD'], pill: 'ALL MEASURED IN DOLLARS'},
  s13: {title: 'Purchasing Power of $1', sub: 'What one dollar buys at 2% inflation, year by year.', body: ['After 35 years:', ' worth ~$0.50 ', '· Lost: ', '~50%', ' of its value.'], footer: 'SOUNDMONEY · THE MATHS'},
  s14: {icon: 'TrendingDown' as IconName, number: '50%', label: 'OF YOUR SAVINGS, GONE', media: {label: 'IMAGE SLOT · shocked reaction'} as Slot},
  s15: {a: 'SAVERS', b: 'INFLATION', bIcon: 'TrendingUp' as IconName},
  s16: {top: 'SOUND MONEY', lines: [['IS YOUR MONEY', 'w'], ['SHRINKING', 'r'], ['TOO?', 'w']] as [string, 'w' | 'r'][], sizes: [118, 172, 200]},
};

export type ShortContent = typeof CONTENT;
const Ctx = React.createContext<ShortContent>(CONTENT);
const useC = () => React.useContext(Ctx);
export const ContentProvider: React.FC<{content: ShortContent; children: React.ReactNode}> = ({content, children}) => <Ctx.Provider value={content}>{children}</Ctx.Provider>;

// ───────── primitives ─────────
/** Heavy italic caps that "settle": appear grey + soft, then resolve to colour (8 f). */
const K: React.FC<{text: string; f: number; at: number; x?: number; y: number; size: number; color?: string; align?: 'center' | 'left'; upright?: boolean; style?: React.CSSProperties}> = ({text, f, at, x = 540, y, size, color = C.white, align = 'center', upright, style}) => {
  if (f < at) return null;
  const t = interpolate(f, [at, at + 8], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: align === 'center' ? x - 1000 : x, width: align === 'center' ? 2000 : undefined, top: y, textAlign: align, fontFamily: F.inter, fontWeight: 900,
      fontStyle: upright ? 'normal' : 'italic', fontSize: fit(text, size), lineHeight: 1, letterSpacing: '-0.015em', textTransform: 'uppercase', whiteSpace: 'pre',
      color: interpolateColors(t, [0, 1], [C.grey, color]), opacity: interpolate(f, [at, at + 3], [0, 1], clamp), filter: t < 0.7 ? `blur(${(1 - t / 0.7) * 5}px)` : undefined, ...style}}>{text}</div>
  );
};
/** Slam-in: big + translucent → settles (5 f). */
const slam = (f: number, at: number, from = 1.6): React.CSSProperties => {
  const t = p(f, at, 5);
  return {opacity: f < at ? 0 : 0.5 + 0.5 * t, transform: `scale(${from + (1 - from) * t})`};
};
const Pill: React.FC<{text: string; f: number; at: number; y: number; x?: number; icon?: IconName}> = ({text, f, at, y, x = 540, icon}) => {
  if (f < at) return null;
  const t = interpolate(f, [at, at + 6], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', opacity: t, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 30px', borderRadius: 40,
      background: '#232326', border: '2px solid #3A3A3E', fontFamily: F.inter, fontWeight: 800, fontSize: 30, letterSpacing: '0.06em', color: interpolateColors(t, [0, 1], [C.grey, C.white]), whiteSpace: 'nowrap'}}>
      {icon ? <Icon name={icon} size={30} color={C.red} stroke={3} /> : <span style={{width: 10, height: 10, borderRadius: 5, background: C.red}} />}{text}
    </div>
  );
};
const Tile: React.FC<{code: string; x: number; y: number; s: number; f: number; at: number; i: number}> = ({code, x, y, s, f, at, i}) => {
  if (f < at) return null;
  const t = p(f, at, 5);
  const col = [C.teal, C.gold, C.red, C.white][i % 4];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: s * 0.22, background: `color-mix(in srgb, ${col} 14%, #141518)`, border: `${Math.max(3, s * 0.035)}px solid ${col}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.inter, fontWeight: 800, fontSize: s * 0.42, color: col, opacity: t, transform: `scale(${0.6 + 0.4 * t})`, boxShadow: `0 0 ${s * 0.15}px color-mix(in srgb, ${col} 25%, transparent)`}}>{code}</div>
  );
};
const MediaSlot: React.FC<{slot: Slot; x: number; y: number; w: number; h: number; rot?: number; radius?: number; style?: React.CSSProperties}> = ({slot, x, y, w, h, rot = 0, radius = 24, style}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: radius, overflow: 'hidden', transform: `rotate(${rot}deg)`, boxShadow: '0 30px 60px rgba(0,0,0,.55)', background: C.dim, ...style}}>
    {slot.src ? (slot.video ? <OffthreadVideo src={staticFile(slot.src)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <Img src={staticFile(slot.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />) : (
      <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, #2A2D33 0 22px, #25282E 22px 44px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16}}>
        <Icon name={slot.video ? 'Film' as IconName : 'Image' as IconName} size={Math.min(96, w * 0.18)} color="#5C616B" />
        <div style={{fontFamily: F.inter, fontWeight: 700, fontSize: Math.min(30, w * 0.05), color: '#7A808B', letterSpacing: '0.04em', textAlign: 'center', padding: '0 20px'}}>{slot.label}</div>
      </div>
    )}
  </div>
);
const Banner: React.FC<{text: string; f: number; at: number; y: number; rot?: number}> = ({text, f, at, y, rot = -5}) => {
  if (f < at) return null;
  const t = p(f, at, 5);
  return (
    <div style={{position: 'absolute', left: -60, right: -60, top: y, transform: `rotate(${rot}deg) translateX(${(1 - t) * -900}px) scale(${1.25 - 0.25 * t})`, background: C.red, padding: '10px 0', textAlign: 'center',
      fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: 70, color: C.white, letterSpacing: '0.01em', boxShadow: '0 16px 40px rgba(0,0,0,.45)'}}>{text}</div>
  );
};
const Highlight: React.FC<{f: number; at: number; children: React.ReactNode}> = ({f, at, children}) => {
  const t = p(f, at, 8);
  return <span style={{position: 'relative', display: 'inline'}}><span style={{position: 'absolute', left: -3, top: '6%', height: '92%', width: `calc(${t * 100}% + 6px)`, background: C.hl, borderRadius: 4}} /><span style={{position: 'relative'}}>{children}</span></span>;
};
/** Generic social post card (no third-party branding). */
const PostCard: React.FC<{name: string; handle: string; children: React.ReactNode; y: number; w?: number}> = ({name, handle, children, y, w = 990}) => (
  <div style={{position: 'absolute', left: 540 - w / 2, top: y, width: w, background: C.card, borderRadius: 28, padding: '34px 38px 26px', boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,.5)', fontFamily: F.inter, color: C.ink}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
      <div style={{width: 74, height: 74, borderRadius: 37, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontStyle: 'italic', color: C.gold, fontSize: 30}}>SM</div>
      <div><div style={{fontWeight: 800, fontSize: 32}}>{name} <span style={{color: C.teal}}>●</span></div><div style={{fontSize: 26, color: '#6B6F76'}}>{handle} · <span style={{color: C.teal, fontWeight: 700}}>Follow</span></div></div>
      <div style={{marginLeft: 'auto', fontSize: 40, fontWeight: 300, color: '#333'}}>×</div>
    </div>
    <div style={{marginTop: 24, fontSize: 44, lineHeight: 1.35}}>{children}</div>
    <div style={{display: 'flex', gap: 34, marginTop: 22, paddingTop: 16, borderTop: '1px solid #E4E6EA', fontSize: 26, fontWeight: 700, color: '#555'}}>
      <span style={{color: C.red}}>♥ 12.4K</span><span>💬 Reply</span><span>🔗 Copy link</span>
    </div>
  </div>
);
const fadeOut = (f: number, at: number, d = 8) => interpolate(f, [at, at + d], [1, 0], clamp);
const dissolveIn = (f: number, d = 8): React.CSSProperties => ({opacity: interpolate(f, [0, d], [0, 1], clamp), transform: `scale(${interpolate(f, [0, d], [1.06, 1], clamp)})`});

// ───────── scenes (local frames) ─────────
const S1: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s1;
  const val = interpolate(f, [86, 102], [c.from, c.to], clamp);
  const row1 = [99, 330, 562, 796]; const row2 = [212, 441, 680];
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 118, 10)}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 225, textAlign: 'center', fontFamily: F.inter, fontWeight: 900, fontSize: fit(c.wordmark, 150), letterSpacing: '-0.03em', color: C.red, opacity: interpolate(f, [0, 6], [0, 1], clamp)}}>{c.wordmark}</div>
      {c.tiles.map((code, i) => <Tile key={i} code={code} i={i} s={198} x={i < 4 ? row1[i] : row2[i - 4]} y={Y0 + (i < 4 ? 585 : 819)} f={f} at={32 + i * 3} />)}
      {f >= 66 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 1130, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: 160, letterSpacing: '-0.02em',
          color: interpolateColors(interpolate(f, [66, 74], [0, 1], clamp), [0, 1], [C.grey, C.white]), opacity: interpolate(f, [66, 69], [0, 1], clamp)}}>
          ${val.toFixed(2)}<span style={{fontSize: 60, color: '#BDBDBD', marginLeft: 8}}>{c.suffix}</span>
        </div>
      )}
      {f >= 96 && (
        <div style={{position: 'absolute', left: 540, top: Y0 + 1470, transform: 'translate(-50%, -50%) rotate(-8deg)'}}>
          <div style={{...slam(f, 96, 1.8), border: `12px solid ${C.red}`, borderRadius: 18, padding: '6px 46px', fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: 170, color: C.red, letterSpacing: '0.02em',
            background: 'rgba(193,80,73,0.08)'}}>{c.stamp}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const S2: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s2;
  const it = p(f, 0, 8);
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 98)}}>
      <div style={{position: 'absolute', left: 540 - 85, top: Y0 + 520, opacity: it, transform: `scale(${0.8 + 0.2 * it})`}}><Icon name={c.icon} size={170} stroke={4.5} color={C.gold} /></div>
      <K text={c.name} f={f} at={2} y={Y0 + 702} size={150} />
      <Pill text={c.pill} f={f} at={36} y={Y0 + 905} />
      {f >= 46 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 1100, textAlign: 'center', fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: fit(`${c.big[0]} ${c.big[1]}`, 175), letterSpacing: '-0.02em', whiteSpace: 'pre',
          opacity: interpolate(f, [46, 49], [0, 1], clamp)}}>
          <span style={{color: interpolateColors(interpolate(f, [46, 54], [0, 1], clamp), [0, 1], [C.grey, C.white])}}>{c.big[0]} </span>
          <span style={{color: interpolateColors(interpolate(f, [46, 54], [0, 1], clamp), [0, 1], ['#7a3a35', C.red])}}>{c.big[1]}</span>
        </div>
      )}
      {f >= 58 && <div style={{position: 'absolute', left: 540 + 230, top: Y0 + 1320 + (1 - p(f, 58, 8)) * 30, opacity: p(f, 58, 6)}}><Icon name={'Pointer' as IconName} size={120} stroke={3.5} color={C.gold} /></div>}
    </AbsoluteFill>
  );
};

const S3: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s3;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 66), ...dissolveIn(f)}}>
      <PostCard name={c.name} handle={c.handle} y={Y0 + 60}>
        <div>{c.lines[0]}</div>
        <div style={{marginTop: 22}}><Highlight f={f} at={14}>{c.lines[1]}</Highlight></div>
        <div style={{marginTop: 24, fontSize: 40, color: '#333'}}>{c.body}</div>
        <div style={{position: 'relative', height: 560, marginTop: 26}}><MediaSlot slot={c.media} x={0} y={0} w={914} h={560} radius={20} style={{boxShadow: 'none'}} /></div>
      </PostCard>
    </AbsoluteFill>
  );
};

const S4: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s4;
  const words = [{at: 38, out: 64}, {at: 78, out: 118}, {at: 124, out: 999}];
  const cut = [0, 66, 120];
  const mi = f >= cut[2] ? 2 : f >= cut[1] ? 1 : 0;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 148)}}>
      <K text={`${c.title} ×`} f={f} at={0} y={Y0 + 333} size={150} />
      {words.map((w, i) => f >= w.at && f < w.out + 6 ? <div key={i} style={{opacity: fadeOut(f, w.out, 6)}}><K text={c.words[i]} f={f} at={w.at} y={Y0 + 490} size={170} color={C.red} /></div> : null)}
      {c.media.map((m, i) => (mi === i || (mi === i + 1 && f < cut[i + 1] + 6)) ? (
        <div key={i} style={{opacity: mi === i ? interpolate(f, [cut[i], cut[i] + 6], [i === 0 ? 1 : 0, 1], clamp) : 1}}><MediaSlot slot={m} x={20} y={Y0 + 660} w={1040} h={585} radius={10} /></div>) : null)}
      <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 1275, textAlign: 'center', fontFamily: F.inter, fontWeight: 800, fontSize: 24, letterSpacing: '0.12em', color: '#8A8A8E'}}>{c.credit}</div>
    </AbsoluteFill>
  );
};

const S5: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s5;
  const [pre, post] = c.text[1].split(c.hlWords);
  const rise = p(f, 64, 8);
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 132), ...dissolveIn(f)}}>
      <PostCard name={c.name} handle={c.handle} y={Y0 + 40}>
        <div>{c.text[0]}</div>
        <div>{pre}<Highlight f={f} at={100}>{c.hlWords}</Highlight>{post}</div>
      </PostCard>
      {f >= 64 && <MediaSlot slot={c.card} x={120} y={Y0 + 560 + (1 - rise) * 160} w={840} h={720} rot={-1.5} style={{opacity: rise}} />}
      <Banner text={c.banner} f={f} at={108} y={Y0 + 1250} />
    </AbsoluteFill>
  );
};

const S6: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s6;
  return <AbsoluteFill style={{opacity: fadeOut(f, 32)}}>{c.lines.map((l, i) => <K key={i} text={l} f={f} at={i * 2} y={Y0 + 634 + i * 141} size={165} />)}</AbsoluteFill>;
};

const S7: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s7;
  const rise = p(f, 0, 8);
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 76)}}>
      <K text={c.lines[0]} f={f} at={24} y={Y0 + 238} size={150} />
      <K text={c.lines[1]} f={f} at={26} y={Y0 + 392} size={150} color={C.red} />
      <MediaSlot slot={c.media} x={250} y={Y0 + 820 + (1 - rise) * 200} w={580} h={640} rot={3} style={{opacity: rise, border: '8px solid #EDEDED'}} />
    </AbsoluteFill>
  );
};

const S8: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s8;
  const up = p(f, 70, 10); const c2 = p(f, 72, 10);
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 124), ...dissolveIn(f)}}>
      <div style={{position: 'absolute', left: 40, top: Y0 + 600 - 360 * up, width: 1000, background: '#FBFAF7', borderRadius: 18, padding: '40px 48px', boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,.5)', color: C.ink}}>
        <div style={{fontFamily: F.plex, fontSize: 20, letterSpacing: '0.2em', color: C.teal}}>{c.kicker}</div>
        <div style={{fontFamily: F.cormorant, fontWeight: 600, fontSize: 78, lineHeight: 1.05, marginTop: 10}}>{c.title}</div>
        <div style={{fontFamily: F.inter, fontSize: 34, color: '#555', marginTop: 18}}>{c.sub}</div>
        <div style={{fontFamily: F.inter, fontWeight: 600, fontSize: 36, lineHeight: 1.45, marginTop: 24}}>{c.body[0]}<br />{c.body[1]}<Highlight f={f} at={58}>{c.body[2]}</Highlight>{c.body[3]}</div>
      </div>
      <div style={{position: 'absolute', left: 540, top: Y0 + 1100 - 360 * up, transform: 'translateX(-50%)', fontFamily: F.inter, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: '#77777B', opacity: 1 - up}}>{c.footer}</div>
      {f >= 72 && (
        <div style={{position: 'absolute', left: 40, top: Y0 + 740 + (1 - c2) * 400, width: 1000, background: '#FBFAF7', borderRadius: 18, padding: '36px 48px 70px', boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,.5)',
          fontFamily: F.plex, fontSize: 34, lineHeight: 1.7, color: '#2A2A2A', opacity: c2}}>
          {c.mono.map((l, i) => <div key={i} style={{whiteSpace: 'pre'}}>{c.monoHl.includes(i) ? <Highlight f={f} at={92 + c.monoHl.indexOf(i) * 4}>{l}</Highlight> : l}</div>)}
        </div>
      )}
      <Banner text={c.banner} f={f} at={110} y={Y0 + 1290} />
    </AbsoluteFill>
  );
};

const S9: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s9;
  const big = (v: number, at: number, y: number) => f >= at ? (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: fit(`$${c.a.toLocaleString('en-US')}`, 205), lineHeight: 1, letterSpacing: '-0.03em',
      color: interpolateColors(interpolate(f, [at, at + 6], [0, 1], clamp), [0, 1], [C.grey, C.white])}}>${Math.round(v).toLocaleString('en-US')}</div>) : null;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 144)}}>
      <Pill text={c.pill} f={f} at={0} y={Y0 + 200} />
      {big(interpolate(f, [48, 64], [0, c.a], clamp), 44, Y0 + 420)}
      <K text="TO" f={f} at={76} y={Y0 + 650} size={64} color="#9A9A9E" />
      {big(interpolate(f, [92, 108], [0, c.b], clamp), 92, Y0 + 740)}
      <K text={c.unit} f={f} at={116} y={Y0 + 975} size={100} color={C.red} />
      {f >= 104 && <MediaSlot slot={c.media[f >= 132 ? 1 : 0]} x={330} y={Y0 + 1180 + (1 - p(f, 104, 8)) * 200} w={420} h={480} rot={2} style={{opacity: p(f, 104, 8), border: '8px solid #EDEDED'}} />}
    </AbsoluteFill>
  );
};

const S10: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s10;
  const cx = 540; const cy = Y0 + 840; const R = 340; const rot = f * 0.06;
  const codes = [...useC().s1.tiles];
  const lock = p(f, 36, 6);
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 178)}}>
      <Pill text={c.pill} f={f} at={82} y={Y0 + 300} />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#4A4A4E" strokeWidth={4} strokeDasharray="10 16" strokeDashoffset={-f * 1.5} opacity={p(f, 0, 10)} />
      </svg>
      {codes.map((code, i) => {
        const a = ((-90 + i * (360 / 7) + rot) * Math.PI) / 180;
        return <Tile key={i} code={code} i={i} s={166} x={cx + R * Math.cos(a) - 83} y={cy + R * Math.sin(a) - 83} f={f} at={i * 2} />;
      })}
      {f >= 136 && <div style={{position: 'absolute', left: cx + R * 1.05, top: cy - R * 0.95, width: 90, height: 90, borderRadius: 20, border: '4px dashed #6A6A6E', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: F.inter, fontWeight: 900, fontSize: 54, color: '#8A8A8E', opacity: p(f, 136, 6)}}>?</div>}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: p(f, 6, 8)}}><circle cx={cx} cy={cy - 52} r={34} fill={C.white} /><path d={`M ${cx - 66} ${cy + 72} Q ${cx - 66} ${cy - 6} ${cx} ${cy - 6} Q ${cx + 66} ${cy - 6} ${cx + 66} ${cy + 72} Z`} fill={C.white} /></svg>
      {f >= 36 && <div style={{position: 'absolute', left: cx + 20, top: cy + 10, width: 74, height: 74, borderRadius: 37, background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', ...slam(f, 36, 1.8)}}>
        <Icon name={'Lock' as IconName} size={42} stroke={4} color={C.white} /></div>}
      {lock > 0 && <K text={c.word} f={f} at={36} y={Y0 + 1318} size={270} color={C.red} />}
    </AbsoluteFill>
  );
};

const S11: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s11;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 146)}}>
      <Pill text={c.pill} f={f} at={20} y={Y0 + 520} />
      <div style={{position: 'absolute', left: 20, top: Y0 + 640, width: 1040, background: C.card, borderRadius: 16, padding: '34px 40px', boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,.5)', color: C.ink, ...dissolveIn(f)}}>
        <div style={{fontFamily: F.inter, fontSize: 30, fontWeight: 700}}>{c.head}</div>
        <div style={{fontFamily: F.plex, fontSize: 32, lineHeight: 1.6, marginTop: 14, color: '#1F5FA8'}}>
          {c.lines.map((l, i) => <div key={i} style={{whiteSpace: 'pre', minHeight: '1.6em'}}>{c.hl.includes(i) ? <Highlight f={f} at={50 + c.hl.indexOf(i) * (c.hl.length < 8 ? 18 : 9)}>{l}</Highlight> : l}</div>)}
        </div>
        <div style={{fontFamily: F.inter, fontSize: 28, marginTop: 16, color: '#333'}}>{c.foot[0]}</div>
        <div style={{fontFamily: F.inter, fontSize: 24, marginTop: 8, color: '#888'}}>{c.foot[1]}</div>
      </div>
    </AbsoluteFill>
  );
};

const S12: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s12; const tiles = useC().s1.tiles;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 90)}}>
      {c.items.map((it, i) => (
        <React.Fragment key={i}>
          <Tile code={tiles[i]} i={i} s={128} x={94} y={Y0 + 356 + i * 157} f={f} at={i * 4} />
          {f >= i * 4 + 2 && <div style={{position: 'absolute', left: 262, top: Y0 + 390 + i * 157, opacity: p(f, i * 4 + 2, 6)}}><Icon name={'ArrowRight' as IconName} size={56} stroke={5} color="#9A9A9E" /></div>}
          <K text={it} f={f} at={i * 4 + 2} x={371} align="left" y={Y0 + 380 + i * 157} size={80} />
        </React.Fragment>
      ))}
      <Pill text={c.pill} f={f} at={52} y={Y0 + 1480} />
    </AbsoluteFill>
  );
};

const S13: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s13;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 82), ...dissolveIn(f)}}>
      <div style={{position: 'absolute', left: 40, top: Y0 + 640, width: 1000, background: C.card, borderRadius: 16, padding: '40px 46px', boxSizing: 'border-box', boxShadow: '0 30px 70px rgba(0,0,0,.5)', color: C.ink, fontFamily: F.inter}}>
        <div style={{fontWeight: 800, fontSize: 64}}>{c.title}</div>
        <div style={{fontSize: 38, color: '#555', marginTop: 20}}>{c.sub}</div>
        <div style={{fontSize: 42, marginTop: 26, lineHeight: 1.5}}><b>{c.body[0]}</b>{c.body[1]}{c.body[2]}<Highlight f={f} at={68}><b>{c.body[3]}</b></Highlight>{c.body[4]}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 1100, textAlign: 'center', fontFamily: F.inter, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: '#77777B'}}>{c.footer}</div>
    </AbsoluteFill>
  );
};

const S14: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s14;
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 74)}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 180, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: p(f, 0, 6)}}>
        <Icon name={c.icon} size={120} stroke={5} color={C.red} />
        <span style={{fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: 170, color: C.white, letterSpacing: '-0.02em'}}>{c.number}</span>
      </div>
      <K text={c.label} f={f} at={2} y={Y0 + 400} size={62} color="#BDBDBD" />
      <MediaSlot slot={c.media} x={170} y={Y0 + 560} w={740} h={480} rot={2} style={{opacity: p(f, 0, 6)}} />
    </AbsoluteFill>
  );
};

const S15: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s15;
  const a = p(f, 0, 8); const b = p(f, 34, 8);
  return (
    <AbsoluteFill style={{opacity: fadeOut(f, 52)}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 432, textAlign: 'center', fontFamily: F.inter, fontWeight: 900, fontSize: fit(c.a, 160), letterSpacing: '-0.03em', color: C.red, opacity: a, transform: `translateX(${(1 - a) * -80}px)`}}>{c.a}</div>
      {f >= 18 && <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 760, textAlign: 'center', fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: 280, color: C.red, ...slam(f, 18, 1.5)}}>VS</div>}
      {f >= 34 && <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: b, transform: `translateX(${(1 - b) * 120}px)`}}>
        <Icon name={c.bIcon} size={140} stroke={5} color={C.white} />
        <span style={{fontFamily: F.inter, fontWeight: 900, fontStyle: 'italic', fontSize: fit(c.b, 100), color: C.white}}>{c.b}</span>
      </div>}
    </AbsoluteFill>
  );
};

const S16: React.FC = () => {
  const f = useCurrentFrame(); const c = useC().s16;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: Y0 + 414, textAlign: 'center', fontFamily: F.inter, fontWeight: 900, fontSize: fit(c.top, 110), letterSpacing: '-0.03em', color: C.red, opacity: p(f, 0, 6)}}>{c.top}</div>
      {c.lines.map(([t, col], i) => <K key={i} text={t} f={f} at={i * 16} y={Y0 + 693 + [0, 150, 350][i]} size={c.sizes[i]} color={col === 'r' ? C.red : C.white} />)}
    </AbsoluteFill>
  );
};

// ───────── timeline (global frames; measured from the reference) ─────────
export const SCENES: {C: React.FC; from: number; to: number}[] = [
  {C: S1, from: 0, to: 128}, {C: S2, from: 156, to: 262}, {C: S3, from: 254, to: 328}, {C: S4, from: 326, to: 484}, {C: S5, from: 480, to: 620},
  {C: S6, from: 620, to: 660}, {C: S7, from: 656, to: 740}, {C: S8, from: 738, to: 870}, {C: S9, from: 880, to: 1032}, {C: S10, from: 1032, to: 1218},
  {C: S11, from: 1218, to: 1376}, {C: S12, from: 1380, to: 1478}, {C: S13, from: 1476, to: 1566}, {C: S14, from: 1564, to: 1646}, {C: S15, from: 1662, to: 1722}, {C: S16, from: 1720, to: 1800},
];
export const SHORT_LEN = 1800;
export const KineticShort: React.FC<{content?: ShortContent}> = ({content = CONTENT}) => { ensureFonts(); return (
  <ContentProvider content={content}>
    <AbsoluteFill style={{background: C.bg}}>
      {SCENES.map((s, i) => <Sequence key={i} from={s.from} durationInFrames={s.to - s.from}><s.C /></Sequence>)}
    </AbsoluteFill>
  </ContentProvider>
); };
/** One scene on its own (for exporting segments to cut in Premiere). */
export const ShortSegment: React.FC<{content?: ShortContent; index: number}> = ({content = CONTENT, index}) => {
  ensureFonts();
  const S = SCENES[index].C;
  return <ContentProvider content={content}><AbsoluteFill style={{background: C.bg}}><S /></AbsoluteFill></ContentProvider>;
};
