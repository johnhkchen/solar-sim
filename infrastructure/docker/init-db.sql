-- =============================================================================
-- Solar-Sim Database Initialization
-- Creates tables for users, plans, and subscriptions
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Users Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),

    -- OAuth providers
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,

    -- Profile
    name VARCHAR(255),
    avatar_url TEXT,

    -- Subscription
    subscription_tier VARCHAR(50) DEFAULT 'free',  -- 'free', 'pay_per_plan', 'pro'
    stripe_customer_id VARCHAR(255) UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- =============================================================================
-- Plans Table
-- Represents saved site/garden plans
-- =============================================================================
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Location
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    timezone VARCHAR(100),

    -- Plan data (JSON blob for flexibility)
    plan_data JSONB NOT NULL DEFAULT '{}',

    -- Billing
    is_free_slot BOOLEAN DEFAULT FALSE,  -- True for first 4 plans
    billing_active BOOLEAN DEFAULT TRUE,  -- False when archived

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_billing ON plans(user_id, billing_active) WHERE billing_active = TRUE;

-- =============================================================================
-- Sessions Table
-- For authentication tokens
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Device info for session management
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- =============================================================================
-- Subscriptions Table
-- Tracks Stripe subscription state
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Stripe IDs
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_price_id VARCHAR(255) NOT NULL,

    -- Status
    status VARCHAR(50) NOT NULL,  -- 'active', 'past_due', 'canceled', 'incomplete'

    -- Billing period
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,

    -- For pay-per-plan tier
    quantity INTEGER DEFAULT 0,  -- Number of paid plans

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- =============================================================================
-- Billing Events Table
-- Audit log for billing changes
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    stripe_event_id VARCHAR(255),

    -- Payload for debugging
    payload JSONB,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_events_user_id ON billing_events(user_id);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_stripe ON billing_events(stripe_event_id);

-- =============================================================================
-- Climate Cache Table
-- Persists climate data fetched from Open-Meteo
-- =============================================================================
CREATE TABLE IF NOT EXISTS climate_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Location (rounded to 0.1 degree ~10km)
    lat_bucket DECIMAL(4, 1) NOT NULL,
    lng_bucket DECIMAL(5, 1) NOT NULL,

    -- Cached data
    data JSONB NOT NULL,

    -- Cache metadata
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',

    UNIQUE(lat_bucket, lng_bucket)
);

CREATE INDEX idx_climate_cache_location ON climate_cache(lat_bucket, lng_bucket);
CREATE INDEX idx_climate_cache_expires ON climate_cache(expires_at);

-- =============================================================================
-- Functions
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Function: Count billable plans for a user
-- =============================================================================
CREATE OR REPLACE FUNCTION count_billable_plans(p_user_id UUID)
RETURNS TABLE(free_slots INTEGER, paid_plans INTEGER, total_active INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE is_free_slot = TRUE AND billing_active = TRUE)::INTEGER as free_slots,
        COUNT(*) FILTER (WHERE is_free_slot = FALSE AND billing_active = TRUE)::INTEGER as paid_plans,
        COUNT(*) FILTER (WHERE billing_active = TRUE)::INTEGER as total_active
    FROM plans
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Function: Assign free slot to new plan
-- Returns TRUE if a free slot was available, FALSE if plan requires billing
-- =============================================================================
CREATE OR REPLACE FUNCTION assign_plan_slot(p_plan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_free_count INTEGER;
BEGIN
    -- Get user ID for this plan
    SELECT user_id INTO v_user_id FROM plans WHERE id = p_plan_id;

    -- Count existing free-slot plans
    SELECT COUNT(*) INTO v_free_count
    FROM plans
    WHERE user_id = v_user_id
      AND is_free_slot = TRUE
      AND billing_active = TRUE;

    -- If under 4 free slots, assign one
    IF v_free_count < 4 THEN
        UPDATE plans SET is_free_slot = TRUE WHERE id = p_plan_id;
        RETURN TRUE;
    ELSE
        UPDATE plans SET is_free_slot = FALSE WHERE id = p_plan_id;
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Initial Data
-- =============================================================================

-- Nothing to seed for production; test data goes in separate migration
