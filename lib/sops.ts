// ============================================================
// lib/sops.ts — Shared Production SOP data
// Single source of truth for the step-by-step SOP checklists, used by:
//   - app/youtube/page.tsx        (Channel Hub → SOPs tab, browsable reference)
//   - app/content-focus/[id]/...  (YouTube-Pipeline-driven focus session)
//
// Groups: 'setup' runs once (new channel / channel-wide), 'production' runs
// every single video and is numbered to match the Content Pipeline stages
// in app/content/page.tsx 1-for-1 (see STAGE_TO_SOP below).
// ============================================================

export type SOP = { id: string; icon: string; title: string; tagline: string; steps: string[]; stepMins?: number[]; group: 'setup' | 'production' }

// Default minutes assumed for a step when a SOP has no stepMins array, or
// the array is shorter than steps (defensive fallback -- keeps the focus
// session's chunk-time math sane even if a SOP gets edited later without
// updating its estimates).
export const DEFAULT_STEP_MINS = 10

export const SOPS: SOP[] = [
  {
    id:'00a', icon:'&#129517;', title:'Niche Selector', group:'setup',
    tagline:'One-time, before your first video (or when pivoting). Shane Hummus&apos;s Niche 2.0 / Hybrid Personal Brand method &mdash; locks a niche hypothesis that can actually make money.',
    steps:[
      '<strong>Skill option:</strong> use the cge-niche-validator skill in a Claude Cowork session for the full guided 2-batch interview. It will push back if your idea can&apos;t monetise &mdash; trust that feedback rather than talking yourself past it.',
      '<strong>Manual Batch 1 &mdash; who you are:</strong> What are you good at? What would others say you are good at? What is your background &mdash; jobs, industries, skills, experience? What do you genuinely enjoy or learn about for fun?',
      '<strong>Manual Batch 2 &mdash; your edge and goals:</strong> What do you wish you had known 3&ndash;10 years ago that you could teach now? How much time per week can you realistically commit? Do you want your own product (course, coaching) or just ads and affiliates?',
      '<strong>Write the niche hypothesis:</strong> &ldquo;I help [SPECIFIC PERSON] do [SPECIFIC OUTCOME] by [METHOD].&rdquo; X must be specific &mdash; never &ldquo;everyone&rdquo; or &ldquo;anyone interested in X.&rdquo; Y must be a felt outcome the person wants, not a topic label.',
      '<strong>Money tier check</strong> &mdash; know which tier you&apos;re in and go in with eyes open if it&apos;s Tier 3: Tier 1 (highest earning) &mdash; finance, business, software/AI, careers, marketing. Tier 2 (solid) &mdash; education, self-improvement, automotive, real estate, health/fitness. Tier 3 (high views, hard money) &mdash; gaming, vlogs, generic entertainment.',
      '<strong>Monetisation path:</strong> pick 1&ndash;2 beyond AdSense alone &mdash; affiliate, low/mid/high-ticket offer, or a lead magnet. AdSense-only realistically only works in high-RPM niches (Tier 1).',
      '<strong>Funnel fit check:</strong> does this niche naturally support the full content funnel &mdash; Listicle &rarr; How to &rarr; Case study &rarr; Testimonial/interview &rarr; Offer &mdash; or does it dead-end after top-of-funnel content?',
      '<strong>Background and longevity fit:</strong> does this credibly fit your real background? Would you still want to be making this content in two years? A profitable niche you resent making videos for will not survive contact with month six.',
      '<strong>Lock it:</strong> copy the winning hypothesis into your Strategy file (see the Voice, Strategy &amp; Money Files SOP). Don&apos;t revisit the niche decision on a single bad week &mdash; only reconsider if 10+ videos in show the audience genuinely isn&apos;t there.',
    ],
  },
  {
    id:'00', icon:'&#128293;', title:'Channel Warm-Up', group:'setup',
    tagline:'Never upload to a cold account. Spend 5 days building a real human profile first. Run once, before your first-ever upload.',
    steps:[
      '<strong>Days 1&ndash;3 (repeat daily):</strong> Watch 30 minutes of content in your niche, like a handful of videos per session, leave 2&ndash;3 genuine comments, and subscribe to 3&ndash;5 channels in your niche.',
      '<strong>Why this works:</strong> YouTube&apos;s algorithm is learning what this account cares about before you upload anything. You are building the profile of a real, engaged human. Most people create an account and upload 10 minutes later &mdash; the algorithm has no context and flags it as potential spam. This removes that risk.',
      '<strong>Day 4:</strong> Upload your banner and logo, set your channel name, and write the channel description. The channel should look like a real, intentional presence before a single video appears on it. (Cross-reference: this overlaps with the one-time &ldquo;Channel Creation&rdquo; checklist on the Checklists tab &mdash; do both together.)',
      '<strong>Day 5:</strong> Upload your first video. You are now uploading into a warmed account with niche context &mdash; not a blank slate the algorithm is suspicious of.',
      '<strong>Make the first video count:</strong> The algorithm gives new channels a genuine push on early uploads &mdash; your first video gets a real shot at reaching people outside your subscribers. Publishing without planning used to be fine when channels needed 25&ndash;50 videos to find their niche. That is no longer true. Wasting the first upload on an unplanned video is the single biggest mistake a new channel makes. Run the full production SOP sequence below (01&ndash;10) before Day 5.',
    ],
  },
  {
    id:'00b', icon:'&#128211;', title:'Voice, Strategy & Money Files', group:'setup',
    tagline:'One-time: five reference files that keep every AI-assisted script, title and hook consistently in your voice. Run once, update as you learn.',
    steps:[
      '<strong>Writing Rules file:</strong> catches AI tells before you see them. Rules: contractions everywhere, numbers always numeric ($12,000 not &ldquo;twelve thousand&rdquo;), no year stamps, complete sentences, vary sentence length, 5th grade reading level. Banned phrases: &ldquo;Here&apos;s the thing&rdquo;, &ldquo;At the end of the day&rdquo;, &ldquo;Game-changer&rdquo;, &ldquo;Let me break this down&rdquo;, &ldquo;Something magical happens&rdquo;, &ldquo;What if I told you&rdquo;, rhetorical questions, question fragments. Add to it every time Claude sounds wrong.',
      '<strong>Voice Profile file:</strong> your background in 2&ndash;3 sentences, 3&ndash;5 beliefs about your topic that most people get wrong (your contrarian angles), your tone/energy on camera, and the 3 stories or analogies you naturally reach for.',
      '<strong>Strategy file:</strong> your niche hypothesis (&ldquo;I help [X] do [Y] by [METHOD]&rdquo;), your monetisation path (AdSense alone only works in high-RPM niches &mdash; otherwise pick 1&ndash;2 of affiliate / low-mid-high ticket offer), and your content funnel order: Listicle &rarr; How to &rarr; Case study &rarr; Testimonial &rarr; Offer.',
      '<strong>Guidelines file:</strong> what topics are in and out of scope, your minimum quality bar, your sustainable upload cadence (the pace you can hold for 6 months, not your best week), and one sentence describing what your channel is <em>not</em>.',
      '<strong>Money file:</strong> every offer, price and link in one place &mdash; primary offer, lead magnet, affiliate links with commission %, AdSense RPM estimate, and your tracked (short.io) URL for each. Never hunt for a link again &mdash; always pull from this file.',
      '<strong>System Map rule:</strong> paste this at the start of every Claude session where you write scripts, titles or hooks &mdash; &ldquo;Before writing anything, read my Writing Rules, Voice Profile and Strategy files and apply them.&rdquo; Claude never writes from a blank slate.',
    ],
  },
  {
    id:'00c', icon:'&#127916;', title:'Premiere Template Build', group:'setup',
    tagline:'One-time: build TWO reusable Premiere projects &mdash; one for Shorts, one for long-form &mdash; both carrying the Visual Brand Kit colours/font, so starting a new video is always Save As, never a blank timeline.',
    steps:[
      '<strong>Build both master templates, same recipe, different canvas:</strong> &ldquo;SoundMoney_Short_TEMPLATE&rdquo; &mdash; one 1080&times;1920 vertical sequence. &ldquo;SoundMoney_Longform_TEMPLATE&rdquo; &mdash; one 1920&times;1080 horizontal sequence. Both get identical track labelling: V1 VO-visual, V2 B-roll, V3 Memes, V4 Text, V5 Captions; A1 VO, A2 Music, A3 SFX. Add an adjustment layer on top of both with your LUT.',
      '<strong>When you start a new video:</strong> at the Idea &amp; Validation stage you already confirm the format (long-form or Short). <code>File &gt; Save As</code> a copy of whichever template matches &mdash; SoundMoney_Short_TEMPLATE for a Short, SoundMoney_Longform_TEMPLATE for long-form. Never start from a blank project.',
      '<strong>Two text systems &mdash; keep them separate:</strong> Captions (from auto-transcribe) are the running subtitles on their own track. Callout text (the big [TEXT] punch-ins from your shot layouts) are separate Essential Graphics clips on the Text track. Never mix them.',
      '<strong>Caption Master Style, built from the brand kit:</strong> Transcribe a VO (Window &gt; Text &gt; Transcribe), Create Captions, style one caption using <strong>Inter</strong> at 700 (Bold), fill <code>#f0ece2</code>, a thin <code>#16181c</code> stroke and drop shadow for legibility over b-roll. In Essential Graphics &gt; Edit &gt; Styles dropdown &gt; <strong>Create Style</strong> &mdash; name it &ldquo;SM Caption&rdquo;. Apply to the whole caption track. Build this once in each template (font size differs: larger on the Short&apos;s narrower frame). Change it once, it updates everywhere.',
      '<strong>Typewriter callout (no After Effects):</strong> Type your text with the Type tool, font <strong>Inter 900 (Black)</strong>, fill <code>#f0ece2</code> on a <code>#16181c</code> panel. Add <strong>Video Effects &gt; Transition &gt; Linear Wipe</strong> to the clip. Set Wipe Angle 90&deg; (flip to 270&deg; if it reveals the wrong way), Feather 0. Keyframe <em>Transition Completion</em> 100% at the clip start &rarr; 0% about 0.5s later. Add a keyboard-clack SFX &mdash; at Shorts speed it reads as typing.',
      '<strong>Save 3 core callouts as .mogrt, each in 3 accent-colour variants:</strong> right-click each finished graphic &gt; <strong>Export As Motion Graphics Template</strong> &gt; Local Templates Folder. Build (1) <strong>SM Typewriter</strong>, (2) <strong>SM Pop</strong> (big bold word, keyframe Scale 0 &rarr; 115 &rarr; 100 over ~0.3s with ease-out), (3) <strong>SM End Card</strong> (handle + &ldquo;Follow for more&rdquo;, static, last 2s) &mdash; then duplicate each and swap the accent fill to make <strong>-Gold</strong>, <strong>-Teal</strong> and <strong>-Red</strong> versions (9 mogrts total). Picking the video&apos;s accent (set back in Holy Trifecta) is then a template swap, not a colour-picker decision. Build these ONCE &mdash; Local Templates Folder is global, so all 9 show up under Essential Graphics &gt; Browse in both the Short and Longform template projects, not just the one you built them in. Drag onto any timeline and retype.',
      '<strong>Title card / lower third, brand-locked:</strong> build one full-screen title card (charcoal <code>#16181c</code> background, headline in Inter 900 in the video&apos;s accent colour) for long-form chapter breaks, and one lower-third bar (accent-colour bar + Inter 700 white text) for naming sources/guests. Save both as .mogrt in the same 3-accent-variant pattern as above. These live only in the Longform template &mdash; Shorts don&apos;t have room for them.',
      '<strong>Effect presets + Paste Attributes:</strong> for your standard punch-in zoom and number reveal, right-click the effect in Effect Controls &gt; <strong>Save Preset</strong>. Learn <code>Cmd/Ctrl+Alt+V</code> (Paste Attributes) to copy effects from one clip to another instantly.',
      '<strong>Remap 4 shortcuts</strong> (Edit &gt; Keyboard Shortcuts) &mdash; do this once, it applies across both templates since Premiere shortcuts are app-wide, not project-specific: <code>Q</code>/<code>W</code> ripple-trim to playhead, <code>Cmd/Ctrl+K</code> razor at playhead, <code>Shift+Del</code> ripple delete (closes the gap), <code>M</code> marker.',
      '<strong>Fast personal alternative to mogrts:</strong> once a styled callout clip exists, <code>Opt/Alt</code>-drag it to duplicate and double-click to retype &mdash; all effects and keyframes come with it. Often faster than a mogrt for a solo editor.',
      '<strong>Done once:</strong> tick this off and never rebuild either template &mdash; from here every edit starts from the correct Save As with captions, brand-coloured callouts, LUT and shortcuts already in place.',
    ],
  },
  {
    id:'00d', icon:'&#127912;', title:'Visual Brand Kit', group:'setup',
    tagline:'One-time: lock the exact colours and font, then build real presets in Canva (thumbnail templates) so every new thumbnail starts from a saved design, not a blank canvas.',
    steps:[
      '<strong>Palette &mdash; one base, three accents, each with a job:</strong> <code>#16181c</code> charcoal base (background, everywhere). <code>#b8935a</code> antique gold &mdash; wealth-protection, gold, and monetary-history videos. <code>#2fb8ac</code> teal &mdash; inflation data and &ldquo;how money works&rdquo; explainer videos. <code>#c15049</code> muted brick red &mdash; urgency/alarm framing (savings getting eaten, doom-adjacent headlines) &mdash; use it sparingly, it is the loudest of the three and loses its punch if every thumbnail reaches for it. <code>#f0ece2</code> warm off-white for text on the charcoal base.',
      '<strong>Never more than 2 accents on one thumbnail, and never all 3.</strong> Pick the one that matches the video&apos;s content type as primary (headline colour), and at most one more for a secondary element (the big stat/number). Same logic the app itself uses for its own UI colours (cyan/green/amber/purple/red each mean something specific rather than being interchangeable) &mdash; carried over to the channel brand.',
      '<strong>Font &mdash; Inter, free on Google Fonts</strong> (fonts.google.com/specimen/Inter). Weight 900 (Black) for the big stat/number, 700 (Bold) for the headline, 600 (SemiBold) for tags and small text. Inter is already in Canva&apos;s built-in font library under &ldquo;Inter&rdquo; &mdash; no upload needed there. For Premiere/Photoshop, download and install the desktop font once from Google Fonts.',
      '<strong>Canva Brand Kit &mdash; the colours and font, saved once:</strong> Canva &gt; Brand &gt; Brand Kit (Brand Hub on some plans) &gt; <strong>Colors</strong> &gt; add all 5 hex codes above with the labels Base / Gold / Teal / Red / Text &gt; <strong>Fonts</strong> &gt; set Inter as both your heading and body font (pick the 900/Black cut for headings, 600/SemiBold for body). Every new design in Canva can now pull these from the brand panel instead of a manual colour-picker or font search.',
      '<strong>Getting the exact weight in Canva (the B toggle is not enough):</strong> the Bold button in the toolbar only flips between a font&apos;s built-in Regular/Bold, it cannot reach Black. Instead click directly into the font name field, type &ldquo;Inter&rdquo;, and pick the specific named weight from the dropdown list that appears (Inter, Inter Medium, Inter SemiBold, Inter Bold, Inter Black, etc.) &mdash; each is its own selectable entry. If &ldquo;Inter Black&rdquo; is not in that list on your account, upload the desktop Inter Black .ttf as a custom brand font (Brand Kit &gt; Fonts &gt; Upload) rather than settling for SemiBold.',
      '<strong>Canva thumbnail presets &mdash; the actual reusable templates:</strong> create one 1280&times;720 design named &ldquo;SM Thumbnail &mdash; Gold&rdquo;: charcoal background, headline text box in Inter 700 white, a big stat text box in Inter 900 gold, positioned per whichever 2 of the 4 thumbnail types (Holy Trifecta SOP) you use most. Duplicate it twice, recolour the accent to teal and red, and rename &ldquo;SM Thumbnail &mdash; Teal&rdquo; / &ldquo;SM Thumbnail &mdash; Red&rdquo;. Save all 3 in one Canva folder/project called &ldquo;SoundMoney Thumbnails&rdquo;. A new thumbnail is then <strong>open the matching accent template &gt; File &gt; Make a copy &gt; swap the text and image</strong> &mdash; never a blank canvas.',
      '<strong>Shorts thumbnail preset too:</strong> repeat the same 3-template exercise at 1080&times;1920 (or crop-safe within it) for Shorts &mdash; bigger text, 3&ndash;4 words max, centred in the safe zone away from YouTube&apos;s UI overlay. Same charcoal base and accent rules, just a different canvas size and heavier text weighting since it&apos;s viewed small in a scrolling feed.',
      '<strong>Shorts vs long-form &mdash; same brand, different composition:</strong> identical palette and font on both; brand recognition depends on it never changing. Long-form thumbnails (16:9) have more real estate &mdash; the headline can run a full sentence and sit next to a supporting chart or image.',
      '<strong>Done once:</strong> tick this off and every future Holy Trifecta and Thumbnail & SEO pass is &ldquo;open the matching Canva preset and Premiere template&rdquo;, not a from-scratch design decision.',
    ],
  },
  {
    id:'00e', icon:'&#127916;', title:'Motion & Animation Style', group:'setup',
    tagline:'One-time: lock how things MOVE — pacing, motion feel, and the After Effects workflow — so every short reads as one consistent, professional channel. Uses the Visual Brand Kit colours and Inter font.',
    steps:[
      '<strong>Pacing &mdash; think in BEATS, not lines. This is the #1 fix.</strong> A beat = one idea that gets to breathe for <strong>4&ndash;6 seconds</strong>, with one visual, not three. Rule: ~8&ndash;10 spoken words per beat, one visual per beat. A 50-second short is <strong>8&ndash;10 beats, not 18</strong>. Stop cramming a new visual into every sentence &mdash; it is why retention drops.',
      '<strong>Slow down the two beats that matter most:</strong> the hook (first 2&ndash;4s) and the payoff (final beat) should be your SLOWEST, held longest. Dwelling on them is what lets them land. Machine-gunning every beat at the same speed is what loses people.',
      '<strong>The read-aloud test:</strong> read the script out loud at a calm, unhurried pace. If you are rushing to fit the words into the beats, there is too much content &mdash; cut until the delivery feels relaxed. Fewer ideas delivered clearly beats more ideas delivered frantically.',
      '<strong>Colour &mdash; pull straight from the Visual Brand Kit (SOP 00d):</strong> <code>#16181c</code> charcoal background on everything, <code>#f0ece2</code> off-white for line-work and text, and ONE accent per video matched to content type &mdash; <code>#b8935a</code> gold (wealth/gold/history), <code>#2fb8ac</code> teal (inflation/how-money-works), <code>#c15049</code> red (urgency, sparingly). Never a 4th colour. Restraint reads as premium.',
      '<strong>Type:</strong> Inter &mdash; 900 Black for the big number/stat, 700 Bold for callouts, captions in Inter with a thick charcoal outline. Same font everywhere, no exceptions.',
      '<strong>Motion feel &mdash; ease EVERYTHING.</strong> Nothing moves linearly (that reads robotic/amateur). Elements fade in and scale from 90&rarr;100% over ~0.4s with Easy Ease (F9), then open the Graph Editor and shape the curve so motion starts with energy and settles gently. This single habit is the biggest difference between amateur and professional motion.',
      '<strong>Visual language:</strong> flat 2D only &mdash; simple line-and-fill icons (coin, bank, printer, chart) in the brand colours, ONE clean icon per beat. Not photos as the primary visual, not clip art, not 15 stock clips.',
      '<strong>One transition only.</strong> Pick a single transition (a clean fade, or a quick gold wipe) and use ONLY that across every short. Variety of transitions is the amateur tell; one repeated transition is a brand signature.',
      '<strong>Consistency anchors, reused every video:</strong> the same ~1s intro sting (coin &ldquo;cha-ching&rdquo; + logo), the same end card, the same caption style. Build each once as an After Effects comp and reuse forever.',
      '<strong>AE master project:</strong> build <code>SoundMoney_MOTION.aep</code> once &mdash; the 5 brand hex codes saved as swatches, Inter text styles set up, and the intro-sting + end-card comps already inside. Every new video duplicates this project. Premiere is for cutting; After Effects is for the animated elements.',
      '<strong>Save recurring animations as presets:</strong> any animation you will reuse (the count-up, a fade-scale-in, an icon pop) &mdash; select the keyframed properties &gt; Animation &gt; Save Animation Preset (.ffx). Reapply with one click. Export whole animated elements as .mogrt to your Local Templates folder so they appear in Premiere&apos;s Essential Graphics panel.',
      '<strong>Reference example &mdash; the &ldquo;Count-Up&rdquo; number (build this first):</strong> New comp <code>SM_CountUp</code>, add a Text layer typing <code>0</code>. Alt-click the Source Text stopwatch and paste the expression <code>Math.round(effect(&quot;Amount&quot;)(&quot;Slider&quot;)).toLocaleString()</code>. Add a Slider Control effect renamed &ldquo;Amount&rdquo;, keyframe it 0&rarr;target over ~1s, F9 both keyframes, then in the Graph Editor drag the handles so it counts fast then decelerates. Add a scale bounce (100&rarr;108&rarr;100 over the last 5 frames) so the final number lands. Export as a .mogrt &mdash; now you drag it into any video and just type the start and end numbers. This is the exact count-up in every polished finance short.',
      '<strong>Learn AE in this order:</strong> (1) keyframes + Easy Ease + Graph Editor, (2) expressions (like the count-up), (3) shape layers for your icons, (4) the mogrt export flow, (5) simple object rigging. Skills 1 and 2 alone transform the shorts.',
      '<strong>Keep a one-page style sheet</strong> pinned at your desk: the 5 hex codes, &ldquo;Inter&rdquo;, &ldquo;ease everything&rdquo;, &ldquo;one transition&rdquo;, &ldquo;8&ndash;10 beats, one visual each&rdquo;. Every time you are tempted to add a colour or a flashy transition &mdash; don&apos;t. The discipline IS the brand.',
    ],
  },
  {
    id:'01', icon:'&#128161;', title:'Idea & Validation', group:'production',
    tagline:'Commit only to topics that have demand, a clear angle, and meme/story potential. Pipeline stages: 💡 Idea → ✅ Validated.',
    steps:[
      '<strong>Identity check, before anything else:</strong> sit down as someone who already owns a successful channel in this niche, not someone hoping an idea lands. Ask &ldquo;what would I make next&rdquo;, not &ldquo;is this good enough to maybe try.&rdquo; Same evidence bar as every check below &mdash; outliers and comment gaps are still mandatory &mdash; but back a strong idea plainly and kill a weak one outright instead of hedging everything into a noncommittal maybe.',
      'Brain-dump 3&ndash;5 ideas &mdash; economics in the news, trending Reddit threads (r/economics, r/wallstreetbets), Financial Times headlines',
      'Search YouTube for each idea. Watch the top 3 results. Ask: what&apos;s missing? Too dry? Too shallow? No humour? That&apos;s your opening.',
      '<strong>Outlier video analysis:</strong> On the top channels in your niche, sort by Most Popular. Find the videos that massively outperformed that channel&apos;s average view count. Those outliers reveal what the algorithm is hungry for right now &mdash; breakout potential, not just steady demand. These are your best topic signals.',
      '<strong>Bad-packaging filter &mdash; the strongest signal of all:</strong> of the outliers you find, only proceed on the ones with genuinely weak packaging &mdash; a bad or generic thumbnail and a slow, forgettable intro that still blew up. That combination proves the topic itself pulled the views, not the execution. A great video with great packaging that did well tells you nothing you can act on &mdash; you can&apos;t out-thumbnail someone who already nailed the thumbnail. Bad packaging + big numbers is the gap you can actually win.',
      '<strong>Mine the comments:</strong> on the outlier video, read the top 30&ndash;50 comments. Note unanswered questions, frustrations, and requests for follow-ups &mdash; the exact language people use becomes your hook.',
      '<strong>Never just copy the video you found &mdash; steal the topic, not the take.</strong> Your job is a genuinely different angle on the same subject, not a re-explain of the outlier in your own words. Formula: <em>big topic + unexpected frame</em> &mdash; a historical parallel, a contrarian take, or an absurd analogy. For SoundMoney specifically: run the topic through an Austrian economics lens (sound money, malinvestment, business-cycle theory, the failures of central planning) before defaulting to the mainstream explainer framing everyone else used &mdash; that lens alone is usually the unexpected frame.',
      'Write the one-line pitch: &ldquo;This video explains X by showing Y.&rdquo; If you can&apos;t do it in one line, it&apos;s probably two videos.',
      '<strong>Confirm format:</strong> long-form (process, principle, or case study &mdash; a mechanism or real example walked through step by step) or Short (pain, prize, or desire &mdash; one raw emotional trigger, not a mini-lecture). Match the idea to the format it actually fits, not the other way round.',
      '<strong>Pick your video type:</strong> Listicle (top of funnel, broad reach) &rarr; How to (mid funnel, shows expertise) &rarr; Case study (proof + expert positioning) &rarr; Testimonial/interview (bottom funnel, trust before the ask). Set this in the Pipeline&apos;s video type field &mdash; it should track your current funnel position, not repeat the same type every video.',
      'Check whether there&apos;s a Short hiding inside the long-form topic &mdash; one stat, one absurd fact, one wild historical moment.',
      '<strong>Alpha check:</strong> could ChatGPT or a 5-minute Google search already answer this well? If yes, don&apos;t make the video as-is &mdash; find the thing AI can&apos;t easily give: original data you pulled yourself, a contrarian take, a historical parallel nobody else has used, a real number nobody else calculated. Write that unique angle down. If you can&apos;t fill it in, the idea is a recipe, not a video.',
      '<strong>Revenue-tier check:</strong> is this topic mass-market explainer territory (lower pay per view) or a sharper, higher-value angle within sound money/economics (higher pay per view)? You don&apos;t have to chase the highest tier every time, but know which one you&apos;re picking and why.',
      '<strong>Funnel check:</strong> which audience segment does this attract &mdash; top (pulls into your lead magnet), mid (moves toward your offer) or bottom (contains a direct CTA)? Write the one-sentence CTA for this video now &mdash; you&apos;ll need it for the script.',
      'Name the project and create the folder: <code>/videos/YYYY-MM_topic-name/</code>',
      'Move the idea to <strong>✅ Validated</strong> in the Content Pipeline once the angle, pitch, unique angle and format are confirmed.',
    ],
    stepMins:[5,15,15,20,10,15,5,5,3,3,5,10,5,5,3,2],
  },
  {
    id:'02', icon:'&#128218;', title:'Research', group:'production',
    tagline:'Build the facts, stories, rabbit holes and meme potential before you write a word. Pipeline stage: 📚 Research.',
    steps:[
      'Spend 60&ndash;90 min reading deeply: Wikipedia (follow footnotes), academic papers, news archives, Google Scholar for stats',
      'Find 2&ndash;3 wild statistics or counterintuitive facts &mdash; these become your hook and most shareable moments',
      'Find at least one historical parallel (Tulip mania, Bretton Woods, South Sea Bubble &mdash; economics repeats itself)',
      'Identify the &ldquo;villain&rdquo;, &ldquo;hero&rdquo; or turning point &mdash; good economics content always has a character or institution to root for or against',
      'Write down the one key idea the viewer should leave with. Build back from that.',
      'Source every fact &mdash; note URLs in a doc so you can sanity-check before publishing',
      'Scan for meme potential: check Know Your Meme, Twitter/X, Reddit for existing references your audience will already recognise',
    ],
    stepMins:[75,20,15,10,5,15,15],
  },
  {
    id:'03', icon:'&#127919;', title:'Holy Trifecta (Concept)', group:'production',
    tagline:'Long-form / Both / Podcast clip only — pure Shorts skip this stage entirely and go straight from Research into Scripting (no separate thumbnail/title packaging decision — the hook is covered by Scripting instead). Decide the click before you write a word of script. Title, thumbnail concept and hook must all pull in the same direction. Pipeline stage: 🎯 Holy Trifecta.',
    steps:[
      '<strong>Title formula (Hummus &mdash; SEO + Keyword + Viral Element):</strong> every title stacks a searchable SEO keyword phrase (what someone would actually type into YouTube search) with a viral hook element (curiosity, stakes, a number, urgency) on top &mdash; neither alone is enough. e.g. &ldquo;Steal this Lazy YouTube Strategy to Get to 6 Figures a Month&rdquo; (keyword: lazy YouTube strategy / viral: steal this&hellip;6 figures) or &ldquo;Top 10 High Paying Online Jobs With the Most Demand Right Now&rdquo; (keyword: high paying online jobs / viral: top 10&hellip;right now). Write 3 options this way and pick the strongest &mdash; discard any option that&apos;s pure curiosity with no real search term in it.',
      '<strong>Thumbnail + title create a journey together:</strong> They are not two separate tasks. Someone sees the thumbnail first, the title completes the thought. Both must pull in the same direction toward curiosity.',
      '<strong>4 thumbnail types &mdash; always combine at least 2:</strong> (1) Subject next to something bigger &mdash; creates scale and context. (2) Comparison &mdash; before/after, cheap vs expensive, old vs new. (3) Blur or obscure the main result &mdash; force the click to reveal it. (4) Big number or stat &mdash; creates instant curiosity. Single-formula thumbnails are average. Stack them. Pick the combo now &mdash; the final image gets built later in Thumbnail & SEO once you have real footage.',
      '<strong>Pick the brand accent now too:</strong> from the Visual Brand Kit (see setup SOPs) &mdash; gold for wealth/gold/history topics, teal for data/explainer topics, red for urgency/inflation-alarm topics. Charcoal base and Inter font are constant on every video; the accent is the only thing that varies by content type. Never more than 2 of the 3 accents on one thumbnail.',
      'Sanity-check the hook you&apos;ll open the script with against the title and thumbnail concept &mdash; all three should promise the exact same payoff, or the video will feel like a bait-and-switch.',
      '<strong>Pattern check:</strong> what hook opening did you use on your last 2&ndash;3 videos? Do not repeat it. Rotate between hook types: observation &rarr; promise &rarr; proof; shared struggle &rarr; contrarian insight; myth-bust with stakes; pain-point diagnosis; proof-first evidence. Picking a different one each time keeps hooks from blurring together.',
      'Lock the direction and move on &mdash; this stage is a fast decision, not a design session. The actual thumbnail asset gets produced later once you have real footage/b-roll (see Thumbnail & SEO SOP).',
    ],
    stepMins:[20,5,15,5,5,5,2],
  },
  {
    id:'04', icon:'&#128221;', title:'Scripting', group:'production',
    tagline:'Plan before you write. The script is your production blueprint.',
    steps:[
      '<strong>Yap session with Claude &mdash; do this before anything else, before the outline:</strong> open a Claude chat and just talk about the video out loud &mdash; what happened, why it matters, what angle you&apos;re leaning toward, what you already believe about it. Tell Claude to interview you: keep asking follow-up questions (&ldquo;What&apos;s the contrarian take here?&rdquo; &ldquo;What would a skeptic say back?&rdquo; &ldquo;What surprised you researching this?&rdquo; &ldquo;Where do you actually disagree with the mainstream take?&rdquo;) until it has pulled the real material out of you &mdash; not generic facts, but the specific opinions, phrasing, and stories only you have. This raw conversation, not a cold outline, is the actual source material the script gets built from next.',
      '<strong>Pick the format lens first:</strong> long-form = teach a process or principle, or walk through a real case study. Shorts = hit one emotional trigger &mdash; pain, prize, or desire &mdash; hard and fast, no mechanism required. Writing a Short like a mini-lecture or a long-form video on emotion alone with nothing to teach are both the wrong call.',
      '<strong>Step 1 &mdash; Common Goal:</strong> Before a single word of script, write down what the viewer actually wants &mdash; not what the video is about, but what they are trying to feel or achieve. (e.g. &ldquo;feel informed and not fooled by mainstream financial news&rdquo;)',
      '<strong>Step 2 &mdash; Deeper Problem:</strong> Beneath that goal, what is the real underlying frustration? (e.g. &ldquo;they feel lied to and confused by noise from institutions they can&apos;t trust&rdquo;) &mdash; this is the emotional hook the whole video is built on.',
      '<strong>Step 3 &mdash; Audience Avatar:</strong> Write down one specific person in detail &mdash; age, what they already know, what they are struggling with right now. Every line of script is written for that one person.',
      '<strong>Step 4 &mdash; Outline, then AI roast:</strong> Build the story architecture before writing any script. Once the outline is done, paste it into ChatGPT and ask: &ldquo;Roast this &mdash; what did I miss? What is boring? What should I add, remove, or change? What about a different plot twist?&rdquo; Go back and forth 2&ndash;3 times. Then close the AI and write the script yourself.',
      '<strong>The Trojan Horse rule:</strong> Nobody wants pure knowledge. The economics insight must be delivered inside a story. The script, editing, and animations are all the horse &mdash; the information is hidden inside. Without the horse, nobody watches to the end.',
      '<strong>Story arc (use as a lens, not a formula):</strong> Every video benefits from a journey: a character with a problem &rarr; a discovery or turning point &rarr; barriers and tension &rarr; resolution. For SoundMoney: the viewer is the character, the financial system is the world, the discovery is the insight mainstream media missed, and the resolution is clarity. Not a rigid structure &mdash; just ask yourself whether each video has a journey or just information.',
      '<strong>The format rhythm (Fireship-style):</strong> Intense info &rarr; brief absurd joke &rarr; back to info. Vary constantly. Never let the viewer predict the next beat.',
      'Write the hook first &mdash; first 15 seconds for long form, first 3 for Short. Open with the wildest stat, a bold claim, or a question that makes stopping feel impossible.',
      'Build a 5&ndash;8 section outline. Each section = one idea + one beat + one joke or moment.',
      'Write full script word-for-word &mdash; write how you <em>speak</em>, not how you write. Set a timer and write fast on the first draft &mdash; fix grammar later. Read every line aloud as you go.',
      '<strong>Script colour-coding:</strong> Once drafted, highlight in 4 types throughout the doc: spoken VO (default/white), <strong style="color:#00d4ff">[B-ROLL: description]</strong> in blue, <strong style="color:#00ff88">[MEME: description]</strong> in green, <strong style="color:#ffb800">[SFX: sound cue]</strong> in amber. This removes guesswork on the timeline and makes the edit significantly faster.',
      '<strong>Specificity audit:</strong> go back through the draft and swap every vague line for a specific one &mdash; &ldquo;it worked well&rdquo; becomes &ldquo;237% increase in 14 days&rdquo;, &ldquo;recently&rdquo; becomes &ldquo;in the first 7 days&rdquo;. Specific numbers are what get screenshotted.',
      '<strong>CTA spacing:</strong> keep any CTAs or asks (lead magnet mention, like button, subscribe) at least 140 words apart. Clustering them reads as desperate and trains viewers to tune out.',
      'For Shorts: 60&ndash;80 words max, built on the one emotional trigger (pain, prize, or desire) picked above. One topic, one punchline, one twist. No padding, no process explanation.',
      'Write the CTA conversationally &mdash; not like an ad. <em>&ldquo;If that surprised you, wait for the next one.&rdquo;</em>',
      'Read the full script aloud and time it. If you&apos;re bored reading it, the viewer is bored watching it. Cut.',
    ],
    stepMins:[20,3,5,5,5,20,2,3,2,15,15,45,15,15,5,10,5,15],
  },
  {
    id:'05', icon:'&#127912;', title:'Asset Gathering', group:'production',
    tagline:'Have every meme, b-roll clip, and chart ready before you record. Pipeline stage: 🎨 Assets.',
    steps:[
      '<strong>Memes:</strong> imgflip, giphy, Twitter/X, Reddit, Know Your Meme &mdash; save to <code>/assets/memes/</code> with descriptive filenames',
      '<strong>B-roll (free):</strong> Pexels, Pixabay, Coverr, Archive.org (great for historical footage) &mdash; save to <code>/assets/broll/</code>',
      '<strong>B-roll (paid):</strong> Storyblocks, Envato Elements',
      '<strong>Charts &amp; data visuals:</strong> Datawrapper and Flourish are fast and free &mdash; export as MP4 with build animation, save to <code>/assets/charts/</code>',
      '<strong>Background music:</strong> Epidemic Sound (primary &mdash; royalty-free, YouTube-safe, large catalogue; download stems to isolate drums or bass separately). Artlist as backup.',
      '<strong>Sound effects:</strong> Epidemic Sound SFX library (same subscription), Freesound.org for specific one-offs, Zapsplat for category packs &mdash; save all to <code>/assets/sfx/</code>. Build a personal SFX folder and reuse across every video.',
      'Organise before recording: <code>/memes/</code> <code>/broll/</code> <code>/charts/</code> <code>/audio/</code> <code>/sfx/</code> <code>/vo/</code>',
      'For Shorts: 3&ndash;5 punchy clips max, each under 3 seconds',
      'Tidy projects save hours in the edit &mdash; never skip the folder structure',
    ],
    stepMins:[15,20,10,15,10,10,10,10,2],
  },
  {
    id:'06', icon:'&#127908;', title:'Voiceover Recording', group:'production',
    tagline:'Your voice is the whole performance. Capture it with energy, clarity, and pace. Pipeline stage: 🎙️ Voiceover.',
    steps:[
      '<strong>Setup:</strong> Remove echo with blankets, heavy curtains, or record inside a wardrobe full of clothes',
      'Do a 30-second test and listen back &mdash; check for hiss, echo, room noise, and levels',
      'Warm up your voice &mdash; 5 min speaking aloud before hitting record. Cold voice sounds flat.',
      'Record section by section &mdash; one script chunk per take. Label files: <code>vo_01_hook.wav</code>, <code>vo_02_section1.wav</code>',
      'Match your energy to the script: fast sections fast, punchy moments punchy',
      'Re-record any line that sounds flat or unconvincing. You will hear every weak line a thousand times in the edit.',
      '<strong>Cut the audio file to trim bad takes with Claude:</strong> once the raw takes are recorded, hand the file (or its auto-transcript) to a Claude session and ask it to flag the timestamps of stumbles, retakes, and dead air, then cut those segments out (ffmpeg, or a Claude Code/Cowork pass) before the clean VO ever hits the timeline &mdash; faster and more consistent than scrubbing waveforms by eye, and it leaves you with one clean take per section instead of picking through duplicates in Premiere.',
      'For Shorts: record in 1&ndash;2 takes, energy must be immediate from the first word',
      'Keep any spontaneous ad-libs or jokes you discover during recording &mdash; often your best moments',
    ],
    stepMins:[10,5,5,40,3,15,15,5,2],
  },
  {
    id:'07', icon:'&#9986;', title:'Editing (Fast-Cut Faceless)', group:'production',
    tagline:'Build the dense, fast, funny visual style that defines this format. Pipeline stage: ✂️ Editing.',
    steps:[
      '<strong>Start from the template:</strong> <code>File &gt; Save As</code> a copy of SoundMoney_Short_TEMPLATE (see the one-time <em>Premiere Template Build</em> setup SOP). The caption style, callout mogrts (SM Typewriter / SM Pop / SM End Card), LUT and shortcuts are already in place &mdash; drag the mogrts onto the [TEXT] beats from your shot layout and retype. Do not rebuild any of it per video.',
      '<strong>Golden rules:</strong> VO goes on first. Everything hangs off it. The viewer should never see a blank or static shot.',
      'Memes land on the punchline, not before it. Timing is everything.',
      'New visual every 2&ndash;4 seconds on long form. Every 1&ndash;2 on Shorts.',
      '<strong>Cutting balance:</strong> Cut every second where nothing interesting is happening &mdash; but do not cut so aggressively that you kill the story. Retention pace must serve the narrative, not fight it. If a moment needs a beat to land, keep it. Over-cutting long form is as bad as under-cutting.',
      'Watch your edit at 2x speed. If it&apos;s boring at 2x, it&apos;s boring at 1x.',
      'Import and label all assets in bins: VO / BROLL / MEMES / MUSIC / GRAPHICS',
      'Lay the complete VO on the timeline. Don&apos;t start placing visuals until the VO is final.',
      'Cut the VO: remove every breath, pause, um, and stumble. Use Premiere auto-transcribe or Descript for speed &mdash; or skip this if the bad-takes pass with Claude in the Voiceover Recording SOP already left you with one clean take per section.',
      'Place b-roll over every second of the timeline. Dense visual coverage is not optional.',
      'Add memes at every [MEME] marker. Time the visual to arrive exactly as the joke word lands.',
      'Add on-screen text captions for key stats and memorable lines &mdash; bold, high-contrast, large.',
      'For Shorts: burn in full captions for every word &mdash; 85% of Shorts are watched with sound off.',
      'Add background music &mdash; low under talking, rises on key moments. Music should <em>feel</em>, not be heard. Lower than feels natural.',
      '<strong>Sound design pass (dedicated):</strong> Mute all other tracks and do sound effects with only the VO playing &mdash; you need to hear exactly what you are adding. Combine multiple SFX together on the same moment rather than using single sounds in isolation. Keep all SFX levels lower than feels natural &mdash; they should enhance, not become noticeable.',
      'Add sound effects on meme pops, chart animations, key stat reveals, and scene transitions.',
      'Colour grade: Lumetri on each clip individually to match exposure and tone, then run a LUT across all b-roll to unify clips from different sources.',
      'Keep experimenting each video &mdash; try one new technique per upload. Channels that repeat the same edit style stop growing.',
      'Watch full edit at 1x as a viewer. Note every moment where your eyes drift. Cut it.',
      'Export long form: 1080p or 4K, 30fps, H.264. Short: 1080&times;1920 vertical, 30fps, H.264.',
    ],
    stepMins:[5,2,2,2,3,10,10,10,25,40,15,15,10,10,20,15,25,2,15,5],
  },
  {
    id:'08', icon:'&#128444;', title:'Thumbnail & SEO (Production)', group:'production',
    tagline:'Long-form / Both / Podcast clip only — pure Shorts skip this stage entirely (no custom thumbnail, upload goes straight from Editing to Scheduled). Build the real thumbnail from the concept you locked in Holy Trifecta, and finalise the SEO metadata. Pipeline stage: 🖼️ Thumbnail & SEO.',
    steps:[
      '<strong>Thumbnail:</strong> Build the actual image using the type-combo you picked in Holy Trifecta. Bold graphic, minimal text (max 5 words), high contrast &mdash; check at 120px wide (mobile grid). High-quality source images matter more than most creators admit.',
      'No face &mdash; use charts, money visuals, bold typography, or dramatic imagery.',
      '<strong>Consistent visual brand &mdash; pull from the Visual Brand Kit, don&apos;t re-decide it:</strong> charcoal base (#16181c), Inter font (900 for the stat, 700 for the headline), and the accent picked in Holy Trifecta (gold #b8935a / teal #2fb8ac / red #c15049, max 2 per thumbnail). Same values every time so the audience recognises SoundMoney in the feed without reading the channel name. If Canva/Photoshop is set up with the saved brand kit (see setup SOPs), this is drag-and-drop, not a colour-picker decision.',
      '<strong>Shorts vs long-form composition:</strong> same brand kit on both. Shorts (9:16) &mdash; bigger, bolder, 3&ndash;4 words max, centred in the safe zone away from YouTube&apos;s UI overlay. Long-form (16:9) &mdash; more room, headline can run a full sentence alongside a supporting chart or image.',
      'A/B test: can someone identify the topic in 2 seconds without reading the title?',
      'Finalise the title from the 3 options drafted in Holy Trifecta &mdash; pick the one that best matches the finished thumbnail.',
      '<strong>Description:</strong> First 2 lines are indexed by Google &mdash; hook sentence + primary keyword before &ldquo;show more&rdquo;.',
      'Add timestamps as chapters (every 2&ndash;3 minutes) + links: sources, socials, related videos.',
      '<strong>Tags:</strong> 3 broad topic tags, 5 specific niche tags, 5 long-tail question-style tags &mdash; research with TubeBuddy or vidIQ.',
    ],
    stepMins:[30,2,5,10,5,5,10,10,10],
  },
  {
    id:'09', icon:'&#9729;', title:'Upload & Publish', group:'production',
    tagline:'Get it live and set up right before anyone sees it. Pipeline stages: ☁️ Scheduled → 📣 Live.',
    steps:[
      '<strong>Before you publish:</strong> update the end screens on your 3 best-performing recent videos to point to this new one &mdash; that is free traffic the algorithm cannot give you, only you can.',
      'Upload to YouTube Studio, set to Private while setting up',
      'Paste title, description, tags, chapters',
      'Upload custom thumbnail',
      '<strong>Search check:</strong> once uploaded as Unlisted, search your exact title in the YouTube search bar. If it does not surface, check rapidtags.io for the keywords top videos in your niche use and tighten your title/description/tags.',
      '<strong>Silent watch + read-aloud check:</strong> watch the first 60 seconds with the sound off &mdash; does it make sense without audio? Then read your title out loud in one breath &mdash; if you stumble, rewrite it. Both take under 2 minutes.',
      'Add end screens at 20 seconds from the end: subscribe button + next video &mdash; point &ldquo;next video&rdquo; at the playlist URL (open the video inside its playlist and copy that URL), not a single video, since playlist viewers watch more per session',
      'Add info cards at 2&ndash;3 relevant moments',
      'Set category: Education or News &amp; Politics. Confirm NOT marked &ldquo;made for kids&rdquo;.',
      'Review auto-captions &mdash; correct any financial terms it gets wrong',
      '<strong>Mid-roll placement (long form, revenue):</strong> max 3 breaks, only at natural pauses, never on a cliff-hanger, at least 2 minutes apart, none before the 25% mark. Well-placed mid-rolls can roughly double AdSense revenue per 1k views vs none.',
      'Schedule at your channel&apos;s peak time (check Analytics &rarr; Audience tab)',
      'Shorts: publish immediately &mdash; they benefit from the initial engagement window',
    ],
    stepMins:[10,5,10,3,10,5,10,5,3,10,10,5,2],
  },
  {
    id:'10', icon:'&#128226;', title:'Post-Publish & Growth', group:'production',
    tagline:"The video doesn't stop working when you hit publish. Pipeline stage: 📊 Post-Published.",
    steps:[
      'Community tab: post a wild stat from the video + the link within 30 min of going live',
      '<strong>Seed 3 comments</strong> on your own video the moment it goes public &mdash; a question, an extra tip that did not make the cut, and a genuine opinion. This starts the conversation before anyone else arrives, and the algorithm watches early engagement.',
      'Clip the funniest or most shocking 30&ndash;60 seconds as a Short (if long form)',
      'Twitter/X: post the wildest stat as a thread opener + link',
      'Reddit: r/economics, r/personalfinance, r/investing &mdash; add a sentence of value first, then the link',
      'Reply to every comment in the first 90 minutes &mdash; YouTube rewards early engagement signals',
      'Pin a comment with a provocative question to spark debate',
      '<strong>Universe building:</strong> In the description and pinned comment, reference at least one other SoundMoney video that connects to this topic. Add an info card at the relevant moment in the edit. Every video reinforces the universe &mdash; viewers who stay in it push &ldquo;average views per viewer&rdquo; above 1.',
      '<strong>Track your links:</strong> run every promoted link (lead magnet, newsletter, offer) through short.io so you can see clicks per video after 7 and 30 days &mdash; feed this into the Pipeline&apos;s revenue attribution field.',
      '<strong>48-hour diagnostic</strong> (stop at the first failure you find): CTR below your channel average &rarr; packaging problem, swap the thumbnail/title today &mdash; the only live fix. CTR fine but a steep drop in the first 30&ndash;60 seconds &rarr; intro problem, rewrite the hook next time. Retention holds early but bleeds through the middle &rarr; pacing problem, tighten Setup/Tension/Payoff and add more forward pulls. Healthy CTR and retention but low impressions &rarr; idea problem, the topic itself did not have enough demand. Use the cge-launch-optimization skill to run this against your real numbers.',
      '<strong>Shorts &mdash; the 24-hour check:</strong> only two numbers matter. VVSA (viewed vs swiped away): target above 80%, below that means the hook is not stopping the scroll. AVD (average view duration): target 100% on 30-second Shorts, 85%+ on 40&ndash;60 second Shorts. &ldquo;View count jail&rdquo; bands: 100&ndash;10k views usually means low trust score or weak packaging, 10k&ndash;30k means VVSA/AVD is slightly off or the niche is saturated, 30k+ means you have passed every seed test and just need more data &mdash; keep uploading, do not change strategy.',
      '<strong>Transcript audit:</strong> clean up the auto-generated captions (misheard proper nouns and numbers hurt SEO), then paste the clean transcript into Claude to pull shareable quotes, chapter timestamps, and 60-second Shorts candidates.',
      '<strong>Thumbnail A/B poll:</strong> if a video is underperforming, post two thumbnail options to your community tab and ask viewers to vote A or B &mdash; swap to the winner after 24 hours. Real click data beats your own preference.',
      '<strong>Two-screen pacing audit:</strong> watch the video once on desktop at full focus, marking where your attention drifts, then once on your phone with a second screen nearby, marking where you reached for it. Feed both into your one-improvement note.',
      '<strong>Revenue attribution, not just views:</strong> views alone don&apos;t tell you what actually paid. Log what this video actually earned (AdSense for that video, or clicks/signups if you&apos;re linking anywhere) in the Pipeline&apos;s Revenue attribution field on the card. A handful of low-view, high-intent videos can out-earn a viral one &mdash; you only see that if you track revenue per video, not just views per video.',
      '<strong>One-improvement rule:</strong> Pick the single weakest element from this video. Write it down. That is the only thing to fix next time. Trying to improve everything at once fixes nothing.',
      'Log the video in the Content Tracker.',
    ],
    stepMins:[5,10,15,5,10,15,3,10,5,15,10,15,10,15,5,3,3],
  },
]

