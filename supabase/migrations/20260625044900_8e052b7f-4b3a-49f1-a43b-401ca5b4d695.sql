
ALTER TABLE public.data_plans
  ADD COLUMN IF NOT EXISTS data_size text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_promo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.data_plans SET duration = COALESCE(duration, validity) WHERE duration IS NULL;

CREATE TABLE IF NOT EXISTS public.data_plan_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid,
  admin_id uuid,
  admin_email text,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_plan_audit TO authenticated;
GRANT ALL ON public.data_plan_audit TO service_role;
ALTER TABLE public.data_plan_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit readable by admin" ON public.data_plan_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert by admin" ON public.data_plan_audit FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.bank_verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  bank_name text,
  bank_code text,
  account_number text,
  account_name text,
  success boolean NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_verification_logs TO authenticated;
GRANT ALL ON public.bank_verification_logs TO service_role;
ALTER TABLE public.bank_verification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verif logs admin read" ON public.bank_verification_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "verif logs owner read" ON public.bank_verification_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_data_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.data_plan_audit(plan_id, admin_id, admin_email, action, after_data)
    VALUES (NEW.id, auth.uid(), _email, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.data_plan_audit(plan_id, admin_id, admin_email, action, before_data, after_data)
    VALUES (NEW.id, auth.uid(), _email, 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.data_plan_audit(plan_id, admin_id, admin_email, action, before_data)
    VALUES (OLD.id, auth.uid(), _email, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_data_plan_audit ON public.data_plans;
CREATE TRIGGER trg_data_plan_audit AFTER INSERT OR UPDATE OR DELETE ON public.data_plans
FOR EACH ROW EXECUTE FUNCTION public.log_data_plan_change();

DROP TRIGGER IF EXISTS trg_data_plans_touch ON public.data_plans;
CREATE TRIGGER trg_data_plans_touch BEFORE UPDATE ON public.data_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "data plans readable by all" ON public.data_plans;
DROP POLICY IF EXISTS "active plans public read" ON public.data_plans;
DROP POLICY IF EXISTS "all plans admin read" ON public.data_plans;
CREATE POLICY "active plans public read" ON public.data_plans FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "all plans admin read" ON public.data_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.data_plans TO anon;

INSERT INTO public.data_plans (network, plan_id, plan_name, category, validity, duration, data_size, cost_price, selling_price, discount_percent, is_active, is_promo)
SELECT
  n.id,
  n.id || '-' || s.cat_id || '-' || s.idx::text,
  upper(n.id) || ' ' || s.size || ' (' || s.validity || ')',
  s.cat_id,
  s.validity,
  s.validity,
  s.size,
  round((s.price + n.adj) * 0.92, 2),
  (s.price + n.adj),
  CASE WHEN s.cat_id='monthly' AND s.idx IN (3,4) THEN 20 ELSE 10 END,
  true,
  (s.cat_id='monthly' AND s.idx IN (3,4))
FROM (VALUES ('mtn',0),('glo',15),('airtel',10),('9mobile',20)) AS n(id, adj)
CROSS JOIN (VALUES
  ('daily','100MB','1 day',50,0),('daily','200MB','1 day',100,1),('daily','300MB','1 day',125,2),
  ('daily','500MB','1 day',100,3),('daily','1GB','1 day',210,4),('daily','2GB','1 day',250,5),
  ('daily','5GB','1 day',600,6),
  ('weekly','1GB','7 days',170,0),('weekly','2GB','7 days',250,1),('weekly','3GB','7 days',410,2),
  ('weekly','5GB','7 days',490,3),('weekly','10GB','7 days',3000,4),('weekly','15GB','7 days',6000,5),
  ('weekly','20GB','7 days',7500,6),
  ('monthly','1GB','30 days',350,0),('monthly','2GB','30 days',700,1),('monthly','3GB','30 days',1100,2),
  ('monthly','5GB','30 days',1800,3),('monthly','10GB','30 days',3500,4),('monthly','15GB','30 days',5500,5),
  ('monthly','20GB','30 days',7000,6),('monthly','30GB','30 days',10500,7),('monthly','50GB','30 days',16500,8),
  ('monthly','100GB','30 days',32000,9),
  ('night','500MB','Night 12am-5am',80,0),('night','1GB','Night 12am-5am',150,1),
  ('night','2GB','Night 12am-5am',280,2),('night','5GB','Night 12am-5am',600,3),
  ('night','10GB','Night 12am-5am',1200,4)
) AS s(cat_id, size, validity, price, idx)
ON CONFLICT (network, plan_id) DO NOTHING;
