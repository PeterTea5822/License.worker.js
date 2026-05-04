-- NOTE:
-- D1 migration parsing may fail on trigger bodies that contain internal semicolons.
-- Keep this migration trigger-free and use application-layer updated_at maintenance.

UPDATE users
SET updated_at = created_at
WHERE updated_at IS NULL;

UPDATE licenses
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_updated_at ON licenses(updated_at);
