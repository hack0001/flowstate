'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Camera, CheckCircle2, Circle, Copy, Check, ExternalLink, ChevronDown, Hash } from 'lucide-react'
import { getDailyChecklistState, setDailyChecklistItem } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316', pink:'#ec4899', teal:'#14b8a6',
  insta:'#e1306c',
}

const INSTA_GRAD = 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'

type TaskId = string

const PILLARS = [
  {
    id:'hero', emoji:'&#128247;', title:'The Hero Shot', color:'#e1306c',
    what:'Your absolute best wildlife and landscape images. One image, full frame, maximum impact.',
    why:'Builds your reputation and attracts followers who want to see more of your work. Quality signals drive follow-through.',
    caption:'Tell the story behind the shot. Where were you? How long did you wait? What happened a second later?',
    format:'Single image, or short Reel of the animal/scene in motion.',
  },
  {
    id:'btl', emoji:'&#127774;', title:'Behind the Lens', color:'#f97316',
    what:'4am alarms, muddy boots, hours in a hide — the dedication behind the image.',
    why:'The highest-engagement format for photography accounts. People love the commitment story and root for you.',
    caption:'"I\'d been waiting in the hide for 3 hours when..." Be honest and specific. The struggle makes the payoff land harder.',
    format:'Reel: vlog-style walk + final reveal. Carousel: journey to the shot. Story: daily real-time update.',
  },
  {
    id:'local', emoji:'&#128506;', title:'Local Wonders', color:'#8b5cf6',
    what:'"This is 10 minutes from my house." Content that surprises people about what\'s right on their doorstep.',
    why:'Saves go through the roof — people bookmark location guides. Also builds your regional reputation and makes you findable by locals.',
    caption:'Reveal the location, why it\'s special, best time to visit, and what to look for. Be generous with the detail.',
    format:'Carousel: location guide with multiple images. Single image with specific location tag.',
  },
  {
    id:'teach', emoji:'&#128161;', title:'Teach and Inspire', color:'#00d4ff',
    what:'Camera tips, settings for wildlife, editing tutorials, how to find local subjects — your expertise shared.',
    why:'Saves are 3-5x higher on educational content. Saves are the strongest algorithm signal that your content has lasting value.',
    caption:'Start with the tip. Explain why it works. End with "Save this for next time you\'re out."',
    format:'Carousel: step-by-step guide. Reel: before/after edit with voiceover. Single: image with annotated caption.',
  },
]

