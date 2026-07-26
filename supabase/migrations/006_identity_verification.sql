-- ============================================================
-- CJTF Recruitment Portal — Identity verification (Hyparrow KYC)
--  Applicant verifies NIN or BVN against the government record.
--  Verified name/DOB/gender are written by the server; these
--  flags record that the verification (or a staff waiver) happened.
-- ============================================================

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verified        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_method   TEXT;  -- 'nin' | 'bvn'
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verified_at     TIMESTAMPTZ;

-- Staff override (ICT/Admin can waive verification for edge cases:
-- applicant has no NIN/BVN, or the KYC provider was unreachable).
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_waived         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_waived_by      UUID REFERENCES public.profiles(id);
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_waived_reason  TEXT;

-- Allow the waiver action in the audit trail.
ALTER TABLE public.application_notes DROP CONSTRAINT IF EXISTS application_notes_action_check;
ALTER TABLE public.application_notes ADD CONSTRAINT application_notes_action_check CHECK (action IN (
  'ict_verified','int_cleared','int_rejected',
  'admin_approved','admin_rejected','id_generated',
  'training_completed','resubmitted','identity_waived'
));
