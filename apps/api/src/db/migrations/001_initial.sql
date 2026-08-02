CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  file_hash text NOT NULL,
  storage_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  failure_message text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_hash)
);

CREATE TABLE IF NOT EXISTS recovery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid UNIQUE NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]',
  timeline jsonb NOT NULL DEFAULT '[]',
  explain_cache jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES recovery_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose_ciphertext bytea NOT NULL,
  frequency text,
  timing text,
  instructions text,
  source_lines integer[] NOT NULL DEFAULT '{}',
  taken_log jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES recovery_plans(id) ON DELETE CASCADE,
  appointment_at timestamptz,
  doctor text,
  specialty text,
  location text,
  notes text,
  source_lines integer[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  ip_address inet NOT NULL,
  status_code integer NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_user_timestamp_idx ON audit_logs(user_id, timestamp DESC);
