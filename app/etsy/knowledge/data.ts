// Etsy Knowledge Base — verbatim content from Notion
// Editable via localStorage: keys use prefix flowstate_etsy_kb_

export type KBPage = { id: string; title: string; content: string }
export type KBSection = { title: string; color: string; pages: KBPage[] }

// ============================================================
// SECTION 1: ETSY WORKFLOW FRAMEWORK
// ============================================================
export const FRAMEWORK_PAGES: KBPage[] = [
  {
    id: 'fw-overview',
    title: 'Overview / Phase 1 Rules',
    content: `PHASE 1 RULES
Time Block Everything
- Block time for research, design, uploading, analysis
- Consistency beats perfection
- Treat like a real job -- show up every day

LISTINGS WORKFLOW OVERVIEW
- Research -> Design -> Upload -> Market -> Analyse -> Repeat

SHOP FUNDAMENTALS
- Etsy algorithm rewards: recency, relevance, conversion rate, customer satisfaction
- Target 4000 products to reach 6-figure revenue potential
- Printify: use SwiftPOD or Monster Digital as print suppliers
- Target 3-4% conversion rate on listings
- Cassiy gets 8% with great SEO + mockups + pricing
- Top stores focus on quality niches with depth

TIME BLOCK EVERYTHING
- Schedule specific recurring time slots for each workflow phase
- Batch tasks: e.g. design day, upload day, research day
- Never mix phases in one session -- kills productivity

INSPIRATION MATHS
- For $10k/month: 333,333 views x 3% CVR = 10,000 sales x $10 = $100,000
- Group listing: 8333 views x 3% = 249 x 4 products = ~1000 sales x $10 = $10,000/month`,
  },
  {
    id: 'fw-shop-fundamentals',
    title: 'Shop Fundamentals',
    content: `SHOP FUNDAMENTALS

ETSY ALGORITHM
- Rewards: click-through rate, conversion rate, recency of listing, quality of SEO
- New listings get a visibility boost at the start -- must be ready immediately with mockups
- Star Seller status improves ranking
- 4000 products is the milestone for 6-figure potential

PRODUCTS TO SELL (Cassiy recommendation)
- Comfort Colours 1717 (t-shirt)
- Gildan 18000 (sweatshirt)

LISTING GOAL
- Set a target: e.g. 1000 items listed
- Plan: when, what time, what place
- Following this process = you WILL make progress
- Don't QUIT -- keep designing

DOUBLE
(note from Notion: double your output where possible)

COMFORT COLORS TEMPLATE PROCESS
Step 1: Research
- Find 7-8 shops selling CC1717
- Must be a mix of old ultra-successful shops AND new up-and-coming (last 12-18 months)
- Both must be proven with high amount of sales in relative terms
- Put shops in a spreadsheet
- Analyse shops: sales, reviews, listings
- Capture: mocks, info cards, title, descriptions, delivery, sections, colours, sizes, prices, tags, announcements, about, policies
- Take average/most common for all -- compile your own list

Step 2: Buy mockups for all of them
- Put in Canva ready to be amended
- Take a look at top shops annotations and come up with own

Step 3: Add guarantee if new shop
- Look at Guarantee in TopNotchThreadz for example
- Half a mockup

Step 4: Printify template
- Choose colors and prices
- Add loss leader: crimson small

Step 5: Mockups via Simply Listed
- Copy top shops`,
  },
  {
    id: 'fw-top-stores',
    title: 'Top Stores Research',
    content: `TOP STORES RESEARCH

NICHES OF TOP STORES
- Evergreen: Nurse, Mom, Brides, Grandparents, Teachers, Dog owners, Cat owners

3-4% CONVERSION TARGET
- Most shops get 1-3% conversion
- Cassiy gets 8% through: great SEO, great mockups, right price, personalisation
- Andreas gets 5-6% through proven thumbnails
- Target 3-4% as minimum viable

Q4 NICHES (Oct-Dec peak)
- Christmas, Thanksgiving, Halloween
- Seasonal designs should be started 8 weeks before the holiday
- Family matching Christmas sets, funny holiday shirts do very well

NJD Apparel -- no frills shop (look on Alura, 4 years in business)
Cozy Gifts Company -- more recent, 700 listings (200 new), open 8 months, 13,000 sales, 1600 sales/month

KEY PRINCIPLE
- Take 6-8 shops you want to emulate
- Download their backend data via Everbee
- See which are the best sellers and find commonalities
- E.g. text in circle -- top and bottom and graphic in middle
- Take this fundamental and apply it to a niche
- Look for a niche -- see if this design is on page 1/best seller -- if not it ADDS VALUE
- LOOK AT THE TAGS OF TOP LISTINGS AND TITLES -- see if they are high volume keywords`,
  },
  {
    id: 'fw-pricing-shipping',
    title: 'Pricing + Shipping',
    content: `PRICING + SHIPPING

PRICING TACTICS
- Don't go too low -- attracts difficult customers who complain
- Loss Leader (LL): cheap design (e.g. XS Maroon) to get first sales and reviews
- Use sales strategically -- don't always be on sale
- Run occasional quick sales (e.g. 25% off for 5 days) for impulse purchases
- BE (Break Even): price so profit is $2-$4
- If selling 10+: move price to 30-40% profit margin

PRINTIFY PRICING TARGETS
- With Printify Premium: target 57% profit margin
- Without Printify Premium: target 45% profit margin
- Retail price at 57% margin = approx $35 USD
- Note: 57% is not REAL profit when running sales -- factor in discounts
- Select all -> edit profit -> Profit margin 57%

ALEK METHOD -- SHIPPING
- Customer pays shipping if one item and below $35
- If buys two items over $35 -- you pay for shipping
- Entices customer to buy more items

SHIPPING RULES
- USA shipping: do NOT charge over $6 USD (Etsy penalises rankings above this)
- Always refund shipping complaints -- never argue
- Accurate production times are critical for Star Seller status
- Add a few days buffer to processing time

SALE TRIGGERS
- Thank You discount: gives discount after purchase to bring repeat buyers
- Abandoned cart discount: brings back shoppers who didn't complete purchase
- Favorited item discount: sends alerts to those who favorited your items
- Sign up for Etsy sale events: get featured on Etsy sales pages`,
  },
  {
    id: 'fw-research',
    title: 'Research Methods',
    content: `RESEARCH METHODS

PRELIMINARY QUESTIONS BEFORE STARTING
- Is there proven demand for this niche?
- Is the niche not too saturated? (<50,000 listings for specific keywords = good)
- Can this be templatised?
- Is it trademark-free?

SEED KEYWORDS / FINDING IDEAS
Method 1 -- Etsy Search (do daily):
- Search broad terms: shirt, mug, sweatshirt
- Filter: US Delivery, Physical Items, Star Sellers (change URL to best_seller)
- Look for: Best Seller badge, 5+ bought in last 24 hours, 20+ in carts
- Sort by newest: find new listings that ARE selling
- Go into individual pages and check -- this is a goldmine

Method 2 -- Sort by Newest:
- Go to Etsy search -> sort by newest (top right)
- Great way to find new listings that are selling

Method 3 -- Browse Daily:
- Habit: browse Etsy every day -- put in diary
- Look at what is in demand, what good designs look like
- Go into niches you have NO interest in -- bring ideas to your niches

GAP IN THE MARKET APPROACH
- Fundamental: Take what is working in one niche and apply to another
- Cross Method (Wholesale Ted): find best-selling funny t-shirt, take the premise, put in ChatGPT for alternative niches
- Must add VALUE -- not just copy
- Check if the design/concept exists in target niche -- if not, fill the gap

ESTABLISH PHRASES
- Search bestsellers for common words and phrases
- Look for 20+ items in cart from different shops (including small shops)
- 5-7 listings to analyse patterns
- Put blocks of similar SEO keywords next to each other (e.g. Christian shirts)
- Mix and match designs that are popular

RESEARCH TOOLS
- Everbee (most popular): product analytics, filter by shops <24 months old + listings <3 months old
- Alura: great alternative (I use this)
- ERank: keyword research + listing analysis
- ListingView (Alek): checking search volume vs competition
- ChatGPT: "Give me 50 popular hobbies/sports/activities for POD niche ideas"

SIMPLY POD -- QUALIFY DEMAND
1. ERank -> type broad keyword -> look at recommended list
   - Find high volume AND low competition (balance!)
2. Etsy Autocomplete -> note all keyword suggestions
3. Best seller listings -> check magic words:
   - "In 9 carts with 16 views"
   - "5 sold in last 24 hours"
   - "In 59 carts with 140 views"
4. Check Etsy mid-page category widgets
5. Look at tags at bottom of listings -> make note of titles/tags
6. Check reviews are recent and positive

NICHE DOWN TO BOTTOM OF FUNNEL
- High demand + narrow niches = low competition + high purchase intention
- Don't do "funny t-shirts" -- do "funny t-shirts for accountants"
- Nothing general -- specific keywords
- Example: "Professional Gift" (600k results) vs "Gifts for Accountants" (4,000 results)
- Most buyers search 3 times on average

EXTERNAL SOURCES FOR IDEAS
- Urban Outfitters, Anthropologie, Amazon, Pinterest -- check new arrivals
- Card companies (Moonpig.com)
- Etsy itself -- get in the habit of browsing every day
- Pinterest for inspiration`,
  },
  {
    id: 'fw-value-add',
    title: 'Value Add Strategies',
    content: `VALUE ADD STRATEGIES (6 Ways)

1. COMBINING TRENDS
- Take what works in one trend and apply to another
- E.g. "I Closed My Book to Be Here" -> "I Stopped Cooking to Be Here" -> "I Stopped Baking..."
- Find the template phrase and swap the activity
- Coffee and books -> Espresso and books

2. PLACEMENT INNOVATION
- Move design: pocket position instead of chest
- Vertical design on horizontal shirt or vice versa

3. PERSONALISATION
- Custom name/text designs convert much higher
- Use Hello Custom for automating personalisation orders
- Always have personalisation box on with clear instructions
- "Never make it optional" (Mandy)

4. GROUP DESIGN
- Mom and Dad matching shirts (SHOULD BE MAKING LOTS OF GROUP ORDER SHIRTS)
- Family sets
- Bridal party sets

5. NEW SAYINGS / FRESH COPY
- Ask ChatGPT: "Give me 20 sarcastic phrases only someone turning 30 would understand"
- Ask ChatGPT: "Give me 30 funny phrases for a school counselor shirt"
- Must be trademark-free -- check USPTO first
- Template sayings: "I'd Rather Be [X]" -> apply to different hobbies
- "Id rather be reading -- id rather be surfing"
- "Get ChatGPT to come up with sayings"

6. MIXING NICHES (Cross Niche)
- "Tacos are my Valentine" (food + holiday)
- Dog owner + book lover
- Accountant + sarcasm
- If nail this: can do 30 designs in an hour using cross-method templates
- COPY WHOLESALE TED -- FUNDAMENTALS: double entendre and deadpan humour -- do it for something else

ADD COLOUR -- SELLS MORE
- If selling to competitive niche -- double target it
- E.g. valentines day shirts brings up 600,000 results
- Valentines day taco shirt only has 2500 listings
- Change the food, holiday, use similar fonts and graphics`,
  },
  {
    id: 'fw-legal',
    title: 'Legal Check',
    content: `LEGAL CHECK -- USPTO TRADEMARK PROCESS

MUST DO FIRST -- all subsequent work is wasted if trademark infringement
Website: https://tmsearch.uspto.gov/search/search-information

STEP-BY-STEP USPTO TRADEMARK CHECK
1. Go to tmsearch.uspto.gov
2. Search the exact phrase/word you want to use
3. Check if it is actively trademarked in clothing/apparel class (Class 25)
4. Look at status: LIVE = protected, DEAD = can use
5. Check variations of the phrase
6. Note: "I'd Rather Be" -- when trademarked the actual phrase may not be trademarked, just variations. Therefore you can use variations too.
7. Once checked -- put into Canva whiteboard

WHAT TO AVOID
- ANY designs with brand logos, characters, or names without permission
- Disney, Marvel, Taylor Swift, Volkswagen etc.
- Famous people's names or likenesses
- Phrases with active trademarks in Class 25 (clothing)
- Even if tags/titles don't use copyright phrases, the design image itself can infringe

CHECKING YOUR DESIGN TEXT
- Any text ON the design must be checked
- Any sayings, phrases, logos included in design must be checked
- DO NOT COPY DESIGNS -- legal trouble and fruitless
- We need trademark-free sayings

TRADEMARK-FREE APPROACH
- I Closed My Book to Be Here -> I Stopped Reading to be Here
- SAYINGS TEMPLATES: can be transformed and pushed out to multiple niches
- Get ChatGPT to come up with sayings:
  "Give me a few trademark-free sayings I can use for my print on demand sweatshirt targeting books/readers"

FIRST STEP -- CHECK LEGAL STATUS
- Put in search bar e.g. "fathers day" then see autocomplete and what comes up
- ALWAYS do this before design phase`,
  },
  {
    id: 'fw-keywords',
    title: 'Keywords Strategy',
    content: `KEYWORDS STRATEGY

TYPES OF KEYWORDS

Primary Keywords (in title):
- Main keywords that best describe the product
- E.g. "Christmas ornaments"
- ALWAYS start title with primary keyword -- guaranteed to rank
- Also puts title before product description

Secondary Keywords (tags + title):
- Related keywords that add context and detail
- E.g. "holiday decorations"
- In secondary keywords can get more specific: "Christmas gift for accountant", "Tax season gift"

Long Tail Keywords:
- Very specific, usually 3+ words
- Lower search volume BUT less competition AND higher conversion (more specific)
- E.g. "Gnome Christmas Tree Ornament"
- FOCUS on these in titles

Short Tail Keywords:
- Very broad, 1-2 words
- High search volume but very high competition
- E.g. "Christmas Gift" -- use sparingly

CREATING TITLES
- Start with PRIMARY keyword (most descriptive of product)
- Fill rest with PHRASES someone may type in Etsy search bar
- Separate phrases with commas (Etsy Seller Handbook recommendation)
- Include at least one "gift" keyphrase (huge search volume on Etsy)
- Do NOT use single-word keyphrases only
- Do NOT include keywords not searched for (put in description instead)
- Do NOT copy-paste your title into description top

ALEK COURSE KEYWORD STRUCTURE
- Primary keywords -> convey main idea and context
- Secondary keywords -> convey additional ideas and unique positions
- PUT SECONDARY KEYWORDS IN TITLES AND SHORT TAIL KEYWORDS IN TAGS (keep tags short)
- PUT SHORT TAIL HIGH IMPACT KEYWORDS IN DESCRIPTIONS (soft, premium, true to size)
- Focus on secondary long tail keywords for faster ranking on specific searches
- To rank broad search -> must rank specific searches first

TITLE STRUCTURE EXAMPLE
"Custom Vintage Mama Tshirt, Mama Shirt, Custom Mothers Day Gift, New Mom Tshirt"
- First keyword = most descriptive
- First 30 characters MUST have top keywords (Etsy shows this in search results)

NICHE DOWN STRATEGY
- Go broad -> find what sells -> niche down
- Start: 8-15 designs in broad niche
- What gets favourites/sales -> double down -> niche down there
- Nurse shirts -> Oncology Nurse shirts -> Night Shift Nurse shirts

GEORGE McCONNEL TITLE METHOD
- Use Amazon autocomplete for great tag ideas with real buyer-intent keywords
- E.g. "necklace" -> "necklace for wife" -> "white gold necklace for wife" -> "gold necklace from daughter"
- Most titles use "Gold Necklace for Wife" (too broad) -- use "Elegant 18 Inch Gold Necklace" (luxury + detail + size)

TAGS RULES
- Use ALL 13 tags -- every unused tag = missed opportunity
- Multi-word phrases only -- no single words
- Do NOT repeat the same keyword in multiple tags (wasteful)
- Do NOT include plurals -- Etsy handles plural matching automatically
- Do NOT use same keywords as your attributes (attributes already count as tags)
- Include "gift" phrases in tags (mama gift, custom mum gift etc.)
- "Comfort colours shirts" is a good tag
- Short tail in tags, long tails in titles

ATTRIBUTES -- HUGE SEO FACTOR
- Most sellers skip this = BIG mistake
- Etsy prioritises listings with complete accurate attributes
- One of biggest SEO factors
- PRO TIP: putting colour in attributes frees up a tag slot
- Fill in: primary colour, sleeve length, neckline, clothing style, occasion, graphic type

KEYWORDS AND MOMENTUM
- Posting listings consistently with optimised keywords stays in algorithm
- Do multiple listings (20+) targeting the same keywords -- chances skyrocket
- Once first one sells, Etsy will promote others
- E.g. 20 listings x 20 keywords (7 titles + 13 tags) = 400 searches covered
- If do 60 listings = ~1000 searches covered
- Make listings different: different fonts, colours, shipping options
- Rotate different mockups`,
  },
  {
    id: 'fw-template-phrases',
    title: 'Etsy Template Phrases',
    content: `ETSY TEMPLATE PHRASES

SHORT PHRASE TEMPLATES
These phrases can be swapped to different niches quickly:

- "Powered By [X]" (Powered By Coffee, Powered By Wine)
- "I'm here for the [X]" (I'm here for the Food)
- "CREW" designs (Birthday Crew, Bachelorette Crew)
- "I'd Rather Be [X]" (I'd Rather Be Reading, I'd Rather Be Hiking)
- "Ask Me About My [X]"
- "Fueled By [X]"
- "Future [X]" (Future Mrs., Future Doctor)
- "[Number] and Fabulous" (30 and Fabulous)
- "Est. [Year]" designs
- "Mama/Papa/Nana/Nanny + [Specific Type]"
- "In My [X] Era" (In My Mama Era, In My Thirties Era)
- "Official [X] Shirt" (Official Nurse Shirt)

FROM NOTION PHRASES LIST
- Powered By [X]
- Im here for the [X]
- CREW [occasion/group]
(full phrase list continues in Notion -- extend here as needed)

CHATGPT PROMPTS FOR PHRASES
- "Give me 20 sarcastic phrases that only someone turning 30 would understand"
- "Give me 30 funny phrases I could use for a shirt design that only a school counselor would understand"
- "Give me 30 funny 'most likely to' phrases for group vacation shirts with a camping theme"
- "Give me a few trademark-free sayings I can use for a POD sweatshirt targeting books/readers"
- "Outline the most important aspects of the 30th birthday niche: customer interests, keywords, slang, aesthetics"
- Mandy prompt: "Give me 30 funny phrases for a mug design that only a Siamese cat owner who loves books would understand"
- SimplyPOD best prompt: "Give me 20 sarcastic phrases only someone turning 30 would understand"

TEMPLATE SWAPPING METHOD
- "I Closed My Book to Be Here"
  -> "I Stopped Reading to be Here"
  -> "I Stopped Cooking to be Here"
  -> "I Stopped Baking to be Here"
- "I'd Rather Be Reading" -> "I'd Rather Be Surfing"
- Coffee and books -> Espresso and books
- SAME TEMPLATE, DIFFERENT WORDS = faster production`,
  },
  {
    id: 'fw-seo-traffic',
    title: 'SEO + Traffic',
    content: `SEO + TRAFFIC

ETSY SEO FUNDAMENTALS
- Primary keywords in title (most descriptive first)
- Secondary keywords in tags (short tail) AND title (long tail)
- Short tail high-impact keywords in descriptions (soft, premium, true to size etc.)
- Attributes count as tags -- fill them ALL in
- Alt text on main photo helps both external and Etsy SEO
- First 2 sentences of description must include relevant keywords
- Top of description NOT to be the title copy-pasted

ORGANIC TRAFFIC
- Etsy itself is primary traffic source (optimise SEO)
- Instagram: post after each upload, use shop's IG account
  - Ask people to tag you -- extra sales from their followers
- Pinterest: great for driving external organic traffic
- Share & Save link: use whenever driving traffic to Etsy (get 4% back on external sales)

ATTRIBUTES -- HUGE
- Size, sustainability, neckline, occasion, holiday -- all important
- If fill these can use tags more effectively
- Etsy priorities listings with complete and accurate attributes
- Pro tip: use attributes to free up tag slots

ALT TEXT
- Describe exactly what the first image shows
- E.g. "A woman wearing a black shirt that says mama"
- Etsy Seller Handbook confirms this helps SEO

MOMENTUM = KEY
- Posting listings consistently with optimised keywords stays in algorithm
- Etsy rewards shops that post regularly
- Do multiple listings targeting same keywords -- skyrockets chances
  - 20 listings x 20 keywords = 400 searches covered
  - 60 listings = ~1000 searches covered

RANKING PRINCIPLE
- To rank on first page of broad search -- must be ranking on specific searches first
- Don't put "funny mug" -- too broad -- customers won't buy on first search anyway
- RICHES IN THE NICHES -- niche down and grow quickly`,
  },
  {
    id: 'fw-niches',
    title: 'Niches',
    content: `NICHES

EVERGREEN NICHES (70% of time here -- do well all year round)
- Nurse (+ sub: Oncology Nurse, Night Shift Nurse, ER Nurse, ICU Nurse)
- Mom / Mama (+ sub: New Mom, Dog Mom, Dance Mom, Sports Mom, Girl Mom)
- Brides / Wedding (Bride, Bridesmaid, Maid of Honor, Bridal Party)
- Grandparents (Grandma, Nana, Nanny, Papa, Grandpa)
- Teachers (+ sub: Kindergarten Teacher, Music Teacher, PE Teacher, School Counselor)
- Dog owners (+ sub: Dachshund owner, Golden Retriever mom, Lab mom)
- Cat owners (+ sub: Siamese cat, Black cat owner)
- Christian (huge niche -- "He Has Risen", scripture designs)
- Funny (sarcastic, deadpan humor, double entendre)
- Political
- Professions: Accountant, CPA, Financial Analyst, Lawyer, Doctor, Engineer, Pharmacist
- Readers / Book lovers / Book club
- Coffee lovers
- Bachelorette / Hen party
- Biggest 3 niches overall: Christian, Funny, Political

SEASONAL NICHES (30% of time here -- look 8 weeks ahead)
Holidays:
- Christmas (biggest -- start in October)
- Halloween (start in September)
- Thanksgiving / Fall
- Valentine's Day
- Mother's Day (HUGE)
- Father's Day (HUGE -- funny fathers day designs sell very well)
- Easter
- St. Patrick's Day
- 4th of July
- New Year's

Events:
- Bachelorette parties
- Birthdays (30th, 40th, 50th, 60th)
- Graduation
- Retirement
- Baby Shower
- Gender Reveal
- Family reunion
- Stag do / bachelor party

CROSS NICHE IDEAS (mix together)
- Tacos + Valentine's Day -> "Tacos are my Valentine"
- Coffee + Nurse -> "Fueled By Coffee and Caring"
- Books + 30th Birthday -> "In My Reading Era"
- Dog + Christmas -> "Santa Paws"
- Cat + Sarcasm -> "My Cat Is My First Born Child"

BIGGEST NICHES TO START WITH
1. Holidays / Christmas
2. Professions
3. Bachelorettes

SUB-NICHE APPROACH
- Start broad -> find what sells -> niche down
- Nurse -> Night Shift Nurse -> Night Shift ICU Nurse
- Mom -> Dog Mom -> Golden Retriever Mom
- Less competition at bottom of funnel
- Much higher purchase intention at bottom of funnel
- "IF stay in 1 niche -- Etsy targets customers very well"

USE EVERBEE
- Filter search results: e.g. nurse, 4 months old, sort by sales
- Go to Etsy search results: "Gifts for Nurse" -> sort by most recent
  - Look at niche down ideas -- bought 3 in last 24 hours
- Shops <24 months old with listings <3 months old = currently working
- Revenue above $1000 + listing age below 300 days = trending now`,
  },
  {
    id: 'fw-designing',
    title: 'Designing Methods and Analysis',
    content: `DESIGNING METHODS AND ANALYSIS

DESIGN PROCESS OVERVIEW
Not designing for yourself -- designing for Etsy shoppers.
Study what sells before designing anything.

DAILY STUDY HABIT (10 minutes/day)
- Browse Etsy bestsellers every day
- Note: Is text to the left? Graphic silhouette in middle? How much text?
- Proven design styles from Etsy research -> then design

STEP 1 -- VISUAL RESEARCH FIRST (creativity before keyword analysis)
- Screenshot everything that appeals -> put on Canva board (or Figma whiteboard)
- Note: fonts, colours, design style, graphics, words, placement
- Look at designs from niches you have NO interest in -> bring ideas to your niche
- E.g. check mugs or retro designs and apply to your niche
- Clues to look for: 6 views in last 24 hours, in 10 carts, in 20+ carts
- Go through reviews -- most recent -- what is selling

STEP 2 -- ANALYSE BEST SELLERS
- Look at colour choices -- what colours are doing well
- Look at fonts -- what fonts are selling in your niche
- Look at placement -- left text? centered graphic?
- Look at simplicity -- most bestsellers are clean and readable at thumbnail size
- Check competition: what is selling currently

STEP 3 -- CREATE DESIGN TEMPLATES
- Make 8-15 designs for every niche you enter
- Build template databases in Canva (30+ templates = massive leverage)
- Duplicate templates to make variations rapidly
- When have 100 templates -> making lots of designs in minutes
- Also done the legal check at this point

FONTS (Cassiy's proven list)
Rustic/Distressed: Remington Weather Font, EDMUND font (rustic/stressed look)
Cutout Style: Paper Cutout font (alternate letter colours -- works for sarcastic designs)
Vintage: Vintage College Dept Font
Clean/Modern: Vancouver font (text-only designs)
Feminine: Clementina font (women's shirts, mothers)
Cursive Rustic: Rustic Pantry font, Limon Mint font (fun designs)
Dictionary/Fake Definition: Bookmania font
Western/Country: Monday font, Road Rage font, Western Carlo Font
Halloween: Sansation Font, Vampire Zone font, Spooky Man font
Kids: Dinosauce font, Islands Sans Font, Morris Jr Font
Note: Use Font Matcherator if can't find a font. Use Creative Fabrica -> upload to Canva.

COLOURS
- Research which colours are selling in your niche
- Comfort Colors bestsellers: Moss, Ivory, Espresso, Orca, Violet, Pepper, Pink, Blue Jean, Bay, Berry, Orchid, Blossom
- Create rectangle in Canva -> use eyedropper to copy exact shade
- 1-2 colours max on design for clean look
- Dark designs need WHITE version for dark shirts
- White hex code: use #FCFCFC NOT #FFFFFF (forces double print = more vibrant white)
- ADD COLOUR -- SELLS MORE

GRAPHICS (Most Important Differentiator -- "Is what separates you from others")
3 methods:
1. FreePik/Canva graphics (must combine with others -- too generic alone)
2. Premade designs from Etsy (cannot sell exact same design)
3. BEST METHOD: AI with Midjourney
   - alpha.midjourney.com -> see what others creating -- THIS IS AMAZING
   - E.g. "rustic stacked book graphic on white background"
   - Click image at bottom -> references it
   - Use Personalisation tab -> rank images -> learns your style
   - Make artwork fit print size dimensions -- GREAT TIP
   - ALWAYS UPSCALE AT END for best quality image
   - Right click -> Copy -> Paste upscaled into Canva
   - Use Canva background remover
   - If lots of colours: use Tracer App -> vectorise to SVG -> change colours

PUTTING IT ALL TOGETHER
1. Get graphic (books, etc.)
2. Take saying ("I closed my book to be here")
3. Change font to proven one
4. Add arch effect to text
5. Copy design and add new saying
6. Make just the sayings as the design too
7. Use font from one bestseller, format from another, colours from another -> ORIGINAL design

VARIATIONS FROM ONE TEMPLATE
- Change graphic -> 5 new designs
- Change phrase -> more designs
- Take ChatGPT phrase list -> apply to this template
- Every design: make 8-15 variations

EXPORT REQUIREMENTS
- Transparent background: YES (must be PNG)
- Resolution: 5000px x 5000px minimum (or Printify spec per product)
- Bella + Canvas 3001: 4500px x 5100px
- DPI: must be above 300 DPI (check in Printify)
- No transparency/opacity on design elements (must be 100% opacity)
- No white square boxes behind design (use transparent background)
- Whites: #FCFCFC not #FFFFFF

DESIGN TOOLS
- Canva (primary design tool)
- Kittl (templates and POD presets -- type keyword in templates for ideas)
- Figma or Canva (whiteboard/research board)
- Creative Fabrica (premium fonts and graphics)
- Adobe Illustrator (SVG conversion)
- Midjourney (AI graphics)
- Playground AI (alternative AI image tool)
- ChatGPT (phrases, saying ideas, niche research)

AUTOMATION
- Shop making $16k/month had 700 listings, 12 per day in new shop
- Target: 30 products per day minimum when running 30 templates
- Revise 1 template per day while maintaining production
- Quantity over Quality in the short run always leads to Quality long-term
- TO GET TO 7 FIGURES: NEED TO LOCK DOWN THIS PROCESS
- Use Prelist to upload quickly -- keywords in title, Prelist makes them unique`,
  },
  {
    id: 'fw-uploading',
    title: 'Uploading',
    content: `UPLOADING WORKFLOW

TOOLS
- Prelist (primary bulk upload tool)
- Vela (listing management and bulk editing)
- Simply Listed (mockup creation)
- Google Drive (file storage and team notification)
- Printify templates (product setup)
- Canva (mockup preparation)

ALEK BULK UPLOAD METHOD
Step 1: Upload designs to Printify via Prelist
- Connect to correct shop
- Find template
- Upload black AND white design versions (same name)
- Keywords: Prelist will scramble titles for unique names (change later -- but Printify has unique names = good)
- Products hidden at this stage

Step 2: Add mockups (products still hidden)
- New listings get boost at beginning -- get mockups on IMMEDIATELY
- Variant visibility: show all variants, if sold out show second option, show out of stock

Step 3: Vela bulk editing
- Refresh
- Select Products
- Edit Listings
- Shipping Profile -> Apply
- Section -> Apply (keyword-based section names)
- Tags -> Apply
- Delete Old Mockups (Optional)
- Listing Info Cards -> Apply
- Mockups (proven thumbnail first, guarantee, size chart)
- Titles Edits (Revisions for uniqueness)
- Tags Edits (Revisions)
- Sync Updates

PUBLISHING CHECKLIST (From Alek)
From Alura or Etsy:
[ ] Best non-ad listings found
[ ] Title copied/noted
[ ] Tags copied/noted

Vela:
[ ] Refresh
[ ] Select Products
[ ] Edit Listings
[ ] Shipping Profile -> Apply
[ ] Section -> Apply
[ ] Tags -> Apply
[ ] Delete Old Mockups (Optional)
[ ] Listing Info Cards -> Apply
[ ] Mockups added
[ ] Titles Edited (Revisions)
[ ] Tags Edited (Revisions)
[ ] Sync Updates

PRINTIFY SETUP
- Choose provider: SwiftPOD or Monster Digital ONLY
- Select variants: White, Ivory, Bay, Orchid, Violet, Blossom, Blue Jean, Moss, Pepper, Berry
- Upload design and position correctly
- Remove all Printify mockups (press save selection)
- Set personalisation if applicable
- Shipping Profiles: use Standard (SwiftPOD with t-shirts: 2-6 days)
- Do NOT create new shipping profile for each product -- use templates
- SYNC PRODUCT DETAILS: leave tags checked but NOT mockups (uncheck mockups)

RESOLUTION CHECK
- MUST check design resolution in Printify: must be above 300 DPI
- Low resolution = blurry print = bad reviews

PERSONALISATION
"Please specify the phrase for each shirt along with a name personalisation if needed"
Example:
- Saddlin Up - no name
- Ridin Shotgun - name: Amy
- Reach out to us directly for any additional requests`,
  },
  {
    id: 'fw-post-listing',
    title: 'Post Listing Phase',
    content: `POST LISTING PHASE

IMMEDIATELY AFTER PUBLISHING
- Post on Instagram: use the AI video / Reels feature
  - Show the new design
  - Tag relevant hashtags
  - Include shop link in bio
- Create AI video clip for Reels/TikTok using design mockup

INSTAGRAM STRATEGY
- Post every time a new listing goes live
- Ask followers to tag you in posts wearing your designs
- Use Share & Save link whenever directing traffic
  - Get 4% back on all external sales

MONITORING NEW LISTINGS
- Check listing performance after 48-72 hours
- If getting favorites but no sales: price or mockup issue
- If not getting views: SEO/keywords issue
- If getting views but no clicks: thumbnail/main photo issue

RENEWAL STRATEGY
- Don't give up on a listing -- just improve it
- Change mockups and renew -> gets a small ranking boost from Etsy
- Test: new thumbnail, different main colour, updated tags`,
  },
  {
    id: 'fw-ab-testing',
    title: 'A/B Testing',
    content: `A/B TESTING

FREE SHIPPING TEST
- Test: offering free shipping vs customer pays
- Etsy rewards free shipping with improved ranking (orders $35+)
- Setup: "Guarantee free shipping when customer spends $35"
- Track: conversion rate before vs after
- Customer pays if single item under $35
- Shop pays if buying 2+ items over $35 (Alek method -- entices to add more items)

KEYWORD A/B TESTING
- Run two similar listings with different keyword strategies in title/tags
- Compare which listing gets: more views, more clicks, more conversions
- Test period: minimum 2 weeks before drawing conclusions

MOCKUP TESTING
- Rotate different main thumbnail images
- Test: flat lay vs model mockup
- Test: light colour shirt vs dark colour shirt as hero image
- Test: close-up crop vs full body shot

METRICS TO TRACK
- Views: how many people saw listing in search results
- Favorites: interest without purchase (indicates design/price issue)
- Clicks: click through rate from search (thumbnail quality)
- Conversions: purchase rate (full listing quality, avg 1-3%)
- Revenue per listing: identify best performers

WHEN TO CHANGE VS WHEN TO PERSIST
- Give new listings 2-4 weeks minimum before changes
- If no views after 2 weeks: keyword/SEO problem -> update title/tags
- If views but no favorites: thumbnail problem -> test new mockup
- If favorites but no purchases: pricing or description/trust problem
- Changing a listing = small ranking boost from Etsy`,
  },
]

