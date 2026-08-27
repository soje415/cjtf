-- Legacy members (already serving, re-registering) are no longer required to
-- upload a guarantor form or declaration of age — new applicants still are.
-- For the edge case where a new applicant genuinely can't produce one, INT or
-- Admin can waive it explicitly, the same way identity verification can be
-- waived, so the application isn't stuck.
alter table public.applications
  add column if not exists guarantor_form_waived boolean not null default false,
  add column if not exists guarantor_form_waived_by uuid references public.profiles(id),
  add column if not exists guarantor_form_waived_reason text,
  add column if not exists age_declaration_waived boolean not null default false,
  add column if not exists age_declaration_waived_by uuid references public.profiles(id),
  add column if not exists age_declaration_waived_reason text;

alter table public.application_notes drop constraint if exists application_notes_action_check;
alter table public.application_notes add constraint application_notes_action_check check (action in (
  'ict_verified','int_cleared','int_rejected','admin_approved','admin_rejected',
  'id_generated','training_completed','resubmitted','identity_waived',
  'rank_recommended','rank_assigned','int_corrected','admin_corrected','document_waived'
));
