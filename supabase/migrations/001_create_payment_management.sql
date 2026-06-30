-- Payment Providers Configuration
CREATE TABLE IF NOT EXISTS payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE, -- 'paystack', 'monnify', etc.
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb, -- Stores provider-specific settings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Paystack Configuration
CREATE TABLE IF NOT EXISTS paystack_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')) DEFAULT 'test',
  test_public_key TEXT,
  test_secret_key TEXT,
  test_webhook_secret TEXT,
  live_public_key TEXT,
  live_secret_key TEXT,
  live_webhook_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Monnify Configuration
CREATE TABLE IF NOT EXISTS monnify_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT false,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')) DEFAULT 'sandbox',
  api_key TEXT,
  secret_key TEXT,
  contract_code TEXT,
  base_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Manual Payment Methods
CREATE TABLE IF NOT EXISTS manual_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., 'Bank Transfer', 'Opay', 'PalmPay'
  display_name TEXT NOT NULL, -- Human-readable name for users
  bank_name TEXT, -- e.g., 'UBA', 'Access Bank'
  account_name TEXT,
  account_number TEXT,
  is_enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  logo_url TEXT, -- URL to payment method logo/icon
  description TEXT,
  payment_instructions TEXT, -- Custom instructions for this method
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Payment Method Storage for sensitive data (encrypted)
CREATE TABLE IF NOT EXISTS payment_method_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id UUID NOT NULL REFERENCES manual_payment_methods(id) ON DELETE CASCADE,
  secret_key TEXT,
  api_credentials JSONB, -- Store as encrypted JSON if needed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payment Configuration Audit Log
CREATE TABLE IF NOT EXISTS payment_config_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  target_type TEXT NOT NULL, -- 'paystack', 'monnify', 'manual_payment_method'
  target_id UUID,
  changes JSONB, -- What was changed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE paystack_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE monnify_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_method_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_config_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access payment configuration
CREATE POLICY "Only admins can view payment_providers" ON payment_providers
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can insert payment_providers" ON payment_providers
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update payment_providers" ON payment_providers
  FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can delete payment_providers" ON payment_providers
  FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can view paystack_config" ON paystack_config
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update paystack_config" ON paystack_config
  FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can view monnify_config" ON monnify_config
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can update monnify_config" ON monnify_config
  FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can manage manual_payment_methods" ON manual_payment_methods
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can manage payment_method_secrets" ON payment_method_secrets
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Only admins can view payment_config_audit" ON payment_config_audit
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Initialize default data
INSERT INTO payment_providers (provider_name, is_enabled, config)
VALUES
  ('paystack', false, '{"mode": "test"}'::jsonb),
  ('monnify', false, '{"environment": "sandbox"}'::jsonb),
  ('manual_bank_transfer', false, '{"description": "Manual bank transfer"}'::jsonb)
ON CONFLICT (provider_name) DO NOTHING;

-- Create one paystack config row (singleton pattern)
INSERT INTO paystack_config (id, mode)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test')
ON CONFLICT DO NOTHING;

-- Create one monnify config row (singleton pattern)
INSERT INTO monnify_config (id, environment)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'sandbox')
ON CONFLICT DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX idx_manual_payment_methods_enabled ON manual_payment_methods(is_enabled);
CREATE INDEX idx_manual_payment_methods_sort_order ON manual_payment_methods(sort_order);
CREATE INDEX idx_payment_config_audit_admin ON payment_config_audit(admin_id);
CREATE INDEX idx_payment_config_audit_created ON payment_config_audit(created_at);
