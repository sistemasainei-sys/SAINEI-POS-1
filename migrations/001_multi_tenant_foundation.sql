-- SAINEI POS multi-business foundation.
-- Additive migration: existing installation is retained as one legacy business.
-- Runtime tenant enforcement is implemented in the following application changes.
BEGIN;

CREATE TABLE IF NOT EXISTS sainei_pos_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (subscription_status IN ('pending','active','past_due','suspended','cancelled')),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stable tenant for data already stored by the single-business version.
INSERT INTO sainei_pos_businesses
  (id, code, name, active, subscription_status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'SAINEI-LEGACY', 'Comercio existente', TRUE, 'active')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sainei_pos_records
  ADD COLUMN IF NOT EXISTS business_id UUID
  REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_settings
  ADD COLUMN IF NOT EXISTS business_id UUID
  REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_counters
  ADD COLUMN IF NOT EXISTS business_id UUID
  REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_users
  ADD COLUMN IF NOT EXISTS business_id UUID
  REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_audit
  ADD COLUMN IF NOT EXISTS business_id UUID
  REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_backups
  ADD COLUMN IF NOT EXISTS business_id UUID
  REFERENCES sainei_pos_businesses(id);

UPDATE sainei_pos_records SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_settings SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_counters SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_users SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_audit SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_backups SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;

ALTER TABLE sainei_pos_records ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE sainei_pos_settings ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE sainei_pos_counters ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE sainei_pos_users ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE sainei_pos_audit ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE sainei_pos_backups ALTER COLUMN business_id SET NOT NULL;

-- IDs remain globally unique for records/users; settings and counters are tenant-local.
ALTER TABLE sainei_pos_settings DROP CONSTRAINT IF EXISTS sainei_pos_settings_pkey;
ALTER TABLE sainei_pos_settings ADD CONSTRAINT sainei_pos_settings_pkey PRIMARY KEY (business_id, k);
ALTER TABLE sainei_pos_counters DROP CONSTRAINT IF EXISTS sainei_pos_counters_pkey;
ALTER TABLE sainei_pos_counters ADD CONSTRAINT sainei_pos_counters_pkey PRIMARY KEY (business_id, kind);
ALTER TABLE sainei_pos_backups DROP CONSTRAINT IF EXISTS sainei_pos_backups_pkey;
ALTER TABLE sainei_pos_backups ADD CONSTRAINT sainei_pos_backups_pkey PRIMARY KEY (business_id, name);

CREATE INDEX IF NOT EXISTS sainei_pos_records_tenant_rev
  ON sainei_pos_records (business_id, rev);
CREATE INDEX IF NOT EXISTS sainei_pos_users_tenant
  ON sainei_pos_users (business_id, id);
CREATE INDEX IF NOT EXISTS sainei_pos_audit_tenant_id
  ON sainei_pos_audit (business_id, id DESC);
CREATE INDEX IF NOT EXISTS sainei_pos_backups_tenant_at
  ON sainei_pos_backups (business_id, at DESC);

-- A record can only be addressed inside its own business.
CREATE INDEX IF NOT EXISTS sainei_pos_records_tenant_coll_id
  ON sainei_pos_records (business_id, coll, id);

COMMIT;
