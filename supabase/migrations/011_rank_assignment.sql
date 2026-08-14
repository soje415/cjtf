-- ============================================================
-- Rank assignment in the applicant flow
-- ============================================================
-- After ICT forwards, INT recommends a rank when clearing to Admin, and Admin
-- picks the final rank when approving. ICT then prints that final rank on the
-- ID card, so `cjtf_rank` must be set before an application can reach COMPLETED.
--
-- Two columns rather than one: the recommendation is kept even when Admin
-- overrides it, so the trail shows what INT proposed vs. what Command issued.
--
-- The column is `cjtf_rank`, not `rank`: PostgREST resolves a bare `rank` in a
-- select list to the ordered-set aggregate of the same name and fails the
-- request with 42809 ("WITHIN GROUP is required for ordered-set aggregate
-- rank"). Confirmed against this database — any explicit select of a column
-- called `rank` would 400.

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS recommended_rank TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS cjtf_rank TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rank_assigned_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rank_assigned_at TIMESTAMPTZ;

-- Signatures printed on the card back: the holder signs at the ICT desk, the
-- issuing officer's signature is drawn or uploaded from a scan. Stored as
-- public URLs in the applicant-documents bucket, so a card re-downloaded months
-- later still carries the signatures it was issued with.
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS holder_signature_url TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS officer_signature_url TEXT;

-- New audit-trail actions for the two rank writes.
ALTER TABLE public.application_notes DROP CONSTRAINT IF EXISTS application_notes_action_check;
ALTER TABLE public.application_notes ADD CONSTRAINT application_notes_action_check CHECK (action IN (
  'ict_verified','int_cleared','int_rejected','admin_approved','admin_rejected',
  'id_generated','training_completed','resubmitted','identity_waived',
  'rank_recommended','rank_assigned'
));
