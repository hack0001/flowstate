'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Zap, Copy, Check, ExternalLink, ChevronDown } from 'lucide-react'

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
  { value:'youtube-growth',    label:'YouTube growth & content strategy' },
  { value:'ai-tools',          label:'AI tools & automation (Claude, agents)' },
  { value:'productivity',      label:'Productivity systems & flow state' },
  { value:'etsy',              label:'Etsy & e-commerce growth' },
  { value:'creator-economy',   label:'Creator economy & monetisation' },
  { value:'marginal-gains',    label:'Marginal gains & 1% improvement' },
  { value:'morning-routine',   label:'Morning routines & peak performance' },
  { value:'build-in-public',   label:'Building in public & transparency' },
  { value:'deep-work',         label:'Deep work & focus systems' },
  { value:'passive-income',    label:'Passive income & revenue streams' },
]

const TONES = [
  { value:'authentic',    label:'Authentic & personal (wins + losses)' },
  { value:'punchy',       label:'Punchy & direct' },
  { value:'educational',  label:'Educational & clear' },
  { value:'provocative',  label:'Provocative & bold' },
  { value:'inspiring',    label:'Inspiring & motivational' },
]

const HOOK_FORMULAS = [
  { formula:'[$X] in [Y days] using [method]',                       example:'"I made £2,000 in 14 days using one Claude workflow"' },
  { formula:'[N] lazy ways to [desired outcome]',                    example:'"3 lazy ways to 10x your Etsy revenue with AI"' },
  { formula:'How I turned [small thing] into [big result]',          example:'"How I turned 1 video into £500/month passive income"' },
  { formula:'Close your [thing] on [day], open it Monday with ...',  example:'"Close your laptop Friday. Open it Monday with £800 in orders."' },
  { formula:'[N] [niche] tricks → [outcome] → [timeframe]',example:'"7 AI tricks → £3K/month → 90 days"' },
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

const SYSTEM_PROMPT = `You are an expert X (Twitter) content strategist. You specialise in the creator, productivity, AI tools, and e-commerce niches.

Content philosophy:
1. HOOKS ARE EVERYTHING — the first line must stop a scroll in half a second. Specific numbers + clear value promise.
2. PROVIDE REAL VALUE — actionable insights. Not vague motivation.
3. SPECIFIC > VAGUE — "£2,340 in 14 days" beats "made money". Always use real-feeling numbers.
4. AUTHENTIC WINS — show the method, show the result, make it feel achievable ("15 minutes", "1-2 hours a day").
5. MAKE THEM THINK "I CAN DO THAT TOO" — empowered, not intimidated.

Style: direct, confident, sometimes provocative, always substantive. Numbers create credibility. Results create aspiration.

CRITICAL: Return ONLY a valid JSON array. No markdown, no backticks, no preamble. Each object must have exactly: {"tweet":"...","hook_type":"...","why_it_works":"..."}`

export default function XPage() {
  const router = useRouter()
  const [format, setFormat]   = useState('results-post')
  const [topic, setTopic]     = useState('ai-tools')
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
          <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
            <span style={{ fontSize:'1.15rem', fontWeight:900, color:C.text, letterSpacing:'-0.02em' }}>X Tweet Engine</span>
          </div>
          <div style={{ marginLeft:'auto', fontSize:'0.7rem', color:C.muted }}>
            Aleiah Lock playbook
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
            <p style={{ fontSize:'0.9rem', fontWeight:700, color:C.sec, marginBottom:'0.35rem' }}>Ready to build your audience</p>
            <p style={{ fontSize:'0.8rem', lineHeight:1.7, maxWidth:'280px', margin:'0 auto' }}>Pick a format, choose your topic, then hit generate to get scroll-stopping tweets.</p>
          </div>
        )}
      </div>

      <style>{`@keyframes xspin { to { transform:rotate(360deg) } }`}</style>
    </main>
  )
}
