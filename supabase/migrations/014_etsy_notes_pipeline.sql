-- Migration: 014_etsy_notes_pipeline
-- Etsy Notes and Software Pipeline tables

CREATE TABLE IF NOT EXISTS etsy_notes (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  priority   TEXT        CHECK (priority IN ('High','Medium','Low')),
  notes      TEXT,
  file_url   TEXT,
  notion_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etsy_software_pipeline (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  status     TEXT,
  priority   TEXT        CHECK (priority IN ('High','Medium','Low')),
  notes      TEXT,
  file_url   TEXT,
  notion_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etsy_notes_priority    ON etsy_notes (priority);
CREATE INDEX IF NOT EXISTS idx_etsy_pipeline_status   ON etsy_software_pipeline (status);
CREATE INDEX IF NOT EXISTS idx_etsy_pipeline_priority ON etsy_software_pipeline (priority);
