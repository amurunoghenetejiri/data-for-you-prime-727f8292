
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'signup',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_codes_email_idx ON public.otp_codes (lower(email), created_at DESC);
GRANT ALL ON public.otp_codes TO service_role;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (edge functions) may touch this table.