const WORKFLOW: { period:string; time:string; color:string; tasks:{id:TaskId;must:boolean;label:string;detail:string;tip:string}[] }[] = [
  {
    period:'Daily', time:'15 min', color:C.insta,
    tasks:[
      {
        id:'d1', must:true,
        label:'Post 1 Story',
        detail:'A behind-the-scenes moment, a shot from today, a poll ("which edit?"), or a quick wildlife fact. Stories keep you at the top of your followers\' feeds and signal daily activity to the algorithm.',
        tip:'Don\'t overthink it. A blurry behind-the-scenes shot of you in a field beats no story at all. Consistency beats perfection.',
      },
      {
        id:'d2', must:true,
        label:'Reply to all comments within the first hour',
        detail:'Early engagement tells the algorithm your post is generating conversation. Reply to every comment — even just a follow-up question pulls people back and deepens the thread.',
        tip:'"Where do you usually see [species]?" turns a one-way post into a conversation and signals high engagement to Instagram.',
      },
      {
        id:'d3', must:false,
        label:'Leave 10 genuine comments on niche accounts',
        detail:'Real, specific comments on wildlife and nature photography accounts. Not "Great shot!" — add actual value. "The light at this angle is incredible — was this before or after sunrise?" Your comment is visible to their engaged audience.',
        tip:'Target accounts with 1k&#8211;50k followers in wildlife/landscape photography. Your comment is seen by exactly the audience you want.',
      },
    ],
  },
  {
    period:'3x Per Week', time:'Post days: Mon / Wed / Fri', color:C.orange,
    tasks:[
      {
        id:'w1', must:true,
        label:'Post 1 Reel',
        detail:'Wildlife in motion, before/after edit, "what I saw on my morning walk", or a time-lapse. Reels get 2&#8211;4x more reach than static posts in 2025. Using trending audio within 24 hours of it going viral multiplies this further.',
        tip:'Even a 15-second clip of a bird landing with a trending sound crushes a static post for raw reach. Motion = algorithm love.',
      },
      {
        id:'w2', must:true,
        label:'Post 1 strong feed image',
        detail:'Your best still shot of the week. Wildlife portrait, golden hour landscape, or macro. Only post when the image is genuinely excellent — quality is the signal, not volume. Post at 7&#8211;9am or 6&#8211;8pm UK time.',
        tip:'"Swipe to see the shot that nearly got away" on a carousel creates urgency. End on your weakest image to make followers feel the journey.',
      },
      {
        id:'w3', must:false,
        label:'Post 1 carousel',
        detail:'Multi-image series: a morning shoot, a location guide, or a "raw to finished" process carousel. Carousels have the highest save rate of any static format — people bookmark them as references.',
        tip:'10 images, 3-5 words per slide, strong hook as slide 1. Save prompt on the last slide: "Save this for your next visit."',
      },
    ],
  },
  {
    period:'Weekly', time:'30 min', color:C.purple,
    tasks:[
      {
        id:'wk1', must:true,
        label:'Batch-edit your week\'s best shots',
        detail:'Edit 5&#8211;10 shots in one session using your signature preset or style. A consistent edit across your feed creates a visual identity that makes people want to follow. Coherence builds trust.',
        tip:'Pick 1&#8211;2 Lightroom presets and stick to them. Grid coherence is the silent closer when someone lands on your profile.',
      },
      {
        id:'wk2', must:true,
        label:'Check analytics: saves, reach, profile visits',
        detail:'Which post got the most saves? That\'s what to make more of. Which got the most reach? Almost certainly the Reels. Saves = valuable. Reach = discoverable. Prioritise saves for algorithm growth.',
        tip:'If a post is getting saves but low reach, it\'s not the content — it\'s the format. Repurpose it as a Reel.',
      },
      {
        id:'wk3', must:false,
        label:'Submit your best shot to a feature account',
        detail:'Tag or DM your best shot to @discoverwildlife, @rspb_love_nature, @wildlifetrusts, @wildlife_planet, @bbcearth, or @yourshot_natgeo. A single feature from a major account can add hundreds of targeted followers overnight.',
        tip:'Read their submission guidelines carefully. Clean, high-res, well-lit shots that tell a clear story get selected most often.',
      },
    ],
  },
  {
    period:'Monthly', time:'45 min', color:C.green,
    tasks:[
      {
        id:'m1', must:true,
        label:'Review your top 9 posts and find the pattern',
        detail:'What subject? What format? What caption length? What time posted? The algorithm is showing you exactly what your audience wants more of. Find the common thread and double down.',
        tip:'Your best-performing content type in month 2 should be 50% of your output in month 3. Let data do the editorial planning.',
      },
      {
        id:'m2', must:false,
        label:'Collaborate with a local photographer',
        detail:'A collab Reel or joint shoot with a local nature/wildlife photographer exposes you to their entire audience. Find accounts with a similar follower count and propose a shoot at a shared location.',
        tip:'"We both shot [location] at different seasons" or "two photographers, one subject" — the compare/contrast format works extremely well.',
      },
      {
        id:'m3', must:false,
        label:'Update bio and highlights',
        detail:'Swap out your weakest highlight cover for a stronger shot. Update your bio link if anything has changed. Your bio has 150 chars to answer: who you are, what you photograph, where, and what follows you gives someone.',
        tip:'Bio formula: [What you photograph] + [Where] + [One unique angle] + [Link prompt]. Example: "Wildlife & landscape photographer | Wales & beyond | Finding the extraordinary in the local | Gallery below"',
      },
    ],
  },
]

