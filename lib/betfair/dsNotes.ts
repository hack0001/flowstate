// Lessons from Betfair's Data Scientists hub (betfair-datascientists.github.io) and related
// research, in plain English, with what FlowState does about each. Shown on the Research tab.

export type DsNote = { title: string; plain: string; forUs: string; link: string; source: string }

export const DS_NOTES: DsNote[] = [
  {
    title: 'The golden rules of automation',
    plain: 'Study how money builds up in a market before automating. Only use information you would have had when the bet went on (the final SP is the classic mistake). Keep it simple and test on data you didn\'t use to find the idea. Be sceptical of good backtests: assume realistic fills and paper trade first. Plan staking and limit total exposure. Log everything and have a kill switch.',
    forUs: 'The scout checks every rule on later months it wasn\'t found on and refuses filters that use future prices; systems go to a paper bot before real money. Still to add before betting for real: exposure limits and a kill switch.',
    link: 'https://betfair-datascientists.github.io/tutorials/goldenRulesOfAutomation/', source: 'Betfair Data Scientists: Golden rules of automation',
  },
  {
    title: 'Betfair SP is the most accurate price, but only just',
    plain: 'Measured by log loss (how well prices predicted winners), Betfair SP beat the prices at the off and 30, 60, 90 and 120 seconds before, but the gaps were tiny. Prices get slightly sharper as the off approaches.',
    forUs: 'The same as our scout found for GB and IE racing: backing earlier doesn\'t beat SP on average. Edges have to come from somewhere more specific.',
    link: 'https://betfair-datascientists.github.io/tutorials/analysingAndPredictingBSP', source: 'Betfair Data Scientists: Analysing and predicting BSP',
  },
  {
    title: 'The best single price: the geometric midpoint',
    plain: 'The "true" price of a horse at any moment is best estimated by the geometric midpoint of the best back and lay prices: the square root of back × lay. Back 4.0 and lay 4.4 give √(4.0 × 4.4) ≈ 4.2. It beat the best back price, the best lay price, the last traded price and Betfair\'s projected SP at estimating the final SP.',
    forUs: 'The last traded price jumps between the back and lay side with every trade, which looks like movement when nothing has really changed. The scout now uses the midpoint on your recordings (which have back and lay prices), so fewer false signals.',
    link: 'https://betfair-datascientists.github.io/tutorials/analysingAndPredictingBSP', source: 'Betfair Data Scientists: Analysing and predicting BSP',
  },
  {
    title: 'Price-based angles without a model',
    plain: 'Assume the market is mostly right and look for specific exceptions, using prices at set times (a volume-weighted back price 5 minutes and 30 seconds out), traded volume, track, distance, draw, jockey and trainer. Hold back the last few months to paper-trade candidates; use p-values but don\'t rely on them alone. Leads found: certain track/distance/draw combinations to lay; jockeys combined with whether their horse shortened or drifted in the last 5 minutes ("jockey plus market support"); and backing at SP then laying at half the SP in-running for certain jockeys. Test samples were small (224 to 375 bets).',
    forUs: 'Jockey plus market support is now in the scout, using the jockeys and prices in your recordings (it needs a few months of recordings to say much). The in-running lay needs in-running prices from the live key.',
    link: 'https://betfair-datascientists.github.io/tutorials/automatedBettingAnglesTutorial', source: 'Betfair Data Scientists: Automated betting angles in Python',
  },
  {
    title: 'Tick by tick, moves partly reverse',
    plain: 'A study of Betfair horse racing tick data found returns strongly negatively correlated at lag 1 (a move tends to be followed by a move back), fading within a few ticks, with gains and losses balanced and volatility clustering. Prices absorb news quickly.',
    forUs: 'The same bounce-back the scout finds over minutes (fade-drift), but at the scale of seconds; trading that needs real-time prices (the live key).',
    link: 'https://arxiv.org/pdf/2402.02623', source: 'Efficient market dynamics in UK horse racing (arXiv 2402.02623)',
  },
  {
    title: 'Realistic simulation: flumine',
    plain: 'Betfair\'s data scientists use flumine, a free Python framework, to run strategies on historical stream data with realistic matching (queue position, partial fills) before going live.',
    forUs: 'Worth adopting once you have the live key or Pro data, for trading strategies where queue position matters.',
    link: 'https://betfair-datascientists.github.io/tutorials/How_to_Automate_1', source: 'Betfair Data Scientists: How to automate (flumine)',
  },
]
