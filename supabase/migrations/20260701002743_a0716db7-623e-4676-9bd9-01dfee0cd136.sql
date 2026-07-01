
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS paystack_mode TEXT NOT NULL DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS paystack_test_public_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paystack_live_public_key TEXT DEFAULT '';
