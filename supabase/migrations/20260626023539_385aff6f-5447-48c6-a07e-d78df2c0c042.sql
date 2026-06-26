
-- 1. Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  event text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity self insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Activity admin read" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs (created_at DESC);

-- 2. Extend user_status with status + suspension
ALTER TABLE public.user_status ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.user_status ADD COLUMN IF NOT EXISTS suspended_until timestamptz;
ALTER TABLE public.user_status ADD CONSTRAINT user_status_status_chk CHECK (status IN ('active','suspended','blocked','disabled'));

-- 3. Funding request review fields
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS reviewer_id uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS admin_remark text;

-- 4. RPC: log activity (any user)
CREATE OR REPLACE FUNCTION public.log_activity(_event text, _category text, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.activity_logs(user_id, user_email, event, category, details)
  VALUES (auth.uid(), _email, _event, COALESCE(_category,'general'), COALESCE(_details,'{}'::jsonb));
  -- Admin broadcast notification (lightweight)
  INSERT INTO public.notifications(user_id, title, body)
  VALUES (NULL, _event, COALESCE(_email,'system')||' • '||COALESCE(_category,'general'));
END;$$;
REVOKE EXECUTE ON FUNCTION public.log_activity(text,text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text,text,jsonb) TO authenticated;

-- 5. RPC: approve funding
CREATE OR REPLACE FUNCTION public.approve_funding(_id uuid, _remark text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.funding_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _f FROM public.funding_requests WHERE id=_id FOR UPDATE;
  IF _f IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _f.status NOT IN ('pending','processing') THEN RAISE EXCEPTION 'Cannot approve'; END IF;
  UPDATE public.funding_requests SET status='approved', admin_remark=_remark, reviewer_id=auth.uid(), reviewed_at=now() WHERE id=_id;
  UPDATE public.wallets SET balance = balance + _f.amount, updated_at=now() WHERE user_id=_f.user_id;
  INSERT INTO public.transactions(user_id,type,amount,status,reference,description)
  VALUES (_f.user_id,'wallet',_f.amount,'success', COALESCE(_f.reference,'FR-'||substr(md5(random()::text),1,8)),
          'Funding approved'||CASE WHEN _remark IS NOT NULL THEN ' — '||_remark ELSE '' END);
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_f.user_id,'Funding approved','₦'||_f.amount::text||' has been added to your wallet.'||COALESCE(' Note: '||_remark,''));
  PERFORM public.log_admin_action('funding_approved','funding',_id::text, jsonb_build_object('amount',_f.amount,'remark',_remark));
END;$$;
REVOKE EXECUTE ON FUNCTION public.approve_funding(uuid,text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_funding(uuid,text) TO authenticated;

-- 6. RPC: reject funding
CREATE OR REPLACE FUNCTION public.reject_funding(_id uuid, _remark text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.funding_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _f FROM public.funding_requests WHERE id=_id FOR UPDATE;
  IF _f IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  UPDATE public.funding_requests SET status='rejected', admin_remark=_remark, reviewer_id=auth.uid(), reviewed_at=now() WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_f.user_id,'Funding rejected', COALESCE(_remark,'Your funding request was rejected.'));
  PERFORM public.log_admin_action('funding_rejected','funding',_id::text, jsonb_build_object('amount',_f.amount,'remark',_remark));
END;$$;
GRANT EXECUTE ON FUNCTION public.reject_funding(uuid,text) TO authenticated;

-- 7. RPC: cancel funding
CREATE OR REPLACE FUNCTION public.cancel_funding(_id uuid, _remark text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.funding_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _f FROM public.funding_requests WHERE id=_id FOR UPDATE;
  IF _f IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  UPDATE public.funding_requests SET status='cancelled', admin_remark=_remark, reviewer_id=auth.uid(), reviewed_at=now() WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_f.user_id,'Funding cancelled', COALESCE(_remark,'Your funding request was cancelled.'));
  PERFORM public.log_admin_action('funding_cancelled','funding',_id::text, jsonb_build_object('amount',_f.amount,'remark',_remark));
END;$$;
GRANT EXECUTE ON FUNCTION public.cancel_funding(uuid,text) TO authenticated;

-- 8. RPC: set user status (block/suspend/disable/activate)
CREATE OR REPLACE FUNCTION public.set_user_status(_user_id uuid, _status text, _reason text DEFAULT NULL, _suspended_until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _status NOT IN ('active','suspended','blocked','disabled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  INSERT INTO public.user_status(user_id, status, is_blocked, block_reason, blocked_at, blocked_by, suspended_until, updated_at)
  VALUES (_user_id, _status, _status IN ('blocked','disabled'), _reason,
          CASE WHEN _status IN ('blocked','disabled','suspended') THEN now() ELSE NULL END,
          auth.uid(), _suspended_until, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    is_blocked = EXCLUDED.is_blocked,
    block_reason = EXCLUDED.block_reason,
    blocked_at = EXCLUDED.blocked_at,
    blocked_by = EXCLUDED.blocked_by,
    suspended_until = EXCLUDED.suspended_until,
    updated_at = now();
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (_user_id,'Account status updated','Your account is now '||_status||COALESCE('. Reason: '||_reason,''));
  PERFORM public.log_admin_action('status_change','user',_user_id::text, jsonb_build_object('status',_status,'reason',_reason));
END;$$;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid,text,text,timestamptz) TO authenticated;

-- 9. Ensure user_status has unique user_id for upsert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_status_user_id_key') THEN
    BEGIN ALTER TABLE public.user_status ADD CONSTRAINT user_status_user_id_key UNIQUE(user_id); EXCEPTION WHEN duplicate_table THEN NULL; END;
  END IF;
END $$;

-- 10. Enable realtime for live updates
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.funding_requests REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.user_status REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.funding_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
