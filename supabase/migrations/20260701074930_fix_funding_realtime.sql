
-- Enable realtime for funding_requests
ALTER TABLE public.funding_requests REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='funding_requests';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.funding_requests'; END IF;
END $$;

-- Create RPC to approve funding with automatic wallet credit + notification
CREATE OR REPLACE FUNCTION public.approve_funding_with_notification(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  _fr public.funding_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _fr FROM public.funding_requests WHERE id = _id FOR UPDATE;
  IF _fr IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _fr.status != 'pending' THEN RAISE EXCEPTION 'Can only approve pending requests'; END IF;
  
  -- Update funding request status
  UPDATE public.funding_requests 
  SET status='approved', reviewed_at=now(), reviewer_id=auth.uid()
  WHERE id=_id;
  
  -- Credit wallet
  UPDATE public.wallets 
  SET balance = balance + _fr.amount, updated_at=now() 
  WHERE user_id=_fr.user_id;
  
  -- Create transaction record
  INSERT INTO public.transactions (user_id, type, amount, status, reference, description)
  VALUES (_fr.user_id, 'wallet', _fr.amount, 'success', _fr.reference, 
          'Wallet funding approved via bank transfer');
  
  -- Send notification to user
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_fr.user_id, '✅ Funding Approved', 
          'Your ₦' || _fr.amount::text || ' funding request has been approved. Wallet credited instantly.');
  
  -- Log admin action
  PERFORM public.log_admin_action('approve_funding', 'funding_request', _id::text, 
    jsonb_build_object('amount', _fr.amount, 'user_id', _fr.user_id, 'reference', _fr.reference));
END;
$$;

-- Create RPC to reject funding with notification
CREATE OR REPLACE FUNCTION public.reject_funding_with_notification(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  _fr public.funding_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _fr FROM public.funding_requests WHERE id = _id FOR UPDATE;
  IF _fr IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _fr.status != 'pending' THEN RAISE EXCEPTION 'Can only reject pending requests'; END IF;
  
  -- Update funding request status
  UPDATE public.funding_requests 
  SET status='rejected', reviewed_at=now(), reviewer_id=auth.uid(), note=_reason
  WHERE id=_id;
  
  -- Send rejection notification to user
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (_fr.user_id, '❌ Funding Rejected', 
          'Your ₦' || _fr.amount::text || ' funding request was rejected. Reason: ' || _reason);
  
  -- Log admin action
  PERFORM public.log_admin_action('reject_funding', 'funding_request', _id::text, 
    jsonb_build_object('reason', _reason, 'amount', _fr.amount));
END;
$$;

-- Ensure funding_requests has reviewer_id column
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS reviewer_id UUID;

-- Add RLS policy for funding_requests if missing
ALTER TABLE public.funding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own funding requests" ON public.funding_requests;
CREATE POLICY "Users can view own funding requests"
  ON public.funding_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own funding requests" ON public.funding_requests;
CREATE POLICY "Users can insert own funding requests"
  ON public.funding_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Only admins can update funding requests" ON public.funding_requests;
CREATE POLICY "Only admins can update funding requests"
  ON public.funding_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
