-- Safe way to add columns to users, problems, and help_offers
DO $$ 
BEGIN
    -- users table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='home_lat'
    ) THEN
        ALTER TABLE users ADD COLUMN home_lat FLOAT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='home_lon'
    ) THEN
        ALTER TABLE users ADD COLUMN home_lon FLOAT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='latitude'
    ) THEN
        ALTER TABLE users ADD COLUMN latitude FLOAT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='longitude'
    ) THEN
        ALTER TABLE users ADD COLUMN longitude FLOAT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='address'
    ) THEN
        ALTER TABLE users ADD COLUMN address TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='home_locality'
    ) THEN
        ALTER TABLE users ADD COLUMN home_locality VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='home_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN home_verified BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='community_radius_km'
    ) THEN
        ALTER TABLE users ADD COLUMN community_radius_km INT DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='phone_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='is_available'
    ) THEN
        ALTER TABLE users ADD COLUMN is_available BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='available_until'
    ) THEN
        ALTER TABLE users ADD COLUMN available_until TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='verification_level'
    ) THEN
        ALTER TABLE users ADD COLUMN verification_level INT DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='account_deleted'
    ) THEN
        ALTER TABLE users ADD COLUMN account_deleted BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='deleted_at'
    ) THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='bio'
    ) THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='description'
    ) THEN
        ALTER TABLE users ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='aadhaar_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN aadhaar_hash TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='aadhaar_last4'
    ) THEN
        ALTER TABLE users ADD COLUMN aadhaar_last4 VARCHAR(10);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='aadhaar_verified'
    ) THEN
        ALTER TABLE users ADD COLUMN aadhaar_verified BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='aadhaar_verified_at'
    ) THEN
        ALTER TABLE users ADD COLUMN aadhaar_verified_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='consent_dpdp'
    ) THEN
        ALTER TABLE users ADD COLUMN consent_dpdp BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='users' AND column_name='consent_dpdp_at'
    ) THEN
        ALTER TABLE users ADD COLUMN consent_dpdp_at TIMESTAMP;
    END IF;

    -- problems table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='post_type'
    ) THEN
        ALTER TABLE problems ADD COLUMN post_type VARCHAR(20) DEFAULT 'free_help';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='budget_range'
    ) THEN
        ALTER TABLE problems ADD COLUMN budget_range VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='resolution_photo_url'
    ) THEN
        ALTER TABLE problems ADD COLUMN resolution_photo_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='rating'
    ) THEN
        ALTER TABLE problems ADD COLUMN rating INT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='category'
    ) THEN
        ALTER TABLE problems ADD COLUMN category VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='helper_id'
    ) THEN
        ALTER TABLE problems ADD COLUMN helper_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='resolved_at'
    ) THEN
        ALTER TABLE problems ADD COLUMN resolved_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='photo_url'
    ) THEN
        ALTER TABLE problems ADD COLUMN photo_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='problems' AND column_name='resolved_by_helper_id'
    ) THEN
        ALTER TABLE problems ADD COLUMN resolved_by_helper_id UUID REFERENCES users(id);
    END IF;

    ALTER TABLE problems ALTER COLUMN locality_id DROP NOT NULL;

    -- help_offers table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='offer_type'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN offer_type VARCHAR(20) DEFAULT 'direct_help';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='referred_name'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN referred_name VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='referred_contact'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN referred_contact VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='referred_note'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN referred_note TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='arrival_code'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN arrival_code VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='verified_arrival'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN verified_arrival BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='arrival_code_expires_at'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN arrival_code_expires_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='arrival_code_attempts'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN arrival_code_attempts INT DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='arrival_verified'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN arrival_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='help_offers' AND column_name='verified_at'
    ) THEN
        ALTER TABLE help_offers ADD COLUMN verified_at TIMESTAMP;
    END IF;

END $$;

-- Upgrade reviews table non-destructively
DO $$
DECLARE
    has_reviewer_id BOOLEAN;
    has_resident_id BOOLEAN;
    has_invalid_rating BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='reviewer_id'
    ) INTO has_reviewer_id;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='resident_id'
    ) INTO has_resident_id;

    IF has_reviewer_id AND NOT has_resident_id THEN
        -- Only reviewer_id exists
        ALTER TABLE reviews RENAME COLUMN reviewer_id TO resident_id;
    ELSIF has_resident_id AND NOT has_reviewer_id THEN
        -- Only resident_id exists
        NULL;
    ELSIF has_reviewer_id AND has_resident_id THEN
        -- Both exist
        RAISE EXCEPTION 'Migration conflict: Both reviewer_id and resident_id exist in reviews table. Manual reconciliation required.';
    ELSE
        -- Neither exist
        ALTER TABLE reviews ADD COLUMN resident_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='speed_rating'
    ) THEN
        ALTER TABLE reviews ADD COLUMN speed_rating INT CHECK (speed_rating BETWEEN 1 AND 5);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='quality_rating'
    ) THEN
        ALTER TABLE reviews ADD COLUMN quality_rating INT CHECK (quality_rating BETWEEN 1 AND 5);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='comm_rating'
    ) THEN
        ALTER TABLE reviews ADD COLUMN comm_rating INT CHECK (comm_rating BETWEEN 1 AND 5);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='overall_rating'
    ) THEN
        ALTER TABLE reviews ADD COLUMN overall_rating INT;
    END IF;


    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='resolution_photo_url'
    ) THEN
        ALTER TABLE reviews ADD COLUMN resolution_photo_url TEXT;
    END IF;

    -- Migrate legacy rating data to the new structured rating columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='reviews' AND column_name='rating'
    ) THEN
        -- Check for invalid legacy ratings
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM reviews WHERE rating IS NOT NULL AND (rating < 1 OR rating > 5))' INTO has_invalid_rating;
        IF has_invalid_rating THEN
            RAISE EXCEPTION 'Migration conflict: Legacy rating values found outside the 1-5 range. Manual reconciliation required.';
        END IF;

        EXECUTE '
        UPDATE reviews 
        SET speed_rating = COALESCE(speed_rating, rating),
            quality_rating = COALESCE(quality_rating, rating),
            comm_rating = COALESCE(comm_rating, rating),
            overall_rating = COALESCE(overall_rating, rating)
        WHERE rating IS NOT NULL 
          AND (speed_rating IS NULL OR quality_rating IS NULL OR comm_rating IS NULL OR overall_rating IS NULL)';
    END IF;

END $$;

-- New tables (safe creation)
CREATE TABLE IF NOT EXISTS relocation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    new_lat FLOAT,
    new_lon FLOAT,
    new_locality VARCHAR(255),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS community_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    connected_to UUID REFERENCES users(id),
    connected_via_problem UUID REFERENCES problems(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, connected_to)
);

CREATE TABLE IF NOT EXISTS problem_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(problem_id, user_id)
);

CREATE TABLE IF NOT EXISTS problem_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(problem_id, user_id)
);

CREATE TABLE IF NOT EXISTS watch_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    zone_name VARCHAR(100),
    center_lat FLOAT,
    center_lon FLOAT,
    radius_meters INT DEFAULT 500,
    created_at TIMESTAMP DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES users(id),
    blocked_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    phone VARCHAR(20) PRIMARY KEY,
    otp_hash VARCHAR(64),
    expires_at TIMESTAMP,
    attempts INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS token_blacklist (
    jti VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Change default from 10 to 1
ALTER TABLE users ALTER COLUMN community_radius_km SET DEFAULT 1;


-- Change default trust score to 50.0
ALTER TABLE users ALTER COLUMN trust_score SET DEFAULT 50.0;



