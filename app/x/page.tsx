'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Zap, Copy, Check, ExternalLink, ChevronDown, CheckCircle2, Circle, Calendar } from 'lucide-react'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  cyan:'#00d4ff', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  orange:'#f97316', pink:'#ec4899', teal:'#14b8a6',
}

const FORMATS = [
  { id:'results-post',  label:'Results Post',   desc:'Win + numbers + achievable',  color: C.green },
  { id:'hot-take',      label:'Hot Take',        desc:'Bold, scroll-stopping',       color: C.orange },
  { id:'thread',        label:'Thread',          desc:'5-tweet deep dive',           color: C.cyan },
  { id:'quote-tweet',   label:'Quote Tweet',     desc:'Borrow big account reach',    color: C.amber },
  { id:'stat-hook',     label:'Stat Hook',       desc:'Data-led opener',             color: C.purple },
  { id:'explainer',     label:'Explainer',       desc:'Complex idea, simple words',  color: C.teal },
  { id:'video-hook',    label:'Video Script',    desc:'Hook + talking points',       color: C.red },
  { id:'news-reaction', label:'News Reaction',   desc:'Timely + your lens',          color: C.pink },
]

const TOPICS = [
  { value:'inflation',         label:'Inflation & Purchasing Power' },
  { value:'cantillon',         label:'The Cantillon Effect' },
  { value:'fed',               label:'Federal Reserve & Central Banks' },
  { value:'gold',              label:'Gold as Sound Money' },
  { value:'bitcoin',           label:'Bitcoin & Hard Money' },
  { value:'abc',               label:'Austrian Business Cycle' },
  { value:'fiat',              label:'The Fiat Money System' },
  { value:'savings',           label:'Savings & Capital Formation' },
  { value:'rothbard',          label:'Murray Rothbard\'s Ideas' },
  { value:'hayek',             label:'Hayek & Spontaneous Order' },
  { value:'mises',             label:'Mises & Human Action' },
  { value:'wealth-gap',        label:'Monetary Wealth Gap' },
]

const TONES = [
  { value:'authentic',    label:'Authentic & personal (wins + losses)' },
  { value:'punchy',       label:'Punchy & direct' },
  { value:'educational',  label:'Educational & clear' },
  { value:'provocative',  label:'Provocative & bold' },
  { value:'inspiring',    label:'Inspiring & motivational' },
]

const HOOK_FORMULAS = [
  { formula:'The [institution] doesn\'t want you to know [truth]',        example:'"The Federal Reserve doesn\'t want you to know your savings lose 7% a year."' },
  { formula:'[Shocking stat] about [money/economy] since [year]',         example:'"The dollar has lost 97% of its purchasing power since 1913."' },
  { formula:'[Mainstream belief]. [Austrian reality].',                    example:'"Central banks control inflation. Reality: they cause it."' },
  { formula:'[N] things [economists/media] won\'t tell you about [topic]', example:'"3 things no one tells you about how inflation really works."' },
  { formula:'If you understand [concept], you understand [big truth]',     example:'"If you understand the Cantillon Effect, you understand why the rich get richer every time the Fed prints."' },
]

const FORMAT_INSTRUCTIONS: Record<string,(n:number)=>string> = {
  'results-post':  n => `Write ${n} results posts showing a real win with specific numbers. Format: state the result → explain the method briefly → make it feel achievable ("15 minutes to set up", "1-2 hours a day"). Max 280 chars each. Readers should think "if they can do it, I can too."`,
  'hot-take':      n => `Write ${n} punchy standalone hot-take tweets. Each opens with a bold, counterintuitive statement. Max 280 chars. Specific numbers where possible. No hashtags. Make the reader think "wait, really?"`,
  'thread':        n => `Write a ${n}-tweet thread. Tweet 1 is a hook: specific numbers + bold promise. Tweets 2-${n-1} build the argument with real insights. Final tweet: punchy takeaway + soft CTA. Format: "[N/${n}]" at start of each.`,
  'quote-tweet':   n => `Write ${n} standalone tweets designed as quote-tweet commentary on trending posts in this niche. Each adds a sharp unique insight on top of viral content. Short punchy opener + 2-3 lines of take. This format gets huge reach.`,
  'stat-hook':     n => `Write ${n} tweets opening with a specific striking statistic, then give one practical insight the reader can use today. Max 280 chars. Numbers are the hook — make them real and specific.`,
  'explainer':     n => `Write ${n} tweets explaining a concept in language anyone would instantly understand. Everyday analogies. Zero jargon. Max 280 chars. Educational but never boring.`,
  'video-hook':    n => `Write ${n} video scripts for short X videos (30-60 sec). Each: hook (first 3 seconds — makes them stop), 3-4 bullet talking points, punchy close. Label sections. Raw unscripted-feeling tone.`,
  'news-reaction': n => `Write ${n} tweets reacting to current trends in this niche from a personal, opinionated angle. Timely, authentic, sharp. Clear point of view. Max 280 chars.`,
}

