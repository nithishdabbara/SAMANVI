-- 003_push_tokens.sql
-- Idempotent schema migration for device push tokens and reliable notification delivery tracking.

-- 1. Create push_tokens table if not exists
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    token_type VARCHAR(20) NOT NULL DEFAULT 'expo',
    platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- 2. Add idempotency and delivery tracking columns to notifications table safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='notifications' AND column_name='idempotency_key'
    ) THEN
        ALTER TABLE notifications ADD COLUMN idempotency_key VARCHAR(128);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='notifications' AND column_name='push_status'
    ) THEN
        ALTER TABLE notifications ADD COLUMN push_status VARCHAR(20) DEFAULT 'pending';
        -- Explicitly mark existing legacy records so they are never picked up by push delivery recovery
        UPDATE notifications SET push_status = 'legacy' WHERE idempotency_key IS NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='notifications' AND column_name='push_attempts'
    ) THEN
        ALTER TABLE notifications ADD COLUMN push_attempts INT DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='notifications' AND column_name='pushed_at'
    ) THEN
        ALTER TABLE notifications ADD COLUMN pushed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Explicitly ensure any legacy notifications without idempotency keys are marked 'legacy' (idempotent across re-runs)
UPDATE notifications SET push_status = 'legacy' WHERE idempotency_key IS NULL AND (push_status = 'pending' OR push_status IS NULL);

-- 3. Idempotent indexes for notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key ON notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
DROP INDEX IF EXISTS idx_notifications_pending_push;
CREATE INDEX idx_notifications_pending_push ON notifications(push_status, push_attempts) 
    WHERE push_status IN ('pending', 'failed', 'processing');

