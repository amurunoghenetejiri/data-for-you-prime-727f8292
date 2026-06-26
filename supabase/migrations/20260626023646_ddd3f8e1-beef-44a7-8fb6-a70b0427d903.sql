
CREATE OR REPLACE FUNCTION public.tg_log_profile_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.activity_logs(user_id,user_email,event,category,details)
  VALUES (NEW.id, NEW.email, 'User registered', 'auth', jsonb_build_object('username',NEW.username));
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (NULL,'New user registered', COALESCE(NEW.email,NEW.username));
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS log_profile_signup ON public.profiles;
CREATE TRIGGER log_profile_signup AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_log_profile_signup();

CREATE OR REPLACE FUNCTION public.tg_log_funding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id=NEW.user_id;
  INSERT INTO public.activity_logs(user_id,user_email,event,category,details)
  VALUES (NEW.user_id,_email,'Funding request '||NEW.status,'funding',
          jsonb_build_object('amount',NEW.amount,'bank',NEW.bank,'reference',NEW.reference));
  IF TG_OP='INSERT' THEN
    INSERT INTO public.notifications(user_id,title,body)
    VALUES (NULL,'New funding request', COALESCE(_email,'user')||' • ₦'||NEW.amount::text);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS log_funding ON public.funding_requests;
CREATE TRIGGER log_funding AFTER INSERT OR UPDATE OF status ON public.funding_requests FOR EACH ROW EXECUTE FUNCTION public.tg_log_funding();

CREATE OR REPLACE FUNCTION public.tg_log_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id=NEW.user_id;
  INSERT INTO public.activity_logs(user_id,user_email,event,category,details)
  VALUES (NEW.user_id,_email, COALESCE(NEW.type,'transaction')||' '||COALESCE(NEW.status,''),
          COALESCE(NEW.type,'transaction'),
          jsonb_build_object('amount',NEW.amount,'reference',NEW.reference,'description',NEW.description));
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (NULL, COALESCE(NEW.type,'transaction')||' • '||COALESCE(NEW.status,''),
          COALESCE(_email,'user')||' • ₦'||NEW.amount::text);
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS log_transaction ON public.transactions;
CREATE TRIGGER log_transaction AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.tg_log_transaction();

CREATE OR REPLACE FUNCTION public.tg_log_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.activity_logs(user_id,user_email,event,category,details)
  VALUES (NEW.user_id, NEW.email, 'Support message: '||COALESCE(NEW.subject,'(no subject)'),'support',
          jsonb_build_object('name',NEW.name,'message',left(NEW.message,200)));
  INSERT INTO public.notifications(user_id,title,body)
  VALUES (NULL,'New support message', COALESCE(NEW.email,NEW.name)||' • '||COALESCE(NEW.subject,''));
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS log_contact ON public.contact_messages;
CREATE TRIGGER log_contact AFTER INSERT ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.tg_log_contact();