const CAPTION_FORMULAS = [
  {
    id:'story', name:'The Story',
    formula:'[Set the scene] + [The moment] + [What you felt] + [Question for audience]',
    example:'It was -3&#176;C and I\'d been in the hide for two hours when the kingfisher finally landed. It sat for exactly 11 seconds before vanishing into the reeds. I\'ve never moved a camera that fast in my life.\n\nWhat\'s the longest you\'ve waited for a shot?',
    why:'Story captions get 40% more comments than description-only. Followers invest in the narrative — the image becomes the punchline.',
  },
  {
    id:'reveal', name:'The Reveal',
    formula:'"This was taken [surprising context — proximity, time, ordinary setting]"',
    example:'This red kite was photographed from a layby on the A470. You don\'t always need a nature reserve. Sometimes you just need to look up.\n\nWhat\'s the most surprising place you\'ve seen wildlife?',
    why:'Surprises people and reframes how they see their own surroundings. Highly shareable because it challenges a common assumption.',
  },
  {
    id:'tip', name:'The Teaching Tip',
    formula:'[Hook result] + [3-step method] + [Save prompt]',
    example:'Golden hour wildlife shots without a tripod:\n\n1. Push ISO to 1600 (fix noise in post)\n2. Switch to burst mode (8&#8211;10fps)\n3. Track the animal before you need to fire\n\nSave this for your next golden hour session.',
    why:'Save rate is 3&#8211;5x higher than standard posts. Saves are the strongest algorithm signal. One tip carousel can keep delivering reach for weeks.',
  },
  {
    id:'stat', name:'The Stat',
    formula:'[Shocking number or species fact] + [Your personal connection] + [CTA]',
    example:'There are fewer than 600 pairs of red kites breeding in Wales. This one was photographed a mile from my house.\n\nThey were extinct in England for 150 years. Watching them hunt is something I will never take for granted.',
    why:'Statistics stop the scroll. The personal connection makes the reader care. The combination creates the conditions for high saves and comments.',
  },
  {
    id:'behind', name:'Behind the Shot',
    formula:'"I got up at [time]" + [journey] + [wait] + [what happened] + [result]"',
    example:'4:45am alarm. 40-minute drive. An hour setting up the hide. Two hours waiting in near-freezing temperatures.\n\nThen an otter appeared 8 feet away and spent 20 minutes fishing.\n\nSome mornings are worth every alarm.',
    why:'The highest-engagement format for photography accounts. Followers root for you. The payoff image lands harder when they\'ve felt the effort.',
  },
]

const HASHTAG_SETS = [
  {
    id:'wildlife', name:'Wildlife Core', color:C.insta,
    tags:'#wildlifephotography #ukwildlife #britishwildlife #wildlifeofinstagram #naturephotography #wildlifephotographer #bbcearth #natgeowild #animalphotography #discoverwildlife #wildlife_planet #wildbritain #britishnature #ukbirds #birdphotography #birdsofinstagram #mammalsofinstagram #wildlifephoto #natureperfection #naturephoto',
    tip:'Rotate the smaller niche tags (#ukbirds, #mammalsofinstagram) with subject-specific ones depending on your post.',
  },
  {
    id:'landscape', name:'Landscape and Scenic', color:C.orange,
    tags:'#landscapephotography #uklandscape #britishcountryside #goldenhourmood #naturescapes #landscapelovers #countryside #scenicphotography #goldenlight #magichour #goldenhour #landscapecaptures #naturelover #breathtakinglandscapes #earthpix #landscape_captures #visitwales #walesphotography',
    tip:'Always include a location-specific tag (#visitwales, #snowdonia, etc.) for discoverability with local audiences.',
  },
  {
    id:'community', name:'Community and Discovery', color:C.purple,
    tags:'#photooftheday #naturebytes #showmethenature #natgeo #natgeoyourshot #rspb #wildlifetrusts #bbc_earth #capturewildlife #ig_nature #raw_nature #thephotohour #splendid_earth #earth_bestshots #loves_nature',
    tip:'These community tags get your work in front of curators who run feature accounts. A single feature can add 200&#8211;500 targeted followers.',
  },
]

const CONTENT_IDEAS = [
  { cat:'Behind the Lens', idea:'I set [X] alarms to get this shot', format:'Reel or Story' },
  { cat:'Local Wonders', idea:'5 spots within 30 minutes of home that most people drive past', format:'Carousel' },
  { cat:'Hero Shot', idea:'The shot that took me [X] attempts to get', format:'Single + Story' },
  { cat:'Teach', idea:'The one camera setting I always use for wildlife', format:'Carousel or Reel' },
  { cat:'Behind the Lens', idea:'What I actually see vs what Instagram sees (wide shot + final crop)', format:'Reel' },
  { cat:'Local Wonders', idea:'What [current season] looks like near my house', format:'Carousel: 8&#8211;10 images' },
  { cat:'Teach', idea:'My editing process: raw to finished in 60 seconds', format:'Reel with voiceover' },
  { cat:'Hero Shot', idea:'The species I\'ve been trying to photograph for [X] years', format:'Single with long story caption' },
  { cat:'Behind the Lens', idea:'A morning in a hide: what really happens', format:'Reel: documentary style' },
  { cat:'Local Wonders', idea:'The best golden hour spot you\'ve never heard of', format:'Single + location tag' },
  { cat:'Teach', idea:'3 things I wish I knew when I started wildlife photography', format:'Carousel' },
  { cat:'Hero Shot', idea:'The one that got away &#8212; what I almost captured', format:'Story + feed post about the near-miss' },
  { cat:'Behind the Lens', idea:'My camera bag: what I actually use vs what I thought I needed', format:'Flat-lay carousel' },
  { cat:'Local Wonders', idea:'[Species] is thriving near [location] and most people don\'t know', format:'Single + educational caption' },
  { cat:'Teach', idea:'Before/after: same location, different seasons', format:'Side-by-side Reel or carousel' },
  { cat:'Behind the Lens', idea:'The weather that made this possible (storm, frost, fog)', format:'Single + conditions story' },
  { cat:'Local Wonders', idea:'A seasonal guide to visiting [local reserve]', format:'Carousel: one slide per season + tips' },
  { cat:'Teach', idea:'How to find wildlife locally without driving far', format:'Carousel: practical guide' },
  { cat:'Hero Shot', idea:'The light changed and I held my breath &#8212; [describe the moment]', format:'Single + emotional caption' },
  { cat:'Behind the Lens', idea:'I failed 40 times before I got this &#8212; here\'s what changed', format:'Reel or carousel' },
]

