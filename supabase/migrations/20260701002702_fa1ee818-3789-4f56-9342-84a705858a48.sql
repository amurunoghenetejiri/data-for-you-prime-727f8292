
-- Shared timestamp updater (create if missing)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 1. payment_bank_accounts
CREATE TABLE public.payment_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT DEFAULT 'Savings',
  instructions TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_bank_accounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_bank_accounts TO authenticated;
GRANT ALL ON public.payment_bank_accounts TO service_role;
ALTER TABLE public.payment_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active bank accounts" ON public.payment_bank_accounts
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage bank accounts" ON public.payment_bank_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enforce_single_default_bank()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.payment_bank_accounts SET is_default = false
      WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_single_default_bank BEFORE INSERT OR UPDATE ON public.payment_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_default_bank();
CREATE TRIGGER trg_bank_updated BEFORE UPDATE ON public.payment_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

INSERT INTO public.payment_bank_accounts (bank_name, account_name, account_number, is_default, is_active, sort_order)
SELECT COALESCE(bank_name,'Bank'), COALESCE(bank_account_name,'DATA4ME'), COALESCE(bank_account_number,'0000000000'), true, true, 0
FROM public.app_settings WHERE id = 1 AND COALESCE(bank_account_number,'') <> ''
ON CONFLICT DO NOTHING;

-- 2. user_activity_log
CREATE TABLE public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all activity" ON public.user_activity_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own activity" ON public.user_activity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_activity_user ON public.user_activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_category ON public.user_activity_log(category, created_at DESC);

-- 3. secure_secrets
CREATE TABLE public.secure_secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.secure_secrets TO service_role;
ALTER TABLE public.secure_secrets ENABLE ROW LEVEL SECURITY;

-- 4. Payment toggles
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS paystack_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_bank_enabled BOOLEAN NOT NULL DEFAULT true;

-- 5. Activity triggers
CREATE OR REPLACE FUNCTION public.log_activity_funding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_activity_log(user_id, category, action, status, details)
    VALUES (NEW.user_id, 'wallet',
      CASE WHEN NEW.provider = 'paystack' THEN 'Wallet funding via Paystack' ELSE 'Wallet funding via bank transfer' END,
      COALESCE(NEW.status,'pending'),
      jsonb_build_object('amount', NEW.amount, 'reference', NEW.reference, 'bank', NEW.bank));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.user_activity_log(user_id, category, action, status, details)
    VALUES (NEW.user_id, 'wallet', 'Funding request ' || NEW.status, NEW.status,
      jsonb_build_object('amount', NEW.amount, 'reference', NEW.reference));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_activity_funding AFTER INSERT OR UPDATE ON public.funding_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_funding();

CREATE OR REPLACE FUNCTION public.log_activity_tx()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_activity_log(user_id, category, action, status, details)
  VALUES (NEW.user_id, COALESCE(NEW.type,'transaction'),
    COALESCE(NEW.description, NEW.type || ' transaction'),
    COALESCE(NEW.status,'success'),
    jsonb_build_object('amount', NEW.amount, 'reference', NEW.reference, 'type', NEW.type));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_activity_tx AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_tx();

CREATE OR REPLACE FUNCTION public.log_activity_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_activity_log(user_id, category, action, status, details)
  VALUES (NEW.user_id, 'auth', 'User signed in', 'success', '{}'::jsonb);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_activity_login AFTER INSERT ON public.login_activity
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_login();
