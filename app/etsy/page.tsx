'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, CheckCircle, Circle, RotateCcw, ChevronDown, ExternalLink, Search } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ETSY_NOTES, SOFTWARE_PIPELINE, ETSY_TODOS, ETSY_LINKS, BATCH_WORKFLOW } from '@/lib/etsy-data'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  orange:'#f97316', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  teal:'#14b8a6', pink:'#ec4899',
}

type Tab = 'checklists' | 'sops' | 'notes' | 'pipeline' | 'todos' | 'links' | 'batch'

const tabColor: Record<Tab, string> = {
  checklists: C.orange, sops: C.amber, notes: C.purple,
  pipeline: C.green, todos: C.red, links: C.teal, batch: C.pink,
}

function priorityColor(p: string): string {
  return p === 'High' ? C.red : p === 'Medium' ? C.amber : '#555577'
}

function stageColor(s: string): string {
  return s === 'Completed' ? C.green : s === 'Ongoing' ? C.teal : s === 'Started' ? C.amber : C.muted
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display:'inline-block', background: color+'22', color,
      padding:'0.1rem 0.42rem', borderRadius:'0.3rem',
      fontSize:'0.6rem', fontWeight:700, whiteSpace:'nowrap', letterSpacing:'0.02em',
    }}>{label}</span>
  )
}

function SearchBar({ value, onChange, placeholder }: { value:string; onChange:(v:string)=>void; placeholder:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.45rem 0.875rem', marginBottom:'1rem' }}>
      <Search size={13} color={C.muted} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex:1, background:'none', border:'none', outline:'none', color:C.text, fontSize:'0.82rem', fontFamily:'inherit' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0 0.2rem', fontSize:'0.8rem', fontFamily:'inherit' }}>x</button>
      )}
    </div>
  )
}

// ---- Checklists ----
type CItem = { id:string; label:string; note:string }
type Section = { id:string; title:string; emoji:string; items:CItem[] }