const LOADING_MSGS = [
  'Crafting viral hooks...',
  'Borrowing from the algorithm...',
  'Packaging your expertise...',
  'Building your scroll-stoppers...',
  'Finalising the copy...',
]

const SYSTEM_PROMPT = `You are an expert X (Twitter) content strategist for SoundMoney, a YouTube channel educating people on Austrian economics, sound money principles, and the failures of the fiat monetary system.

The channel covers: inflation, purchasing power, the Cantillon Effect, Federal Reserve criticism, gold, Bitcoin as hard money, Austrian Business Cycle theory, Mises, Hayek, Rothbard, savings vs consumption, and the monetary wealth gap.

Content philosophy:
1. HOOKS ARE EVERYTHING — the first line must stop a scroll. Use shocking stats, counterintuitive truths, or direct challenges to mainstream economic thinking.
2. MAKE IT PERSONAL — connect abstract economics to things people feel in their wallet today. "Your salary buys less every year" beats "inflation reduces purchasing power."
3. SPECIFIC > VAGUE — use real numbers. "The dollar has lost 97% of its value since 1913" beats "money loses value over time."
4. CHALLENGE THE MAINSTREAM — Austrian economics is contrarian by nature. Own it. Push back on central bank orthodoxy, Keynesian thinking, and fiat money consensus.
5. EDUCATE WITHOUT LECTURING — the goal is to make followers think "I never thought of it that way." Clear, vivid language. No academic jargon without explanation.

Style: confident, intellectually sharp, occasionally provocative. Think: the economy explained by someone who's actually read Mises, not a mainstream financial pundit.

CRITICAL: Return ONLY a valid JSON array. No markdown, no backticks, no preamble. Each object must have exactly: {"tweet":"...","hook_type":"...","why_it_works":"..."}`

const TODAY_KEY = () => 'flowstate_x_workflow_' + new Date().toISOString().slice(0,10)

