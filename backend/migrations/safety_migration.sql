-- Migration script for SAMANVI Physical Safety Framework

-- 1. Add arrival code and verification status to help_offers
ALTER TABLE help_offers ADD COLUMN IF NOT EXISTS arrival_code VARCHAR(10);
ALTER TABLE help_offers ADD COLUMN IF NOT EXISTS arrival_verified BOOLEAN DEFAULT FALSE;

-- 2. Add arrival timestamp for audit trailing
ALTER TABLE help_offers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 3. Extend reports table for SOS alerts
ALTER TABLE reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(50) DEFAULT 'standard'; -- 'standard', 'SOS'
ALTER TABLE reports ADD COLUMN IF NOT EXISTS live_location_lat DOUBLE PRECISION;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS live_location_lon DOUBLE PRECISION;

-- 4. Add arrival status to problems to differentiate between assignment and physical presence
ALTER TABLE problems ADD COLUMN IF NOT EXISTS physical_status VARCHAR(50) DEFAULT 'not_present'; -- 'en_route', 'arrived', 'working'
