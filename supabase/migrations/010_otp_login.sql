-- =====================================================================
-- AEMS v2 — revert to OTP-based login for everyone (per project
-- decision), matching the previous system. Drops the password/MFA-era
-- columns from 001_core_schema.sql that are no longer needed.
-- =====================================================================

alter table users drop column if exists mfa_required;
alter table users drop column if exists mfa_enabled;

-- Fixes the previous system's biggest OTP weakness: codes lived in an
-- in-memory Map, which doesn't survive serverless cold starts/multiple
-- instances. Here they're hashed and stored in Postgres so verification
-- is correct no matter which server instance handles the request.
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,        -- sha256(code), never store the raw code
  purpose text not null default 'login',
  attempts int not null default 0,
  max_attempts int not null default 5,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_otp_email_active on otp_codes (email, created_at desc) where consumed_at is null;

-- Rate limiting (per project decision): max 5 sends / 15 min, 60s resend
-- cooldown — enforced in application code by counting recent rows here
-- rather than a separate table, so it's one less thing to keep in sync.