const SECTIONS: Section[] = [
  {
    id:'product', title:'Product & Niche', emoji:'&#128247;',
    items:[
      { id:'pr1', label:'Anchor product on Comfort Colors 1717 (premium) or Gildan 16000 (budget)', note:'Gildan 18000 sweatshirt in cold months. Comfort Colors is trending.' },
      { id:'pr2', label:'Validate niche demand in Everbee, Erank, or Alura before designing', note:'Look for search volume &gt;1,000/month with mid-level competition' },
      { id:'pr3', label:'Confirm niche is not over-saturated &mdash; look for buyer signals, not just listings', note:'Cross-niche method: combine two niches to find gaps, e.g. &ldquo;dog mum nurses&rdquo;' },
      { id:'pr4', label:'Long-term target: 1,000+ active listings at 15&ndash;20 min per listing at scale', note:'Use template method &mdash; once you have 10 templates, volume compounds quickly' },
    ]
  },
  {
    id:'design', title:'Design', emoji:'&#127912;',
    items:[
      { id:'de1', label:'Open Canva, Kittl, or Figma for the design', note:'Kittl: arc/university-style text. Figma: templates and artboards. Canva: quick drafts.' },
      { id:'de2', label:'Source graphics from Midjourney, Creative Fabrica, Freepik, or Etsy (verify licence)', note:'Must use Midjourney, Creative Fabrica, Etsy, or Freepik &mdash; no other unlicensed sources' },
      { id:'de3', label:'Add font glyphs from Creative Fabrica for uniqueness (cannot do in Canva)', note:'Font glyphs add differentiation that basic Canva competitors cannot replicate' },
      { id:'de4', label:'Max 2 complementary fonts based on what is currently selling in the niche', note:'Check bestsellers for trending font styles &mdash; not all fonts sell on apparel' },
      { id:'de5', label:'1 colour or tight complementary palette &mdash; many bestsellers are single colour', note:'Uncomplementary colours look tacky at thumbnail scale' },
      { id:'de6', label:'Export at 4500&times;5100px transparent PNG. Whites use #FCFCFC (not #FFFFFF).', note:'#FCFCFC forces double-print for vibrant white. No transparency in file (prints incorrectly).' },
      { id:'de7', label:'Trademark check every text phrase on USPTO before publishing', note:'https://www.uspto.gov/trademarks/search &mdash; no Disney, Taylor Swift, or branded terms' },
    ]
  },
  {
    id:'upload', title:'Upload Workflow', emoji:'&#128228;',
    items:[
      { id:'up1', label:'Prepare all listing content in Prelist: title, description, tags, price', note:'Complete all fields before opening Printify &mdash; avoids context switching' },
      { id:'up2', label:'Set up product in Printify &mdash; Swift POD or Monster Digital supplier', note:'Choose by quality + lead time for your customer region. Test order first.' },
      { id:'up3', label:'Use Vela for bulk variant management and colour &rarr; mockup photo assignment', note:'Each colour variant should map to its correct mockup image' },
      { id:'up4', label:'Listing disclosure: &ldquo;another company or person&rdquo;, &ldquo;made to order&rdquo;, production partner selected', note:'Required Etsy disclosure &mdash; shop will be shut down without it on every listing' },
    ]
  },
  {
    id:'photos', title:'Listing: Photos', emoji:'&#128247;',
    items:[
      { id:'ph1', label:'Main photo: min 2000px, readable at 4:3 and square thumbnail ratios', note:'Check at 120px wide &mdash; design must be legible at Etsy mobile grid size' },
      { id:'ph2', label:'Main photo is NOT AI-generated &mdash; must be real mockup of exact product', note:'Etsy TOS: main image must accurately represent what is being sold' },
      { id:'ph3', label:'Mockup for every colour variant offered', note:'Buyers rarely purchase colours they cannot see in a mockup' },
      { id:'ph4', label:'Size guide/chart in photos &mdash; guarantee/trust slide in first 2 images', note:'Size chart reduces returns; guarantee slide (Andreas method) builds buyer confidence' },
      { id:'ph5', label:'Alt text entered on main photo; all photos consistent in placement and branding', note:'Alt text helps Etsy + Google SEO. Cohesive look builds trust.' },
    ]
  },
  {
    id:'seo', title:'Listing: SEO & Tags', emoji:'&#128269;',
    items:[
      { id:'se1', label:'Title: first keyphrase = most accurate product description, rest separated by commas', note:'Each phrase must be a real search term someone would type &mdash; no keyword stuffing' },
      { id:'se2', label:'Include at least one &ldquo;gift&rdquo; keyphrase in title', note:'&ldquo;gift&rdquo; is one of the highest-volume search terms on Etsy &mdash; pair with niche' },
      { id:'se3', label:'All 13 tags used &mdash; multi-word phrases only; do not repeat attributes', note:'Attributes count as tags automatically. Tags not used = searches missed.' },
      { id:'se4', label:'Most relevant keyphrases appear in both title AND tags', note:'Etsy Seller Handbook: appearing in both signals stronger relevance to algorithm' },
      { id:'se5', label:'Relevant attributes selected: occasion, colour, style, holiday, etc.', note:'Use George McConnel method: collect tags from top-selling competitors in your niche' },
      { id:'se6', label:'Description: first 2 sentences keyword-rich (NOT the title copy-pasted)', note:'Top of description is indexed for SEO; remainder should be point-form and scannable' },
      { id:'se7', label:'Description includes: care instructions, sizing note, returns policy, personalisation guide', note:'Preempts the most common customer service questions' },
      { id:'se8', label:'EU/NI shipping: GPSR contact in description. AI-assisted design: add disclaimer.', note:'GPSR is a legal requirement. Etsy Handbook requires AI disclaimer. Printify provides GPSR contact.' },
    ]
  },
  {
    id:'shop', title:'Shop Setup', emoji:'&#128717;',
    items:[
      { id:'sh1', label:'Shop name: easy to type and remember &mdash; reflects niche or general vibe', note:'People re-search you by name for repeat purchases. Nothing like Janie10292.' },
      { id:'sh2', label:'Banner + logo match in colours and fonts, logo readable at small size', note:'Cohesive branding looks professional; don&apos;t overcomplicate the banner' },
      { id:'sh3', label:'Shop title contains main niche keywords (e.g. &ldquo;Custom family tshirts and sweatshirts&rdquo;)', note:'Shop title is read by the Etsy algorithm' },
      { id:'sh4', label:'Profile photo: real photo of you (NOT logo). About Me: fully filled out.', note:'Etsy is a marketplace for real people &mdash; buyers trust faces. Etsy won&apos;t rank incomplete shops.' },
      { id:'sh5', label:'Returns/exchanges policy set up &mdash; GDPR policy added for UK/EU selling', note:'Use alura.io/resources/etsy-privacy-policy-generator. LUCID number if selling to Germany.' },
      { id:'sh6', label:'Shop sections created with keyword-based titles; auto translation ON; sold listings hidden', note:'Sections are read for SEO. Translation reaches more buyers. Hidden sales deters competitors.' },
      { id:'sh7', label:'Instagram created + linked in &ldquo;Around the web&rdquo;; IG handle in message to buyer', note:'Secures handle, enables buyer tagging, drives social proof' },
      { id:'sh8', label:'Printify: linked to Etsy, order routing OFF, 24-hr approval, package inserts ON', note:'Order routing causes issues. 24-hr window allows order edits. Inserts drive repeat sales.' },
    ]
  },
  {
    id:'marketing', title:'Marketing', emoji:'&#128200;',
    items:[
      { id:'mk1', label:'Guarantee slide in listing photos 1&ndash;2 (satisfaction guarantee, free exchanges)', note:'Andreas / CU Online recommendation &mdash; builds buyer confidence before purchase' },
      { id:'mk2', label:'Free shipping on orders over &pound;35 (or $35) &mdash; shop absorbs shipping cost', note:'Alek method: incentivises customers to add a second item to cross the threshold' },
      { id:'mk3', label:'Abandoned cart + favorited item discounts automated in Etsy discounts', note:'Recovers shoppers who didn&apos;t complete. Converts window-shoppers to buyers.' },
      { id:'mk4', label:'Friends/family purchases to kickstart social proof before selling to strangers', note:'Very hard to get first sales with 0 reviews &mdash; seeding is essential early on' },
      { id:'mk5', label:'Share &amp; Save link used for all traffic you drive to Etsy externally', note:'Saves 4% on Etsy transaction fees for off-site traffic you generate yourself' },
    ]
  },
  {
    id:'cs', title:'Customer Service', emoji:'&#128718;',
    items:[
      { id:'cs1', label:'All messages replied to within 24 hours (Star Seller requirement)', note:'Set automated away messages when unavailable &mdash; missing this loses Star Seller' },
      { id:'cs2', label:'Message to buyer: thank you + 24-hr edit window + quality issue CTA + IG link', note:'Get them to message you before leaving a bad review &mdash; resolve privately first' },
      { id:'cs3', label:'Package insert: thank you + discount for next order + IG tag CTA', note:'Many buyers tag your shop on IG, giving free exposure to their followers' },
      { id:'cs4', label:'Review requests sent to recent deliveries (ask once, directly)', note:'Most people will not review without being asked. Send to delivered orders via messages.' },
      { id:'cs5', label:'Update dispatch date BEFORE deadline if order is running late', note:'Missing dispatch date = automatic Star Seller loss. Negative reviews: resolve privately first.' },
    ]
  },
]

