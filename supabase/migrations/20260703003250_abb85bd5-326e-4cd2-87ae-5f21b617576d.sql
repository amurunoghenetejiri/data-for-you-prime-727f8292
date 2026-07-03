
-- 1) Charge settings per service
CREATE TABLE IF NOT EXISTS public.charge_settings (
  service text PRIMARY KEY,
  label text NOT NULL,
  mode text NOT NULL DEFAULT 'percent' CHECK (mode IN ('fixed','percent')),
  value numeric NOT NULL DEFAULT 0 CHECK (value >= 0),
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.charge_settings TO anon, authenticated;
GRANT ALL ON public.charge_settings TO service_role;
ALTER TABLE public.charge_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "charge_settings read" ON public.charge_settings;
CREATE POLICY "charge_settings read" ON public.charge_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "charge_settings admin write" ON public.charge_settings;
CREATE POLICY "charge_settings admin write" ON public.charge_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.charge_settings(service,label,mode,value,is_active) VALUES
  ('data','Data Purchase','percent',0,true),
  ('airtime','Airtime Purchase','percent',0,true),
  ('funding_paystack','Wallet Funding (Paystack)','percent',0,true),
  ('funding_manual','Wallet Funding (Manual)','percent',0,true),
  ('transfer','Wallet Transfer','fixed',0,true),
  ('electricity','Electricity','percent',0,true),
  ('cable','Cable TV','percent',0,true),
  ('waec','WAEC','fixed',0,true),
  ('neco','NECO','fixed',0,true),
  ('jamb','JAMB','fixed',0,true),
  ('betting','Betting','percent',0,true)
ON CONFLICT (service) DO NOTHING;

-- 2) API provider registry
CREATE TABLE IF NOT EXISTS public.api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL,
  environment text NOT NULL DEFAULT 'live' CHECK (environment IN ('live','test')),
  webhook_url text,
  is_active boolean NOT NULL DEFAULT false,
  api_key_secret text,
  api_secret_secret text,
  extra_secret text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_providers TO authenticated;
GRANT ALL ON public.api_providers TO service_role;
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_providers admin" ON public.api_providers;
CREATE POLICY "api_providers admin" ON public.api_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS api_providers_one_active
  ON public.api_providers ((true)) WHERE is_active;

INSERT INTO public.api_providers(slug,name,base_url,environment,is_active,api_key_secret,extra_secret,config)
VALUES ('smeapi','SMEAPI','https://smeapi.com/api','live',true,'SMEAPI_API_KEY','SMEAPI_PIN', jsonb_build_object('username_secret','SMEAPI_USERNAME'))
ON CONFLICT (slug) DO NOTHING;

-- 3) Data plans: api_code + profit
ALTER TABLE public.data_plans
  ADD COLUMN IF NOT EXISTS api_code text,
  ADD COLUMN IF NOT EXISTS supplier text DEFAULT 'smeapi';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_plans' AND column_name='profit') THEN
    ALTER TABLE public.data_plans ADD COLUMN profit numeric GENERATED ALWAYS AS (COALESCE(selling_price,0) - COALESCE(cost_price,0)) STORED;
  END IF;
END $$;

-- Back-fill api_code from existing plan_id if empty
UPDATE public.data_plans SET api_code = plan_id WHERE api_code IS NULL AND plan_id IS NOT NULL;

-- 4) Transactions: charge, profit, provider_response, supplier_reference
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS supplier_reference text;

CREATE INDEX IF NOT EXISTS transactions_type_status_idx ON public.transactions(type,status);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON public.transactions(created_at DESC);

-- 5) apply_charge(service, amount)
CREATE OR REPLACE FUNCTION public.apply_charge(_service text, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.charge_settings;
BEGIN
  SELECT * INTO _row FROM public.charge_settings WHERE service = _service AND is_active = true;
  IF _row IS NULL THEN RETURN 0; END IF;
  IF _row.mode = 'fixed' THEN RETURN ROUND(_row.value::numeric, 2); END IF;
  RETURN ROUND((_amount * _row.value / 100.0)::numeric, 2);
END;$$;
GRANT EXECUTE ON FUNCTION public.apply_charge(text,numeric) TO anon, authenticated, service_role;

-- 6) refund_transaction
CREATE OR REPLACE FUNCTION public.refund_transaction(_tx_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _t public.transactions;
BEGIN
  SELECT * INTO _t FROM public.transactions WHERE id = _tx_id FOR UPDATE;
  IF _t IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF _t.status = 'refunded' THEN RETURN; END IF;
  -- Only refund debits (non-wallet-credit types)
  IF _t.type IN ('wallet','refund') THEN RAISE EXCEPTION 'Cannot refund a credit tx'; END IF;
  UPDATE public.wallets SET balance = balance + _t.amount + COALESCE(_t.charge,0), updated_at = now()
    WHERE user_id = _t.user_id;
  UPDATE public.transactions
    SET status = 'refunded',
        description = COALESCE(description,'') || ' — REFUNDED: ' || COALESCE(_reason,'auto'),
        meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('refund_reason',_reason,'refunded_at',now())
    WHERE id = _tx_id;
  INSERT INTO public.transactions(user_id,type,amount,status,reference,description)
  VALUES (_t.user_id,'refund', _t.amount + COALESCE(_t.charge,0), 'success',
          'RF-'||substr(md5(random()::text),1,8),
          'Refund for '||COALESCE(_t.reference,_t.id::text)||COALESCE(' — '||_reason,''));
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_t.user_id, 'Purchase refunded',
          '₦'||(_t.amount + COALESCE(_t.charge,0))::text||' refunded'||COALESCE(' — '||_reason,''));
END;$$;
GRANT EXECUTE ON FUNCTION public.refund_transaction(uuid,text) TO authenticated, service_role;

-- 7) touch_updated_at trigger for the new tables
DROP TRIGGER IF EXISTS trg_charge_settings_touch ON public.charge_settings;
CREATE TRIGGER trg_charge_settings_touch BEFORE UPDATE ON public.charge_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_api_providers_touch ON public.api_providers;
CREATE TRIGGER trg_api_providers_touch BEFORE UPDATE ON public.api_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8) Realtime for pricing/provider changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.charge_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_providers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.data_plans;
