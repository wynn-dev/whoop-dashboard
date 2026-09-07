CREATE SCHEMA IF NOT EXISTS whoop_dashboard;

CREATE TABLE IF NOT EXISTS whoop_dashboard.connections (
  user_id text PRIMARY KEY,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scopes text NOT NULL,
  synced_at timestamptz,
  sync_started_at timestamptz,
  sync_error text,
  needs_reconnect boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whoop_dashboard.sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES whoop_dashboard.connections(user_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON whoop_dashboard.sessions(expires_at);

CREATE TABLE IF NOT EXISTS whoop_dashboard.records (
  user_id text NOT NULL REFERENCES whoop_dashboard.connections(user_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cycle', 'recovery', 'sleep', 'workout')),
  record_id text NOT NULL,
  start_at timestamptz NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, record_id)
);
CREATE INDEX IF NOT EXISTS records_user_start_idx ON whoop_dashboard.records(user_id, start_at DESC);

CREATE TABLE IF NOT EXISTS whoop_dashboard.migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
