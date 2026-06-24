
CREATE TABLE IF NOT EXISTS public.fee_settings (
  key text PRIMARY KEY,
  percent numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fee_settings TO anon, authenticated;
GRANT ALL ON public.fee_settings TO service_role, authenticated;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fees readable by all" ON public.fee_settings FOR SELECT USING (true);
CREATE POLICY "fees writable by admin" ON public.fee_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.fee_settings(key, percent) VALUES ('wallet_funding',10),('data',7),('airtime',7)
  ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_bank_accounts TO anon, authenticated;
GRANT ALL ON public.admin_bank_accounts TO service_role, authenticated;
ALTER TABLE public.admin_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin banks readable by all" ON public.admin_bank_accounts FOR SELECT USING (true);
CREATE POLICY "admin banks writable by admin" ON public.admin_bank_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_admin_bank_updated BEFORE UPDATE ON public.admin_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.user_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bank_accounts TO authenticated;
GRANT ALL ON public.user_bank_accounts TO service_role;
ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage their bank accounts" ON public.user_bank_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all bank accounts" ON public.user_bank_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_user_bank_user ON public.user_bank_accounts(user_id);
CREATE TRIGGER trg_user_bank_updated BEFORE UPDATE ON public.user_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  template text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_logs TO service_role;
GRANT SELECT ON public.email_logs TO authenticated;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email logs admin only" ON public.email_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.data_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  plan_id text NOT NULL,
  plan_name text NOT NULL,
  category text,
  validity text,
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, plan_id)
);
GRANT SELECT ON public.data_plans TO anon, authenticated;
GRANT ALL ON public.data_plans TO service_role, authenticated;
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data plans readable by all" ON public.data_plans FOR SELECT USING (true);
CREATE POLICY "data plans writable by admin" ON public.data_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_data_plans_updated BEFORE UPDATE ON public.data_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
