-- 017_site_ideas.sql
-- Backlog of website/app ideas shown on the home page, with add/edit/remove
-- support. Seeded with the ideas already discussed so nothing is lost.

create table if not exists site_ideas (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  tag        text not null default 'Other',
  summary    text not null default '',
  next_step  text not null default '',
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

alter table site_ideas enable row level security;
drop policy if exists allow_all_site_ideas on site_ideas;
create policy allow_all_site_ideas on site_ideas for all using (true) with check (true);

-- Guard the seed so re-running this migration doesn't duplicate rows
-- (site_ideas has no natural unique key to conflict on).
insert into site_ideas (title, tag, summary, next_step, sort_order)
select * from (values
('Word of Welsh', 'Website',
 'A daily/weekly Welsh word site -- one word, meaning, pronunciation and an example sentence, maybe a streak to keep people coming back.',
 'This one lives or dies on accuracy. Get Sioned to sign off on word choice, translation and pronunciation before any content goes live -- she is the actual bottleneck here, not the build. Once she is on board the site itself is simple: word-of-the-day, an archive, a shareable card.',
 0),
('5-a-side app & Football Goffy', 'App',
 'Two related football ideas -- a 5-a-side game organiser (fill a game, manage regulars, split costs) and "Football Goffy" (concept still needs fleshing out).',
 'Pick one to scope first. The 5-a-side organiser has proven demand -- Playo, TeamUp and Spond already exist, so study what they get wrong before building rather than starting from scratch. Goffy needs a one-paragraph concept written down before it can be scoped at all.',
 1),
('Old Money / Luxury Spending', 'Website',
 'Content site in the "old money" / quiet luxury niche -- brand guides, style rules, where old money actually spends.',
 'The angle is trending on TikTok and Pinterest right now, so demand is not the question -- monetisation is. Affiliate links to the brands featured is the obvious model, but a paid style guide or membership could work too. Decide that before writing a word.',
 2),
('Movie Site to Beat Rotten Tomatoes', 'Website',
 'A trustworthy alternative to Rotten Tomatoes, positioned against the perceived studio/critic influence on its scores.',
 '"Better than RT" is not a strategy on its own. Nail the actual mechanic that makes it harder to game -- verified-viewer-only scoring, transparent methodology, no paid placements -- before touching a line of code.',
 3),
('Punter''s Revenge & Gambling Theories', 'App',
 'A betting theory and strategy tracking app.',
 'Decide early whether this is pure education and bet-tracking (low regulatory burden) or actually facilitates betting (triggers UK Gambling Commission licensing -- expensive and slow). That single decision shapes the entire build, so settle it before anything else.',
 4),
('Claude Options & Financial Psychology', 'Website',
 'An options-trading education site, using Claude to explain trades and the psychology behind them.',
 'Decide whether this is content (articles/courses) or a tool (AI-assisted trade and psychology analysis) -- the brief specifically calls out layout, so once the content-vs-tool question is answered, start there.',
 5),
('Capitals & Flags Test Site', 'Website',
 'A quiz site testing knowledge of world capitals and flags -- classic trivia format, likely with difficulty levels, streaks or a speedrun mode.',
 'This is the most straightforward build on the list -- no dependency on anyone else and the data (countries, capitals, flag images) is freely available. The differentiator is the game modes, not the content, so sketch out 2-3 quiz formats (multiple choice, speed round, hard mode with no hints) before building rather than shipping a single generic quiz.',
 6)
) as seed(title, tag, summary, next_step, sort_order)
where not exists (select 1 from site_ideas);
