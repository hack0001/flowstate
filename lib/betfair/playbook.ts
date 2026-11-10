// ============================================================
// Betfair desk -- research notes and strategy write-ups (plain data, safe
// to import from client components).
//
// Source: the archived Sports Hacker blog ("Code :: Data :: Capital",
// sportshacker.net, Oct 2013 - Aug 2014) and the matching Python scripts.
// Explanations are written fresh in plain English; each one names the
// article(s) and script(s) it comes from so the original can be checked.
// ============================================================

export type Source = { article: string; date: string }
export type Concept = {
  id: string; group: string; title: string
  plain: string             // the idea in plain English
  example?: string          // a worked number, taken from the article where it gives one
  onBetfair: string         // why it matters on the exchange / how this desk uses it
  caution?: string
  sources: Source[]; scripts?: string[]
  usedBy?: ('dc' | 'bands' | 'form')[]
}

export const GROUPS = ['Pricing a match', 'Rating teams', 'Finding value', 'Season and tournament markets', 'Options thinking', 'How the market works'] as const

const A = {
  grids: { article: 'Of Poisson Models and Correct Score Grids', date: '6 Nov 2013' },
  simpleDC: { article: 'A Simple Dixon Coles Model', date: '14 Nov 2013' },
  implied1: { article: 'Implied Market Ratings (Part I)', date: '27 Nov 2013' },
  finpos: { article: 'Simulating Finishing Positions', date: '4 Dec 2013' },
  impliedPL: { article: 'Implied Premier League Ratings', date: '11 Dec 2013' },
  remix: { article: 'Remixing Oddschecker', date: '19 Dec 2013' },
  limits: { article: 'Poisson Model Limitations', date: '31 Dec 2013' },
  longshot: { article: 'Longshot Bias', date: '7 Jan 2014' },
  dcAdj: { article: 'The DC Adjustment', date: '12 Jan 2014' },
  runIn: { article: 'The Run-In', date: '27 Jan 2014' },
  backtest: { article: 'Backtesting Sports Strategies', date: '13 Feb 2014' },
  valueFilter: { article: 'A 1x2 Value Filter', date: '2 Mar 2014' },
  whatsapp: { article: 'Why Betfair should fear Whatsapp', date: '14 Mar 2014' },
  commission: { article: 'Commission Apples and Oranges', date: '25 Mar 2014' },
  autoBet: { article: 'Automating Bet Placement', date: '10 Apr 2014' },
  worldCup: { article: 'World Cup Survival Factors', date: '27 Jun 2014' },
  optionNut: { article: 'Different Ways to Crack an Option-Sized Nut', date: '9 Jul 2014' },
  blackScholes: { article: 'Black Scholes and Sports Hedges', date: '24 Jul 2014' },
  heatmap: { article: 'Return of the Heatmap', date: '31 Jul 2014' },
  handicaps: { article: 'Pricing Season Handicaps', date: '3 Aug 2014' },
  antepost: { article: 'Filtering Antepost Prices', date: '28 Oct 2013' },
  comparing: { article: 'Comparing Soccer Finishing Positions', date: '1 Oct 2013' },
  api: { article: 'Wrestling the Betfair API', date: '7 Oct 2013' },
} satisfies Record<string, Source>

