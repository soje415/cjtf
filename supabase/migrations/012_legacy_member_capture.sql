-- ============================================================
-- Legacy member capture pipeline
-- ============================================================
-- CJTF already has serving members who only exist on paper, never in the
-- portal DB. They self-register through a variant of the applicant wizard to
-- get digitised and issued a portal ID card. They pay a reduced fee and skip
-- INT screening entirely (ICT verify -> Admin approve) because they're
-- already vetted members — this is digitisation + card issuance, not
-- recruitment.
--
-- `membership_type` is set once at creation (app/api/applications POST) and
-- is deliberately never patchable afterward — see the PATCH allowlist in
-- app/api/applications/[id]/route.ts. Otherwise an applicant could create as
-- 'new' and flip to 'legacy' right before paying to get the cheaper fee.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS membership_type TEXT NOT NULL DEFAULT 'new'
    CHECK (membership_type IN ('new', 'legacy'));

-- What a legacy applicant claims about their existing paper-record status,
-- captured self-service at submission. `self_reported_rank` seeds (but does
-- not replace) Admin's rank picker at approval — cjtf_rank remains the only
-- authoritative, card-printed value, written by the existing /approve route
-- unchanged. legacy_id_number/vouching_* let ICT/Admin cross-check the claim
-- against physical unit records at their existing review steps, mirroring
-- the office-registration district-head endorsement pattern (free-text name
-- + an uploaded scan of a signed physical document).
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS self_reported_rank TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS legacy_id_number TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS vouching_officer_name TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS vouching_doc_url TEXT;
