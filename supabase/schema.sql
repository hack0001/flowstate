-- FlowState Database Schema
-- Run this in your Supabase SQL editor first, then run seed.sql

-- ─── Workflow Types ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT DEFAULT '#00d4ff',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Stages ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type_id  UUID NOT NULL REFERENCES workflow_types(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  icon              TEXT DEFAULT '📋',
  order_index       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id            UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  instructions        TEXT,
  order_index         INTEGER NOT NULL DEFAULT 0,
  estimated_minutes   INTEGER DEFAULT 5,
  has_prompt          BOOLEAN DEFAULT FALSE,
  prompt_text         TEXT,
  resource_url        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Workflow Sessions ─────────────────────────────────────────────────────────
-- One row per "piece of content" being created (e.g., "My video about habits")
CREATE TABLE IF NOT EXISTS workflow_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type_id    UUID NOT NULL REFERENCES workflow_types(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  current_stage_id    UUID REFERENCES stages(id),
  current_task_id     UUID REFERENCES tasks(id),
  is_active           BOOLEAN DEFAULT TRUE,
  is_priority         BOOLEAN DEFAULT FALSE,  -- The one session shown on home screen
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- Only one session can be priority at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_priority
  ON workflow_sessions (is_priority)
  WHERE is_priority = TRUE;

-- ─── Task Completions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES workflow_sessions(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ DEFAULT NOW(),
  pomodoros_used  INTEGER DEFAULT 0,
  UNIQUE (session_id, task_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stages_workflow_type ON stages(workflow_type_id);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON workflow_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_completions_session ON task_completions(session_id);

-- ─── Row Level Security (disable for now — no auth yet) ───────────────────────
ALTER TABLE workflow_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

-- Allow all anon access (no auth required yet)
CREATE POLICY "Allow all" ON workflow_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON workflow_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON task_completions FOR ALL USING (true) WITH CHECK (true);
