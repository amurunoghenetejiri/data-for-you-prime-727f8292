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
  IF LOWER(NEW.email) IN ('amurundestiny@gmail.com', 'amurundestin@gmail.com', 'admin@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill admin role for any existing matching accounts
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE LOWER(email) IN ('amurundestiny@gmail.com', 'amurundestin@gmail.com', 'admin@gmail.com')
ON CONFLICT DO NOTHING;