type TaskId = string
const WORKFLOW: {
  period: string; time: string; color: string;
  tasks: { id:TaskId; must:boolean; label:string; detail:string; format?:string; tip:string }[]
}[] = [
  {
    period: 'Morning', time: '15 min', color: C.amber,
    tasks: [
      {
        id:'m1', must:true,
        label:'Reply to 10 posts in your niche',
        detail:'Find posts from big Austrian econ, gold, Bitcoin, or finance accounts. Add a sharp, genuine insight — not "great post". Your reply gets shown to their audience.',
        tip:'Search: "inflation" "Federal Reserve" "gold" "bitcoin" "fiat" on X. Reply to posts with high engagement from the last 2-4 hours.',
      },
      {
        id:'m2', must:true,
        label:'Post 1 Quote Tweet with Austrian take',
        detail:'Find one trending post in economics or finance, quote it with 2-3 lines of SoundMoney commentary. This is Aleiah\'s highest-reach format — she got 200K+ views from quote tweets.',
        format:'quote-tweet',
        tip:'Use the Quote Tweet generator. Pick a topic close to the trending post, generate 5 options, pick the sharpest one.',
      },
    ],
  },
  {
    period: 'Midday', time: '10 min', color: C.cyan,
    tasks: [
      {
        id:'d1', must:true,
        label:'Post 1 scheduled content tweet',
        detail:'This is your daily "column" — the consistent content post that builds your authority over time. Use the generator to create it, or post one you batch-generated earlier in the week.',
        format:'stat-hook',
        tip:'Best formats for SoundMoney: Stat Hook (shocking number + insight) or Hot Take (counterintuitive Austrian claim). Rotate formats weekly.',
      },
    ],
  },
  {
    period: 'Evening', time: '5 min', color: C.purple,
    tasks: [
      {
        id:'e1', must:true,
        label:'Reply to every comment from today\'s posts',
        detail:'Reply within the first 4 hours of posting if possible — YouTube signals early engagement. Reply to every comment, even just to ask a follow-up question.',
        tip:'A simple "What do you think causes this?" or "Have you noticed this in your own spending?" turns a one-way post into a thread.',
      },
      {
        id:'e2', must:false,
        label:'Note what got traction today',
        detail:'Any post that got above-average engagement? Note the topic and format. This is your content intelligence — the algorithm is telling you what resonates.',
        tip:'After 2 weeks you\'ll see clear patterns. Double down on what works.',
      },
    ],
  },
  {
    period: 'Weekly', time: '20 min (batch)', color: C.green,
    tasks: [
      {
        id:'w1', must:true,
        label:'Batch-generate 7 posts for the week',
        detail:'Sunday evening: generate a week\'s worth of content in one session. Schedule them in Buffer or Typefully at your channel\'s peak time (check X Analytics). This frees you to focus on replies and quote tweets daily.',
        tip:'Generate 3 Stat Hooks, 2 Hot Takes, 1 Thread, 1 Results Post. Schedule Mon-Sat at 9am, 12pm, or 6pm — test which time your audience engages most.',
      },
      {
        id:'w2', must:true,
        label:'Post one "show the loss" or authenticity post',
        detail:'Accounts that only post wins get unfollowed. One video that flopped, one prediction that was wrong, one thing you\'re still figuring out. This is the highest-trust content on X.',
        format:'hot-take',
        tip:'E.g. "This video got 180 views. The hook was too academic. Here\'s what I\'d change." Specific + honest = high engagement.',
      },
      {
        id:'w3', must:false,
        label:'Record one raw video clip (30-60 sec)',
        detail:'X pushes short talking-head video aggressively — more than any other format. Phone camera, 1 take, one Austrian economics take on something in the news this week.',
        format:'video-hook',
        tip:'Use the Video Script generator to get your hook + 3 talking points, then record off the cuff. Don\'t polish it.',
      },
    ],
  },
]