const LS_KEY = 'flowstate_etsy_checklists'

// ---- Production SOPs ----
type SOP = { id:string; icon:string; title:string; tagline:string; steps:string[] }

const SOPS: SOP[] = [
  {
    id:'01', icon:'&#128247;', title:'Product + Niche',
    tagline:'Choose products with proven demand before designing a single thing.',
    steps:[
      'Anchor on Comfort Colors 1717 (premium/trending) or Gildan 16000 (budget); Gildan 18000 for cold months',
      'Use Everbee, Erank, or Alura to measure search volume and competition for niche keywords before committing',
      'Wholesale Ted cross-niche method: take a working niche and add a second qualifier &mdash; &ldquo;teacher shirts&rdquo; &rarr; &ldquo;chemistry teacher shirts for women&rdquo;',
      'Validate buyers not just views: filter Everbee for revenue data, not just listing count',
      'Long-term target: 1,000+ active listings using a template system &mdash; 15&ndash;20 min per new listing at scale',
      'Re-validate the niche every 90 days. Trends shift; don&apos;t keep producing into a dying market.',
    ]
  },
  {
    id:'02', icon:'&#128202;', title:'Ideas & Research',
    tagline:'Four proven methods to find winning ideas. Use all four, pick the strongest signals.',
    steps:[
      '<strong>Alek method:</strong> Search a broad niche term on Etsy, sort by &ldquo;Most Recent&rdquo;. Designs getting early sales = trending now. Note the style, font, and phrase.',
      '<strong>Cassiy method:</strong> Sort by &ldquo;Top Customer Reviews&rdquo;. These are proven buyers &mdash; look at what they bought, not what just launched.',
      '<strong>Simply POD method:</strong> Look at Etsy&apos;s seasonal gift guides. Find your niche inside a curated gift trend.',
      '<strong>Wholesale Ted cross-niche:</strong> Combine two niches &mdash; e.g. dog mums + nurses. Eliminates direct competition from saturated single-niche sellers.',
      'SEO keyword research: enter your idea into Everbee or Erank. Filter for high volume + mid competition.',
      '<strong>George McConnel tags method:</strong> collect tags from the top-selling competitor listings in your niche and model your own tag list from their proven phrases.',
      'Track all ideas in a spreadsheet before designing. Validate demand first, design second.',
    ]
  },
  {
    id:'03', icon:'&#127912;', title:'Design',
    tagline:'Fast, clean, high-contrast designs that are readable at thumbnail scale.',
    steps:[
      '<strong>Tools:</strong> Canva (quick mockups), Kittl (arc/university text, effects), Figma (templates and artboards), Illustrator (advanced)',
      '<strong>Graphics:</strong> Midjourney, Creative Fabrica, Freepik, or Etsy vectors &mdash; verify commercial licence on every asset',
      'Add font glyphs from Creative Fabrica for uniqueness that plain Canva competitors can&apos;t replicate easily',
      'Max 2 complementary font duos &mdash; research which fonts are selling on your product type right now',
      'Keep designs simple: 1 colour or tight complementary palette. Many bestsellers are single colour.',
      'Add personalisation value (names, custom text) &mdash; drives Etsy&apos;s personalisation search traffic',
      'Export: 4500&times;5100px transparent PNG. Whites: hex #FCFCFC for double-ink vibrance. 100% opacity throughout.',
      'Final thumbnail test: view at 12% size. If the design isn&apos;t readable, the buyer won&apos;t click.',
    ]
  },
  {
    id:'04', icon:'&#128228;', title:'Uploading',
    tagline:'Systematic batch upload: Prelist &rarr; Printify &rarr; Vela &rarr; Etsy.',
    steps:[
      'Prepare listing content in Prelist first: title, description, 13 tags, price, personalisation instructions',
      'In Printify: select supplier (Swift POD or Monster Digital), upload design, configure all variants',
      'Pricing target: 57% gross margin. Formula: (retail &minus; Printify cost) &divide; retail. At 10+ sales, move to 30&ndash;40%.',
      'Use Vela to bulk assign mockup photos per colour variant &mdash; ensures every colour has the correct image',
      'Set listing disclosure: &ldquo;another company&rdquo;, &ldquo;a finished product&rdquo;, &ldquo;made to order&rdquo;, production partner selected and obscured',
      'Shipping profile: processing 2&ndash;7 days (add buffer), USA under $6 USD (Etsy penalises above this), GPSR contact if EU/NI',
      'After publishing: view live on Etsy and verify thumbnail, all variants, personalisation box, and production partner disclosure',
    ]
  },
  {
    id:'05', icon:'&#128200;', title:'Marketing & SEO',
    tagline:'Win the Etsy algorithm through SEO. Every listing should work passively.',
    steps:[
      '<strong>Title:</strong> First phrase = most accurate product description. Rest separated by commas = alternative real searches. One &ldquo;gift&rdquo; phrase required.',
      '<strong>Tags:</strong> All 13 used. Multi-word phrases only. Don&apos;t repeat attributes. Use George McConnel method &mdash; model tag list from top-selling competitors.',
      '<strong>Description:</strong> First 2 sentences keyword-rich (not title copy-paste). Then point-form: care instructions, sizing, returns, personalisation guide.',
      '<strong>Photos:</strong> Mockups at 2700&times;2200px minimum. No AI main photo. Guarantee slide in images 1&ndash;2. Alt text on main photo.',
      'SEO completeness: fill About Me, shop title, shop sections, attributes &mdash; Etsy ranks incomplete shops lower',
      'On new listings: run 25% off for 5 days to kickstart conversion signals that improve organic rank',
      'All external traffic &rarr; Etsy via Share &amp; Save link (saves 4% on transaction fees)',
    ]
  },
  {
    id:'06', icon:'&#128172;', title:'Customer Service',
    tagline:'Protect Star Seller, prevent bad reviews, generate repeat customers.',
    steps:[
      'Reply to all messages within 24 hours &mdash; set automated away messages when unavailable. Missing this loses Star Seller.',
      'Message to buyer (auto): edit window (24 hrs), quality issue contact CTA, thank you, IG handle',
      'If complaint: offer full replacement or refund immediately &mdash; resolve before they can leave a review',
      'Reviews: message every delivered order asking for a review. Ask once only. Most buyers won&apos;t review without being asked.',
      'Negative reviews: message customer to resolve privately, then respond publicly once done',
      'Package insert via Printify branding: thank you + discount code + IG tag CTA',
      'Automate: thank-you discount, abandoned cart discount, favorited-item discount in Etsy Discounts panel',
    ]
  },
  {
    id:'07', icon:'&#127981;', title:'Shop Administration',
    tagline:'One-time setup so the shop works correctly and stays compliant.',
    steps:[
      'VAT: Etsy collects and remits UK/EU VAT automatically. Register for UK VAT if your turnover exceeds &pound;90,000.',
      'Shipping profiles: processing 2&ndash;7 days + buffer; USA USPS under $6 USD; EU/NI with GPSR contact; Germany LUCID number added',
      'Production partners: set up in Etsy account once, then select on every listing (Printify/Swift POD/Monster)',
      'Instagram @TopNotchThreadz: create account, link in Etsy &ldquo;Around the web&rdquo;, include in message to buyer',
      'Printify settings: order routing OFF, 24-hour approval window, package inserts ON, gift messages ON',
      'Etsy shop completeness: banner + logo, About Me, shop members, shop sections, translation ON, sold listings hidden',
      'Printify premium: enable when monthly sales exceed &pound;115 &mdash; savings outweigh the subscription cost',
    ]
  },
  {
    id:'08', icon:'&#128230;', title:'Printify',
    tagline:'Provider setup, pricing, and variant management for POD fulfilment.',
    steps:[
      '<strong>Providers:</strong> Swift POD (fast, quality, US-focused) and Monster Digital (alternative for quality comparison)',
      'Test order every new product before mass-uploading to Etsy &mdash; verify print quality, colour accuracy, sizing',
      '<strong>Pricing:</strong> target 57% gross margin. E.g. Printify cost &pound;12 &rarr; sell at &pound;28 for ~57% margin after fees.',
      'At 10+ sales of one design: consider 30&ndash;40% margin to remain competitive while still profitable',
      'Variant setup: create all colours in Printify, then use Vela to assign individual mockup photos per colour',
      'Settings: order routing OFF, approval 24-hour window, delayed orders auto-send ON, package inserts ON',
      'Printify premium: free month with code &ldquo;cuonline&rdquo; &mdash; enable when sales exceed &pound;115/month to save on base costs',
    ]
  },
  {
    id:'09', icon:'&#128201;', title:'Etsy Analytics',
    tagline:'Track the right numbers. Most shops get 1&ndash;3% conversion &mdash; optimise visits, not views.',
    steps:[
      'Key metric: conversion rate = orders &divide; visits (not views). Industry average 1&ndash;3%. Below 1% = listing or trust problem.',
      'High views + low visits = thumbnail not compelling enough. High visits + low conversion = pricing or listing quality issue.',
      'Check traffic sources: is it Etsy organic search, Etsy ads, or off-site? Organic is the long-term goal.',
      'Monitor which listings generate revenue vs dead weight. Pause underperformers after 90 days; iterate on winners.',
      'Seasonal planning: create new listings 6&ndash;8 weeks before peak gift seasons (Christmas, Mother&apos;s Day, Valentine&apos;s).',
      'Use Everbee to benchmark competitor revenue in your niche &mdash; find what is actually selling right now.',
    ]
  },
]

