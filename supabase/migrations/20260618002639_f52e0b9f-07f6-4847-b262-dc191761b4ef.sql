
-- Products / Data plans managed by admin
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'data',
  price numeric(14,2) NOT NULL,
  cost_price numeric(14,2),
  data_size text,
  validity text,
  discount_percent integer NOT NULL DEFAULT 0,
  cashback_percent integer NOT NULL DEFAULT 0,
  label text,
  countdown_start timestamptz,
  countdown_end timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Products admin insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Products admin update" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Products admin delete" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Audit logs (admin actions)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Audit admin insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());

-- Admin notes attached to a user
CREATE TABLE public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.admin_notes TO authenticated;
GRANT ALL ON public.admin_notes TO service_role;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notes admin read" ON public.admin_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Notes admin insert" ON public.admin_notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());
CREATE POLICY "Notes admin delete" ON public.admin_notes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- User status (block/unblock + verification)
CREATE TABLE public.user_status (
  user_id uuid PRIMARY KEY,
  is_blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  is_verified boolean NOT NULL DEFAULT false,
  blocked_at timestamptz,
  blocked_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_status TO authenticated;
GRANT ALL ON public.user_status TO service_role;
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Status self read" ON public.user_status FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Status admin insert" ON public.user_status FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Status admin update" ON public.user_status FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Private admin → user messages
CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  delivered boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Adm msg user read" ON public.admin_messages FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Adm msg admin insert" ON public.admin_messages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());

-- Helper: log_admin_action
CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _target_type text, _target_id text, _details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _email text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_logs (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (auth.uid(), _email, _action, _target_type, _target_id, COALESCE(_details,'{}'::jsonb));
END;
$$;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_user_status_updated BEFORE UPDATE ON public.user_status FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