export default function XPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<'generate'|'workflow'>('workflow')
  const [format, setFormat]   = useState('results-post')
  const [topic, setTopic]     = useState('inflation')
  const [tone, setTone]       = useState('authentic')
  const [custom, setCustom]   = useState('')
  const [count, setCount]     = useState(5)
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const [tweets, setTweets]   = useState<{tweet:string;hook_type:string;why_it_works:string}[]>([])
  const [edited, setEdited]   = useState<Record<number,string>>({})
  const [copied, setCopied]   = useState<Record<number,boolean>>({})
  const [error, setError]     = useState('')
  const [showHooks, setShowHooks] = useState(false)
  const [done, setDone]       = useState<Record<TaskId,boolean>>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TODAY_KEY())
      if (stored) setDone(JSON.parse(stored))
    } catch {}
  }, [])

  function toggleTask(id: TaskId) {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(TODAY_KEY(), JSON.stringify(next)) } catch {}
      return next
    })
  }

  const mustTasks    = WORKFLOW.flatMap(p => p.tasks.filter(t => t.must))
  const doneToday    = mustTasks.filter(t => done[t.id]).length
  const allMustDone  = doneToday === mustTasks.length

  const topicLabel  = TOPICS.find(t => t.value === topic)?.label  || topic
  const formatLabel = FORMATS.find(f => f.id === format)?.label   || format
  const formatColor = FORMATS.find(f => f.id === format)?.color   || C.cyan

  function getText(i: number) { return edited[i] !== undefined ? edited[i] : tweets[i]?.tweet || '' }

  async function generate() {
    setLoading(true); setError(''); setTweets([]); setEdited({})
    let idx = 0; setLoadMsg(LOADING_MSGS[0])
    const iv = setInterval(() => { idx = (idx+1) % LOADING_MSGS.length; setLoadMsg(LOADING_MSGS[idx]) }, 1400)
    const userPrompt = `Topic: ${topicLabel}\nFormat: ${FORMAT_INSTRUCTIONS[format](count)}\nTone: ${tone}${custom ? `\nCustom angle / recent win: ${custom}` : ''}\n\nGenerate exactly ${count} tweets. Return as JSON array only.`
    try {
      const res = await fetch('/api/x/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: SYSTEM_PROMPT, userPrompt }),
      })
      const data = await res.json()
      if (data?.error) {
        setError('API error: ' + JSON.stringify(data.error))
        return
      }
      const raw = data?.content?.[0]?.text ?? ''
      if (!raw) {
        setError('Empty response from API. Full response: ' + JSON.stringify(data))
        return
      }
      const clean = raw.replace(/```json|```/g, '').trim()
      setTweets(JSON.parse(clean))
    } catch (e) {
      setError('Generation failed: ' + String(e))
    } finally {
      clearInterval(iv); setLoading(false)
    }
  }

  async function copy(i: number) {
    await navigator.clipboard.writeText(getText(i))
    setCopied(c => ({...c,[i]:true}))
    setTimeout(() => setCopied(c => ({...c,[i]:false})), 1500)
  }

  function openX(i: number) {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(getText(i))}`, '_blank')
  }

  function charColor(n: number) { return n > 280 ? C.red : n > 250 ? C.amber : C.muted }

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'0.875rem 2rem', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem' }}>
          <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontSize:'0.8rem', fontFamily:'inherit', padding:0 }}>
            <ChevronLeft size={15}/> Home
          </button>
          <span style={{ fontSize:'1.15rem', fontWeight:900, color:C.text, letterSpacing:'-0.02em' }}>X Tweet Engine</span>
          <div style={{ display:'flex', gap:'0.3rem', marginLeft:'auto' }}>
            <button onClick={() => setTab('workflow')} style={{ padding:'0.35rem 0.85rem', background:tab==='workflow' ? 'rgba(255,184,0,0.12)' : 'none', border:tab==='workflow' ? '1px solid rgba(255,184,0,0.3)' : '1px solid transparent', borderRadius:'9999px', color:tab==='workflow' ? C.amber : C.muted, fontWeight:700, fontSize:'0.73rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.35rem' }}>
              <Calendar size={12}/>Daily Workflow
              {allMustDone
                ? <CheckCircle2 size={12} color={C.green}/>
                : <span style={{ background:C.amber, borderRadius:'9999px', width:'7px', height:'7px', display:'inline-block' }}/>}
            </button>
            <button onClick={() => setTab('generate')} style={{ padding:'0.35rem 0.85rem', background:tab==='generate' ? 'rgba(249,115,22,0.12)' : 'none', border:tab==='generate' ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent', borderRadius:'9999px', color:tab==='generate' ? C.orange : C.muted, fontWeight:700, fontSize:'0.73rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.35rem' }}>
              <Zap size={12}/>Generate
            </button>
          </div>
        </div>
      </div>

      {/* Hook formulas accordion */}
      <div style={{ background:'rgba(255,184,0,0.03)', borderBottom:'1px solid rgba(255,184,0,0.12)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0 2rem' }}>
          <button
            onClick={() => setShowHooks(h => !h)}
            style={{ display:'flex', alignItems:'center', gap:'0.6rem', width:'100%', background:'none', border:'none', padding:'0.65rem 0', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}
          >
            <Zap size={13} color={C.amber}/>
            <span style={{ fontSize:'0.73rem', fontWeight:800, color:C.amber }}>Hook Formulas</span>
            <span style={{ fontSize:'0.7rem', color:C.muted, flex:1 }}>First line = everything. Proven scroll-stoppers.</span>
            <ChevronDown size={13} color={C.muted} style={{ transform:showHooks ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
          </button>
          {showHooks && (
            <div style={{ paddingBottom:'1rem', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:'0.5rem' }}>
              {HOOK_FORMULAS.map((h, i) => (
                <div key={i} style={{ background:C.card, border:'1px solid rgba(255,184,0,0.18)', borderRadius:'0.625rem', padding:'0.7rem 0.9rem' }}>
                  <p style={{ fontSize:'0.71rem', fontWeight:700, color:C.amber, margin:'0 0 0.25rem', fontFamily:'ui-monospace,monospace' }}>{h.formula}</p>
                  <p style={{ fontSize:'0.7rem', color:C.sec, margin:0, fontStyle:'italic' }}>{h.example}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'1.5rem 2rem' }}>

        {tab === 'generate' && (<>
        {/* Format picker */}
        <div style={{ marginBottom:'1.25rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.6rem' }}>Format</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:'0.4rem' }}>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)} style={{
                padding:'0.65rem 0.875rem', textAlign:'left', cursor:'pointer', fontFamily:'inherit',
                background: format===f.id ? f.color+'18' : C.card,
                border:`1px solid ${format===f.id ? f.color+'55' : C.border}`,
                borderRadius:'0.75rem', transition:'all 0.12s',
              }}>
                <span style={{ display:'block', fontSize:'0.78rem', fontWeight:700, color:format===f.id ? f.color : C.text, marginBottom:'0.1rem' }}>{f.label}</span>
                <span style={{ display:'block', fontSize:'0.67rem', color:C.muted }}>{f.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topic + Tone */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem', marginBottom:'0.875rem' }}>
          <div>
            <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>Topic</p>
            <select value={topic} onChange={e => setTopic(e.target.value)} style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.83rem', outline:'none' }}>
              {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>Tone</p>
            <select value={tone} onChange={e => setTone(e.target.value)} style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.83rem', outline:'none' }}>
              {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Custom angle */}
        <div style={{ marginBottom:'0.875rem' }}>
          <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>Custom angle or recent win <span style={{ fontWeight:400, color:C.muted }}>(optional)</span></p>
          <textarea
            value={custom}
            onChange={e => setCustom(e.target.value)}
            placeholder='e.g. "Just hit 1,000 subscribers" or "Etsy shop made £800 last week using AI-generated thumbnails"'
            rows={2}
            style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical', boxSizing:'border-box' }}
          />
        </div>

        {/* Count + Generate */}
        <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-end', marginBottom:'1.5rem' }}>
          <div>
            <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>Count</p>
            <select value={count} onChange={e => setCount(Number(e.target.value))} style={{ padding:'0.55rem 0.75rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.83rem', outline:'none' }}>
              <option value={3}>3 tweets</option>
              <option value={5}>5 tweets</option>
              <option value={8}>8 tweets</option>
            </select>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            style={{
              flex:1, padding:'0.7rem 1.5rem',
              background: loading ? C.card : 'linear-gradient(135deg,#f97316,#dc2626)',
              border:`1px solid ${loading ? C.border : 'transparent'}`,
              borderRadius:'0.75rem', color:loading ? C.muted : '#fff',
              fontWeight:800, fontSize:'0.9rem', cursor:loading ? 'not-allowed' : 'pointer',
              fontFamily:'inherit', opacity:loading ? 0.7 : 1,
              display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
            }}
          >
            {loading ? (
              <>
                <span style={{ display:'inline-block', width:'13px', height:'13px', border:'2px solid '+C.muted, borderTopColor:C.orange, borderRadius:'50%', animation:'xspin 0.8s linear infinite' }}/>
                {loadMsg}
              </>
            ) : (
              <><Zap size={15}/>Generate {count} tweets</>
            )}
          </button>
        </div>

        {error && (
          <div style={{ background:'rgba(255,68,102,0.08)', border:'1px solid rgba(255,68,102,0.25)', borderRadius:'0.625rem', padding:'0.75rem 1rem', color:C.red, fontSize:'0.82rem', marginBottom:'1rem', lineHeight:1.5 }}>
            {error}
          </div>
        )}

        {/* Output tweets */}
        {tweets.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
              <span style={{ fontSize:'0.73rem', color:C.muted }}>{tweets.length} tweets &bull; {topicLabel} &bull; {formatLabel}</span>
              <span style={{ fontSize:'0.67rem', color:C.muted }}>Click text to edit</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              {tweets.map((t, i) => {
                const text = getText(i)
                const len  = text.length
                return (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1rem 1.25rem' }}>
                    <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.6rem', alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'0.63rem', fontWeight:700, background:formatColor+'18', color:formatColor, border:`1px solid ${formatColor}33`, borderRadius:'9999px', padding:'0.1rem 0.55rem', letterSpacing:'0.05em' }}>
                        {formatLabel}
                      </span>
                      {t.hook_type && <span style={{ fontSize:'0.65rem', color:C.muted }}>{t.hook_type}</span>}
                    </div>
                    <textarea
                      value={text}
                      onChange={e => setEdited(prev => ({...prev,[i]:e.target.value}))}
                      rows={Math.max(3, Math.ceil(text.length / 65))}
                      style={{ width:'100%', fontSize:'0.92rem', lineHeight:1.65, fontFamily:'system-ui,sans-serif', border:'none', background:'transparent', color:C.text, resize:'vertical', outline:'none', padding:0, boxSizing:'border-box' }}
                    />
                    {t.why_it_works && (
                      <p style={{ fontSize:'0.7rem', color:C.sec, fontStyle:'italic', margin:'0.4rem 0 0', lineHeight:1.5 }}>{t.why_it_works}</p>
                    )}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'0.875rem', paddingTop:'0.75rem', borderTop:'1px solid '+C.border }}>
                      <span style={{ fontSize:'0.7rem', fontFamily:'ui-monospace,monospace', color:charColor(len) }}>{len}/280</span>
                      <div style={{ display:'flex', gap:'0.5rem' }}>
                        <button onClick={() => copy(i)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.7rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.5rem', color:copied[i] ? C.green : C.sec, cursor:'pointer', fontFamily:'inherit', fontSize:'0.73rem', fontWeight:600 }}>
                          {copied[i] ? <Check size={12}/> : <Copy size={12}/>} {copied[i] ? 'Copied' : 'Copy'}
                        </button>
                        <button onClick={() => openX(i)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.7rem', background:'rgba(29,161,242,0.1)', border:'1px solid rgba(29,161,242,0.28)', borderRadius:'0.5rem', color:'#1da1f2', cursor:'pointer', fontFamily:'inherit', fontSize:'0.73rem', fontWeight:700 }}>
                          Post on X <ExternalLink size={10}/>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {!loading && tweets.length === 0 && !error && (
          <div style={{ textAlign:'center', padding:'3rem 1rem', color:C.muted }}>
            <div style={{ fontSize:'2.25rem', marginBottom:'0.75rem', opacity:0.5 }}>&#120143;</div>
            <p style={{ fontSize:'0.9rem', fontWeight:700, color:C.sec, marginBottom:'0.35rem' }}>Ready to spread sound money ideas</p>
            <p style={{ fontSize:'0.8rem', lineHeight:1.7, maxWidth:'280px', margin:'0 auto' }}>Pick a format, choose your topic, then generate Austrian economics content that stops the scroll.</p>
          </div>
        )}
        </>)}

        {tab === 'workflow' && (
          <div>
            {/* Daily progress bar */}
            <div style={{ marginBottom:'1.5rem', padding:'1rem 1.25rem', background:allMustDone ? 'rgba(0,255,136,0.05)' : 'rgba(255,184,0,0.05)', border:'1px solid '+(allMustDone ? 'rgba(0,255,136,0.2)' : 'rgba(255,184,0,0.15)'), borderRadius:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'0.73rem', fontWeight:800, color:allMustDone ? C.green : C.amber }}>
                  {allMustDone ? 'All must-dos complete ✓' : `Must-dos: ${doneToday} / ${mustTasks.length} done today`}
                </span>
                <span style={{ fontSize:'0.67rem', color:C.muted }}>Resets at midnight</span>
              </div>
              <div style={{ height:'5px', background:C.border, borderRadius:'9999px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${mustTasks.length ? (doneToday/mustTasks.length)*100 : 0}%`, background:allMustDone ? C.green : C.amber, borderRadius:'9999px', transition:'width 0.3s' }}/>
              </div>
            </div>

            {/* Workflow periods */}
            {WORKFLOW.map(period => (
              <div key={period.period} style={{ marginBottom:'1.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
                  <div style={{ width:'3px', height:'28px', background:period.color, borderRadius:'9999px' }}/>
                  <div>
                    <span style={{ fontSize:'0.9rem', fontWeight:900, color:period.color }}>{period.period}</span>
                    <span style={{ fontSize:'0.72rem', color:C.muted, marginLeft:'0.5rem' }}>{period.time}</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                  {period.tasks.map(task => (
                    <div key={task.id} style={{ background:C.card, border:`1px solid ${done[task.id] ? period.color+'33' : task.must ? period.color+'22' : C.border}`, borderRadius:'0.875rem', padding:'0.875rem 1rem', opacity:done[task.id] ? 0.65 : 1, transition:'opacity 0.2s' }}>
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
                          <p style={{ fontSize:'0.78rem', color:C.sec, margin:'0 0 0.4rem', lineHeight:1.6 }}>{task.detail}</p>
                          <p style={{ fontSize:'0.72rem', color:period.color, margin:0, lineHeight:1.5, fontStyle:'italic', opacity:0.75 }}>&#128161; {task.tip}</p>
                          {task.format && !done[task.id] && (
                            <button
                              onClick={() => { setFormat(task.format as string); setTab('generate') }}
                              style={{ marginTop:'0.625rem', display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.7rem', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', borderRadius:'0.5rem', color:C.orange, fontWeight:700, fontSize:'0.72rem', cursor:'pointer', fontFamily:'inherit' }}
                            >
                              <Zap size={11}/> Open in generator
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Scheduling advice */}
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem 1.5rem', marginTop:'0.5rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:C.sec, margin:'0 0 1rem' }}>Should I schedule tweets?</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
                <div style={{ display:'flex', gap:'0.875rem', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1rem', flexShrink:0, marginTop:'2px' }}>&#9989;</span>
                  <div>
                    <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.green, margin:'0 0 0.2rem' }}>Yes &#8212; for your daily content posts</p>
                    <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>Batch-generate 7 posts on Sunday evening using the generator, then schedule them in <strong style={{ color:C.text }}>Buffer</strong>, <strong style={{ color:C.text }}>Typefully</strong>, or <strong style={{ color:C.text }}>Hypefury</strong>. This frees your daily 30 minutes for the high-leverage reactive work &#8212; replies and quote tweets &#8212; that requires you to be live.</p>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'0.875rem', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1rem', flexShrink:0, marginTop:'2px' }}>&#10060;</span>
                  <div>
                    <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.red, margin:'0 0 0.2rem' }}>No &#8212; for replies and quote tweets</p>
                    <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>These must be live and reactive. Replies to trending posts and quote tweets of viral content only work in the moment. Scheduling them kills the relevance that makes them perform.</p>
                  </div>
                </div>
                <div style={{ padding:'0.875rem 1rem', background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:'0.75rem' }}>
                  <p style={{ fontSize:'0.78rem', color:C.cyan, fontWeight:700, margin:'0 0 0.25rem' }}>The weekly rhythm</p>
                  <p style={{ fontSize:'0.77rem', color:C.sec, margin:0, lineHeight:1.65 }}>
                    Sunday 7pm: use the generator to batch 7 posts, schedule Mon&#8211;Sat &#8594; Morning: 15 min replies + 1 quote tweet &#8594; Midday: check scheduled post went out &#8594; Evening: reply to all comments. Check X Analytics weekly to find your best posting time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes xspin { to { transform:rotate(360deg) } }`}</style>
    </main>
  )
}
