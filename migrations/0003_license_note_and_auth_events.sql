ALTER TABLE licenses ADD COLUMN note TEXT;

CREATE TABLE IF NOT EXISTS license_auth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER,
  license_key TEXT,
  device_id TEXT,
  app_version TEXT,
  verdict TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  ip TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE INDEX IF NOT EXISTS idx_license_auth_events_created_at ON license_auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_license_auth_events_license_id ON license_auth_events(license_id);
