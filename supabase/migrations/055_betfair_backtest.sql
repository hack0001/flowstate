-- =============================================================
-- FlowState — Betfair backtester
--
-- bf_bt_points: for each recorded market starting in a time range, the
-- price snapshot to enter on (the last one at or before N seconds before
-- the scheduled start) and the snapshot to exit on. The Backtest tab
-- calls it one day at a time, so only two snapshots per market leave the
-- database instead of hundreds.
--
-- Exit modes:
--   off     the last snapshot before the market went in-play (the off / kick-off)
--   before  the last snapshot at or before p_exit_sec seconds before the scheduled start
--   inplay  the last snapshot at or before p_exit_sec seconds after it went in-play
--
-- Runs with the caller's permissions, so the owner-only rules on the
-- tables still apply. Needs 052 to 054 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

drop function if exists bf_bt_points(text, timestamptz, timestamptz, int, int, text, int, text[]);
create or replace function bf_bt_points(
  p_sport text, p_from timestamptz, p_to timestamptz,
  p_entry_sec int, p_tol_sec int, p_exit_mode text, p_exit_sec int, p_types text[] default null
) returns table (
  market_id text, entry_at timestamptz, entry_matched double precision, entry_runners jsonb,
  exit_at timestamptz, exit_inplay boolean, exit_matched double precision, exit_runners jsonb
)
language sql stable security invoker set search_path = public as $$
  select m.market_id, e.at, e.matched, e.runners, x.at, x.inplay, x.matched, x.runners
  from bf_markets m
  cross join lateral (
    select s.at, s.matched, s.runners from bf_snaps s
    where s.market_id = m.market_id and not s.inplay
      and s.at <= m.start_at - make_interval(secs => p_entry_sec)
      and s.at >= m.start_at - make_interval(secs => p_entry_sec + p_tol_sec)
    order by s.at desc limit 1
  ) e
  left join lateral (
    select s.at, s.inplay, s.matched, s.runners from bf_snaps s
    where s.market_id = m.market_id and s.at > e.at
      and case p_exit_mode
        when 'off' then not s.inplay and s.at <= coalesce(m.off_at, m.start_at + interval '12 hours')
        when 'before' then not s.inplay and s.at <= m.start_at - make_interval(secs => p_exit_sec)
        when 'inplay' then m.off_at is not null and s.at <= m.off_at + make_interval(secs => p_exit_sec)
        else false end
    order by s.at desc limit 1
  ) x on true
  where m.sport = p_sport and m.start_at >= p_from and m.start_at < p_to
    and (p_types is null or m.market_type = any(p_types))
$$;
