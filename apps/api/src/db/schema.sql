-- Peribolos V2 PostgreSQL / Supabase Schema
-- Provides multi-tenant workspace isolation and audit trail persistence.

CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  framework VARCHAR(64) NOT NULL DEFAULT 'langchain',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vaults (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id VARCHAR(64) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL,
  owner_address VARCHAR(42) NOT NULL,
  agent_signer_address VARCHAR(42) NOT NULL,
  treasury_address VARCHAR(42) NOT NULL,
  daily_cap_usdc NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  per_tx_cap_usdc NUMERIC(12,2) NOT NULL DEFAULT 25.00,
  allowed_actions_bitmap INTEGER NOT NULL DEFAULT 255,
  agent_key_expires_at BIGINT NOT NULL,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  mode VARCHAR(16) NOT NULL DEFAULT 'offline',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_signers (
  id VARCHAR(64) PRIMARY KEY,
  vault_id VARCHAR(64) NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  agent_id VARCHAR(64) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payees (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(42) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'api',
  description TEXT NOT NULL DEFAULT '',
  allowed_action_type INTEGER NOT NULL DEFAULT 1,
  default_limit_usdc NUMERIC(12,2) NOT NULL DEFAULT 10.00,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id VARCHAR(64) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key_prefix VARCHAR(32) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id VARCHAR(64) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  vault_id VARCHAR(64) NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) NOT NULL,
  payee_address VARCHAR(42) NOT NULL,
  payee_name VARCHAR(255),
  amount_usdc NUMERIC(12,2) NOT NULL,
  action_type INTEGER NOT NULL DEFAULT 1,
  metadata_hash VARCHAR(66) NOT NULL,
  status VARCHAR(32) NOT NULL,
  block_reason_code VARCHAR(64),
  block_reason_description TEXT,
  tx_hash VARCHAR(66),
  block_number INTEGER,
  gas_used_usdc NUMERIC(12,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workspace_idempotency UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS chain_events (
  id VARCHAR(64) PRIMARY KEY,
  vault_address VARCHAR(42) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  agent_key VARCHAR(42),
  recipient VARCHAR(42),
  amount_usdc NUMERIC(12,2),
  action_type INTEGER,
  reason_ordinal INTEGER,
  reason_code VARCHAR(64),
  tx_hash VARCHAR(66) NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