// ── Pipeline-stage ⇄ SOP map ────────────────────────────────────────────────
// Maps a content_items.pipeline_stage value to the SOP whose checklist is the
// work-to-do for that stage. Completing every step in that SOP is what
// qualifies the item to advance to the next pipeline stage (see
// STAGE_ADVANCE below for where it goes next).
//
// Two stages have no dedicated SOP:
//   - '☁️ Scheduled' is folded into SOP 09 (Upload & Publish), which covers
//     scheduling AND going live in one checklist — there's no separate
//     actionable checklist for "waiting to go live", it's just calendar time.
//   - '📊 Post-Published' is the terminal state — once an item is here there
//     is no further SOP-driven forward work, so it's excluded from stage-map
//     lookups (and from active-focus auto-fill, since there's nothing left
//     to complete).
export const STAGE_TO_SOP: Record<string, string> = {
  '💡 Idea':             '01',
  '✅ Validated':         '02',
  '📚 Research':          '03',
  '🎯 Holy Trifecta':     '04',
  '✍️ Script':            '05',
  '🎨 Assets':            '06',
  '🎙️ Voiceover':        '07',
  '✂️ Editing':           '08',
  '🖼️ Thumbnail & SEO':  '09',
  '📣 Live':              '10',
}

// Where a content item's pipeline_stage moves to once its mapped SOP's
// checklist is fully checked off. Mirrors PIPELINE_STAGES order in
// app/content/page.tsx (Idea → Validated → Research → Holy Trifecta →
// Script → Assets → Voiceover → Editing → Thumbnail & SEO → Scheduled →
// Live → Post-Published), collapsing the Scheduled step into the
// Upload & Publish SOP as noted above.
export const STAGE_ADVANCE: Record<string, string> = {
  '💡 Idea':             '✅ Validated',
  '✅ Validated':         '📚 Research',
  '📚 Research':          '🎯 Holy Trifecta',
  '🎯 Holy Trifecta':     '✍️ Script',
  '✍️ Script':            '🎨 Assets',
  '🎨 Assets':            '🎙️ Voiceover',
  '🎙️ Voiceover':        '✂️ Editing',
  '✂️ Editing':           '🖼️ Thumbnail & SEO',
  '🖼️ Thumbnail & SEO':  '📣 Live',
  '📣 Live':              '📊 Post-Published',
}