// ---- Components ----
function CheckItem({ id, label, note, checked, onToggle }: { id:string; label:string; note:string; checked:boolean; onToggle:(id:string)=>void }) {
  return (
    <button onClick={() => onToggle(id)} style={{
      display:'flex', alignItems:'flex-start', gap:'0.875rem',
      width:'100%', padding:'0.75rem 0.875rem', textAlign:'left',
      background: checked ? 'rgba(0,255,136,0.05)' : 'rgba(255,255,255,0.02)',
      border:'1px solid '+(checked ? 'rgba(0,255,136,0.2)' : C.border),
      borderRadius:'0.75rem', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s ease',
    }}>
      <div style={{ flexShrink:0, marginTop:'1px', color: checked ? C.green : C.muted, transition:'color 0.15s' }}>
        {checked ? <CheckCircle size={17} /> : <Circle size={17} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.82rem', fontWeight:600, margin:'0 0 0.15rem', color: checked ? C.green : C.text, textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.75 : 1 }}
          dangerouslySetInnerHTML={{ __html: label }} />
        <p style={{ fontSize:'0.7rem', color:C.muted, margin:0, lineHeight:1.5 }}
          dangerouslySetInnerHTML={{ __html: note }} />
      </div>
    </button>
  )
}

function SOPCard({ sop }: { sop:SOP }) {
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
          <p style={{ fontSize:'0.72rem', color:C.orange, fontStyle:'italic', margin:'0.75rem 0 0.875rem', lineHeight:1.5 }}>{sop.tagline}</p>
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

export default function EtsyPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<Tab>('checklists')
  const [checked, setChecked] = useState<Record<string,boolean>>({})
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['product']))
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [todoFilter, setTodoFilter] = useState('All')
  const [pipeFilter, setPipeFilter] = useState('All')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setChecked(JSON.parse(raw) as Record<string,boolean>)
    } catch {}
    setMounted(true)
  }, [])

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function resetAll() {
    setChecked({})
    try { localStorage.removeItem(LS_KEY) } catch {}
  }

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
  const totalDone  = Object.values(checked).filter(Boolean).length
  const pct = Math.round(totalDone / totalItems * 100)

  const tabs: { key: Tab; label: string }[] = [
    { key:'checklists', label: t('checklists') },
    { key:'sops', label: t('productionSOPs') },
    { key:'notes', label:'Notes' },
    { key:'pipeline', label:'Pipeline' },
    { key:'todos', label:'Todos' },
    { key:'links', label:'Links' },
    { key:'batch', label:'Batch' },
  ]

  const linkStyle = (color: string) => ({
    display:'flex' as const, alignItems:'center' as const, gap:'0.3rem',
    background: color+'14', border:'1px solid '+color+'33',
    borderRadius:'0.45rem', color, textDecoration:'none',
    padding:'0.28rem 0.55rem', fontSize:'0.67rem', fontWeight:700, flexShrink:0 as const,
    whiteSpace:'nowrap' as const,
  })

  return (
    <main style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:10px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(249,115,22,0.35)}
        *{scrollbar-width:thin;scrollbar-color:#2a2a3a transparent}
        input::placeholder{color:#4a4a6a}
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:'1px solid '+C.border, padding:'1.5rem 2rem 0' }}>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', alignItems:'center', gap:'1rem', paddingBottom:'0.75rem' }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontFamily:'inherit', fontSize:'0.8rem', padding:0 }}>
            &#8592; {t('back')}
          </button>
          <div style={{ flex:1 }} />
          <ShoppingBag size={18} color={C.orange} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.orange }}>Etsy</span>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto' }}>
          <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>TopNotchThreadz</h1>
          <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 1rem' }}>SOPs, checklists, notes, and data for the Etsy POD shop</p>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', gap:'0', overflowX:'auto', msOverflowStyle:'none', scrollbarWidth:'none' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'0.7rem 1rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.8rem', fontWeight: activeTab===tab.key ? 700 : 500,
              color: activeTab===tab.key ? tabColor[tab.key] : C.muted,
              borderBottom: activeTab===tab.key ? '2px solid '+tabColor[tab.key] : '2px solid transparent',
              marginBottom:'-1px', transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0,
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease' }}>

        {/* -- Checklists -- */}
        {activeTab === 'checklists' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'1rem', padding:'1.25rem', marginBottom:'1.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
                <div>
                  <h2 style={{ fontSize:'0.9rem', fontWeight:800, margin:0 }}>{t('overallProgress')}</h2>
                  <p style={{ fontSize:'0.72rem', color:C.muted, margin:'0.2rem 0 0' }}>{totalDone} of {totalItems} items complete</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  {totalDone > 0 && (
                    <button onClick={resetAll} style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'none', border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.muted, cursor:'pointer', fontFamily:'inherit', fontSize:'0.72rem', padding:'0.3rem 0.6rem' }}>
                      <RotateCcw size={11} /> Reset all
                    </button>
                  )}
                  <span style={{ fontSize:'1.5rem', fontWeight:900, color: pct===100 ? C.green : C.orange }}>{pct}%</span>
                </div>
              </div>
              <div style={{ height:'4px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:pct+'%', borderRadius:'2px', transition:'width 0.4s ease', background: pct===100 ? 'linear-gradient(90deg,'+C.green+',#00cc6a)' : 'linear-gradient(90deg,'+C.orange+',#ea580c)' }} />
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
              {SECTIONS.map(section => {
                const secDone = section.items.filter(item => checked[item.id]).length
                const secPct  = Math.round(secDone / section.items.length * 100)
                const isOpen  = openSections.has(section.id)
                return (
                  <div key={section.id} style={{ background:C.card, border:'1px solid '+(secPct===100 ? 'rgba(0,255,136,0.25)' : C.border), borderRadius:'0.875rem', overflow:'hidden', transition:'border-color 0.3s' }}>
                    <button onClick={() => toggleSection(section.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem