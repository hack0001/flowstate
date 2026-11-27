import { useState, useEffect, Suspense } from 'react'
import { ShoppingBag, CheckCircle, Circle, RotateCcw, ChevronDown, ExternalLink, Search, BookOpen } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ETSY_NOTES, SOFTWARE_PIPELINE, ETSY_TODOS, ETSY_LINKS, BATCH_WORKFLOW } from '@/lib/etsy-data'
import { supabase } from '@/lib/supabase'
import { sounds } from '@/lib/sounds'
import { useCelebration } from '@/hooks/useCelebration'
import { C } from '@/lib/theme'

export type Tab = 'framework' | 'checklists' | 'sops' | 'notes' | 'pipeline' | 'todos' | 'links' | 'batch' | 'prompts' | 'priority' | 'niche'

export const tabColor: Record<Tab, string> = {
  framework: C.blue, checklists: C.orange, sops: C.amber, notes: C.purple,
  pipeline: C.green, todos: C.red, links: C.teal, batch: C.pink, prompts: '#22d3ee', priority: '#ff6b35',
  niche: C.teal,
}

// ---- Niche Calendar (moved here from its own /niche-calendar page) ----
export type NicheEntry = {
  month: string
  num: number
  start: string[]
  stop: string[]
  evergreen: string[]
  deadlines: { label: string; note: string }[]
}

