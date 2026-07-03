-- Initialize VTU Purchase System Tables

-- API Providers Table
CREATE TABLE IF NOT EXISTS public.api_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_secret TEXT,
  api_secret_secret TEXT,
  extra_secret TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data Plans Table
CREATE TABLE IF NOT EXISTS public.data_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  data_size TEXT,
  api_code TEXT NOT NULL,
  plan_id TEXT,
  cost_price DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallet Table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Transactions Table (Main transaction record)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('airtime', 'data')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded')),
  
  -- Amount tracking
  product_amount DECIMAL(15, 2) NOT NULL,
  charge_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  profit DECIMAL(15, 2) DEFAULT 0,
  
  -- Provider and purchase details
  network TEXT,
  phone_number TEXT NOT NULL,
  
  -- For data purchases
  plan_id UUID REFERENCES public.data_plans(id),
  data_size TEXT,
  
  -- For airtime purchases
  airtime_amount DECIMAL(15, 2),
  
  -- SMEAPI Integration
  provider_name TEXT DEFAULT 'smeapi',
  provider_request JSONB,
  provider_response JSONB,
  supplier_reference TEXT,
  
  -- Transaction state
  wallet_debit_confirmed BOOLEAN DEFAULT FALSE,
  provider_success_confirmed BOOLEAN DEFAULT FALSE,
  refund_issued BOOLEAN DEFAULT FALSE,
  
  -- Description and metadata
  description TEXT,
  error_message TEXT,
  meta JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Logs Table (For debugging)
CREATE TABLE IF NOT EXISTS public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refund Log Table (Track all refunds)
CREATE TABLE IF NOT EXISTS public.refund_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_phone ON public.transactions(phone_number);
CREATE INDEX idx_api_logs_transaction_id ON public.api_logs(transaction_id);
CREATE INDEX idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX idx_refund_logs_transaction_id ON public.refund_logs(transaction_id);
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);

-- Enable RLS on all tables
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage providers" ON public.api_providers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage plans" ON public.data_plans
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own refunds" ON public.refund_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role manages transactions" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages wallets" ON public.wallets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages api logs" ON public.api_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages refunds" ON public.refund_logs
  FOR ALL USING (auth.role() = 'service_role');
