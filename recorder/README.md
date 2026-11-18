# FlowState Betfair recorder

A small always-on program that runs on its own server in London. It:

- **records GB and IE horse racing prices**: every runner's best back and lay prices, the money available and the last traded price. That's every minute from 75 minutes before the off, every 30 seconds from 30 minutes, and every 5 seconds in the last 10 minutes until the race goes off. A snapshot is skipped when nothing moved.
- **saves race details for breakdowns**: race type, the race name (distance, class, handicap), venue, country, runners, jockeys, trainers, ages, weights, official ratings, stalls, forecast prices, total matched, the time of the off, winners, non-runners and Betfair Starting Prices (if your key provides them).
- **keeps the Desk and Strategies paper bots running** after you press Start in FlowState, so the tab can be closed.
- **archives** each day older than a week into one compressed file in Supabase Storage (about a tenth of the size). Downloads and replays in FlowState read those files automatically.
- **writes a heartbeat**, so FlowState's Data and Setup tabs show whether it's online and flag any gaps.

**Paper only.** It can call only Betfair's two read-only operations (listing markets and reading prices), and there is no bet-placing code anywhere in FlowState.

## How it copes with failures

- Every request to Betfair or Supabase has a 15-second time limit and is retried with a pause on network trouble. One failed request skips one check; nothing else stops.
- If Supabase is unreachable, writes wait in order (copied to disk every 30 seconds while they're waiting) and go through when it's back. Duplicate snapshots are ignored, so retries are safe.
- If Betfair refuses the login (wrong password or key, or a locked account), it pauses logins for 30 minutes rather than retrying and getting the account locked.
- If the program crashes or the server reboots, systemd starts it again within 10 seconds.
- Each minute it records how many checks worked and failed, so FlowState can show where prices are missing.

## Costs, and what stops a bug running them up

| Service | What a bug could cost | Why |
|---|---|---|
| AWS Lightsail | Nothing beyond the monthly price | Fixed price; CPU is included. Only outbound data past the plan's allowance (1 to 2 TB a month) is charged, and the recorder uses a few GB. |
| Betfair | Nothing | Reading prices is free. Too many requests get refused for a while, not charged. |
| Supabase (free plan) | Nothing | Free projects aren't billed; going over a limit restricts the project instead. On a paid plan, keep the spend cap switched on. |
| Vercel | Nothing | The recorder never calls your Vercel app. |

Built-in limits on top of that (`src/guard.ts`):

- **Only Betfair and your Supabase project can be contacted.** Any other address is refused.
- **At most 8 requests a second to Betfair and 15 to Supabase.** Extra requests wait their turn instead of bursting.
- **At most 100,000 Betfair and 200,000 Supabase requests a day**, about three times a busy day. If a bug ever hits a limit, the recorder stops contacting that service until midnight UK time, and FlowState's Data and Setup tabs show why.
- **Logins are spaced at least a minute apart, even across restarts**, and a refused login pauses logins for 30 minutes.
- **Disk use is capped:** pending writes are limited, and system logs are size-limited by Ubuntu.

For peace of mind, add an AWS budget alert (free): AWS console → **Billing and Cost Management → Budgets → Create budget → Monthly cost budget**, set $10, and add your email. AWS then emails you if the month's bill heads past it.

## Set it up (about 20 minutes)

### 1. Supabase

1. In the Supabase SQL editor, run `supabase/migrations/053_betfair_recorder.sql`. It adds the recorder's tables and the private `betfair-archive` storage bucket. It also removes the old once-a-minute schedule if you ever ran it.
2. In Supabase, go to **Project Settings → API Keys** and copy:
   - your **Project URL** (`https://xxxx.supabase.co`)
   - the **secret key**, labelled `service_role` on older projects. Not the anon/publishable key. It lets the recorder write without being logged in as you, so it only ever goes on the server.

### 2. Push FlowState

Commit and push in GitHub Desktop. The server downloads the recorder from GitHub, so it must be there first.

### 3. Create the server (AWS Lightsail)

1. Go to **lightsail.aws.amazon.com** and choose **Create instance**.
2. **Instance location:** London, Zone A (eu-west-2a). It must be in the UK or Ireland because Betfair blocks logins from some countries, including the US.
3. **Platform:** Linux/Unix. **Blueprint:** OS Only → **Ubuntu 24.04 LTS**.
4. **Plan:** the **$7/month** plan (1 GB memory, with an IPv4 address). The $5 plan (512 MB) also works; the setup adds swap space to help. New Lightsail accounts usually get the first three months free on these plans.
5. Name it `flowstate-recorder` and choose **Create instance**.
6. When it's running, open it, go to the **Networking** tab and, under both IPv4 and IPv6 firewall, **delete the HTTP (80) rule**. Keep SSH (22). The recorder accepts no incoming connections at all.

### 4. Install the recorder

1. On the instance page, choose **Connect using SSH**. A terminal opens in your browser.
2. Paste these two lines and press Enter:

   ```
   curl -fsSL https://raw.githubusercontent.com/hack0001/flowstate/main/recorder/deploy/setup.sh -o setup.sh
   sudo bash setup.sh
   ```

3. When asked, enter:
   - your Betfair username, password and app key (the `1.0-DELAY` one)
   - the Supabase Project URL and secret key

   Passwords and keys are hidden as you type. They're saved in `/etc/flowstate-recorder.env`, readable only by root and the recorder.

4. The script runs a setup check (Betfair login, Supabase tables, writes, archive bucket) and, if everything passes, starts the recorder. If something fails it says what; fix it and run `sudo bash setup.sh` again.

### 5. Check it in FlowState

Open Betfair Desk → **Data** or **Setup**. The recorder line should turn green within a minute, and "Races" and "Price snapshots" start rising as the day's races come within 75 minutes of the off.

## Day to day

| To… | Run on the server |
|---|---|
| Watch what it's doing | `sudo journalctl -u flowstate-recorder -f` |
| Update after you push a change | `sudo bash /opt/flowstate/recorder/deploy/update.sh` |
| Re-run the setup check | `cd /opt/flowstate/recorder && sudo systemd-run --quiet --wait --pipe --collect --uid=recorder -p EnvironmentFile=/etc/flowstate-recorder.env -p WorkingDirectory=$PWD ./node_modules/.bin/tsx src/check.ts` |
| Stop / start it | `sudo systemctl stop flowstate-recorder` / `sudo systemctl start flowstate-recorder` |
| Change a password or key | `sudo nano /etc/flowstate-recorder.env`, then `sudo systemctl restart flowstate-recorder` |
| Record only (don't run the bots) | add `RUN_BOTS=0` to the settings file and restart |

The paper bots only run when you've pressed **Start** in FlowState; **Stop** there stops them on the server too. Recording runs all the time.

## Settings

Timings are in `src/config.ts` (cadence, archive age, time limits). Bot settings stay where they were: `CONFIG` in `lib/betfair/engine.ts` and `STRAT` in `lib/betfair/strategies.ts`. After changing anything, push, then run the update command.

## Storage

Each day of GB/IE racing is a few MB in the database. After a week the recorder moves it into `betfair-archive/YYYY-MM-DD.json.gz`, typically a few hundred KB. It writes the file, reads it back to check it, and only then deletes the database copy. Race details and results stay in the database, as they're small. Supabase's free plan includes 500 MB of database and 1 GB of file storage, which is years of archived days at this rate.

## Limits of the free (delayed) Betfair key

- **Delay:** prices arrive 1 to 180 seconds late, and the delay varies. That's fine for "20 minutes before the off". For "at the off", backtests should use the last recorded price or the Starting Price, not assume second-level accuracy.
- **Total matched:** the price data doesn't include it, so the recorder takes it from the market list once a minute. It's stored on every snapshot and on the race.
- **Price depth:** only the best three price levels are available. The recorder keeps the best one.

## Security

- Secrets live only in `/etc/flowstate-recorder.env` (mode 640, root:recorder) and in Vercel. Nothing secret is in the code or on GitHub.
- The recorder runs as a dedicated user with no shell, and systemd locks it down: read-only system, no home directories, its own temp space, and writes only to `/var/lib/flowstate-recorder`.
- The server accepts no incoming connections apart from SSH. Ubuntu security updates install automatically.
- Betfair access is limited in code to the two read-only operations.
