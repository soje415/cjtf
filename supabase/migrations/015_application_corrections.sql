-- INT and Admin can correct applicant-submitted details that ICT mistyped or
-- missed during intake (name, DOB, address, contacts, etc). NIN/BVN are never
-- editable through this path — those stay locked to the identity-verification
-- flow. Every correction is logged as an application_notes row with a diff, so
-- 'int_corrected'/'admin_corrected' need to be allowed action values.
alter table public.application_notes drop constraint if exists application_notes_action_check;
alter table public.application_notes add constraint application_notes_action_check check (action in (
  'ict_verified','int_cleared','int_rejected','admin_approved','admin_rejected',
  'id_generated','training_completed','resubmitted','identity_waived',
  'rank_recommended','rank_assigned','int_corrected','admin_corrected'
));
