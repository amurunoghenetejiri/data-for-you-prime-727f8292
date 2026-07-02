
-- 1. Add wallets to realtime publication (so user's balance updates instantly)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='wallets') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets';
  END IF;
END $$;

-- 2. Storage RLS for `receipts` bucket
-- Users may upload/read files under their own uid folder; admins may read all.
DROP POLICY IF EXISTS "receipts_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_user_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_admin_all" ON storage.objects;

CREATE POLICY "receipts_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "receipts_user_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "receipts_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

-- 3. Helper RPC: has the user got a pending funding request?
CREATE OR REPLACE FUNCTION public.has_pending_funding(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.funding_requests WHERE user_id=_user_id AND status IN ('pending','processing'))
$$;
