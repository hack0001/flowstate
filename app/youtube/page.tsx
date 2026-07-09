'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Circle, RotateCcw, Tv, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a'
}

// ---- Checklists ----
const CREATION_ITEMS = [
  { id:'desc',      label:'Write and publish a proper channel description', note:'Niche, audience, value you provide &mdash; written in the words your audience actually uses' },
  { id:'keywords',  label:'Add 10&ndash;15 channel keywords in YouTube Studio', note:'Settings &rarr; Basic Info &rarr; Keywords' },
  { id:'defaults',  label:'Set up upload defaults in YouTube Studio', note:'Title format, description template, tags and category pre-filled on every upload' },
  { id:'gsc',       label:'Link your channel to Google Search Console', note:'For additional keyword data' },
  { id:'trailer',   label:'Set a channel trailer', note:'Answers one question: why subscribe right now' },
  { id:'about',     label:'Update your About page with links to other platforms', note:'Every platform you are active on' },
  { id:'playlists', label:'Create a playlist structure', note:'Organised by topic and audience intent &mdash; not chronological' },
  { id:'community', label:'Enable and set up Community tab if you have access', note:'Start the conversation with your audience' },
  { id:'comments',  label:'Set comments to open with moderation', note:'Not off &mdash; moderated' },
]

const INITIAL_CREATION = new Set(['desc', 'about', 'community', 'comments'])
const LS_KEY = 'flowstate_yt_creation'

const HEALTH_ITEMS = [
  { id:'peak',      label:'Publish at peak times', note:'YouTube Analytics &rarr; Audience tab &mdash; confirm you are hitting peak active hours and adjust schedule if not' },
  { id:'playlists', label:'Review playlist structure monthly', note:'Add new videos to the right playlists as the catalogue grows' },
  { id:'tags',      label:'Update tags on older videos periodically', note:'Move to more specific long-tail phrases as you learn what your audience searches' },
  { id:'realtime',  label:'Check real-time analytics within 2 hours of every publish', note:'Make it a habit, not an afterthought' },
  { id:'audit',     label:'Audit the channel regularly as a product', note:'Ask: who is this for and why &mdash; not just: what content can I make' },
]

const SHORTS_CHECKLIST = [
  { id:'sh-hook',     label:'First second: text on screen + 2 sounds + circle highlight on subject', note:'The only moment you have to stop the scroll &mdash; miss this and the short fails' },
  { id:'sh-length',   label:'Script is 60&ndash;80 words max', note:'One topic, one punchline, one twist. No padding whatsoever.' },
  { id:'sh-edit',     label:'New visual cut every 2 seconds minimum', note:'No static shots. If it stops moving, they stop watching.' },
  { id:'sh-captions', label:'Full captions burned in for every word', note:'85% of Shorts are watched with sound off &mdash; captions are not optional' },
  { id:'sh-sfx',      label:'Sound effects on key moments (pop, whoosh, ding)', note:'Build a dedicated sound effects folder &mdash; reuse across every short' },
  { id:'sh-loop',     label:'End frame connects back to start (plays on a loop)', note:'A loopable short increases watch time &mdash; first and last frames should match' },
  { id:'sh-cover',    label:'Cover frame is strong before posting', note:'The still frame the algorithm shows before anyone presses play' },
  { id:'sh-watch',    label:'Watch it as a viewer at 1x &mdash; does it hold every second?', note:'If you want to skip, they will swipe. Re-edit that moment.' },
]
const LS_SHORTS = 'flowstate_yt_shorts'

// ---- Production SOPs ----
type SOP = { id: string; icon: string; title: string; tagline: string; steps: string[] }

