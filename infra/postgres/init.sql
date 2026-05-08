CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_pubkey TEXT NOT NULL,
  class TEXT NOT NULL,
  capabilities BIGINT NOT NULL DEFAULT 0,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  creator_pubkey TEXT NOT NULL,
  brief TEXT NOT NULL,
  brief_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  budget_lamports BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  parent_subtask_id TEXT REFERENCES subtasks(id),
  worker_agent_id TEXT REFERENCES agents(id),
  declared_tier TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  allocated_budget_lamports BIGINT NOT NULL DEFAULT 0,
  result_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optimizer_metrics (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  original_tokens INTEGER NOT NULL DEFAULT 0,
  processed_tokens INTEGER NOT NULL DEFAULT 0,
  reduction_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  techniques_applied TEXT[] NOT NULL DEFAULT '{}',
  estimated_quality_risk TEXT NOT NULL DEFAULT 'none',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
