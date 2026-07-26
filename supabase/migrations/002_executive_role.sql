-- ============================================================
-- CJTF Recruitment Portal — Executive (DSS) read-only oversight role
-- ============================================================

-- 1. Allow the new 'executive' role on profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('applicant','ict','int','admin','executive'));

-- ============================================================
-- 2. Executive access log — records every applicant record an
--    executive/DSS user views. This is the accountability trail
--    for privileged, full-visibility oversight access.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.executive_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  action          TEXT NOT NULL CHECK (action IN ('view_dashboard','view_application')),
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS executive_access_log_executive_idx ON public.executive_access_log (executive_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS executive_access_log_application_idx ON public.executive_access_log (application_id);

-- RLS on: writes are performed by the service role (which bypasses RLS),
-- so no policies are defined — the table is not reachable by anon/authenticated.
ALTER TABLE public.executive_access_log ENABLE ROW LEVEL SECURITY;
