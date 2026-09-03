'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Zap, Copy, Check, ExternalLink, ChevronDown, CheckCircle2, Circle, Calendar, Trash2, Plus, Search, TrendingUp, ListOrdered } from 'lucide-react'
import { supabase, getDailyChecklistState, setDailyChecklistItem, getTweetModels, addTweetModels, deleteTweetModel } from '@/lib/supabase'
import type { TweetModelRow } from '@/lib/supabase'

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

const todayStr = () => new Date().toISOString().slice(0,10)

type TweetModel = TweetModelRow

const CATEGORIES = [
  { value:'all',         label:'All' },
  { value:'inflation',   label:'Inflation' },
  { value:'fed',         label:'Fed / CB' },
  { value:'bitcoin',     label:'Bitcoin' },
  { value:'gold',        label:'Gold' },
  { value:'sound-money', label:'Sound Money' },
  { value:'cantillon',   label:'Cantillon' },
  { value:'wealth-gap',  label:'Wealth Gap' },
  { value:'savings',     label:'Savings' },
]

const TWITTER_SEARCHES = [
  { label:'Inflation viral',  url:'https://x.com/search?q=%28inflation+OR+%22purchasing+power%22+OR+%22cost+of+living%22%29+min_faves%3A5000&f=top' },
  { label:'Fed / Banking',    url:'https://x.com/search?q=%28%22Federal+Reserve%22+OR+%22central+bank%22+OR+%22money+printer%22%29+min_faves%3A5000&f=top' },
  { label:'Bitcoin / Gold',   url:'https://x.com/search?q=%28bitcoin+OR+gold+OR+%22sound+money%22+OR+%22hard+money%22%29+min_faves%3A5000&f=top' },
  { label:'Austrian Econ',    url:'https://x.com/search?q=%28%22Cantillon%22+OR+%22Austrian+economics%22+OR+%22fiat+money%22+OR+%22Mises%22%29+min_faves%3A1000&f=top' },
  { label:'Finance hot takes',url:'https://x.com/search?q=%28finance+OR+economics+OR+%22interest+rates%22%29+min_faves%3A10000&f=top' },
]