const FORMAT_GUIDE = [
  { name:'Reels', reach:'5/5', saves:'3/5', engagement:'4/5', color:C.insta, tip:'Highest organic reach of any format &#8212; 2&#8211;4x more than static posts. Even a 15-second clip of wildlife in motion beats a stunning still image for reach. Use trending audio within 24&#8211;48 hours.' },
  { name:'Carousels', reach:'3/5', saves:'5/5', engagement:'4/5', color:C.orange, tip:'The saves machine. Location guides, tip lists, and process carousels get bookmarked constantly. Saves are the strongest algorithm signal that your content has lasting value.' },
  { name:'Single Images', reach:'3/5', saves:'3/5', engagement:'5/5', color:C.purple, tip:'Best for your hero shots. Only post your genuinely excellent images. The caption carries enormous weight &#8212; a 200-word story caption gets 60% more comments than a one-liner.' },
  { name:'Stories', reach:'2/5', saves:'1/5', engagement:'3/5', color:C.cyan, tip:'Not for discovery &#8212; for retention. Daily stories keep you visible at the top of your followers\' feeds. Polls and questions get 30&#8211;40% response rates from engaged audiences.' },
]

const todayStr = () => new Date().toISOString().slice(0,10)

export default function InstagramPage() {
  const router = useRouter()
  const [tab, setTab]     = useState<'strategy'|'workflow'|'toolkit'>('strategy')
  const [done, setDone]   = useState<Record<TaskId,boolean>>({})
  const [copied, setCopied] = useState<Record<string,boolean>>({})
  const [expandedCaption, setExpandedCaption] = useState<string|null>(null)
  const [expandedIdea, setExpandedIdea] = useState<string|null>(null)

  useEffect(() => {
    getDailyChecklistState('instagram', todayStr()).then(({ state }) => setDone(state))
  }, [])

  function toggleTask(id: TaskId) {
    setDone(prev => {
      const nextDone = !prev[id]
      setDailyChecklistItem('instagram', id, todayStr(), nextDone)
      return { ...prev, [id]: nextDone }
    })
  }

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(c => ({ ...c, [key]: true }))
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 1800)
  }

  const mustTasks   = WORKFLOW.flatMap(p => p.tasks.filter(t => t.must))
  const doneToday   = mustTasks.filter(t => done[t.id]).length
  const allDone     = doneToday === mustTasks.length

  const catColor: Record<string,string> = { 'Behind the Lens':C.orange, 'Local Wonders':C.purple, 'Hero Shot':C.insta, 'Teach':C.cyan, 'Teach & Inspire':C.cyan }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'0.875rem 2rem', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'0.8rem', fontFamily:'inherit', padding:0 }}>
            <ChevronLeft size={15}/> Home
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:'22px', height:'22px', borderRadius:'6px', background:INSTA_GRAD, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Camera size={12} color="#fff"/>
            </div>
            <span style={{ fontSize:'1.1rem', fontWeight:900, color:C.text, letterSpacing:'-0.02em' }}>Instagram Photography</span>
          </div>
          <div style={{ display:'flex', gap:'0.3rem', marginLeft:'auto' }}>
            {([['strategy','Strategy'],['workflow','Workflow'],['toolkit','Toolkit']] as [string,string][]).map(([t,label]) => (
              <button key={t} onClick={() => setTab(t as 'strategy'|'workflow'|'toolkit')}
                style={{ padding:'0.32rem 0.8rem',
                  background: tab===t ? 'rgba(225,48,108,0.12)' : 'none',
                  border: tab===t ? '1px solid rgba(225,48,108,0.35)' : '1px solid transparent',
                  borderRadius:'9999px', color: tab===t ? C.insta : C.muted,
                  fontWeight:700, fontSize:'0.72rem', cursor:'pointer', fontFamily:'inherit',
                  display:'flex', alignItems:'center', gap:'0.3rem' }}>
                {label}
                {t==='workflow' && (
                  allDone
                    ? <CheckCircle2 size={11} color={C.green}/>
                    : <span style={{ background:C.insta, borderRadius:'9999px', width:'7px', height:'7px', display:'inline-block' }}/>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Page intro banner */}
      <div style={{ background:'rgba(225,48,108,0.04)', borderBottom:'1px solid rgba(225,48,108,0.12)', padding:'0.875rem 2rem' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>
          <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>
            A wildlife and scenic photography account built for the UK landscape. The strategy below is built around what the Instagram algorithm rewards in 2025: Reels for reach, carousels for saves, consistency for retention.
          </p>
        </div>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.5rem 2rem' }}>

        {/* ── STRATEGY TAB ──────────────────────────────────────────────────── */}
        {tab === 'strategy' && (
          <div>
            {/* Profile Setup */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem 1.5rem', marginBottom:'1.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.insta, margin:'0 0 1rem' }}>Profile Setup &#8212; First Impressions Close the Follow</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
                {[
                  ['Username', 'Keep it clean and searchable. @[name]wildlife, @[name]photography, or @[location]wild. Avoid numbers. If your name is taken, add "photo" or the county/region.'],
                  ['Bio (150 chars)', 'Formula: What you photograph + Where + One unique angle + Link prompt. Example: "Wildlife & scenic photographer | Wales & borders | Finding the extraordinary in the local | Gallery &#8594;"'],
                  ['Profile Photo', 'A strong wildlife or landscape shot &#8212; not a selfie. Your best image of something immediately recognisable (red kite in flight, misty valley). This is your brand.'],
                  ['Highlights', 'Create 5 highlight categories: Birds, Mammals, Landscapes, Seasons, Behind the Lens. Use a consistent cover style (matching colour or crop). These act as your permanent portfolio.'],
                  ['Link in Bio', 'Use a free Linktree or direct to a personal website/gallery. Update this seasonally. "New prints available" or "Just published my [season] gallery" gives people a reason to click.'],
                ].map(([label, detail]) => (
                  <div key={label as string} style={{ display:'flex', gap:'1rem', alignItems:'flex-start' }}>
                    <span style={{ fontSize:'0.7rem', fontWeight:800, color:C.insta, flexShrink:0, width:'110px', paddingTop:'1px' }}>{label as string}</span>
                    <p style={{ fontSize:'0.79rem', color:C.sec, margin:0, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: detail as string }}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Algorithm in 2025 */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem 1.5rem', marginBottom:'1.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.amber, margin:'0 0 1rem' }}>How the Algorithm Works in 2025</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.75rem' }}>
                {[
                  { signal:'Saves', weight:'&#9733;&#9733;&#9733;&#9733;&#9733;', color:C.green, tip:'The #1 signal. Saves tell Instagram your content has lasting value. Educational carousels and location guides are the best save-drivers.' },
                  { signal:'Shares', weight:'&#9733;&#9733;&#9733;&#9733;&#9733;', color:C.green, tip:'DMs and Story shares are treated equally. "Send to a friend" content &#8212; surprising wildlife facts, relatable behind-the-lens moments &#8212; gets shared.' },
                  { signal:'Comments', weight:'&#9733;&#9733;&#9733;&#9733;', color:C.cyan, tip:'Length matters. A 3-word comment and a 30-word reply both count, but a thread of 5+ back-and-forth messages signals genuine community.' },
                  { signal:'Watch Time (Reels)', weight:'&#9733;&#9733;&#9733;&#9733;', color:C.cyan, tip:'The percentage of your Reel watched and whether viewers replay it are key signals. Hook in the first second. End with something that makes them watch again.' },
                  { signal:'Likes', weight:'&#9733;&#9733;&#9733;', color:C.amber, tip:'The weakest of the five signals. Optimising for likes gives you a vanity metric that doesn\'t move the algorithm. Optimise for saves and shares instead.' },
                  { signal:'Posting Consistency', weight:'&#9733;&#9733;&#9733;&#9733;', color:C.cyan, tip:'3&#8211;5 posts per week beats 15 posts in one week then nothing. The algorithm rewards accounts that show up reliably, not in bursts.' },
                ].map(s => (
                  <div key={s.signal} style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem 1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:800, color:s.color }}>{s.signal}</span>
                      <span style={{ fontSize:'0.65rem', color:s.color }} dangerouslySetInnerHTML={{ __html: s.weight }}/>
                    </div>
                    <p style={{ fontSize:'0.72rem', color:C.sec, margin:0, lineHeight:1.55 }} dangerouslySetInnerHTML={{ __html: s.tip }}/>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Content Pillars */}
            <div style={{ marginBottom:'1.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.875rem' }}>4 Content Pillars for Wildlife Photography</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'0.875rem' }}>
                {PILLARS.map(p => (
                  <div key={p.id} style={{ background:C.card, border:'1px solid '+p.color+'44', borderRadius:'1rem', padding:'1.1rem 1.25rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.65rem' }}>
                      <span style={{ fontSize:'1.1rem' }} dangerouslySetInnerHTML={{ __html: p.emoji }}/>
                      <span style={{ fontSize:'0.85rem', fontWeight:800, color:p.color }}>{p.title}</span>
                    </div>
                    <p style={{ fontSize:'0.77rem', fontWeight:700, color:C.text, margin:'0 0 0.3rem', lineHeight:1.5 }}>{p.what}</p>
                    <p style={{ fontSize:'0.72rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.55 }}><span style={{ fontWeight:700, color:p.color }}>Why it works:</span> {p.why}</p>
                    <p style={{ fontSize:'0.7rem', color:C.muted, margin:'0 0 0.35rem', lineHeight:1.5 }}><span style={{ fontWeight:700, color:C.sec }}>Caption:</span> {p.caption}</p>
                    <p style={{ fontSize:'0.7rem', color:p.color, margin:0, lineHeight:1.5, fontStyle:'italic' }}>{p.format}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Format performance guide */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem 1.5rem', marginBottom:'1.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 1rem' }}>Format Performance for Photography Accounts</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                {FORMAT_GUIDE.map(f => (
                  <div key={f.name} style={{ display:'flex', gap:'1rem', alignItems:'flex-start', padding:'0.75rem 1rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                    <div style={{ flexShrink:0, width:'90px' }}>
                      <p style={{ fontSize:'0.78rem', fontWeight:800, color:f.color, margin:'0 0 0.2rem' }}>{f.name}</p>
                      <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0 0 0.1rem', lineHeight:1.4 }}>Reach: {f.reach}</p>
                      <p style={{ fontSize:'0.62rem', color:C.muted, margin:'0 0 0.1rem', lineHeight:1.4 }}>Saves: {f.saves}</p>
                      <p style={{ fontSize:'0.62rem', color:C.muted, margin:0, lineHeight:1.4 }}>Engage: {f.engagement}</p>
                    </div>
                    <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: f.tip }}/>
                  </div>
                ))}
              </div>
            </div>

            {/* UK Feature accounts */}
            <div style={{ background:'rgba(225,48,108,0.04)', border:'1px solid rgba(225,48,108,0.15)', borderRadius:'1rem', padding:'1.25rem 1.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.insta, margin:'0 0 0.875rem' }}>UK Feature Accounts Worth Targeting</p>
              <p style={{ fontSize:'0.75rem', color:C.sec, margin:'0 0 0.875rem', lineHeight:1.6 }}>
                Tag these accounts in your best shots or DM your work as a submission. A feature to their audiences (some with millions of followers) is the single fastest way to gain targeted followers.
              </p>
              <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                {['@discoverwildlife','@rspb_love_nature','@wildlifetrusts','@bbcearth','@wildlife_planet','@yourshot_natgeo','@wildlifephotomag','@britishwildlifeimages','@ukwildlife_'].map(acc => (
                  <a key={acc} href={'https://instagram.com/'+acc.slice(1)} target="_blank" rel="noopener"
                    style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem', padding:'0.25rem 0.65rem',
                      background:'rgba(225,48,108,0.1)', border:'1px solid rgba(225,48,108,0.2)',
                      borderRadius:'9999px', color:C.insta, fontSize:'0.69rem', fontWeight:700, textDecoration:'none' }}>
                    {acc} <ExternalLink size={8}/>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── WORKFLOW TAB ──────────────────────────────────────────────────── */}
        {tab === 'workflow' && (
          <div>
            {/* Progress bar */}
            <div style={{ marginBottom:'1.5rem', padding:'1rem 1.25rem', background:allDone ? 'rgba(0,255,136,0.05)' : 'rgba(225,48,108,0.05)', border:'1px solid '+(allDone ? 'rgba(0,255,136,0.2)' : 'rgba(225,48,108,0.18)'), borderRadius:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'0.73rem', fontWeight:800, color:allDone ? C.green : C.insta }}>
                  {allDone ? 'All must-dos complete today &#10003;' : 'Must-dos: ' + doneToday + ' / ' + mustTasks.length + ' done today'}
                </span>
                <span style={{ fontSize:'0.67rem', color:C.muted }}>Resets at midnight</span>
              </div>
              <div style={{ height:'5px', background:C.border, borderRadius:'9999px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${mustTasks.length ? (doneToday/mustTasks.length)*100 : 0}%`, background:allDone ? C.green : INSTA_GRAD, borderRadius:'9999px', transition:'width 0.3s' }}/>
              </div>
            </div>

            {WORKFLOW.map(period => (
              <div key={period.period} style={{ marginBottom:'1.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
                  <div style={{ width:'3px', height:'28px', background:period.color, borderRadius:'9999px' }}/>
                  <div>
                    <span style={{ fontSize:'0.88rem', fontWeight:900, color:period.color }}>{period.period}</span>
                    <span style={{ fontSize:'0.72rem', color:C.muted, marginLeft:'0.5rem' }}>{period.time}</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                  {period.tasks.map(task => (
                    <div key={task.id} style={{ background:C.card, border:`1px solid ${done[task.id] ? period.color+'33' : task.must ? period.color+'22' : C.border}`, borderRadius:'0.875rem', padding:'0.875rem 1rem', opacity:done[task.id] ? 0.6 : 1, transition:'opacity 0.2s' }}>
                      <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                        <button onClick={() => toggleTask(task.id)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', flexShrink:0, marginTop:'1px' }}>
                          {done[task.id]
                            ? <CheckCircle2 size={18} color={period.color}/>
                            : <Circle size={18} color={task.must ? period.color : C.border}/>}
                        </button>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.3rem', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'0.84rem', fontWeight:700, color:done[task.id] ? C.muted : C.text, textDecoration:done[task.id] ? 'line-through' : 'none' }}>{task.label}</span>
                            {task.must && <span style={{ fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', background:period.color+'18', color:period.color, border:`1px solid ${period.color}33`, borderRadius:'9999px', padding:'0.1rem 0.45rem' }}>must</span>}
                          </div>
                          <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 0.35rem', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: task.detail }}/>
                          <p style={{ fontSize:'0.71rem', color:period.color, margin:0, lineHeight:1.5, fontStyle:'italic', opacity:0.8 }}>&#128161; {task.tip}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* UK Seasonal content */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem 1.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 1rem' }}>UK Seasonal Content Calendar</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                {[
                  ['Jan &#8211; Feb', '#00d4ff', 'Starling murmurations, winter birds at feeders, frosty landscapes and frozen lakes, wading birds on estuaries.'],
                  ['Mar &#8211; Apr', '#00ff88', 'First swallows and returning migrants, lambs and spring wildflowers, osprey arrivals, fox cubs emerging.'],
                  ['May &#8211; Jun', '#f97316', 'Puffins (coastal), wildflower meadows, otter cubs, deer fawns, basking adders, dragonfly emergence.'],
                  ['Jul &#8211; Aug', '#ffb800', 'Golden grain fields, butterfly peaks, red squirrels foraging, seabird colonies, early golden hour landscapes.'],
                  ['Sep &#8211; Oct', '#e1306c', 'Red deer rut (iconic), fallow deer, autumn woodland colour, fungi season, pink-footed geese arrivals.'],
                  ['Nov &#8211; Dec', '#8b5cf6', 'Whooper swans and barnacle geese, red deer stags in mist, winter light on bare trees, owls at dusk.'],
                ].map(([months, color, subjects]) => (
                  <div key={months as string} style={{ display:'flex', gap:'0.875rem', alignItems:'flex-start', padding:'0.65rem 0.875rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:800, color:color as string, flexShrink:0, width:'80px', paddingTop:'1px' }} dangerouslySetInnerHTML={{ __html: months as string }}/>
                    <p style={{ fontSize:'0.75rem', color:C.sec, margin:0, lineHeight:1.55 }}>{subjects as string}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TOOLKIT TAB ───────────────────────────────────────────────────── */}
        {tab === 'toolkit' && (
          <div>

            {/* Caption Formulas */}
            <div style={{ marginBottom:'1.75rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.875rem' }}>Caption Formulas That Drive Engagement</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                {CAPTION_FORMULAS.map(cf => {
                  const isOpen = expandedCaption === cf.id
                  return (
                    <div key={cf.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', overflow:'hidden' }}>
                      <button onClick={() => setExpandedCaption(isOpen ? null : cf.id)}
                        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.1rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                        <div>
                          <span style={{ fontSize:'0.85rem', fontWeight:800, color:C.insta }}>{cf.name}</span>
                          <span style={{ fontSize:'0.72rem', color:C.muted, marginLeft:'0.75rem', fontStyle:'italic' }}>{cf.formula}</span>
                        </div>
                        <ChevronDown size={15} color={C.muted} style={{ transform:isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s', flexShrink:0 }}/>
                      </button>
                      {isOpen && (
                        <div style={{ borderTop:'1px solid '+C.border, padding:'0.875rem 1.1rem' }}>
                          <p style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.35rem' }}>Example</p>
                          <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', padding:'0.75rem', marginBottom:'0.875rem', position:'relative' }}>
                            <p style={{ fontSize:'0.81rem', color:C.text, margin:'0 0 0.5rem', lineHeight:1.65, whiteSpace:'pre-line' }} dangerouslySetInnerHTML={{ __html: cf.example }}/>
                            <button onClick={() => copyText(cf.id, cf.example.replace(/&#[0-9]+;/g,'').replace(/&[a-z]+;/g,''))}
                              style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.28rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:copied[cf.id] ? C.green : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:600 }}>
                              {copied[cf.id] ? <Check size={11}/> : <Copy size={11}/>} {copied[cf.id] ? 'Copied' : 'Copy template'}
                            </button>
                          </div>
                          <p style={{ fontSize:'0.73rem', color:C.sec, margin:0, lineHeight:1.6 }}>
                            <span style={{ fontWeight:700, color:C.amber }}>Why it works: </span>
                            <span dangerouslySetInnerHTML={{ __html: cf.why }}/>
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hashtag Sets */}
            <div style={{ marginBottom:'1.75rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.875rem' }}>
                <Hash size={13} color={C.insta}/>
                <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:0 }}>Hashtag Sets &#8212; Copy and Rotate Between Posts</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {HASHTAG_SETS.map(hs => (
                  <div key={hs.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'0.875rem 1.1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:800, color:hs.color }}>{hs.name}</span>
                      <button onClick={() => copyText('hs-'+hs.id, hs.tags)}
                        style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.28rem 0.65rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:copied['hs-'+hs.id] ? C.green : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.7rem', fontWeight:600 }}>
                        {copied['hs-'+hs.id] ? <Check size={11}/> : <Copy size={11}/>} {copied['hs-'+hs.id] ? 'Copied' : 'Copy all'}
                      </button>
                    </div>
                    <p style={{ fontSize:'0.73rem', color:C.sec, margin:'0 0 0.5rem', lineHeight:1.7 }}>{hs.tags}</p>
                    <p style={{ fontSize:'0.69rem', color:C.muted, margin:0, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: hs.tip }}/>
                  </div>
                ))}
                <div style={{ padding:'0.75rem 1rem', background:'rgba(255,184,0,0.05)', border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.75rem' }}>
                  <p style={{ fontSize:'0.73rem', fontWeight:700, color:C.amber, margin:'0 0 0.3rem' }}>Hashtag Strategy</p>
                  <p style={{ fontSize:'0.72rem', color:C.sec, margin:0, lineHeight:1.6 }}>
                    Use 10&#8211;20 hashtags per post, rotating between the three sets above. Avoid repeating the exact same set every time &#8212; Instagram can deprioritise accounts that use identical hashtag blocks. Mix 3&#8211;4 large tags (1M+), 5&#8211;7 medium tags (100k&#8211;1M), and 3&#8211;5 small niche tags (under 100k) per post.
                  </p>
                </div>
              </div>
            </div>

            {/* Content Ideas Bank */}
            <div>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.875rem' }}>20 Content Ideas &#8212; Never Run Out of Posts</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem' }}>
                {CONTENT_IDEAS.map((idea, i) => {
                  const color = catColor[idea.cat] ?? C.insta
                  return (
                    <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.65rem 0.875rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                      <span style={{ fontSize:'0.63rem', fontWeight:700, background:color+'15', color, border:'1px solid '+color+'30', borderRadius:'9999px', padding:'0.05rem 0.45rem', flexShrink:0, whiteSpace:'nowrap' }}>{idea.cat}</span>
                      <span style={{ fontSize:'0.8rem', color:C.text, flex:1 }} dangerouslySetInnerHTML={{ __html: idea.idea }}/>
                      <span style={{ fontSize:'0.65rem', color:C.muted, flexShrink:0 }}>{idea.format}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
