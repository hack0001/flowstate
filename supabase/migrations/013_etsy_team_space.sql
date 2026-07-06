-- Migration: 013_etsy_team_space
-- TopNotchThreadz Team Space tables for Supabase import

-- ── Etsy Todos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etsy_todos (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT        NOT NULL,
  stage           TEXT        CHECK (stage IN ('Not Started','Started','Ongoing','Completed')),
  priority        TEXT        CHECK (priority IN ('High','Medium','Low')),
  notes           TEXT,
  target_date_start TIMESTAMPTZ,
  target_date_end   TIMESTAMPTZ,
  notion_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Etsy Links ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etsy_links (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  url        TEXT,
  tags       TEXT,
  created    TIMESTAMPTZ,
  notion_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Etsy Batch Workflow ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etsy_batch_workflow (
  id                   BIGSERIAL PRIMARY KEY,
  notion_id            INTEGER,
  idea_theme           TEXT        NOT NULL,
  niche                TEXT,
  batch_priority       TEXT        CHECK (batch_priority IN ('Low','Medium','High')),
  batch_stage          TEXT        CHECK (batch_stage IN (
                          'Research + Ideas','Designing','Uploading','Monitoring','Archive')),
  method               TEXT,
  legal_check          BOOLEAN     DEFAULT FALSE,
  niche_research_stage TEXT,
  seed_keyword         TEXT,
  notes                TEXT,
  ideas_url            TEXT,
  design_url           TEXT,
  ai_design_link       TEXT,
  details_url          TEXT,
  date_start           TIMESTAMPTZ,
  date_end             TIMESTAMPTZ,
  notion_url           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_etsy_todos_stage    ON etsy_todos (stage);
CREATE INDEX IF NOT EXISTS idx_etsy_todos_priority ON etsy_todos (priority);
CREATE INDEX IF NOT EXISTS idx_etsy_batch_stage    ON etsy_batch_workflow (batch_stage);
CREATE INDEX IF NOT EXISTS idx_etsy_batch_priority ON etsy_batch_workflow (batch_priority);
CREATE INDEX IF NOT EXISTS idx_etsy_batch_niche    ON etsy_batch_workflow (niche);
