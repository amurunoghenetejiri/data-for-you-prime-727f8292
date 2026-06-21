
-- 1) Update handle_new_user to also auto-grant admin to admin@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF LOWER(NEW.email) IN ('amurundestiny@gmail.com', 'admin@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Make sure the auth trigger exists (re-create idempotently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Withdrawal approve / reject RPCs (admin only)
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF _w IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _w.status NOT IN ('pending','processing','approved') THEN RAISE EXCEPTION 'Cannot approve'; END IF;
  UPDATE public.withdrawals SET status='successful', updated_at=now() WHERE id=_id;
  INSERT INTO public.transactions (user_id, type, amount, status, reference, description)
  VALUES (_w.user_id, 'transfer', _w.amount, 'success', 'WD-'||substr(md5(random()::text),1,8),
          'Withdrawal approved to '||_w.bank_name||' '||_w.account_number);
  INSERT INTO public.notifications (user_id, title, body) VALUES
    (_w.user_id, 'Withdrawal successful', 'Your ₦'||_w.amount::text||' withdrawal has been approved.');
  PERFORM public.log_admin_action('withdrawal_approved','withdrawal',_id::text, jsonb_build_object('amount',_w.amount));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF _w IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _w.status NOT IN ('pending','processing','approved') THEN RAISE EXCEPTION 'Cannot reject'; END IF;
  UPDATE public.withdrawals SET status='rejected', updated_at=now() WHERE id=_id;
  -- Refund wallet
  UPDATE public.wallets SET balance = balance + _w.amount, updated_at=now() WHERE user_id=_w.user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, reference, description)
  VALUES (_w.user_id, 'refund', _w.amount, 'success', 'RF-'||substr(md5(random()::text),1,8),
          'Withdrawal rejected — refunded'||CASE WHEN _reason IS NOT NULL THEN ': '||_reason ELSE '' END);
  INSERT INTO public.notifications (user_id, title, body) VALUES
    (_w.user_id, 'Withdrawal rejected', COALESCE(_reason,'Your withdrawal request was rejected and funds returned to your wallet.'));
  PERFORM public.log_admin_action('withdrawal_rejected','withdrawal',_id::text, jsonb_build_object('amount',_w.amount,'reason',_reason));
END;
$$;

-- 3) Realtime: ensure full row payloads + add to publication
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.withdrawals  REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='withdrawals';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transactions';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions'; END IF;
END $$;