// A pure Short (format === 'Short') skips the Thumbnail & SEO production
// stage entirely — no custom thumbnail, minimal metadata, folded straight
// into Upload & Publish. 'Long-form', 'Both' and 'Podcast clip' all still
// produce a real long-form asset and keep the full chain.
export function isShortsOnly(format: string | null | undefined): boolean {
  return format === 'Short'
}

// A pure Short also skips the Holy Trifecta (Concept) stage — that stage is
// a title-formula + thumbnail-type + accent-colour decision built for
// long-form click-through, and Shorts don't have a deliberate thumbnail
// decision the way long-form does (no custom thumbnail, discovered via the
// feed rather than a search/browse click). The hook still matters hugely
// for a Short — but that's covered by Scripting (SOP 04, "write the hook
// first"), so Research goes straight into Scripting instead of pausing on
// a packaging step Shorts don't need.
export const SHORTS_SKIPPED_STAGES = ['🎯 Holy Trifecta', '🖼️ Thumbnail & SEO'] as const

export function isStageSkippedForShorts(stage: string | null | undefined, format?: string | null): boolean {
  if (!stage) return false
  return isShortsOnly(format) && (SHORTS_SKIPPED_STAGES as readonly string[]).includes(stage)
}

// The SOP ids that back the two skipped stages above (Holy Trifecta = '03',
// Thumbnail & SEO = '08') — used anywhere that lists/loops over production
// SOPs by id rather than by stage label (full-history view, auto-draft
// chain) so those two stay excluded for Shorts everywhere, not just on the
// Kanban board.
export const SHORTS_SKIPPED_SOP_IDS = ['03', '08'] as const

