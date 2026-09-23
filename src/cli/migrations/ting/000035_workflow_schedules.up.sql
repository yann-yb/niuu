CREATE TABLE IF NOT EXISTS workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    prompt TEXT NOT NULL,
    session_name TEXT,
    repo TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    connection_id TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    last_session_id TEXT,
    last_status TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_owner
    ON workflow_schedules(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_due
    ON workflow_schedules(next_run_at)
    WHERE enabled = TRUE;