const SOPS: SOP[] = [
  {
    id:'01', icon:'&#128161;', title:'Idea & Validation',
    tagline:'Commit only to topics that have demand, a clear angle, and meme/story potential.',
    steps:[
      'Brain-dump 3&ndash;5 ideas &mdash; economics in the news, trending Reddit threads (r/economics, r/wallstreetbets), Financial Times headlines',
      'Search YouTube for each idea. Watch the top 3 results. Ask: what&apos;s missing? Too dry? Too shallow? No humour? That&apos;s your opening.',
      'Find your angle &mdash; historical parallel, contrarian take, or absurd analogy. Formula: <em>big topic + unexpected frame</em>',
      'Write the one-line pitch: &ldquo;This video explains X by showing Y.&rdquo; If you can&apos;t do it in one line, it&apos;s probably two videos.',
      'Confirm format: long-form deep-dive or Short hook/punchline?',
      'Check whether there&apos;s a Short hiding inside the long-form topic &mdash; one stat, one absurd fact, one wild historical moment.',
      'Name the project and create the folder: <code>/videos/YYYY-MM_topic-name/</code>',
    ],
  },
  {
    id:'02', icon:'&#128218;', title:'Research',
    tagline:'Build the facts, stories, rabbit holes and meme potential before you write a word.',
    steps:[
      'Spend 60&ndash;90 min reading deeply: Wikipedia (follow footnotes), academic papers, news archives, Google Scholar for stats',
      'Find 2&ndash;3 wild statistics or counterintuitive facts &mdash; these become your hook and most shareable moments',
      'Find at least one historical parallel (Tulip mania, Bretton Woods, South Sea Bubble &mdash; economics repeats itself)',
      'Identify the &ldquo;villain&rdquo;, &ldquo;hero&rdquo; or turning point &mdash; good economics content always has a character or institution to root for or against',
      'Write down the one key idea the viewer should leave with. Build back from that.',
      'Source every fact &mdash; note URLs in a doc so you can sanity-check before publishing',
      'Scan for meme potential: check Know Your Meme, Twitter/X, Reddit for existing references your audience will already recognise',
    ],
  },
  {
    id:'03', icon:'&#128221;', title:'Scripting',
    tagline:'Write tight, write fast, write funny. The script is your production blueprint.',
    steps:[
      '<strong>The format rhythm (Fireship-style):</strong> Intense info &rarr; brief absurd joke &rarr; back to info. Vary constantly. Never let the viewer predict the next beat.',
      'Write the hook first &mdash; first 15 seconds for long form, first 3 for Short. Open with the wildest stat, a bold claim, or a question that makes stopping feel impossible',
      'Build a 5&ndash;8 section outline. Each section = one idea + one beat + one joke or moment',
      'Write full script word-for-word &mdash; write how you <em>speak</em>, not how you write. Read every line aloud as you go.',
      'For Shorts: 60&ndash;80 words max. One topic, one punchline, one twist. No padding.',
      'Mark <strong>[MEME]</strong> tags wherever a meme will sit &mdash; every 60&ndash;90 seconds on long form',
      'Mark <strong>[B-ROLL: description]</strong> for every visual moment. Be specific: <code>[B-ROLL: stock market ticker going red]</code>',
      'Write the CTA conversationally &mdash; not like an ad. <em>&ldquo;If that surprised you, wait for the next one&rdquo;</em>',
      'Read the full script aloud and time it. If you&apos;re bored reading it, the viewer is bored watching it. Cut.',
    ],
  },
  {
    id:'04', icon:'&#127912;', title:'Asset Gathering',
    tagline:'Have every meme, b-roll clip, and chart ready before you record.',
    steps:[
      '<strong>Memes:</strong> imgflip, giphy, Twitter/X, Reddit, Know Your Meme &mdash; save to <code>/assets/memes/</code> with descriptive filenames',
      '<strong>B-roll (free):</strong> Pexels, Pixabay, Coverr, Archive.org (great for historical footage) &mdash; save to <code>/assets/broll/</code>',
      '<strong>B-roll (paid):</strong> Storyblocks, Envato Elements',
      '<strong>Charts &amp; data visuals:</strong> Datawrapper and Flourish are fast and free &mdash; export as MP4 with build animation, save to <code>/assets/charts/</code>',
      'Organise before recording: <code>/memes/</code> <code>/broll/</code> <code>/charts/</code> <code>/audio/</code> <code>/vo/</code>',
      'For Shorts: 3&ndash;5 punchy clips max, each under 3 seconds',
      'Tidy projects save hours in the edit &mdash; never skip the folder structure',
    ],
  },
  {
    id:'05', icon:'&#127908;', title:'Voiceover Recording',
    tagline:'Your voice is the whole performance. Capture it with energy, clarity, and pace.',
    steps:[
      '<strong>Setup:</strong> Remove echo with blankets, heavy curtains, or record inside a wardrobe full of clothes',
      'Do a 30-second test and listen back &mdash; check for hiss, echo, room noise, and levels',
      'Warm up your voice &mdash; 5 min speaking aloud before hitting record. Cold voice sounds flat.',
      'Record section by section &mdash; one script chunk per take. Label files: <code>vo_01_hook.wav</code>, <code>vo_02_section1.wav</code>',
      'Match your energy to the script: fast sections fast, punchy moments punchy',
      'Re-record any line that sounds flat or unconvincing. You will hear every weak line a thousand times in the edit.',
      'For Shorts: record in 1&ndash;2 takes, energy must be immediate from the first word',
      'Keep any spontaneous ad-libs or jokes you discover during recording &mdash; often your best moments',
    ],
  },
  {
    id:'06', icon:'&#9986;', title:'Editing (Fast-Cut Faceless)',
    tagline:'Build the dense, fast, funny visual style that defines this format.',
    steps:[
      '<strong>Golden rules:</strong> VO goes on first. Everything hangs off it. The viewer should never see a blank or static shot.',
      'Memes land on the punchline, not before it. Timing is everything.',
      'New visual every 2&ndash;4 seconds on long form. Every 1&ndash;2 on Shorts.',
      'Watch your edit at 2x speed. If it&apos;s boring at 2x, it&apos;s boring at 1x.',
      'Import and label all assets in bins: VO / BROLL / MEMES / MUSIC / GRAPHICS',
      'Lay the complete VO on the timeline. Don&apos;t start placing visuals until the VO is final.',
      'Cut the VO: remove every breath, pause, um, and stumble. Use Premiere auto-transcribe or Descript for speed.',
      'Place b-roll over every second of the timeline. Dense visual coverage is not optional.',
      'Add memes at every [MEME] marker. Time the visual to arrive exactly as the joke word lands.',
      'Add on-screen text captions for key stats and memorable lines &mdash; bold, high-contrast, large.',
      'For Shorts: burn in full captions for every word &mdash; 85% of Shorts are watched with sound off.',
      'Add background music &mdash; low under talking, rises on key moments. Music should <em>feel</em>, not be heard.',
      'Add sound effects on meme pops, chart animations, and key stat reveals.',
      'Colour grade: run a simple LUT across all b-roll to unify clips from different sources.',
      'Watch full edit at 1x as a viewer. Note every moment where your eyes drift. Cut it.',
      'Export long form: 1080p or 4K, 30fps, H.264. Short: 1080&times;1920 vertical, 30fps, H.264.',
    ],
  },
  {
    id:'07', icon:'&#128444;', title:'Thumbnail & SEO',
    tagline:'Win the click before they watch. The thumbnail IS the brand identity.',
    steps:[
      '<strong>Thumbnail:</strong> Bold graphic, minimal text (max 5 words), high contrast &mdash; check at 120px wide (mobile grid)',
      'No face &mdash; use charts, money visuals, bold typography, or dramatic imagery',
      'A/B test: can someone identify the topic in 2 seconds without reading the title?',
      '<strong>Title formula:</strong> [Wild Stat or Claim] + [The Surprising Reason] &mdash; write 3 options, pick the strongest curiosity gap',
      '<strong>Description:</strong> First 2 lines are indexed by Google &mdash; hook sentence + primary keyword before &ldquo;show more&rdquo;',
      'Add timestamps as chapters (every 2&ndash;3 minutes) + links: sources, socials, related videos',
      '<strong>Tags:</strong> 3 broad topic tags, 5 specific niche tags, 5 long-tail question-style tags &mdash; research with TubeBuddy or vidIQ',
    ],
  },
  {
    id:'08', icon:'&#9729;', title:'Upload & Publish',
    tagline:'Get it live and set up right before anyone sees it.',
    steps:[
      'Upload to YouTube Studio, set to Private while setting up',
      'Paste title, description, tags, chapters',
      'Upload custom thumbnail',
      'Add end screens at 20 seconds from the end: subscribe button + next video',
      'Add info cards at 2&ndash;3 relevant moments',
      'Set category: Education or News &amp; Politics. Confirm NOT marked &ldquo;made for kids&rdquo;.',
      'Review auto-captions &mdash; correct any financial terms it gets wrong',
      'Schedule at your channel&apos;s peak time (check Analytics &rarr; Audience tab)',
      'Shorts: publish immediately &mdash; they benefit from the initial engagement window',
    ],
  },
  {
    id:'09', icon:'&#128226;', title:'Post-Publish & Growth',
    tagline:"The video doesn't stop working when you hit publish.",
    steps:[
      'Community tab: post a wild stat from the video + the link within 30 min of going live',
      'Clip the funniest or most shocking 30&ndash;60 seconds as a Short (if long form)',
      'Twitter/X: post the wildest stat as a thread opener + link',
      'Reddit: r/economics, r/personalfinance, r/investing &mdash; add a sentence of value first, then the link',
      'Reply to every comment in the first 90 minutes &mdash; YouTube rewards early engagement signals',
      'Pin a comment with a provocative question to spark debate',
      'Check analytics at 48 hrs: CTR, average view duration, impressions, traffic source',
      'CTR under 4% = thumbnail/title problem. Retention drop in first 30 sec = hook problem.',
      'Log the video in the Content Tracker. Write one improvement note for the next video.',
    ],
  },
]

