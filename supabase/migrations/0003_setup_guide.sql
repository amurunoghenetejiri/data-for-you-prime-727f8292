-- Setup Guide for DATA4ME VTU Purchase System

-- ============================================
-- STEP 1: Run Initial Migrations
-- ============================================
-- Execute 0001_init_vtu_system.sql first
-- Execute 0002_vtu_functions.sql second

-- ============================================
-- STEP 2: Seed API Provider Configuration
-- ============================================

INSERT INTO public.api_providers (slug, name, base_url, api_key_secret, config, is_active)
VALUES (
  'smeapi',
  'SMEAPI',
  'https://api.smeapi.net',
  'SMEAPI_KEY',
  '{"username_secret": "SMEAPI_USERNAME"}'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  base_url = 'https://api.smeapi.net',
  is_active = true,
  updated_at = NOW();

-- ============================================
-- STEP 3: Seed Sample Data Plans
-- ============================================

-- MTN Data Plans
INSERT INTO public.data_plans (network, plan_name, data_size, api_code, plan_id, cost_price, selling_price, is_active)
VALUES
  ('MTN', 'MTN 100MB', '100MB', 'mtn_100', 'mtn_100', 45.00, 50.00, true),
  ('MTN', 'MTN 1GB', '1GB', 'mtn_1gb', 'mtn_1gb', 450.00, 500.00, true),
  ('MTN', 'MTN 2GB', '2GB', 'mtn_2gb', 'mtn_2gb', 900.00, 1000.00, true),
  ('MTN', 'MTN 5GB', '5GB', 'mtn_5gb', 'mtn_5gb', 2250.00, 2500.00, true),
  ('MTN', 'MTN 10GB', '10GB', 'mtn_10gb', 'mtn_10gb', 4500.00, 5000.00, true)
ON CONFLICT DO NOTHING;

-- GLO Data Plans
INSERT INTO public.data_plans (network, plan_name, data_size, api_code, plan_id, cost_price, selling_price, is_active)
VALUES
  ('GLO', 'GLO 100MB', '100MB', 'glo_100', 'glo_100', 40.00, 45.00, true),
  ('GLO', 'GLO 1GB', '1GB', 'glo_1gb', 'glo_1gb', 400.00, 450.00, true),
  ('GLO', 'GLO 2GB', '2GB', 'glo_2gb', 'glo_2gb', 800.00, 900.00, true),
  ('GLO', 'GLO 5GB', '5GB', 'glo_5gb', 'glo_5gb', 2000.00, 2250.00, true),
  ('GLO', 'GLO 10GB', '10GB', 'glo_10gb', 'glo_10gb', 4000.00, 4500.00, true)
ON CONFLICT DO NOTHING;

-- Airtel Data Plans
INSERT INTO public.data_plans (network, plan_name, data_size, api_code, plan_id, cost_price, selling_price, is_active)
VALUES
  ('AIRTEL', 'AIRTEL 100MB', '100MB', 'airtel_100', 'airtel_100', 40.00, 45.00, true),
  ('AIRTEL', 'AIRTEL 1GB', '1GB', 'airtel_1gb', 'airtel_1gb', 400.00, 450.00, true),
  ('AIRTEL', 'AIRTEL 2GB', '2GB', 'airtel_2gb', 'airtel_2gb', 800.00, 900.00, true),
  ('AIRTEL', 'AIRTEL 5GB', '5GB', 'airtel_5gb', 'airtel_5gb', 2000.00, 2250.00, true),
  ('AIRTEL', 'AIRTEL 10GB', '10GB', 'airtel_10gb', 'airtel_10gb', 4000.00, 4500.00, true)
ON CONFLICT DO NOTHING;

-- 9Mobile Data Plans
INSERT INTO public.data_plans (network, plan_name, data_size, api_code, plan_id, cost_price, selling_price, is_active)
VALUES
  ('9MOBILE', '9MOBILE 100MB', '100MB', '9mobile_100', '9mobile_100', 35.00, 40.00, true),
  ('9MOBILE', '9MOBILE 1GB', '1GB', '9mobile_1gb', '9mobile_1gb', 350.00, 400.00, true),
  ('9MOBILE', '9MOBILE 2GB', '2GB', '9mobile_2gb', '9mobile_2gb', 700.00, 800.00, true),
  ('9MOBILE', '9MOBILE 5GB', '5GB', '9mobile_5gb', '9mobile_5gb', 1750.00, 2000.00, true),
  ('9MOBILE', '9MOBILE 10GB', '10GB', '9mobile_10gb', '9mobile_10gb', 3500.00, 4000.00, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: Environment Variables Setup
-- ============================================
/*
Add these to your Supabase Edge Function secrets:

SMEAPI_KEY = 65AC10epAx6cC3C3bAC8Gg9BBAboa9t7i2Aqx2z5EAFBwxkCm1BIfydl483v1782217262
SMEAPI_USERNAME = (get from SMEAPI account)

Also ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
*/

-- ============================================
-- STEP 5: Verify Setup
-- ============================================

-- Check if tables exist
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('api_providers', 'data_plans', 'wallets', 'transactions', 'api_logs', 'refund_logs');

-- Check if provider is configured
SELECT * FROM public.api_providers WHERE slug = 'smeapi';

-- Check if data plans exist
SELECT COUNT(*) as total_plans FROM public.data_plans;

-- ============================================
-- STEP 6: Test Wallet Functions
-- ============================================

-- Create test wallet (run with service role)
-- SELECT public.init_user_wallet('USER_ID_HERE'::uuid);

-- Fund test wallet (manual update)
-- UPDATE public.wallets SET balance = 10000 WHERE user_id = 'USER_ID_HERE'::uuid;

-- Get wallet balance
-- SELECT public.get_wallet_balance('USER_ID_HERE'::uuid);
