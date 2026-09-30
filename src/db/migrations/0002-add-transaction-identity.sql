ALTER TABLE transactions
  ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN external_id TEXT,
  ADD COLUMN occurrence_index INTEGER NOT NULL DEFAULT 1;

ALTER TABLE transactions ALTER COLUMN source DROP DEFAULT;
ALTER TABLE transactions ALTER COLUMN occurrence_index DROP DEFAULT;

-- Provider rows (v4+): external_id is unique per source. NULL is untouched by uniqueness,
-- so CSV/OFX rows (which never set external_id) are unaffected.
CREATE UNIQUE INDEX transactions_source_external_id_idx
  ON transactions (source, external_id)
  WHERE external_id IS NOT NULL;

-- Imported-row identity (ADR-0006): (source, account, date, amount_cents, description,
-- occurrence_index) must be unique per user. This is a safety net — the repository computes
-- occurrence_index so this should always hold; a violation means that computation is wrong.
CREATE UNIQUE INDEX transactions_identity_idx
  ON transactions (user_id, source, account, date, amount_cents, description, occurrence_index);
