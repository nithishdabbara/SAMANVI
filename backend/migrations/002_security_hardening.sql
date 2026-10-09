-- 002_security_hardening.sql
-- Idempotent and non-destructive: only adds columns/tables and scrubs stale plaintext OTPs.

-- Columns the application already reads/writes but no earlier migration created.
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
-- Tokens issued before this moment are rejected (set on password reset / change).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Lets expired blacklist rows be purged.
ALTER TABLE token_blacklist ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Phone OTP challenges: hashed code, expiry, attempt counter, single use.
-- (New table: the legacy otp_verifications exists in two incompatible shapes and stored plaintext codes.)
CREATE TABLE IF NOT EXISTS otp_challenges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone        VARCHAR(20) NOT NULL,
    purpose      VARCHAR(20) NOT NULL CHECK (purpose IN ('register', 'login', 'password_reset')),
    channel      VARCHAR(20) NOT NULL DEFAULT 'sms',
    otp_hash     VARCHAR(64) NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    attempts     INT NOT NULL DEFAULT 0,
    used         BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at  TIMESTAMPTZ,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_lookup ON otp_challenges (phone, purpose, created_at DESC);

-- Aadhaar OTP challenges: the OTP itself lives with the verification provider, never here.
CREATE TABLE IF NOT EXISTS aadhaar_challenges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aadhaar_hash   TEXT NOT NULL,
    phone          VARCHAR(20),
    reference_id   TEXT NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL,
    attempts       INT NOT NULL DEFAULT 0,
    used           BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at    TIMESTAMPTZ,
    consumed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aadhaar_challenges_hash ON aadhaar_challenges (aadhaar_hash, created_at DESC);

-- Scrub plaintext OTP values left by the old implementation (they are short-lived codes, not user data).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'otp') THEN
        EXECUTE 'UPDATE otp_verifications SET otp = '''' WHERE otp IS NOT NULL AND otp <> ''''';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'otp_sessions' AND column_name = 'otp') THEN
        EXECUTE 'UPDATE otp_sessions SET otp = '''' WHERE otp IS NOT NULL AND otp <> ''''';
    END IF;
END $$;
