-- Create read-only role for snapshot generation in CI
-- This role is used by GitHub Actions to regenerate system-snapshot.md
-- It has SELECT-only access and respects RLS (no service_role bypass)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'snapshot_readonly') THEN
    CREATE ROLE snapshot_readonly NOLOGIN;
  END IF;
END
$$;

-- Resource limits to prevent runaway queries from CI
ALTER ROLE snapshot_readonly SET statement_timeout = '10s';
ALTER ROLE snapshot_readonly SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE snapshot_readonly SET lock_timeout = '5s';

-- Schema usage
GRANT USAGE ON SCHEMA public TO snapshot_readonly;
GRANT USAGE ON SCHEMA pg_catalog TO snapshot_readonly;
GRANT USAGE ON SCHEMA information_schema TO snapshot_readonly;

-- SELECT on all existing tables/views in public
GRANT SELECT ON ALL TABLES IN SCHEMA public TO snapshot_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO snapshot_readonly;

-- SELECT on future tables (default privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO snapshot_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO snapshot_readonly;

-- Explicitly REVOKE write privileges (defensive — should not be granted, but ensures it)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM snapshot_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM snapshot_readonly;

-- RLS: ensure role does NOT bypass RLS (default for non-superuser, but explicit)
ALTER ROLE snapshot_readonly NOBYPASSRLS;

-- Allow login-roles to inherit this role later
-- (Mathias creates a login user separately and runs: GRANT snapshot_readonly TO <login_user>;)
COMMENT ON ROLE snapshot_readonly IS
  'Read-only role for CI snapshot generation. SELECT-only on public schema. RLS enforced. 10s statement timeout.';