export const NICHE_CALENDAR: NicheEntry[] = [
  {
    month: 'January', num: 1,
    start: ['Spring Break', 'St. Patrick\'s Day', 'International Women\'s Day', 'Easter'],
    stop:  ['Mardi Gras', 'Valentine\'s Day', '100th Day of School', 'Black History Month'],
    evergreen: ['Bachelorettes', 'Mother/Daughter Trips', 'Spring sports', 'Summer cruises'],
    deadlines: [
      { label: 'Valentine\'s Day', note: 'List by Jan 2' },
      { label: 'Mardi Gras', note: 'List by Jan 5' },
      { label: '100th Day of School', note: 'List by Jan 8' },
      { label: 'Black History Month', note: 'List by Jan 11' },
    ],
  },
  {
    month: 'February', num: 2,
    start: ['Autism Awareness', 'Earth Day', 'Cinco de Mayo', 'Teacher Appreciation', 'Nurse Appreciation'],
    stop:  ['Spring Break', 'International Women\'s Day', 'St. Patrick\'s Day', 'Easter'],
    evergreen: ['Camping/outdoors', 'State/country pride', 'Family vacation/travel', 'Medical professions'],
    deadlines: [
      { label: 'Int\'l Women\'s Day', note: 'List by Feb 1' },
      { label: 'St. Patrick\'s Day', note: 'List by Feb 9' },
      { label: 'Easter', note: 'List by Feb 18' },
    ],
  },
  {
    month: 'March', num: 3,
    start: ['Last Day of School', 'Mother\'s Day', 'Graduation (HS/College)', 'Memorial Day'],
    stop:  ['Autism Awareness', 'Cinco de Mayo', 'Earth Day', 'Teacher Appreciation', 'Nurse Appreciation'],
    evergreen: ['Homesteading', 'Hobby farming', 'Teacher professions (grade level + support staff)'],
    deadlines: [
      { label: 'Autism Awareness', note: 'List by Mar 1' },
      { label: 'Earth Day', note: 'List by Mar 11' },
      { label: 'Nurse Appreciation', note: 'List by Mar 19' },
      { label: 'Teacher Appreciation', note: 'List by Mar 25' },
      { label: 'Cinco de Mayo', note: 'List by Mar 28' },
    ],
  },
  {
    month: 'April', num: 4,
    start: ['4th of July', 'Pride Month', 'Juneteenth', 'Summer camp/vacations'],
    stop:  ['Memorial Day', 'Last Day of School', 'Mother\'s Day', 'Graduation (HS/College)', 'Father\'s Day'],
    evergreen: ['Baby Showers', 'Pregnancy Announcement', 'Baby/Child Milestones', 'Social justice/advocacy'],
    deadlines: [
      { label: 'Mother\'s Day', note: 'List by Apr 2' },
      { label: 'Last Day of School / Graduation', note: 'List by Apr 5' },
      { label: 'Memorial Day', note: 'List by Apr 15' },
      { label: 'Father\'s Day', note: 'List by Apr 30' },
    ],
  },
  {
    month: 'May', num: 5,
    start: ['Christmas in July', 'Political/Vote'],
    stop:  ['4th of July', 'Pride Month', 'Juneteenth', 'Summer camp/vacations'],
    evergreen: ['Bachelors/groomsmen', 'Family reunions', 'Summer sports', 'Wedding anniversaries'],
    deadlines: [
      { label: 'Pride Month', note: 'List by May 1' },
      { label: 'Juneteenth', note: 'List by May 6' },
      { label: 'Summer Vacation', note: 'List by May 17' },
      { label: '4th of July', note: 'List by May 29' },
    ],
  },
  {
    month: 'June', num: 6,
    start: ['Back to School', 'Class of 20XX', 'Grandparents Day'],
    stop:  ['Christmas in July', 'Political/Vote'],
    evergreen: ['Bachelors/groomsmen', 'Fall sports', 'Fantasy football'],
    deadlines: [
      { label: 'Christmas in July', note: 'List by Jun 3' },
      { label: 'Political/Vote', note: 'List by Jun 28' },
    ],
  },
  {
    month: 'July', num: 7,
    start: ['Halloween', 'Thanksgiving', 'Christmas', 'World Mental Health Day', 'Banned Book Week'],
    stop:  ['Back to School', 'Class of 20XX', 'Grandparents Day'],
    evergreen: ['Mental health professions', 'Bookish/book lovers'],
    deadlines: [
      { label: 'Back to School', note: 'List by Jul 1' },
      { label: 'Class of 20XX', note: 'List by Jul 25' },
      { label: 'Grandparents Day', note: 'List by Jul 28' },
    ],
  },
  {
    month: 'August', num: 8,
    start: ['Fall designs', 'Midwifery Week', 'Hanukkah', 'Kwanzaa'],
    stop:  ['World Mental Health Day', 'Banned Book Week'],
    evergreen: ['Zodiac/astrology', 'Cancer awareness', 'Sports parents/coaches'],
    deadlines: [
      { label: 'Banned Book Week', note: 'List by Aug 9' },
      { label: 'World Mental Health Day', note: 'List by Aug 14' },
    ],
  },
  {
    month: 'September', num: 9,
    start: ['Winter designs', 'Winter sports', 'Veteran\'s Day'],
    stop:  ['Halloween', 'Thanksgiving', 'Fall designs', 'Midwifery Week'],
    evergreen: ['Faith-based/Christian', 'Pet ownership', 'New/first home owners', 'Sister/cousin trips'],
    deadlines: [
      { label: 'Midwifery Week', note: 'List by Sep 1' },
      { label: 'Halloween', note: 'List by Sep 5' },
      { label: 'Fall Designs', note: 'List by Sep 13' },
      { label: 'Thanksgiving', note: 'List by Sep 23' },
    ],
  },
  {
    month: 'October', num: 10,
    start: ['Christmas + Evergreen designs (continue)'],
    stop:  ['Winter sports', 'Veteran\'s Day'],
    evergreen: ['Winter sports', 'Allied health professions', 'Winter cruises'],
    deadlines: [
      { label: 'Veteran\'s Day', note: 'List by Oct 1' },
      { label: 'Winter Sports', note: 'List by Oct 18' },
    ],
  },
  {
    month: 'November', num: 11,
    start: ['New Years (next year)', 'Martin Luther King Jr Day'],
    stop:  ['Kwanzaa', 'Hanukkah', 'Christmas'],
    evergreen: ['Birthday milestones (30s, 40s, etc)', 'Indoor hobbies (knitting, gaming)'],
    deadlines: [
      { label: 'Hanukkah', note: 'List by Nov 4' },
      { label: 'Kwanzaa', note: 'List by Nov 5' },
      { label: 'Christmas', note: 'List by Nov 22' },
    ],
  },
  {
    month: 'December', num: 12,
    start: ['Valentine\'s Day', 'Mardi Gras', '100th Day of School', 'Black History Month'],
    stop:  ['New Years', 'Martin Luther King Jr Day'],
    evergreen: ['Engagement/bridal', 'Wedding/honeymoon', 'Fitness/wellness'],
    deadlines: [
      { label: 'New Years', note: 'List by Dec 1' },
      { label: 'Martin Luther King Jr Day', note: 'List by Dec 9' },
    ],
  },
]

export const NICHE_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function currentMonthNum() {
  return new Date().getMonth() + 1
}

export function priorityColor(p: string): string {
  return p === 'High' ? C.red : p === 'Medium' ? C.amber : '#555577'
}

export function stageColor(s: string): string {
  return s === 'Completed' ? C.green : s === 'Ongoing' ? C.teal : s === 'Started' ? C.amber : C.muted
}

// ---- Checklists ----
export type CItem = { id:string; label:string; note:string }

export type Section = { id:string; title:string; emoji:string; items:CItem[] }

