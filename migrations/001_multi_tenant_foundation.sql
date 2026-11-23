-- SAINEI POS multi-business foundation.
-- Additive only: safe to apply to the current single-business backend.
-- Do not use this migration as a production multi-tenant release by itself.
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

INSERT INTO sainei_pos_businesses
  (id, code, name, active, subscription_status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'SAINEI-LEGACY', 'Comercio existente', TRUE, 'active')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sainei_pos_records ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_settings ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_counters ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_users ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_audit ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES sainei_pos_businesses(id);
ALTER TABLE sainei_pos_backups ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES sainei_pos_businesses(id);

UPDATE sainei_pos_records SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_settings SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_counters SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_users SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_audit SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;
UPDATE sainei_pos_backups SET business_id='00000000-0000-4000-8000-000000000001' WHERE business_id IS NULL;

-- Keep legacy primary keys and unique constraints intact until the tenant-aware
-- API is installed. The next migration will add tenant-composite constraints
-- together with the matching application queries in one coordinated release.
CREATE INDEX IF NOT EXISTS sainei_pos_records_business_rev ON sainei_pos_records(business_id, rev);
CREATE INDEX IF NOT EXISTS sainei_pos_records_business_coll_id ON sainei_pos_records(business_id, coll, id);
CREATE INDEX IF NOT EXISTS sainei_pos_settings_business ON sainei_pos_settings(business_id, k);
CREATE INDEX IF NOT EXISTS sainei_pos_users_business ON sainei_pos_users(business_id, id);
CREATE INDEX IF NOT EXISTS sainei_pos_audit_business_id ON sainei_pos_audit(business_id, id DESC);
CREATE INDEX IF NOT EXISTS sainei_pos_backups_business_at ON sainei_pos_backups(business_id, at DESC);

COMMIT;
