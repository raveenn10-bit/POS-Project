-- ============================================================================
-- Harsh Apex POS - Production Licensing Subsystem Schema Migration
-- Migration: 001_initial_licensing_schema.sql
-- Description: Subscriptions, Device Bindings, Audit Logs, and Admin Sessions
-- Target: PostgreSQL / Supabase / Neon
-- ============================================================================

-- 1. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, -- e.g. 'SUB-YYYYMMDD-XXXX'
    customer_name TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('trial', 'monthly', 'custom')),
    start_timestamp TIMESTAMPTZ NOT NULL,
    expiry_timestamp TIMESTAMPTZ NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'pending')),
    payment_reference TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'expired', 'revoked')),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Device Bindings Table
CREATE TABLE IF NOT EXISTS device_bindings (
    id TEXT PRIMARY KEY, -- e.g. 'DEV-YYYYMMDD-XXXX'
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    binding_status TEXT NOT NULL DEFAULT 'active' CHECK (binding_status IN ('active', 'replaced', 'revoked')),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    replacement_reason TEXT,
    replaced_by_device_id TEXT,
    latest_activation_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: Ensure a device_id cannot be actively bound multiple times concurrently across subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_bindings_unique_active_device 
ON device_bindings (device_id) 
WHERE binding_status = 'active';

-- 3. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, -- e.g. 'AUD-YYYYMMDD-XXXX' or UUID
    subscription_id TEXT,
    action TEXT NOT NULL CHECK (action IN ('create', 'link_device', 'replace_device', 'change_expiry', 'revoke', 'import_legacy')),
    admin_email TEXT,
    details JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Admin Sessions Table
CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    admin_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================================
-- Indexes for High Performance Queries and Filtering
-- ============================================================================

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (subscription_status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions (expiry_timestamp);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions (customer_name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop ON subscriptions (shop_name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_whatsapp ON subscriptions (whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions (created_at DESC);

-- Device Bindings indexes
CREATE INDEX IF NOT EXISTS idx_device_bindings_sub_id ON device_bindings (subscription_id);
CREATE INDEX IF NOT EXISTS idx_device_bindings_device_id ON device_bindings (device_id);
CREATE INDEX IF NOT EXISTS idx_device_bindings_status ON device_bindings (binding_status);
CREATE INDEX IF NOT EXISTS idx_device_bindings_last_seen ON device_bindings (last_seen_at DESC);

-- Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_sub_id ON audit_logs (subscription_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Admin Sessions indexes
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions (expires_at);

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all licensing tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Allow full access to postgres / service_role
DROP POLICY IF EXISTS service_role_all_subscriptions ON subscriptions;
CREATE POLICY service_role_all_subscriptions ON subscriptions FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_device_bindings ON device_bindings;
CREATE POLICY service_role_all_device_bindings ON device_bindings FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_audit_logs ON audit_logs;
CREATE POLICY service_role_all_audit_logs ON audit_logs FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_admin_sessions ON admin_sessions;
CREATE POLICY service_role_all_admin_sessions ON admin_sessions FOR ALL TO authenticated, service_role USING (true) WITH CHECK (true);

-- Allow public check-in updates for device_bindings last_seen_at via secure function or limited policy
-- (In serverless / Node backend, queries execute with database connection credentials or service role)