export const CONCEPTS: Concept[] = [
  // ------------------------------------------------ Pricing a match
  {
    id: 'poisson', group: 'Pricing a match', title: 'Goals follow a Poisson pattern',
    plain: 'If a team averages a certain number of goals, the Poisson distribution tells you how likely 0, 1, 2, 3… goals are in one match. One number per team (its expected goals for this game) is enough to describe the whole spread.',
    example: 'A team expected to score 2 goals will still score exactly 2 only about 27% of the time, and blank about 14% of the time.',
    onBetfair: 'It turns "who is better" into probabilities you can compare with a price. Every football model on this desk starts here.',
    caution: 'The article itself notes that bookmakers publish this method, so using it naively is not an edge.',
    sources: [A.grids], scripts: ['sportshacker_testing.py', 'sportshacker_options.py', 'poisson_regression.py'], usedBy: ['dc'],
  },
  {
    id: 'grid', group: 'Pricing a match', title: 'One score grid prices every goals market',
    plain: 'Multiply the home team\'s goal probabilities by the away team\'s and you get a table with the chance of every scoreline. Add up the right cells and you have match odds (home cells, the draw diagonal, away cells), over/under goals, Asian handicaps and correct score, all consistent with each other.',
    example: 'With expected goals of 2.5 and 1.5 the grid gives home 59.4%, draw 18.6%, away 22.0%, peaking at 2-1.',
    onBetfair: 'Match Odds, Over/Under and Correct Score are separate Betfair markets on the same match. The grid says what each should be given the others, which is how you spot one that is out of line.',
    sources: [A.grids, A.limits], scripts: ['sportshacker_options.py', 'poisson_model_limitations.py'], usedBy: ['dc'],
  },
  {
    id: 'calibrate', group: 'Pricing a match', title: 'Reading expected goals out of the market',
    plain: 'Instead of rating teams yourself, work backwards: find the two expected-goals numbers whose grid reproduces the market\'s own match odds. The gap between the two numbers reflects the difference in ability; their size sets how likely a draw is (low-scoring games draw more).',
    example: 'Match odds of 50% / 30% / 20% (home / draw / away) imply expected goals of about 1.24 and 0.67. This desk\'s solver reproduces that figure.',
    onBetfair: 'The desk does this with live Betfair prices a few minutes before kick-off, so the model starts from what the market already believes.',
    sources: [A.grids], scripts: ['sportshacker_testing.py', 'sportshacker_options.py'], usedBy: ['dc'],
  },
  {
    id: 'overround', group: 'Pricing a match', title: 'Strip the margin before comparing',
    plain: 'Add up the implied probabilities (1 ÷ price) of every outcome and you get more than 100%. The excess is the overround: the seller\'s margin. Divide each probability by the total to get fair probabilities that sum to 100%.',
    example: 'The article finds a headline margin of about 2% at Pinnacle against about 5% at a high-street bookmaker on the same markets.',
    onBetfair: 'On the exchange the equivalent is the gap between back and lay. The desk takes the midpoint of back and lay, then scales each market to 100%, and ignores any price where the gap is wider than 8%.',
    sources: [A.limits, A.commission], scripts: ['football_data.py', 'value_filter.py'], usedBy: ['dc', 'bands', 'form'],
  },
  {
    id: 'poisson-limits', group: 'Pricing a match', title: 'Where plain Poisson goes wrong',
    plain: 'Fit the plain model to match odds and it prices handicaps well, but gets total-goals markets badly wrong: it makes low scores too likely, so "under" looks too probable and "over" too unlikely. In short, it is good at the difference between the scores and poor at their sum.',
    example: 'On one match the plain model made Over 2.5 a 44% chance when the market had it near 58%. The author scores the plain model 6 out of 10.',
    onBetfair: 'A reminder that a model disagreeing with the market usually means the model is wrong. This is the failure the Dixon-Coles adjustment fixes.',
    sources: [A.limits], scripts: ['poisson_model_limitations.py'], usedBy: ['dc'],
  },
  {
    id: 'dc-adjust', group: 'Pricing a match', title: 'The Dixon-Coles low-score fix (rho)',
    plain: 'Dixon and Coles (1997) added one extra number, rho, that nudges the probability of just four scorelines: 0-0, 1-0, 0-1 and 1-1. It shifts weight between draws and one-goal wins without changing anything else. Fit the grid to match odds plus the Over/Under 2.5 price and it then lines up with the other goal lines and correct scores too.',
    example: 'The fitted rho came out around −0.1 on three different matches (−0.14, −0.12, −0.09), and model prices landed within a point or two of the market across all goal lines.',
    onBetfair: 'This is the pricing engine behind the Cross-market value test: fit to two liquid markets, then check the less liquid ones against it.',
    caution: 'The article shows the model can match the market. It does not show that the leftover differences are profitable. That is exactly what the paper test is for.',
    sources: [A.dcAdj], scripts: ['dc_adjustment_sportshacker.py', 'deigo_costa_adjust.py', 'dixon_coles_parameters.py'], usedBy: ['dc'],
  },
  {
    id: 'asian', group: 'Pricing a match', title: 'Asian handicaps in one paragraph',
    plain: 'A handicap adds goals to one side before settling. Half lines (−0.5, +1.5) can never draw. Whole lines (0, −1) refund your stake if the adjusted score is level (a "push"). Quarter lines (−0.75) split your stake between the two neighbouring lines. Match odds are just the zero-handicap case.',
    onBetfair: 'Betfair\'s Draw No Bet and Asian Handicap markets work this way. The desk does not trade them yet, but the article suggests them as the clean way to remove the draw from a bet.',
    sources: [A.limits, A.grids, A.backtest], scripts: ['sportshacker_options.py', 'poisson_model_limitations.py'],
  },

  // ------------------------------------------------ Rating teams
  {
    id: 'ratings-mle', group: 'Rating teams', title: 'Ratings from results (maximum likelihood)',
    plain: 'Give every team a strength rating, use the ratings to predict each past scoreline, and keep adjusting the ratings until the actual results are as "unsurprising" as possible. Unlike the league table, this rewards how well you played, not just whether you scraped three points.',
    example: 'On 2012/13 Premier League results the model rated Southampton 8th although they finished 14th, ahead of their strong following season.',
    onBetfair: 'Gives you an opinion that is independent of the market, which is the only kind you can find value with. Not automated on this desk yet: it needs a results feed.',
    caution: 'The article simplifies the real model to one rating per team (attack and defence tied together) and fixes home advantage at 1.3. The author says to treat it as a platform to experiment on, not a finished product.',
    sources: [A.simpleDC], scripts: ['dixon_coles_rating.py', 'max_likelihood_est.py', 'opis_maximum_likelihood.py', 'likelihood_tester.py'],
  },
  {
    id: 'expected-points', group: 'Rating teams', title: 'Expected points: one number per team per game',
    plain: 'Turn match odds into the points a team is expected to earn: 3 × chance of winning + 1 × chance of drawing. Averaged over a full set of fixtures it becomes "points per game", a rating between 0 and 3 that anyone can read.',
    example: 'Prices of 2.0 / 3.33 / 5.0 mean 50% / 30% / 20%, so the home side is expected to take 1.8 points and the away side 0.9.',
    onBetfair: 'The Form test uses this: after each match it records actual points minus expected points for both teams.',
    sources: [A.simpleDC, A.impliedPL, A.backtest], scripts: ['dixon_coles_rating.py', 'implied_prem_ratings.py'], usedBy: ['form'],
  },
  {
    id: 'implied-ratings', group: 'Rating teams', title: 'Implied ratings: what the market thinks of each team',
    plain: 'Fit ratings to recent match prices instead of results. You get the market\'s current opinion of every team. Results-based ratings look backwards at performance; implied ratings look forwards at expectations. The author compares it to implied volatility in options: a hidden number recovered from visible prices.',
    example: 'Six weeks of prices is enough for stable ratings. The draw is modelled as a curve that peaks near 30% when teams are evenly matched and falls away as the gap grows (typical error about 1 percentage point).',
    onBetfair: 'Useful for predicting where a price will open before the market is liquid, and for seeing what is already "priced in". By construction it cannot tell you the market is wrong about a match.',
    sources: [A.implied1, A.impliedPL], scripts: ['implied_market_ratings.py', 'implied_prem_ratings.py'],
  },
  {
    id: 'run-in', group: 'Rating teams', title: 'Fixture difficulty (the run-in)',
    plain: 'Work out a team\'s expected points per game over its remaining fixtures and compare with its figure over a whole season. The difference is how much easier or harder the run-in is than average.',
    example: 'With 16 games left in 2013/14, Swansea\'s remaining schedule was worth about 2.5 points more than Arsenal\'s. Team quality still mattered far more than schedule.',
    onBetfair: 'Relevant to season-long markets (winner, top four, relegation), where the schedule effect is small but not zero.',
    sources: [A.runIn],
  },

  // ------------------------------------------------ Finding value
  {
    id: 'value-filter', group: 'Finding value', title: 'A model as a value filter',
    plain: 'Run every available price past a model and keep only the few where the model\'s probability is higher than the price implies. The point is not that the model is always right; it is to throw away the 90–95% of bets that are certainly paying margin and look hard at the rest.',
    example: 'From 100 season-market prices the filter kept 10. On La Liga match prices it flagged a home side at 2.05 that the model made 1.57.',
    onBetfair: 'All three paper tests are value filters with a fixed rule, so the result can be measured instead of argued about.',
    caution: 'The article never checks whether the flagged bets won. A filter\'s output is a hypothesis until it has been tested on enough bets.',
    sources: [A.valueFilter, A.antepost], scripts: ['value_filter.py', 'implied_prem_ratings_part2.py', 'get_odds.py', 'name_match.py'], usedBy: ['dc'],
  },
  {
    id: 'early-prices', group: 'Finding value', title: 'Early prices are softer',
    plain: 'Most bookmakers only price matches about a week ahead, once the exchange is liquid, because there is safety in copying. A few post prices weeks early for extra margin, with nothing to lean on. Those early prices are where a model has the best chance of being ahead.',
    example: 'The author found three firms pricing some leagues up to 30 days out while the pack waited for Betfair.',
    onBetfair: 'The natural check is closing-line value: did the price move your way by kick-off? Not tested here yet, because the desk only looks at markets minutes before the start.',
    caution: 'The same article warns these bookmakers limit or close winning accounts quickly.',
    sources: [A.remix, A.valueFilter],
  },
  {
    id: 'longshot-bias', group: 'Finding value', title: 'Favourite–longshot bias',
    plain: 'Across several season-long markets the author\'s model kept finding the same pattern: favourites priced a little too generously, longshots priced too short. Suggested reasons: punters like small stakes for big payouts, bookmakers charge extra to avoid rare big losses, and backing a favourite ties money up for months.',
    example: 'Promotion markets: one favourite was 67% in the market but 85% in the model, while most outsiders were priced above their model chance.',
    onBetfair: 'The Favourite vs longshot test measures whether the same tilt exists in Betfair match odds, where there is no bookmaker setting the price.',
    caution: 'The evidence is one model against one set of prices, in long-term markets. The author allows that the model could simply be wrong.',
    sources: [A.longshot], usedBy: ['bands'],
  },
  {
    id: 'commission', group: 'Finding value', title: 'Commission: on stakes or on winnings',
    plain: 'A bookmaker\'s margin is paid on every stake, win or lose. Betfair\'s commission is paid only on net winnings. Weighted by how often you win, exchange commission costs most around even money and least on strong favourites and big outsiders.',
    example: 'Rule of thumb from the article: 2% on stakes costs about the same as 4% on winnings. Betfair at 5% beats a 2% stake margin once the selection is more than about 60% likely.',
    onBetfair: 'Every result on this desk is shown after 5% commission on winning bets. Change STRAT.commission to your own rate.',
    caution: 'The article excludes anyone paying Betfair\'s Premium Charge.',
    sources: [A.commission], usedBy: ['dc', 'bands', 'form'],
  },
  {
    id: 'backtesting', group: 'Finding value', title: 'Test the rule, not the tipster',
    plain: 'Judge a strategy by running a fixed rule over many matches, never by a short winning streak. With enough tipsters a few will always look brilliant by luck (survivorship bias). The article builds a small backtester: a signal, a staking rule, and a profit curve.',
    example: 'The signal is a 6-game moving average of actual points minus expected points. Momentum backs the team running hot; mean reversion ("bouncebackability") backs the team running cold.',
    onBetfair: 'This is the reason the Strategies tab has sample-size targets and a pass/fail rule fixed before any bet is placed.',
    caution: 'The author\'s own backtest did well in the Premier League and much less well in Germany, Italy and Spain in the same season: "you didn\'t think it was going to be that easy, did you?"',
    sources: [A.backtest], scripts: ['bouncebackability.py (a start only: it loads the data)'], usedBy: ['form'],
  },
  {
    id: 'draw-cover', group: 'Finding value', title: 'Taking the draw out of a bet',
    plain: 'A bet on one team loses on a draw. Add a small bet on the draw sized so that its winnings repay the main stake, and a draw now costs nothing. The combined position is "this team to beat that one".',
    example: 'Draw stake = main stake ÷ (draw price − 1). £10 on a team with the draw at 3.5 needs £4 on the draw.',
    onBetfair: 'The Form test does exactly this, so each match is judged as one position.',
    sources: [A.backtest], usedBy: ['form'],
  },

  // ------------------------------------------------ Season and tournament markets
  {
    id: 'season-sim', group: 'Season and tournament markets', title: 'From season points to finishing positions',
    plain: 'Spread-betting firms quote expected season points for every team. Simulate the rest of the season thousands of times around those numbers, rank the teams each time, and you get the chance of each team finishing in each position: a heatmap of the league.',
    example: 'Mid-table teams have the widest range of outcomes because they collect 0s, 1s and 3s; the best and worst teams are more predictable.',
    onBetfair: 'Winner, Top 4 and Relegation markets on Betfair are all sums of those position probabilities, so one simulation prices all of them.',
    caution: 'The author flags the model as rough: flat 30% draw chance, no goal difference, and (in the first version) no fixture list.',
    sources: [A.finpos, A.comparing, A.heatmap, A.antepost],
  },
  {
    id: 'relative-value', group: 'Season and tournament markets', title: 'Relative value, and hedging with the related market',
    plain: 'If a relegation price looks cheap compared with the same team\'s season-points quote, it is cheap relative to that quote, not cheap in absolute terms. The matching trade is to take the cheap side and offset it in the related market, so you are betting on the gap closing, not on the team.',
    example: 'The article\'s example: buy a team for relegation and buy its season points against it. Season handicap markets priced the same way showed the largest disagreements between firms on just two teams.',
    onBetfair: 'The Cross-market value test is a relative-value bet without the hedge: it assumes Match Odds and Over/Under 2.5 are right and bets the other markets back towards them.',
    sources: [A.antepost, A.handicaps], usedBy: ['dc'],
  },
  {
    id: 'survival', group: 'Season and tournament markets', title: 'Knockout tournaments without simulation',
    plain: 'In a knockout draw you know who each team can meet in each round. A team\'s chance of surviving a round is its chance of beating each possible opponent, weighted by that opponent\'s chance of having got that far. Work forward round by round and you have every team\'s chance of reaching each stage, exactly.',
    example: 'Fitted to index prices for the 2014 World Cup last 16, the model made Argentina and Brazil about 21% each to win, Germany about 19%.',
    onBetfair: 'A way to check "to reach the final" and outright prices against each other during a tournament.',
    caution: 'The ratings come from one firm\'s prices, so the output is internally consistent, not an independent view.',
    sources: [A.worldCup],
  },

  // ------------------------------------------------ Options thinking
  {
    id: 'binary-option', group: 'Options thinking', title: 'A bet is a binary option',
    plain: 'A fixed-odds bet pays a set amount or nothing, which is what finance calls a binary option. Borrowing the options toolkit shows how the bet\'s value reacts to time passing and to the underlying event moving, even though you would not price a bet with the Black-Scholes formula itself.',
    example: 'An in-play price behaves like an option nearing expiry: if nothing happens, the leader\'s price drifts steadily shorter (time decay); close to the end, one goal swings it violently (high gamma).',
    onBetfair: 'Explains why in-play hedging gets harder, not easier, late in a tight game, and why the racing desk closes every position before the off.',
    sources: [A.blackScholes, A.backtest], scripts: ['black_scholes_sports_hedge.py'],
  },
  {
    id: 'monte-carlo', group: 'Options thinking', title: 'If the maths is opaque, simulate it',
    plain: 'The author prices the same option three ways: the closed formula, a step-by-step tree and brute-force simulation. All three agree, and the simulation is by far the easiest to understand and check. The message: when a formula is beyond you, simulate the thing many times and count.',
    example: 'All three methods price the test option at about 4.76; the author rates their transparency 1/10, 4/10 and 9/10.',
    onBetfair: 'The demo mode on this desk follows the same principle: an invented fair market, so you can see what "no edge" looks like before trusting a result.',
    sources: [A.optionNut], scripts: ['crack_option_nut.py'],
  },

  // ------------------------------------------------ How the market works
  {
    id: 'exchange', group: 'How the market works', title: 'Exchange vs bookmaker',
    plain: 'On an exchange you can back or lay against other customers and the firm takes commission; a bookmaker sets prices and takes the other side. Exchanges welcome programs through an API. Bookmakers, the author argues, would rather not serve customers who can write one.',
    example: 'The author estimated Betfair was handling roughly 30 million bets a day in early 2014.',
    onBetfair: 'This desk uses Betfair\'s current API with a free delayed key, read-only.',
    caution: 'The article\'s code targets Betfair\'s old SOAP API, which has since been replaced. A separate article scripts a bookmaker\'s website to place bets; that is likely to breach the bookmaker\'s terms and is deliberately not carried over.',
    sources: [A.api, A.autoBet, A.whatsapp],
  },
  {
    id: 'liquidity', group: 'How the market works', title: 'Sports liquidity is a mile wide and an inch deep',
    plain: 'Shares trade for years in a few thousand names. Sports markets appear shortly before an event, fill up quickly and vanish afterwards. So a sports strategy is the same short experiment repeated over many matches, and the money available at a price is limited.',
    onBetfair: 'Why the desk only uses a match once at least £20,000 has been matched on it, requires £10 to be available at the price it takes, and counts results over hundreds of matches.',
    sources: [A.backtest, A.remix],
  },
]

