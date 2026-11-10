# Betfair paper desk (`/betfair`)

Six agents (Scout, Filter, Analyst, Executor, Risk, Logger) trading GB/IE horse-racing win markets **on paper**. It reads live Betfair prices and never places a real bet: the client only calls `listMarketCatalogue` and `listMarketBook`.

## Files

| File | What it does |
|---|---|
| `lib/betfair/engine.ts` | The agents, tick ladder, settings (`CONFIG`) and the demo price simulator. Pure, no I/O |
| `lib/betfair/live.ts` | Read-only Betfair REST client (login + two read calls) |
| `lib/betfair/run.ts` | Loads bot state from Supabase, runs one poll, saves trades and log lines |
| `app/api/betfair/route.ts` | Page API: snapshot, start, stop, reset, one poll |
| `app/api/betfair/cron/route.ts` | Optional background runner (needs Vercel Pro) |
| `app/betfair/page.tsx` | The terminal-style desk |
| `supabase/migrations/050_betfair_paper.sql` | Tables `bf_bot`, `bf_trades`, `bf_events`, owner-only RLS |

## Setup

1. Run `supabase/migrations/050_betfair_paper.sql` in the Supabase SQL editor.
2. Deploy. Open **Betfair Desk** from the home page and press **Start demo** to try it with simulated prices.
3. For live prices, add these in Vercel → Settings → Environment Variables, then redeploy:
   - `BF_USERNAME`, `BF_PASSWORD`: your Betfair login
   - `BF_APP_KEY`: a free **delayed** app key from developer.betfair.com
4. Switch to **Live prices** and press **Start**.

The API routes are pinned to London (`preferredRegion = 'lhr1'`) because Betfair refuses logins from US IPs, Vercel's default.

## How it runs

While the page is open and running, it asks the server for one poll every 5 seconds (2s in demo). Close the tab and it pauses; open it again and it carries on from where it was. State lives in Supabase.

To keep it running with the tab closed you need Vercel Pro (Hobby allows one cron a day). Add to `vercel.json`:

```json
{ "path": "/api/betfair/cron", "schedule": "* * * * *" }
```

It uses the existing `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.

## Settings

Edit `CONFIG` in `engine.ts`: stake %, stop/target/trail in ticks, commission (set to your market base rate), minimum analyst score.

## Reading the results honestly

Paper fills assume you get the price shown. With a delayed key that price may already be gone, so real results will usually be worse. Judge it on hundreds of trades and a positive expectancy after commission, not a good night.

## Research and Strategies tabs

- **Research** (`lib/betfair/playbook.ts`, `components/betfair/ResearchTab.tsx`): 24 betting ideas from the archived Sports Hacker articles, in plain English, each naming its article and script.
- **Strategies** (`lib/betfair/strategies.ts`, `stratRun.ts`, `football.ts`, `components/betfair/StrategiesTab.tsx`, `app/api/betfair/strategies`): three football paper tests with fixed rules and a pass/fail verdict.
  - Cross-market value: Dixon-Coles grid fitted to Match Odds + Over/Under 2.5, checked against other goals markets.
  - Favourite vs longshot: returns by price band.
  - Bounce-back: back teams under-performing market expectations, draw covered.

Run `supabase/migrations/051_betfair_strategies.sql` before first use. Settings are in `STRAT` at the top of `strategies.ts`. Live mode looks once a minute while the page is open (or via the cron on Vercel Pro) and only reads prices.