// ---- Components ----
function CheckItem({ id, label, note, checked, onToggle }: { id: string; label: string; note: string; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <button onClick={() => onToggle(id)} style={{
      display:'flex', alignItems:'flex-start', gap:'0.875rem',
      width:'100%', padding:'0.875rem 1rem', textAlign:'left',
      background: checked ? 'rgba(0,255,136,0.05)' : 'rgba(255,255,255,0.02)',
      border: '1px solid '+(checked ? 'rgba(0,255,136,0.2)' : C.border),
      borderRadius:'0.875rem', cursor:'pointer', fontFamily:'inherit',
      transition:'all 0.15s ease',
    }}>
      <div style={{ flexShrink:0, marginTop:'1px', color: checked ? C.green : C.muted, transition:'color 0.15s' }}>
        {checked ? <CheckCircle size={18} /> : <Circle size={18} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.875rem', fontWeight:600, margin:'0 0 0.2rem', color: checked ? C.green : C.text, transition:'color 0.15s', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.75 : 1 }}
          dangerouslySetInnerHTML={{ __html: label }} />
        <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}
          dangerouslySetInnerHTML={{ __html: note }} />
      </div>
    </button>
  )
}

function SOPCard({ sop }: { sop: SOP }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border:'1px solid '+C.border, borderRadius:'0.875rem', overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:'0.75rem',
        padding:'1rem 1.125rem', background:'rgba(255,255,255,0.02)',
        border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left',
      }}>
        <span style={{ fontSize:'1.1rem' }} dangerouslySetInnerHTML={{ __html: sop.icon }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:'0.85rem', fontWeight:700, color:C.text, margin:'0 0 0.1rem' }}>
            <span style={{ color:C.muted, fontSize:'0.65rem', fontWeight:500, marginRight:'0.4rem' }}>SOP {sop.id}</span>
            {sop.title}
          </p>
          {!open && <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sop.tagline}</p>}
        </div>
        <ChevronDown size={16} color={C.muted} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s', flexShrink:0 }} />
      </button>
      {open && (
        <div style={{ padding:'0.25rem 1.125rem 1.125rem', borderTop:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.72rem', color:C.cyan, fontStyle:'italic', margin:'0.75rem 0 0.875rem', lineHeight:1.5 }}>{sop.tagline}</p>
          <ol style={{ margin:0, padding:'0 0 0 1.25rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {sop.steps.map((step, i) => (
              <li key={i} style={{ fontSize:'0.8rem', color:C.sec, lineHeight:1.6 }}
                dangerouslySetInnerHTML={{ __html: step }} />
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default function YouTubePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [creation, setCreation] = useState<Set<string>>(new Set(INITIAL_CREATION))
  const [health, setHealth] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'checklists'|'shorts'|'sops'>('checklists')
  const [shorts, setShorts] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setCreation(new Set(JSON.parse(raw) as string[]))
    } catch {}
    try {
      const rs = localStorage.getItem(LS_SHORTS)
      if (rs) setShorts(new Set(JSON.parse(rs) as string[]))
    } catch {}
    setMounted(true)
  }, [])

  function toggleCreation(id: string) {
    setCreation(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  function toggleHealth(id: string) {
    setHealth(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleShorts(id: string) {
    setShorts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(LS_SHORTS, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const creationPct = Math.round(creation.size / CREATION_ITEMS.length * 100)
  const healthPct   = Math.round(health.size / HEALTH_ITEMS.length * 100)

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,212,255,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.5rem 2rem 0' }}>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem', paddingBottom:'0.75rem' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
            <ArrowLeft size={16} /> {t('back')}
          </button>
          <div style={{ flex:1 }} />
          <Tv size={18} color={C.red} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.red }}>YouTube</span>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto' }}>
          <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>{t('channelHub')}</h1>
          <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 1rem' }}>{t('checklists')} &amp; {t('productionSOPs')}</p>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', gap:'0.25rem' }}>
          {(['checklists','shorts','sops'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding:'0.7rem 1.25rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.82rem', fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? (tab === 'sops' ? C.amber : tab === 'shorts' ? C.green : C.red) : C.muted,
              borderBottom: activeTab === tab ? '2px solid '+(tab === 'sops' ? C.amber : tab === 'shorts' ? C.green : C.red) : '2px solid transparent',
              marginBottom:'-1px', transition:'all 0.15s', textTransform:'capitalize',
            }}>
              {tab === 'sops' ? t('productionSOPs') : tab === 'shorts' ? 'Shorts SOP' : t('checklists')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease' }}>

        {activeTab === 'checklists' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:'2rem', animation:'fadeInUp 0.3s ease both' }}>

            <section>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Channel Creation</h2>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>One-time setup checklist</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ fontSize:'1.3rem', fontWeight:900, color: creationPct === 100 ? C.green : C.amber }}>{creationPct}%</span>
                  <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{creation.size}/{CREATION_ITEMS.length}</p>
                </div>
              </div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease', background: creationPct === 100 ? 'linear-gradient(90deg,'+C.green+',#00cc6a)' : 'linear-gradient(90deg,'+C.amber+',#cc8800)', width:creationPct+'%' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {CREATION_ITEMS.map(item => (
                  <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={creation.has(item.id)} onToggle={toggleCreation} />
                ))}
              </div>
              {creationPct === 100 && (
                <div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'0.875rem', textAlign:'center' }}>
                  <p style={{ fontSize:'0.85rem', fontWeight:700, color:C.green, margin:0 }}>Channel fully set up &#10003;</p>
                </div>
              )}
            </section>

            <section>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Health Check</h2>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Recurring review &mdash; reset each session</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {health.size > 0 && (
                    <button onClick={() => setHealth(new Set())} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  )}
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'1.3rem', fontWeight:900, color: healthPct === 100 ? C.green : C.cyan }}>{healthPct}%</span>
                    <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{health.size}/{HEALTH_ITEMS.length}</p>
                  </div>
                </div>
              </div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease', background: healthPct === 100 ? 'linear-gradient(90deg,'+C.green+',#00cc6a)' : 'linear-gradient(90deg,'+C.cyan+',#0099cc)', width:healthPct+'%' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {HEALTH_ITEMS.map(item => (
                  <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={health.has(item.id)} onToggle={toggleHealth} />
                ))}
              </div>
              <div style={{ marginTop:'1.5rem', padding:'0.875rem 1rem', background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.15)', borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.purple, margin:'0 0 0.3rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>Tip</p>
                <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.55 }}>Run the health check once a month after reviewing your analytics. It should take under 20 minutes.</p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'shorts' && (
          <div style={{ animation:'fadeInUp 0.3s ease both', display:'flex', flexDirection:'column', gap:'2rem' }}>

            {/* Upload Timing */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Upload Timing</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>When to post &mdash; the algorithm gate</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                {([
                  { icon:'&#128337;', title:'Wait for the previous short to drop below 100 views/hour for 12 hours &mdash; or flatline completely', note:'Uploading too early splits the algorithm&apos;s focus. Let one short die before feeding it another.' },
                  { icon:'&#128198;', title:'New channel: 7 days of watching before your first upload', note:'Seed the algorithm with your niche. Watch competitors and top-performing shorts in your space first.' },
                  { icon:'&#128200;', title:'3&ndash;5 Shorts per week. Do not flood.', note:'Volume is good but flooding the algorithm hurts distribution. Consistency beats bursts.' },
                  { icon:'&#9201;', title:'Expect a test phase then a 7&ndash;30 day flat period before a short goes viral', note:'If it is flat it is not dead. Give it time. Do not delete.' },
                ] as {icon:string;title:string;note:string}[]).map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.875rem', padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <span style={{ fontSize:'1.1rem', flexShrink:0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
                    <div>
                      <p style={{ fontSize:'0.83rem', fontWeight:600, color:C.text, margin:'0 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: item.title }} />
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: item.note }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Hook Formula */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>First-Second Formula</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>The hook is everything</p>
              </div>
              <div style={{ padding:'1rem 1.125rem', background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.15)', borderRadius:'0.875rem', marginBottom:'0.625rem' }}>
                <p style={{ fontSize:'0.8rem', color:C.cyan, fontWeight:700, margin:'0 0 0.75rem' }}>Within the first second:</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                  {['Text on screen', '2 sounds (pop + whoosh, or similar)', 'Circle highlight drawn on the subject'].map((s, i) => (
                    <p key={i} style={{ fontSize:'0.8rem', color:C.text, margin:0, display:'flex', gap:'0.5rem' }}>
                      <span style={{ color:C.cyan, fontWeight:700, flexShrink:0 }}>{i+1}.</span> {s}
                    </p>
                  ))}
                </div>
              </div>
              <div style={{ padding:'1rem 1.125rem', background:'rgba(255,184,0,0.04)', border:'1px solid rgba(255,184,0,0.15)', borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.75rem', fontWeight:700, color:C.amber, textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 0.4rem' }}>Hook Formula</p>
                <p style={{ fontSize:'0.82rem', color:C.text, margin:'0 0 0.3rem' }}>Statement or joke + call to action</p>
                <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>&ldquo;This economist predicted 2008 &mdash; comment below what you think happens next.&rdquo;</p>
              </div>
            </section>

            {/* Pre-Publish Checklist */}
            <section>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Pre-Publish Checklist</h2>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Run before every short goes live</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {shorts.size > 0 && (
                    <button onClick={() => { setShorts(new Set()); try { localStorage.removeItem(LS_SHORTS) } catch {} }} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}>
                      <RotateCcw size={11} /> Reset
                    </button>
                  )}
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'1.3rem', fontWeight:900, color:C.green }}>{Math.round(shorts.size/SHORTS_CHECKLIST.length*100)}%</span>
                    <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{shorts.size}/{SHORTS_CHECKLIST.length}</p>
                  </div>
                </div>
              </div>
              <div style={{ height:'3px', background:'#2a2a3a', borderRadius:'2px', marginBottom:'1.25rem', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease', background:'linear-gradient(90deg,'+C.green+',#00cc6a)', width:Math.round(shorts.size/SHORTS_CHECKLIST.length*100)+'%' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {SHORTS_CHECKLIST.map(item => (
                  <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={shorts.has(item.id)} onToggle={toggleShorts} />
                ))}
              </div>
            </section>

            {/* Metrics */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>Reading Your Metrics</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>What the numbers actually mean</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.625rem', marginBottom:'0.625rem' }}>
                {([
                  { metric:'108% view rate', verdict:'Very high', color:C.green, note:'People looping the short. Best algorithm signal possible.' },
                  { metric:'55% swipe-through', verdict:'Very low', color:C.red, note:'Hook failed. More than half left in the first second. Fix the first-second formula.' },
                  { metric:'View rate &gt; 80%', verdict:'Good', color:C.green, note:'Algorithm will push it further. Keep going.' },
                  { metric:'Swipe-through &gt; 30%', verdict:'Problem', color:C.amber, note:'Change the text, sounds, or opening visual before reposting.' },
                ] as {metric:string;verdict:string;color:string;note:string}[]).map((m, i) => (
                  <div key={i} style={{ padding:'0.875rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: m.metric }} />
                    <p style={{ fontSize:'0.9rem', fontWeight:800, color:m.color, margin:'0 0 0.35rem' }}>{m.verdict}</p>
                    <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.5 }}>{m.note}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                <p style={{ fontSize:'0.78rem', fontWeight:600, color:C.text, margin:'0 0 0.3rem' }}>If a short fails:</p>
                <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>Report it to YouTube (3-dot menu &rarr; &ldquo;Report a problem&rdquo;) then repost with a new hook 4 days later.</p>
              </div>
            </section>

            {/* SoundMoney Short Ideas */}
            <section>
              <div style={{ marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'1.05rem', fontWeight:800, margin:'0 0 0.15rem' }}>SoundMoney Short Ideas</h2>
                <p style={{ fontSize:'0.72rem', color:C.sec, margin:0 }}>Validated formats for your niche</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {([
                  { title:'PETER SCHIFF &mdash; HIS RESPONSE SHOCKED HIM', note:'Named subject + reaction hook. High click pull &mdash; audience already knows the name.' },
                  { title:'WHEN ECONOMISTS GET IT WRONG', note:'Series format &mdash; repeat monthly. Each episode = a new prediction failure. Builds returning viewers.' },
                  { title:'THE STAT THEY DON&rsquo;T WANT YOU TO KNOW', note:'Classic contrarian hook. Works on any economic data point. Infinitely repeatable.' },
                  { title:'WHY [THING] COSTS MORE THAN YOUR HOUSE', note:'Absurd comparison format. High curiosity gap. Endless supply of finance topics.' },
                ] as {title:string;note:string}[]).map((idea, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.875rem', padding:'0.875rem 1rem', background:'rgba(255,255,255,0.02)', border:'1px solid '+C.border, borderRadius:'0.875rem' }}>
                    <span style={{ fontSize:'0.65rem', fontWeight:900, color:C.cyan, marginTop:'3px', flexShrink:0 }}>{'#'+(i+1)}</span>
                    <div>
                      <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.amber, margin:'0 0 0.2rem', letterSpacing:'0.02em' }} dangerouslySetInnerHTML={{ __html: idea.title }} />
                      <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: idea.note }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

        {activeTab === 'sops' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.15)', borderRadius:'0.875rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ fontSize:'1rem' }}>&#128214;</span>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5 }}>
                Permanent reference for the finance brand format. Open the relevant toggle when you need it &mdash; you don&apos;t need to re-read this every video.
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {SOPS.map(sop => <SOPCard key={sop.id} sop={sop} />)}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
