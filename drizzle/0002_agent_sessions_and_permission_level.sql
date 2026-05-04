-- Ensure agent_identities and agent_pairings exist. Both are referenced
-- by live code (app/lib/identity.js, app/lib/repositories/agents.repository.js)
-- and were added to schema/schema.js but never made it into
-- 0000_clammy_falcon.sql. Fresh Neon databases provisioned via the runtime
-- auto-migrator therefore never had these tables — 0002's ALTER below then
-- failed with 42P01 on every cold deploy once this migration started being
-- applied. IF NOT EXISTS makes the statements a no-op on existing installs.
CREATE TABLE IF NOT EXISTS agent_identities (
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  algorithm TEXT DEFAULT 'RSASSA-PKCS1-v1_5',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS agent_identities_org_agent_unique
  ON agent_identities (org_id, agent_id);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS agent_pairings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  public_key TEXT NOT NULL,
  algorithm TEXT DEFAULT 'RSASSA-PKCS1-v1_5',
  status TEXT DEFAULT 'pending',
  permission_level TEXT DEFAULT 'danger',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--> statement-breakpoint

-- Add permission_level to agent_pairings (redundant on fresh deploys where
-- the CREATE above already included the column; still required for DBs
-- that had agent_pairings pre-existing without permission_level).
ALTER TABLE agent_pairings ADD COLUMN IF NOT EXISTS permission_level TEXT DEFAULT 'danger';

--> statement-breakpoint

-- Create agent_sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  workspace TEXT,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'spawning',
  status_since TIMESTAMPTZ DEFAULT NOW(),
  blocked_reason TEXT,
  green_level TEXT,
  branch_freshness TEXT,
  commits_behind INTEGER,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

--> statement-breakpoint

-- Create session_events table
CREATE TABLE IF NOT EXISTS session_events (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

--> statement-breakpoint

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org_status ON agent_sessions(org_id, status);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_agent_sessions_org_agent ON agent_sessions(org_id, agent_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_activity ON agent_sessions(org_id, last_activity);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, seq);
