ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hosted_mode BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_action_cap INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_actions_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scope TEXT;
CREATE INDEX IF NOT EXISTS organizations_hosted_mode_idx ON organizations(hosted_mode) WHERE hosted_mode = TRUE;
