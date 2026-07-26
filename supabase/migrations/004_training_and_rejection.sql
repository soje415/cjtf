-- ============================================================
-- CJTF Recruitment Portal — Batch 1
--  (a) Training stage between Admin approval and ID generation
--  (b) Rejection persistence + reactivation (resubmit after correction)
-- ============================================================

-- (a) New PENDING_TRAINING status
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check CHECK (status IN (
  'DRAFT','PENDING_PAYMENT','PENDING_ICT_VERIFICATION','PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL','PENDING_TRAINING','APPROVED_GENERATING_ID','COMPLETED','REJECTED'
));

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS trained_at TIMESTAMPTZ;

-- (b) Rejection metadata — persists who rejected, when, and why, so the
--     applicant can see it and the case can be routed back on resubmission.
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejected_by_role TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- New audit-trail actions
ALTER TABLE public.application_notes DROP CONSTRAINT IF EXISTS application_notes_action_check;
ALTER TABLE public.application_notes ADD CONSTRAINT application_notes_action_check CHECK (action IN (
  'ict_verified','int_cleared','int_rejected','admin_approved','admin_rejected',
  'id_generated','training_completed','resubmitted'
));
