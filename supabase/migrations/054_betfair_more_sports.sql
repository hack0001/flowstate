-- =============================================================
-- FlowState — Betfair recorder: football, tennis and golf
--
-- Lets the recorder server save tennis and golf markets as well as
-- racing and football, and keeps each market's competition (league,
-- tour or tournament) for breakdowns.
--
-- Needs 052 and 053 first. Safe to re-run.
-- RUN IN SUPABASE SQL EDITOR
-- =============================================================

alter table bf_markets drop constraint if exists bf_markets_sport_check;
alter table bf_markets add constraint bf_markets_sport_check check (sport in ('racing', 'football', 'tennis', 'golf'));

alter table bf_markets add column if not exists competition text;

-- the Data tab lists recent markets per sport and per event
create index if not exists bf_markets_event on bf_markets (event_id);
