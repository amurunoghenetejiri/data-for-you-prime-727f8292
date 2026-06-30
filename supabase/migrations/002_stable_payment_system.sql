-- ============================================================================
-- STABLE PAYMENT SYSTEM - Lovable Cloud Database
-- Simplified to: Paystack + Manual Bank Transfer only
-- ============================================================================

-- ============================================================================
-- 1. PAYSTACK CONFIGURATION (Singleton)
-- ============================================================================
CREATE TABLE IF NOT EXISTS paystack_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  test_public_key TEXT,
  test_secret_key TEXT,
  live_public_key TEXT,
  live_secret_key TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 2. MANUAL BANK TRANSFER CONFIGURATION (Singleton)
-- ============================================================================
CREATE TABLE IF NOT EXISTS manual_bank_transfer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  instructions TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 3. TRANSACTIONS TABLE (Real-time transaction tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  reference_number TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paystack', 'manual_bank_transfer')),
  service_type TEXT NOT NULL CHECK (service_type IN ('wallet_funding', 'airtime', 'data', 'cable', 'electricity', 'other')),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'rejected')),
  paystack_ref TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. MANUAL TRANSFER APPROVALS (For admin approval workflow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS manual_transfer_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE,
  admin_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_manual_approvals_transaction ON manual_transfer_approvals(transaction_id);
CREATE INDEX IF NOT EXISTS idx_manual_approvals_admin ON manual_transfer_approvals(admin_id);
CREATE INDEX IF NOT EXISTS idx_manual_approvals_status ON manual_transfer_approvals(status);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE paystack_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_bank_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_transfer_approvals ENABLE ROW LEVEL SECURITY;

-- Paystack config - Admins only
CREATE POLICY "Only admins can view paystack_config" ON paystack_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

CREATE POLICY "Only admins can update paystack_config" ON paystack_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

-- Manual bank transfer - Admins can manage, users can view
CREATE POLICY "Anyone can view manual_bank_transfer" ON manual_bank_transfer
  FOR SELECT USING (true);

CREATE POLICY "Only admins can update manual_bank_transfer" ON manual_bank_transfer
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

-- Transactions - Users see their own, admins see all
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

CREATE POLICY "System can insert transactions" ON transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

-- Manual approvals - Admins only
CREATE POLICY "Only admins can view manual_transfer_approvals" ON manual_transfer_approvals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

CREATE POLICY "Only admins can manage manual_transfer_approvals" ON manual_transfer_approvals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

-- ============================================================================
-- 7. INITIALIZE DEFAULT DATA
-- ============================================================================

-- Initialize Paystack config (singleton)
INSERT INTO paystack_config (id, mode, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Initialize Manual Bank Transfer config (singleton)
INSERT INTO manual_bank_transfer (id, bank_name, account_name, account_number, instructions, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Access Bank',
  'Your Company Name',
  '0000000000',
  'Send exactly the amount shown. Use your username as reference.',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE payment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view payment_audit_logs" ON payment_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.is_admin = true)
  );

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON payment_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON payment_audit_logs(created_at DESC);
