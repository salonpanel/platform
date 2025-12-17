-- Migration: Stripe Payments (Phase 12.5)
-- Description: Adds Stripe Connect fields to tenants and creates payments audit table.

-- 1. Tenants Update
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_onboarding_status TEXT DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_account ON tenants(stripe_account_id);

-- 2. Services Update (for deposit/payment config)
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_type TEXT CHECK (deposit_type IN ('fixed', 'percent'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_percent DECIMAL(5,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS online_payment_required BOOLEAN DEFAULT false;

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_session_id TEXT,
  service_id UUID REFERENCES services(id),
  barberia_id UUID REFERENCES tenants(id),
  booking_id UUID REFERENCES bookings(id),
  customer_name TEXT,
  customer_email TEXT,
  amount DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2),
  total_price DECIMAL(10,2),
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'refunded', 'disputed', 'failed')),
  balance_status TEXT CHECK (balance_status IN ('pending', 'available', 'paid_out')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_barberia ON payments(barberia_id);
CREATE INDEX IF NOT EXISTS idx_payments_service ON payments(service_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 4. RLS for payments (Optional but good practice)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow Service Role full access
CREATE POLICY "Service Role Full Access" ON payments
  USING (true)
  WITH CHECK (true);

-- Allow Tenants to view their own payments via PRO panel (authenticated)
-- Assuming auth.uid is mapped to memberships or tenants
-- For now, open to Service Role mainly.
