-- ============================================================
-- Record when office submit gates were waived for the pilot
-- ============================================================
-- lib/pilot.ts lets an office registration be submitted without an office-space
-- photo or a verified NIN/BVN while the pilot runs. Each such submission writes
-- an audit note so those registrations can be found and re-verified when the
-- checks are hardened — which needs a new allowed value for notes.action.

ALTER TABLE public.office_registration_notes DROP CONSTRAINT IF EXISTS office_registration_notes_action_check;
ALTER TABLE public.office_registration_notes ADD CONSTRAINT office_registration_notes_action_check
  CHECK (action IN (
    'int_cleared','int_rejected','admin_approved','admin_rejected',
    'cert_generated','resubmitted','identity_waived','endorsement_uploaded',
    'pilot_checks_relaxed'
  ));
