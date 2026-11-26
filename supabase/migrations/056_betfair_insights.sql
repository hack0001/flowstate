-- =============================================================
-- FlowState — Betfair insights (price and money-flow analysis)
--
-- bf_bt_path: for each recorded market starting in a time range, the price
-- snapshot at each of several times before the scheduled start (the last
-- one at or before it), plus the last snapshot before the off (offset_sec
-- = -1). The Insights tab uses it to study how prices and money move in
-- the last hour and what that says about results, one day at a time.
--
-- Runs with the caller's permissions, so the owner-only rules on the tables
-- still apply. Needs 052 to 055 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

drop function if exists bf_bt_path(text, timestamptz, timestamptz, int[], int, text[]);
create or replace function bf_bt_path(
  p_sport text, p_from timestamptz, p_to timestamptz, p_offsets int[], p_tol_sec int, p_types text[] default null
) returns table (market_id text, offset_sec int, at timestamptz, matched double precision, runners jsonb)
language sql stable security invoker set search_path = public as $$
  with ms as (
    select m.market_id, m.start_at, m.off_at from bf_markets m
    where m.sport = p_sport and m.start_at >= p_from and m.start_at < p_to
      and (p_types is null or m.market_type = any(p_types))
  )
  select ms.market_id, o.sec, s.at, s.matched, s.runners
  from ms
  cross join unnest(p_offsets) as o(sec)
  cross join lateral (
    select s.at, s.matched, s.runners from bf_snaps s
    where s.market_id = ms.market_id and not s.inplay
      and s.at <= ms.start_at - make_interval(secs => o.sec)
      and s.at >= ms.start_at - make_interval(secs => o.sec + greatest(30, least(p_tol_sec, o.sec / 4)))
    order by s.at desc limit 1
  ) s
  union all
  select ms.market_id, -1, s.at, s.matched, s.runners
  from ms
  cross join lateral (
    select s.at, s.matched, s.runners from bf_snaps s
    where s.market_id = ms.market_id and not s.inplay
      and s.at <= coalesce(ms.off_at, ms.start_at + interval '12 hours')
      and s.at >= ms.start_at - interval '15 minutes'
    order by s.at desc limit 1
  ) s
  order by 1, 2
$$;
