'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, CheckCircle, Circle, RotateCcw, ChevronDown, ExternalLink, Search, BookOpen } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ETSY_NOTES, SOFTWARE_PIPELINE, ETSY_TODOS, ETSY_LINKS, BATCH_WORKFLOW } from '@/lib/etsy-data'
import { supabase } from '@/lib/supabase'

const C = {
  bg:'#0a0a0f', surface:'#12121a', card:'#1a1a26', border:'#2a2a3a',
  orange:'#f97316', green:'#00ff88', amber:'#ffb800', purple:'#8b5cf6',
  red:'#ff4466', text:'#f0f0ff', sec:'#8888aa', muted:'#4a4a6a',
  teal:'#14b8a6', pink:'#ec4899', blue:'#60a5fa',
}

type Tab = 'framework' | 'checklists' | 'sops' | 'notes' | 'pipeline' | 'todos' | 'links' | 'batch' | 'prompts' | 'priority'

const tabColor: Record<Tab, string> = {
  framework: C.blue, checklists: C.orange, sops: C.amber, notes: C.purple,
  pipeline: C.green, todos: C.red, links: C.teal, batch: C.pink, prompts: '#22d3ee', priority: '#ff6b35',
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
      fontSize:'0.6rem', fontWeight:700, whiteSpace:'nowrap' as const, letterSpacing:'0.02em',
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
  {
    id:'listing_photos', title:'Listing Photos (Detailed)', emoji:'&#128247;',
    items:[
      { id:'lp1', label:'Main photo viewable at 4:3 ratio (2700x2025px) AND square (2000x2000px min)', note:'Etsy shows different ratios in different views - both must look correct' },
      { id:'lp2', label:'Design fully readable when thumbnail is very small (mobile grid size ~120px)', note:'Open Etsy on mobile and verify - the buyer must read the design from the list view' },
      { id:'lp3', label:'Main photo high resolution - minimum 2000px on shortest side, not blurry', note:'Low resolution looks unprofessional and kills buyer trust instantly' },
      { id:'lp4', label:'Full product visible in main photo - not so zoomed in you cannot see it is a t-shirt', note:'Buyer must understand what the product is from the very first image' },
      { id:'lp5', label:'No placeholder text on customised items - show a real example design instead', note:'Against Etsy TOS since policy update - must show a real custom example' },
      { id:'lp6', label:'Mockup for every colour variant offered in the listing', note:'Buyers rarely purchase colours they cannot see in a mockup photo' },
      { id:'lp7', label:'Colours clearly labelled OR photos linked to match each variation to its picture', note:'Avoids complaints and wrong-colour orders' },
      { id:'lp8', label:'Model or item facing forward in first mockup so full design is easy to see', note:'First photo must clearly show what you sell and what the design says' },
      { id:'lp9', label:'Design rotated to match shirt direction if necessary - mockup looks fully realistic', note:'Unrealistic mockups reduce conversion and increase returns and disputes' },
      { id:'lp10', label:'Photos look realistic - no hair blocking design, no wrinkles, design fits on product', note:'If design runs off the edge it looks like a print error and deters buyers' },
      { id:'lp11', label:'Photos consistent in product placement sizing across all mockups in listing', note:'Inconsistent sizing looks unprofessional and creates confusion between colours' },
      { id:'lp12', label:'First mockup photo is NOT AI-generated - must be real exact model mockup', note:'Etsy TOS: main image must accurately represent the exact product sold' },
      { id:'lp13', label:'Size guide or chart included in listing photos', note:'Reduces size-related customer service questions, complaints and returns' },
      { id:'lp14', label:'Trust info highlighted in photos: fit guide, guarantee, sustainability, best review', note:'Stand out from competition and make buyers decision easier' },
      { id:'lp15', label:'All photo cards match branding with clear, easy-to-read fonts', note:'Consistent branding increases trust and makes your shop memorable' },
      { id:'lp16', label:'Video (if included) is of the exact design being sold - not size charts or other products', note:'Video auto-plays on hover in Etsy search - must feature that exact listing item' },
    ]
  },
  {
    id:'listing_seo', title:'Listing SEO (Detailed)', emoji:'&#128269;',
    items:[
      { id:'ls1', label:'Keywords do not violate trademarks - verify every text phrase on USPTO before publishing', note:'Even image and design can violate - not just title/tags. Store shutdowns happen.' },
      { id:'ls2', label:'First keyword in title = most accurate description of the product (e.g. Custom Vintage Mama Tshirt)', note:'This is your most important keyword and signals relevance to Etsy algorithm' },
      { id:'ls3', label:'Rest of title filled with alternative PHRASES someone may actually type in Etsy search bar', note:'Accounts for every possible way a buyer might search for a product like yours' },
      { id:'ls4', label:'Title does NOT include vague keyphrases like "gift for her" or "girls shirt"', note:'These waste character space and are not likely to result in sales' },
      { id:'ls5', label:'Title phrases separated by commas for readability', note:'Etsy Seller Handbook recommends commas over stuffing all keywords together' },
      { id:'ls6', label:'At least one "gift" keyphrase in title matched to your niche', note:'"Gift" is one of the highest-volume search terms on Etsy - pair it with niche' },
      { id:'ls7', label:'Keyphrases in title are NOT single words only - must be descriptive phrases', note:'Single words like "shirt" or "gift" are highly saturated and not descriptive' },
      { id:'ls8', label:'Relevant attributes fully utilised - size, style, occasion, holiday, colour, neckline', note:'Etsy attributes count as additional tags - filling them out is free SEO' },
      { id:'ls9', label:'Alt text entered on main photo describing what the image shows', note:'Etsy Seller Handbook states alt text helps both Etsy SEO and external Google SEO' },
      { id:'ls10', label:'First 2 description sentences are keyword-rich - NOT the title copy-pasted', note:'Top of description is indexed for SEO. Etsy Handbook explicitly says do not paste title.' },
      { id:'ls11', label:'After keyword sentences, rest of description is point-form with clear headings', note:'Buyers cannot find information in giant paragraphs of unbroken text' },
      { id:'ls12', label:'All 13 tags used - no empty slots', note:'Unused tags = missed searches. Every slot is a potential sale opportunity.' },
      { id:'ls13', label:'Most relevant keyphrases appear in BOTH title AND tags', note:'Etsy Seller Handbook: appearing in both signals stronger relevance to the algorithm' },
      { id:'ls14', label:'Tags are multi-word phrases - not single words', note:'Descriptive keyphrases cover real buyer searches; single words are too vague to convert' },
      { id:'ls15', label:'Tags do NOT duplicate attributes - attributes already count as tags', note:'Repeating attributes in tags wastes your 13 available tag slots' },
    ]
  },
  {
    id:'printify_config', title:'Printify and Shop Config', emoji:'&#128230;',
    items:[
      { id:'pc1', label:'Printify account linked to the correct Etsy store', note:'Printify &gt; Sales Channels &gt; Selection - verify the right shop is connected' },
      { id:'pc2', label:'Etsy production partner set up in account: SwiftPod or Duplium selected on all listings', note:'Must disclose production partner on every listing to avoid Etsy shutdown' },
      { id:'pc3', label:'Order routing turned OFF in Printify settings', note:'Order routing has caused fulfilment issues in the past - manually choose supplier' },
      { id:'pc4', label:'Order approval window set to 24 hours in Printify settings', note:'Gives time to edit or cancel orders before they automatically go into production' },
      { id:'pc5', label:'Delayed orders set to auto-send to production when item comes back in stock', note:'Ensures fulfilment resumes automatically if a variant was temporarily out of stock' },
      { id:'pc6', label:'Package inserts turned ON in Printify branding settings', note:'Use inserts for thank you message, discount code, and Instagram tag CTA' },
      { id:'pc7', label:'Gift messages enabled in Printify if your supplier supports printing them', note:'Required setting to automate gift message fulfilment through Printify' },
      { id:'pc8', label:'Printify Premium enabled when monthly sales exceed $145 USD', note:'Past $145/month premium subscription saves more than it costs - code "cuonline" for free trial' },
      { id:'pc9', label:'Etsy: sold listings hidden; auto translation ON; gift notes option turned on', note:'Hidden sales deters competitors from copying winners. Translation reaches global buyers.' },
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
      '<strong>Biggest niches to start with:</strong> Holidays/Christmas, Professions, Bachelorettes &mdash; proven year-round demand',
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
      '<strong>Everbee pro tip:</strong> filter the full database by shops &lt; 24 months old + listings &lt; 3 months old &mdash; finds new winners before they get saturated.',
      'Track all ideas in a spreadsheet before designing. Validate demand first, design second.',
      '<strong>Research board:</strong> screenshot best-selling listings into a Canva or Figma whiteboard. Group by design similarity. Note fonts, colours, graphics, words. VISUAL RESEARCH FIRST &mdash; creativity before keyword analysis.',
      '<strong>Types of design:</strong> Templatised (one interchangeable word across niches: &ldquo;I stopped [X] to be here&rdquo;) vs One-off (graphic-based with Midjourney variations). Templatised scales faster.',
    ]
  },
  {
    id:'03', icon:'&#127912;', title:'Design',
    tagline:'Fast, clean, high-contrast designs that are readable at thumbnail scale.',
    steps:[
      '<strong>Tools:</strong> Canva (quick mockups), Kittl (arc/university text, effects), Figma (templates and artboards), Illustrator (advanced)',
      '<strong>Graphics:</strong> Midjourney, Creative Fabrica, Freepik, or Etsy vectors &mdash; verify commercial licence on every asset',
      'Add font glyphs from Creative Fabrica for uniqueness that plain Canva competitors can&apos;t replicate easily',
      '<strong>Font DUO technique:</strong> pair one blocky/bold font with one script or accent font. Look at proven combinations on bestselling listings before picking. Use font matcherator to identify fonts you see on Etsy.',
      'Max 2 complementary font duos &mdash; research which fonts are selling on your product type right now',
      'Keep designs simple: 1 colour or tight complementary palette. Many bestsellers are single colour.',
      '<strong>Distressed overlay:</strong> search &ldquo;distressed grunge text&rdquo; on Creative Fabrica and overlay in Canva or Photoshop for a vintage/worn look. Edmund font also achieves this naturally.',
      'Add personalisation value (names, custom text) &mdash; drives Etsy&apos;s personalisation search traffic',
      'Export: 4500&times;5100px transparent PNG. Whites: hex #FCFCFC for double-ink vibrance. 100% opacity throughout.',
      '<strong>Tracer App:</strong> if your graphic has many colours, vectorise it to SVG via Tracer &mdash; enables colour-swapping without quality loss.',
      'In Canva grid view: rename all designs before downloading. Duplicate the file to make a white-text version separately.',
      'Final thumbnail test: view at 12% size. If the design isn&apos;t readable, the buyer won&apos;t click.',
    ]
  },
  {
    id:'04', icon:'&#128228;', title:'Uploading',
    tagline:'Systematic batch upload: Prelist to Printify to Vela to Etsy.',
    steps:[
      'Prepare listing content in Prelist first: title, description, 13 tags, price, personalisation instructions',
      'In Printify: select supplier (Swift POD or Monster Digital), upload design, configure all variants',
      '<strong>Check DPI in Printify before publishing</strong> &mdash; must be above 300 DPI or print quality will fail',
      'Variant visibility: set to &ldquo;show all variants&rdquo; &mdash; if a colour is sold out, show the next option rather than hiding it',
      'Pricing target: 57% gross margin (with Printify Premium). Without Premium: target 45%. At 10+ sales, consider 30&ndash;40% to stay competitive.',
      'Use Vela to bulk assign mockup photos per colour variant &mdash; ensures every colour has the correct image',
      'Set listing disclosure: &ldquo;another company&rdquo;, &ldquo;a finished product&rdquo;, &ldquo;made to order&rdquo;, production partner selected and obscured',
      'Shipping profile: processing 2&ndash;7 days (add buffer), USA under $6 USD (Etsy penalises above this), GPSR contact if EU/NI',
      '<strong>Vela publishing order:</strong> Refresh &rarr; Select Products &rarr; Edit Listings &rarr; Shipping Profile (Apply) &rarr; Section (Apply) &rarr; Tags (Apply) &rarr; Delete Old Mockups (optional) &rarr; Listing Info Cards (Apply) &rarr; Mockups &rarr; Titles revisions &rarr; Tags revisions &rarr; Sync Updates',
      'After publishing: view live on Etsy and verify thumbnail, all variants, personalisation box, and production partner disclosure',
    ]
  },
  {
    id:'05', icon:'&#128200;', title:'Marketing & SEO',
    tagline:'Win the Etsy algorithm through SEO. Every listing should work passively.',
    steps:[
      '<strong>Keyword hierarchy:</strong> Primary (title &mdash; main concept) &rarr; Secondary (title + tags &mdash; niche modifiers) &rarr; Short-tail high-volume (tags + description) &rarr; Long-tail specific phrases (title). To rank on broad searches you must first rank on specific ones.',
      '<strong>Title:</strong> First phrase = most accurate product description. Rest separated by commas = alternative real searches. One &ldquo;gift&rdquo; phrase required. First 30 characters matter most.',
      '<strong>Tags:</strong> All 13 used. Multi-word phrases only. Don&apos;t repeat attributes. Model from top-selling competitors. &ldquo;Comfort Colors shirt&rdquo; is a strong general tag.',
      '<strong>Description:</strong> First 2 sentences keyword-rich (not title copy-paste). Then point-form: care instructions, sizing, returns, personalisation guide.',
      '<strong>Attributes:</strong> ONE OF THE BIGGEST SEO FACTORS &mdash; fill in all relevant ones (size, style, occasion, holiday, colour, neckline). Wisely chosen attributes free up tag slots.',
      '<strong>Photos:</strong> Mockups at 2700&times;2200px minimum. No AI main photo. Guarantee slide in images 1&ndash;2. Alt text on main photo.',
      '<strong>Guarantee template:</strong> &ldquo;If anything happens for any reason, you can contact us within 7&ndash;14 days of delivery and get either a replacement or a refund.&rdquo; &mdash; add this text to a mockup image card.',
      '<strong>Comfort Colors priority stack:</strong> Pepper (first &mdash; highest demand), Expresso, Bay, Berry, Blue Jean, Ivory, Moss, Orchid, Violet. Offer 6&ndash;7 colours only &mdash; need a mockup for each. 90% of sales are the colour of your first mockup.',
      'Create separate listings: one for light colours, one for dark colours &mdash; different mockups, different main photo, different title variations.',
      '<strong>Express Delivery:</strong> highlight express delivery option in mockup images &mdash; faster availability is a conversion lever',
      '<strong>Social proof:</strong> add a mockup card showing your best shop review &mdash; this alone can significantly lift conversion',
      'On new listings: run 25% off for 5 days to kickstart conversion signals that improve organic rank',
      'All external traffic via Share &amp; Save link (saves 4% on transaction fees)',
      '<strong>Ads:</strong> run Etsy ads on new listings to generate early sales data &mdash; early signal improves organic ranking',
      '<strong>Renewals:</strong> if a listing underperforms, update the mockups and relist &mdash; it gets a brief algorithm boost after changes. Test iterations before giving up.',
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
      '<strong>Returns process:</strong> ask customer for photo of shipping label + receipt + parcel. Use return address from print partner. Submit photo to Printify &mdash; they can often refund directly.',
      '<strong>Exchanges:</strong> charge a replacement fee of &#36;10&ndash;12 to break even &mdash; never absorb the full exchange cost',
      'Add a Q&amp;A section to listings: ask ChatGPT &ldquo;What concerns may make someone hesitate buying [PRODUCT]?&rdquo; &mdash; preempt the top 5 in your description and info cards',
      '<strong>Canned messages:</strong> set up templated responses in Etsy Messages for common queries. Example: &ldquo;We ship most orders within 1&ndash;3 business days. US delivery takes 1&ndash;6 days in transit. We do not guarantee delivery times.&rdquo;',
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
      '<strong>Pinterest:</strong> create Pinterest account alongside Instagram &mdash; both required for social traffic. Ask buyers to follow and tag on both.',
      'Printify settings: order routing OFF, 24-hour approval window, package inserts ON, gift messages ON',
      'Etsy shop completeness: banner + logo, About Me, shop members, shop sections, translation ON, sold listings hidden',
      '<strong>About Me page:</strong> must be fully complete with photos, personal story, shop members and blurb &mdash; Etsy will not fully rank incomplete shops',
      '<strong>Canned messages:</strong> set up templated responses in Etsy Messages before you get busy &mdash; shipping queries, sizing questions, personalisation instructions',
      'Shop Title: tell buyers exactly what you sell (e.g. &ldquo;Custom family t-shirts and sweatshirts&rdquo;) &mdash; most sellers skip this',
      'Printify premium: enable when monthly sales exceed &pound;115 &mdash; savings outweigh the subscription cost',
    ]
  },
  {
    id:'08', icon:'&#128230;', title:'Printify',
    tagline:'Provider setup, pricing, and variant management for POD fulfilment.',
    steps:[
      '<strong>Providers:</strong> Swift POD (fast, quality, US-focused) and Monster Digital (alternative for quality comparison)',
      'Test order every new product before mass-uploading to Etsy &mdash; verify print quality, colour accuracy, sizing',
      '<strong>Initial colour setup:</strong> White, Ivory, Bay, Orchid, Violet, Blossom, Blue Jean &mdash; add these variants first. Remove all default Printify mockups (Save Selection only) and replace with your own.',
      '<strong>Pricing:</strong> target 57% gross margin with Printify Premium. Without Premium: target 45%. At 57%, retail is approx. &pound;28&ndash;35. Note: 57% is pre-sale &mdash; running promotions reduces real margin.',
      'At 10+ sales of one design: consider 30&ndash;40% margin to remain competitive while still profitable',
      'Variant setup: create all colours in Printify, then use Vela to assign individual mockup photos per colour',
      'Settings: order routing OFF, approval 24-hour window, delayed orders auto-send ON, package inserts ON',
      'Printify premium: free month with code &ldquo;cuonline&rdquo; &mdash; enable when sales exceed &pound;115/month to save on base costs',
    ]
  },
  {
    id:'09', icon:'&#128201;', title:'Etsy Analytics',
    tagline:'Track the right numbers. Most shops get 1-3% conversion &mdash; optimise visits, not views.',
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

// ---- ChatGPT Prompts ----
type PromptItem = { title: string; prompt: string; note: string }
type PromptCategory = { category: string; emoji: string; items: PromptItem[] }

const CHATGPT_PROMPTS: PromptCategory[] = [
  {
    category: 'Niche Discovery',
    emoji: '&#128270;',
    items: [
      {
        title: 'Hobby list for niches',
        prompt: 'Give me a list of 50 of the most popular hobbies, sports, and activities that I can use as niche ideas for my print on demand business',
        note: 'Starting point - take each idea and validate on Etsy / Everbee before designing'
      },
      {
        title: 'Niche deep-dive',
        prompt: 'Outline the most important aspects of the [NICHE] niche that I should know to create products and listings that resonate. Include insights on customer interests, unique keywords or themes, slang or lingo, and preferred aesthetics',
        note: 'Replace [NICHE] with your target e.g. "30th birthday"'
      },
      {
        title: 'Trending themes in niche',
        prompt: 'I am creating [NICHE] shirts - what are the top trending party themes or activities for someone [TARGET AUDIENCE]',
        note: 'e.g. "30th birthday shirts" / "someone turning 30"'
      },
      {
        title: 'Niche sub-ideas',
        prompt: 'Give me 20 niche ideas within [BROAD NICHE] for print on demand products that are specific enough to have low competition but enough demand to sell',
        note: 'e.g. [BROAD NICHE] = "nurse gifts" - niche down to oncology nurse, night shift nurse, etc.'
      },
    ]
  },
  {
    category: 'Phrase Generation',
    emoji: '&#128172;',
    items: [
      {
        title: 'Sarcastic phrases for age niche',
        prompt: 'Give me 20 sarcastic phrases that only someone turning [AGE] would understand',
        note: 'Replace [AGE] with 30, 40, 50, etc.'
      },
      {
        title: 'Profession shirt phrases',
        prompt: 'Give me 30 funny phrases that I could use for shirt designs that only a [PROFESSION] would understand',
        note: 'e.g. "school counselor", "oncology nurse", "accountant"'
      },
      {
        title: 'Cross-niche combo phrases',
        prompt: 'Give me 30 sarcastic phrases that I could use for a mug design that only a [NICHE] who loves [HOBBY] would understand',
        note: 'e.g. "Siamese cat owner who loves books" - cross-niche method'
      },
      {
        title: 'Group vacation / event shirts',
        prompt: 'Give me 30 funny "most likely to" phrases that I could use for group vacation shirts with a [THEME] theme',
        note: 'e.g. camping, beach, bachelorette, family reunion, stag do'
      },
      {
        title: 'Trademark-free sayings',
        prompt: 'Give me trademark-free sayings that I can use for my print on demand sweatshirt targeting [NICHE]',
        note: 'Always verify on USPTO after - ChatGPT can hallucinate trademarked phrases'
      },
      {
        title: 'Template phrase variations',
        prompt: 'Take the saying "[BASE SAYING]" and give me 20 variations that swap the core word for different niches while keeping the same format and humour',
        note: 'e.g. "I stopped reading to be here" -> cooking, baking, knitting, hiking, gaming'
      },
    ]
  },
  {
    category: 'Listing Copy',
    emoji: '&#128221;',
    items: [
      {
        title: 'Etsy description opener (SEO)',
        prompt: 'Using these keywords write a 200 character description for my [PRODUCT] that goes at the top of an Etsy listing description: [KEYWORDS]',
        note: 'First 2 sentences are indexed by Etsy for SEO - must include primary keywords naturally'
      },
      {
        title: 'Buyer hesitation research',
        prompt: 'I sell [PRODUCT] on Etsy. What possible concerns, doubts or questions may make someone hesitate from buying? List the top 10.',
        note: 'Use the output to build your mockup info cards and description bullet points'
      },
      {
        title: 'Full product description',
        prompt: 'Write a complete Etsy product description for a [PRODUCT] in the [NICHE] niche. Use these keywords: [KEYWORDS]. Include care instructions, sizing note, and returns policy. Format with short paragraphs and bullet points.',
        note: 'Edit the output - remove anything that sounds generic or AI-written'
      },
    ]
  },
  {
    category: 'Keywords & Tags',
    emoji: '&#127991;',
    items: [
      {
        title: 'Long-tail keyword list',
        prompt: 'Give me 30 long-tail keyword phrases for an Etsy listing selling [PRODUCT] in the [NICHE] niche. These should be specific phrases buyers would actually type into Etsy.',
        note: 'Verify search volume in Erank or Everbee before using'
      },
      {
        title: '13 Etsy tags',
        prompt: 'Give me 13 Etsy tags for a [PRODUCT] targeting [NICHE]. Tags must be multi-word phrases, not single words. Include occasion, gift, and style variations.',
        note: 'Use as a starting point - cross-check against actual top seller tags in Erank'
      },
    ]
  },
]

// ---- Font Reference ----
const FONTS: { category: string; fonts: string[]; useCase: string }[] = [
  { category: 'General / Versatile', fonts: ['Remington Weather', 'Paper Cutout', 'Vintage College Dept', 'Vancouver'], useCase: 'Everyday niches, text-only designs, sarcastic sayings' },
  { category: 'Feminine / Women\'s', fonts: ['Clementina', 'Limon Mint'], useCase: 'Women\'s shirts, mothers, feminine niches' },
  { category: 'Rustic / Stressed', fonts: ['Edmund', 'Rustic Pantry'], useCase: 'Rustic look, distressed aesthetic, country themes' },
  { category: 'Dictionary / Fake Definition', fonts: ['Bookmania'], useCase: 'Fake definition shirts: "Accountant (n.) someone who..."' },
  { category: 'Western / Country', fonts: ['Monday', 'Road Rage', 'Western Carlo'], useCase: 'Country music, rodeo, Western lifestyle niches' },
  { category: 'Halloween', fonts: ['Sansation', 'Vampire Zone', 'Spooky Man'], useCase: 'Halloween season designs' },
  { category: 'Kids / Fun', fonts: ['Dinosauce', 'Islands Sans', 'Morris Jr'], useCase: 'Children\'s clothing, family matching sets' },
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

// ---- Framework ----
const PHASE_RULES = [
  'Buyer profile: Christian women - apparel only',
  'Products: t-shirts and sweatshirts only in Phase 1',
  'Designs: simple typography only - no florals, illustrations, embroidery, or mugs',
  'Goal: reach 1,000 active listings as quickly as possible using a template system',
  'Listing speed target: 15-20 minutes per listing at scale once templates are built',
]

const TIME_BLOCK_RULES = [
  'Do not task switch during sessions - batch by task type',
  'Research day, design day, upload day - never mix all three in one session',
  'Set up a recurring calendar with fixed task blocks for each phase',
  'Take action every single day - consistency compounds more than bursts',
]

const STRATEGY_RULES = [
  '70% evergreen niches - content that sells year-round (nurse shirts, teacher gifts)',
  '30% trends and holidays - seasonal spikes planned 6-8 weeks in advance',
  'Target 25 new listings per week as the primary growth velocity goal',
  '10k/month revenue requires approx. 333,000 monthly views at 3% CVR',
  'Double-down strategy: if a design sells, make 5-10 variations immediately',
  'Cross-niche method: take what works in one niche and apply it to another niche',
]

const WORKFLOW_PHASES: { num:string; title:string; color:string; tasks:string[] }[] = [
  { num:'01', title:'Research &amp; Validate', color:'#8b5cf6', tasks:['Everbee/Erank niche research','Validate search volume + competition','Confirm buyer demand before designing'] },
  { num:'02', title:'Ideas &amp; Keywords', color:'#ffb800', tasks:['Alek / Cassiy / Simply POD methods','ChatGPT phrase generation','Seasonal trend planning'] },
  { num:'03', title:'Design &amp; Export', color:'#f97316', tasks:['Canva / Kittl / Midjourney','4500x5100px transparent PNG','8-15 variations per theme'] },
  { num:'04', title:'Upload &amp; Publish', color:'#00ff88', tasks:['Prelist for titles + tags','Printify for product setup','Vela for mockup assignment'] },
  { num:'05', title:'Market &amp; Optimise', color:'#14b8a6', tasks:['Guarantee slides in photos','Run 25% off for 5 days','Review requests on delivery'] },
]

const THIRTY_DAY_PLAN: string[] = [
  'Day 1: make 1 template. Post at least 7 products.',
  'Day 7: 7 templates built. Posting 7+ products every day.',
  'Day 30: 30 templates. Posting a minimum of 30 products per day.',
  'Ongoing: revise 1 existing template per day to improve it.',
  'This is the minimum viable system - templates compound. 30/day posting changes the outcome.',
]

const DESIGN_TYPES: { type:string; desc:string; color:string }[] = [
  { type:'Templatised', color:'#14b8a6', desc:'One interchangeable word used across many niches. E.g. "I stopped [ACTIVITY] to be here" -> cooking, baking, reading, gaming, hiking. Design once, multiply across 20+ niches. Fastest path to volume.' },
  { type:'One-Off', color:'#8b5cf6', desc:'Cannot be easily templatised but can have many graphic variations. If it uses an image, use Midjourney to generate 8-15 similar copyright-free variants. Volume comes from iteration, not templates.' },
]

const ETSY_PRIORITY_KEY = 'etsy_todos_priority'

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
  const [copiedPrompt, setCopiedPrompt] = useState<string|null>(null)
  const [priorityOrder, setPriorityOrder] = useState<string[]>([])
  const [dragId, setDragId] = useState<string|null>(null)
  const [dragOver, setDragOver] = useState<string|null>(null)
  const [dragFrom, setDragFrom] = useState<'unassigned'|'priority'|null>(null)

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPrompt(text)
      setTimeout(() => setCopiedPrompt(null), 1600)
    }).catch(() => {
      setCopiedPrompt(text)
      setTimeout(() => setCopiedPrompt(null), 1600)
    })
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setChecked(JSON.parse(raw) as Record<string,boolean>)
    } catch {}
    supabase.from('checklist_state').select('state').eq('key', 'etsy_checklists').single().then(({ data }) => {
      if (data?.state && typeof data.state === 'object' && !Array.isArray(data.state)) {
        const s = data.state as Record<string,boolean>
        setChecked(s)
        try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
      }
    })
    let pLsLoaded = false
    try {
      const raw = localStorage.getItem('fs_p_etsy')
      if (raw) { const ids = JSON.parse(raw) as string[]; if (ids.length > 0) { setPriorityOrder(ids); pLsLoaded = true } }
    } catch {}
    supabase.from('priority_lists').select('ordered_ids').eq('key', ETSY_PRIORITY_KEY).single().then(({ data }) => {
      if (data?.ordered_ids && Array.isArray(data.ordered_ids) && (data.ordered_ids as string[]).length > 0) {
        const ids = data.ordered_ids as string[]
        setPriorityOrder(ids)
        try { localStorage.setItem('fs_p_etsy', JSON.stringify(ids)) } catch {}
      } else if (!pLsLoaded) {
        const allIds = ETSY_TODOS.map(td => td.notion_url || td.name)
        setPriorityOrder(allIds)
        try { localStorage.setItem('fs_p_etsy', JSON.stringify(allIds)) } catch {}
        supabase.from('priority_lists').upsert({ key: ETSY_PRIORITY_KEY, ordered_ids: allIds, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
      }
    })
    setMounted(true)
  }, [])

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
      supabase.from('checklist_state').upsert({ key: 'etsy_checklists', state: next, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
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
    supabase.from('checklist_state').upsert({ key: 'etsy_checklists', state: {}, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
  }

  function savePriority(order: string[]) {
    const y = window.scrollY
    setPriorityOrder(order)
    try { localStorage.setItem('fs_p_etsy', JSON.stringify(order)) } catch {}
    supabase.from('priority_lists').upsert({ key: ETSY_PRIORITY_KEY, ordered_ids: order, updated_at: new Date().toISOString() }, { onConflict: 'key' }).then()
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
  }

  function getTodoId(td: { notion_url?: string; name: string }): string {
    return td.notion_url || td.name
  }

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
  const totalDone  = Object.values(checked).filter(Boolean).length
  const pct = Math.round(totalDone / totalItems * 100)

  const ACTIVE_TODOS = ETSY_TODOS.filter(td => td.stage !== 'Completed')
  const validOrder = priorityOrder.filter(id => ACTIVE_TODOS.some(td => getTodoId(td) === id))
  const assignedSet = new Set(validOrder)
  const unassigned = ACTIVE_TODOS.filter(td => !assignedSet.has(getTodoId(td)))
  const unassignedCount = unassigned.length

  const tabs: { key: Tab; label: string }[] = [
    { key:'framework', label:'Framework' },
    { key:'checklists', label: t('checklists') },
    { key:'sops', label: t('productionSOPs') },
    { key:'prompts', label:'Prompts' },
    { key:'notes', label:'Notes' },
    { key:'pipeline', label:'Pipeline' },
    { key:'todos', label:'Todos' },
    { key:'links', label:'Links' },
    { key:'batch', label:'Batch' },
    { key:'priority', label:'Priority' },
  ]

  function lnk(color: string): React.CSSProperties {
    return {
      display:'flex', alignItems:'center', gap:'0.3rem',
      background: color+'14', border:'1px solid '+color+'33',
      borderRadius:'0.45rem', color, textDecoration:'none',
      padding:'0.28rem 0.55rem', fontSize:'0.67rem', fontWeight:700, flexShrink:0,
      whiteSpace:'nowrap',
    }
  }

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
          <button
            onClick={() => router.push('/etsy/knowledge')}
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', background:C.card, border:'1px solid '+C.border, borderRadius:'0.5rem', color:C.blue, cursor:'pointer', padding:'0.35rem 0.75rem', fontSize:'0.75rem', fontWeight:600, fontFamily:'inherit' }}
          >
            <BookOpen size={13} /> Knowledge Base
          </button>
          <ShoppingBag size={18} color={C.orange} />
          <span style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.orange }}>Etsy</span>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto' }}>
          <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, letterSpacing:'-0.02em' }}>TopNotchThreadz</h1>
          <p style={{ fontSize:'0.875rem', color:C.sec, margin:'0.25rem 0 1rem' }}>SOPs, checklists, notes, and data for the Etsy POD shop</p>
        </div>
        <div style={{ maxWidth:'960px', margin:'0 auto', display:'flex', gap:'0', overflowX:'auto' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'0.7rem 1rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
              fontSize:'0.8rem', fontWeight: activeTab===tab.key ? 700 : 500,
              color: activeTab===tab.key ? tabColor[tab.key] : C.muted,
              borderBottom: activeTab===tab.key ? '2px solid '+tabColor[tab.key] : '2px solid transparent',
              marginBottom:'-1px', transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0,
              display:'flex', alignItems:'center', gap:'0.25rem',
            }}>
              {tab.label}
              {tab.key === 'priority' && unassignedCount > 0 && (
                <span style={{ background:C.red, color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:'9999px', padding:'0.1rem 0.35rem', lineHeight:1 }}>
                  {unassignedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'2rem', opacity: mounted ? 1 : 0, transition:'opacity 0.3s ease' }}>

        {/* Framework */}
        {activeTab === 'framework' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'1rem', padding:'1.25rem', marginBottom:'1rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.75rem' }}>
                <span dangerouslySetInnerHTML={{ __html:'&#128204;' }} />
                <h2 style={{ fontSize:'0.75rem', fontWeight:800, color:C.blue, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Phase 1 Rules</h2>
              </div>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.3rem' }}>
                {PHASE_RULES.map((rule, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
                    <span style={{ color:C.blue, fontSize:'0.65rem', marginTop:'0.15rem', flexShrink:0 }}>&#8227;</span>
                    <p style={{ fontSize:'0.8rem', color:C.sec, margin:0, lineHeight:1.5 }}>{rule}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1rem' }}>
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'1rem' }}>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:C.amber, margin:'0 0 0.6rem', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Time Block</p>
                {TIME_BLOCK_RULES.map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.35rem' }}>
                    <span style={{ color:C.amber, fontSize:'0.7rem', marginTop:'0.1rem', flexShrink:0 }}>&#8594;</span>
                    <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item}</p>
                  </div>
                ))}
              </div>
              <div style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'1rem' }}>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:C.green, margin:'0 0 0.6rem', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Strategy</p>
                {STRATEGY_RULES.map((item, i) => (
                  <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.35rem' }}>
                    <span style={{ color:C.green, fontSize:'0.7rem', marginTop:'0.1rem', flexShrink:0 }}>&#8594;</span>
                    <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'0 0 0.75rem' }}>Workflow Phases</p>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.5rem' }}>
              {WORKFLOW_PHASES.map(phase => (
                <div key={phase.num} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.875rem', padding:'0.875rem 1rem', display:'flex', gap:'0.875rem', alignItems:'flex-start' }}>
                  <div style={{ width:'2.1rem', height:'2.1rem', borderRadius:'50%', background:phase.color+'18', border:'1.5px solid '+phase.color+'44', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:'0.6rem', fontWeight:800, color:phase.color }}>{phase.num}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:'0 0 0.35rem' }} dangerouslySetInnerHTML={{ __html: phase.title }} />
                    <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' as const }}>
                      {phase.tasks.map((task, ti) => (
                        <span key={ti} style={{ fontSize:'0.65rem', color:C.muted, background:phase.color+'0e', border:'1px solid '+phase.color+'22', borderRadius:'0.3rem', padding:'0.1rem 0.4rem' }}>{task}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'1rem', background:'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.18)', borderRadius:'0.875rem', padding:'1rem' }}>
              <p style={{ fontSize:'0.72rem', fontWeight:800, color:'#22d3ee', margin:'0 0 0.6rem', textTransform:'uppercase' as const, letterSpacing:'0.06em' }}>Alek 30-Day Launch Plan</p>
              {THIRTY_DAY_PLAN.map((item, i) => (
                <div key={i} style={{ display:'flex', gap:'0.4rem', marginBottom:'0.35rem' }}>
                  <span style={{ color:'#22d3ee', fontSize:'0.7rem', marginTop:'0.1rem', flexShrink:0 }}>&#8594;</span>
                  <p style={{ fontSize:'0.72rem', color:C.muted, margin:0, lineHeight:1.5 }}>{item}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'0.75rem' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'0 0 0.6rem' }}>Types of Design</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                {DESIGN_TYPES.map(dt => (
                  <div key={dt.type} style={{ background:C.card, border:'1px solid '+dt.color+'33', borderRadius:'0.875rem', padding:'1rem' }}>
                    <p style={{ fontSize:'0.75rem', fontWeight:800, color:dt.color, margin:'0 0 0.4rem' }}>{dt.type}</p>
                    <p style={{ fontSize:'0.71rem', color:C.muted, margin:0, lineHeight:1.5 }}>{dt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop:'0.75rem' }}>
              <p style={{ fontSize:'0.7rem', fontWeight:700, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'0 0 0.6rem' }}>Font Reference</p>
              <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                {FONTS.map((fg, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.65rem 1rem', display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.73rem', fontWeight:700, color:C.text, margin:'0 0 0.18rem' }}>{fg.category}</p>
                      <p style={{ fontSize:'0.7rem', color:C.orange, margin:'0 0 0.18rem', fontStyle:'italic' }}>{fg.fonts.join(', ')}</p>
                      <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>{fg.useCase}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Checklists */}
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
                    <button onClick={() => toggleSection(section.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem 1.125rem', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                      <span style={{ fontSize:'1.1rem' }} dangerouslySetInnerHTML={{ __html: section.emoji }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'0.85rem', fontWeight:700, color: secPct===100 ? C.green : C.text, margin:0 }}>{section.title}</p>
                        <p style={{ fontSize:'0.65rem', color:C.muted, margin:'0.15rem 0 0' }}>{secDone}/{section.items.length} complete</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                        <div style={{ width:'48px', height:'3px', background:C.border, borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:secPct+'%', background: secPct===100 ? C.green : C.orange, borderRadius:'2px', transition:'width 0.3s' }} />
                        </div>
                        <ChevronDown size={15} color={C.muted} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s', flexShrink:0 }} />
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ padding:'0.25rem 1rem 1rem', borderTop:'1px solid '+C.border }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                          {section.items.map(item => (
                            <CheckItem key={item.id} id={item.id} label={item.label} note={item.note} checked={!!checked[item.id]} onToggle={toggleCheck} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SOPs */}
        {activeTab === 'sops' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:'0.875rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <span style={{ fontSize:'1rem' }}>&#128722;</span>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.5 }}>TopNotchThreadz operating procedures. Open the relevant accordion when you need it.</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {SOPS.map(sop => <SOPCard key={sop.id} sop={sop} />)}
            </div>
          </div>
        )}

        {/* Prompts */}
        {activeTab === 'prompts' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <div style={{ marginBottom:'1.5rem', padding:'0.875rem 1rem', background:'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.15)', borderRadius:'0.875rem' }}>
              <p style={{ fontSize:'0.78rem', color:C.sec, margin:0, lineHeight:1.6 }}>
                Copy-paste ChatGPT prompts. Click any prompt box to copy it, then paste into ChatGPT. Replace text in [BRACKETS] with your specifics.
              </p>
            </div>
            {CHATGPT_PROMPTS.map((cat, ci) => (
              <div key={ci} style={{ marginBottom:'1.75rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <span dangerouslySetInnerHTML={{ __html: cat.emoji }} />
                  <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#22d3ee', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>{cat.category}</h2>
                </div>
                <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.5rem' }}>
                  {cat.items.map((item, ii) => (
                    <div key={ii} style={{ background:C.card, border:'1px solid '+(copiedPrompt===item.prompt ? 'rgba(34,211,238,0.35)' : C.border), borderRadius:'0.875rem', overflow:'hidden', transition:'border-color 0.2s' }}>
                      <div style={{ padding:'0.875rem 1rem' }}>
                        <p style={{ fontSize:'0.82rem', fontWeight:700, color:C.text, margin:'0 0 0.5rem' }}>{item.title}</p>
                        <button
                          onClick={() => copyPrompt(item.prompt)}
                          style={{ width:'100%', textAlign:'left', background: copiedPrompt===item.prompt ? 'rgba(34,211,238,0.1)' : 'rgba(34,211,238,0.05)', border:'1px solid rgba(34,211,238,0.18)', borderRadius:'0.5rem', padding:'0.6rem 0.75rem', cursor:'pointer', fontFamily:'monospace', fontSize:'0.74rem', color: copiedPrompt===item.prompt ? '#22d3ee' : C.sec, lineHeight:1.65, transition:'all 0.15s', display:'block' }}
                        >
                          {copiedPrompt===item.prompt ? 'Copied to clipboard!' : item.prompt}
                        </button>
                        {item.note && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.4rem 0 0', lineHeight:1.5 }}>{item.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search notes and study materials..." />
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'-0.25rem 0 1rem' }}>
              {ETSY_NOTES.filter(n => !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.notes.toLowerCase().includes(search.toLowerCase())).length} of {ETSY_NOTES.length} notes
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {ETSY_NOTES
                .filter(n => !search || n.name.toLowerCase().includes(search.toLowerCase()) || n.notes.toLowerCase().includes(search.toLowerCase()))
                .map((note, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                    <Badge label={note.priority} color={priorityColor(note.priority)} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{note.name}</p>
                      {note.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.15rem 0 0' }}>{note.notes}</p>}
                    </div>
                    <a href={note.file_url || note.notion_url} target="_blank" rel="noreferrer" style={lnk(C.purple)}>
                      <ExternalLink size={11} />
                      {note.file_url ? 'Open' : 'Notion'}
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Pipeline */}
        {activeTab === 'pipeline' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search tools and software..." />
            <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', flexWrap:'wrap' }}>
              {['All','Active','Not Active',''].map(f => {
                const label = f === '' ? 'Misc' : f
                const isAct = pipeFilter === f
                const col = f === 'Active' ? C.green : f === 'Not Active' ? C.red : f === '' ? C.muted : C.orange
                return (
                  <button key={label} onClick={() => setPipeFilter(f)} style={{
                    padding:'0.22rem 0.6rem', borderRadius:'999px',
                    border:'1px solid '+(isAct ? col : C.border),
                    background: isAct ? col+'18' : 'transparent',
                    color: isAct ? col : C.muted,
                    cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
                  }}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {SOFTWARE_PIPELINE
                .filter(tool => !search || tool.name.toLowerCase().includes(search.toLowerCase()) || tool.notes.toLowerCase().includes(search.toLowerCase()))
                .filter(tool => pipeFilter === 'All' || tool.status === pipeFilter)
                .map((tool, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', flexShrink:0, minWidth:'4.5rem' }}>
                      <Badge label={tool.status || 'Misc'} color={tool.status === 'Active' ? C.green : tool.status === 'Not Active' ? C.red : C.muted} />
                      {tool.priority === 'High' && <Badge label="High priority" color={C.red} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{tool.name}</p>
                      {tool.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.15rem 0 0', lineHeight:1.5 }}>{tool.notes}</p>}
                    </div>
                    {(tool.file_url || tool.notion_url) && (
                      <a href={tool.file_url || tool.notion_url} target="_blank" rel="noreferrer" style={lnk(C.green)}>
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Todos */}
        {activeTab === 'todos' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search todos..." />
            <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', flexWrap:'wrap' }}>
              {['All','Not Started','Started','Ongoing','Completed'].map(f => {
                const isAct = todoFilter === f
                const col = f === 'All' ? C.orange : stageColor(f)
                return (
                  <button key={f} onClick={() => setTodoFilter(f)} style={{
                    padding:'0.22rem 0.6rem', borderRadius:'999px',
                    border:'1px solid '+(isAct ? col : C.border),
                    background: isAct ? col+'18' : 'transparent',
                    color: isAct ? col : C.muted,
                    cursor:'pointer', fontFamily:'inherit', fontSize:'0.68rem', fontWeight:600,
                  }}>
                    {f}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'-0.25rem 0 1rem' }}>
              {ETSY_TODOS.filter(td => (!search || td.name.toLowerCase().includes(search.toLowerCase())) && (todoFilter === 'All' || td.stage === todoFilter)).length} todos
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {ETSY_TODOS
                .filter(td => !search || td.name.toLowerCase().includes(search.toLowerCase()) || td.notes.toLowerCase().includes(search.toLowerCase()))
                .filter(td => todoFilter === 'All' || td.stage === todoFilter)
                .map((td, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+(td.stage === 'Completed' ? 'rgba(0,255,136,0.12)' : C.border), borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'flex-start', gap:'0.625rem' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', flexShrink:0, paddingTop:'1px' }}>
                      <Badge label={td.stage} color={stageColor(td.stage)} />
                      <Badge label={td.priority} color={priorityColor(td.priority)} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color: td.stage === 'Completed' ? C.muted : C.text, margin:0, textDecoration: td.stage === 'Completed' ? 'line-through' : 'none', opacity: td.stage === 'Completed' ? 0.7 : 1 }}>{td.name}</p>
                      {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.2rem 0 0', lineHeight:1.5 }}>{td.notes}</p>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.35rem', flexShrink:0 }}>
                      {td.target_date && <span style={{ fontSize:'0.62rem', color:C.muted, whiteSpace:'nowrap' }}>{td.target_date}</span>}
                      <a href={td.notion_url} target="_blank" rel="noreferrer" style={lnk(C.red)}>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Links */}
        {activeTab === 'links' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'0 0 1rem' }}>{ETSY_LINKS.length} saved links from Notion</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {ETSY_LINKS.map((link, i) => (
                <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'center', gap:'0.625rem' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:'0 0 0.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.name}</p>
                    <p style={{ fontSize:'0.65rem', color:C.muted, margin:0 }}>Saved {link.created}</p>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" style={lnk(C.teal)}>
                    <ExternalLink size={11} /> Open
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch */}
        {activeTab === 'batch' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search ideas, niches, seed keywords..." />
            <p style={{ fontSize:'0.7rem', color:C.muted, margin:'-0.25rem 0 1rem' }}>
              {BATCH_WORKFLOW.filter(item => !search || item.idea_theme.toLowerCase().includes(search.toLowerCase()) || item.seed_keyword.toLowerCase().includes(search.toLowerCase()) || item.niche.toLowerCase().includes(search.toLowerCase())).length} of {BATCH_WORKFLOW.length} batch items
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {BATCH_WORKFLOW
                .filter(item => !search || item.idea_theme.toLowerCase().includes(search.toLowerCase()) || item.seed_keyword.toLowerCase().includes(search.toLowerCase()) || item.niche.toLowerCase().includes(search.toLowerCase()))
                .map((item, i) => (
                  <div key={i} style={{ background:C.card, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.7rem 0.875rem', display:'flex', alignItems:'flex-start', gap:'0.625rem' }}>
                    <span style={{ fontSize:'0.6rem', color:C.muted, fontWeight:700, minWidth:'1.75rem', flexShrink:0, paddingTop:'2px' }}>#{item.id}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:'0 0 0.3rem' }}>{item.idea_theme}</p>
                      <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', alignItems:'center' }}>
                        {item.niche && <Badge label={item.niche} color={C.muted} />}
                        <Badge label={item.batch_priority} color={priorityColor(item.batch_priority)} />
                        {item.batch_stage && <Badge label={item.batch_stage} color={C.pink} />}
                        {item.method && <Badge label={item.method} color={C.teal} />}
                      </div>
                      {item.seed_keyword && (
                        <p style={{ fontSize:'0.67rem', color:C.sec, margin:'0.3rem 0 0' }}>Keyword: {item.seed_keyword}</p>
                      )}
                    </div>
                    <a href={item.notion_url} target="_blank" rel="noreferrer" style={lnk(C.pink)}>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Priority */}
        {activeTab === 'priority' && (
          <div style={{ animation:'fadeInUp 0.3s ease both' }}>
            {/* Unassigned zone */}
            <div style={{ marginBottom:'2rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:C.red, margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Unassigned</h2>
                {unassignedCount > 0 && (
                  <span style={{ background:C.red, color:'#fff', fontSize:'0.6rem', fontWeight:800, borderRadius:'9999px', padding:'0.15rem 0.45rem', lineHeight:1 }}>{unassignedCount}</span>
                )}
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>Drag into the priority list below to rank</p>
              </div>
              {unassigned.length === 0 ? (
                <div style={{ padding:'1.5rem', textAlign:'center', border:'1px dashed rgba(0,255,136,0.3)', borderRadius:'0.875rem', background:'rgba(0,255,136,0.03)' }}>
                  <p style={{ fontSize:'0.78rem', color:C.green, margin:0, fontWeight:700 }}>All todos assigned</p>
                </div>
              ) : (
                <div
                  style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}
                  onDragOver={e => { e.preventDefault(); setDragOver('unassigned-zone') }}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragFrom === 'priority' && dragId) {
                      savePriority(validOrder.filter(id => id !== dragId))
                    }
                    setDragId(null); setDragOver(null); setDragFrom(null)
                  }}
                >
                  {unassigned.map(td => {
                    const tid = getTodoId(td)
                    return (
                      <div
                        key={tid}
                        draggable
                        onDragStart={() => { setDragId(tid); setDragFrom('unassigned') }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); setDragFrom(null) }}
                        style={{
                          background:C.card,
                          border:'1px solid '+(dragId===tid ? C.red+'55' : C.border),
                          borderRadius:'0.75rem', padding:'0.65rem 0.875rem',
                          display:'flex', alignItems:'center', gap:'0.625rem',
                          cursor:'grab', opacity: dragId===tid ? 0.4 : 1,
                          transition:'all 0.1s',
                        }}
                      >
                        <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{td.name}</p>
                          {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.4 }}>{td.notes}</p>}
                        </div>
                        <div style={{ display:'flex', gap:'0.3rem', flexShrink:0, alignItems:'center' }}>
                          <Badge label={td.stage} color={stageColor(td.stage)} />
                          <Badge label={td.priority} color={priorityColor(td.priority)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Priority list */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.875rem' }}>
                <h2 style={{ fontSize:'0.72rem', fontWeight:800, color:'#ff6b35', margin:0, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>Priority Order</h2>
                <p style={{ fontSize:'0.68rem', color:C.muted, margin:0 }}>{validOrder.length} items ranked</p>
              </div>
              {validOrder.length === 0 ? (
                <div
                  style={{
                    padding:'2.5rem 1.5rem', textAlign:'center',
                    border:'2px dashed '+(dragOver==='priority-empty' ? '#ff6b35' : C.border),
                    borderRadius:'0.875rem',
                    background: dragOver==='priority-empty' ? 'rgba(255,107,53,0.05)' : 'transparent',
                    transition:'all 0.15s',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver('priority-empty') }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragFrom === 'unassigned' && dragId) savePriority([dragId])
                    setDragId(null); setDragOver(null); setDragFrom(null)
                  }}
                >
                  <p style={{ fontSize:'0.78rem', color:C.muted, margin:0 }}>Drag items here to set your priority order</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' as const, gap:'0.35rem' }}>
                  {validOrder.map((id, idx) => {
                    const td = ACTIVE_TODOS.find(t => getTodoId(t) === id)
                    if (!td) return null
                    const isInsertTarget = dragOver === id && dragFrom !== null
                    return (
                      <div key={id}>
                        {isInsertTarget && (
                          <div style={{ height:'2px', background:'#ff6b35', borderRadius:'1px', margin:'0 0 0.25rem', opacity:0.8 }} />
                        )}
                        <div
                          onDragOver={e => { e.preventDefault(); setDragOver(id) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOver === id) setDragOver(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            if (dragFrom === 'unassigned' && dragId) {
                              const newOrder = [...validOrder]
                              newOrder.splice(idx, 0, dragId)
                              savePriority(newOrder)
                            } else if (dragFrom === 'priority' && dragId && dragId !== id) {
                              const without = validOrder.filter(i => i !== dragId)
                              const insertAt = without.indexOf(id)
                              without.splice(insertAt, 0, dragId)
                              savePriority(without)
                            }
                            setDragId(null); setDragOver(null); setDragFrom(null)
                          }}
                          draggable
                          onDragStart={() => { setDragId(id); setDragFrom('priority') }}
                          onDragEnd={() => { setDragId(null); setDragOver(null); setDragFrom(null) }}
                          style={{
                            background:C.card,
                            border:'1px solid '+(dragId===id ? '#ff6b3555' : C.border),
                            borderRadius:'0.75rem', padding:'0.65rem 0.875rem',
                            display:'flex', alignItems:'center', gap:'0.625rem',
                            cursor:'grab', opacity: dragId===id ? 0.4 : 1,
                            transition:'all 0.1s',
                          }}
                        >
                          <span style={{ fontSize:'0.65rem', fontWeight:900, color:'#ff6b35', minWidth:'1.4rem', textAlign:'center' as const, flexShrink:0 }}>#{idx+1}</span>
                          <span style={{ fontSize:'0.8rem', color:C.muted, userSelect:'none' as const }}>&#9776;</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'0.8rem', fontWeight:600, color:C.text, margin:0 }}>{td.name}</p>
                            {td.notes && <p style={{ fontSize:'0.67rem', color:C.muted, margin:'0.1rem 0 0', lineHeight:1.4 }}>{td.notes}</p>}
                          </div>
                          <div style={{ display:'flex', gap:'0.3rem', flexShrink:0, alignItems:'center' }}>
                            <Badge label={td.stage} color={stageColor(td.stage)} />
                            <Badge label={td.priority} color={priorityColor(td.priority)} />
                          </div>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePriority([id, ...validOrder.filter(i => i !== id)]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to top">&#8593; Top</button>
                          <button type="button" draggable={false} onClick={e => { e.preventDefault(); e.stopPropagation(); savePriority([...validOrder.filter(i => i !== id), id]) }} style={{ background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#ff6b35', cursor:'pointer', padding:'0.3rem 0.6rem', fontSize:'0.7rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.5rem', fontWeight:700 }} title="Send to bottom">&#8595; Bot</button>
                          <button
                            onClick={e => { e.stopPropagation(); savePriority(validOrder.filter(i => i !== id)) }}
                            style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:'0.2rem 0.25rem', fontSize:'0.75rem', lineHeight:1, fontFamily:'inherit', flexShrink:0, borderRadius:'0.25rem' }}
                            title="Remove from priority list"
                          >x</button>
                        </div>
                      </div>
                    )
                  })}
                  {/* Drop zone at bottom */}
                  <div
                    style={{
                      height:'2.75rem',
                      border:'2px dashed '+(dragOver==='priority-bottom' ? '#ff6b35' : C.border),
                      borderRadius:'0.75rem',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                      background: dragOver==='priority-bottom' ? 'rgba(255,107,53,0.05)' : 'transparent',
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver('priority-bottom') }}
                    onDragLeave={() => { if (dragOver === 'priority-bottom') setDragOver(null) }}
                    onDrop={e => {
                      e.preventDefault()
                      if (dragFrom === 'unassigned' && dragId) {
                        savePriority([...validOrder, dragId])
                      } else if (dragFrom === 'priority' && dragId) {
                        savePriority([...validOrder.filter(i => i !== dragId), dragId])
                      }
                      setDragId(null); setDragOver(null); setDragFrom(null)
                    }}
                  >
                    <p style={{ fontSize:'0.67rem', color: dragOver==='priority-bottom' ? '#ff6b35' : C.muted, margin:0, transition:'color 0.15s' }}>Drop here to add at end</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