// ------------------------------------------------------------------ strategies
export type StrategyInfo = {
  id: 'dc' | 'bands' | 'form'; name: string; oneLine: string; hypothesis: string
  concepts: string[]; rules: string[]; measure: string; pass: string; fail: string; honest: string
}

export const STRATEGIES: StrategyInfo[] = [
  {
    id: 'dc', name: 'Cross-market value', oneLine: 'Does a Dixon-Coles grid find mispriced goals markets?',
    hypothesis: 'If Match Odds and Over/Under 2.5 are priced correctly, a Dixon-Coles score grid fitted to them says what Over/Under 1.5, Over/Under 3.5 and Correct Score should be. Prices that disagree by more than costs are value.',
    concepts: ['grid', 'calibrate', 'dc-adjust', 'relative-value', 'value-filter'],
    rules: [
      'When: a football match 1–12 minutes before kick-off with at least £20,000 matched on Match Odds.',
      'Fit: expected goals and rho to Betfair\'s Match Odds and Over/Under 2.5 (midpoint of back and lay, margin removed).',
      'Bet: in each of Over/Under 1.5, Over/Under 3.5 and Correct Score, take the single price with the highest expected value, if that is at least 3% after commission. Back or lay, prices up to 10.0 only.',
      'Stake: £10 paper stake (for a lay, £10 backer\'s stake). Held to the final whistle.',
    ],
    measure: 'Return on money risked after 5% commission, per settled bet.',
    pass: '500 settled bets, return above zero, and a t-score of 2 or more.',
    fail: 'Return at or below zero at 500 bets, or still not distinguishable from luck at 1,000.',
    honest: 'The likeliest outcome is a fail: where the grid and the market disagree, the market is usually the one that is right, and correct-score spreads are wide.',
  },
  {
    id: 'bands', name: 'Favourite vs longshot', oneLine: 'Do short prices return more than long prices on Betfair?',
    hypothesis: 'Longshots are over-bet and favourites under-bet, so backing odds-on selections loses less (or wins more) per pound than backing outsiders.',
    concepts: ['longshot-bias', 'commission', 'overround'],
    rules: [
      'When: the same matches as above, at the same moment.',
      'Bet: back all three Match Odds selections at the best available price, £10 each.',
      'Label each bet by price: odds-on (below 2.0), middle (2.0 to 5.0), longshot (above 5.0).',
      'This is a measurement, not a trading plan: backing everything guarantees a small loss overall. The question is which band loses least.',
    ],
    measure: 'Return in each band before commission, and the gap between odds-on and longshot. (Commission is a share of winnings, which costs more per pound at long prices, so comparing after commission would show a gap even in a fair market.)',
    pass: '400 settled bets in both the odds-on and longshot bands, odds-on return higher, t-score of the gap 2 or more.',
    fail: 'No gap, or the wrong way round, at 400 each; or still unclear at 800 each.',
    honest: 'Longshot results swing wildly, so this needs the most patience. A pass tells you which prices to avoid; it only becomes a strategy if odds-on is also profitable after commission.',
  },
  {
    id: 'form', name: 'Bounce-back', oneLine: 'Do teams on a bad run against expectations bounce back?',
    hypothesis: 'A team that has taken fewer points than the market expected over its last 6 games is under-rated next time out (mean reversion, the article\'s "bouncebackability").',
    concepts: ['expected-points', 'backtesting', 'draw-cover'],
    rules: [
      'Record: after every tracked match, actual points minus the points the closing Betfair prices expected, for both teams.',
      'When: both teams have 6 recorded games and their 6-game averages differ by at least 0.5 points per game.',
      'Bet: back the team with the lower average, £10, and back the draw for £10 ÷ (draw price − 1) so a draw breaks even.',
      'The two bets count as one position per match.',
    ],
    measure: 'Return on money risked after commission, per match.',
    pass: '200 settled matches, return above zero, and a t-score of 2 or more.',
    fail: 'Return at or below zero at 200 matches, or still not distinguishable from luck at 400.',
    honest: 'It cannot place a bet until both teams have six tracked games, so expect several weeks of collecting before the first one. The article\'s own backtest did well in one league and much less well in three others.',
  },
]

export const COVERAGE = {
  analysed: 23, skippedTech: 15, notOpened: 2, scripts: 26,
  note: 'Analysed: the 23 articles on models, value, markets and options. Not analysed: 15 articles on programming and infrastructure (Erlang, React, Go, scraping, hosting) plus the site index. Two files that looked like personal account documents were not opened.',
}
