-- ============================================================
-- CJTF Recruitment Portal — Phone (OTP) verification for applicants
-- ============================================================

-- 1. Verified flag on the profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Pending OTP challenge — one current row per user.
--    Codes are stored hashed; rows are deleted on success/expiry.
CREATE TABLE IF NOT EXISTS public.phone_otps (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service-role only (OTP send/verify run server-side); no policies defined.
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