const SEED_MODELS: TweetModel[] = [
  {
    id:'seed-1', source:'seed' as const, tweetUrl:'', addedAt:'2024-01-01',
    authorHandle:'@monetaryfacts', authorName:'Monetary Facts',
    tweetText:'The Fed has printed more money since 2020 than in its entire prior history.\n\nYour savings didn\'t get bigger.\n\nThe pile of dollars just got taller.',
    likes:24800, retweets:4100, followerEstimate:18000, engagementRatio:16.1,
    category:'fed', hookPattern:'Stat Hook', formatType:'standalone',
    whyItWorked:'Opens with a verified shocking stat, then delivers the personal punchline. "Pile of dollars getting taller" makes abstract monetary policy viscerally felt. Triggers strong shares from people who feel their savings being eroded.',
    soundMoneyAlternative:'Gold supply has grown ~1.5% per year for centuries.\nBitcoin: 21 million, forever.\nDollar supply: +40% in 2 years.\n\nOne of these is money. The others are promises.',
  },
  {
    id:'seed-2', source:'seed' as const, tweetUrl:'', addedAt:'2024-01-01',
    authorHandle:'@wagereality', authorName:'Wage Reality',
    tweetText:'$50k salary in 2000 with 3% raises every year = $90k today.\n\n$50k lifestyle in 2000 costs $95k today.\n\nYou got raises every year and still fell behind.\n\nThis is inflation.',
    likes:41200, retweets:9800, followerEstimate:22000, engagementRatio:23.2,
    category:'inflation', hookPattern:'Shocking Comparison', formatType:'standalone',
    whyItWorked:'Uses simple verifiable math to name a feeling millions have but haven\'t quantified: working harder just to fall behind. The contrast between nominal salary growth and real cost growth is devastating. Extremely high shareability because it validates a lived experience.',
    soundMoneyAlternative:'$10,000 in gold in 2000 = ~$65,000 purchasing power today.\n$10,000 in dollars in 2000 = $5,500 purchasing power today.\n\nSound money preserves your labor. Fiat money quietly steals it.',
  },
  {
    id:'seed-3', source:'seed' as const, tweetUrl:'', addedAt:'2024-01-01',
    authorHandle:'@hardmoneyclub', authorName:'Hard Money Club',
    tweetText:'Reminder: the dollar has lost 97% of its purchasing power since 1913.\n\nThat\'s not bad luck.\n\nThat\'s the Federal Reserve doing exactly what it was designed to do.',
    likes:18900, retweets:5600, followerEstimate:7800, engagementRatio:31.4,
    category:'sound-money', hookPattern:'Hard Truth', formatType:'standalone',
    whyItWorked:'"Reminder" creates parasocial intimacy -- like you\'re letting followers in on something they should already know. The final line reframes Fed failure as Fed success at its real purpose, which is deeply provocative. Triggers strong agree/disagree reactions, both driving engagement.',
    soundMoneyAlternative:'Reminder: Bitcoin\'s purchasing power has increased every 4-year period in its history.\n\nThe dollar loses value by design.\nBitcoin gains value by design.\n\nOnly one of these is honest money.',
  },
]

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
      {
        id:'m3', must:false,
        label:'Pull 1-2 proven memes for SoundMoney',
        detail:'A new habit worth building — filter proven, high-engagement accounts down to just their best posts and drop anything usable straight into the meme library, so Asset Gathering never starts from zero. Two to start with: alifarhat79 and naiivememe.',
        tip:'Search format: from:USERNAME min_faves:1000 (add filter:media to only show posts with an image or video). Direct links — alifarhat79: https://x.com/search?q=from%3Aalifarhat79%20min_faves%3A1000&src=typed_query&f=top — naiivememe: https://x.com/search?q=from%3Anaiivememe%20min_faves%3A1000&src=typed_query',
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

function XPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [tab, setTab]         = useState<'generate'|'workflow'|'outliers'|'ideas'>('workflow')
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

  // Outliers state
  const [models, setModels]           = useState<TweetModel[]>([])
  const [modelCat, setModelCat]       = useState('all')
  const [expandedModel, setExpandedModel] = useState<string|null>(null)
  const [generating, setGenerating]   = useState(false)
  const [analysing, setAnalysing]     = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addUrl, setAddUrl]           = useState('')
  const [addText, setAddText]         = useState('')
  const [addAuthor, setAddAuthor]     = useState('')
  const [addLikes, setAddLikes]       = useState(0)
  const [addRetweets, setAddRetweets] = useState(0)
  const [addFollowers, setAddFollowers] = useState(0)
  const [addCat, setAddCat]           = useState('inflation')
  const [addAnalysis, setAddAnalysis] = useState<{hookPattern:string;formatType:string;whyItWorked:string;soundMoneyAlternative:string}|null>(null)

  // Ideas backlog + priority order (feeds the cross-section daily plan)
  const [xIdeas, setXIdeas]           = useState<{id:string; text:string; status:string}[]>([])
  const [xPriorityOrder, setXPriorityOrder] = useState<string[]>([])
  const [xDragId, setXDragId]         = useState<string|null>(null)
  const [xDragOver, setXDragOver]     = useState<string|null>(null)
  const [newIdeaText, setNewIdeaText] = useState('')

  // Deep link from the home page's Top 5 ("...?focus=<id>") — jump to the
  // Ideas tab and scroll/highlight that idea once it's loaded.
  useEffect(() => {
    const f = searchParams.get('focus')
    if (!f) return
    setHighlightId(f)
    setTab('ideas')
  }, [searchParams])

  useEffect(() => {
    if (!highlightId || xIdeas.length === 0) return
    const el = document.getElementById('x-idea-row-' + highlightId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlightId(null), 4000)
    return () => clearTimeout(t)
  }, [highlightId, xIdeas])

  useEffect(() => {
    supabase.from('x_ideas').select('*').eq('archived', false).order('created_at', { ascending: false }).then(({ data }) => setXIdeas(data ?? []))
    let plLoaded = false
    let localIds: string[] = []
    try {
      const raw = localStorage.getItem('fs_p_x')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setXPriorityOrder(ids); plLoaded = true; localIds = ids } }
    } catch {}
    supabase.from('priority_lists').select('ordered_ids').eq('key', 'x_priority').single().then(({ data }) => {
      if (data?.ordered_ids && Array.isArray(data.ordered_ids) && (data.ordered_ids as string[]).length > 0) {
        const ids = data.ordered_ids as string[]
        setXPriorityOrder(ids)
        try { localStorage.setItem('fs_p_x', JSON.stringify(ids)) } catch {}
      } else if (plLoaded) {
        supabase.from('priority_lists').upsert({ key: 'x_priority', ordered_ids: localIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      }
    })
  }, [])

  function saveXPriority(order: string[]) {
    setXPriorityOrder(order)
    try { localStorage.setItem('fs_p_x', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: 'x_priority', ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
  }

  async function addXIdea() {
    const text = newIdeaText.trim()
    if (!text) return
    setNewIdeaText('')
    const { data } = await supabase.from('x_ideas').insert({ text, status:'todo', archived:false }).select().single()
    if (data) {
      setXIdeas(prev => [data, ...prev])
      saveXPriority([data.id, ...xPriorityOrder])
    }
  }

  async function toggleXIdeaDone(idea: {id:string; status:string}) {
    const next = idea.status === 'done' ? 'todo' : 'done'
    setXIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: next } : i))
    await supabase.from('x_ideas').update({ status: next }).eq('id', idea.id)
  }

  async function deleteXIdea(id: string) {
    setXIdeas(prev => prev.filter(i => i.id !== id))
    saveXPriority(xPriorityOrder.filter(pid => pid !== id))
    await supabase.from('x_ideas').update({ archived: true }).eq('id', id)
  }

  function moveXIdea(id: string, overId: string) {
    if (id === overId) return
    const order = xPriorityOrder.filter(x => x !== id)
    const idx = order.indexOf(overId)
    order.splice(idx, 0, id)
    saveXPriority(order)
  }

  useEffect(() => {
    getDailyChecklistState('x_workflow', todayStr()).then(({ state }) => setDone(state))
  }, [])

  useEffect(() => {
    getTweetModels().then(({ models: dbModels, error }) => {
      if (error || dbModels.length === 0) {
        setModels(SEED_MODELS)
        if (!error) addTweetModels(SEED_MODELS)
        return
      }
      setModels(dbModels)
    })
  }, [])

  function toggleTask(id: TaskId) {
    setDone(prev => {
      const nextDone = !prev[id]
      setDailyChecklistItem('x_workflow', id, todayStr(), nextDone)
      return { ...prev, [id]: nextDone }
    })
  }

  // ── Outlier model helpers ────────────────────────────────────────────────────
  function deleteModel(id: string) {
    setModels(prev => prev.filter(m => m.id !== id))
    deleteTweetModel(id)
    if (expandedModel === id) setExpandedModel(null)
  }

  function useHook(model: TweetModel) {
    setCustom(model.soundMoneyAlternative)
    setTab('generate')
  }

  function closeAddModal() {
    setShowAddModal(false)
    setAddUrl(''); setAddText(''); setAddAuthor('')
    setAddLikes(0); setAddRetweets(0); setAddFollowers(0)
    setAddCat('inflation'); setAddAnalysis(null)
    setAnalysing(false)
  }

  async function fetchOEmbed() {
    if (!addUrl) return
    setAnalysing(true)
    try {
      const res = await fetch('/api/x/research', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'oembed', tweetUrl:addUrl }),
      })
      const data = await res.json()
      if (data.text) setAddText(data.text)
      if (data.authorHandle) setAddAuthor(data.authorHandle)
    } catch {}
    finally { setAnalysing(false) }
  }

  async function analyzeUrl() {
    if (!addText) return
    setAnalysing(true)
    try {
      const ratio = addFollowers > 0 ? (addLikes + addRetweets) / addFollowers : 0
      const res = await fetch('/api/x/research', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'analyze', tweetText:addText, authorHandle:addAuthor, likes:addLikes, retweets:addRetweets, followerEstimate:addFollowers, engagementRatio:ratio, category:addCat }),
      })
      const data = await res.json()
      const raw = data?.content?.[0]?.text ?? ''
      const clean = raw.replace(/```json|```/g,'').trim()
      setAddAnalysis(JSON.parse(clean))
    } catch (e) {
      console.error('Analyze failed', e)
    } finally {
      setAnalysing(false)
    }
  }

  function saveModel() {
    if (!addText || !addAnalysis) return
    const ratio = addFollowers > 0 ? (addLikes + addRetweets) / addFollowers : 0
    const model: TweetModel = {
      id: 'manual-' + Date.now(),
      tweetText:addText, authorHandle:addAuthor, authorName:addAuthor, tweetUrl:addUrl,
      likes:addLikes, retweets:addRetweets, followerEstimate:addFollowers, engagementRatio:ratio,
      category:addCat, hookPattern:addAnalysis.hookPattern, formatType:addAnalysis.formatType,
      whyItWorked:addAnalysis.whyItWorked, soundMoneyAlternative:addAnalysis.soundMoneyAlternative,
      addedAt:new Date().toISOString().slice(0,10), source:'manual',
    }
    setModels(prev => [...prev, model])
    addTweetModels([model])
    closeAddModal()
  }

  async function generateExamples() {
    setGenerating(true)
    try {
      const cat = modelCat === 'all' ? 'inflation,bitcoin,fed,sound-money,cantillon,wealth-gap' : modelCat
      const res = await fetch('/api/x/research', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate', category:cat }),
      })
      const data = await res.json()
      const raw = data?.content?.[0]?.text ?? ''
      const clean = raw.replace(/```json|```/g,'').trim()
      const examples = (JSON.parse(clean) as Array<Omit<TweetModel,'id'|'tweetUrl'|'addedAt'|'source'>>).map((e, i) => ({
        ...e,
        id: 'gen-' + Date.now() + '-' + i,
        tweetUrl: '',
        addedAt: new Date().toISOString().slice(0,10),
        source: 'generated' as const,
      }))
      setModels(prev => [...prev, ...examples])
      addTweetModels(examples)
    } catch (e) {
      console.error('Generate failed', e)
    } finally {
      setGenerating(false)
    }
  }

  const filteredModels = modelCat === 'all' ? models : models.filter(m => m.category === modelCat)

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
            <button onClick={() => setTab('outliers')} style={{ padding:'0.35rem 0.85rem', background:tab==='outliers' ? 'rgba(0,212,255,0.12)' : 'none', border:tab==='outliers' ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent', borderRadius:'9999px', color:tab==='outliers' ? C.cyan : C.muted, fontWeight:700, fontSize:'0.73rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.35rem' }}>
              <TrendingUp size={12}/>Tweet Models
              {models.length > 0 && <span style={{ background:C.cyan+'22', border:'1px solid '+C.cyan+'44', borderRadius:'9999px', padding:'0 0.35rem', fontSize:'0.62rem', fontWeight:900, color:C.cyan }}>{models.length}</span>}
            </button>
            <button onClick={() => setTab('ideas')} style={{ padding:'0.35rem 0.85rem', background:tab==='ideas' ? 'rgba(0,255,136,0.12)' : 'none', border:tab==='ideas' ? '1px solid rgba(0,255,136,0.3)' : '1px solid transparent', borderRadius:'9999px', color:tab==='ideas' ? C.green : C.muted, fontWeight:700, fontSize:'0.73rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.35rem' }}>
              <ListOrdered size={12}/>Ideas
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

        {tab === 'ideas' && (() => {
          const activeXIdeas = xIdeas.filter(i => i.status !== 'done')
          const orderedXIdeas = [
            ...xPriorityOrder.map(id => activeXIdeas.find(i => i.id === id)).filter(Boolean) as typeof activeXIdeas,
            ...activeXIdeas.filter(i => !xPriorityOrder.includes(i.id)),
          ]
          const doneXIdeas = xIdeas.filter(i => i.status === 'done')
          return (
            <div>
              <p style={{ fontSize:'0.8rem', color:C.sec, margin:'0 0 1rem' }}>Tweet, thread, and video ideas — ranked so the daily plan knows what to pull first.</p>
              <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.25rem' }}>
                <input
                  value={newIdeaText} onChange={e => setNewIdeaText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addXIdea() }}
                  placeholder="New tweet/thread idea..."
                  style={{ flex:1, padding:'0.55rem 0.8rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.6rem', color:C.text, fontFamily:'inherit', fontSize:'0.8rem', outline:'none', boxSizing:'border-box' as const }}
                />
                <button onClick={addXIdea} style={{ padding:'0.55rem 1rem', background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'0.6rem', color:C.green, fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:'0.78rem', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  <Plus size={14}/>Add
                </button>
              </div>

              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Priority order &mdash; drag to reorder ({orderedXIdeas.length})</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', marginBottom:'1.5rem' }}>
                {orderedXIdeas.length === 0 && <p style={{ fontSize:'0.75rem', color:C.muted }}>No ideas yet &mdash; add one above.</p>}
                {orderedXIdeas.map((idea, i) => (
                  <div key={idea.id} id={'x-idea-row-' + idea.id} draggable
                    onDragStart={() => setXDragId(idea.id)}
                    onDragOver={e => { e.preventDefault(); setXDragOver(idea.id) }}
                    onDrop={() => { if (xDragId) moveXIdea(xDragId, idea.id); setXDragId(null); setXDragOver(null) }}
                    onDragEnd={() => { setXDragId(null); setXDragOver(null) }}
                    style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+(highlightId===idea.id ? C.cyan : xDragOver===idea.id ? C.green : C.border), borderRadius:'0.65rem', cursor:'grab', boxShadow: highlightId===idea.id ? '0 0 0 3px rgba(0,212,255,0.25)' : 'none' }}>
                    <span style={{ fontSize:'0.65rem', color:C.muted, fontWeight:800, width:'1.1rem', flexShrink:0 }}>{i+1}</span>
                    <button onClick={() => toggleXIdeaDone(idea)} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', color:C.muted, padding:0, flexShrink:0 }}>
                      <Circle size={15}/>
                    </button>
                    <span style={{ fontSize:'0.8rem', color:C.text, flex:1 }}>{idea.text}</span>
                    <button onClick={() => deleteXIdea(idea.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, display:'flex', padding:0, flexShrink:0 }}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>

              {doneXIdeas.length > 0 && (
                <>
                  <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, margin:'0 0 0.5rem' }}>Done ({doneXIdeas.length})</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                    {doneXIdeas.map(idea => (
                      <div key={idea.id} style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.5rem 0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.65rem', opacity:0.5 }}>
                        <button onClick={() => toggleXIdeaDone(idea)} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', color:C.green, padding:0 }}>
                          <CheckCircle2 size={15}/>
                        </button>
                        <span style={{ fontSize:'0.8rem', color:C.text, flex:1, textDecoration:'line-through' }}>{idea.text}</span>
                        <button onClick={() => deleteXIdea(idea.id)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, display:'flex', padding:0 }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })()}

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

        {tab === 'outliers' && (
          <div>

            {/* Category filters + action buttons */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.45rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat.value} onClick={() => setModelCat(cat.value)}
                  style={{ padding:'0.28rem 0.7rem',
                    background: modelCat===cat.value ? 'rgba(0,212,255,0.12)' : 'none',
                    border: modelCat===cat.value ? '1px solid rgba(0,212,255,0.3)' : '1px solid '+C.border,
                    borderRadius:'9999px', color: modelCat===cat.value ? C.cyan : C.sec,
                    fontWeight:700, fontSize:'0.71rem', cursor:'pointer', fontFamily:'inherit',
                    display:'flex', alignItems:'center', gap:'0.25rem' }}>
                  {cat.label}
                  {cat.value !== 'all' && models.filter(m => m.category === cat.value).length > 0 && (
                    <span style={{ fontSize:'0.61rem', color:C.muted, fontWeight:400 }}>
                      ({models.filter(m => m.category === cat.value).length})
                    </span>
                  )}
                </button>
              ))}
              <div style={{ marginLeft:'auto', display:'flex', gap:'0.45rem', flexShrink:0 }}>
                <button onClick={() => setShowAddModal(true)}
                  style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.8rem',
                    background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem',
                    color:C.text, fontWeight:700, fontSize:'0.72rem', cursor:'pointer', fontFamily:'inherit' }}>
                  <Plus size={12}/> Add URL
                </button>
                <button onClick={generateExamples} disabled={generating}
                  style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.35rem 0.8rem',
                    background: generating ? C.card : 'rgba(0,212,255,0.1)',
                    border: '1px solid '+(generating ? C.border : 'rgba(0,212,255,0.3)'),
                    borderRadius:'0.5rem', color: generating ? C.muted : C.cyan,
                    fontWeight:700, fontSize:'0.72rem', cursor: generating ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit' }}>
                  {generating
                    ? <span style={{ display:'inline-block', width:'11px', height:'11px', border:'2px solid '+C.muted, borderTopColor:C.cyan, borderRadius:'50%', animation:'xspin 0.8s linear infinite' }}/>
                    : <TrendingUp size={12}/>}
                  {generating ? 'Generating...' : 'Generate Examples'}
                </button>
              </div>
            </div>

            {/* Find live on X */}
            <div style={{ background:'rgba(29,161,242,0.04)', border:'1px solid rgba(29,161,242,0.15)', borderRadius:'0.875rem', padding:'0.875rem 1.1rem', marginBottom:'1.25rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#1da1f2', margin:'0 0 0.55rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                <Search size={11}/> Find live outliers on X &#8212; open these searches, look for tweets where likes + retweets &#8805; 5&#215; followers
              </p>
              <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
                {TWITTER_SEARCHES.map(s => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener"
                    style={{ display:'inline-flex', alignItems:'center', gap:'0.22rem', padding:'0.25rem 0.65rem',
                      background:'rgba(29,161,242,0.1)', border:'1px solid rgba(29,161,242,0.2)',
                      borderRadius:'9999px', color:'#1da1f2', fontSize:'0.69rem', fontWeight:700, textDecoration:'none' }}>
                    {s.label} <ExternalLink size={8}/>
                  </a>
                ))}
              </div>
              <p style={{ fontSize:'0.67rem', color:C.muted, margin:0, lineHeight:1.5 }}>
                Found one? Copy the URL and click &#8220;Add URL&#8221; above. Claude will fetch the text, analyze the hook, and write a Sound Money alternative.
              </p>
            </div>

            {/* Models */}
            {filteredModels.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem 1rem' }}>
                <div style={{ fontSize:'2rem', marginBottom:'0.75rem', opacity:0.4 }}>&#128202;</div>
                <p style={{ fontSize:'0.88rem', fontWeight:700, color:C.sec, marginBottom:'0.35rem' }}>No models in this category yet</p>
                <p style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.7, maxWidth:'300px', margin:'0 auto' }}>
                  Click &#8220;Generate Examples&#8221; for instant AI patterns, or find outlier tweets on X and add them via URL.
                </p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                {filteredModels.map(m => {
                  const isExp = expandedModel === m.id
                  const ratio = m.engagementRatio
                  const ratioColor = ratio >= 20 ? C.red : ratio >= 10 ? C.amber : C.green
                  return (
                    <div key={m.id} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', overflow:'hidden' }}>
                      {/* Summary row */}
                      <div style={{ padding:'0.875rem 1.1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.3rem', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'0.71rem', fontWeight:700, color:C.sec }}>{m.authorHandle || m.authorName}</span>
                            <span style={{ fontSize:'0.62rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.05rem 0.4rem', color:C.muted }}>{m.category}</span>
                            <span style={{ fontSize:'0.69rem', fontWeight:900, color:ratioColor, background:ratioColor+'12', border:'1px solid '+ratioColor+'30', borderRadius:'9999px', padding:'0.05rem 0.45rem' }}>
                              {ratio.toFixed(1)}x
                            </span>
                            {m.source === 'generated' && <span style={{ fontSize:'0.6rem', color:C.purple, opacity:0.8 }}>AI</span>}
                            {m.source === 'seed' && <span style={{ fontSize:'0.6rem', color:C.muted, opacity:0.6 }}>example</span>}
                          </div>
                          <p style={{ fontSize:'0.82rem', color:C.text, margin:'0 0 0.35rem', lineHeight:1.55, whiteSpace:'pre-line' }}>
                            {isExp ? m.tweetText : (m.tweetText.length > 160 ? m.tweetText.slice(0,160)+'...' : m.tweetText)}
                          </p>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.875rem', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'0.69rem', color:C.sec }}>
                              {m.likes.toLocaleString()} likes &bull; {m.retweets.toLocaleString()} RT &bull; ~{m.followerEstimate.toLocaleString()} followers
                            </span>
                            {m.hookPattern && (
                              <span style={{ fontSize:'0.62rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'9999px', padding:'0.04rem 0.4rem', color:C.muted }}>{m.hookPattern}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'0.3rem', alignItems:'center', flexShrink:0 }}>
                          <button onClick={() => setExpandedModel(isExp ? null : m.id)}
                            style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem', display:'flex' }}>
                            <ChevronDown size={15} style={{ transform:isExp ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }}/>
                          </button>
                          <button onClick={() => deleteModel(m.id)}
                            style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem', display:'flex' }}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </div>

                      {/* Expanded section */}
                      {isExp && (
                        <div style={{ borderTop:'1px solid '+C.border }}>
                          {m.whyItWorked && (
                            <div style={{ padding:'0.75rem 1.1rem', borderBottom:'1px solid '+C.border }}>
                              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.amber, margin:'0 0 0.3rem' }}>Why it worked</p>
                              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>{m.whyItWorked}</p>
                            </div>
                          )}
                          <div style={{ padding:'0.875rem 1.1rem', background:'rgba(0,212,255,0.025)' }}>
                            <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.cyan, margin:'0 0 0.4rem' }}>Sound Money Alternative</p>
                            <p style={{ fontSize:'0.84rem', color:C.text, margin:'0 0 0.875rem', lineHeight:1.65, fontStyle:'italic', whiteSpace:'pre-line' }}>
                              &#8220;{m.soundMoneyAlternative}&#8221;
                            </p>
                            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                              <button onClick={() => useHook(m)}
                                style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.38rem 0.875rem',
                                  background:'rgba(0,212,255,0.12)', border:'1px solid rgba(0,212,255,0.3)',
                                  borderRadius:'0.5rem', color:C.cyan, fontWeight:700, fontSize:'0.73rem',
                                  cursor:'pointer', fontFamily:'inherit' }}>
                                <Zap size={12}/> Use this hook &#8594;
                              </button>
                              {m.tweetUrl && (
                                <a href={m.tweetUrl} target="_blank" rel="noopener"
                                  style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.38rem 0.75rem',
                                    background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem',
                                    color:C.muted, fontSize:'0.73rem', fontWeight:600, textDecoration:'none' }}>
                                  View original <ExternalLink size={10}/>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add from URL modal ───────────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', zIndex:90, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:C.surface, border:'1px solid '+C.border, borderRadius:'1.25rem', padding:'1.5rem', width:'100%', maxWidth:'500px', maxHeight:'90vh', overflowY:'auto' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
              <span style={{ fontSize:'0.95rem', fontWeight:900, color:C.text }}>Add Tweet Model</span>
              <button onClick={closeAddModal} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:'1.1rem', lineHeight:1, fontFamily:'inherit' }}>&#10005;</button>
            </div>

            {/* URL row */}
            <div style={{ marginBottom:'0.875rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>
                Tweet URL <span style={{ fontWeight:400, color:C.muted }}>(optional &#8212; auto-fills text below)</span>
              </p>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input type="text" value={addUrl} onChange={e => setAddUrl(e.target.value)}
                  placeholder="https://x.com/..."
                  style={{ flex:1, padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none' }}/>
                <button onClick={fetchOEmbed} disabled={!addUrl || analysing}
                  style={{ padding:'0.55rem 0.9rem', background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', borderRadius:'0.625rem', color:C.cyan, fontWeight:700, fontSize:'0.73rem', cursor:(!addUrl||analysing)?'not-allowed':'pointer', fontFamily:'inherit', flexShrink:0, opacity:(!addUrl||analysing)?0.5:1 }}>
                  Fetch
                </button>
              </div>
            </div>

            {/* Tweet text */}
            <div style={{ marginBottom:'0.875rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>Tweet text</p>
              <textarea value={addText} onChange={e => setAddText(e.target.value)}
                placeholder="Paste tweet text here (or auto-fill via Fetch above)..."
                rows={4}
                style={{ width:'100%', padding:'0.6rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', marginBottom:'0.875rem' }}>
              <div>
                <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.35rem' }}>Likes</p>
                <input type="number" value={addLikes} onChange={e => setAddLikes(Number(e.target.value))}
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div>
                <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.35rem' }}>Retweets</p>
                <input type="number" value={addRetweets} onChange={e => setAddRetweets(Number(e.target.value))}
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div>
                <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.35rem' }}>Est. Followers</p>
                <input type="number" value={addFollowers} onChange={e => setAddFollowers(Number(e.target.value))}
                  style={{ width:'100%', padding:'0.5rem 0.65rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none', boxSizing:'border-box' }}/>
              </div>
            </div>

            {/* Ratio preview */}
            {addFollowers > 0 && (addLikes + addRetweets) > 0 && (
              <div style={{ marginBottom:'0.875rem', padding:'0.55rem 0.875rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <span style={{ fontSize:'0.72rem', color:C.sec }}>Engagement ratio:</span>
                <span style={{ fontWeight:900, fontSize:'0.88rem', color: ((addLikes+addRetweets)/addFollowers) >= 5 ? C.green : C.amber }}>
                  {((addLikes + addRetweets) / addFollowers).toFixed(1)}x
                </span>
                {((addLikes+addRetweets)/addFollowers) < 5 && (
                  <span style={{ fontSize:'0.67rem', color:C.amber }}>below 5x threshold</span>
                )}
              </div>
            )}

            {/* Category */}
            <div style={{ marginBottom:'1.1rem' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:C.sec, margin:'0 0 0.4rem' }}>Category</p>
              <select value={addCat} onChange={e => setAddCat(e.target.value)}
                style={{ width:'100%', padding:'0.55rem 0.75rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.625rem', color:C.text, fontFamily:'inherit', fontSize:'0.82rem', outline:'none' }}>
                {CATEGORIES.filter(c => c.value !== 'all').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Analysis result */}
            {addAnalysis && (
              <div style={{ background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:'0.875rem', padding:'0.875rem 1rem', marginBottom:'1rem' }}>
                <p style={{ fontSize:'0.62rem', fontWeight:800, color:C.cyan, margin:'0 0 0.3rem', letterSpacing:'0.08em', textTransform:'uppercase' }}>Sound Money Alternative</p>
                <p style={{ fontSize:'0.82rem', color:C.text, margin:'0 0 0.4rem', lineHeight:1.55, fontStyle:'italic', whiteSpace:'pre-line' }}>&#8220;{addAnalysis.soundMoneyAlternative}&#8221;</p>
                <p style={{ fontSize:'0.7rem', color:C.sec, margin:'0 0 0.2rem', lineHeight:1.5 }}>
                  <span style={{ fontWeight:700, color:C.amber }}>Hook:</span> {addAnalysis.hookPattern}
                </p>
                <p style={{ fontSize:'0.7rem', color:C.sec, margin:0, lineHeight:1.5 }}>{addAnalysis.whyItWorked}</p>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display:'flex', gap:'0.625rem' }}>
              {!addAnalysis ? (
                <button onClick={analyzeUrl} disabled={!addText || analysing}
                  style={{ flex:1, padding:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem',
                    background: (!addText||analysing) ? C.card : 'linear-gradient(135deg,'+C.cyan+','+C.purple+')',
                    border:'1px solid '+((!addText||analysing) ? C.border : 'transparent'),
                    borderRadius:'0.75rem', color:(!addText||analysing) ? C.muted : '#fff',
                    fontWeight:800, fontSize:'0.88rem', cursor:(!addText||analysing) ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit', opacity:(!addText||analysing) ? 0.6 : 1 }}>
                  {analysing
                    ? <><span style={{ display:'inline-block', width:'13px', height:'13px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'xspin 0.8s linear infinite' }}/> Analyzing...</>
                    : 'Analyze with AI'}
                </button>
              ) : (
                <button onClick={saveModel}
                  style={{ flex:1, padding:'0.65rem', background:'linear-gradient(135deg,'+C.green+','+C.cyan+')', border:'none', borderRadius:'0.75rem', color:'#000', fontWeight:800, fontSize:'0.88rem', cursor:'pointer', fontFamily:'inherit' }}>
                  Save to Library
                </button>
              )}
              <button onClick={closeAddModal}
                style={{ padding:'0.65rem 1rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.sec, fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes xspin { to { transform:rotate(360deg) } }`}</style>
    </main>
  )
}

export default function XPage() {
  return <Suspense><XPageInner/></Suspense>
}