// ============================================================
// SECTION 2: CHECKLISTS
// ============================================================
export const CHECKLISTS_PAGES: KBPage[] = [
  {
    id: 'cl-product',
    title: 'Product Checklist',
    content: `PRODUCT CHECKLIST

T-SHIRT MODELS (recommended)
- Comfort Colours 1717 (t-shirt -- premium feel, bestseller)
- Gildan 16000 (t-shirt -- good value)
- Gildan 18000 (sweatshirt -- affordable and popular)

NOTES
- Comfort Colours is the premium option and commands higher prices
- Gildan 18000 sweatshirt is great for seasonal/winter designs
- Focus listings on these proven models before expanding
- Always check Printify for current availability and pricing before listing
- If Cassiy doing it today: would sell sweatshirts and t-shirts`,
  },
  {
    id: 'cl-niche-research',
    title: 'Niche Research Checklist',
    content: `NICHE RESEARCH CHECKLIST

[ ] Identify target niche
[ ] Check trademark on USPTO for all phrases/sayings
[ ] Search niche keyword in Etsy -- note number of listings
    - Less than 50,000 = good
    - More than 100,000 = very competitive, niche down
[ ] Use ERank/Everbee to check keyword volume
[ ] Find 5-7 best selling listings in niche
[ ] Analyse top listings:
    [ ] Common fonts used
    [ ] Colour palette
    [ ] Design style (graphic vs text, placement)
    [ ] Title structure and primary keywords
    [ ] Tags used
    [ ] Price points
    [ ] Review count and recency
[ ] Find 5+ shops selling in this niche
    [ ] Mix of established (2+ years) and newer shops (less than 18 months)
    [ ] Check their best sellers
    [ ] Note their mockup styles
[ ] Validate demand:
    [ ] Are there listings with "X bought in last 24 hours"?
    [ ] Are there listings with 20+ in carts?
    [ ] Are there recent reviews (last 30-90 days)?
[ ] Can this be templatised? (key for scale)
[ ] Create research board in Canva/Figma with screenshots
[ ] Add keyword list to tracker (ERank verified)
[ ] Confirm niche is not too seasonal unless intentional
[ ] Double check all phrases for trademark clearance

Note: This checklist also contains a database in Notion (inline database ID: 22aed686b47d800d8450c7296bc02994)`,
  },
  {
    id: 'cl-design',
    title: 'Design Checklist',
    content: `DESIGN CHECKLIST

TOOLS
- Canva (primary design tool -- free and premium)
- Kittl (templates and POD presets)
- Figma (research board and wireframing)
- Creative Fabrica (premium fonts and graphics)
- Adobe Illustrator (SVG conversion)
- Midjourney (AI graphics)
- Canva link: https://www.canva.com

DESIGN QUALITY CHECKLIST
[ ] Trademark check completed on all text/phrases in design
[ ] Design readable at thumbnail size (small)
[ ] Font chosen based on research (proven in niche)
[ ] Maximum 2 complementary fonts used
[ ] Colours based on research (colours selling in niche)
[ ] Contrast is good (dark design on light shirt or light design on dark shirt)
[ ] White hex code is #FCFCFC NOT #FFFFFF (forces double print -- more vibrant white)
[ ] Design is transparent background (PNG)
[ ] Resolution: minimum 5000x5000px (or Printify spec for product)
[ ] DPI above 300
[ ] No transparency/opacity settings on design elements (all 100% opacity)
[ ] No white boxes behind design (transparent background)
[ ] File named correctly before download
[ ] Both black AND white versions created (for dark/light shirts)
[ ] Can be understood/read from a distance

AFTER DESIGN
[ ] Add to Canva design library/template database
[ ] Can this be templatised? (can swap one word to make new designs?)
[ ] Create variations: 8-15 versions of each design
[ ] Consider: different fonts, different colours, different layouts
[ ] Export with transparent background`,
  },
  {
    id: 'cl-upload',
    title: 'Upload Checklist',
    content: `UPLOAD CHECKLIST

UPLOAD PHASE TOOLS
- Printify Premium (use for cheaper base costs -- worth it above $145/month)
- Prelist (bulk upload tool)
- Google Drive (store and share design files)
- Simply Listed (mockup creation)

COMPLETE THE PRINTED OUT CHECKLIST

PRE-UPLOAD
[ ] Designs stored in Google Drive
[ ] Notify team on Notion and Slack (if applicable)
[ ] Printify template prepared for product type
[ ] Resolution verified: above 300 DPI in Printify
[ ] Black AND white versions ready

UPLOAD TO PRINTIFY
[ ] Choose provider: SwiftPOD or Monster Digital
[ ] Select correct variants (colours)
[ ] Upload design and position correctly
[ ] Remove all Printify auto-mockups
[ ] Set personalisation if applicable
[ ] Shipping profile: use existing standard profile
[ ] Pricing: set to 57% profit margin (with Premium) or 45% (without)
[ ] Product is HIDDEN at this stage

PRELIST UPLOADER
[ ] Connected to correct shop
[ ] Template found and selected
[ ] Black and white designs uploaded with same name
[ ] Titles will be scrambled by Prelist (change later)
[ ] Products still hidden while adding mockups

VARIANT VISIBILITY
[ ] Show all variants
[ ] If sold out: show second option, show out of stock`,
  },
  {
    id: 'cl-marketing',
    title: 'Marketing Checklist',
    content: `MARKETING CHECKLIST

PAIN + REFLECTION = PROGRESS
Always reflect on what you have achieved and improve.

SEO FUNDAMENTALS
[ ] Keywords in description at top (no stuffing)
[ ] Title tags optimised
[ ] Alt text added to main photo (must contain keywords)
[ ] Attributes filled in (Etsy reads these for SEO)
[ ] About me + info sections complete
[ ] Shop sections filled out with keyword-based names
[ ] Database board view set up for tracking

LISTING PHOTO STRATEGY
[ ] No text in main photo (CU Online recommendation)
[ ] Clear view of design in main photo
[ ] All 10 available image slots used
[ ] All mockups different colours of design
[ ] Height and width: 2000px minimum (ideally 2700x2200px for 4:3 ratio)
[ ] Most descriptive part at start of title

SOCIAL PROOF AND CONVERSION
[ ] Get friends and family to buy listings (first sales and reviews)
[ ] Guarantee on slides 1-2 (Andreas recommendation)
[ ] Review request sent to recent deliveries
[ ] Responded to all medium/negative reviews with help/refund offer

PRICING AND SHIPPING
[ ] Shipping price under $6 USD for USA
[ ] Guarantee shipping over $35 (Alek method)
[ ] Accurate production times listed

PRINTIFY TEMPLATES
[ ] BE (Break Even): price so profit is $2-$4
[ ] LL (Loss Leader): price aggressively for traction
[ ] If selling 10+: move to 30-40% margin
[ ] Printify Premium: target 57% margin

ONGOING MARKETING
[ ] Signed up for next Etsy sale events
[ ] Thank you discount set up for repeat buyers
[ ] Abandoned cart discount configured
[ ] Favourited item discount set up
[ ] Instagram post created for each new listing
[ ] Share & Save link used whenever directing external traffic

ALEK PROCESS
[ ] Customer pays shipping if one item and below $35
[ ] If buys two items over $35 -- you pay for shipping (entices customer to buy more)

Do Guarantee on Slides 1-2 -- Andreas recommendation
Do Guarantee shipping over $35
Read Google Docs and Print outs

TEMPLATE PROCESS
1. List the designs on Etsy with optimised listing images, title, tags, description
2. Repeat steps 1-4. Get faster every time.
Goal: possible to list over 350 products in just over 4 months using the template method (15-20 min per product)`,
  },
  {
    id: 'cl-shop',
    title: 'Shop Checklist',
    content: `SHOP CHECKLIST

ETSY STOREFRONT TASKS

[ ] Shop name reflects what you sell or a general vibe | 20% priority
    - Examples: KatieApparel, TatsTotes, KaylieCo
    - Doesn't have to be too descriptive if unsure of niche yet

[ ] Shop name is easy to type and remember | 40% priority
    - Not things like: Janie10292, CGJNSCO
    - People need to be able to relook you up later to repurchase

[ ] Banner is created, clean, using a template | 50% priority
    - Don't make too complicated or overly filled with images
    - Keep it simple with a template and maybe a few mockups

[ ] Logo uses same colours and text as banner (unified branding) | 50% priority
    - Branding is important -- make banner and logo match

[ ] Logo is easy to read from shop page | 50% priority
    - Don't make logo small and text heavy

[ ] Shop title describes exactly what you sell including main niche keywords | 70% priority
    - Example: "Custom family and holiday tshirts and sweatshirts"
    - Etsy is a place where people buy from REAL people

[ ] Personal profile picture is a real photo of you (NOT logo) | 30% priority
    - People buy from real people on Etsy -- more trustworthy
    - Example link: https://www.etsy.com/ca/shop/CUOnline

[ ] About me filled out with story, how you started, meaningful info | 90% priority
    - Etsy won't see store as complete without this

[ ] Shop members photos filled out | 40% priority
    - Etsy won't see store as complete without this

[ ] Shop members descriptions filled out | 40% priority
    - Etsy won't see store as complete without this

[ ] Instagram account created for shop | 20% priority
    - https://www.instagram.com/accounts/emailsignup/
    - So people can tag products and you can save handle before competitors take it

[ ] IG social handle added under "Around the web" | 20% priority
    - https://www.etsy.com/your/shops/me/story
    - So buyers can find and tag you

[ ] Returns/exchanges policy set up | 100% priority
    - https://www.etsy.com/your/shops/me/shop-policies
    - Won't rank high without -- Etsy doesn't see store as complete

[ ] GDPR policy if selling to UK | 100% priority
    - Use: https://www.alura.io/resources/etsy-privacy-policy-generator
    - Required if shipping to EU -- must be GDPR-compliant

[ ] LUCID number if selling to Germany (Printify LUCID: DE4139628009499) | 100% priority
    - https://www.etsy.com/your/account/taxpayerid
    - Required for German Packaging Act compliance since 2022

[ ] Shop sections created with keyword-based titles | 80% priority
    - Examples: "New Mom Gifts", "Teacher Apparel", "Lawyer Gifts"
    - Shop sections are read for SEO

[ ] Gift note option turned on (if possible) | 20% priority
    - Etsy is a big gifting platform

[ ] Automatic Listing Translation turned on | 20% priority
    - Allows Etsy to translate listings to reach more customers

[ ] Sold listings are hidden | 50% priority
    - Hides sales numbers from competitors and research tools

[ ] Bestselling items featured on homepage (star them) | 40% priority
    - Get more views from buyers on listings that have historically done well

PRINTIFY SETTINGS (FOR PRINT ON DEMAND STORES)

[ ] Printify linked to Etsy store | 100% priority
    - https://printify.com/app/sales-channels/selection
    - Allows automating orders between supplier and Etsy

[ ] Etsy production partner set up (Swiftpod, Duplium) and selected for ALL listings | 100% priority
    - Must disclose production partner on Etsy to avoid shutdown

[ ] Returns ship to your house (edit Ship From in Printify -- US sellers only) | 20% priority
    - https://printify.com/app/store/settings/ship-from
    - Gives customers alternate return address so you can receive returns

[ ] Order routing is TURNED OFF | 30% priority
    - https://printify.com/app/store/settings/order-settings
    - Order routing causes many issues -- choose your own supplier

[ ] Order approval set to 24 hours | 30% priority
    - https://printify.com/app/store/settings/order-settings
    - Time to edit orders before they automatically go into production

[ ] Delayed orders auto-send to production (when back in stock) | 30% priority
    - If item comes back in stock, order will automatically fulfil

[ ] Package inserts turned on | 30% priority
    - https://printify.com/app/store/settings/branding
    - Can help bring in more future sales

[ ] Gift messages turned on (if supplier can print these) | 30% priority
    - https://printify.com/app/store/settings/gift-message
    - To automate gift messages, this setting must be ON in Printify

[ ] Printify Premium enabled IF selling over $145 USD/month | 50% priority
    - https://printify.com/app/subscription
    - Use code "cuonline" for free month of Printify Premium
    - Past $145/month you are now saving money with Premium`,
  },
  {
    id: 'cl-listing',
    title: 'Listing Checklist',
    content: `LISTING CHECKLIST

ETSY LISTINGS -- HIGH CONVERTING PHOTO STRATEGY

[ ] Main photo viewable at 4:3 ratio AND square ratio (2700x2025px and 2000x2000px min) | 80%
    - Some views on Etsy search are this ratio

[ ] Main photo fully seen from storefront at small thumbnail size | 80%
    - Thumbnail must be zoomed in enough to actually read design

[ ] Main photo is high res, not blurry (minimum 2000px on shortest side) | 80%
    - Low resolution = unprofessional and untrustworthy

[ ] Product fully visible in main photo (not so zoomed you can't see it's a t-shirt) | 80%

[ ] If customised item: NO placeholder text (against Etsy TOS -- show real example) | 100%
    - It is now against Etsy TOS to use placeholder text

[ ] Mockup for every colour option | 80%
    - People will rarely buy colours for which they do not see in a mockup

[ ] Colours clearly labelled or photos linked to match variation to picture | 60%
    - Avoid confusion and complaints if people order wrong colour

[ ] Model faces forward in first mockup (whole design easy to see) | 80%
    - First photo should be easy to tell what you sell and what the design is

[ ] Design rotated to match shirt direction if necessary | 80%
    - Mockups should look as realistic as possible

[ ] Photos realistic -- no hair blocking design, no wrinkles on shirt, design doesn't run off product | 100%

[ ] Photos consistent in product placement sizing | 80%

[ ] First mockup is NOT AI-generated (must be actual product photo) | 100%
    - Main Etsy photo must be exact photo of the product being sold

[ ] Size guide or chart included in photos | 100%
    - Avoid customer size confusion and minimise questions and returns

[ ] Important info highlighted in photos: fit guide, what makes you different, sustainability, material, guarantees, best review | 90%

[ ] All photo cards match branding and use clear easy-to-read fonts | 50%

[ ] If including video: it is of the exact design/product being sold | 50%
    - Don't use video of another product -- when people hover over listing, video plays

ETSY LISTINGS -- SEO (GET SEEN)

[ ] Keywords do NOT violate trademarks | 100%
    - No Disney, famous people logos, characters etc.

[ ] First keyword in title is most descriptive of product being sold | 90%
    - E.g. "Custom Vintage Mama Tshirt"
    - This is your most important keyword

[ ] Rest of title filled with alternative PHRASES someone may type into Etsy search bar | 95%
    - E.g. "Mama shirt, custom mothers day gift, new mom tshirt"

[ ] Title does NOT include vague keyphrases not relevant to design | 75%
    - Avoid: "gift for her, gift for him, girls shirt" -- waste space, unlikely to result in sales

[ ] Title does NOT include keywords that wouldn't be searched for (put in description) | 75%
    - E.g. "Unisex shirt, bella canvas 3001 shirt" -- not searched but helpful in description

[ ] Title phrases separated by comma | 60%
    - Etsy Seller Handbook recommends not stuffing keywords without punctuation

[ ] At least one "gift" keyphrase | 75%
    - Gift is one of the most popular keyword searches on Etsy

[ ] Keyphrases NOT one word only | 80%
    - Single words not descriptive and highly saturated

[ ] Relevant attributes used | 80%
    - If Christmas shirt: under Occasion, select Christmas
    - Etsy attributes count as tags

[ ] Alt text entered for main photo | 50%
    - E.g. "A woman wearing a black shirt that says mama"
    - Etsy Seller Handbook states this helps external SEO and Etsy SEO

[ ] First 2 sentences in description have relevant keywords | 80%
    - Top of description is read for SEO purposes

[ ] Top of description is NOT copy-paste of title | 70%
    - Etsy Seller Handbook says NOT to paste title at top of description

[ ] Description is point form after keyword sentences, easy to read with headings | 90%
    - Must be easy to read -- not giant paragraphs

[ ] Description highlights care/wash instructions | 50%
[ ] Description highlights return/refund policies and quality issue contact | 30%
[ ] Description highlights sizing and note to check size chart | 30%
[ ] Description highlights how to make changes to order | 50%
[ ] Description highlights key features that set you apart | 50%
[ ] Description highlights variances that may occur between photo and print | 50%
[ ] If selling to EU and Northern Ireland: GPSR contact at bottom of description | 50%
[ ] If AI-assisted design: "Art Disclaimer: This design was in-part created using the assistance of AI" | 85%
[ ] All 13 tags used | 100%
    - Not utilising all 13 tags = missing out on potential searches

[ ] Most relevant keywords in BOTH title AND tags | 100%
    - Etsy Seller Handbook: if keyword in both titles and tags, seen as more relevant

[ ] Tags are multi-word phrases | 90%
    - Use descriptive keyphrases that cover possible Etsy searches

[ ] Tags are not repeated | 90%
    - Repeating tags is not necessary

[ ] Tags not using same keywords as attributes (attributes already count) | 80%
[ ] Tags do not contain both singular and plurals (Etsy handles automatically) | 50%
[ ] All listings categorised into relevant section | 75%

[ ] If includes customisation: personalisation box turned on with clear instructions + example | 100%
    - If using Printify, this is needed to avoid Etsy shutting you down

ETSY LISTINGS -- CREATE DESIGNS THAT SELL

[ ] No designs violate trademarks | 100%
    - No Disney, Taylor Swift, Volkswagen or other brands without permission
    - Even if tags/titles don't use copyright phrases, design image can still infringe

[ ] Text on design checked for trademarks on USPTO | 100%
    - https://www.uspto.gov/trademarks/search

[ ] Dark designs NOT being printed on dark shirts (use white version) | 75%
    - Dark print will not show well against dark fabric

[ ] Design can be easily read from a small thumbnail | 80%
[ ] Fonts chosen based on research | 60%
[ ] Fonts are easy to read | 60%
[ ] Maximum 2 complementary fonts on design | 50%
[ ] Designs in 1 colour or complementary colour palette | 80%
[ ] Designs saved at high resolution (5000px x 5000px) | 100%
[ ] Designs saved as PNG with transparent background | 100%
[ ] No white box or square box behind design | 100%
[ ] No transparency in design file (all elements 100% opacity) | 100%
[ ] Whites in design are #FCFCFC NOT #FFFFFF | 85%
    - Forces printer to print white twice -- thicker and more vibrant
[ ] Design simple enough to understand at a distance | 75%
[ ] Design visually centred, doesn't feel off balance | 70%

ETSY LISTINGS -- PRICING AND SHIPPING

[ ] New shipping profile created | 100%
[ ] Prices set to "I'll enter fixed prices manually" | 100%
[ ] Processing time set to range (e.g. 2-7 days) | 100%
[ ] USA shipping set to USPS first class mail or carrier supplier uses | 100%
[ ] Combined earliest delivery window should be 2-3 days (1-2 days processing + 1 day shipping) | 75%
[ ] USA shipping NOT above $6 USD | 75%
    - Etsy ranks stores that price over $6 USD for USA shipping lower

[ ] GPSR Contact in descriptions IF shipping to EU and Northern Ireland | 100%
    - Printify and Printful have a contact you can use -- add to descriptions
    - If don't ship to EU+NI: turn off all EU+NI shipping

ETSY LISTINGS -- IF USING A PRODUCTION PARTNER

[ ] "Who made it?" set to "another company or person" | 100%
[ ] "What is it?" set to "a finished product" | 100%
[ ] "When was it made?" set to "made to order" | 100%
[ ] Production partner listed and selected | 100%
[ ] "Show this production partner's name to buyers?" set to OFF | 100%
[ ] "Why working with this partner?" set to "I don't have the technical ability..." | 100%
[ ] "What is your role in the design process?" set to "I design everything myself" | 100%
[ ] "What is partner's role?" set to "they do everything for me" | 100%`,
  },
  {
    id: 'cl-customer-service',
    title: 'Customer Service Checklist',
    content: `CUSTOMER SERVICE CHECKLIST

ETSY SALES AND CUSTOMER SERVICE

DISCOUNTS AND PROMOTIONS
[ ] Etsy thank you discount set up | 50%
    - https://www.etsy.com/your/shops/me/sales-discounts
    - Gives people a discount after purchase to bring repeat purchases

[ ] Etsy automated abandoned cart discount set up | 50%
    - Can bring back shoppers who never completed purchase

[ ] Etsy favourited item discount set up | 50%
    - Will send alerts and sale reminders for those who favourited your items

[ ] Signed up for the next Etsy sale events | 50%
    - Get featured on Etsy sale pages when you've registered

[ ] Impulse purchases encouraged by running quick sales | 80%
    - Example: running 25% off for 5 days

CUSTOMER COMMUNICATION
[ ] Customer messages responded to in less than 24 hours | 100%
    - You will lose Star Seller if you miss many messages

[ ] Message to buyer includes: timeframe on how long and how to make order edits | 60%
    - "Mine is set to 24 hours as Printify orders set to 24 hours"

[ ] Message to buyer lets them know to contact you if quality issue | 60%
    - Get people to message BEFORE they leave a bad review

[ ] Message to buyer includes a thank you | 60%

[ ] Message to buyer includes link to social media | 60%
    - Many people tag your shop on IG allowing extra sales from their followers

[ ] Responded to all medium/negative reviews offering help or refund | 100%

PACKAGE INSERTS (via Printify -> Branding settings)
[ ] Package insert includes a thank you message | 50%
[ ] Package insert includes a discount message | 50%
[ ] Package insert encourages tagging you in social media | 50%
    - Many people tag your shop on IG allowing extra sales from their followers

REVIEW STRATEGY
[ ] Review request sent to recent deliveries | 30%
    Template: "Hi [name]! I saw your order was delivered, I hope you love it! If you could, would you be able to leave us a review? Reviews are extremely important on Etsy and would help out our small business immensely! Thank you!"
    - Only ever ask ONCE through Etsy messages
    - Most people still will not review unless directly asked

[ ] Friends and family reached out to for first sales and reviews | 95%
    - Very hard to get first sales from strangers with no reviews -- kickstarting them is massive

[ ] Social media profiles set up (Instagram) | 50%
[ ] Share & Save link used anywhere you drive traffic to Etsy | 100%

MAINTAIN STAR SELLER
[ ] Customer messages responded to within 24 hours
[ ] If away and cannot answer: automated messages turned on
[ ] Negative review customers messaged to solve issue (to raise review rating)
[ ] If order is late in production: "update dispatch date" BEFORE the last day`,
  },
]