export function productionSopIdsFor(format: string | null | undefined, allIds: string[]): string[] {
  if (!isShortsOnly(format)) return allIds
  return allIds.filter(id => !(SHORTS_SKIPPED_SOP_IDS as readonly string[]).includes(id))
}

const STAGE_TO_SOP_SHORTS: Record<string, string> = { ...STAGE_TO_SOP, '📚 Research': '04', '✂️ Editing': '09' }
const STAGE_ADVANCE_SHORTS: Record<string, string> = { ...STAGE_ADVANCE, '📚 Research': '✍️ Script', '✂️ Editing': '☁️ Scheduled' }

export function sopForStage(stage: string | null, format?: string | null): SOP | null {
  if (!stage) return null
  const map = isShortsOnly(format) ? STAGE_TO_SOP_SHORTS : STAGE_TO_SOP
  const id = map[stage]
  if (!id) return null
  return SOPS.find(s => s.id === id) ?? null
}

// Format-aware replacement for a raw STAGE_ADVANCE[stage] lookup — use this
// at every call site that decides where an item goes next, so Shorts skip
// the Thumbnail & SEO stage instead of getting stuck needing it.
export function stageAdvance(stage: string, format?: string | null): string | undefined {
  const map = isShortsOnly(format) ? STAGE_ADVANCE_SHORTS : STAGE_ADVANCE
  return map[stage]
}

