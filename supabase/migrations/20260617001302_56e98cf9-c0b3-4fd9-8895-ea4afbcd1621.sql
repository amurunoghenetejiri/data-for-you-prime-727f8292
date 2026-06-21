
-- Extend funding_requests
ALTER TABLE public.funding_requests
  ADD COLUMN IF NOT EXISTS bank text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Allow users to INSERT their own funding requests; admins to update
DROP POLICY IF EXISTS "Funding self insert" ON public.funding_requests;
CREATE POLICY "Funding self insert" ON public.funding_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Funding admin update" ON public.funding_requests;
CREATE POLICY "Funding admin update" ON public.funding_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT INSERT ON public.funding_requests TO authenticated;
GRANT UPDATE ON public.funding_requests TO authenticated;

-- bank_details
CREATE TABLE IF NOT EXISTS public.bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_details TO authenticated;
GRANT ALL ON public.bank_details TO service_role;
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bank self all" ON public.bank_details FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
GRANT UPDATE ON public.withdrawals TO authenticated;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Withdrawals self read" ON public.withdrawals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Withdrawals self insert" ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Withdrawals admin update" ON public.withdrawals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  username text NOT NULL,
  avatar_id text,
  body text NOT NULL,
  reply_to uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat read all auth" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Chat self insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Chat admin update" ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- login_activity
CREATE TABLE IF NOT EXISTS public.login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.login_activity TO authenticated;
GRANT ALL ON public.login_activity TO service_role;
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Login self read" ON public.login_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Login self insert" ON public.login_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- contact_messages
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.contact_messages TO authenticated;
GRANT INSERT ON public.contact_messages TO anon;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contact anyone insert" ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Contact admin read" ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- app_settings (single-row config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  paystack_public_key text DEFAULT '',
  paystack_mode text NOT NULL DEFAULT 'test',
  bank_name text NOT NULL DEFAULT 'Opay',
  bank_account_name text NOT NULL DEFAULT 'Jaskitinana',
  bank_account_number text NOT NULL DEFAULT '8165906606',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings read all" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Settings admin update" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