// ============================================================
// SECTION 3: ETSY SOPs
// ============================================================
export const SOPS_PAGES: KBPage[] = [
  {
    id: 'sop-product-niche',
    title: 'Product + Niche SOP',
    content: `PRODUCT + NICHE SOP

PRODUCTS TO SELL (If Cassiy doing it today)
- Sweatshirts AND T-shirts
- Comfort Colours 1717
- Gildan 18000 Sweatshirt

LISTING GOAL
- To get 1000 items to sell
- How to do it:
  - When are you going to list?
  - Exactly what time?
  - Exactly what place?
  - Will make progress if you do this
- DON'T QUIT -- keep designing

INSPIRATION MATHS
For $10k per month:
- 333,333 views x 3% = 10,000 sales x $10 = $10,000/month
- Group Listing: 8333 x 3% = 249 x 4 = 1000 sales x $10 = $10,000

COMFORT COLORS TEMPLATE (TopNotchThreadz process)
Step 1: Find 7-8 shops selling CC1717
- Must be a mix of old ultra-successful shops AND new up-and-coming (last 12-18 months)
- Both must be proven with high amount of sales in relative terms
- Put shops in a spreadsheet
- Analyse: sales, reviews, listings
- Put listings mocks + info cards + titles + descriptions + delivery + sections all in one place (Canva/Google Docs)
- Include: colours and sizes + prices + tags + announcements + about + policies
- Take the average/most common for all and compile a list of your own

Step 2: Buy mockups for all of them
- Put in Canva ready to be amended
- Take a look at top shops annotations and come up with your own

Step 3: Add guarantee if new shop
- Look at Guarantee in TopNotchThreadz for example
- Half a mock up

Step 4: Printify template
- Choose colors and prices
- Add loss leader: crimson small

Step 5: Mockups via Simply Listed
- Copy top shops

ALEK 30-DAY QUICK START WORKSHOP
"This can change your life"
- Do 1 template every day -- easy
  - After 7 days: 7 templates
    - Post at least 7 products a day
  - After 30 days: 30 templates
    - 30 products a day -- THIS IS THE MINIMUM AMOUNT TO POST PER DAY
  - When posting 30 a day: revise 1 template per day
  - Start making 1-off designs too
- MAKE 30 TEMPLATES AND POST EVERYDAY AND REVISE 1 A DAY -- THIS CAN CHANGE YOUR LIFE
- Need to make a lot of products for sales

ANDREAS METHOD
Fundamental: bring VALUE to a niche
- That means do something in the niche that hasn't been done before but is successful in another niche
- THIS ADDS VALUE
- E.g. easy way to take a t-shirt design and put on sweatshirt

Best way to do this:
- Take 6-8 shops you want to emulate
- Download their backend data via Everbee
  - See which are the best sellers and find commonalities
  - E.g. text in circle -- top and bottom and graphic in middle
- Take this fundamental and apply it to a niche
  - Look for a niche
  - See if you see this design on page 1/best seller -- if NOT it ADDS VALUE
- LOOK AT THE TAGS OF TOP LISTINGS AND TITLES -- see if they are high volume keywords

ALEK METHOD -- SHOP HACKS
- Find 5 best-selling shops
  - Shops should be mix of recently successful AND ones that worked long time (Proof of Concept)
  - NJD Apparel -- no frills shop, look on Alura, 4 years in business
  - Cozy Gifts Company -- more recent, 700 listings (200 new), open 8 months, 13,000 sales, 1600/month`,
  },
  {
    id: 'sop-ideas-research',
    title: 'Ideas + Research SOP',
    content: `IDEAS + RESEARCH SOP

FUNDAMENTAL AIM
"Takes what is working in one niche and apply it to another -- that's it!"
Why it's not working: because you are not executing.

WHOLESALE TED EXAMPLE
- Search funny t shirt
- Found "fast food" shirt -- deadpan humour with double entendre
- Found funny parrot shirt -- popular, well searched but no deadpan humour version with double entendre
- NOW: do cross method

FIRST STEP
Find all listings through methods below and put in Canva template
4000 products to earn 6 figures

CASSIY EXAMPLE METHOD
- Got family member to buy one product
- Made 50 designs first month and 100 by second
  - Copied best sellers and improved them
  - Sold 41 items -- shirts and mugs
- 2 products were fathers day designs -- "funny fathers day"
  - Check competition -- what is selling currently

READ key resources in Google Docs (links in Notion)
SHOULD BE MAKING LOTS OF GROUP ORDER SHIRTS -- Mom and Dad shirts

NICHE RESEARCH APPROACH
- Look at shop reviews then x10 for approximate sales
- Look for items with 20+ in the cart
- Look at how recent reviews are (anything in last year is ok)
- Sales over $1000 is great
- Don't do one-off designs -- upload in batches based on interest groups
- Keywords must be targeted
  - Need 13 tags and at least 7 keywords in title (potentially shows up in 20 searches)
  - Do multiple listings (20+) targeting same keywords -- chances skyrocket
    - Once first one sells, Etsy promotes others
    - E.g. 20 listings x 20 keywords (7 titles + 13 tags) = 400 searches
    - 60 listings = ~1000 searches
  - Make listings different: different fonts, colours, shipping options
  - Rotate different mockups

KEYWORD RESEARCH
- MUST NICHE DOWN TO BOTTOM OF FUNNEL FOR TRAFFIC
  - Here: low competition and high purchase intention
  - Don't do "funny t shirts" -- do "funny t shirts for accountants"
  - Nothing general -- specific keywords
  - Look at Lexington Prints vs VMDesignEE (second not targeting well)
- Do research for every niche -- look at top sellers in recent months
  - If new search design: not saturated

NICHE DOWN AND CROSS NICHE
- Niche Down: Get more specific -- make Oncology Nurse shirt, Night Shift Nurse
- Use Everbee: filter search -- nurse -- 4 months old -- sort by sales
- Go to Etsy search results: "Gifts for Nurse" -> sort by most recent
  - Look at niche down ideas -- bought 3 in last 24 hours

HIGH DEMAND AND NARROW NICHES

KEYWORD TYPES
- Primary keywords in the title: main keywords e.g. "christmas ornaments"
- Secondary keywords in the tags: related keywords that support primary e.g. "holiday decorations"
- Long Tail Keywords: very specific, usually longer than 3 words, lower search volume but less competition and higher conversion e.g. "Gnome Christmas Tree Ornament"
- Short Tail Keywords: very broad, one or two words, high search volume but very high competition e.g. "Christmas Gift"
- Copy keywords of best stores
- Make sure you put attributes in listing -- helps Etsy algorithm
- ALWAYS START TITLE WITH PRIMARY KEYWORD -- guaranteed to rank

DO SHIRTS FOR SPECIFIC HOLIDAYS TO SPEED UP SALES -- Valentines + St Patricks

METHOD 1 -- RESEARCH
- Search funny t shirts
- Search on Everbee and ERank
- Your idea must add value -- not just copy
  - Make sure there is a market first -- then get inspired
  - E.g. custom mom "mama" t shirt -- $50 in first month
    - Don't just change font and colour
    - Add value: do matching mom and dad, different design, put on pocket rather than chest
- Do personalised items: great -> Use Hello Custom for this -- just have to approve orders at end of day

KEYWORD RESEARCH PROCESS
- Need to know searches with low competition and long tail
- Search terms less than 1000 -- try in Etsy
- Best keywords: copy top listings
- Top niche -> dog owner
  - Bottom niche: dachshund owner
  - "Dog Dad" -> middle -> not niche but broad
  - IF stay in 1 niche: Etsy targets customers well
- Example:
  - "Professional Gift" in Etsy -> lots of listings and competition
  - Gets traffic but not as many buyers as you'd think
  - Most buyers search 3 times on average
  - "Gifts for Accountants" -> very specific
    - Secondary long tail keyword
    - Only 4,000 listings -> people WILL buy here -> bottom of the funnel

ALEK METHOD -- ANOTHER
- If don't know where to start: ask ChatGPT
  - "Give Me A List of 50 of the most popular hobbies, sports, and activities I can use as niche ideas for my print on demand business"
- Before start design: validate the idea
  - E.g. from ChatGPT prompt: "Reading and Book Clubs"
    - Ask ChatGPT for more niche ideas
  - When starting: niche down and not go too broad -- more competition if broad
- Take niche down idea e.g. "book club sweatshirts" and put in Etsy search
  - Check results
  - First page with lots of best-selling listings: competitive -- ignore ads
  - Check amount of reviews + if listing is best seller (not paramount)
  - Go through listings that have performed well
    - Need to use similar fonts and style as that is what the market wants

BIGGEST 3 NICHES
- Christian
- Funny
- Political

SUPPLIER
- Monster or SimplyPOD only

DO NOT COPY DESIGNS -- legal trouble and fruitless
We need trademark-free sayings
- SAYINGS TEMPLATES
- "I Closed My Book to Be Here" -- example
  - Can be transformed to: "I stopped Reading to be Here"
  - Now you can push out to: "I stopped cooking to be here", "I stopped Baking to be here"
- "Id rather be reading" -> "id rather be surfing"
- "Coffee and books" -> "expresso and books"
- GET CHATGPT TO COME UP WITH SAYINGS
  - "Give me a few trademark free sayings I can use for my POD sweatshirt targeting books/readers"

TRADEMARK CHECK
- Do it at this stage
- https://tmsearch.uspto.gov/search/search-information
- Need to do first otherwise all subsequent work is wasted
- "I'd Rather Be" -- when trademarked, the actual phrase may not be trademarked, just variations
  - Therefore you can use variations too
- Once checked: put into Canva whiteboard

STRATEGY AT THE START
- Go general -> then niche down
- E.g. Find what is selling using calendar, Everbee, best sellers
- Sell in those niches (8-15 designs)
- Then whatever gets favourites/sales -> double down -> niche down in that area

CASSIY APPROACH
- Find 10 Etsy stores that are doing well
- Do different niches and types of stores -- old and new
- Find why they have best sellers (e.g. gifts)
- Find best mockups: flat lay, model, colours, shirt in main photo
- Can take designs from mugs
- Use best seller from irrelevant season (e.g. Easter) and make Christmas version of it
- Sarcastic best seller -> do Christmas version -- FILLING GAP
- Use colour palette from other stores t-shirt

TREND REPORTS (from Cassiy) -- TAKE ACTION
Sell in niches that sell and add value

HOW TO FIND TRENDS
Step 1: Find best sellers (avoid using ads)
- Click on product -- how many in basket
- Sold 23 times in 24 hours shows it is hot -- use even if a mug -- anything above 5 in 24 hours

Step 2: Sort by newest (top right)
- Great way to find new listings that are selling
- Go to individual pages and check -- this is a goldmine

Step 3: Search broad at start (e.g. shirt or png)
- Best seller filter
- Look for things that stand out: graphics and sayings
- Easter doing well -> search -> look at god shirts
  - "He has risen" -> go with it

Step 4: Stores
- Find product and go to store -- if a big one
- Sort products by most recent
- Add unique designs (should be 100% different to original -- not 60%)
- Go through reviews -- most recent -- what is selling

BIGGEST NICHES -- START WITH THESE
1. Holidays -- Christmas
2. Professions
3. Bachelorettes

SELL WHAT IS SELLING NOW
How to do it:
- Go to Etsy and search "shirt", "mug" -- something generic
- Look for: Star Seller -> Best Seller badge, 5 people bought in last 24 hours, 20+ in baskets
Method two:
- Generic Etsy search then sort by newest on right
- See which ones have sold or in baskets
- Takes longer but is good

EVERBEE PRO TIP
- Use product analytics
- Search "shirt"
- Newbie mistake: sort by sales
- Pro tip: go through full database in Everbee and sort by:
  - Listing type: physical
  - Shops less than 24 months old
  - Listings less than 3 months old
- Finds great products -- POWERFUL
- When find winning listing: make 10-15 versions of design (don't copy exactly)
- ADD VALUE

WAYS TO GET IDEAS
- Wholesale Ted (cross method)
- Alek course
- Cassiy
- Card company: https://www.moonpig.com/uk/
- Amazon (autocomplete)
- ChatGPT: provide list of hobbies/activities -> take one -> put into Etsy search -> find volume and best sellers
  - Need low amount of listings and high volume (less than 50,000 listings) -- check listing view
  - If too many listings: niche down
- Etsy itself: get in habit of browsing every day
  - What is in demand, what are people buying, what does a good design look like
  - Go into niches you have no interest in -- bring them into your niches
  - Clues: 6 views in last 24 hours, in 10 carts, in 20+ carts
- Pinterest for ideas

THIRD PARTY TOOLS
- Everyone uses Everbee
- Also use Alura

CHATGPT FOR NICHES
- Professions is a good one for spring
- Ask ChatGPT for professions
- Take further by asking about niche within niche (e.g. types of teachers and nurses)
- Now have list -> on Etsy type [NICHE] Shirt
  - Look at best-selling designs (Star Seller, find templatable saying where can swap fundamental word)
  - Simple text-only designs with 2 different fonts
    - One blocky font -> look on Creative Fabrica for FONT DUOS

USE GOOGLE SHEETS TO UPLOAD VARIATION AND USE DATA IN CANVA

LOOK FOR THE GAPS IN THE MARKET
- Listing view: make sure keywords have good views and small amount of listings
- Check recommended ones which competitors aren't using
- 6000 listings to $1 million is possible

DOUBLE DOWN ON WHAT IS WORKING
- If not getting sales: monitor what is getting the most favourites -> focus on that
- It might be a design style -> apply to another niche
- If you don't [double down] -- someone else will. They will copy it, put it on sweatshirt, on different colours, and have 3x the sales.

TYPES OF PRINT ON DEMAND
- Evergreen Niches: do well all year round
- Trend niches: holidays, Halloween, Christmas
- Put 70% of time into evergreen niches and 30% into holidays

LOOK FOR IDEAS SELLING AND LISTING AGE IS LOW (less than a year)
- E.g. Revenue above $1000 + listing age below 300 days + lots of views`,
  },
  {
    id: 'sop-design',
    title: 'Design SOP',
    content: `DESIGN SOP

OVERVIEW
Not designing for yourself -- designing for Etsy shoppers.
Study what sells before designing anything.
10 minutes a day on Etsy -- take inspiration from best sellers.

TOOLS
Canva, Kittl, Adobe, Printify, Midjourney, ChatGPT, Playground AI, Creative Fabrica

DESIGN PRINCIPLES
- Is text to the left?
- Is graphic silhouette in the middle?
- How much text?
- Proven design styles on Etsy -- study them
- How many lines for phrase? "The longer the saying, the taller the font" (Alek)

USE GRAPHIC FROM CANVA AND PUT IN DESIGN
- Use as colour palette for words/text

MAKE THE DESIGN DISTRESSED
- Add distressed overlay -- search "distressed grunge text" on Creative Fabrica

DOWNLOAD EXPORT REQUIREMENTS
- Must be transparent background
- Fit dimensions of Printify product (e.g. Bella + Canvas 3001 = 4500px by 5100px)
- Convert Graphics to SVG to scale better
- Remember to name each file prior
- In Canva: go to grid view (icon in bottom right) and easy to update all names

AUTOMATE DESIGN
- Shop making $16k/month had 700 listings
- 12 per day in new shop
- Reassemble into design templates

SIMPLY POD METHOD
- Make notes on designs
  - What colours, what mockups
  - Screenshot the hell out of it and put on Canva whiteboard
  - INCLUDE: other products in niche for inspiration
- PRO TIP: Include products and designs from DIFFERENT niches that are connected
  - E.g. 30th birthday might be connected to bachelorette shirts or women's trendy shirts
  - Search these and add top designs to your board
  - Use as inspiration -- THIS IS GREAT (providing value in niche that may not have this design)
  - Always check these cross-niche designs have demand (e.g. in 18 carts)
- Copy title and tags for later
- Always ask if can templatise any designs -> add to main template design database in Canva
- Group together screenshots by design/similarity to get broad understanding of demand
  - Look at colours, mockups, group options, fonts, simplicity vs graphics
- In Canva: use screenshots for colour palettes
- Font DUO technique
- Add outlines -- white -- mess about with it
- Do inverse
- Use background in Canva same as mockups

ALEK DESIGNING HACKING
"Quantity over Quality always leads to Quality in the Long Run"
Start with Most Important Elements First

FONTS
- Canva gives lots of free fonts and premium
- If can't find it: use Font Matcherator
- Use Creative Fabrica and upload to Canva
- Use the Type Warp App in Canva
- Once you have fonts proven to work: go on to colours

SHOULD HAVE CHECKED LEGAL STATUS BY NOW

COLOURS
- Must use colours of existing successful designs
- Create rectangle then use eyedropper tool in Canva

GRAPHICS -- "Is What Separates You from the Others"
3 ways:
1. FreePik/Canva -- use their graphics but must be used with others (too much effort)
2. Premade Designs -- Etsy doesn't allow you to sell exact same design
3. BEST WAY -- USE AI -- MIDJOURNEY
   - Can use clipart or even paintings
   - alpha.midjourney.com -- see what others are doing -- THIS IS AMAZING
     - E.g. rustic stacked book graphic on white background
     - Click image at the bottom -- references it
   - Create button
   - Play about with this
   - Personalisation tab: rank images with profile -- learns about it
   - You can make the artwork fit your designs -- use print size area -- THIS IS A GREAT TIP
   - ALWAYS UPSCALE AT THE END FOR THE BEST QUALITY IMAGE
   - Put into print on demand:
     - Right click -> Copy -> Paste upscaled image into Canva
       - Use Canva background remover tool
     - If lots of colours in image:
       - Use Tracer App
         - Vectorise the image -> SVG
         - Change the colours

PUTTING IT ALL TOGETHER
- Get graphic of books
- Take saying: "I closed my book to be here"
- Change font to one that worked elsewhere
- Add arch effect to text
- Copy design and add new saying
- Even make just the sayings as the design also
- Use font from one, format from another, colours from another to make original design

WAIT THERE IS MORE
- Change the graphic -> get 5 new designs (this is just for ONE)
- Can even change phrase -- template
  - Look at step one when asking ChatGPT for ideas
  - Can now add them to this

KEEP MAKING GREAT TEMPLATES
- When have 100 templates -- make lots in minutes
- Also done the legal check

PROPERLY SIZE DESIGNS -- use dimensions in Canva
- Add first design
- Then duplicate and can change name

DUPLICATE THE FILE TO MAKE WHITE VERSION
Put all designs in document -- give name so organised

EXPORT WITH TRANSPARENT BACKGROUND

***** TO GET TO 7 FIGURES NEED TO LOCKDOWN THIS PROCESS *****
- Need to upload quickly: use Prelist
- Put keywords in title -- Prelist makes them unique -- better than Canva to separate

Every design: make 8-15 variations`,
  },
  {
    id: 'sop-uploading',
    title: 'Uploading SOP',
    content: `UPLOADING SOP

TOOLS
- Prelist -> Printify (primary bulk upload tool)
- Vela (listing management and bulk editing)
- Google Drive (file storage and notifications)
- CU Online: use SwiftPOD or Monster with Standard Shipping

MANDY SIMPLY POD METHOD
(refer to Simply POD resources for full walkthrough)

UPLOAD TO PRINTIFY

PRELIST UPLOADER
- Connect Shop: make sure using CORRECT shop
- Find template: list of templates here
- Upload black AND white designs: make sure same name
- Keywords: Prelist will scramble titles to provide unique names
  - These will be changed later but mean Printify has unique names (good)
- Products will still be hidden at this stage -- necessary while adding mockups

GOOGLE DRIVE
- Add designs to Google Drive
- Notify everyone on Notion and Slack

WHEN UPLOADING
- Hide in store is SET (products hidden)
- New listings get a boost at beginning -- so need to get mockups and everything STRAIGHT AWAY

VARIANT VISIBILITY
- Show all variants
- If sold out: show second option -- show out of stock

SYNC PRODUCT DETAILS
- Leave tags CHECKED
- NOT mockups (uncheck mockups)

USE TEMPLATES IN PRINTIFY -- copy listings

CHECK RESOLUTION OF DESIGN IN PRINTIFY -- SHOULD BE ABOVE 300 DPI

PERSONALISATION
"Please specify the phrase for each shirt along with a name personalisation if needed"
Example:
- Saddlin Up - no name
- Ridin Shotgun - name: Amy
- Reach out to us directly for any additional requests

MANAGE VARIATIONS
- Use Vela
- Linking colours

PUBLISHING CHECKLIST (From Alek)
From Alura or Etsy:
[ ] Best non-ad listings found
[ ] Title
[ ] Tags

Vela:
[ ] Refresh
[ ] Select Products
[ ] Edit Listings
[ ] Shipping Profile -> Apply
[ ] Section -> Apply
[ ] Tags -> Apply
[ ] Delete Old Mockups (Optional)
[ ] Listing Info Cards -> Apply
[ ] Mockups added
[ ] Titles Edits (Revisions)
[ ] Tags Edits (Revisions)
[ ] Sync Updates`,
  },
  {
    id: 'sop-marketing',
    title: 'Marketing SOP',
    content: `MARKETING SOP

FUNDAMENTAL PRINCIPLE
"Let the customer/market decide if you have a valuable design -- NOT YOU"

ALEK COURSE -- KEYWORD STRATEGY

KEYWORD HIERARCHY
- Primary Keywords: convey main idea and context ("this mug is for accountants")
- Secondary Keywords: convey additional ideas and unique positions
  - "Drinkware for financial professionals"
  - "Funny gifts for accountants"
  - "Funny spreadsheet saying mug"
  - In secondary keywords can get more specific: "Christmas gift for accountant", "Tax season gift"

PLACEMENT RULES
- PUT SECONDARY KEYWORDS IN TITLES AND SHORT TAIL KEYWORDS IN TAGS (must be short)
- PUT SHORT TAIL HIGH IMPACT KEYWORDS IN DESCRIPTIONS (soft, premium, true to size -- short tail and high volume)
- Then use primary and secondary keywords (short tail and long tail) in titles OR tags

EXAMPLE TITLE STRUCTURE
- Set category and attributes (gift for easter etc.)
- Above listing has a number of primary keywords and short tail in titles and tags
- BUT mostly focused on secondary long tail keywords
  - This is because secondary long tail will hit short term but are more specific
- THEREFORE FOCUS ON SECONDARY KEYWORDS
  - Short tail in tags
  - Long tails in title section

TAKE YOUR MAIN IDEA AND REDUCE WITH DETAIL AND MODIFIERS -- these are secondary keywords
- Accountant -> CPA -> Financial Analyst -> Auditor
- Product type (mug) -> Gift -> Occasion (Tax season) -> Team/Group shirts

To rank on first page of broad search you must be ranking on specific search first
Don't put "funny mug" -- too broad -- customers won't buy on first search anyway
RICHES IN THE NICHES -- niche down and will grow quickly

SHIPPING
- Don't do a shipping guarantee
- Always refund if someone complains

CONVERSION
- Most people get 3-4% conversion
- Cassiy gets 8% -- why?
  - Great SEO: targeted
  - Great mockup image
  - Great price: low at start
  - Personalised: has higher conversion -- use Hello Custom

CU ONLINE SPECIFIC GUIDELINES
- No text in main photo
- Clear view of design
- Use all 10 available image slots (different views, info, colours -- all mockups different colours)
- Height and width of mocks: 2000px minimum
- Most descriptive part at start of title (what people type in search bar -- IMPORTANT)
- No keyword stuffing
- Shipping price less than $6
- Don't go too low with price -- attract difficult customers who complain
- Accurate production times: 1-6 business days

DESCRIPTION
- Don't do giant block text -- spread out with bullet points -- ask ChatGPT
- Rest of description is generic but top MUST be inventive
- ChatGPT: "Using these keywords write a 200 character description for my sweatshirt that goes at the top of an Etsy description"
- Sentence at start of description MUST use keyword
- Listing attributes -- huge: size, sustainability, neckline, occasion, holiday -- all important

LISTING MISTAKE
- Putting video of something else rather than design
- Listing video NEEDS to be of design -- not size chart -- not size chart videos
- People haven't decided if they'll buy -- need to see the actual design

SECOND MISTAKE
- FACT: 90% of sales are of the colour your first main mockup is -- narrow colours down to 7

3RD MISTAKE
- No mockup for each colour -- need to do this -- people need to visualise

4TH MISTAKE
- Mockups unrealistic

TAGS
- Must do all 13
- Must include Google-type phrases: e.g. "mama gift", "custom mum gift"
- Get customers to tag you on Instagram or Pinterest
- Search all tags volume: look for mix of high competition/high volume AND low competition/low volume AND low competition/high volume
- Don't use broad terms like "gift for him" -- do "Christian sweatshirt"

ALL CONCERNS A BUYER HAS MUST BE ADDRESSED FROM LISTING PHOTOS
- E.g. guarantee
- Also put in description or around listing: "guarantee or your money back"

ADDRESSING BUYER CONCERNS
When starting out, address buyers concerns:
- Example concerns: "Will This Sweatshirt be scratchy?", "Will the Print Fade?", "Will it Fit Me?", "Will This Be High Quality?"
- Use ChatGPT: "I sell sweatshirts on Etsy, what possible concerns, doubts or questions may make someone hesitate from buying?"
- Address biggest problems via descriptions:
  - "Will it Fit?" -> Put "Runs true to size" in description
  - Highlight
- Need size and fit guides
- Different mockup style

MOCKUPS
- NO AI MOCKUPS -- Absolute Must
- If apparel: use Etsy mockups -- buy bundles
  - "Mocks by Little Feather" is a great shop
  - Buy shop bundle if possible
- Mockups should be 2700px width by 2200px height (almost 4:3 ratio -- crops nicely on Etsy)
- If mockup is vertical: need to adjust it
- Create a mockup template on Canva (don't use for designs -- create copy)
  - Put all Comfort Colors on one document grouped by colours
  - From here add all additions: size charts, coupon codes, colour charts, social media
- Only give 6-7 colour options
  - Need to have mockup for each option (higher conversion)
  - Listing photo matches colour (when buyer selects colour it switches on Etsy)
  - Don't want to give overload of choice
  - Comfort Colours top performers: Moss, Ivory, Espresso, Orca, Violet, Pepper, Pink
  - Copy bestsellers
- Select colours based on design (does design fit on each colour?)
- Select mockups that suit:
  - Flat lays: tend to work for closeup with words
  - If just image: can use normal mockups
  - If dark colours on design: just use light mockups
  - NO MORE THAN 10 PAGES IN MOCKUP BATCH (only 10 photo spots in Etsy)
- When placing image: make sure it's transparent (85%, or 70% for black shirts)
- Create two separate listings: one for light colours, one for dark colours
- Prioritise mockups over info cards

SOCIAL PROOF
- Need good reviews
- Put reviews in image cards
- Do for shipping, quality + everything
- If no social proof for brand new store:
  - Money Back Guarantees in 7 days if not happy
  - Offer exchange and refund policy (can lose money and time but WILL get sales)

GUARANTEE (must add to listing images -- improves conversion)
CU ONLINE EXAMPLE GUARANTEE:
"Only the finest, certified precious metals
Say no to tarnish, scratches and fade outs
No green blemishes or marks on skin
Offering 100% waterproof jewellery"

Andreas example:
"If you are unhappy for any reason, you can contact us within 7 to 14 days of delivery and get either a replacement or a refund"
(put this text in mockup images)

Make guarantee short, concise, and with low number of prerequisites.

DESCRIPTIONS
- Example from CU Online: most important concerns at the top, must address all concerns
- If anything happens for any reason, contact within 7-14 days for refund or replacement
- Check description examples from Simply POD (link in Notion)
- "This can 4x Sales"

PROVEN THUMBNAIL PROCESS (Andreas)
Step 1: Etsy search "sweatshirt"
Step 2: Filter: best sellers, US delivery, physical product
Step 3: Find patterns -- which thumbnails used more than once
Step 4: Find different shops using same thumbnail AND getting best sellers (great indication)
Step 5: Find the actual mockup -- buy it -- THIS NEEDS TO BE MAIN THUMBNAIL

LOWER THE OPACITY SO MORE REAL -- important

ANDREAS CORE OFFER (start with these 3)
1. Proven Thumbnail
2. Guarantee
3. Size Chart
Bonus: Add video mockups, also add different colour mockups

SIZE CHARTS
- Buy from Etsy (e.g. Gildan 8000 size charts)

HOW TO ORDER INSTRUCTIONS (Andreas swears by this)
- Consists of colour charts and text on image on how to order
- Like this but make design better

EXPRESS DELIVERY
- This is a deal maker
- Faster someone can get it the better
- Express Delivery at checkout -- put in mockups

VIDEO MOCKUPS
- Andreas recommends Placeit

COLOUR CHART
- If possible: put design on each of the mockup in colour chart
- THIS IS REALLY IMPORTANT: if doesn't work then will lose customers
- IF can't do this -- don't put colour chart in

LISTING MOCKUPS
- Make sure first mockup on listing is easy to read and stands out (e.g. espresso)
- Do this as a check in workflow

IMAGE FOR SOCIAL PROOF
- In mockups use one image for social proof (shop reviews) -- powerful
- Can put on other mockups if not enough room

TITLES
- Type in keyword you want to rank for -> find best sellers
- Look at titles they are using and copy them
- Do keyword analysis in Listing View or 3rd party
  - Add related keywords
  - Using keywords will get into rank to search

TYPES OF PRODUCT
- Put all designs on 3 products: Bella + Canvas, Comfort Colours and Sweatshirt

INFO CARDS
- Guarantees + reviews

MOCKUPS FOR CLICKTHROUGH
- Titles to rank
- But if no one buys: product will go down

GEORGE McCONNEL TITLES AND TAGS
- Etsy have said tags should be like you are searching it in Google: e.g. "Mama shirt", "Gifts for Mom"
- McConnel takes this further: use autocomplete in Amazon for great tag ideas with real buyer-intent keywords
  - E.g. "necklace" -> "necklace for wife" -> "white gold necklace for wife" -> "Gold necklace from daughter"
    -> Led to: from dad, from mom, in law, dainty gold necklace
- Where to place keywords in Etsy listings:
  - First 30 characters of title is HUGE -- must have top keywords
  - Most titles: "Gold Necklace for Wife" (too broad) -- should be "Elegant 18 Inch Gold Necklace" (luxury, details, size)
- Tags:
  - Don't throw everything together
  - Must use all 13 tags
  - Instead of "necklace for wife" -> use "gold necklace chain" AND "necklace for wife" (two separate tags)
- ATTRIBUTES:
  - Etsy lets you use attributes but most sellers skip -- BIG MISTAKE
  - Etsy priorities listings with complete and accurate attributes
  - ONE OF BIGGEST FACTORS OF SEO
  - PRO TIP: if use this wisely can save you in tags
    - E.g. "blue t-shirt" tag -- put "blue" in attributes and frees up that tag slot

Important marketing principle: momentum through posting product listings and optimised keywords again and again -- stays in algorithm and does well there

MOCKIFY / SIMPLY LISTED
- Use Simply Listed for mockups

VELA WORKFLOW
- Add info cards (all should be mockups + one size guide -- copy Mandy)
- Add video
- Add titles
- Add tags
- Add SECTIONS
- Publish

THUMBNAIL
- Adjust thumbnail in Vela
- Zoom in a bit more to copy competitor listings
- But not too much (Etsy also zooms in) -- make a measurement

SIMPLY POD TAGS AND TITLES METHOD
- E.g. retro, certain colour, travel destination
- Recipient = who selling to + utility
- Don't need to timeblock this -- have words from research -- don't OVERCOMPLICATE

Use ERank to get core anchor keywords -- fill in the rest with this method
- Don't overcomplicate with analysis paralysis

CHOOSE LISTING TITLE
- Keywords and long-tail phrases -- most relevant first
- Separate by commas -- easier to read
- Use keywords from research AS IS
- When working in batches: use similar keywords from ERank, adjust around them for each design
- Each keyword must have VOLUME and be what people actually search for (CHECK ERANK)
- Don't use broad -- maybe one or two but niche-down words must dominate
- Don't add unrelated gibberish -- BUT add related keywords to show up in other related searches

DESCRIPTION
- Only need a couple of sentences -- don't need too much
- Ask ChatGPT to write description using keywords: 200 characters
- Add product specs (minimise the Printify stuff)
- Leave in care instructions
- Add in Listing Description template

TAGS
- Specific keywords in tags
- Even if repeat from title
- MUST USE ALL 13
- No single words, don't repeat a lot
- Similar: e.g. doing a 30th birthday shirt -> put "in my thirties era", "girl weekend outfits"
- "Comfort colours shirts" is a good tag
- Make sure tags aren't too long

PERSONALISATION
- Uploading: Pepper is very in demand Comfort Colors mockup -- put first
- Duplicate listing for light colours and darker colours (listings should not be the same)
- Never make personalisation optional

MANAGE VARIATIONS
- Choose the photo to show when customer clicks colour
- This helps conversion a lot (Mandy does this)
- Select how to do this in Vela

COMFORT COLOURS STACK (best colours)
- Bay, Berry, Blue Jean, Ivory, Moss, Orchid, Pepper, Violet, Expresso
- Get mockups for all these in Comfort Colors then set up variation photos

DETAILS SECTION
- Need to fill in who made it: "another company and person"
- What is it? A finished product
- Identify production partner: SwiftPOD or Monster

CATEGORY
- Double check category is correct

SHOP SECTION
- Need to add these -- IMPORTANT
- Add in one: make it a keyword
- E.g. "30th Birthday Gifts"

FEATURED LISTING
- Only four show at a time -- these are off by default
- Select best performers to feature

ADS
- Run ads on new items to get data

RENEWALS
- Renewal options: don't give up
- Just change out mocks and do it better -- see if it works
- It gets a boost after changes`,
  },
  {
    id: 'sop-customer-service',
    title: 'Customer Service SOP',
    content: `CUSTOMER SERVICE SOP

FUNDAMENTAL APPROACH
- Make sure you have returns turned ON
- Use AI to craft professional responses to difficult customers
- Accept returns on ANY basis -- make sure to cancel order after in case of bad review
- Make sure returns are on

HANDLING RETURNS
- To accept return: Andreas asks for picture of shipping label + receipt + parcel
- Use return address from print partner

HANDLING EXCHANGES
- Make sure don't lose money on this
- Charge a replacement fee of $10

CU ONLINE CUSTOMER SERVICE
- If haven't complained: good chance customer will leave good review -- contact them to leave a review
  - Don't TELL them to leave a good one
- If bad review: message them
- REVIEWS ARE HUGE

DO A SET OF Q&A THAT ANSWER POTENTIAL QUESTIONS
- Ask ChatGPT: "What potential customers need to know to make a sale?"
- Include: Sizing, fit description, material, wash care, production times

CANNED MESSAGES (Templates)
- "We ship most orders within 1-3 days, US transit: 1-6 days. We do not guarantee delivery times."
- "Hi [name]! I saw your order was delivered -- I hope you love it! Would you be able to leave us a review? Reviews are extremely important and would help our small business immensely. Thank you!"
- "So sorry to hear about this! Please send us a photo and we'll get this sorted right away."

WHAT NOT TO DO
- Never argue over shipping delays
- Never deny a refund on a quality issue (Printify will cover it)
- Never ignore negative reviews
- Never leave a bad review unanswered`,
  },
  {
    id: 'sop-shop-admin',
    title: 'Shop Administration SOP',
    content: `SHOP ADMINISTRATION SOP

INITIAL SETUP (Andreas)

VAT / TAX
- Put in VAT -- need to do
- If just want to sell to US: put US only in shipping profile

RETURNS + EXCHANGES
- Create policy: set returns
- Returns are a loss -- ask customer to send to address on package
- Ask for picture of product for confirmation -> Printify can refund
- Exchanges:
  - Need to break even
  - Charge a fee of $10-12 -- work it out so making some money

SET UP PRODUCTION PARTNERS
- Manager -> Settings -> Partners -> Add
- Fill in all required information

SHOP OPTIONS (Settings)
- No gift wrapping
- No gift notes option (unless you offer this)
- HIDE SOLD LISTINGS (important -- hides sales from competitors)
- Keep native currency (bank will charge you for conversion)

THINGS TO IMPLEMENT ON THE WAY UP
- Canned messages (templated/saved responses for talking to people in chat)
  - Customer service is the worst part -- get this sorted
  - Makes responses look professional
  - Will get difficult customers -- templates help respond without stress
  - E.g. "We ship most orders out within 1-3 days and depending on the destination for US orders it takes 1-6 days in transit. However, we do not guarantee delivery times!"

CU ONLINE RECOMMENDATIONS

Shop Policies:
- Need to offer refund and exchange
- Use templates
- Only offer this at beginning trying to get trust and a sale

About Page:
- Full complete profile with photos, story, members, personal story + blurb
- Otherwise Etsy doesn't see as complete

Shop Title:
- Tell people what you sell -- so many shops don't
- Huge missed opportunity for SEO and conversion

SOCIAL MEDIA
- Start social media accounts: Pinterest + Instagram is a must
- Ask people to follow on these
- Link both in "Around the Web" section on Etsy profile`,
  },
  {
    id: 'sop-printify',
    title: 'Printify SOP',
    content: `PRINTIFY SOP

SIMPLY POD SETUP -- COMFORT COLORS IN PRINTIFY

Step 1: Choose Provider Manually
- SwiftPOD or Monster Digital ONLY
- Do NOT use order routing

Step 2: Select Variants
- White, Ivory, Bay, Orchid, Violet, Blossom, Blue Jean
- Select based on which colours the design works on

Step 3: Upload Design
- Position correctly on product
- Save product

Step 4: Remove All Mockups
- Get rid of all mockups -- just press save selection
- Use AI: confirm
- Will add own mockups via Vela/Simply Listed

Step 5: Personalisation
- Add personalisation option here if applicable

SHIPPING PROFILES
- Use Standard profile
- Simply POD template: SwiftPOD with t-shirts = 2-6 days
- Do NOT create a new shipping profile for each product
- Use existing standard profile only

PRICING
- Target 57% profit margin WITH Printify Premium
- Target 45% profit margin WITHOUT Printify Premium
- In Printify: Select all -> Edit Profit -> Profit Margin 57%
- Retail price at 57% margin = approximately $35 USD
- Note: 57% is not REAL profit when RUNNING SALES -- factor this in

USE CODE "cuonline" FOR FREE MONTH OF PRINTIFY PREMIUM

PRINTIFY PREMIUM
- Worth it above $145/month in sales
- Past $145/month you are saving money with Premium
- Lowers base cost significantly, increasing your actual margin`,
  },
  {
    id: 'sop-analytics',
    title: 'Etsy Analytics SOP',
    content: `ETSY ANALYTICS SOP

CONVERSION BENCHMARKS
- Most shops: 1-3% conversion rate
- Good benchmark: 3-4%
- Cassiy achieves: 8% (excellent SEO + mockups + price + personalisation)
- Andreas achieves: 5-6% (proven thumbnails)

KEY METRICS TO TRACK
- Views: how many people saw listing in search results
- Click-through rate: views -> listing page visits
- Conversion rate: visitors who purchase (industry average 1-3%)
- Revenue per listing: identify best performers
- Favourites: interest without purchase (indicates design or price issue)
- Reviews: accumulation over time
- Star Seller metrics: response rate, ship-by-date adherence, review score

ANALYSING PERFORMANCE
- Look at listings in LAST YEAR with high sales (not just all-time)
- High revenue + listing age under 300 days = currently trending
- Look for: revenue above $1000 + listing age below 300 days + lots of views

WHAT METRICS MEAN
- Getting views but no favourites: thumbnail is being seen but not appealing -> change thumbnail
- Getting favourites but no purchases: price or description/trust issue -> check price and listing quality
- Getting views but no clicks: title is showing but not enticing a click -> improve title
- Not getting views at all: SEO/keyword problem -> update title/tags/attributes
- Low conversion vs high views: mockup or price issue -> test new mockup, adjust pricing

THIRD-PARTY ANALYTICS TOOLS
- Everbee: most popular (product analytics, shop spy)
- Alura: good alternative
- ERank: keyword research + listing analysis
- ListingView (Alek): checking search volume vs competition

USING EVERBEE EFFECTIVELY
- Product Analytics: search broad term ("shirt")
- Pro tip: go through FULL database, sort by:
  - Listing type: physical
  - Shops younger than 24 months
  - Listings younger than 3 months old
- Finds great performing new products -- VERY POWERFUL
- When you find a winning listing: make 10-15 variations -> add value

LOOK FOR LISTINGS IN THE LAST YEAR THAT ARE SELLING WELL (not old listings)
Go to 3rd party tool -> look at top shops or top listings -> look for listings with over 100 sales in last year`,
  },
]

// ============================================================
// SECTION MAP
// ============================================================
export type SectionKey = 'framework' | 'checklists' | 'sops'

export const SECTIONS: Record<SectionKey, { title: string; color: string; pages: KBPage[] }> = {
  framework: { title: 'Etsy Workflow Framework', color: '#60a5fa', pages: FRAMEWORK_PAGES },
  checklists: { title: 'Checklists', color: '#f97316', pages: CHECKLISTS_PAGES },
  sops: { title: 'Etsy SOPs', color: '#ffb800', pages: SOPS_PAGES },
}