// ── Focus-session chunking ──────────────────────────────────────────────
// Turns "advance this stage" (which can mean anywhere from 7 to 20 steps)
// into a manageable single sitting: the next 3-4 uncompleted steps, capped
// by a total-time budget rather than a fixed count. A stage made of quick
// planning steps fills up to SESSION_MAX_TASKS; a stage made of long
// production steps (Editing's b-roll pass, VO cleanup, colour grade...)
// naturally gets batched into fewer tasks per session so the countdown
// stays realistic — "smaller sub-tasks when doing things that take time"
// without having to rewrite any SOP content. Always returns at least one
// step (even if it alone exceeds the budget) so a session never comes back
// empty just because one task is big.
export const SESSION_TIME_BUDGET_MINS = 60
export const SESSION_MAX_TASKS = 4

export type SessionChunk = { stepIndices: number[]; totalMins: number }

export function nextSessionChunk(sop: SOP, completedIndices: Set<number>): SessionChunk | null {
  const indices: number[] = []
  let total = 0
  for (let i = 0; i < sop.steps.length; i++) {
    if (completedIndices.has(i)) continue
    const mins = sop.stepMins?.[i] ?? DEFAULT_STEP_MINS
    if (indices.length > 0 && (total + mins > SESSION_TIME_BUDGET_MINS || indices.length >= SESSION_MAX_TASKS)) break
    indices.push(i)
    total += mins
    if (indices.length >= SESSION_MAX_TASKS) break
  }
  return indices.length > 0 ? { stepIndices: indices, totalMins: total } : null
}