export const SECTIONS: Section[] = [
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

export const LS_KEY = 'flowstate_etsy_checklists'

// ---- Production SOPs ----
export type SOP = { id:string; icon:string; title:string; tagline:string; steps:string[] }

export const SOPS: SOP[] = [
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
export type PromptItem = { title: string; prompt: string; note: string }

export type PromptCategory = { category: string; emoji: string; items: PromptItem[] }

export const CHATGPT_PROMPTS: PromptCategory[] = [
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
export const FONTS: { category: string; fonts: string[]; useCase: string }[] = [
  { category: 'General / Versatile', fonts: ['Remington Weather', 'Paper Cutout', 'Vintage College Dept', 'Vancouver'], useCase: 'Everyday niches, text-only designs, sarcastic sayings' },
  { category: 'Feminine / Women\'s', fonts: ['Clementina', 'Limon Mint'], useCase: 'Women\'s shirts, mothers, feminine niches' },
  { category: 'Rustic / Stressed', fonts: ['Edmund', 'Rustic Pantry'], useCase: 'Rustic look, distressed aesthetic, country themes' },
  { category: 'Dictionary / Fake Definition', fonts: ['Bookmania'], useCase: 'Fake definition shirts: "Accountant (n.) someone who..."' },
  { category: 'Western / Country', fonts: ['Monday', 'Road Rage', 'Western Carlo'], useCase: 'Country music, rodeo, Western lifestyle niches' },
  { category: 'Halloween', fonts: ['Sansation', 'Vampire Zone', 'Spooky Man'], useCase: 'Halloween season designs' },
  { category: 'Kids / Fun', fonts: ['Dinosauce', 'Islands Sans', 'Morris Jr'], useCase: 'Children\'s clothing, family matching sets' },
]

// ---- Framework ----
export const PHASE_RULES = [
  'Buyer profile: Christian women - apparel only',
  'Products: t-shirts and sweatshirts only in Phase 1',
  'Designs: simple typography only - no florals, illustrations, embroidery, or mugs',
  'Goal: reach 1,000 active listings as quickly as possible using a template system',
  'Listing speed target: 15-20 minutes per listing at scale once templates are built',
]

export const TIME_BLOCK_RULES = [
  'Do not task switch during sessions - batch by task type',
  'Research day, design day, upload day - never mix all three in one session',
  'Set up a recurring calendar with fixed task blocks for each phase',
  'Take action every single day - consistency compounds more than bursts',
]

export const STRATEGY_RULES = [
  '70% evergreen niches - content that sells year-round (nurse shirts, teacher gifts)',
  '30% trends and holidays - seasonal spikes planned 6-8 weeks in advance',
  'Target 25 new listings per week as the primary growth velocity goal',
  '10k/month revenue requires approx. 333,000 monthly views at 3% CVR',
  'Double-down strategy: if a design sells, make 5-10 variations immediately',
  'Cross-niche method: take what works in one niche and apply it to another niche',
]

export const WORKFLOW_PHASES: { num:string; title:string; color:string; tasks:string[] }[] = [
  { num:'01', title:'Research &amp; Validate', color:'#8b5cf6', tasks:['Everbee/Erank niche research','Validate search volume + competition','Confirm buyer demand before designing'] },
  { num:'02', title:'Ideas &amp; Keywords', color:'#ffb800', tasks:['Alek / Cassiy / Simply POD methods','ChatGPT phrase generation','Seasonal trend planning'] },
  { num:'03', title:'Design &amp; Export', color:'#f97316', tasks:['Canva / Kittl / Midjourney','4500x5100px transparent PNG','8-15 variations per theme'] },
  { num:'04', title:'Upload &amp; Publish', color:'#00ff88', tasks:['Prelist for titles + tags','Printify for product setup','Vela for mockup assignment'] },
  { num:'05', title:'Market &amp; Optimise', color:'#14b8a6', tasks:['Guarantee slides in photos','Run 25% off for 5 days','Review requests on delivery'] },
]

export const THIRTY_DAY_PLAN: string[] = [
  'Day 1: make 1 template. Post at least 7 products.',
  'Day 7: 7 templates built. Posting 7+ products every day.',
  'Day 30: 30 templates. Posting a minimum of 30 products per day.',
  'Ongoing: revise 1 existing template per day to improve it.',
  'This is the minimum viable system - templates compound. 30/day posting changes the outcome.',
]

export const DESIGN_TYPES: { type:string; desc:string; color:string }[] = [
  { type:'Templatised', color:'#14b8a6', desc:'One interchangeable word used across many niches. E.g. "I stopped [ACTIVITY] to be here" -> cooking, baking, reading, gaming, hiking. Design once, multiply across 20+ niches. Fastest path to volume.' },
  { type:'One-Off', color:'#8b5cf6', desc:'Cannot be easily templatised but can have many graphic variations. If it uses an image, use Midjourney to generate 8-15 similar copyright-free variants. Volume comes from iteration, not templates.' },
]

export const ETSY_PRIORITY_KEY = 'etsy_todos_priority'