// ── Idea "Validate" checklist (Content Pipeline Ideas Bank) ────────────────
// The concrete, checkable version of Hummus's idea-validation method (see
// SOP 01 above). Fed to Claude as the exact list of things to check when
// you hit Validate on an idea — keeps the AI honest about only assessing
// what it can actually see, and flagging the rest as needing research
// rather than guessing at outlier stats or comment data it wasn't given.
export type ValidationCheckDef = { key: string; label: string; hint: string }

export const IDEA_VALIDATION_CHECKS: ValidationCheckDef[] = [
  { key:'pitch', label:'One-line pitch', hint:'"This video explains X by showing Y" as a single sentence. If it takes two sentences, it is probably two videos.' },
  { key:'angle', label:'Angle formula', hint:'Big topic + unexpected frame — a historical parallel, contrarian take, or absurd analogy, not just a straight explainer.' },
  { key:'alpha', label:'Alpha check', hint:'Could ChatGPT or a 5-minute Google search already answer this well? If yes, it needs a unique angle — original data, a contrarian take, a historical parallel nobody else has used, or a number nobody else calculated.' },
  { key:'outlier', label:'Outlier evidence', hint:'Modelled on a real video with 100,000+ views, under 100,000 subscribers on that channel, a 5:1+ view-to-sub ratio, and visibly weak packaging. Needs the actual stats in the notes to confirm — flag as needing research if absent.' },
  { key:'comments', label:'Comment-mined gap', hint:'A specific unanswered question or frustration pulled from that outlier video\'s comments that this idea fills. Needs research if no comment data is provided.' },
  { key:'video_type', label:'Video type fits funnel', hint:'Listicle → How to → Case study → Testimonial, matching where this channel currently is in its funnel — not defaulting to the same type every time.' },
  { key:'revenue_tier', label:'Revenue-tier awareness', hint:'A deliberate choice between mass-market explainer territory (lower pay per view) and a sharper, higher-value angle (higher pay per view) — not an accident.' },
]
